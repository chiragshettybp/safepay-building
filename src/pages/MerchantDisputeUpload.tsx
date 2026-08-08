import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface FilePreview {
  file: File;
  preview: string;
  name: string;
  size: string;
}

export default function MerchantDisputeUpload() {
  const navigate = useNavigate();
  const { disputeId } = useParams<{ disputeId: string }>();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  
  const [orderNumber, setOrderNumber] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [description, setDescription] = useState('');
  const [evidenceType, setEvidenceType] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/merchant-login', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const fetchData = useCallback(async () => {
    if (!disputeId || !merchant?.id) return;

    try {
      const { data: disputeData, error: disputeError } = await supabase
        .from('disputes')
        .select('order_id')
        .eq('id', disputeId)
        .single();

      if (disputeError) throw disputeError;

      const { data: orderData } = await supabase
        .from('orders')
        .select('order_number, merchant_id')
        .eq('id', disputeData.order_id)
        .single();

      if ((orderData as any)?.merchant_id !== merchant.id) {
        toast.error('Access denied');
        navigate('/merchant-disputes');
        return;
      }

      setOrderNumber(orderData?.order_number || '');
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load dispute');
    } finally {
      setIsLoading(false);
    }
  }, [disputeId, merchant?.id, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: FilePreview[] = [];
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }

      newFiles.push({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
        name: file.name,
        size: formatFileSize(file.size),
      });
    }

    setFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const updated = [...prev];
      if (updated[index].preview) {
        URL.revokeObjectURL(updated[index].preview);
      }
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Select at least one file');
      return;
    }

    if (!evidenceType) {
      toast.error('Select evidence type');
      return;
    }

    if (!disputeId || !merchant) return;

    setIsUploading(true);

    try {
      for (const filePreview of files) {
        const fileExt = filePreview.file.name.split('.').pop();
        const fileName = `${disputeId}/${merchant.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('dispute-files')
          .upload(fileName, filePreview.file);

        if (uploadError) throw new Error(`Failed to upload ${filePreview.name}`);

        const { data: urlData } = supabase.storage
          .from('dispute-files')
          .getPublicUrl(fileName);

        const { error: insertError } = await supabase
          .from('dispute_files')
          .insert({
            dispute_id: disputeId,
            file_name: `${evidenceType}: ${filePreview.name}`,
            file_url: urlData.publicUrl,
            file_type: filePreview.file.type,
            file_size: filePreview.file.size,
            upload_status: 'completed',
          });

        if (insertError) throw insertError;
      }

      await supabase.from('dispute_updates').insert({
        dispute_id: disputeId,
        title: 'Evidence Uploaded',
        description: description || `${files.length} file(s) uploaded as ${evidenceType}`,
        update_type: 'evidence',
        actor_type: 'merchant',
      });

      await supabase.from('disputes').update({
        merchant_not_responded: false,
        updated_at: new Date().toISOString(),
      }).eq('id', disputeId);

      toast.success('Evidence uploaded');
      navigate(`/merchant-dispute-response/${disputeId}`);

    } catch (error) {
      console.error('Error uploading:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload');
    } finally {
      setIsUploading(false);
    }
  };

  if (authLoading || !isAuthenticated || !merchant) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border safe-top">
          <div className="flex items-center h-14 px-4 gap-2">
            <button onClick={() => navigate('/merchant-disputes')} className="p-2 -ml-2 hover:bg-muted rounded-full">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <Skeleton className="h-5 w-28" />
          </div>
        </header>
        <div className="p-4 space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border safe-top">
        <div className="flex items-center h-14 px-4">
          <button onClick={() => navigate(`/merchant-dispute-response/${disputeId}`)} className="p-2 -ml-2 hover:bg-muted rounded-full touch-target">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <h1 className="text-lg font-semibold text-foreground ml-2">Upload Evidence</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
          {/* Dispute Info */}
          <div className="bg-muted/30 rounded-xl p-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-destructive/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-destructive text-lg">gavel</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Dispute #{disputeId?.slice(0, 8)}</p>
                <p className="text-xs text-muted-foreground">Order #{orderNumber}</p>
              </div>
            </div>
          </div>

          {/* Upload Area */}
          <div className="space-y-1.5">
            <Label className="text-sm">Upload Files *</Label>
            <label className="block w-full border-2 border-dashed border-border rounded-xl p-6 text-center active:border-primary">
              <Input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <span className="material-symbols-outlined text-3xl text-muted-foreground mb-1.5">cloud_upload</span>
              <p className="text-sm font-medium text-foreground">Tap to upload</p>
              <p className="text-xs text-muted-foreground mt-0.5">Images, PDFs, Documents (max 10MB)</p>
            </label>
          </div>

          {/* File Previews */}
          {files.length > 0 && (
            <div className="space-y-1.5">
              {files.map((file, index) => (
                <div key={index} className="flex items-center gap-2.5 p-2.5 bg-muted/30 rounded-lg">
                  {file.preview ? (
                    <img src={file.preview} alt={file.name} className="w-10 h-10 object-cover rounded" />
                  ) : (
                    <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                      <span className="material-symbols-outlined text-muted-foreground text-lg">description</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{file.size}</p>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1.5 hover:bg-destructive/10 rounded-full text-destructive"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Evidence Type */}
          <div className="space-y-1.5">
            <Label className="text-sm">Evidence Type *</Label>
            <Select value={evidenceType} onValueChange={setEvidenceType}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tracking_screenshot">Tracking Screenshot</SelectItem>
                <SelectItem value="delivery_proof">Delivery Proof</SelectItem>
                <SelectItem value="invoice">Invoice / Receipt</SelectItem>
                <SelectItem value="chat_log">Chat / Communication</SelectItem>
                <SelectItem value="product_photo">Product Photo</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-sm">Description (Optional)</Label>
            <Textarea
              placeholder="Explain why this evidence is relevant..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>
      </main>

      {/* Bottom Action */}
      <div className="sticky bottom-0 bg-background border-t border-border p-4 safe-bottom">
        <div className="flex gap-3 max-w-lg mx-auto">
          <Button
            variant="outline"
            onClick={() => navigate(`/merchant-dispute-response/${disputeId}`)}
            className="flex-1 h-11"
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={files.length === 0 || !evidenceType || isUploading}
            className="flex-1 h-11"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm mr-1.5">upload</span>
                Upload
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
