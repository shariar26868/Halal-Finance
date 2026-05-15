import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  Wallet,
  Upload,
  DollarSign,
  Users,
  TrendingUp,
  LogOut,
  User,
  Shield,
  KeyRound,
  Megaphone,
  ClipboardList,
  Sun,
  Moon,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { useState } from 'react';
import { apiCall } from '../../utils/supabase';
import { toast } from 'sonner';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  const userMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'kyc', label: 'KYC Upload', icon: Upload },
    { id: 'plot-info', label: 'Plot Information', icon: MapPin },
  ];

  const adminMenuItems = [
    { id: 'admin-dashboard', label: 'Overview', icon: TrendingUp },
    { id: 'admin-kyc', label: 'KYC Review', icon: Upload },
    { id: 'admin-payments', label: 'Payments', icon: DollarSign },
    { id: 'admin-users', label: 'Users', icon: Users },
    { id: 'admin-announcements', label: 'Announcements', icon: Megaphone },
    { id: 'admin-plots', label: 'Plot Information', icon: MapPin },
    { id: 'admin-audit', label: 'Audit Log', icon: ClipboardList },
  ];

  const menuItems = user?.role === 'admin' ? adminMenuItems : userMenuItems;

  const handleLogout = async () => {
    await logout();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      await apiCall('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });
      toast.success('Password changed successfully');
      setShowChangePassword(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="w-64 h-screen bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border sticky top-0">

      {/* ── Logo / Brand ── */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-[#0d6e4f] flex items-center justify-center shadow-md flex-shrink-0">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight tracking-tight text-white" style={{ fontFamily: 'var(--font-heading)' }}>
              Halal Finance
            </p>
            <p className="text-[11px] text-white/50 tracking-wide uppercase">
              {isAdmin ? 'Admin Panel' : 'Member Portal'}
            </p>
          </div>
        </motion.div>
      </div>

      {/* ── User Card ── */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/10 border border-white/15">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
            isAdmin
              ? 'bg-amber-400/25 border border-amber-400/50'
              : 'bg-white/20 border border-white/30'
          }`}>
            {isAdmin
              ? <Shield className="w-4 h-4 text-amber-300" />
              : <User className="w-4 h-4 text-white" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-white truncate leading-tight">
              {user?.name || 'Loading...'}
            </p>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${
              isAdmin
                ? 'bg-amber-400/25 text-amber-200'
                : 'bg-white/20 text-white/80'
            }`}>
              {isAdmin ? '● Admin' : '● Member'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-3 pb-2">
          {isAdmin ? 'Management' : 'Navigation'}
        </p>

        {menuItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group
                ${isActive
                  ? 'bg-white/20 text-white font-semibold shadow-sm'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
                }
              `}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 transition-transform duration-150 ${isActive ? '' : 'group-hover:scale-110'}`} />
              <span className="text-sm flex-1">{item.label}</span>
              {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
            </motion.button>
          );
        })}
      </nav>

      {/* ── Footer Actions ── */}
      <div className="px-3 py-4 border-t border-white/15 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-3 pb-2">
          Settings
        </p>

        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all duration-150 group"
        >
          {theme === 'dark'
            ? <Sun className="w-4 h-4 flex-shrink-0 group-hover:scale-110 transition-transform" />
            : <Moon className="w-4 h-4 flex-shrink-0 group-hover:scale-110 transition-transform" />
          }
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>

        <button
          onClick={() => setShowChangePassword(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all duration-150 group"
        >
          <KeyRound className="w-4 h-4 flex-shrink-0 group-hover:scale-110 transition-transform" />
          Change Password
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-300 hover:bg-red-500/15 hover:text-red-200 transition-all duration-150 group"
        >
          <LogOut className="w-4 h-4 flex-shrink-0 group-hover:scale-110 transition-transform" />
          Sign Out
        </button>

        <p className="text-center text-white/30 text-[11px] pt-3 pb-1">
          © Built by <span className="text-white/55 font-semibold">Shaikat</span>
        </p>
      </div>

      {/* ── Change Password Dialog ── */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                placeholder="Enter current password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password (min 6 characters)"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm new password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowChangePassword(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? 'Changing...' : 'Change Password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
