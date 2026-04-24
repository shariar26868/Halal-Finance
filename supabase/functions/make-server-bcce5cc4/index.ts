import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono().basePath('/make-server-bcce5cc4');

// Helper to create Supabase client with service role
const getServiceClient = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Helper to create Supabase client with anon key
const getAnonClient = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
);

// Helper to verify user authentication
const verifyAuth = async (authHeader: string | null) => {
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Missing authorization header' };
  }
  const accessToken = authHeader.split(' ')[1];
  
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      return { user: null, error: 'Unauthorized - invalid token' };
    }
    return { user: data.user, error: null };
  } catch (err: any) {
    console.log(`Auth verification error: ${err.message}`);
    return { user: null, error: 'Token verification failed' };
  }
};

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Initialize storage bucket on startup
const initStorage = async () => {
  try {
    const supabase = getServiceClient();
    const bucketName = 'make-bcce5cc4-kyc-documents';

    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);

    if (!bucketExists) {
      const { error } = await supabase.storage.createBucket(bucketName, {
        public: false,
        fileSizeLimit: 10485760, // 10MB
      });
      if (error) {
        console.log(`Storage bucket creation error (may already exist): ${error.message}`);
      } else {
        console.log('Storage bucket created successfully');
      }
    }
  } catch (error) {
    console.log(`Storage initialization error: ${error.message}`);
  }
};

// Call on startup
initStorage();

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// ========== AUTHENTICATION ENDPOINTS ==========

// Sign up with email/password
app.post("/auth/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name, phone, role = 'user' } = body;

    if (!email || !password || !name || !phone) {
      return c.json({ error: 'Missing required fields: email, password, name, phone' }, 400);
    }

    const supabase = getServiceClient();

    // Create user with Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, phone, role },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.log(`Signup error during user creation: ${error.message}`);
      return c.json({ error: `Signup failed: ${error.message}` }, 400);
    }

    // Store user profile in KV store
    const userProfile = {
      id: data.user.id,
      email,
      name,
      phone,
      role,
      createdAt: new Date().toISOString(),
      kycStatus: 'pending'
    };
    
    await kv.set(`user:${data.user.id}`, userProfile);
    console.log(`User created and stored in KV:`, userProfile);

    return c.json({
      message: 'User created successfully',
      userId: data.user.id
    });
  } catch (error) {
    console.log(`Signup error: ${error.message}`);
    return c.json({ error: `Signup failed: ${error.message}` }, 500);
  }
});

// Sign in with email/password
app.post("/auth/signin", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: 'Missing email or password' }, 400);
    }

    const supabase = getAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log(`Signin error during authentication: ${error.message}`);
      return c.json({ error: `Signin failed: ${error.message}` }, 401);
    }

    // Get user profile from KV, merge with Supabase metadata as fallback
    const userProfile = await kv.get(`user:${data.user.id}`);

    const resolvedName =
      userProfile?.name ||
      data.user.user_metadata?.name ||
      data.user.email?.split('@')[0] ||
      'User';

    const resolvedProfile = {
      id: data.user.id,
      email: data.user.email,
      name: resolvedName,
      phone: userProfile?.phone || data.user.user_metadata?.phone || '',
      role: userProfile?.role || data.user.user_metadata?.role || 'user',
      kycStatus: userProfile?.kycStatus || 'pending',
      ...(userProfile || {}),
      name: resolvedName,
      email: data.user.email,
      id: data.user.id,
    };

    return c.json({
      accessToken: data.session.access_token,
      user: resolvedProfile
    });
  } catch (error) {
    console.log(`Signin error: ${error.message}`);
    return c.json({ error: `Signin failed: ${error.message}` }, 500);
  }
});

// Sign in with Google OAuth
app.post("/auth/oauth/google", async (c) => {
  try {
    const supabase = getAnonClient();

    // Do not forget to complete setup at https://supabase.com/docs/guides/auth/social-login/auth-google
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      console.log(`Google OAuth error during sign in: ${error.message}`);
      return c.json({ error: `OAuth failed: ${error.message}` }, 400);
    }

    return c.json({ url: data.url });
  } catch (error) {
    console.log(`Google OAuth error: ${error.message}`);
    return c.json({ error: `OAuth failed: ${error.message}` }, 500);
  }
});

