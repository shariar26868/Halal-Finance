import "dotenv/config";
import crypto from "node:crypto";
import { once } from "node:events";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { GridFSBucket, MongoClient, ObjectId } from "mongodb";

const required = ["MONGODB_URI", "JWT_SECRET"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing required backend environment variables: ${missing.join(", ")}`);
}

const port = Number(process.env.PORT || 3001);
const webOrigin = process.env.WEB_ORIGIN || "http://localhost:5173";
const allowedWebOrigins = webOrigin.split(",").map((origin) => origin.trim());
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();

const db = client.db(process.env.MONGODB_DB || "halal_finance");
const users = db.collection("users");
const records = db.collection("records");
const bucket = new GridFSBucket(db, { bucketName: "kyc_documents" });
await Promise.all([
  users.createIndex({ email: 1 }, { unique: true }),
  records.createIndex({ key: 1 }, { unique: true }),
  records.createIndex(
    { "value.expiresAt": 1 },
    { expireAfterSeconds: 0, partialFilterExpression: { "value.expiresAt": { $type: "date" } } },
  ),
]);

const app = express();
const api = express.Router();
app.use(cors({
  origin: allowedWebOrigins,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));
app.use(express.json({ limit: "70mb" }));

const publicUser = (user) => {
  const { passwordHash, passwordChangedAt, ...profile } = user;
  return profile;
};

const getRecord = async (key) => (await records.findOne({ key }))?.value ?? null;
const setRecord = async (key, value) => {
  await records.updateOne({ key }, { $set: { value } }, { upsert: true });
};
const getRecordsByPrefix = async (prefix) => {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (await records.find({ key: { $regex: `^${escaped}` } }).toArray()).map(({ value }) => value);
};
const addAuditLog = async (entry) => {
  await setRecord(`audit:${Date.now()}:${crypto.randomUUID()}`, {
    ...entry,
    timestamp: new Date().toISOString(),
  });
};
const sendError = (res, status, message) => res.status(status).json({ error: message });
const decodeBase64File = (data, maxBytes) => {
  if (typeof data !== "string" || !/^[\da-z+/]*={0,2}$/i.test(data)) {
    throw Object.assign(new Error("Invalid file data"), { status: 400 });
  }
  const buffer = Buffer.from(data, "base64");
  if (!buffer.length || buffer.length > maxBytes) {
    throw Object.assign(new Error(`File must be less than ${Math.round(maxBytes / 1024 / 1024)}MB`), { status: 400 });
  }
  return buffer;
};
const uploadGridFile = async ({ name, data, contentType, userId, kind, maxBytes }) => {
  const buffer = decodeBase64File(data, maxBytes);
  const safeName = String(name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const stream = bucket.openUploadStream(`${Date.now()}_${safeName}`, {
    contentType: contentType || "application/octet-stream",
    metadata: { userId, kind, contentType: contentType || "application/octet-stream" },
  });
  const completed = once(stream, "finish");
  stream.end(buffer);
  await completed;
  return stream.id.toString();
};
const signedFileUrl = (req, fileId, userId, purpose) => {
  const token = jwt.sign(
    { purpose, fileId, userId },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );
  return `${req.protocol}://${req.get("host")}/api/files/${fileId}?token=${token}`;
};

const authenticate = async (req, res, next) => {
  const token = req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return sendError(res, 401, "Missing authorization header");
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return sendError(res, 401, "Unauthorized - invalid token");
  }
  if (typeof payload !== "object" || !payload.sub || !payload.jti) {
    return sendError(res, 401, "Invalid token");
  }
  try {
    const revoked = await records.findOne({ key: `revoked:${payload.jti}` });
    if (revoked) return sendError(res, 401, "Session expired");
    const user = await users.findOne({ id: payload.sub, status: { $ne: "deactivated" } });
    if (!user || (user.passwordChangedAt && payload.iat * 1000 < Date.parse(user.passwordChangedAt))) {
      return sendError(res, 401, "Session expired");
    }
    req.auth = payload;
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") return sendError(res, 403, "Forbidden - admin access required");
  next();
};

const issueToken = (user) => jwt.sign(
  { sub: user.id, jti: crypto.randomUUID() },
  process.env.JWT_SECRET,
  { expiresIn: "8h" },
);

const recordUser = async ({
  email, password, name, phone, role = "user", createdBy,
  shares, monthlyInstallment, totalTarget,
}) => {
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw Object.assign(new Error("Please enter a valid email address"), { status: 400 });
  }
  if (typeof password !== "string" || password.length < 6) {
    throw Object.assign(new Error("Password must be at least 6 characters"), { status: 400 });
  }
  const user = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    name: String(name || "").trim(),
    phone: String(phone || "").trim(),
    role,
    createdAt: new Date().toISOString(),
    kycStatus: "pending",
    ...(shares !== undefined ? { shares: Math.max(0, Number(shares) || 0) } : {}),
    ...(monthlyInstallment !== undefined ? { monthlyInstallment: Math.max(1, Number(monthlyInstallment) || 5000) } : {}),
    ...(totalTarget !== undefined ? { totalTarget: Math.max(0, Number(totalTarget) || 0) } : {}),
    ...(createdBy ? { createdBy } : {}),
    passwordHash: await bcrypt.hash(password, 12),
  };
  try {
    await users.insertOne(user);
  } catch (error) {
    if (error.code === 11000) {
      throw Object.assign(new Error("An account with this email already exists"), { status: 409 });
    }
    throw error;
  }
  return user;
};

