import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/supabase';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { motion } from 'motion/react';
import {
  Wallet, AlertTriangle, CheckCircle2, Clock,
  TrendingUp, ArrowUpCircle, ArrowDownCircle, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface LedgerEntry {
  id: string;
  date: string;
  type: 'payment' | 'late_fee' | 'extra' | 'pending';
  description: string;
  amount: number;
  status: string;
  paidFrom: string;
}

interface Summary {
  totalPaid: number;
  totalExtra: number;
  totalLateFees: number;
  totalTarget: number;
  remainingDue: number;
  monthlyInstallment: number;
  monthsPaid: number;
  pendingCount: number;
}

export default function AccountStatement() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatement();
  }, []);

  const fetchStatement = async () => {
    try {
      const data = await apiCall('/account/statement');
      setSummary(data.summary);
      setLedger(data.ledger || []);
    } catch (error: any) {
      toast.error('Failed to load account statement');
    } finally {
      setLoading(false);
    }
  };

  const typeConfig = {
    payment: { label: 'Payment', color: 'bg-primary/10 text-primary', icon: CheckCircle2, sign: '+' },
    extra: { label: 'Extra', color: 'bg-yellow-100 text-yellow-700', icon: ArrowUpCircle, sign: '+' },
    late_fee: { label: 'Late Fee', color: 'bg-destructive/10 text-destructive', icon: AlertTriangle, sign: '-' },
    pending: { label: 'Pending', color: 'bg-muted text-muted-foreground', icon: Clock, sign: '~' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground text-sm">Loading statement...</p>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const lateFeeEntries = ledger.filter(e => e.type === 'late_fee');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          Account Statement
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Your complete financial history</p>
      </div>

      {/* Late fee warning */}
      {lateFeeEntries.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Late Fee Applied</p>
              <p className="text-sm text-destructive/80 mt-0.5">
                A ৳500 late fee has been charged because you missed 2 consecutive monthly payments.
                Please clear your dues to avoid further charges.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="p-2 bg-primary/10 rounded-lg w-fit mb-3">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <p className="text-xl font-bold text-primary">৳{summary.totalPaid.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Paid</p>
        </Card>

        <Card className="p-4">
          <div className="p-2 bg-primary/10 rounded-lg w-fit mb-3">
            <CheckCircle2 className="w-5 h-5 text-primary" />
          </div>
          <p className="text-xl font-bold">{summary.monthsPaid}</p>
          <p className="text-xs text-muted-foreground mt-1">Months Paid</p>
        </Card>

        {summary.totalTarget > 0 && (
          <Card className={`p-4 ${summary.remainingDue > 0 ? 'border-destructive/20 bg-destructive/5' : 'border-primary/20 bg-primary/5'}`}>
            <div className={`p-2 rounded-lg w-fit mb-3 ${summary.remainingDue > 0 ? 'bg-destructive/10' : 'bg-primary/10'}`}>
              <TrendingUp className={`w-5 h-5 ${summary.remainingDue > 0 ? 'text-destructive' : 'text-primary'}`} />
            </div>
            <p className={`text-xl font-bold ${summary.remainingDue > 0 ? 'text-destructive' : 'text-primary'}`}>
              ৳{summary.remainingDue.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Remaining Due</p>
          </Card>
        )}

        {summary.totalLateFees > 0 && (
          <Card className="p-4 border-destructive/20 bg-destructive/5">
            <div className="p-2 bg-destructive/10 rounded-lg w-fit mb-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <p className="text-xl font-bold text-destructive">৳{summary.totalLateFees.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Late Fees</p>
          </Card>
        )}
      </div>

      {/* Progress bar if target set */}
      {summary.totalTarget > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progress toward target</span>
            <span className="font-semibold">৳{summary.totalPaid.toLocaleString()} / ৳{summary.totalTarget.toLocaleString()}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className="bg-primary h-3 rounded-full transition-all"
              style={{ width: `${Math.min(100, (summary.totalPaid / summary.totalTarget) * 100).toFixed(1)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{((summary.totalPaid / summary.totalTarget) * 100).toFixed(1)}% complete</span>
            <span>Monthly: ৳{summary.monthlyInstallment.toLocaleString()}</span>
          </div>
        </Card>
      )}

      {/* Full ledger */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4 text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>
          Transaction History
        </h3>

        {ledger.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No transactions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ledger.map((entry, index) => {
              const config = typeConfig[entry.type] || typeConfig.payment;
              const Icon = config.icon;
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    entry.type === 'late_fee'
                      ? 'bg-destructive/5 border-destructive/20'
                      : entry.type === 'pending'
                      ? 'bg-muted/30 border-muted'
                      : 'bg-muted/20 border-transparent hover:border-primary/20'
                  } transition-colors`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${config.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.date ? format(new Date(entry.date), 'MMM dd, yyyy') : ''}
                        {entry.paidFrom && entry.paidFrom !== 'system' && ` · via ${entry.paidFrom}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${
                      entry.type === 'late_fee' ? 'text-destructive' :
                      entry.type === 'pending' ? 'text-muted-foreground' : 'text-primary'
                    }`}>
                      {config.sign}৳{entry.amount.toLocaleString()}
                    </p>
                    <Badge className={`text-xs ${config.color}`}>{config.label}</Badge>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