// Get current session
app.get("/auth/session", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: error || 'Not authenticated' }, 401);
    }

    const userProfile = await kv.get(`user:${user.id}`);

    // Always merge KV profile with Supabase metadata as fallback
    const resolvedName =
      userProfile?.name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'User';

    const resolvedProfile = {
      id: user.id,
      email: user.email,
      name: resolvedName,
      phone: userProfile?.phone || user.user_metadata?.phone || '',
      role: userProfile?.role || user.user_metadata?.role || 'user',
      kycStatus: userProfile?.kycStatus || 'pending',
      ...(userProfile || {}),
      // Ensure these are never overridden with undefined
      name: resolvedName,
      email: user.email,
      id: user.id,
    };

    return c.json({ user: resolvedProfile });
  } catch (error) {
    console.log(`Session error: ${error.message}`);
    return c.json({ error: 'Session check failed' }, 500);
  }
});

// Change password
app.post("/auth/change-password", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: error || 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return c.json({ error: 'Missing required fields: currentPassword, newPassword' }, 400);
    }

    if (newPassword.length < 6) {
      return c.json({ error: 'New password must be at least 6 characters' }, 400);
    }

    // Verify current password by attempting sign in
    const anonClient = getAnonClient();
    const { error: verifyError } = await anonClient.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });

    if (verifyError) {
      return c.json({ error: 'Current password is incorrect' }, 400);
    }

    // Update password using service role
    const supabase = getServiceClient();
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (updateError) {
      return c.json({ error: `Password update failed: ${updateError.message}` }, 500);
    }

    return c.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.log(`Change password error: ${error.message}`);
    return c.json({ error: 'Password change failed' }, 500);
  }
});

// Sign out
app.post("/auth/signout", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const supabase = getServiceClient();
    await supabase.auth.admin.signOut(user.id);

    return c.json({ message: 'Signed out successfully' });
  } catch (error) {
    console.log(`Signout error: ${error.message}`);
    return c.json({ error: 'Signout failed' }, 500);
  }
});

// ========== USER PROFILE & KYC ENDPOINTS ==========

// Update user profile
app.put("/user/profile", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: error || 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const currentProfile = await kv.get(`user:${user.id}`) || {};

    const updatedProfile = {
      ...currentProfile,
      ...body,
      id: user.id, // Prevent ID override
      updatedAt: new Date().toISOString()
    };

    await kv.set(`user:${user.id}`, updatedProfile);

    return c.json({ message: 'Profile updated', profile: updatedProfile });
  } catch (error) {
    console.log(`Profile update error: ${error.message}`);
    return c.json({ error: 'Profile update failed' }, 500);
  }
});

// Get user profile
app.get("/user/profile", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: error || 'Unauthorized' }, 401);
    }

    const profile = await kv.get(`user:${user.id}`);

    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    return c.json({ profile });
  } catch (error) {
    console.log(`Profile retrieval error: ${error.message}`);
    return c.json({ error: 'Profile retrieval failed' }, 500);
  }
});