const latestApprovedMonth = async (userId) => {
  const approved = (await getRecordsByPrefix(`payment:${userId}:`))
    .filter((payment) => payment.status === "approved" && /^\d{4}-\d{2}$/.test(payment.paidMonth || ""))
    .sort((a, b) => b.paidMonth.localeCompare(a.paidMonth));
  if (approved.length) {
    const [year, month] = approved[0].paidMonth.split("-").map(Number);
    return new Date(year, month, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const createInstallmentPayments = async ({
  userId, paymentDate, paidFrom, transactionId, amount, screenshotPath,
  status, createdBy, createdById, monthlyInstallment = 5000,
}) => {
  const rate = Number(monthlyInstallment) || 5000;
  const fullMonths = Math.floor(amount / rate);
  const extraAmount = amount % rate;
  const startMonth = await latestApprovedMonth(userId);
  const now = Date.now();
  const createdAt = new Date().toISOString();
  const payments = [];
  for (let index = 0; index < fullMonths; index++) {
    const date = new Date(startMonth.getFullYear(), startMonth.getMonth() + index, 1);
    const paidMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const id = `payment:${userId}:${now + index}:${crypto.randomUUID()}`;
    const payment = {
      id, userId, paymentDate, dateOfEntry: createdAt, paidFrom, transactionId,
      paidMonth, paidAmount: rate, status, createdBy, createdAt,
      isPartOfBatch: fullMonths > 1, batchTotal: amount, batchMonths: fullMonths,
      ...(screenshotPath ? { screenshotPath } : {}),
      ...(createdById ? { createdById } : {}),
    };
    await setRecord(id, payment);
    payments.push(payment);
  }
  if (extraAmount > 0) {
    const id = `payment:${userId}:${now + fullMonths}:${crypto.randomUUID()}`;
    const extra = {
      id, userId, paymentDate, dateOfEntry: createdAt, paidFrom, transactionId,
      paidMonth: "extra", paidAmount: extraAmount, status, createdBy, createdAt,
      isExtra: true, ...(screenshotPath ? { screenshotPath } : {}),
      ...(createdById ? { createdById } : {}),
    };
    await setRecord(id, extra);
    payments.push(extra);
  }
  return { payments, fullMonths, extraAmount };
};

const applyLateFees = async (user) => {
  if (!user?.createdAt) return;
  const payments = await getRecordsByPrefix(`payment:${user.id}:`);
  const approvedMonths = new Set(payments
    .filter((payment) => payment.status === "approved" && /^\d{4}-\d{2}$/.test(payment.paidMonth || ""))
    .map((payment) => payment.paidMonth));
  const joinDate = new Date(user.createdAt);
  const now = new Date();
  const month = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1);
  let missed = 0;
  let streakStart = "";
  while (month <= now) {
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    if (approvedMonths.has(monthKey)) {
      missed = 0;
      streakStart = "";
    } else {
      if (!missed) streakStart = monthKey;
      missed++;
      if (missed === 2) {
        const feeKey = `latefee:${user.id}:${streakStart}`;
        if (!(await getRecord(feeKey))) {
          const createdAt = now.toISOString();
          const id = `payment:${user.id}:latefee:${crypto.randomUUID()}`;
          await setRecord(id, {
            id, userId: user.id, paymentDate: createdAt.slice(0, 10), dateOfEntry: createdAt,
            paidFrom: "system", transactionId: `LATEFEE-${streakStart}`,
            paidMonth: `late-fee:${streakStart}`, paidAmount: 500, status: "approved",
            createdBy: "system", createdAt, isLateFee: true, lateFeeFor: streakStart,
          });
          await setRecord(feeKey, { applied: true, chargeId: id, appliedAt: createdAt });
        }
      }
    }
    month.setMonth(month.getMonth() + 1);
  }
};

api.get("/health", (_req, res) => res.json({ status: "ok" }));

api.post("/auth/signup", async (req, res, next) => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password || !name || !phone) {
      return sendError(res, 400, "Missing required fields: email, password, name, phone");
    }
    const user = await recordUser({ email, password, name, phone });
    res.status(201).json({ message: "User created successfully", userId: user.id });
  } catch (error) {
    if (error.status) return sendError(res, error.status, error.message);
    next(error);
  }
});

api.post("/auth/signin", rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 }), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return sendError(res, 400, "Missing email or password");
  const user = await users.findOne({ email: String(email).trim().toLowerCase() });
  if (!user || user.status === "deactivated" || !(await bcrypt.compare(password, user.passwordHash))) {
    return sendError(res, 401, "Email or password is incorrect");
  }
  res.json({ accessToken: issueToken(user), user: publicUser(user) });
});

