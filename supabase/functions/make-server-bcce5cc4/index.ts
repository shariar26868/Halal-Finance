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

    // If user was already approved and is replacing a document,
    // reset to 'submitted' so admin must re-approve
    if (userProfile.kycStatus === 'approved') {
      userProfile.kycStatus = 'submitted';
      userProfile.kycResubmitted = true;
      userProfile.resubmittedAt = new Date().toISOString();
      console.log(`User ${user.id} replaced a document after approval - status reset to submitted`);
    } else {
      userProfile.kycStatus = 'submitted';
    }

    userProfile.updatedAt = new Date().toISOString();

    await kv.set(`user:${user.id}`, userProfile);
    console.log(`KYC document uploaded for user ${user.id}, status: ${userProfile.kycStatus}`);

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

// Get signed URL for payment screenshot
app.get("/payments/screenshot/:paymentId", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);
    if (error || !user) return c.json({ error: error || 'Unauthorized' }, 401);

    const paymentId = decodeURIComponent(c.req.param('paymentId'));
    const payment = await kv.get(paymentId);
    if (!payment) return c.json({ error: 'Payment not found' }, 404);

    // Only admin or the payment owner can view
    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile?.role !== 'admin' && payment.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    if (!payment.screenshotPath) return c.json({ error: 'No screenshot for this payment' }, 404);

    const supabase = getServiceClient();
    const { data, error: signError } = await supabase.storage
      .from('make-bcce5cc4-kyc-documents')
      .createSignedUrl(payment.screenshotPath, 3600);

    if (signError) return c.json({ error: 'Failed to generate URL' }, 500);

    return c.json({ url: data.signedUrl });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// ========== PAYMENT ENDPOINTS ==========

