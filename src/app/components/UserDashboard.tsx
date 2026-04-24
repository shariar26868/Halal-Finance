import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiCall } from '../../utils/supabase';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { motion } from 'motion/react';
import { Wallet, Plus, CheckCircle2, Clock, XCircle, Calendar, CreditCard, FileText, Megaphone, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Payment {
  id: string;
  paymentDate: string;
  dateOfEntry: string;
  paidFrom: string;
  transactionId: string;
  paidMonth: string;
  paidAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdBy: string;
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: 'normal' | 'important' | 'urgent';
  createdByName: string;
  createdAt: string;
}

export default function UserDashboard() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const [newPayment, setNewPayment] = useState({
    paymentDate: '',
    paidFrom: '',
    transactionId: '',
    paidMonth: '',
    paidAmount: '',
  });

  useEffect(() => {
    fetchPayments();
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const data = await apiCall('/announcements');
      setAnnouncements(data.announcements || []);
    } catch {
      // silently fail - announcements are non-critical
    }
  };

  const fetchPayments = async () => {
    try {
      console.log('Fetching payments from /payments/user...');
      const data = await apiCall('/payments/user');
      console.log('Payments fetched:', data);
      setPayments(data.payments || []);
      setTotalPaid(data.totalPaid || 0);
    } catch (error: any) {
      console.error('Failed to load payments:', error);
      toast.error(`Failed to load payments: ${error.message}`);
      setPayments([]);
      setTotalPaid(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiCall('/payments/submit', {
        method: 'POST',
        body: JSON.stringify(newPayment),
      });
      toast.success('Payment submitted for approval');
      setDialogOpen(false);
      setNewPayment({
        paymentDate: '',
        paidFrom: '',
        transactionId: '',
        paidMonth: '',
        paidAmount: '',
      });
      fetchPayments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit payment');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'rejected':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <Wallet className="w-12 h-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
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
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
              Welcome back, {user?.name}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-muted-foreground">Track your payments and manage your account</p>
            <div className="px-3 py-1 bg-primary/10 rounded-full text-xs font-medium text-primary border border-primary/20 break-all">
              ID: {user?.id}
            </div>
          </div>
        </motion.div>

        {/* Announcements Banner */}
        {announcements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-3"
          >
            {announcements.slice(0, 3).map((ann) => {
              const isUrgent = ann.priority === 'urgent';
              const isImportant = ann.priority === 'important';
              return (
                <div
                  key={ann.id}
                  className={`flex items-start gap-3 p-4 rounded-lg border ${
                    isUrgent
                      ? 'bg-destructive/10 border-destructive/30'
                      : isImportant
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-primary/5 border-primary/20'
                  }`}
                >
                  {isUrgent || isImportant ? (
                    <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isUrgent ? 'text-destructive' : 'text-yellow-600'}`} />
                  ) : (
                    <Megaphone className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm">{ann.title}</p>
                      {isUrgent && <Badge className="bg-destructive/10 text-destructive text-xs">Urgent</Badge>}
                      {isImportant && <Badge className="bg-yellow-100 text-yellow-700 text-xs">Important</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{ann.message}</p>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid md:grid-cols-3 gap-6"
        >
          <Card className="p-6 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <div className="px-3 py-1 bg-white/50 rounded-full text-xs font-medium text-primary">Total</div>
            </div>
            <p className="text-3xl font-bold text-primary">৳{totalPaid.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Amount Paid</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-3xl font-bold">{payments.filter((p) => p.status === 'pending').length}</p>
            <p className="text-sm text-muted-foreground mt-1">Pending Approval</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold">{payments.filter((p) => p.status === 'approved').length}</p>
            <p className="text-sm text-muted-foreground mt-1">Approved Payments</p>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                Payment History
              </h2>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Submit Payment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Submit New Payment</DialogTitle>
                    <DialogDescription>Enter your payment details for admin approval</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmitPayment} className="space-y-4 mt-4">
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
                      <Label htmlFor="transactionId">Transaction ID</Label>
                      <Input
                        id="transactionId"
                        placeholder="Enter transaction ID"
                        value={newPayment.transactionId}
                        onChange={(e) => setNewPayment({ ...newPayment, transactionId: e.target.value })}
                        required
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
                      Submit for Approval
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {payments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No payments yet. Submit your first payment above.</p>
                </div>
              ) : (
                payments.map((payment, index) => (
                  <motion.div
                    key={payment.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={`gap-1 ${getStatusColor(payment.status)}`}>
                            {getStatusIcon(payment.status)}
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </Badge>
                          {payment.createdBy === 'admin' && (
                            <Badge variant="outline" className="text-xs">
                              Added by Admin
                            </Badge>
                          )}
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

                        {payment.rejectionReason && (
                          <div className="mt-3 p-2 bg-destructive/10 rounded text-sm text-destructive">
                            <strong>Rejection Reason:</strong> {payment.rejectionReason}
                          </div>
                        )}
                      </div>

                      <div className="text-right ml-6">
                        <p className="text-2xl font-bold text-primary">৳{payment.paidAmount.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          Submitted {format(new Date(payment.dateOfEntry), 'MMM dd')}
                        </p>
                      </div>
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