api.get("/auth/session", authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

api.post("/auth/signout", authenticate, async (req, res) => {
  const expiresAt = new Date((req.auth.exp || 0) * 1000);
  await records.updateOne(
    { key: `revoked:${req.auth.jti}` },
    { $set: { value: { expiresAt } } },
    { upsert: true },
  );
  res.json({ message: "Signed out successfully" });
});

api.post("/auth/change-password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return sendError(res, 400, "Missing required fields: currentPassword, newPassword");
  }
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    return sendError(res, 400, "New password must be at least 6 characters");
  }
  if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) {
    return sendError(res, 400, "Current password is incorrect");
  }
  const changedAt = new Date().toISOString();
  await users.updateOne({ id: req.user.id }, {
    $set: { passwordHash: await bcrypt.hash(newPassword, 12), passwordChangedAt: changedAt },
  });
  res.json({ message: "Password changed successfully" });
});

api.post("/auth/forgot-password", rateLimit({ windowMs: 15 * 60 * 1000, limit: 5 }), async (req, res) => {
  const { email, redirectTo } = req.body;
  if (!email) return sendError(res, 400, "Email is required");
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM;
  if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom) {
    return sendError(res, 503, "Password reset email is not configured. Set SMTP settings on the backend.");
  }
  const user = await users.findOne({ email: String(email).trim().toLowerCase(), status: { $ne: "deactivated" } });
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await setRecord(`password-reset:${tokenHash}`, {
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const resetUrl = new URL("/reset-password", allowedWebOrigins[0]);
    if (typeof redirectTo === "string") {
      try {
        const requested = new URL(redirectTo);
        if (allowedWebOrigins.includes(requested.origin)) resetUrl.href = requested.href;
      } catch {
        // Use the configured frontend origin for malformed or untrusted redirects.
      }
    }
    resetUrl.searchParams.set("token", token);
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: { user: smtpUser, pass: smtpPassword },
    });
    await transport.sendMail({
      from: smtpFrom,
      to: user.email,
      subject: "Reset your Halal Finance password",
      text: `Use this link to reset your password. It expires in one hour: ${resetUrl.href}`,
    });
  }
  res.json({ message: "If an account exists for this email, a password reset link has been sent." });
});

api.post("/auth/reset-password", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || typeof newPassword !== "string") return sendError(res, 400, "Reset token and new password are required");
  if (newPassword.length < 6) return sendError(res, 400, "Password must be at least 6 characters");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const resetRecordKey = `password-reset:${tokenHash}`;
  const reset = await getRecord(resetRecordKey);
  if (!reset || reset.expiresAt.getTime() < Date.now()) return sendError(res, 400, "Invalid or expired reset link");
  const changedAt = new Date().toISOString();
  const result = await users.updateOne({ id: reset.userId }, {
    $set: { passwordHash: await bcrypt.hash(newPassword, 12), passwordChangedAt: changedAt },
  });
  await records.deleteOne({ key: resetRecordKey });
  if (!result.matchedCount) return sendError(res, 400, "Invalid or expired reset link");
  res.json({ message: "Password reset successfully" });
});

api.put("/user/profile", authenticate, async (req, res) => {
  const updates = { ...req.body };
  for (const key of ["id", "email", "role", "passwordHash", "kycDocuments", "kycStatus"]) {
    delete updates[key];
  }
  const profileUpdates = {};
  if (typeof updates.name === "string") profileUpdates.name = updates.name.trim();
  if (typeof updates.phone === "string") profileUpdates.phone = updates.phone.trim();
  if (updates.kycStatus === "submitted") profileUpdates.kycStatus = "submitted";
  const profile = {
    ...publicUser(req.user),
    ...profileUpdates,
    id: req.user.id,
    email: req.user.email,
    role: req.user.role,
    kycStatus: req.user.kycStatus,
    kycDocuments: req.user.kycDocuments || {},
    updatedAt: new Date().toISOString(),
  };
  await users.updateOne({ id: req.user.id }, { $set: profile });
  res.json({ message: "Profile updated", profile });
});

api.get("/user/profile", authenticate, (req, res) => {
  res.json({ profile: publicUser(req.user) });
});