// Submit payment request
app.post("/payments/submit", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);
    if (error || !user) return c.json({ error: error || 'Unauthorized' }, 401);

    const body = await c.req.json();
    const { paymentDate, paidFrom, transactionId, paidAmount, paymentScreenshot } = body;

    if (!paymentDate || !paidFrom || !transactionId || !paidAmount) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    if (!paymentScreenshot?.fileData) {
      return c.json({ error: 'Payment screenshot is required' }, 400);
    }

    const INSTALLMENT_RATE = 5000;
    const amount = parseFloat(paidAmount);

    if (amount < INSTALLMENT_RATE) {
      return c.json({ error: `Minimum payment amount is ৳${INSTALLMENT_RATE}` }, 400);
    }

    // Upload screenshot to storage
    let screenshotPath: string | null = null;
    if (paymentScreenshot?.fileData && paymentScreenshot?.fileName) {
      try {
        const supabase = getServiceClient();
        const bucketName = 'make-bcce5cc4-kyc-documents';
        const fileBuffer = Uint8Array.from(atob(paymentScreenshot.fileData), (c) => c.charCodeAt(0));
        const sanitizedName = paymentScreenshot.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
        screenshotPath = `${user.id}/payments/${Date.now()}_${sanitizedName}`;
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(screenshotPath, fileBuffer, {
            contentType: paymentScreenshot.fileType || 'image/jpeg',
            upsert: false,
          });
        if (uploadError) {
          console.log(`Screenshot upload error: ${uploadError.message}`);
          screenshotPath = null;
        }
      } catch (e: any) {
        console.log(`Screenshot upload failed: ${e.message}`);
      }
    }

    // Find user's last approved payment month to determine next month
    const allUserPayments = await kv.getByPrefix(`payment:${user.id}:`);
    const approvedPayments = allUserPayments
      .filter((p: any) => p.status === 'approved' && p.paidMonth)
      .sort((a: any, b: any) => b.paidMonth.localeCompare(a.paidMonth));

    // Determine starting month: next after last approved, or current month if no history
    let startMonth: Date;
    if (approvedPayments.length > 0) {
      const lastMonth = approvedPayments[0].paidMonth; // e.g. "2026-03"
      const [y, m] = lastMonth.split('-').map(Number);
      startMonth = new Date(y, m, 1); // next month after last paid
    } else {
      // No payment history - start from current month
      const now = new Date();
      startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Calculate how many full installments and extra
    const fullMonths = Math.floor(amount / INSTALLMENT_RATE);
    const extraAmount = amount % INSTALLMENT_RATE;

    // Create payment records for each month
    const createdPayments = [];
    const now = Date.now();

    for (let i = 0; i < fullMonths; i++) {
      const monthDate = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
      const paidMonth = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      const paymentId = `payment:${user.id}:${now + i}`;

      const payment = {
        id: paymentId,
        userId: user.id,
        paymentDate,
        dateOfEntry: new Date().toISOString(),
        paidFrom,
        transactionId,
        paidMonth,
        paidAmount: INSTALLMENT_RATE,
        status: 'pending',
        createdBy: 'user',
        createdAt: new Date().toISOString(),
        isPartOfBatch: true,
        batchTotal: amount,
        batchMonths: fullMonths,
        ...(screenshotPath ? { screenshotPath } : {}),
      };

      await kv.set(paymentId, payment);
      createdPayments.push(payment);
    }

    // Handle extra amount - create a separate extra payment record
    let extraPayment = null;
    if (extraAmount > 0) {
      const extraId = `payment:${user.id}:${now + fullMonths}`;
      extraPayment = {
        id: extraId,
        userId: user.id,
        paymentDate,
        dateOfEntry: new Date().toISOString(),
        paidFrom,
        transactionId,
        paidMonth: 'extra',
        paidAmount: extraAmount,
        status: 'pending',
        createdBy: 'user',
        createdAt: new Date().toISOString(),
        isExtra: true,
        ...(screenshotPath ? { screenshotPath } : {}),
      };
      await kv.set(extraId, extraPayment);
    }

    return c.json({
      message: `Payment submitted for ${fullMonths} month(s)${extraAmount > 0 ? ` + ৳${extraAmount} extra` : ''}`,
      monthsCovered: createdPayments.map(p => p.paidMonth),
      extraAmount: extraAmount > 0 ? extraAmount : null,
      payments: createdPayments,
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
    const { userId, paymentDate, paidFrom, transactionId, paidMonth, paidAmount, paymentScreenshot } = body;

    if (!userId || !paymentDate || !paidFrom || !paidAmount) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const INSTALLMENT_RATE = 5000;
    const amount = parseFloat(paidAmount);

    if (amount < INSTALLMENT_RATE) {
      return c.json({ error: `Minimum payment amount is ৳${INSTALLMENT_RATE}` }, 400);
    }

    // Upload screenshot if provided
    let screenshotPath: string | null = null;
    if (paymentScreenshot?.fileData && paymentScreenshot?.fileName) {
      try {
        const supabase = getServiceClient();
        const bucketName = 'make-bcce5cc4-kyc-documents';
        const fileBuffer = Uint8Array.from(atob(paymentScreenshot.fileData), (c) => c.charCodeAt(0));
        const sanitizedName = paymentScreenshot.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
        screenshotPath = `${userId}/payments/${Date.now()}_${sanitizedName}`;
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(screenshotPath, fileBuffer, {
            contentType: paymentScreenshot.fileType || 'image/jpeg',
            upsert: false,
          });
        if (uploadError) screenshotPath = null;
      } catch (e: any) {
        console.log(`Admin screenshot upload failed: ${e.message}`);
      }
    }

    // Find user's last approved payment month
    const allUserPayments = await kv.getByPrefix(`payment:${userId}:`);
    const approvedPayments = allUserPayments
      .filter((p: any) => p.status === 'approved' && p.paidMonth && p.paidMonth !== 'extra')
      .sort((a: any, b: any) => b.paidMonth.localeCompare(a.paidMonth));

    let startMonth: Date;
    if (approvedPayments.length > 0) {
      const lastMonth = approvedPayments[0].paidMonth;
      const [y, m] = lastMonth.split('-').map(Number);
      startMonth = new Date(y, m, 1);
    } else {
      const now = new Date();
      startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const fullMonths = Math.floor(amount / INSTALLMENT_RATE);
    const extraAmount = amount % INSTALLMENT_RATE;
    const createdPayments = [];
    const nowTs = Date.now();

    for (let i = 0; i < fullMonths; i++) {
      const monthDate = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      const paymentId = `payment:${userId}:${nowTs + i}`;

      const payment = {
        id: paymentId,
        userId,
        paymentDate,
        dateOfEntry: new Date().toISOString(),
        paidFrom,
        transactionId: transactionId || 'N/A',
        paidMonth: monthKey,
        paidAmount: INSTALLMENT_RATE,
        status: 'approved',
        createdBy: 'admin',
        createdById: user.id,
        createdAt: new Date().toISOString(),
        isPartOfBatch: true,
        batchTotal: amount,
        ...(screenshotPath ? { screenshotPath } : {}),
      };

      await kv.set(paymentId, payment);
      createdPayments.push(payment);
    }

    // Extra amount record
    if (extraAmount > 0) {
      const extraId = `payment:${userId}:${nowTs + fullMonths}`;
      await kv.set(extraId, {
        id: extraId,
        userId,
        paymentDate,
        dateOfEntry: new Date().toISOString(),
        paidFrom,
        transactionId: transactionId || 'N/A',
        paidMonth: 'extra',
        paidAmount: extraAmount,
        status: 'approved',
        createdBy: 'admin',
        createdById: user.id,
        createdAt: new Date().toISOString(),
        isExtra: true,
        ...(screenshotPath ? { screenshotPath } : {}),
      });
    }

    return c.json({
      message: `Payment added for ${fullMonths} month(s)${extraAmount > 0 ? ` + ৳${extraAmount} extra` : ''}`,
      monthsCovered: createdPayments.map(p => p.paidMonth),
      extraAmount: extraAmount > 0 ? extraAmount : null,
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

// ========== PLOT INFORMATION ENDPOINTS ==========

// User: Submit a plot post
app.post("/plots/submit", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);
    if (error || !user) return c.json({ error: error || 'Unauthorized' }, 401);

    const body = await c.req.json();
    const { title, description, location, area, price, contactNumber, link, videoData, videoFileName, videoFileType } = body;

    if (!title || !description || !location) {
      return c.json({ error: 'Missing required fields: title, description, location' }, 400);
    }

    // Upload video if provided
    let videoPath: string | null = null;
    if (videoData && videoFileName) {
      try {
        const supabase = getServiceClient();
        const bucketName = 'make-bcce5cc4-kyc-documents';
        const fileBuffer = Uint8Array.from(atob(videoData), (c) => c.charCodeAt(0));
        const sanitizedName = videoFileName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
        videoPath = `${user.id}/plots/${Date.now()}_${sanitizedName}`;
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(videoPath, fileBuffer, {
            contentType: videoFileType || 'video/mp4',
            upsert: false,
          });
        if (uploadError) {
          console.log(`Video upload error: ${uploadError.message}`);
          videoPath = null;
        }
      } catch (e: any) {
        console.log(`Video upload failed: ${e.message}`);
      }
    }

    const userProfile = await kv.get(`user:${user.id}`);
    const plotId = `plot:${Date.now()}:${user.id}`;
    const plot = {
      id: plotId,
      userId: user.id,
      userName: userProfile?.name || 'Unknown',
      userEmail: userProfile?.email || '',
      title,
      description,
      location,
      area: area || '',
      price: price || '',
      contactNumber: contactNumber || '',
      link: link || '',
      videoPath: videoPath || null,
      status: 'pending', // admin reviews before showing
      createdAt: new Date().toISOString(),
    };

    await kv.set(plotId, plot);

    return c.json({ message: 'Plot information submitted for review', plot });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Get all approved plots (all authenticated users can see)
app.get("/plots", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);
    if (error || !user) return c.json({ error: error || 'Unauthorized' }, 401);

    const all = await kv.getByPrefix('plot:');
    const approved = all
      .filter((p: any) => p.status === 'approved')
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({ plots: approved });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Admin: Get all plots (pending + approved + rejected)
app.get("/admin/plots", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);
    if (error || !user) return c.json({ error: error || 'Unauthorized' }, 401);

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile?.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

    const all = await kv.getByPrefix('plot:');
    const sorted = all.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({ plots: sorted });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Admin: Approve or reject a plot
app.put("/admin/plots/:plotId", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);
    if (error || !user) return c.json({ error: error || 'Unauthorized' }, 401);

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile?.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

    const plotId = decodeURIComponent(c.req.param('plotId'));
    const plot = await kv.get(plotId);
    if (!plot) return c.json({ error: 'Plot not found' }, 404);

    const body = await c.req.json();
    const { status, adminNote } = body;

    if (!['approved', 'rejected'].includes(status)) {
      return c.json({ error: 'Status must be approved or rejected' }, 400);
    }

    plot.status = status;
    plot.adminNote = adminNote || '';
    plot.reviewedBy = user.id;
    plot.reviewedAt = new Date().toISOString();

    await kv.set(plotId, plot);

    // Audit log
    await kv.set(`audit:${Date.now()}`, {
      action: `plot_${status}`,
      performedBy: user.id,
      performedByName: userProfile.name || 'Admin',
      details: `Plot "${plot.title}" by ${plot.userName} ${status}`,
      timestamp: new Date().toISOString(),
    });

    return c.json({ message: `Plot ${status}`, plot });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Admin: Delete a plot
app.delete("/admin/plots/:plotId", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);
    if (error || !user) return c.json({ error: error || 'Unauthorized' }, 401);

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile?.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

    const plotId = decodeURIComponent(c.req.param('plotId'));
    await kv.del(plotId);

    return c.json({ message: 'Plot deleted' });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
  }
});

// Get signed URL for plot video
app.get("/plots/video/:plotId", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization') || null);
    if (error || !user) return c.json({ error: error || 'Unauthorized' }, 401);

    const plotId = decodeURIComponent(c.req.param('plotId'));
    const plot = await kv.get(plotId);
    if (!plot || !plot.videoPath) return c.json({ error: 'Video not found' }, 404);

    const supabase = getServiceClient();
    const { data, error: signError } = await supabase.storage
      .from('make-bcce5cc4-kyc-documents')
      .createSignedUrl(plot.videoPath, 3600);

    if (signError) return c.json({ error: 'Failed to generate URL' }, 500);

    return c.json({ url: data.signedUrl });
  } catch (error) {
    return c.json({ error: `Failed: ${error.message}` }, 500);
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