// Upload KYC documents
app.post("/user/kyc/upload", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: error || 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { fileName, fileData, fileType, documentType } = body;

    if (!fileName || !fileData || !documentType) {
      return c.json({ error: 'Missing required fields: fileName, fileData, documentType' }, 400);
    }

    const supabase = getServiceClient();
    const bucketName = 'make-bcce5cc4-kyc-documents';

    // Decode base64 file data
    const fileBuffer = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));

    // Sanitize filename - remove special characters
    const sanitizedFileName = fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);

    // Upload to Supabase Storage
    const filePath = `${user.id}/${documentType}/${Date.now()}_${sanitizedFileName}`;
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType: fileType || 'application/octet-stream',
        upsert: false
      });

    if (uploadError) {
      console.log(`File upload error for ${documentType}: ${uploadError.message}`);
      return c.json({ error: `Upload failed: ${uploadError.message}` }, 500);
    }

    // Update user profile with document reference
    const userProfile = await kv.get(`user:${user.id}`) || {};
    const kycDocs = userProfile.kycDocuments || {};
    kycDocs[documentType] = filePath;

    userProfile.kycDocuments = kycDocs;
    userProfile.kycStatus = 'submitted';
    userProfile.updatedAt = new Date().toISOString();

    await kv.set(`user:${user.id}`, userProfile);
    console.log(`KYC document uploaded for user ${user.id}, status set to submitted:`, userProfile);

    return c.json({
      message: 'Document uploaded successfully',
      filePath,
      kycStatus: 'submitted'
    });
  } catch (error) {
    console.log(`KYC upload error: ${error.message}`);
    return c.json({ error: `Upload failed: ${error.message}` }, 500);
  }
});

// Get signed URL for KYC document
app.get("/user/kyc/document/:userId/:docType", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: error || 'Unauthorized' }, 401);
    }

    const userId = c.req.param('userId');
    const docType = c.req.param('docType');

    // Check permissions - only admin or self can view
    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile.role !== 'admin' && userId !== user.id) {
      return c.json({ error: 'Forbidden - insufficient permissions' }, 403);
    }

    const targetProfile = await kv.get(`user:${userId}`);
    const filePath = targetProfile?.kycDocuments?.[docType];

    if (!filePath) {
      return c.json({ error: 'Document not found' }, 404);
    }

    const supabase = getServiceClient();
    const { data, error: signError } = await supabase.storage
      .from('make-bcce5cc4-kyc-documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (signError) {
      console.log(`Signed URL creation error: ${signError.message}`);
      return c.json({ error: 'Failed to generate document URL' }, 500);
    }

    return c.json({ url: data.signedUrl });
  } catch (error) {
    console.log(`Document retrieval error: ${error.message}`);
    return c.json({ error: 'Document retrieval failed' }, 500);
  }
});

// ========== PAYMENT ENDPOINTS ==========

// Submit payment request
app.post("/payments/submit", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: error || 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { paymentDate, paidFrom, transactionId, paidMonth, paidAmount } = body;

    if (!paymentDate || !paidFrom || !transactionId || !paidMonth || !paidAmount) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const paymentId = `payment:${user.id}:${Date.now()}`;
    const payment = {
      id: paymentId,
      userId: user.id,
      paymentDate,
      dateOfEntry: new Date().toISOString(),
      paidFrom,
      transactionId,
      paidMonth,
      paidAmount: parseFloat(paidAmount),
      status: 'pending',
      createdBy: 'user',
      createdAt: new Date().toISOString()
    };

    await kv.set(paymentId, payment);

    return c.json({
      message: 'Payment submitted for approval',
      payment
    });
  } catch (error) {
    console.log(`Payment submission error: ${error.message}`);
    return c.json({ error: 'Payment submission failed' }, 500);
  }
});

// Get user's payment history
app.get("/payments/user", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: error || 'Unauthorized' }, 401);
    }

    const allPayments = await kv.getByPrefix(`payment:${user.id}:`);
    const sortedPayments = allPayments.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const totalPaid = allPayments
      .filter(p => p.status === 'approved')
      .reduce((sum, p) => sum + p.paidAmount, 0);

    return c.json({
      payments: sortedPayments,
      totalPaid
    });
  } catch (error) {
    console.log(`Payment retrieval error: ${error.message}`);
    return c.json({ error: 'Payment retrieval failed' }, 500);
  }
});

// Admin: Get all payments (with optional filters)
app.get("/admin/payments", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: error || 'Unauthorized' }, 401);
    }

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden - admin access required' }, 403);
    }

    const allPayments = await kv.getByPrefix('payment:');
    const sortedPayments = allPayments.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const totalCollected = allPayments
      .filter(p => p.status === 'approved')
      .reduce((sum, p) => sum + p.paidAmount, 0);

    const totalPending = allPayments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.paidAmount, 0);

    return c.json({
      payments: sortedPayments,
      stats: {
        totalCollected,
        totalPending,
        totalPayments: allPayments.length
      }
    });
  } catch (error) {
    console.log(`Admin payment retrieval error: ${error.message}`);
    return c.json({ error: 'Payment retrieval failed' }, 500);
  }
});