const allowedDocumentTypes = new Set(["nid", "profilePhoto", "signedForm", "nomineeNid", "nomineePhoto"]);
api.post("/user/kyc/upload", authenticate, async (req, res, next) => {
  try {
    const { fileName, fileData, fileType, documentType } = req.body;
    if (!fileName || !fileData || !documentType) {
      return sendError(res, 400, "Missing required fields: fileName, fileData, documentType");
    }
    if (!allowedDocumentTypes.has(documentType)) return sendError(res, 400, "Unsupported document type");
    if (typeof fileData !== "string" || !/^[\da-z+/]*={0,2}$/i.test(fileData)) {
      return sendError(res, 400, "Invalid file data");
    }
    const fileBuffer = Buffer.from(fileData, "base64");
    if (!fileBuffer.length || fileBuffer.length > 10 * 1024 * 1024) {
      return sendError(res, 400, "File must be less than 10MB");
    }
    const isPdf = fileType === "application/pdf" && fileBuffer.subarray(0, 5).toString() === "%PDF-";
    const imageSignatures = {
      "image/jpeg": fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff,
      "image/png": fileBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "image/webp": fileBuffer.subarray(0, 4).toString() === "RIFF" &&
        fileBuffer.subarray(8, 12).toString() === "WEBP",
      "image/gif": ["GIF87a", "GIF89a"].includes(fileBuffer.subarray(0, 6).toString()),
    };
    if ((documentType === "signedForm" && !isPdf) ||
        (documentType !== "signedForm" && !imageSignatures[fileType])) {
      return sendError(res, 400, "File type does not match the selected document");
    }
    const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    const upload = bucket.openUploadStream(`${Date.now()}_${safeName}`, {
      contentType: fileType,
      metadata: { userId: req.user.id, documentType },
    });
    const uploaded = once(upload, "finish");
    upload.end(fileBuffer);
    await uploaded;
    const profile = req.user.kycDocuments || {};
    const previousId = profile[documentType];
    profile[documentType] = upload.id.toString();
    await users.updateOne({ id: req.user.id }, {
      $set: { kycDocuments: profile, kycStatus: "submitted", updatedAt: new Date().toISOString() },
    });
    if (previousId && ObjectId.isValid(previousId)) {
      await bucket.delete(new ObjectId(previousId)).catch((error) => console.error("Previous KYC file cleanup failed:", error));
    }
    res.json({ message: "Document uploaded successfully", filePath: profile[documentType], kycStatus: "submitted" });
  } catch (error) {
    next(error);
  }
});

api.get("/user/kyc/document/:userId/:docType", authenticate, async (req, res) => {
  if (req.user.role !== "admin" && req.params.userId !== req.user.id) {
    return sendError(res, 403, "Forbidden - insufficient permissions");
  }
  const target = await users.findOne({ id: req.params.userId });
  const fileId = target?.kycDocuments?.[req.params.docType];
  if (!fileId || !ObjectId.isValid(fileId)) return sendError(res, 404, "Document not found");
  const downloadToken = jwt.sign(
    { purpose: "kyc-download", fileId, userId: req.params.userId },
    process.env.JWT_SECRET,
    { expiresIn: "5m" },
  );
  const base = `${req.protocol}://${req.get("host")}/api`;
  res.json({ url: `${base}/user/kyc/file/${fileId}?token=${downloadToken}` });
});

api.get("/user/kyc/file/:fileId", async (req, res, next) => {
  try {
    const payload = jwt.verify(req.query.token, process.env.JWT_SECRET);
    if (typeof payload !== "object" || payload.purpose !== "kyc-download" ||
        payload.fileId !== req.params.fileId || !ObjectId.isValid(req.params.fileId)) {
      return sendError(res, 401, "Invalid document link");
    }
    const fileId = new ObjectId(req.params.fileId);
    const [file] = await bucket.find({ _id: fileId }).toArray();
    if (!file || file.metadata?.userId !== payload.userId) return sendError(res, 404, "Document not found");
    res.type(file.metadata?.contentType || "application/octet-stream");
    res.set("Content-Disposition", "inline");
    bucket.openDownloadStream(fileId).on("error", next).pipe(res);
  } catch {
    sendError(res, 401, "Invalid or expired document link");
  }
});

api.get("/files/:fileId", async (req, res, next) => {
  try {
    const payload = jwt.verify(req.query.token, process.env.JWT_SECRET);
    if (typeof payload !== "object" || payload.purpose !== "private-file" ||
        payload.fileId !== req.params.fileId || !ObjectId.isValid(req.params.fileId)) {
      return sendError(res, 401, "Invalid file link");
    }
    const fileId = new ObjectId(req.params.fileId);
    const [file] = await bucket.find({ _id: fileId }).toArray();
    if (!file || file.metadata?.userId !== payload.userId) return sendError(res, 404, "File not found");
    res.type(file.metadata?.contentType || "application/octet-stream");
    res.set("Content-Disposition", "inline");
    bucket.openDownloadStream(fileId).on("error", next).pipe(res);
  } catch {
    sendError(res, 401, "Invalid or expired file link");
  }
});

api.get("/payments/screenshot/:paymentId", authenticate, async (req, res) => {
  const payment = await getRecord(decodeURIComponent(req.params.paymentId));
  if (!payment) return sendError(res, 404, "Payment not found");
  if (req.user.role !== "admin" && payment.userId !== req.user.id) return sendError(res, 403, "Forbidden");
  if (!payment.screenshotPath || !ObjectId.isValid(payment.screenshotPath)) {
    return sendError(res, 404, "No screenshot for this payment");
  }
  const [file] = await bucket.find({ _id: new ObjectId(payment.screenshotPath) }).toArray();
  if (!file || file.metadata?.userId !== payment.userId) return sendError(res, 404, "Screenshot not found");
  res.json({ url: signedFileUrl(req, payment.screenshotPath, payment.userId, "private-file") });
});

