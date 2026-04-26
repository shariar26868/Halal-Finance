import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/supabase';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { motion } from 'motion/react';
import {
  MapPin, CheckCircle, XCircle, Clock, Search,
  Phone, ExternalLink, Play, Trash2, Video, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface Plot {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  title: string;
  description: string;
  location: string;
  area: string;
  price: string;
  contactNumber: string;
  link: string;
  videoPath?: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  createdAt: string;
}

export default function AdminPlots() {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectingPlot, setRejectingPlot] = useState<Plot | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPlots();
  }, []);

  const fetchPlots = async () => {
    try {
      const data = await apiCall('/admin/plots');
      setPlots(data.plots || []);
    } catch (error: any) {
      toast.error('Failed to load plots');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (plot: Plot) => {
    setActionLoading(true);
    try {
      await apiCall(`/admin/plots/${encodeURIComponent(plot.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'approved' }),
      });
      toast.success('Plot approved — now visible to all users');
      fetchPlots();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingPlot) return;
    setActionLoading(true);
    try {
      await apiCall(`/admin/plots/${encodeURIComponent(rejectingPlot.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'rejected', adminNote: rejectNote }),
      });
      toast.success('Plot rejected');
      setRejectingPlot(null);
      setRejectNote('');
      fetchPlots();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (plotId: string) => {
    if (!confirm('Delete this plot permanently?')) return;
    try {
      await apiCall(`/admin/plots/${encodeURIComponent(plotId)}`, { method: 'DELETE' });
      toast.success('Plot deleted');
      fetchPlots();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handlePlayVideo = async (plotId: string) => {
    try {
      const data = await apiCall(`/plots/video/${encodeURIComponent(plotId)}`);
      setPlayingVideo(data.url);
    } catch {
      toast.error('Failed to load video');
    }
  };

  const filtered = plots.filter(
    (p) =>
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.location?.toLowerCase().includes(search.toLowerCase()) ||
      p.userName?.toLowerCase().includes(search.toLowerCase())
  );

  const pending = filtered.filter((p) => p.status === 'pending');
  const approved = filtered.filter((p) => p.status === 'approved');
  const rejected = filtered.filter((p) => p.status === 'rejected');

  const PlotCard = ({ plot, showActions }: { plot: Plot; showActions: boolean }) => (
    <motion.div
      key={plot.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-4 border rounded-lg hover:border-primary/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-foreground">{plot.title}</h3>
            {plot.price && <span className="text-primary font-bold text-sm">{plot.price}</span>}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <MapPin className="w-3 h-3" />
            {plot.location}
            {plot.area && <span>· {plot.area}</span>}
          </div>
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{plot.description}</p>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground">By <strong>{plot.userName}</strong> ({plot.userEmail})</span>
            {plot.contactNumber && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" /> {plot.contactNumber}
              </span>
            )}
            {plot.link && (
              <a href={plot.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                <ExternalLink className="w-3 h-3" /> View Link
              </a>
            )}
            {plot.videoPath && (
              <Button size="sm" variant="outline" className="h-6 text-xs gap-1 px-2" onClick={() => handlePlayVideo(plot.id)}>
                <Play className="w-3 h-3" /> Video
              </Button>
            )}
            <span className="text-muted-foreground ml-auto">
              {plot.createdAt ? format(new Date(plot.createdAt), 'MMM dd, yyyy') : ''}
            </span>
          </div>

          {plot.adminNote && (
            <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
              <strong>Note:</strong> {plot.adminNote}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0">
          {showActions && (
            <>
              <Button size="sm" className="gap-1" onClick={() => handleApprove(plot)} disabled={actionLoading}>
                <CheckCircle className="w-3 h-3" /> Approve
              </Button>
              <Button size="sm" variant="destructive" className="gap-1" onClick={() => setRejectingPlot(plot)} disabled={actionLoading}>
                <XCircle className="w-3 h-3" /> Reject
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive" onClick={() => handleDelete(plot.id)}>
            <Trash2 className="w-3 h-3" /> Delete
          </Button>
        </div>
      </div>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading plots...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
            Plot Information
          </h1>
          <p className="text-muted-foreground">Review and approve user-submitted plot listings</p>
        </motion.div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-800 rounded-lg w-fit mb-3">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">{pending.length}</p>
            <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-1">Pending Review</p>
          </Card>
          <Card className="p-6 border-primary/20 bg-primary/5">
            <div className="p-3 bg-primary/10 rounded-lg w-fit mb-3">
              <CheckCircle className="w-6 h-6 text-primary" />
            </div>
            <p className="text-3xl font-bold text-primary">{approved.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Approved</p>
          </Card>
          <Card className="p-6 border-destructive/20 bg-destructive/5">
            <div className="p-3 bg-destructive/10 rounded-lg w-fit mb-3">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-3xl font-bold text-destructive">{rejected.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Rejected</p>
          </Card>
        </div>

        <Card className="p-6">
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, location, or user..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Pending */}
          {pending.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
                <Clock className="w-5 h-5 text-yellow-600" />
                Pending Review ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((plot) => <PlotCard key={plot.id} plot={plot} showActions={true} />)}
              </div>
            </div>
          )}

          {/* Approved */}
          {approved.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
                <CheckCircle className="w-5 h-5 text-primary" />
                Approved ({approved.length})
              </h2>
              <div className="space-y-3">
                {approved.map((plot) => <PlotCard key={plot.id} plot={plot} showActions={false} />)}
              </div>
            </div>
          )}

          {/* Rejected */}
          {rejected.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
                <XCircle className="w-5 h-5 text-destructive" />
                Rejected ({rejected.length})
              </h2>
              <div className="space-y-3">
                {rejected.map((plot) => <PlotCard key={plot.id} plot={plot} showActions={false} />)}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No plot submissions found</p>
            </div>
          )}
        </Card>
      </div>

      {/* Video Player */}
      <Dialog open={!!playingVideo} onOpenChange={() => setPlayingVideo(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" /> Plot Video
            </DialogTitle>
          </DialogHeader>
          {playingVideo && (
            <video src={playingVideo} controls className="w-full rounded-lg max-h-[60vh]" autoPlay />
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectingPlot} onOpenChange={() => { setRejectingPlot(null); setRejectNote(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Plot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Rejecting: <strong>{rejectingPlot?.title}</strong>
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason (optional)</label>
              <textarea
                placeholder="Explain why this post is being rejected..."
                className="w-full border rounded-md px-3 py-2 min-h-20 bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setRejectingPlot(null); setRejectNote(''); }}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleReject} disabled={actionLoading}>
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
