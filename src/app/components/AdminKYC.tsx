import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/supabase';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { motion } from 'motion/react';
import { FileText, CheckCircle, XCircle, Clock, Search, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface UserKYC {
  id: string;
  email: string;
  name: string;
  kycStatus: string;
  kycDocuments?: Record<string, string>;
  createdAt: string;
}

export default function AdminKYC() {
  const [users, setUsers] = useState<UserKYC[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserKYC | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    // Refresh every 5 seconds to see new submissions
    const interval = setInterval(fetchUsers, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchUsers = async () => {
    try {
      console.log('Fetching users from /admin/users...');
      const data = await apiCall('/admin/users');
      console.log('Users fetched:', data);
      console.log('Total users:', data.users?.length || 0);
      data.users?.forEach((u: any) => {
        console.log(`User: ${u.name || 'Unknown'} (${u.email}) - KYC: ${u.kycStatus}`);
      });
      setUsers(data.users || []);
    } catch (error: any) {
      console.error('Failed to load users:', error);
      toast.error(`Failed to load users: ${error.message}`);
      // Fallback to empty array
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveKYC = async (userId: string) => {
    setActionLoading(true);
    try {
      // Update user KYC status
      await apiCall(`/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ kycStatus: 'approved' }),
      });
      toast.success('KYC approved');
      fetchUsers();
      setSelectedUser(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve KYC');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectKYC = async (userId: string) => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setActionLoading(true);
    try {
      await apiCall(`/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ kycStatus: 'rejected', rejectionReason: rejectReason }),
      });
      toast.success('KYC rejected');
      fetchUsers();
      setSelectedUser(null);
      setShowRejectDialog(false);
      setRejectReason('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject KYC');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewDocument = async (userId: string, docType: string) => {
    try {
      const data = await apiCall(`/user/kyc/document/${userId}/${docType}`);
      setDocumentUrl(data.url);
    } catch (error: any) {
      toast.error('Failed to load document');
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const pendingUsers = filteredUsers.filter((u) => u.kycStatus === 'pending' || u.kycStatus === 'submitted');
  const approvedUsers = filteredUsers.filter((u) => u.kycStatus === 'approved');
  const rejectedUsers = filteredUsers.filter((u) => u.kycStatus === 'rejected');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading KYC requests...</p>
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
            KYC Management
          </h1>
          <p className="text-muted-foreground">Review and approve user KYC documents</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid md:grid-cols-3 gap-6"
        >
          <Card className="p-6 border-yellow-200 bg-yellow-50">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-yellow-700">{pendingUsers.length}</p>
            <p className="text-sm text-yellow-600 mt-1">Pending Review</p>
          </Card>

          <Card className="p-6 border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold text-primary">{approvedUsers.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Approved</p>
          </Card>

          <Card className="p-6 border-destructive/20 bg-destructive/5">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-destructive/10 rounded-lg">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
            </div>
            <p className="text-3xl font-bold text-destructive">{rejectedUsers.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Rejected</p>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="p-6">
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Pending KYC */}
            {pendingUsers.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  Pending Review ({pendingUsers.length})
                </h2>
                <div className="space-y-3">
                  {pendingUsers.map((user) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <h3 className="font-semibold">{user.name || 'Unknown'}</h3>
                        <p className="text-sm text-muted-foreground">{user.email || 'No email'}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setSelectedUser(user)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Review
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Approved KYC */}
            {approvedUsers.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  Approved ({approvedUsers.length})
                </h2>
                <div className="space-y-3">
                  {approvedUsers.map((user) => (
                    <div key={user.id} className="p-4 border border-primary/20 bg-primary/5 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{user.name || 'Unknown'}</h3>
                          <p className="text-sm text-muted-foreground">{user.email || 'No email'}</p>
                        </div>
                        <Badge className="bg-primary">Approved</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rejected KYC */}
            {rejectedUsers.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-destructive" />
                  Rejected ({rejectedUsers.length})
                </h2>
                <div className="space-y-3">
                  {rejectedUsers.map((user) => (
                    <div key={user.id} className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{user.name || 'Unknown'}</h3>
                          <p className="text-sm text-muted-foreground">{user.email || 'No email'}</p>
                        </div>
                        <Badge variant="destructive">Rejected</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No KYC requests found</p>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Document Viewer Dialog */}
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedUser?.name} - KYC Documents</DialogTitle>
            </DialogHeader>

            {selectedUser && (
              <div className="space-y-6 py-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {selectedUser.kycDocuments &&
                    Object.entries(selectedUser.kycDocuments).map(([docType, _]) => (
                      <Button
                        key={docType}
                        variant="outline"
                        className="justify-start"
                        onClick={() => handleViewDocument(selectedUser.id, docType)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View {docType}
                      </Button>
                    ))}
                </div>

                {documentUrl && (
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <iframe
                      src={documentUrl}
                      className="w-full h-96 rounded"
                      title="KYC Document"
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={actionLoading}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => handleApproveKYC(selectedUser.id)}
                    disabled={actionLoading}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Reason Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject KYC</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Rejection Reason</Label>
                <textarea
                  id="reason"
                  placeholder="Explain why you're rejecting this KYC..."
                  className="w-full border rounded-md px-3 py-2 min-h-24 bg-background"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowRejectDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => selectedUser && handleRejectKYC(selectedUser.id)}
                  disabled={actionLoading}
                >
                  Reject
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