api.post("/payments/submit", authenticate, async (req, res) => {
  const { paymentDate, paidFrom, transactionId, paidAmount, paymentScreenshot } = req.body;
  const amount = Number(paidAmount);
  const monthlyInstallment = Number(req.user.monthlyInstallment) || 5000;
  if (!paymentDate || !paidFrom || !transactionId || !Number.isFinite(amount) || amount < monthlyInstallment) {
    return sendError(res, 400, `Payment must be at least ৳${monthlyInstallment}`);
  }
  if (!paymentScreenshot?.fileData || !paymentScreenshot?.fileName) {
    return sendError(res, 400, "Payment screenshot is required");
  }
  const screenshot = decodeBase64File(paymentScreenshot.fileData, 5 * 1024 * 1024);
  const validImage = {
    "image/jpeg": screenshot[0] === 0xff && screenshot[1] === 0xd8 && screenshot[2] === 0xff,
    "image/png": screenshot.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/webp": screenshot.subarray(0, 4).toString() === "RIFF" && screenshot.subarray(8, 12).toString() === "WEBP",
  }[paymentScreenshot.fileType];
  if (!validImage) return sendError(res, 400, "Payment screenshot must be a valid JPEG, PNG, or WebP image");
  const screenshotPath = await uploadGridFile({
    name: paymentScreenshot.fileName, data: paymentScreenshot.fileData,
    contentType: paymentScreenshot.fileType, userId: req.user.id, kind: "payment-screenshot",
    maxBytes: 5 * 1024 * 1024,
  });
  const result = await createInstallmentPayments({
    userId: req.user.id, paymentDate, paidFrom, transactionId, amount, screenshotPath,
    status: "pending", createdBy: "user", monthlyInstallment,
  });
  res.status(201).json({
    message: `Payment submitted for ${result.fullMonths} month(s)${result.extraAmount ? ` + ৳${result.extraAmount} extra` : ""}`,
    payments: result.payments,
  });
});

api.get("/payments/user", authenticate, async (req, res) => {
  await applyLateFees(req.user);
  const payments = (await getRecordsByPrefix(`payment:${req.user.id}:`))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const totalPaid = payments.filter((payment) => payment.status === "approved" && !payment.isLateFee && payment.paidMonth !== "extra")
    .reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0);
  const totalLateFees = payments.filter((payment) => payment.status === "approved" && payment.isLateFee)
    .reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0);
  res.json({ payments, totalPaid, totalLateFees });
});

