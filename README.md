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
| Backend | Supabase Edge Functions (Deno + Hono) |
| Database | Supabase (PostgreSQL + KV Store) |
| Storage | Supabase Storage (KYC documents) |
| Auth | Supabase Auth (JWT) |
| Icons | Lucide React |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm
- Supabase account & project

### 1. Clone the repository

```bash
git clone https://github.com/your-username/halal-finance-software.git
cd halal-finance-software
```

### 2. Install dependencies

```bash
pnpm install
# or
npm install
```

### 3. Configure Supabase

Update `utils/supabase/info.tsx` with your Supabase project credentials:

```ts
export const projectId = 'your-project-id';
export const publicAnonKey = 'your-anon-key';
```

### 4. Set up the database

Create the KV store table in your Supabase SQL editor:

```sql
CREATE TABLE kv_store_bcce5cc4 (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL
);
```

### 5. Deploy the Edge Function

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase functions deploy make-server-bcce5cc4
```

### 6. Run the development server

```bash
pnpm dev
# or
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

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
│       └── supabase.ts              # API call helper
├── supabase/
│   └── functions/
│       └── make-server-bcce5cc4/
│           ├── index.ts             # All backend API endpoints
│           └── kv_store.ts          # Key-value database helper
└── public/                          # Static assets
```

---

## 🔐 Roles

| Role | Access |
|---|---|
| `user` | Dashboard, KYC upload, payment submission |
| `admin` | All user features + full admin panel |

The first admin account must be created manually or by setting `role: 'admin'` during signup.

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/signup` | Register new user |
| POST | `/auth/signin` | Login |
| GET | `/auth/session` | Get current session |
| POST | `/auth/change-password` | Change password |
| POST | `/auth/forgot-password` | Send reset email |
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
