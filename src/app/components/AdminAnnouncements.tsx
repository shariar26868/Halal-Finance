import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/supabase';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { motion } from 'motion/react';
import { Megaphone, Plus, Trash2, AlertCircle, Info, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: 'normal' | 'important' | 'urgent';
  createdByName: string;
  createdAt: string;
  active: boolean;
}

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    message: '',
    priority: 'normal',
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const data = await apiCall('/announcements');
      setAnnouncements(data.announcements || []);
    } catch (error: any) {
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiCall('/admin/announcements', {
        method: 'POST',
        body: JSON.stringify(newAnnouncement),
      });
      toast.success('Announcement posted! All users will see it.');
      setDialogOpen(false);
      setNewAnnouncement({ title: '', message: '', priority: 'normal' });
      fetchAnnouncements();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create announcement');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this announcement?')) return;
    try {
      await apiCall(`/admin/announcements/${id}`, { method: 'DELETE' });
      toast.success('Announcement removed');
      fetchAnnouncements();
    } catch (error: any) {
      toast.error('Failed to remove announcement');
    }
  };

  const priorityConfig = {
    normal: { label: 'Normal', color: 'bg-primary/10 text-primary', icon: Info },
    important: { label: 'Important', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
    urgent: { label: 'Urgent', color: 'bg-destructive/10 text-destructive', icon: AlertCircle },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading announcements...</p>
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
            Announcements
          </h1>
          <p className="text-muted-foreground">Post notices that appear on all user dashboards</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid md:grid-cols-3 gap-6"
        >
          <Card className="p-6">
            <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
              <Bell className="w-6 h-6 text-primary" />
            </div>
            <p className="text-3xl font-bold">{announcements.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Active Notices</p>
          </Card>
          <Card className="p-6">
            <div className="p-3 bg-yellow-100 rounded-lg w-fit mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold">{announcements.filter(a => a.priority === 'important').length}</p>
            <p className="text-sm text-muted-foreground mt-1">Important</p>
          </Card>
          <Card className="p-6">
            <div className="p-3 bg-destructive/10 rounded-lg w-fit mb-4">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-3xl font-bold">{announcements.filter(a => a.priority === 'urgent').length}</p>
            <p className="text-sm text-muted-foreground mt-1">Urgent</p>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                Active Announcements
              </h2>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    New Announcement
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Post Announcement</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreate} className="space-y-4 mt-2">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        placeholder="Announcement title..."
                        value={newAnnouncement.title}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Message</Label>
                      <textarea
                        placeholder="Write your announcement here..."
                        className="w-full border rounded-md px-3 py-2 min-h-28 bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        value={newAnnouncement.message}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={newAnnouncement.priority}
                        onValueChange={(v) => setNewAnnouncement({ ...newAnnouncement, priority: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="important">Important</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full gap-2">
                      <Megaphone className="w-4 h-4" />
                      Post to All Users
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {announcements.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No announcements yet. Post one to notify all users.</p>
                </div>
              ) : (
                announcements.map((ann, index) => {
                  const config = priorityConfig[ann.priority] || priorityConfig.normal;
                  const Icon = config.icon;
                  return (
                    <motion.div
                      key={ann.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={config.color}>
                              <Icon className="w-3 h-3 mr-1" />
                              {config.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {ann.createdAt ? format(new Date(ann.createdAt), 'MMM dd, yyyy HH:mm') : ''}
                            </span>
                          </div>
                          <h3 className="font-semibold mb-1">{ann.title}</h3>
                          <p className="text-sm text-muted-foreground">{ann.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">Posted by {ann.createdByName}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(ann.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