// Admin: Approve payment
app.post("/admin/payments/:paymentId/approve", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: error || 'Unauthorized' }, 401);
    }

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden - admin access required' }, 403);
    }

    const paymentId = c.req.param('paymentId');
    const payment = await kv.get(paymentId);

    if (!payment) {
      return c.json({ error: 'Payment not found' }, 404);
    }

    payment.status = 'approved';
    payment.approvedBy = user.id;
    payment.approvedAt = new Date().toISOString();

    await kv.set(paymentId, payment);

    // Audit log
    await kv.set(`audit:${Date.now()}`, {
      action: 'payment_approved',
      performedBy: user.id,
      performedByName: userProfile.name || 'Admin',
      targetUserId: payment.userId,
      details: `Approved payment of ৳${payment.paidAmount} (ID: ${paymentId.slice(-8)})`,
      timestamp: new Date().toISOString(),
    });

    return c.json({
      message: 'Payment approved',
      payment
    });
  } catch (error) {
    console.log(`Payment approval error: ${error.message}`);
    return c.json({ error: 'Payment approval failed' }, 500);
  }
});

// Admin: Reject payment
app.post("/admin/payments/:paymentId/reject", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: error || 'Unauthorized' }, 401);
    }

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden - admin access required' }, 403);
    }

    const paymentId = c.req.param('paymentId');
    const body = await c.req.json();
    const { reason } = body;

    const payment = await kv.get(paymentId);

    if (!payment) {
      return c.json({ error: 'Payment not found' }, 404);
    }

    payment.status = 'rejected';
    payment.rejectedBy = user.id;
    payment.rejectedAt = new Date().toISOString();
    payment.rejectionReason = reason || 'No reason provided';

    await kv.set(paymentId, payment);

    // Audit log
    await kv.set(`audit:${Date.now()}`, {
      action: 'payment_rejected',
      performedBy: user.id,
      performedByName: userProfile.name || 'Admin',
      targetUserId: payment.userId,
      details: `Rejected payment of ৳${payment.paidAmount} - Reason: ${reason || 'No reason provided'}`,
      timestamp: new Date().toISOString(),
    });

    return c.json({
      message: 'Payment rejected',
      payment
    });
  } catch (error) {
    console.log(`Payment rejection error: ${error.message}`);
    return c.json({ error: 'Payment rejection failed' }, 500);
  }
});

// Admin: Add payment directly
app.post("/admin/payments/add", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: error || 'Unauthorized' }, 401);
    }

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden - admin access required' }, 403);
    }

    const body = await c.req.json();
    const { userId, paymentDate, paidFrom, transactionId, paidMonth, paidAmount } = body;

    if (!userId || !paymentDate || !paidFrom || !paidMonth || !paidAmount) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const paymentId = `payment:${userId}:${Date.now()}`;
    const payment = {
      id: paymentId,
      userId,
      paymentDate,
      dateOfEntry: new Date().toISOString(),
      paidFrom,
      transactionId: transactionId || 'N/A',
      paidMonth,
      paidAmount: parseFloat(paidAmount),
      status: 'approved',
      createdBy: 'admin',
      createdById: user.id,
      createdAt: new Date().toISOString()
    };

    await kv.set(paymentId, payment);

    return c.json({
      message: 'Payment added successfully',
      payment
    });
  } catch (error) {
    console.log(`Admin payment addition error: ${error.message}`);
    return c.json({ error: 'Payment addition failed' }, 500);
  }
});

// ========== USER MANAGEMENT ENDPOINTS (ADMIN) ==========

