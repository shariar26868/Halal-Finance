import { useState, useEffect, useRef } from 'react';
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
  Upload,
  Image,
  Users,
  UserCheck,
  UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subMonths } from 'date-fns';
import { BANKS, PAYMENT_METHODS } from '../constants/banks';

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
  screenshotPath?: string;
}

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalCollected: 0, totalPending: 0, totalPayments: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [viewingScreenshot, setViewingScreenshot] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const INSTALLMENT_RATE = 5000;
  const today = new Date().toISOString().split('T')[0];

  // Generate last 12 months for dropdown
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return {
      value: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy'),
    };
  });

  const [newPayment, setNewPayment] = useState({
    userId: '',
    paymentDate: today,
    paidFrom: '',
    bankName: '',
    transactionId: '',
    numMonths: '1',
    paidAmount: String(INSTALLMENT_RATE),
  });

  const handleNumMonthsChange = (val: string) => {
    const months = parseInt(val) || 1;
    setNewPayment((prev) => ({ ...prev, numMonths: val, paidAmount: String(months * INSTALLMENT_RATE) }));
  };

  const previewAmount = parseFloat(newPayment.paidAmount) || 0;
  const previewMonths = Math.floor(previewAmount / INSTALLMENT_RATE);
  const previewExtra = previewAmount % INSTALLMENT_RATE;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [paymentsData, usersData] = await Promise.all([
        apiCall('/admin/payments'),
        apiCall('/admin/users'),
      ]);
      setPayments(paymentsData.payments);
      setStats(paymentsData.stats);
      // Only regular users (not admins)
      setUsers((usersData.users || []).filter((u: any) => u.role !== 'admin' && u.status !== 'deactivated'));
    } catch (error: any) {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = fetchData;

  // For selected month: who paid (approved) and who didn't
  const monthlyPaidUserIds = selectedMonth
    ? new Set(
        payments
          .filter((p) => p.paidMonth === selectedMonth && p.status === 'approved')
          .map((p) => p.userId)
      )
    : null;

  const paidUsers = selectedMonth ? users.filter((u) => monthlyPaidUserIds?.has(u.id)) : [];
  const unpaidUsers = selectedMonth ? users.filter((u) => !monthlyPaidUserIds?.has(u.id)) : [];

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
      const paidFrom = newPayment.paidFrom === 'bank' && newPayment.bankName
        ? `Bank - ${newPayment.bankName}`
        : newPayment.paidFrom;

      // Validate bank selection
      if (newPayment.paidFrom === 'bank' && !newPayment.bankName) {
        toast.error('Please select a bank');
        return;
      }

      // Validate screenshot is required
      if (!screenshotFile) {
        toast.error('Payment screenshot is required');
        return;
      }

      let paymentScreenshot = null;
      if (screenshotFile) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result?.toString().split(',')[1] || '');
          reader.readAsDataURL(screenshotFile);
        });
        paymentScreenshot = { fileName: screenshotFile.name, fileData: base64, fileType: screenshotFile.type };
      }

      await apiCall('/admin/payments/add', {
        method: 'POST',
        body: JSON.stringify({ ...newPayment, paidFrom, paymentScreenshot }),
      });
      toast.success('Payment added successfully');
      setAddDialogOpen(false);
      setNewPayment({ userId: '', paymentDate: today, paidFrom: '', bankName: '', transactionId: '', numMonths: '1', paidAmount: String(INSTALLMENT_RATE) });
      setScreenshotFile(null);
      setScreenshotPreview(null);
      fetchPayments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add payment');
    }
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return; }
    setScreenshotFile(file);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  const handleViewScreenshot = async (paymentId: string) => {
    try {
      const data = await apiCall(`/payments/screenshot/${encodeURIComponent(paymentId)}`);
      setViewingScreenshot(data.url);
    } catch {
      toast.error('Failed to load screenshot');
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
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                  Monthly Payment Tracker
                </h2>
              </div>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select a month..." />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMonth && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedMonth('')} className="text-muted-foreground">
                  Clear
                </Button>
              )}
            </div>

            {selectedMonth ? (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Paid */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-primary/10 rounded-lg">
                      <UserCheck className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-semibold text-primary">
                      Paid ({paidUsers.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {paidUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No payments for this month yet</p>
                    ) : (
                      paidUsers.map((u) => (
                        <div key={u.id} className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
                          <div>
                            <p className="text-sm font-medium">{u.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                          <Badge className="bg-primary text-xs">Paid</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Not Paid */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-destructive/10 rounded-lg">
                      <UserX className="w-4 h-4 text-destructive" />
                    </div>
                    <h3 className="font-semibold text-destructive">
                      Not Paid ({unpaidUsers.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {unpaidUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">All users have paid this month 🎉</p>
                    ) : (
                      unpaidUsers.map((u) => (
                        <div key={u.id} className="flex items-center justify-between p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                          <div>
                            <p className="text-sm font-medium">{u.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                          <Badge variant="destructive" className="text-xs">Not Paid</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Select a month to see who has paid and who hasn't</p>
              </div>
            )}
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
                        readOnly
                        className="bg-muted cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="paidFrom">Paid From</Label>
                      <Select
                        value={newPayment.paidFrom}
                        onValueChange={(value) => setNewPayment({ ...newPayment, paidFrom: value, bankName: '' })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank">Bank Transfer</SelectItem>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {newPayment.paidFrom === 'bank' && (
                      <div className="space-y-2">
                        <Label>Select Bank</Label>
                        <Select
                          value={newPayment.bankName}
                          onValueChange={(value) => setNewPayment({ ...newPayment, bankName: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select bank" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {BANKS.map((bank) => (
                              <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

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
                      <Label>Number of Months</Label>
                      <Select value={newPayment.numMonths} onValueChange={handleNumMonthsChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select months" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n} month{n > 1 ? 's' : ''} — ৳{(n * INSTALLMENT_RATE).toLocaleString()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="paidAmount">Amount (BDT)</Label>
                      <Input
                        id="paidAmount"
                        type="number"
                        step="1"
                        min={INSTALLMENT_RATE}
                        placeholder="5000"
                        value={newPayment.paidAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          const months = Math.floor(parseFloat(val) / INSTALLMENT_RATE) || 1;
                          setNewPayment((prev) => ({ ...prev, paidAmount: val, numMonths: String(Math.min(months, 12)) }));
                        }}
                        required
                      />
                      {previewAmount >= INSTALLMENT_RATE && (
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm space-y-1">
                          <p className="font-medium text-primary">Payment Preview:</p>
                          <p className="text-muted-foreground">✅ {previewMonths} month{previewMonths > 1 ? 's' : ''} × ৳{INSTALLMENT_RATE.toLocaleString()} = ৳{(previewMonths * INSTALLMENT_RATE).toLocaleString()}</p>
                          {previewExtra > 0 && (
                            <p className="text-yellow-600">⚠️ Extra ৳{previewExtra.toLocaleString()} will be recorded separately</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Payment Screenshot</Label>
                      <div
                        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {screenshotPreview ? (
                          <div className="space-y-2">
                            <img src={screenshotPreview} alt="Preview" className="max-h-28 mx-auto rounded object-contain" />
                            <p className="text-xs text-primary">{screenshotFile?.name}</p>
                            <p className="text-xs text-muted-foreground">Click to replace</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Upload payment screenshot</p>
                            <p className="text-xs text-muted-foreground">Image up to 5MB</p>
                          </div>
                        )}
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleScreenshotChange} />
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
                            <p className="font-medium">
                              {payment.paidMonth === 'extra'
                                ? <span className="text-yellow-600">Extra</span>
                                : payment.paidMonth}
                            </p>
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
                        {payment.screenshotPath && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={() => handleViewScreenshot(payment.id)}
                          >
                            <Image className="w-3 h-3" />
                            View Receipt
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

        {/* Screenshot Viewer */}
        <Dialog open={!!viewingScreenshot} onOpenChange={() => setViewingScreenshot(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Image className="w-5 h-5 text-primary" />
                Payment Screenshot
              </DialogTitle>
            </DialogHeader>
            {viewingScreenshot && (
              <div className="border rounded-lg overflow-hidden bg-muted/30">
                <img src={viewingScreenshot} alt="Payment Screenshot" className="w-full object-contain max-h-[70vh]" />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
