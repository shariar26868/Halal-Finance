import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiCall } from '../../utils/supabase';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { motion } from 'motion/react';
import { FileText, Eye, Upload, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface KYCDocument {
  type: string;
  label: string;
  filePath?: string;
}

const documentTypes: KYCDocument[] = [
  { type: 'nid', label: 'National ID (NID)' },
  { type: 'profilePhoto', label: 'Profile Photo' },
  { type: 'signedForm', label: 'Signed Form (PDF)' },
  { type: 'nomineeNid', label: 'Nominee NID' },
  { type: 'nomineePhoto', label: 'Nominee Photo' },
];

export default function KYCDocuments() {
  const { user, refreshUser } = useAuth();
  const [documents, setDocuments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [confirmReplaceDoc, setConfirmReplaceDoc] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      // Get user profile to see their documents
      const data = await apiCall('/user/profile');
      setDocuments(data.profile?.kycDocuments || {});
    } catch (error: any) {
      console.error('Failed to load documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = async (docType: string) => {
    try {
      const data = await apiCall(`/user/kyc/document/${user?.id}/${docType}`);
      setDocumentUrl(data.url);
      setSelectedDoc(docType);
    } catch (error: any) {
      toast.error('Failed to load document');
    }
  };

  const handleReplaceDocument = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (docType === 'signedForm' && file.type !== 'application/pdf') {
      toast.error('Signed form must be a PDF file');
      return;
    }

    if (docType !== 'signedForm' && !file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    // Show confirmation dialog before replacing
    setPendingFile(file);
    setConfirmReplaceDoc(docType);
    e.target.value = '';
  };

  const confirmAndUpload = async () => {
    if (!pendingFile || !confirmReplaceDoc) return;
    const docType = confirmReplaceDoc;
    const file = pendingFile;

    setConfirmReplaceDoc(null);
    setPendingFile(null);
    setUploading(docType);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result?.toString().split(',')[1];

        await apiCall('/user/kyc/upload', {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.name,
            fileData: base64Data,
            fileType: file.type,
            documentType: docType,
          }),
        });

        toast.success(`${documentTypes.find(d => d.type === docType)?.label} updated. KYC sent for re-approval.`);
        fetchDocuments();
        // Refresh user so kycStatus updates in sidebar/app
        await refreshUser();
      };

      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error(error.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <FileText className="w-12 h-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading your documents...</p>
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
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
              Your KYC Documents
            </h1>
          </div>
          <p className="text-muted-foreground">View and manage your verified KYC documents</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid md:grid-cols-2 gap-6"
        >
          {documentTypes.map((doc, index) => {
            const isUploaded = !!documents[doc.type];
            const isUploading = uploading === doc.type;

            return (
              <motion.div
                key={doc.type}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card
                  className={`p-6 transition-all ${
                    isUploaded ? 'border-2 border-primary/30 bg-primary/5' : 'hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-3 rounded-lg ${
                          isUploaded ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{doc.label}</h3>
                        {isUploaded && <p className="text-xs text-primary">✓ Uploaded</p>}
                      </div>
                    </div>
                    {isUploaded && <CheckCircle className="w-5 h-5 text-primary" />}
                  </div>

                  {isUploaded && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-2"
                          onClick={() => handleViewDocument(doc.type)}
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                        <label className="flex-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full gap-2"
                            asChild
                            disabled={isUploading}
                          >
                            <span>
                              <Upload className="w-4 h-4" />
                              {isUploading ? 'Uploading...' : 'Replace'}
                            </span>
                          </Button>
                          <input
                            type="file"
                            accept={doc.type === 'signedForm' ? 'application/pdf' : 'image/*'}
                            className="hidden"
                            onChange={(e) => handleReplaceDocument(e, doc.type)}
                            disabled={isUploading}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/10 border-primary/20">
          <div className="flex items-start gap-4">
            <CheckCircle className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-lg mb-2">KYC Approved ✓</h3>
              <p className="text-sm text-muted-foreground">
                Your KYC has been approved! You can view your documents above. If you replace any document, your KYC will be sent for re-approval by admin.
              </p>
            </div>
          </div>
        </Card>

        {/* Warning about re-approval */}
        <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            <strong>Note:</strong> Replacing any document will reset your KYC status and require admin re-approval before you regain full access.
          </p>
        </div>
      </div>

      {/* Confirm Replace Dialog */}
      <Dialog open={!!confirmReplaceDoc} onOpenChange={() => { setConfirmReplaceDoc(null); setPendingFile(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              Replace Document?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Replacing <strong>{documentTypes.find(d => d.type === confirmReplaceDoc)?.label}</strong> will reset your KYC status to <strong>pending re-approval</strong>. Admin will need to review and approve your documents again.
            </p>
            <p className="text-sm text-muted-foreground">Are you sure you want to continue?</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setConfirmReplaceDoc(null); setPendingFile(null); }}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={confirmAndUpload}>
                Yes, Replace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Viewer Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {documentTypes.find(d => d.type === selectedDoc)?.label}
            </DialogTitle>
          </DialogHeader>
          {documentUrl && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <iframe
                src={documentUrl}
                className="w-full h-96 rounded"
                title="KYC Document"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