// Get all users
app.get("/admin/users", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: error || 'Unauthorized' }, 401);
    }

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden - admin access required' }, 403);
    }

    const allUsers = await kv.getByPrefix('user:');
    
    // Ensure all users have required fields with fallbacks
    const usersWithFallbacks = allUsers.map(u => ({
      ...u,
      name: u.name || u.email?.split('@')[0] || 'Unknown User',
      email: u.email || 'No email',
      phone: u.phone || 'N/A'
    }));
    
    console.log(`Admin fetched ${usersWithFallbacks.length} users:`, usersWithFallbacks.map(u => ({ 
      id: u.id, 
      email: u.email, 
      name: u.name,
      phone: u.phone,
      kycStatus: u.kycStatus
    })));

    return c.json({ users: usersWithFallbacks });
  } catch (error) {
    console.log(`User listing error: ${error.message}`);
    return c.json({ error: 'User listing failed' }, 500);
  }
});

// Get user by ID
app.get("/admin/users/:userId", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: error || 'Unauthorized' }, 401);
    }

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden - admin access required' }, 403);
    }

    const userId = c.req.param('userId');
    const targetUser = await kv.get(`user:${userId}`);

    if (!targetUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get user's payments
    const payments = await kv.getByPrefix(`payment:${userId}:`);
    const totalPaid = payments
      .filter(p => p.status === 'approved')
      .reduce((sum, p) => sum + p.paidAmount, 0);

    return c.json({
      user: targetUser,
      paymentSummary: {
        totalPaid,
        totalPayments: payments.length,
        pendingPayments: payments.filter(p => p.status === 'pending').length
      }
    });
  } catch (error) {
    console.log(`User retrieval error: ${error.message}`);
    return c.json({ error: 'User retrieval failed' }, 500);
  }
});

// Update user (admin) - for KYC approval/rejection
app.put("/admin/users/:userId", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: error || 'Unauthorized' }, 401);
    }

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden - admin access required' }, 403);
    }

    const userId = c.req.param('userId');
    const targetUser = await kv.get(`user:${userId}`);

    if (!targetUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    const body = await c.req.json();
    const { kycStatus, rejectionReason } = body;

    if (!kycStatus) {
      return c.json({ error: 'Missing required field: kycStatus' }, 400);
    }

    // Update KYC status
    targetUser.kycStatus = kycStatus;
    if (rejectionReason) {
      targetUser.rejectionReason = rejectionReason;
    }
    targetUser.updatedAt = new Date().toISOString();
    targetUser.updatedBy = user.id;

    await kv.set(`user:${userId}`, targetUser);

    // Audit log
    await kv.set(`audit:${Date.now()}`, {
      action: `kyc_${kycStatus}`,
      performedBy: user.id,
      performedByName: userProfile.name || 'Admin',
      targetUserId: userId,
      targetUserName: targetUser.name || targetUser.email,
      details: `KYC ${kycStatus} for user ${targetUser.name || targetUser.email}${rejectionReason ? ` - Reason: ${rejectionReason}` : ''}`,
      timestamp: new Date().toISOString(),
    });

    return c.json({
      message: `KYC status updated to ${kycStatus}`,
      user: targetUser
    });
  } catch (error) {
    console.log(`User update error: ${error.message}`);
    return c.json({ error: 'User update failed' }, 500);
  }
});

// Create user (admin)
app.post("/admin/users/create", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: error || 'Unauthorized' }, 401);
    }

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden - admin access required' }, 403);
    }

    const body = await c.req.json();
    const { email, password, name, phone, role = 'user' } = body;

    if (!email || !password || !name || !phone) {
      return c.json({ error: 'Missing required fields: email, password, name, phone' }, 400);
    }

    const supabase = getServiceClient();

    const { data, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, phone, role },
      email_confirm: true
    });

    if (createError) {
      console.log(`Admin user creation error: ${createError.message}`);
      return c.json({ error: `User creation failed: ${createError.message}` }, 400);
    }

    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      email,
      name,
      phone,
      role,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      kycStatus: 'pending'
    });

    return c.json({
      message: 'User created successfully',
      userId: data.user.id
    });
  } catch (error) {
    console.log(`Admin user creation error: ${error.message}`);
    return c.json({ error: 'User creation failed' }, 500);
  }
});

