import { useState, useEffect, useRef } from 'react';
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
import { Wallet, Plus, CheckCircle2, Clock, XCircle, Calendar, CreditCard, FileText, Megaphone, AlertCircle, Upload, Image, Eye, TrendingUp, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BANKS, PAYMENT_METHODS } from '../constants/banks';
import AccountStatement from './AccountStatement';

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
  screenshotPath?: string;
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
  const [totalLateFees, setTotalLateFees] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeTab, setActiveTab] = useState<'payments' | 'statement'>('payments');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [viewingScreenshot, setViewingScreenshot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const INSTALLMENT_RATE = 5000;
  const today = new Date().toISOString().split('T')[0];

  const [newPayment, setNewPayment] = useState({
    paymentDate: today,
    paidFrom: '',
    bankName: '',
    transactionId: '',
    numMonths: '1',
    paidAmount: String(INSTALLMENT_RATE),
  });

  // Auto-calculate amount when numMonths changes
  const handleNumMonthsChange = (val: string) => {
    const months = parseInt(val) || 1;
    setNewPayment((prev) => ({ ...prev, numMonths: val, paidAmount: String(months * INSTALLMENT_RATE) }));
  };

  // Preview: full months + extra
  const previewAmount = parseFloat(newPayment.paidAmount) || 0;
  const previewMonths = Math.floor(previewAmount / INSTALLMENT_RATE);
  const previewExtra = previewAmount % INSTALLMENT_RATE;

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
      setTotalLateFees(data.totalLateFees || 0);
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
    setSubmitting(true);
    try {
      // Build paidFrom: if bank, combine method + bank name
      const paidFrom = newPayment.paidFrom === 'bank' && newPayment.bankName
        ? `Bank - ${newPayment.bankName}`
        : newPayment.paidFrom;

      // Validate bank selection
      if (newPayment.paidFrom === 'bank' && !newPayment.bankName) {
        toast.error('Please select a bank');
        setSubmitting(false);
        return;
      }

      // Validate screenshot is required
      if (!screenshotFile) {
        toast.error('Payment screenshot is required');
        setSubmitting(false);
        return;
      }

      // Encode screenshot if provided
      let paymentScreenshot = null;
      if (screenshotFile) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result?.toString().split(',')[1] || '';
            resolve(result);
          };
          reader.readAsDataURL(screenshotFile);
        });
        paymentScreenshot = {
          fileName: screenshotFile.name,
          fileData: base64,
          fileType: screenshotFile.type,
        };
      }

      await apiCall('/payments/submit', {
        method: 'POST',
        body: JSON.stringify({
          paymentDate: newPayment.paymentDate,
          paidFrom,
          transactionId: newPayment.transactionId,
          paidAmount: newPayment.paidAmount,
          paymentScreenshot,
        }),
      });
      toast.success('Payment submitted for approval');
      setDialogOpen(false);
      setNewPayment({ paymentDate: today, paidFrom: '', bankName: '', transactionId: '', numMonths: '1', paidAmount: String(INSTALLMENT_RATE) });
      setScreenshotFile(null);
      setScreenshotPreview(null);
      fetchPayments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit payment');
    } finally {
      setSubmitting(false);
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
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
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
                      <p className="font-semibold text-sm text-foreground">{ann.title}</p>
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
          className="grid md:grid-cols-4 gap-6"
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
            <p className="text-3xl font-bold">{payments.filter((p) => p.status === 'approved' && p.paidMonth !== 'extra').length}</p>
            <p className="text-sm text-muted-foreground mt-1">Approved Payments</p>
          </Card>

          {/* Shares card */}
          {(user as any)?.shares !== undefined && (
            <Card className="p-6 border-accent/30 bg-accent/5">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-accent/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-accent-foreground" />
                </div>
              </div>
              <p className="text-3xl font-bold">{(user as any).shares || 0}</p>
              <p className="text-sm text-muted-foreground mt-1">My Shares</p>
            </Card>
          )}
        </motion.div>

        {/* Extra amount card */}
        {payments.filter(p => p.paidMonth === 'extra' && p.status !== 'rejected').length > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-4 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-800 rounded-lg">
                  <CreditCard className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="font-semibold text-yellow-700 dark:text-yellow-400">Extra Amount on Account</p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-500">
                    ৳{payments.filter(p => p.paidMonth === 'extra' && p.status !== 'rejected').reduce((s, p) => s + p.paidAmount, 0).toLocaleString()} — will be applied to your next installment
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('payments')}
                  className={`text-xl font-semibold pb-1 border-b-2 transition-colors ${activeTab === 'payments' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  Payment History
                </button>
                <button
                  onClick={() => setActiveTab('statement')}
                  className={`text-xl font-semibold pb-1 border-b-2 transition-colors flex items-center gap-1 ${activeTab === 'statement' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  <BookOpen className="w-4 h-4" />
                  Account Statement
                  {totalLateFees > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-destructive text-destructive-foreground text-xs rounded-full">!</span>
                  )}
                </button>
              </div>
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
                        <Label htmlFor="bankName">Select Bank</Label>
                        <Select
                          value={newPayment.bankName}
                          onValueChange={(value) => setNewPayment({ ...newPayment, bankName: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select your bank" />
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
                      <Label htmlFor="numMonths">Number of Months</Label>
                      <Select
                        value={newPayment.numMonths}
                        onValueChange={handleNumMonthsChange}
                      >
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
                      {previewAmount > 0 && previewAmount < INSTALLMENT_RATE && (
                        <p className="text-destructive text-xs">Minimum amount is ৳{INSTALLMENT_RATE.toLocaleString()}</p>
                      )}
                    </div>

                    {/* Screenshot Upload */}
                    <div className="space-y-2">
                      <Label>Payment Screenshot</Label>
                      <div
                        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {screenshotPreview ? (
                          <div className="space-y-2">
                            <img src={screenshotPreview} alt="Preview" className="max-h-32 mx-auto rounded object-contain" />
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
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleScreenshotChange}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? 'Submitting...' : 'Submit for Approval'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {activeTab === 'statement' ? (
                <AccountStatement />
              ) : payments.length === 0 ? (
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
                            <p className="font-medium">
                              {payment.paidMonth === 'extra'
                                ? <span className="text-yellow-600">Extra Amount</span>
                                : payment.paidMonth}
                            </p>
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
                        {payment.screenshotPath && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 gap-1 text-xs"
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
      </div>

      {/* Screenshot Viewer Dialog */}
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
  );
}
