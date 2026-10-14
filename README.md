# 🕌 Halal Finance Software

A full-stack Islamic finance management platform built for tracking payments, managing KYC verification, and administering users — all in one clean, role-based dashboard.

---

## ✨ Features

### 👤 User Features
- **Secure Authentication** — Sign up, log in, and reset password via email
- **KYC Document Upload** — Upload NID, profile photo, signed form, nominee NID & photo
- **KYC Status Tracking** — See real-time status: pending → submitted → approved/rejected
- **Payment Submission** — Submit payments via bKash, Nagad, Rocket, Bank, or Cash
- **Payment History** — View all past payments with status (pending / approved / rejected)
- **Announcements** — See notices posted by admin directly on the dashboard
- **Dark Mode** — Toggle between light and dark theme
- **Change Password** — Update password from the sidebar

### 🛡️ Admin Features
- **Finance Overview** — Charts showing monthly collection trends and payment volume
- **KYC Review** — View, approve, or reject user KYC documents with reason
- **Payment Management** — Approve/reject user payments, add payments directly
- **CSV Export** — Export payment data to CSV filtered by status
- **User Management** — Create, view, and deactivate user accounts
- **Announcement Board** — Post notices (Normal / Important / Urgent) visible to all users
- **Audit Log** — Full history of all admin actions with timestamps
- **Forgot Password** — Email-based password reset for both users and admins

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS v4, shadcn/ui, Radix UI |
| Animations | Motion (Framer Motion) |
| Charts | Recharts |
| Backend | Node.js, Express |
| Database | MongoDB Atlas |
| Storage | MongoDB GridFS (KYC documents) |
| Auth | Express API, bcrypt password hashing, JWT |
| Icons | Lucide React |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- pnpm (recommended) or npm
- MongoDB Atlas cluster

### 1. Install dependencies and configure secrets

```bash
npm install
```

Copy `backend/.env.example` to `backend/.env` (or use the existing local file) and set its values. `backend/.env` is ignored by Git.

Set the backend-only `MONGODB_URI` and a strong random `JWT_SECRET`; neither should use a `VITE_` prefix or be placed in frontend code. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` to create the first administrator on startup. Password-reset emails additionally require `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`.

Set `MONGODB_DB=halal_finance` to choose the database name. In MongoDB Atlas, allow network access only from the backend host.

### 2. Run the application

```bash
npm run dev
```

This starts the API on port `3001` and Vite on port `5173`. The frontend defaults to `http://localhost:3001/api`; set `VITE_API_BASE_URL` at build time when deploying the frontend elsewhere.

Existing Supabase users, payments, announcements, and KYC files are not copied automatically. Export/import those records before switching production traffic if existing data must be retained. The application itself no longer includes Supabase client or Edge Function code.

---

## 📁 Project Structure

```
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui base components
│   │   │   ├── AdminDashboard.tsx   # Finance overview with charts
│   │   │   ├── AdminKYC.tsx         # KYC review & approval
│   │   │   ├── AdminPayments.tsx    # Payment management + CSV export
│   │   │   ├── AdminUsers.tsx       # User management
│   │   │   ├── AdminAnnouncements.tsx # Notice board
│   │   │   ├── AdminAuditLog.tsx    # Admin action history
│   │   │   ├── UserDashboard.tsx    # User payment dashboard
│   │   │   ├── KYCUpload.tsx        # Document upload flow
│   │   │   ├── KYCDocuments.tsx     # View/replace approved docs
│   │   │   ├── LoginPage.tsx        # Login, signup, forgot password
│   │   │   ├── ResetPassword.tsx    # Password reset page
│   │   │   └── Sidebar.tsx          # Navigation + dark mode toggle
│   │   ├── context/
│   │   │   ├── AuthContext.tsx      # Authentication state
│   │   │   └── ThemeContext.tsx     # Dark/light mode state
│   │   └── App.tsx                  # Root routing
│   ├── styles/                      # Global CSS & theme variables
│   └── utils/
│       └── api.ts                   # Express API call helper
├── backend/
│   ├── index.js                     # Express API and MongoDB access
│   └── .env                         # Local secrets (ignored by Git)
└── public/                          # Static assets
```

---

## 🔐 Roles

| Role | Access |
|---|---|
| `user` | Dashboard, KYC upload, payment submission |
| `admin` | All user features + full admin panel |

The first admin account is created on backend startup when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set in `backend/.env`. Public signup always creates a regular user.

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/signup` | Register new user |
| POST | `/auth/signin` | Login |
| GET | `/auth/session` | Get current session |
| POST | `/auth/change-password` | Change password |
| POST | `/auth/forgot-password` | Send reset email |
| POST | `/auth/reset-password` | Reset password with a one-time email token |
| GET | `/user/profile` | Get user profile |
| PUT | `/user/profile` | Update profile / KYC status |
| POST | `/user/kyc/upload` | Upload KYC document |
| GET | `/user/kyc/document/:userId/:docType` | Get signed document URL |
| POST | `/payments/submit` | Submit payment request |
| GET | `/payments/user` | Get user's payments |
| GET | `/admin/payments` | Get all payments |
| POST | `/admin/payments/:id/approve` | Approve payment |
| POST | `/admin/payments/:id/reject` | Reject payment |
| POST | `/admin/payments/add` | Add payment directly |
| GET | `/admin/users` | List all users |
| POST | `/admin/users/create` | Create user |
| PUT | `/admin/users/:id` | Update KYC status |
| DELETE | `/admin/users/:id` | Deactivate user |
| GET | `/announcements` | Get active announcements |
| POST | `/admin/announcements` | Create announcement |
| DELETE | `/admin/announcements/:id` | Remove announcement |
| GET | `/admin/audit-logs` | Get audit log |

All API routes use the `/api` prefix. Authenticated requests use a bearer token.

---

## 🎨 Theme

The app uses a custom Islamic green and gold color palette:

| Variable | Color | Usage |
|---|---|---|
| `--primary` | `#0d6e4f` | Buttons, accents, highlights |
| `--accent` | `#d4af37` | Gold accents, sidebar icons |
| `--background` | `#fafbf8` | Page background |
| `--sidebar` | `#0d6e4f` | Sidebar background |

---

## 📄 License

This project is private and proprietary. All rights reserved.

---

> Built with ❤️ for Halal Finance
