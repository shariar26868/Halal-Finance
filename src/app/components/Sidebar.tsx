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

  return (
    <div className="w-64 h-screen bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border sticky top-0">
      <div className="p-6 border-b border-sidebar-border">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
            <Wallet className="w-6 h-6 text-accent-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-sm" style={{ fontFamily: 'var(--font-heading)' }}>
              Halal Finance
            </h2>
            <p className="text-xs text-sidebar-foreground/70">Software</p>
          </div>
        </motion.div>
      </div>

      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/10 border border-white/15">
          <div className="w-10 h-10 rounded-full bg-accent/30 border border-accent/50 flex items-center justify-center flex-shrink-0">
            {user?.role === 'admin' ? (
              <Shield className="w-5 h-5 text-accent" />
            ) : (
              <User className="w-5 h-5 text-accent" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-sidebar-foreground break-words leading-tight">
              {user?.name || 'Loading...'}
            </p>
            <p className="text-xs text-sidebar-foreground/60 capitalize mt-0.5">
              {user?.role || ''}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <motion.button
              key={item.id}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate(item.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all
                ${
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                }
              `}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </motion.button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => setShowChangePassword(true)}
        >
          <KeyRound className="w-5 h-5" />
          Change Password
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </Button>
      </div>

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
