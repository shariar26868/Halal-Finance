import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from './components/ui/sonner';
import LoginPage from './components/LoginPage';
import UserDashboard from './components/UserDashboard';
import KYCUpload from './components/KYCUpload';
import KYCDocuments from './components/KYCDocuments';
import AdminDashboard from './components/AdminDashboard';
import AdminPayments from './components/AdminPayments';
import AdminUsers from './components/AdminUsers';
import AdminKYC from './components/AdminKYC';
import AdminAnnouncements from './components/AdminAnnouncements';
import AdminAuditLog from './components/AdminAuditLog';
import ResetPassword from './components/ResetPassword';
import Sidebar from './components/Sidebar';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  // Handle password reset route - check URL path and hash for Supabase tokens
  const isResetPasswordRoute =
    window.location.pathname === '/reset-password' ||
    window.location.hash.includes('type=recovery');

  if (isResetPasswordRoute) {
    return <ResetPassword />;
  }

  if (loading) {
    return (
      <div className="size-full flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    if (user.role === 'admin') {
      switch (currentPage) {
        case 'admin-dashboard':
          return <AdminDashboard />;
        case 'admin-kyc':
          return <AdminKYC />;
        case 'admin-payments':
          return <AdminPayments />;
        case 'admin-users':
          return <AdminUsers />;
        case 'admin-announcements':
          return <AdminAnnouncements />;
        case 'admin-audit':
          return <AdminAuditLog />;
        default:
          return <AdminDashboard />;
      }
    } else {
      switch (currentPage) {
        case 'dashboard':
          return <UserDashboard />;
        case 'kyc':
          // Show KYCDocuments if approved, otherwise show KYCUpload
          return user.kycStatus === 'approved' ? <KYCDocuments /> : <KYCUpload />;
        default:
          return <UserDashboard />;
      }
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 overflow-y-auto">{renderPage()}</main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
        <Toaster position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  );
}