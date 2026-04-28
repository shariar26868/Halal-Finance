import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/supabase';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { motion } from 'motion/react';
import {
  Users, Plus, Search, UserX, Mail, Phone, Calendar,
  Shield, User, Clock, BarChart2, TrendingUp, Wallet,
  AlertTriangle, CheckCircle2, Edit2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'user' | 'admin';
  kycStatus?: string;
  createdAt: string;
  status?: string;
  shares?: number;
  monthlyInstallment?: number;
}

interface UserAnalytics {
  user: UserProfile & { monthlyInstallment: number; totalTarget?: number };
  analytics: {
    totalPaid: number;
    totalPending: number;
    extraBalance: number;
    monthsPaid: number;
    dueMonths: number;
    dueAmount: number;
    monthlyInstallment: number;
    totalTarget: number;
    remainingTarget: number;
    lastPaidMonth: string | null;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
    contributionHistory: { month: string; amount: number; paidFrom: string; date: string }[];
  };
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [analyticsUser, setAnalyticsUser] = useState<UserAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [editSharesUser, setEditSharesUser] = useState<UserProfile | null>(null);
  const [newSharesValue, setNewSharesValue] = useState('');
  const [newInstallmentValue, setNewInstallmentValue] = useState('');
  const [newTotalTargetValue, setNewTotalTargetValue] = useState('');

  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'user',
    shares: '0',
    monthlyInstallment: '5000',
    totalTarget: '',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await apiCall('/admin/users');
      setUsers(data.users || []);
    } catch (error: any) {
      toast.error('Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiCall('/admin/users/create', {
        method: 'POST',
        body: JSON.stringify(newUser),
      });
      toast.success('User created successfully');
      setCreateDialogOpen(false);
      setNewUser({ email: '', password: '', name: '', phone: '', role: 'user', shares: '0', monthlyInstallment: '5000', totalTarget: '' });
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create user');
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    try {
      await apiCall(`/admin/users/${userId}`, { method: 'DELETE' });
      toast.success('User deactivated');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to deactivate user');
    }
  };

  const handleViewAnalytics = async (user: UserProfile) => {
    setAnalyticsLoading(true);
    try {
      const data = await apiCall(`/admin/users/${user.id}/analytics`);
      setAnalyticsUser(data);
    } catch (error: any) {
      toast.error('Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleUpdateShares = async () => {
    if (!editSharesUser) return;
    try {
      await apiCall(`/admin/users/${editSharesUser.id}/shares`, {
        method: 'PATCH',
        body: JSON.stringify({ shares: newSharesValue, monthlyInstallment: newInstallmentValue, totalTarget: newTotalTargetValue }),
      });
      toast.success('Updated successfully');
      setEditSharesUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error('Failed to update');
    }
  };

  const filteredUsers = users
    .filter(user => user && user.id)
    .filter(user =>
      (user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (user.email?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (user.phone?.includes(searchQuery) || false)
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
            User Management
          </h1>
          <p className="text-muted-foreground">Manage user accounts, shares, and analytics</p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid md:grid-cols-4 gap-6"
        >
          <Card className="p-6">
            <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4"><Users className="w-6 h-6 text-primary" /></div>
            <p className="text-3xl font-bold">{users.filter(u => u.status !== 'deactivated').length}</p>
            <p className="text-sm text-muted-foreground mt-1">Active Users</p>
          </Card>
          <Card className="p-6">
            <div className="p-3 bg-yellow-100 rounded-lg w-fit mb-4"><Clock className="w-6 h-6 text-yellow-600" /></div>
            <p className="text-3xl font-bold">{users.filter(u => u.kycStatus === 'pending' || u.kycStatus === 'submitted').length}</p>
            <p className="text-sm text-muted-foreground mt-1">Pending KYC</p>
          </Card>
          <Card className="p-6">
            <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4"><Shield className="w-6 h-6 text-primary" /></div>
            <p className="text-3xl font-bold">{users.filter(u => u.role === 'admin').length}</p>
            <p className="text-sm text-muted-foreground mt-1">Administrators</p>
          </Card>
          <Card className="p-6">
            <div className="p-3 bg-accent/20 rounded-lg w-fit mb-4"><TrendingUp className="w-6 h-6 text-accent-foreground" /></div>
            <p className="text-3xl font-bold">{users.reduce((s, u) => s + (u.shares || 0), 0)}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Shares</p>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="w-4 h-4" />Add User</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>Add a new member to the system</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input placeholder="Enter full name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" placeholder="user@example.com" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input placeholder="017XX-XXXXXX" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input type="password" placeholder="Create a password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <select className="w-full border rounded-md px-3 py-2 bg-background" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Number of Shares</Label>
                        <Input type="number" min="0" placeholder="0" value={newUser.shares} onChange={(e) => setNewUser({ ...newUser, shares: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Monthly Installment (৳)</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="5000"
                        value={newUser.monthlyInstallment}
                        onChange={(e) => setNewUser({ ...newUser, monthlyInstallment: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">How much this user must pay per month</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Total Target Amount (৳)</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="e.g. 60000"
                        value={newUser.totalTarget}
                        onChange={(e) => setNewUser({ ...newUser, totalTarget: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Total amount this user must contribute
                        {newUser.monthlyInstallment && newUser.totalTarget
                          ? ` (≈ ${Math.ceil(parseFloat(newUser.totalTarget) / parseFloat(newUser.monthlyInstallment))} months)`
                          : ''}
                      </p>
                    </div>
                    <Button type="submit" className="w-full">Create User</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No users found</p>
                </div>
              ) : (
                filteredUsers.map((user, index) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`p-4 border rounded-lg transition-colors ${user.status === 'deactivated' ? 'opacity-50 bg-muted/30' : 'hover:border-primary/50'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-primary/10 rounded-full">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{user.name || 'Unknown User'}</h3>
                            <p className="text-sm text-muted-foreground">ID: {user.id.slice(0, 12)}...</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge className={((user.role || 'user') === 'admin') ? 'bg-primary' : 'bg-muted text-foreground'}>
                            {(user.role || 'user') === 'admin' ? <Shield className="w-3 h-3 mr-1" /> : null}
                            {(user.role || 'user').toUpperCase()}
                          </Badge>
                          {user.kycStatus && (
                            <Badge variant="outline" className={user.kycStatus === 'approved' ? 'border-primary/30 text-primary' : 'border-yellow-300 text-yellow-700'}>
                              KYC: {user.kycStatus}
                            </Badge>
                          )}
                          {/* Shares badge */}
                          <Badge variant="outline" className="border-accent/50 text-foreground gap-1 cursor-pointer hover:bg-accent/10" onClick={() => { setEditSharesUser(user); setNewSharesValue(String(user.shares || 0)); setNewInstallmentValue(String(user.monthlyInstallment || 5000)); setNewTotalTargetValue(String((user as any).totalTarget || '')); }}>
                            <TrendingUp className="w-3 h-3" />
                            {user.shares || 0} Shares
                            <Edit2 className="w-3 h-3 ml-1 opacity-50" />
                          </Badge>
                          <Badge variant="outline" className="border-primary/30 text-primary gap-1 cursor-pointer hover:bg-primary/5" onClick={() => { setEditSharesUser(user); setNewSharesValue(String(user.shares || 0)); setNewInstallmentValue(String(user.monthlyInstallment || 5000)); setNewTotalTargetValue(String((user as any).totalTarget || '')); }}>
                            ৳{(user.monthlyInstallment || 5000).toLocaleString()}/mo
                            <Edit2 className="w-3 h-3 ml-1 opacity-50" />
                          </Badge>
                          {user.status === 'deactivated' && <Badge variant="destructive">Deactivated</Badge>}
                        </div>

                        <div className="grid md:grid-cols-3 gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span className="truncate">{user.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span>{user.phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span>{user.createdAt ? format(new Date(user.createdAt), 'MMM dd, yyyy') : 'N/A'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => handleViewAnalytics(user)}>
                          <BarChart2 className="w-3 h-3" />
                          Analytics
                        </Button>
                        {user.status !== 'deactivated' && (
                          <Button size="sm" variant="destructive" className="gap-1" onClick={() => handleDeactivateUser(user.id)}>
                            <UserX className="w-3 h-3" />
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Analytics Dialog */}
      <Dialog open={!!analyticsUser || analyticsLoading} onOpenChange={() => setAnalyticsUser(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary" />
              {analyticsUser?.user.name} — Analytics
            </DialogTitle>
          </DialogHeader>

          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : analyticsUser && (
            <div className="space-y-6 py-2">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-center">
                  <p className="text-lg font-bold text-primary break-all">৳{analyticsUser.analytics.totalPaid.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Paid</p>
                </div>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-lg text-center">
                  <p className="text-lg font-bold text-yellow-700 dark:text-yellow-400 break-all">৳{analyticsUser.analytics.totalPending.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pending</p>
                </div>
                <div className={`p-3 border rounded-lg text-center ${analyticsUser.analytics.dueAmount > 0 ? 'bg-destructive/5 border-destructive/20' : 'bg-primary/5 border-primary/20'}`}>
                  <p className={`text-lg font-bold break-all ${analyticsUser.analytics.dueAmount > 0 ? 'text-destructive' : 'text-primary'}`}>
                    ৳{analyticsUser.analytics.dueAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Due Amount</p>
                </div>
                <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg text-center">
                  <p className="text-lg font-bold">{analyticsUser.user.shares || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Shares</p>
                </div>
              </div>

              {/* Target progress */}
              {analyticsUser.analytics.totalTarget > 0 && (
                <div className="p-4 bg-muted/30 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress toward target:</span>
                    <span className="font-bold">৳{analyticsUser.analytics.totalPaid.toLocaleString()} / ৳{analyticsUser.analytics.totalTarget.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (analyticsUser.analytics.totalPaid / analyticsUser.analytics.totalTarget) * 100).toFixed(1)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{((analyticsUser.analytics.totalPaid / analyticsUser.analytics.totalTarget) * 100).toFixed(1)}% complete</span>
                    <span>৳{analyticsUser.analytics.remainingTarget.toLocaleString()} remaining</span>
                  </div>
                </div>
              )}

              {/* Monthly installment info */}
              <div className="p-3 bg-muted/30 border rounded-lg flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Monthly Installment:</span>
                <span className="font-bold text-primary">৳{(analyticsUser.analytics.monthlyInstallment || 5000).toLocaleString()}/month</span>
              </div>

              {/* Extra balance */}
              {analyticsUser.analytics.extraBalance > 0 && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-lg flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-yellow-600" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    Extra balance: <strong>৳{analyticsUser.analytics.extraBalance.toLocaleString()}</strong>
                  </p>
                </div>
              )}

              {/* Due warning */}
              {analyticsUser.analytics.dueMonths > 0 && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <p className="text-sm text-destructive">
                    <strong>{analyticsUser.analytics.dueMonths} month(s)</strong> overdue — ৳{analyticsUser.analytics.dueAmount.toLocaleString()} outstanding
                  </p>
                </div>
              )}

              {/* Payment stats */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 border rounded-lg">
                  <p className="text-xl font-bold text-primary">{analyticsUser.analytics.approvedCount}</p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-xl font-bold text-yellow-600">{analyticsUser.analytics.pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-xl font-bold text-destructive">{analyticsUser.analytics.rejectedCount}</p>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                </div>
              </div>

              {/* Contribution history */}
              <div>
                <h3 className="font-semibold mb-3 text-foreground">Contribution History</h3>
                {analyticsUser.analytics.contributionHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No approved payments yet</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {analyticsUser.analytics.contributionHistory.map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          <span className="font-medium">{c.month}</span>
                          <span className="text-muted-foreground text-xs capitalize">via {c.paidFrom}</span>
                        </div>
                        <span className="font-bold text-primary">৳{c.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Shares Dialog */}
      <Dialog open={!!editSharesUser} onOpenChange={() => setEditSharesUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Settings — {editSharesUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Number of Shares</Label>
              <Input
                type="number"
                min="0"
                value={newSharesValue}
                onChange={(e) => setNewSharesValue(e.target.value)}
                placeholder="Enter number of shares"
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly Installment (৳)</Label>
              <Input
                type="number"
                min="1"
                value={newInstallmentValue}
                onChange={(e) => setNewInstallmentValue(e.target.value)}
                placeholder="5000"
              />
              <p className="text-xs text-muted-foreground">Due calculation will use this rate</p>
            </div>
            <div className="space-y-2">
              <Label>Total Target Amount (৳)</Label>
              <Input
                type="number"
                min="0"
                value={newTotalTargetValue}
                onChange={(e) => setNewTotalTargetValue(e.target.value)}
                placeholder="e.g. 60000"
              />
              <p className="text-xs text-muted-foreground">Due = Total Target − Total Paid</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setEditSharesUser(null)}>Cancel</Button>
              <Button className="flex-1" onClick={handleUpdateShares}>Update</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