api.get("/account/statement", authenticate, async (req, res) => {
  await applyLateFees(req.user);
  const payments = await getRecordsByPrefix(`payment:${req.user.id}:`);
  const regular = payments.filter((payment) =>
    !payment.isLateFee && payment.paidMonth !== "extra" && payment.status === "approved");
  const extras = payments.filter((payment) => payment.paidMonth === "extra" && payment.status === "approved");
  const lateFees = payments.filter((payment) => payment.isLateFee && payment.status === "approved");
  const pending = payments.filter((payment) => payment.status === "pending" && !payment.isLateFee);
  const totalPaid = regular.reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0);
  const totalExtra = extras.reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0);
  const totalLateFees = lateFees.reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0);
  const totalTarget = Number(req.user.totalTarget) || 0;
  const ledger = payments
    .filter((payment) => payment.status === "approved" || payment.status === "pending")
    .map((payment) => ({
      id: payment.id,
      date: payment.dateOfEntry || payment.createdAt,
      type: payment.isLateFee ? "late_fee" :
        payment.paidMonth === "extra" ? "extra" :
        payment.status === "pending" ? "pending" : "payment",
      description: payment.isLateFee ? `Late fee — missed 2 months from ${payment.lateFeeFor}` :
        payment.paidMonth === "extra" ? "Extra amount" :
        payment.status === "pending" ? `Payment for ${payment.paidMonth} (pending)` :
        `Payment for ${payment.paidMonth}`,
      amount: payment.paidAmount,
      status: payment.status,
      paidFrom: payment.paidFrom,
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({
    summary: {
      totalPaid, totalExtra, totalLateFees, totalTarget,
      remainingDue: Math.max(0, totalTarget - totalPaid),
      monthlyInstallment: Number(req.user.monthlyInstallment) || 5000,
      monthsPaid: regular.length,
      pendingCount: pending.length,
    },
    ledger,
  });
});

api.get("/admin/payments", authenticate, requireAdmin, async (_req, res) => {
  const payments = (await getRecordsByPrefix("payment:"))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({
    payments,
    stats: {
      totalCollected: payments.filter((p) => p.status === "approved").reduce((sum, p) => sum + Number(p.paidAmount || 0), 0),
      totalPending: payments.filter((p) => p.status === "pending").reduce((sum, p) => sum + Number(p.paidAmount || 0), 0),
      totalPayments: payments.length,
    },
  });
});

api.post("/admin/payments/add", authenticate, requireAdmin, async (req, res) => {
  const { userId, paymentDate, paidFrom, transactionId, paidAmount, paymentScreenshot } = req.body;
  const amount = Number(paidAmount);
  if (!userId || !paymentDate || !paidFrom || !Number.isFinite(amount) || amount < 5000) {
    return sendError(res, 400, "Missing or invalid required fields");
  }
  const targetUser = await users.findOne({ id: userId });
  if (!targetUser) return sendError(res, 404, "User not found");
  if (!paymentScreenshot?.fileData || !paymentScreenshot?.fileName) {
    return sendError(res, 400, "Payment screenshot is required");
  }
  const screenshotPath = await uploadGridFile({
    name: paymentScreenshot.fileName, data: paymentScreenshot.fileData,
    contentType: paymentScreenshot.fileType, userId, kind: "payment-screenshot",
    maxBytes: 5 * 1024 * 1024,
  });
  const result = await createInstallmentPayments({
    userId, paymentDate, paidFrom, transactionId: transactionId || "N/A", amount,
    screenshotPath, status: "approved", createdBy: "admin", createdById: req.user.id,
    monthlyInstallment: targetUser.monthlyInstallment || 5000,
  });
  res.status(201).json({
    message: `Payment added for ${result.fullMonths} month(s)${result.extraAmount ? ` + ৳${result.extraAmount} extra` : ""}`,
    payments: result.payments,
  });
});

api.post("/admin/payments/:paymentId/approve", authenticate, requireAdmin, async (req, res) => {
  const payment = await getRecord(req.params.paymentId);
  if (!payment) return sendError(res, 404, "Payment not found");
  payment.status = "approved";
  payment.approvedBy = req.user.id;
  payment.approvedAt = new Date().toISOString();
  await setRecord(payment.id, payment);
  await addAuditLog({
    action: "payment_approved", performedBy: req.user.id, performedByName: req.user.name || "Admin",
    targetUserId: payment.userId, details: `Approved payment of ৳${payment.paidAmount} (ID: ${payment.id.slice(-8)})`,
  });
  res.json({ message: "Payment approved", payment });
});

api.post("/admin/payments/:paymentId/reject", authenticate, requireAdmin, async (req, res) => {
  const payment = await getRecord(req.params.paymentId);
  if (!payment) return sendError(res, 404, "Payment not found");
  const reason = req.body.reason || "No reason provided";
  payment.status = "rejected";
  payment.rejectedBy = req.user.id;
  payment.rejectedAt = new Date().toISOString();
  payment.rejectionReason = reason;
  await setRecord(payment.id, payment);
  await addAuditLog({
    action: "payment_rejected", performedBy: req.user.id, performedByName: req.user.name || "Admin",
    targetUserId: payment.userId, details: `Rejected payment of ৳${payment.paidAmount} - Reason: ${reason}`,
  });
  res.json({ message: "Payment rejected", payment });
});

api.get("/admin/users", authenticate, requireAdmin, async (_req, res) => {
  const allUsers = await users.find({}).project({ passwordHash: 0, passwordChangedAt: 0, _id: 0 }).toArray();
  res.json({ users: allUsers.map((user) => ({
    ...user, name: user.name || user.email?.split("@")[0] || "Unknown User",
    email: user.email || "No email", phone: user.phone || "N/A",
  })) });
});

api.get("/admin/users/:userId", authenticate, requireAdmin, async (req, res) => {
  const target = await users.findOne({ id: req.params.userId });
  if (!target) return sendError(res, 404, "User not found");
  const payments = await getRecordsByPrefix(`payment:${target.id}:`);
  res.json({
    user: publicUser(target),
    paymentSummary: {
      totalPaid: payments.filter((p) => p.status === "approved").reduce((sum, p) => sum + Number(p.paidAmount || 0), 0),
      totalPayments: payments.length,
      pendingPayments: payments.filter((p) => p.status === "pending").length,
    },
  });
});

api.get("/admin/users/:userId/analytics", authenticate, requireAdmin, async (req, res) => {
  const target = await users.findOne({ id: req.params.userId });
  if (!target) return sendError(res, 404, "User not found");
  const payments = await getRecordsByPrefix(`payment:${target.id}:`);
  const approved = payments.filter((payment) => payment.status === "approved" && payment.paidMonth !== "extra" && !payment.isLateFee);
  const pending = payments.filter((payment) => payment.status === "pending");
  const rejected = payments.filter((payment) => payment.status === "rejected");
  const extras = payments.filter((payment) => payment.paidMonth === "extra" && payment.status === "approved");
  const totalPaid = approved.reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0);
  const totalPending = pending.reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0);
  const monthlyInstallment = Number(target.monthlyInstallment) || 5000;
  const totalTarget = Number(target.totalTarget) || 0;
  const sortedApproved = approved
    .filter((payment) => /^\d{4}-\d{2}$/.test(payment.paidMonth || ""))
    .sort((a, b) => b.paidMonth.localeCompare(a.paidMonth));
  let dueMonths;
  let dueAmount;
  if (totalTarget > 0) {
    dueAmount = Math.max(0, totalTarget - totalPaid);
    dueMonths = dueAmount > 0 ? Math.ceil(dueAmount / monthlyInstallment) : 0;
  } else {
    const joined = new Date(target.createdAt);
    const now = new Date();
    const monthsSinceJoining = Math.max(0,
      (now.getFullYear() - joined.getFullYear()) * 12 + now.getMonth() - joined.getMonth());
    dueMonths = Math.max(0, monthsSinceJoining - sortedApproved.length);
    dueAmount = dueMonths * monthlyInstallment;
  }
  res.json({
    user: {
      ...publicUser(target),
      shares: Number(target.shares) || 0,
      monthlyInstallment,
      totalTarget,
    },
    analytics: {
      totalPaid, totalPending,
      extraBalance: extras.reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0),
      monthsPaid: sortedApproved.length, dueMonths, dueAmount,
      monthlyInstallment, totalTarget, remainingTarget: dueAmount,
      lastPaidMonth: sortedApproved[0]?.paidMonth || null,
      totalPayments: payments.length, approvedCount: approved.length,
      pendingCount: pending.length, rejectedCount: rejected.length,
      contributionHistory: [...approved]
        .sort((a, b) => a.paidMonth.localeCompare(b.paidMonth))
        .map((payment) => ({
          month: payment.paidMonth, amount: payment.paidAmount,
          paidFrom: payment.paidFrom, date: payment.paymentDate,
        })),
    },
  });
});

