import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/supabase';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  ThumbsUp,
  ThumbsDown,
  DollarSign,
  TrendingUp,
  Calendar,
  CreditCard,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Payment {
  id: string;
  userId: string;
  paymentDate: string;
  dateOfEntry: string;
  paidFrom: string;
  transactionId: string;
  paidMonth: string;
  paidAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdBy: string;
}

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState({ totalCollected: 0, totalPending: 0, totalPayments: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [newPayment, setNewPayment] = useState({
    userId: '',
    paymentDate: '',
    paidFrom: '',
    transactionId: '',
    paidMonth: '',
    paidAmount: '',
  });

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const data = await apiCall('/admin/payments');
      setPayments(data.payments);
      setStats(data.stats);
    } catch (error: any) {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (paymentId: string) => {
    try {
      await apiCall(`/admin/payments/${paymentId}/approve`, { method: 'POST' });
      toast.success('Payment approved');
      fetchPayments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve payment');
    }
  };

  const handleReject = async () => {
    if (!selectedPayment) return;

    try {
      await apiCall(`/admin/payments/${selectedPayment.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectionReason }),
      });
      toast.success('Payment rejected');
      setRejectDialogOpen(false);
      setSelectedPayment(null);
      setRejectionReason('');
      fetchPayments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject payment');
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiCall('/admin/payments/add', {
        method: 'POST',
        body: JSON.stringify(newPayment),
      });
      toast.success('Payment added successfully');
      setAddDialogOpen(false);
      setNewPayment({
        userId: '',
        paymentDate: '',
        paidFrom: '',
        transactionId: '',
        paidMonth: '',
        paidAmount: '',
      });
      fetchPayments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add payment');
    }
  };

  const filteredPayments = payments.filter((p) => (filterStatus === 'all' ? true : p.status === filterStatus));

  const exportToCSV = () => {
    const headers = ['Date', 'User ID', 'Paid From', 'Transaction ID', 'Month', 'Amount (BDT)', 'Status', 'Entry Date'];
    const rows = filteredPayments.map((p) => [
      p.paymentDate,
      p.userId,
      p.paidFrom,
      p.transactionId,
      p.paidMonth,
      p.paidAmount.toFixed(2),
      p.status,
      p.dateOfEntry ? format(new Date(p.dateOfEntry), 'yyyy-MM-dd') : '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payments_${filterStatus}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <DollarSign className="w-12 h-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading payments...</p>
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
            Payment Management
          </h1>
          <p className="text-muted-foreground">Review, approve, and manage all user payments</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid md:grid-cols-3 gap-6"
        >
          <Card className="p-6 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold text-primary">৳{stats.totalCollected.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Collected</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-3xl font-bold">৳{stats.totalPending.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground mt-1">Pending Approval</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold">{stats.totalPayments}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Payments</p>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="p-6">
            <div className="flex items-center gap-3 flex-wrap justify-between mb-6">
              <div className="flex items-center gap-3">
                <Label htmlFor="filter-status">Filter by status:</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payments</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" className="gap-2" onClick={exportToCSV}>
                <Download className="w-4 h-4" />
                Export CSV
              </Button>

              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Payment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Payment Directly</DialogTitle>
                    <DialogDescription>Create a payment entry for any user</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddPayment} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="userId">User ID</Label>
                      <Input
                        id="userId"
                        placeholder="Enter user ID"
                        value={newPayment.userId}
                        onChange={(e) => setNewPayment({ ...newPayment, userId: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="paymentDate">Payment Date</Label>
                      <Input
                        id="paymentDate"
                        type="date"
                        value={newPayment.paymentDate}
                        onChange={(e) => setNewPayment({ ...newPayment, paymentDate: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="paidFrom">Paid From</Label>
                      <Select
                        value={newPayment.paidFrom}
                        onValueChange={(value) => setNewPayment({ ...newPayment, paidFrom: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank">Bank Transfer</SelectItem>
                          <SelectItem value="bkash">bKash</SelectItem>
                          <SelectItem value="nagad">Nagad</SelectItem>
                          <SelectItem value="rocket">Rocket</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="transactionId">Transaction ID (Optional)</Label>
                      <Input
                        id="transactionId"
                        placeholder="Enter transaction ID"
                        value={newPayment.transactionId}
                        onChange={(e) => setNewPayment({ ...newPayment, transactionId: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="paidMonth">Paid Month</Label>
                      <Input
                        id="paidMonth"
                        type="month"
                        value={newPayment.paidMonth}
                        onChange={(e) => setNewPayment({ ...newPayment, paidMonth: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="paidAmount">Amount (BDT)</Label>
                      <Input
                        id="paidAmount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newPayment.paidAmount}
                        onChange={(e) => setNewPayment({ ...newPayment, paidAmount: e.target.value })}
                        required
                      />
                    </div>

                    <Button type="submit" className="w-full">
                      Add Payment
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {filteredPayments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No payments found</p>
                </div>
              ) : (
                filteredPayments.map((payment, index) => (
                  <motion.div
                    key={payment.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Badge
                            className={`gap-1 ${
                              payment.status === 'approved'
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : payment.status === 'pending'
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                : 'bg-destructive/10 text-destructive border-destructive/20'
                            }`}
                          >
                            {payment.status === 'approved' ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : payment.status === 'pending' ? (
                              <Clock className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            User: {payment.userId.slice(0, 8)}...
                          </Badge>
                        </div>

                        <div className="grid md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs">Payment Date</p>
                            <p className="font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(payment.paymentDate), 'MMM dd, yyyy')}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Paid From</p>
                            <p className="font-medium capitalize">{payment.paidFrom}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Transaction ID</p>
                            <p className="font-medium flex items-center gap-1">
                              <CreditCard className="w-3 h-3" />
                              {payment.transactionId}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">For Month</p>
                            <p className="font-medium">{payment.paidMonth}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-3">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">৳{payment.paidAmount.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(payment.dateOfEntry), 'MMM dd, yyyy')}
                          </p>
                        </div>

                        {payment.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1"
                              onClick={() => handleApprove(payment.id)}
                            >
                              <ThumbsUp className="w-3 h-3" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-1"
                              onClick={() => {
                                setSelectedPayment(payment);
                                setRejectDialogOpen(true);
                              }}
                            >
                              <ThumbsDown className="w-3 h-3" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </Card>
        </motion.div>

        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Payment</DialogTitle>
              <DialogDescription>Please provide a reason for rejecting this payment</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Enter rejection reason..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason.trim()}>
                  Reject Payment
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
