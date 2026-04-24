import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/supabase';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { motion } from 'motion/react';
import { ClipboardList, Search, CheckCircle, XCircle, Megaphone, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface AuditLog {
  action: string;
  performedBy: string;
  performedByName: string;
  targetUserId?: string;
  targetUserName?: string;
  details: string;
  timestamp: string;
}

const actionConfig: Record<string, { label: string; color: string; icon: any }> = {
  kyc_approved: { label: 'KYC Approved', color: 'bg-primary/10 text-primary', icon: CheckCircle },
  kyc_rejected: { label: 'KYC Rejected', color: 'bg-destructive/10 text-destructive', icon: XCircle },
  payment_approved: { label: 'Payment Approved', color: 'bg-primary/10 text-primary', icon: CheckCircle },
  payment_rejected: { label: 'Payment Rejected', color: 'bg-destructive/10 text-destructive', icon: XCircle },
  announcement_created: { label: 'Announcement', color: 'bg-yellow-100 text-yellow-700', icon: Megaphone },
  user_deactivated: { label: 'User Deactivated', color: 'bg-destructive/10 text-destructive', icon: UserCheck },
};

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const data = await apiCall('/admin/audit-logs');
      setLogs(data.logs || []);
    } catch (error: any) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const filtered = logs.filter(
    (log) =>
      log.details?.toLowerCase().includes(search.toLowerCase()) ||
      log.performedByName?.toLowerCase().includes(search.toLowerCase()) ||
      log.action?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
            Audit Log
          </h1>
          <p className="text-muted-foreground">Track all admin actions — approvals, rejections, and announcements</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid md:grid-cols-3 gap-6"
        >
          <Card className="p-6">
            <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
              <ClipboardList className="w-6 h-6 text-primary" />
            </div>
            <p className="text-3xl font-bold">{logs.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Actions</p>
          </Card>
          <Card className="p-6">
            <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
              <CheckCircle className="w-6 h-6 text-primary" />
            </div>
            <p className="text-3xl font-bold">
              {logs.filter(l => l.action?.includes('approved')).length}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Approvals</p>
          </Card>
          <Card className="p-6">
            <div className="p-3 bg-destructive/10 rounded-lg w-fit mb-4">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-3xl font-bold">
              {logs.filter(l => l.action?.includes('rejected')).length}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Rejections</p>
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
                  placeholder="Search logs..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No audit logs found</p>
                </div>
              ) : (
                filtered.map((log, index) => {
                  const config = actionConfig[log.action] || {
                    label: log.action,
                    color: 'bg-muted text-foreground',
                    icon: ClipboardList,
                  };
                  const Icon = config.icon;
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                      className="p-4 border rounded-lg hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${config.color} flex-shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className={config.color}>{config.label}</Badge>
                            <span className="text-xs text-muted-foreground">
                              by <strong>{log.performedByName}</strong>
                            </span>
                          </div>
                          <p className="text-sm text-foreground">{log.details}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {log.timestamp ? format(new Date(log.timestamp), 'MMM dd, HH:mm') : ''}
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
