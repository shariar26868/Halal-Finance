import { useState } from 'react';
import { apiCall } from '../../utils/supabase';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Label } from './ui/label';
import { motion } from 'motion/react';
import { Upload, FileText, CheckCircle, User, IdCard, FileSignature, Users } from 'lucide-react';
import { toast } from 'sonner';

interface DocumentUpload {
  type: string;
  label: string;
  icon: any;
  description: string;
}

const documents: DocumentUpload[] = [
  {
    type: 'nid',
    label: 'National ID (NID)',
    icon: IdCard,
    description: 'Upload a clear photo of your National ID card',
  },
  {
    type: 'profilePhoto',
    label: 'Profile Photo',
    icon: User,
    description: 'Upload a recent passport-sized photo',
  },
  {
    type: 'signedForm',
    label: 'Signed Form (PDF)',
    icon: FileSignature,
    description: 'Upload the signed agreement form (PDF format)',
  },
  {
    type: 'nomineeNid',
    label: 'Nominee NID',
    icon: IdCard,
    description: 'Upload your nominee\'s National ID card',
  },
  {
    type: 'nomineePhoto',
    label: 'Nominee Photo',
    icon: Users,
    description: 'Upload your nominee\'s photo',
  },
];

export default function KYCUpload() {
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, { name: string; size: number }>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
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

        setUploadedDocs((prev) => ({ ...prev, [docType]: true }));
        toast.success(`${documents.find((d) => d.type === docType)?.label} uploaded successfully! ✓`);
        
        // Store file info
        setUploadedFiles((prev) => ({
          ...prev,
          [docType]: { name: file.name, size: file.size },
        }));
        
        // Clear the input
        e.target.value = '';
      };

      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error(error.message || 'Upload failed');
      e.target.value = '';
    } finally {
      setUploading(null);
    }
  };

  const allUploaded = documents.every((doc) => uploadedDocs[doc.type]);

  const handleSubmitForApproval = async () => {
    setSubmitting(true);
    try {
      await apiCall('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ kycStatus: 'submitted' }),
      });
      toast.success('KYC submitted for admin review! You will be notified once approved.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit KYC');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
            KYC Document Upload
          </h1>
          <p className="text-muted-foreground">
            Complete your KYC verification by uploading the required documents
          </p>
        </motion.div>

        {allUploaded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-primary/10 border-2 border-primary/20 rounded-lg flex items-center gap-3"
          >
            <CheckCircle className="w-6 h-6 text-primary flex-shrink-0" />
            <div>
              <p className="font-semibold text-primary">All documents uploaded!</p>
              <p className="text-sm text-muted-foreground">Your KYC is pending admin review</p>
            </div>
          </motion.div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {documents.map((doc, index) => {
            const Icon = doc.icon;
            const isUploaded = uploadedDocs[doc.type];
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
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{doc.label}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{doc.description}</p>
                      </div>
                    </div>
                    {isUploaded && <CheckCircle className="w-5 h-5 text-primary" />}
                  </div>

                  <div>
                    <Label
                      htmlFor={`upload-${doc.type}`}
                      className="cursor-pointer block"
                    >
                      <div
                        className={`
                          border-2 border-dashed rounded-lg p-4 text-center transition-all
                          ${isUploaded ? 'border-primary/30 bg-primary/5' : 'border-border hover:border-primary/50'}
                          ${isUploading ? 'opacity-50' : ''}
                        `}
                      >
                        {isUploaded && uploadedFiles[doc.type] ? (
                          <>
                            <CheckCircle className="w-6 h-6 mx-auto mb-2 text-primary" />
                            <p className="text-sm font-medium text-primary">
                              {uploadedFiles[doc.type].name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {(uploadedFiles[doc.type].size / 1024 / 1024).toFixed(2)} MB
                            </p>
                            <p className="text-xs text-primary mt-2">Click to replace</p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm font-medium">
                              {isUploading ? 'Uploading...' : 'Click to upload'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {doc.type === 'signedForm' ? 'PDF up to 10MB' : 'Image up to 10MB'}
                            </p>
                          </>
                        )}
                      </div>
                    </Label>
                    <input
                      id={`upload-${doc.type}`}
                      type="file"
                      accept={doc.type === 'signedForm' ? 'application/pdf' : 'image/*'}
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, doc.type)}
                      disabled={isUploading}
                    />
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {allUploaded && (
          <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/10 border-primary/20">
            <div className="flex items-start gap-4">
              <FileText className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Ready to submit?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  All documents have been uploaded. Click the button below to submit your KYC for admin review.
                </p>
                <Button 
                  onClick={handleSubmitForApproval}
                  disabled={submitting}
                  className="gap-2"
                >
                  {submitting ? 'Submitting...' : 'Submit for Approval'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {allUploaded && (
          <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/10 border-primary/20">
            <div className="flex items-start gap-4">
              <FileText className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg mb-2">What happens next?</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                    <span>Our admin team will review your submitted documents</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                    <span>You'll be notified once your KYC is approved (typically within 24-48 hours)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                    <span>After approval, you'll have full access to all features</span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
