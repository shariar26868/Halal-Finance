import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/supabase';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { motion } from 'motion/react';
import { FileText, CheckCircle, XCircle, Clock, Search, Eye, Phone, Mail, Calendar, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface UserKYC {
  id: string;
  email: string;
  name: string;
  phone?: string;
  kycStatus: string;
  kycDocuments?: Record<string, string>;
  createdAt: string;
  rejectionReason?: string;
}

const DOC_LABELS: Record<string, string> = {
  nid: 'National ID (NID)',
  profilePhoto: 'Profile Photo',
  signedForm: 'Signed Form (PDF)',
  nomineeNid: 'Nominee NID',
  nomineePhoto: 'Nominee Photo',
};

export default function AdminKYC() {
  const [users, setUsers] = useState<UserKYC[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserKYC | null>(null);
  const [viewMode, setViewMode] = useState<'review' | 'details'>('review');
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [activeDocType, setActiveDocType] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await apiCall('/admin/users');
      setUsers(data.users || []);
    } catch (error: any) {
      toast.error(`Failed to load users: ${error.message}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveKYC = async (userId: string) => {
    setActionLoading(true);
    try {
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
      setActiveDocType(docType);
      setDocumentUrl(null);
      const data = await apiCall(`/user/kyc/document/${userId}/${docType}`);
      setDocumentUrl(data.url);
    } catch (error: any) {
      toast.error('Failed to load document');
      setActiveDocType(null);
    }
  };

  const openReview = async (user: UserKYC) => {
    setDocumentUrl(null);
    setActiveDocType(null);
    setViewMode('review');
    // Fetch fresh full user data to ensure kycDocuments is included
    try {
      const data = await apiCall(`/admin/users/${user.id}`);
      setSelectedUser({ ...user, ...data.user });
    } catch {
      setSelectedUser(user);
    }
  };

  const openDetails = async (user: UserKYC) => {
    setDocumentUrl(null);
    setActiveDocType(null);
    setViewMode('details');
    // Fetch fresh full user data to ensure kycDocuments is included
    try {
      const data = await apiCall(`/admin/users/${user.id}`);
      setSelectedUser({ ...user, ...data.user });
    } catch {
      setSelectedUser(user);
    }
  };

  const closeDialog = () => {
    setSelectedUser(null);
    setDocumentUrl(null);
    setActiveDocType(null);
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
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
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
          <Card className="p-6 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-800 rounded-lg w-fit mb-4">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">{pendingUsers.length}</p>
            <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-1">Pending Review</p>
          </Card>
          <Card className="p-6 border-primary/20 bg-primary/5">
            <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
              <CheckCircle className="w-6 h-6 text-primary" />
            </div>
            <p className="text-3xl font-bold text-primary">{approvedUsers.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Approved</p>
          </Card>
          <Card className="p-6 border-destructive/20 bg-destructive/5">
            <div className="p-3 bg-destructive/10 rounded-lg w-fit mb-4">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-3xl font-bold text-destructive">{rejectedUsers.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Rejected</p>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
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

            {/* Pending */}
            {pendingUsers.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  Pending Review ({pendingUsers.length})
                </h2>
                <div className="space-y-3">
                  {pendingUsers.map((user) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 border border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <h3 className="font-semibold text-foreground">{user.name || 'Unknown'}</h3>
                        <p className="text-sm text-muted-foreground">{user.email || 'No email'}</p>
                        {user.kycStatus === 'submitted' && (
                          <Badge className="mt-1 bg-yellow-100 text-yellow-700 text-xs">Documents Submitted</Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openDetails(user)}>
                          <Eye className="w-4 h-4 mr-1" />
                          Details
                        </Button>
                        <Button size="sm" onClick={() => openReview(user)}>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Review
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Approved */}
            {approvedUsers.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  Approved ({approvedUsers.length})
                </h2>
                <div className="space-y-3">
                  {approvedUsers.map((user) => (
                    <div key={user.id} className="p-4 border border-primary/20 bg-primary/5 rounded-lg flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{user.name || 'Unknown'}</h3>
                        <p className="text-sm text-muted-foreground">{user.email || 'No email'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-primary">Approved</Badge>
                        <Button size="sm" variant="outline" onClick={() => openDetails(user)}>
                          <Eye className="w-4 h-4 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rejected */}
            {rejectedUsers.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
                  <XCircle className="w-5 h-5 text-destructive" />
                  Rejected ({rejectedUsers.length})
                </h2>
                <div className="space-y-3">
                  {rejectedUsers.map((user) => (
                    <div key={user.id} className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{user.name || 'Unknown'}</h3>
                        <p className="text-sm text-muted-foreground">{user.email || 'No email'}</p>
                        {user.rejectionReason && (
                          <p className="text-xs text-destructive mt-1">Reason: {user.rejectionReason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="destructive">Rejected</Badge>
                        <Button size="sm" variant="outline" onClick={() => openDetails(user)}>
                          <Eye className="w-4 h-4 mr-1" />
                          View Details
                        </Button>
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

        {/* Main Dialog - Review or Details */}
        <Dialog open={!!selectedUser} onOpenChange={closeDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {viewMode === 'review' ? (
                  <><CheckCircle className="w-5 h-5 text-primary" /> Review KYC — {selectedUser?.name}</>
                ) : (
                  <><Eye className="w-5 h-5 text-primary" /> User Details — {selectedUser?.name}</>
                )}
              </DialogTitle>
            </DialogHeader>

            {selectedUser && viewMode === 'details' && (
              <div className="space-y-6 py-2">
                {/* User Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium">{selectedUser.email || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium">{selectedUser.phone || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Joined</p>
                      <p className="font-medium">
                        {selectedUser.createdAt ? format(new Date(selectedUser.createdAt), 'MMM dd, yyyy') : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">KYC Status</p>
                      <Badge
                        className={
                          selectedUser.kycStatus === 'approved'
                            ? 'bg-primary mt-1'
                            : selectedUser.kycStatus === 'rejected'
                            ? 'bg-destructive mt-1'
                            : 'bg-yellow-500 mt-1'
                        }
                      >
                        {selectedUser.kycStatus}
                      </Badge>
                    </div>
                  </div>
                </div>

                {selectedUser.rejectionReason && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                    <strong>Rejection Reason:</strong> {selectedUser.rejectionReason}
                  </div>
                )}

                {/* Documents */}
                <div>
                  <h3 className="font-semibold mb-3 text-foreground">KYC Documents</h3>
                  {selectedUser.kycDocuments && Object.keys(selectedUser.kycDocuments).length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(selectedUser.kycDocuments).map(([docType]) => (
                        <Button
                          key={docType}
                          variant={activeDocType === docType ? 'default' : 'outline'}
                          className="justify-start gap-2"
                          onClick={() => handleViewDocument(selectedUser.id, docType)}
                        >
                          <FileText className="w-4 h-4" />
                          {DOC_LABELS[docType] || docType}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                  )}
                </div>

                {documentUrl && (
                  <div className="border rounded-lg overflow-hidden bg-muted/30">
                    <p className="text-xs text-muted-foreground px-3 py-2 border-b">
                      {DOC_LABELS[activeDocType || ''] || activeDocType}
                    </p>
                    <iframe src={documentUrl} className="w-full h-80" title="KYC Document" />
                  </div>
                )}

                {/* Re-review button for approved/rejected */}
                {(selectedUser.kycStatus === 'approved' || selectedUser.kycStatus === 'rejected') && (
                  <div className="flex gap-3 pt-2 border-t">
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => setViewMode('review')}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Re-review KYC
                    </Button>
                  </div>
                )}
              </div>
            )}

            {selectedUser && viewMode === 'review' && (
              <div className="space-y-6 py-2">
                {/* Documents to review */}
                <div>
                  <h3 className="font-semibold mb-3 text-foreground">Documents</h3>
                  {selectedUser.kycDocuments && Object.keys(selectedUser.kycDocuments).length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(selectedUser.kycDocuments).map(([docType]) => (
                        <Button
                          key={docType}
                          variant={activeDocType === docType ? 'default' : 'outline'}
                          className="justify-start gap-2"
                          onClick={() => handleViewDocument(selectedUser.id, docType)}
                        >
                          <Eye className="w-4 h-4" />
                          {DOC_LABELS[docType] || docType}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No documents uploaded yet.</p>
                  )}
                </div>

                {documentUrl && (
                  <div className="border rounded-lg overflow-hidden bg-muted/30">
                    <p className="text-xs text-muted-foreground px-3 py-2 border-b">
                      {DOC_LABELS[activeDocType || ''] || activeDocType}
                    </p>
                    <iframe src={documentUrl} className="w-full h-80" title="KYC Document" />
                  </div>
                )}

                <div className="flex gap-3 pt-2 border-t">
                  <Button
                    variant="destructive"
                    className="flex-1 gap-2"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={actionLoading}
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => handleApproveKYC(selectedUser.id)}
                    disabled={actionLoading}
                  >
                    <CheckCircle className="w-4 h-4" />
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
                  className="w-full border rounded-md px-3 py-2 min-h-24 bg-background text-foreground"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowRejectDialog(false)}>
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