api.patch("/admin/users/:userId/shares", authenticate, requireAdmin, async (req, res) => {
  const target = await users.findOne({ id: req.params.userId });
  if (!target) return sendError(res, 404, "User not found");
  const shares = Math.max(0, Number.parseInt(req.body.shares, 10) || 0);
  const monthlyInstallment = Math.max(1, Number(req.body.monthlyInstallment) || 5000);
  const totalTarget = Math.max(0, Number(req.body.totalTarget) || 0);
  await users.updateOne({ id: target.id }, {
    $set: { shares, monthlyInstallment, totalTarget, updatedAt: new Date().toISOString() },
  });
  res.json({ message: "Updated", shares, monthlyInstallment, totalTarget });
});

api.put("/admin/users/:userId", authenticate, requireAdmin, async (req, res) => {
  const target = await users.findOne({ id: req.params.userId });
  if (!target) return sendError(res, 404, "User not found");
  const { kycStatus, rejectionReason } = req.body;
  if (!["pending", "submitted", "approved", "rejected"].includes(kycStatus)) {
    return sendError(res, 400, "Missing or invalid required field: kycStatus");
  }
  const updatedAt = new Date().toISOString();
  const patch = { kycStatus, updatedAt, updatedBy: req.user.id };
  if (rejectionReason) patch.rejectionReason = rejectionReason;
  await users.updateOne({ id: target.id }, { $set: patch });
  const updatedUser = { ...target, ...patch };
  await addAuditLog({
    action: `kyc_${kycStatus}`, performedBy: req.user.id, performedByName: req.user.name || "Admin",
    targetUserId: target.id, targetUserName: target.name || target.email,
    details: `KYC ${kycStatus} for user ${target.name || target.email}${rejectionReason ? ` - Reason: ${rejectionReason}` : ""}`,
  });
  res.json({ message: `KYC status updated to ${kycStatus}`, user: publicUser(updatedUser) });
});

api.post("/admin/users/create", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { email, password, name, phone, role = "user", shares, monthlyInstallment, totalTarget } = req.body;
    if (!email || !password || !name || !phone) {
      return sendError(res, 400, "Missing required fields: email, password, name, phone");
    }
    if (!["user", "admin"].includes(role)) return sendError(res, 400, "Invalid role");
    const user = await recordUser({
      email, password, name, phone, role, createdBy: req.user.id,
      shares, monthlyInstallment, totalTarget,
    });
    res.status(201).json({ message: "User created successfully", userId: user.id });
  } catch (error) {
    if (error.status) return sendError(res, error.status, error.message);
    next(error);
  }
});

api.delete("/admin/users/:userId", authenticate, requireAdmin, async (req, res) => {
  if (req.user.id === req.params.userId) return sendError(res, 400, "You cannot deactivate your own account");
  const result = await users.updateOne({ id: req.params.userId, role: { $ne: "admin" } }, {
    $set: { status: "deactivated", deactivatedBy: req.user.id, deactivatedAt: new Date().toISOString() },
  });
  if (!result.matchedCount) return sendError(res, 404, "User not found or cannot be deactivated");
  res.json({ message: "User deactivated successfully" });
});

api.post("/admin/announcements", authenticate, requireAdmin, async (req, res) => {
  const { title, message, priority = "normal" } = req.body;
  if (!title || !message) return sendError(res, 400, "Missing required fields: title, message");
  const id = `announcement:${Date.now()}:${crypto.randomUUID()}`;
  const announcement = {
    id, title, message, priority, createdBy: req.user.id, createdByName: req.user.name || "Admin",
    createdAt: new Date().toISOString(), active: true,
  };
  await setRecord(id, announcement);
  await addAuditLog({
    action: "announcement_created", performedBy: req.user.id, performedByName: req.user.name || "Admin",
    details: `Created announcement: "${title}"`,
  });
  res.status(201).json({ message: "Announcement created", announcement });
});

api.get("/announcements", authenticate, async (_req, res) => {
  const announcements = (await getRecordsByPrefix("announcement:"))
    .filter((entry) => entry.active !== false)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ announcements });
});

