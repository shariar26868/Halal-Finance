import { useState, useEffect, useRef } from 'react';
import { apiCall } from '../../utils/supabase';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { motion } from 'motion/react';
import {
  MapPin, Plus, Link, Video, Phone, DollarSign,
  FileText, CheckCircle, Clock, XCircle, Upload, Play, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';

interface Plot {
  id: string;
  userId: string;
  userName: string;
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

export default function PlotInformation() {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [myPlots, setMyPlots] = useState<Plot[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    area: '',
    price: '',
    contactNumber: '',
    link: '',
  });

  useEffect(() => {
    fetchPlots();
  }, []);

  const fetchPlots = async () => {
    try {
      const data = await apiCall('/plots');
      setPlots(data.plots || []);
    } catch (error: any) {
      toast.error('Failed to load plots');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) { toast.error('Please upload a video file'); return; }
    if (file.size > 50 * 1024 * 1024) { toast.error('Video must be less than 50MB'); return; }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let videoData = null;
      let videoFileName = null;
      let videoFileType = null;

      if (videoFile) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result?.toString().split(',')[1] || '');
          reader.readAsDataURL(videoFile);
        });
        videoData = base64;
        videoFileName = videoFile.name;
        videoFileType = videoFile.type;
      }

      await apiCall('/plots/submit', {
        method: 'POST',
        body: JSON.stringify({ ...form, videoData, videoFileName, videoFileType }),
      });

      toast.success('Plot information submitted! Admin will review it shortly.');
      setDialogOpen(false);
      setForm({ title: '', description: '', location: '', area: '', price: '', contactNumber: '', link: '' });
      setVideoFile(null);
      setVideoPreview(null);
      fetchPlots();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
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
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
              Plot Information
            </h1>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Share Plot Info
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Share Plot Information</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      placeholder="e.g. 5 Katha Plot in Mirpur"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description *</Label>
                    <textarea
                      placeholder="Describe the plot — size, features, road access, etc."
                      className="w-full border rounded-md px-3 py-2 min-h-24 bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Location *</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="e.g. Mirpur-12, Dhaka"
                        className="pl-10"
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Area</Label>
                      <Input
                        placeholder="e.g. 5 Katha"
                        value={form.area}
                        onChange={(e) => setForm({ ...form, area: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Price</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="e.g. ৳50 Lakh"
                          className="pl-10"
                          value={form.price}
                          onChange={(e) => setForm({ ...form, price: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Contact Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="01XXXXXXXXX"
                        className="pl-10"
                        value={form.contactNumber}
                        onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>External Link</Label>
                    <div className="relative">
                      <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="https://... (Bikroy, Facebook, etc.)"
                        className="pl-10"
                        value={form.link}
                        onChange={(e) => setForm({ ...form, link: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Video <span className="text-muted-foreground text-xs">(optional, max 50MB)</span></Label>
                    <div
                      className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => videoInputRef.current?.click()}
                    >
                      {videoPreview ? (
                        <div className="space-y-2">
                          <video src={videoPreview} className="max-h-32 mx-auto rounded" controls />
                          <p className="text-xs text-primary">{videoFile?.name}</p>
                          <p className="text-xs text-muted-foreground">Click to replace</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Video className="w-6 h-6 mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Upload plot video</p>
                          <p className="text-xs text-muted-foreground">MP4, MOV up to 50MB</p>
                        </div>
                      )}
                    </div>
                    <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoChange} />
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit for Review'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <p className="text-muted-foreground">Browse and share plot information with the community</p>
        </motion.div>

        {/* Approved plots */}
        {plots.length === 0 ? (
          <Card className="p-12 text-center">
            <MapPin className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No plot information posted yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Be the first to share a plot!</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {plots.map((plot, index) => (
              <motion.div
                key={plot.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card className="p-6 hover:border-primary/40 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{plot.title}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin className="w-3 h-3" />
                        {plot.location}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {plot.price && <p className="text-lg font-bold text-primary">{plot.price}</p>}
                      {plot.area && <p className="text-xs text-muted-foreground">{plot.area}</p>}
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{plot.description}</p>

                  <div className="flex flex-wrap items-center gap-3">
                    {plot.contactNumber && (
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="w-3 h-3 text-primary" />
                        <span>{plot.contactNumber}</span>
                      </div>
                    )}
                    {plot.link && (
                      <a href={plot.link} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1 text-xs">
                          <ExternalLink className="w-3 h-3" />
                          View Listing
                        </Button>
                      </a>
                    )}
                    {plot.videoPath && (
                      <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handlePlayVideo(plot.id)}>
                        <Play className="w-3 h-3" />
                        Watch Video
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      By {plot.userName} · {plot.createdAt ? format(new Date(plot.createdAt), 'MMM dd, yyyy') : ''}
                    </span>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Video Player Dialog */}
      <Dialog open={!!playingVideo} onOpenChange={() => setPlayingVideo(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Plot Video
            </DialogTitle>
          </DialogHeader>
          {playingVideo && (
            <video src={playingVideo} controls className="w-full rounded-lg max-h-[60vh]" autoPlay />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
