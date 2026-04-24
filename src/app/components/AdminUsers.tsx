import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/supabase';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { motion } from 'motion/react';
import { Users, Plus, Search, UserX, Mail, Phone, Calendar, Shield, User, Clock } from 'lucide-react';
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
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'user',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await apiCall('/admin/users');
      setUsers(data.users || []);
    } catch (error: any) {
      console.error('Failed to load users:', error);
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
      setNewUser({ email: '', password: '', name: '', phone: '', role: 'user' });
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

  const filteredUsers = users
    .filter(user => user && user.id) // Filter out invalid users
    .filter(
      (user) =>
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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
            User Management
          </h1>
          <p className="text-muted-foreground">Manage user accounts and permissions</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid md:grid-cols-3 gap-6"
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold">{users.filter((u) => u.status !== 'deactivated').length}</p>
            <p className="text-sm text-muted-foreground mt-1">Active Users</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-3xl font-bold">{users.filter((u) => u.kycStatus === 'pending').length}</p>
            <p className="text-sm text-muted-foreground mt-1">Pending KYC</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Shield className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold">{users.filter((u) => u.role === 'admin').length}</p>
            <p className="text-sm text-muted-foreground mt-1">Administrators</p>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
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
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>Add a new user to the system</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        placeholder="Enter full name"
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="user@example.com"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        placeholder="017XX-XXXXXX"
                        value={newUser.phone}
                        onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Create a password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <select
                        id="role"
                        className="w-full border rounded-md px-3 py-2 bg-background"
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>

                    <Button type="submit" className="w-full">
                      Create User
                    </Button>
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
                    className={`p-4 border rounded-lg transition-colors ${
                      user.status === 'deactivated' ? 'opacity-50 bg-muted/30' : 'hover:border-primary/50'
                    }`}
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
                            <Badge
                              variant="outline"
                              className={
                                user.kycStatus === 'approved'
                                  ? 'border-primary/30 text-primary'
                                  : 'border-yellow-300 text-yellow-700'
                              }
                            >
                              KYC: {user.kycStatus || 'pending'}
                            </Badge>
                          )}
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

                      {user.status !== 'deactivated' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1"
                          onClick={() => handleDeactivateUser(user.id)}
                        >
                          <UserX className="w-3 h-3" />
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
