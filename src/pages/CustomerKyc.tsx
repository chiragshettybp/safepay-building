import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface KycFormData {
  full_legal_name: string;
  date_of_birth: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  id_type: string;
  id_number: string;
}

interface KycRecord {
  id: string;
  status: string;
  kyc_level: string;
  full_legal_name: string | null;
  date_of_birth: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  id_type: string | null;
  id_number: string | null;
  id_front_url: string | null;
  id_back_url: string | null;
  selfie_url: string | null;
  address_proof_url: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
}

type DocumentType = 'id_front' | 'id_back' | 'selfie' | 'address_proof';

export default function CustomerKyc() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [kycRecord, setKycRecord] = useState<KycRecord | null>(null);
  const [formData, setFormData] = useState<KycFormData>({
    full_legal_name: '',
    date_of_birth: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    id_type: 'aadhaar',
    id_number: '',
  });
  const [documents, setDocuments] = useState<{
    id_front: File | null;
    id_back: File | null;
    selfie: File | null;
    address_proof: File | null;
  }>({
    id_front: null,
    id_back: null,
    selfie: null,
    address_proof: null,
  });
  const [documentUrls, setDocumentUrls] = useState<{
    id_front_url: string | null;
    id_back_url: string | null;
    selfie_url: string | null;
    address_proof_url: string | null;
  }>({
    id_front_url: null,
    id_back_url: null,
    selfie_url: null,
    address_proof_url: null,
  });
  const [uploadingDoc, setUploadingDoc] = useState<DocumentType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRefs = {
    id_front: useRef<HTMLInputElement>(null),
    id_back: useRef<HTMLInputElement>(null),
    selfie: useRef<HTMLInputElement>(null),
    address_proof: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/customer-login');
    } else if (user) {
      fetchKycRecord();
      setupRealtimeSubscription();
    }
  }, [user, authLoading, navigate]);

  const fetchKycRecord = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('kyc_records')
      .select('*')
      .eq('customer_id', user.id)
      .maybeSingle();

    if (data) {
      setKycRecord(data);
      setFormData({
        full_legal_name: data.full_legal_name || '',
        date_of_birth: data.date_of_birth || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        pincode: data.pincode || '',
        country: data.country || 'India',
        id_type: data.id_type || 'aadhaar',
        id_number: data.id_number || '',
      });
      setDocumentUrls({
        id_front_url: data.id_front_url,
        id_back_url: data.id_back_url,
        selfie_url: data.selfie_url,
        address_proof_url: data.address_proof_url,
      });
    }
    setIsLoading(false);
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('kyc-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kyc_records',
          filter: `customer_id=eq.${user?.id}`
        },
        () => {
          fetchKycRecord();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleDocumentUpload = async (docType: DocumentType, file: File) => {
    if (!user?.id) return;

    // Validate file
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image or PDF file.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload a file smaller than 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingDoc(docType);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${docType}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get signed URL for private bucket
      const { data: signedData } = await supabase.storage
        .from('kyc-documents')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

      const url = signedData?.signedUrl || fileName;

      // Update or create KYC record
      const updateData: Record<string, unknown> = {
        [`${docType}_url`]: url,
        status: kycRecord?.status === 'not_started' ? 'incomplete' : kycRecord?.status || 'incomplete',
      };

      if (kycRecord) {
        await supabase
          .from('kyc_records')
          .update(updateData)
          .eq('id', kycRecord.id);
      } else {
        const { data: newRecord } = await supabase
          .from('kyc_records')
          .insert({
            customer_id: user.id,
            [`${docType}_url`]: url,
            status: 'incomplete',
          })
          .select()
          .single();
        
        if (newRecord) setKycRecord(newRecord);
      }

      setDocumentUrls(prev => ({ ...prev, [`${docType}_url`]: url }));
      setDocuments(prev => ({ ...prev, [docType]: file }));

      toast({
        title: 'Document uploaded!',
        description: 'Your document has been saved.',
      });
    } catch (err) {
      console.error('Upload error:', err);
      toast({
        title: 'Upload failed',
        description: 'Could not upload document. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) return;

    // Validate required fields
    if (!formData.full_legal_name || !formData.date_of_birth || !formData.id_number) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    // Validate required documents
    if (!documentUrls.id_front_url || !documentUrls.id_back_url) {
      toast({
        title: 'Missing documents',
        description: 'Please upload both front and back of your ID.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const kycData = {
        customer_id: user.id,
        ...formData,
        ...documentUrls,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      };

      if (kycRecord) {
        const { error } = await supabase
          .from('kyc_records')
          .update(kycData)
          .eq('id', kycRecord.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('kyc_records')
          .insert(kycData);

        if (error) throw error;
      }

      toast({
        title: 'KYC Submitted!',
        description: 'Your verification request is under review.',
      });
      
      navigate('/profile');
    } catch (err) {
      console.error('Submit error:', err);
      toast({
        title: 'Submission failed',
        description: 'Could not submit KYC. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeDocument = (docType: DocumentType) => {
    setDocuments(prev => ({ ...prev, [docType]: null }));
    setDocumentUrls(prev => ({ ...prev, [`${docType}_url`]: null }));
  };

  const getStatusBanner = () => {
    if (!kycRecord) return null;

    switch (kycRecord.status) {
      case 'submitted':
      case 'pending_review':
        return (
          <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-warning text-xl mt-0.5">hourglass_empty</span>
              <div>
                <h3 className="font-semibold text-warning">Under Review</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your KYC verification is being reviewed. This usually takes 1-2 business days.
                </p>
                {kycRecord.submitted_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Submitted on {format(new Date(kycRecord.submitted_at), 'MMM d, yyyy h:mm a')}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      case 'approved':
        return (
          <div className="bg-success/10 border border-success/20 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-success text-xl mt-0.5">verified</span>
              <div>
                <h3 className="font-semibold text-success">Verified</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your KYC verification has been approved. You now have full access.
                </p>
                {kycRecord.verified_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Verified on {format(new Date(kycRecord.verified_at), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      case 'rejected':
        return (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-destructive text-xl mt-0.5">cancel</span>
              <div>
                <h3 className="font-semibold text-destructive">Rejected</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {kycRecord.rejection_reason || 'Your KYC verification was rejected. Please resubmit with correct documents.'}
                </p>
                {kycRecord.rejected_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Rejected on {format(new Date(kycRecord.rejected_at), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const isReadOnly = kycRecord?.status === 'submitted' || kycRecord?.status === 'pending_review' || kycRecord?.status === 'approved';
  const canSubmit = formData.full_legal_name && formData.date_of_birth && formData.id_number && documentUrls.id_front_url && documentUrls.id_back_url;

  if (authLoading || isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background max-w-[100vw] overflow-x-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => navigate('/profile')}
            className="text-foreground flex w-10 h-10 shrink-0 items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <span className="material-symbols-outlined text-xl sm:text-2xl">arrow_back</span>
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-foreground">KYC Verification</h1>
          <div className="w-10"></div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-28">
        {/* Status Banner */}
        {getStatusBanner()}

        {/* KYC Level Indicator */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">shield</span>
              Verification Status
            </h3>
            <span className={`text-xs px-2 py-1 rounded-full ${
              kycRecord?.kyc_level === 'verified' ? 'bg-success/10 text-success' :
              kycRecord?.kyc_level === 'basic' ? 'bg-warning/10 text-warning' :
              'bg-muted text-muted-foreground'
            }`}>
              {kycRecord?.kyc_level === 'verified' ? 'Full Verified' :
               kycRecord?.kyc_level === 'basic' ? 'Basic' : 'None'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Complete your KYC verification to unlock full platform features including higher withdrawal limits and priority support.
          </p>
        </div>

        {/* Personal Information */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">person</span>
            Personal Information
          </h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="full_legal_name" className="text-sm font-medium">
                Full Legal Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="full_legal_name"
                placeholder="As per government ID"
                value={formData.full_legal_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_legal_name: e.target.value }))}
                disabled={isReadOnly}
                className="mt-1.5 h-12 rounded-xl"
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="date_of_birth" className="text-sm font-medium">
                Date of Birth <span className="text-destructive">*</span>
              </Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                disabled={isReadOnly}
                className="mt-1.5 h-12 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="address" className="text-sm font-medium">Address</Label>
              <Input
                id="address"
                placeholder="Street address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                disabled={isReadOnly}
                className="mt-1.5 h-12 rounded-xl"
                maxLength={200}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="city" className="text-sm font-medium">City</Label>
                <Input
                  id="city"
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  disabled={isReadOnly}
                  className="mt-1.5 h-12 rounded-xl"
                  maxLength={100}
                />
              </div>
              <div>
                <Label htmlFor="state" className="text-sm font-medium">State</Label>
                <Input
                  id="state"
                  placeholder="State"
                  value={formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                  disabled={isReadOnly}
                  className="mt-1.5 h-12 rounded-xl"
                  maxLength={100}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pincode" className="text-sm font-medium">Pincode</Label>
                <Input
                  id="pincode"
                  placeholder="Pincode"
                  value={formData.pincode}
                  onChange={(e) => setFormData(prev => ({ ...prev, pincode: e.target.value }))}
                  disabled={isReadOnly}
                  className="mt-1.5 h-12 rounded-xl"
                  maxLength={10}
                />
              </div>
              <div>
                <Label htmlFor="country" className="text-sm font-medium">Country</Label>
                <Input
                  id="country"
                  placeholder="Country"
                  value={formData.country}
                  onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                  disabled={isReadOnly}
                  className="mt-1.5 h-12 rounded-xl"
                  maxLength={100}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ID Information */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">badge</span>
            Identity Document
          </h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="id_type" className="text-sm font-medium">
                ID Type <span className="text-destructive">*</span>
              </Label>
              <select
                id="id_type"
                value={formData.id_type}
                onChange={(e) => setFormData(prev => ({ ...prev, id_type: e.target.value }))}
                disabled={isReadOnly}
                className="mt-1.5 w-full h-12 rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="aadhaar">Aadhaar Card</option>
                <option value="pan">PAN Card</option>
                <option value="passport">Passport</option>
                <option value="driving_license">Driving License</option>
                <option value="voter_id">Voter ID</option>
              </select>
            </div>
            <div>
              <Label htmlFor="id_number" className="text-sm font-medium">
                ID Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="id_number"
                placeholder="Enter ID number"
                value={formData.id_number}
                onChange={(e) => setFormData(prev => ({ ...prev, id_number: e.target.value }))}
                disabled={isReadOnly}
                className="mt-1.5 h-12 rounded-xl"
                maxLength={50}
              />
            </div>
          </div>
        </div>

        {/* Document Uploads */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">upload_file</span>
            Document Upload
          </h3>
          <div className="space-y-4">
            {/* ID Front */}
            <DocumentUploadBox
              label="ID Front"
              required
              docType="id_front"
              file={documents.id_front}
              url={documentUrls.id_front_url}
              isUploading={uploadingDoc === 'id_front'}
              isReadOnly={isReadOnly}
              onUpload={(e) => e.target.files?.[0] && handleDocumentUpload('id_front', e.target.files[0])}
              onRemove={() => removeDocument('id_front')}
              inputRef={fileInputRefs.id_front}
            />

            {/* ID Back */}
            <DocumentUploadBox
              label="ID Back"
              required
              docType="id_back"
              file={documents.id_back}
              url={documentUrls.id_back_url}
              isUploading={uploadingDoc === 'id_back'}
              isReadOnly={isReadOnly}
              onUpload={(e) => e.target.files?.[0] && handleDocumentUpload('id_back', e.target.files[0])}
              onRemove={() => removeDocument('id_back')}
              inputRef={fileInputRefs.id_back}
            />

            {/* Selfie (Optional) */}
            <DocumentUploadBox
              label="Selfie with ID"
              docType="selfie"
              file={documents.selfie}
              url={documentUrls.selfie_url}
              isUploading={uploadingDoc === 'selfie'}
              isReadOnly={isReadOnly}
              onUpload={(e) => e.target.files?.[0] && handleDocumentUpload('selfie', e.target.files[0])}
              onRemove={() => removeDocument('selfie')}
              inputRef={fileInputRefs.selfie}
            />

            {/* Address Proof (Optional) */}
            <DocumentUploadBox
              label="Address Proof"
              docType="address_proof"
              file={documents.address_proof}
              url={documentUrls.address_proof_url}
              isUploading={uploadingDoc === 'address_proof'}
              isReadOnly={isReadOnly}
              onUpload={(e) => e.target.files?.[0] && handleDocumentUpload('address_proof', e.target.files[0])}
              onRemove={() => removeDocument('address_proof')}
              inputRef={fileInputRefs.address_proof}
            />
          </div>
        </div>
      </main>

      {/* Sticky Submit Button */}
      {!isReadOnly && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
          <div className="max-w-2xl mx-auto">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="w-full h-12 sm:h-14 rounded-xl text-base font-semibold"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground"></span>
                  Submitting...
                </span>
              ) : (
                'Submit KYC'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Material Icons */}
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
    </div>
  );
}

interface DocumentUploadBoxProps {
  label: string;
  required?: boolean;
  docType: DocumentType;
  file: File | null;
  url: string | null;
  isUploading: boolean;
  isReadOnly: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}

function DocumentUploadBox({
  label,
  required,
  file,
  url,
  isUploading,
  isReadOnly,
  onUpload,
  onRemove,
  inputRef,
}: DocumentUploadBoxProps) {
  const hasDocument = file || url;

  return (
    <div>
      <Label className="text-sm font-medium mb-2 block">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      
      {hasDocument ? (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl border border-border">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary">description</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {file?.name || 'Document uploaded'}
            </p>
            <p className="text-xs text-muted-foreground">
              {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Saved'}
            </p>
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={onRemove}
              className="w-8 h-8 rounded-full hover:bg-destructive/10 flex items-center justify-center transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-destructive text-lg">close</span>
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isReadOnly || isUploading}
          className="w-full p-6 border-2 border-dashed border-border rounded-xl hover:border-primary/50 hover:bg-muted/30 transition-colors text-center disabled:opacity-50"
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="text-sm text-muted-foreground">Uploading...</span>
            </div>
          ) : (
            <>
              <span className="material-symbols-outlined text-muted-foreground text-3xl mb-2">cloud_upload</span>
              <p className="text-sm text-muted-foreground">
                Tap to upload or drag & drop
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG or PDF up to 10MB
              </p>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={onUpload}
        className="hidden"
      />
    </div>
  );
}
