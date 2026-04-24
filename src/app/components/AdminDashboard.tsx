import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/supabase';
import { Card } from './ui/card';
import { motion } from 'motion/react';
import { DollarSign, TrendingUp, Clock, CheckCircle2, Users, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface Stats {
  totalCollected: number;
  totalPending: number;
  totalPayments: number;
}

interface Payment {
  id: string;
  userId: string;
  paymentDate: string;
  paidMonth: string;
  paidAmount: number;
  status: 'pending' | 'approved' | 'rejected';
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ totalCollected: 0, totalPending: 0, totalPayments: 0 });
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [paymentsData, usersData] = await Promise.all([
        apiCall('/admin/payments'),
        apiCall('/admin/users'),
      ]);

      setStats(paymentsData.stats);
      setPayments(paymentsData.payments);
      setUsers(usersData.users);
    } catch (error: any) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Monthly breakdown data
  const monthlyData = eachMonthOfInterval({
    start: subMonths(new Date(), 5),
    end: new Date(),
  }).map((month) => {
    const monthKey = format(month, 'yyyy-MM');
    const monthPayments = payments.filter((p) => p.paidMonth === monthKey && p.status === 'approved');
    const total = monthPayments.reduce((sum, p) => sum + p.paidAmount, 0);

    return {
      month: format(month, 'MMM yyyy'),
      amount: total,
      count: monthPayments.length,
    };
  });

  // Top users by payment amount
  const userPaymentSummary = payments
    .filter((p) => p.status === 'approved')
    .reduce((acc, p) => {
      if (!acc[p.userId]) {
        acc[p.userId] = { userId: p.userId, total: 0, count: 0 };
      }
      acc[p.userId].total += p.paidAmount;
      acc[p.userId].count += 1;
      return acc;
    }, {} as Record<string, { userId: string; total: number; count: number }>);

  const topUsers = Object.values(userPaymentSummary)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <TrendingUp className="w-12 h-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading dashboard...</p>
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
            Finance Overview
          </h1>
          <p className="text-muted-foreground">Analytics and insights for all financial transactions</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid md:grid-cols-4 gap-6"
        >
          <Card className="p-6 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <DollarSign className="w-6 h-6 text-primary" />
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
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold">{stats.totalPayments}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Transactions</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold">{users.filter((u) => u.status !== 'deactivated').length}</p>
            <p className="text-sm text-muted-foreground mt-1">Active Users</p>
          </Card>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
                <Calendar className="w-5 h-5 text-primary" />
                Monthly Collection Trend
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                    }}
                  />
                  <Line type="monotone" dataKey="amount" stroke="#0d6e4f" strokeWidth={3} dot={{ fill: '#0d6e4f', r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
                <TrendingUp className="w-5 h-5 text-primary" />
                Payment Volume by Month
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="#0d6e4f" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6" style={{ fontFamily: 'var(--font-heading)' }}>
              Top Contributors
            </h2>
            <div className="space-y-3">
              {topUsers.map((user, index) => (
                <div key={user.userId} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                      #{index + 1}
                    </div>
                    <div>
                      <p className="font-medium">User ID: {user.userId.slice(0, 12)}...</p>
                      <p className="text-sm text-muted-foreground">{user.count} payments</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">৳{user.total.toFixed(2)}</p>
                  </div>
                </div>
              ))}
              {topUsers.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">No payment data yet</p>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