// Deactivate user
app.delete("/admin/users/:userId", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);

    if (error || !user) {
      return c.json({ error: error || 'Unauthorized' }, 401);
    }

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden - admin access required' }, 403);
    }

    const userId = c.req.param('userId');
    const targetUser = await kv.get(`user:${userId}`);

    if (!targetUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Mark as deactivated instead of deleting
    targetUser.status = 'deactivated';
    targetUser.deactivatedBy = user.id;
    targetUser.deactivatedAt = new Date().toISOString();

    await kv.set(`user:${userId}`, targetUser);

    return c.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.log(`User deactivation error: ${error.message}`);
    return c.json({ error: 'User deactivation failed' }, 500);
  }
});

// ========== ANNOUNCEMENTS ENDPOINTS ==========

// Admin: Create announcement
app.post("/admin/announcements", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);
    if (error || !user) return c.json({ error: error || 'Unauthorized' }, 401);

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile?.role !== 'admin') return c.json({ error: 'Forbidden - admin access required' }, 403);

    const body = await c.req.json();
    const { title, message, priority = 'normal' } = body;

    if (!title || !message) return c.json({ error: 'Missing required fields: title, message' }, 400);

    const announcementId = `announcement:${Date.now()}`;
    const announcement = {
      id: announcementId,
      title,
      message,
      priority,
      createdBy: user.id,
      createdByName: userProfile.name || 'Admin',
      createdAt: new Date().toISOString(),
      active: true,
    };

    await kv.set(announcementId, announcement);

    // Log audit
    await kv.set(`audit:${Date.now()}`, {
      action: 'announcement_created',
      performedBy: user.id,
      performedByName: userProfile.name || 'Admin',
      details: `Created announcement: "${title}"`,
      timestamp: new Date().toISOString(),
    });

    return c.json({ message: 'Announcement created', announcement });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Get all active announcements (all authenticated users)
app.get("/announcements", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);
    if (error || !user) return c.json({ error: error || 'Unauthorized' }, 401);

    const all = await kv.getByPrefix('announcement:');
    const active = all.filter((a: any) => a.active !== false).sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return c.json({ announcements: active });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Admin: Delete/deactivate announcement
app.delete("/admin/announcements/:id", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);
    if (error || !user) return c.json({ error: error || 'Unauthorized' }, 401);

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile?.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

    const id = c.req.param('id');
    const announcement = await kv.get(id);
    if (!announcement) return c.json({ error: 'Not found' }, 404);

    announcement.active = false;
    await kv.set(id, announcement);

    return c.json({ message: 'Announcement removed' });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// ========== AUDIT LOG ENDPOINTS ==========

// Admin: Get audit logs
app.get("/admin/audit-logs", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);
    if (error || !user) return c.json({ error: error || 'Unauthorized' }, 401);

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile?.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

    const logs = await kv.getByPrefix('audit:');
    const sorted = logs.sort((a: any, b: any) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return c.json({ logs: sorted.slice(0, 100) }); // last 100 logs
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// ========== FORGOT PASSWORD ==========

// Request password reset (sends reset link via Supabase)
app.post("/auth/forgot-password", async (c) => {
  try {
    const body = await c.req.json();
    const { email, redirectTo } = body;

    if (!email) return c.json({ error: 'Email is required' }, 400);

    const supabase = getAnonClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || 'http://localhost:5173/reset-password',
    });

    if (error) {
      console.log(`Password reset error: ${error.message}`);
      return c.json({ error: `Reset failed: ${error.message}` }, 400);
    }

    return c.json({ message: 'Password reset email sent. Please check your inbox.' });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// ========== OVERRIDE ADMIN ACTIONS TO LOG THEM ==========

// Override KYC approval to add audit log - handled inline in PUT /admin/users/:userId above
// We'll patch the existing endpoint by adding audit logging there

Deno.serve(app.fetch);