api.delete("/admin/announcements/:id", authenticate, requireAdmin, async (req, res) => {
  const announcement = await getRecord(req.params.id);
  if (!announcement) return sendError(res, 404, "Not found");
  announcement.active = false;
  await setRecord(announcement.id, announcement);
  res.json({ message: "Announcement removed" });
});

api.get("/admin/audit-logs", authenticate, requireAdmin, async (_req, res) => {
  const logs = (await getRecordsByPrefix("audit:"))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json({ logs: logs.slice(0, 100) });
});

api.post("/plots/submit", authenticate, async (req, res) => {
  const { title, description, location, area, price, contactNumber, link,
    videoData, videoFileName, videoFileType } = req.body;
  if (!title || !description || !location) {
    return sendError(res, 400, "Missing required fields: title, description, location");
  }
  let videoPath;
  if (videoData) {
    if (!videoFileName || !String(videoFileType).startsWith("video/")) {
      return sendError(res, 400, "Invalid plot video");
    }
    videoPath = await uploadGridFile({
      name: videoFileName, data: videoData, contentType: videoFileType,
      userId: req.user.id, kind: "plot-video", maxBytes: 50 * 1024 * 1024,
    });
  }
  const id = `plot:${Date.now()}:${req.user.id}:${crypto.randomUUID()}`;
  const plot = {
    id, userId: req.user.id, userName: req.user.name || "Unknown",
    userEmail: req.user.email, title: String(title).trim(),
    description: String(description).trim(), location: String(location).trim(),
    area: area || "", price: price || "", contactNumber: contactNumber || "",
    link: link || "", videoPath: videoPath || null,
    status: "pending", createdAt: new Date().toISOString(),
  };
  await setRecord(id, plot);
  res.status(201).json({ message: "Plot information submitted for review", plot });
});

api.get("/plots", authenticate, async (_req, res) => {
  const plots = (await getRecordsByPrefix("plot:"))
    .filter((plot) => plot.status === "approved")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ plots });
});

api.get("/admin/plots", authenticate, requireAdmin, async (_req, res) => {
  const plots = (await getRecordsByPrefix("plot:"))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ plots });
});

api.put("/admin/plots/:plotId", authenticate, requireAdmin, async (req, res) => {
  const plot = await getRecord(req.params.plotId);
  if (!plot) return sendError(res, 404, "Plot not found");
  const { status, adminNote } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    return sendError(res, 400, "Status must be approved or rejected");
  }
  plot.status = status;
  plot.adminNote = adminNote || "";
  plot.reviewedBy = req.user.id;
  plot.reviewedAt = new Date().toISOString();
  await setRecord(plot.id, plot);
  await addAuditLog({
    action: `plot_${status}`, performedBy: req.user.id,
    performedByName: req.user.name || "Admin",
    details: `Plot "${plot.title}" by ${plot.userName} ${status}`,
  });
  res.json({ message: `Plot ${status}`, plot });
});

api.delete("/admin/plots/:plotId", authenticate, requireAdmin, async (req, res) => {
  const plot = await getRecord(req.params.plotId);
  if (!plot) return sendError(res, 404, "Plot not found");
  await records.deleteOne({ key: plot.id });
  if (plot.videoPath && ObjectId.isValid(plot.videoPath)) {
    await bucket.delete(new ObjectId(plot.videoPath)).catch((error) => {
      console.error("Plot video cleanup failed:", error);
    });
  }
  res.json({ message: "Plot deleted" });
});

api.get("/plots/video/:plotId", authenticate, async (req, res) => {
  const plot = await getRecord(req.params.plotId);
  if (!plot || !plot.videoPath || !ObjectId.isValid(plot.videoPath)) {
    return sendError(res, 404, "Video not found");
  }
  if (req.user.role !== "admin" && plot.status !== "approved" && plot.userId !== req.user.id) {
    return sendError(res, 403, "Forbidden");
  }
  const [file] = await bucket.find({ _id: new ObjectId(plot.videoPath) }).toArray();
  if (!file || file.metadata?.userId !== plot.userId) return sendError(res, 404, "Video not found");
  res.json({ url: signedFileUrl(req, plot.videoPath, plot.userId, "private-file") });
});

app.use("/api", api);
app.use((error, _req, res, _next) => {
  console.error("Backend request failed:", error);
  if (res.headersSent) return;
  res.status(error.status || 500).json({ error: error.status ? error.message : "Request failed" });
});

if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 6) {
  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const existing = await users.findOne({ email });
  if (!existing) {
    await recordUser({
      email, password: process.env.ADMIN_PASSWORD,
      name: "Administrator", phone: "N/A", role: "admin",
    });
    console.info(`Initial admin account created for ${email}`);
  }
} else if (process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD) {
  console.error("Initial admin was not created: set both ADMIN_EMAIL and an ADMIN_PASSWORD of at least 6 characters.");
}

const server = app.listen(port, () => console.info(`MongoDB API listening on port ${port}`));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(async () => {
    await client.close();
    process.exit(0);
  }));
}
