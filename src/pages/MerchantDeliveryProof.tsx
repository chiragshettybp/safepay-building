import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CheckCircle2, CloudUpload, FileText, UploadCloud, Video, X } from 'lucide-react';
import { FullPageLoading, LoadingSpinner, ButtonSpinner } from '@/components/shared/LoadingSpinner';

interface UploadedFile {
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
}

export default function MerchantDeliveryProof() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderPublicId, setOrderPublicId] = useState('');
  const [existingProof, setExistingProof] = useState<string[] | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/merchant-login', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (merchant && merchant.verificationStatus !== 'approved') {
      navigate('/merchant-verify', { replace: true });
    }
  }, [merchant, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!orderId || !merchant?.id) return;

      try {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('order_number, public_order_id, merchant_id')
          .eq('id', orderId)
          .eq('merchant_id', merchant.id)
          .single();

        if (orderError || !orderData) {
          toast.error('Order not found');
          navigate('/merchant-orders');
          return;
        }
        
        setOrderNumber(orderData.order_number);
        setOrderPublicId(orderData.public_order_id || '');

        const { data: proofData } = await supabase
          .from('delivery_proofs')
          .select('file_urls, delivery_notes, delivery_date')
          .eq('order_id', orderId)
          .single();

        if (proofData) {
          setExistingProof(proofData.file_urls);
          setDeliveryNotes(proofData.delivery_notes || '');
          if (proofData.delivery_date) {
            setDeliveryDate(proofData.delivery_date.split('T')[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [orderId, merchant?.id]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: UploadedFile[] = Array.from(selectedFiles).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${orderId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('delivery-proofs')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('delivery-proofs')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (files.length === 0 && !existingProof) {
      toast.error('Upload at least one file');
      return;
    }

    if (!orderId || !merchant?.id) {
      toast.error('Invalid order');
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadedUrls: string[] = existingProof ? [...existingProof] : [];

      for (let i = 0; i < files.length; i++) {
        setFiles((prev) => {
          const updated = [...prev];
          updated[i].uploading = true;
          return updated;
        });

        const url = await uploadFile(files[i].file);
        
        if (url) {
          uploadedUrls.push(url);
          setFiles((prev) => {
            const updated = [...prev];
            updated[i].uploading = false;
            updated[i].uploaded = true;
            updated[i].url = url;
            return updated;
          });
        } else {
          setFiles((prev) => {
            const updated = [...prev];
            updated[i].uploading = false;
            return updated;
          });
          throw new Error(`Failed to upload ${files[i].file.name}`);
        }
      }

      if (existingProof) {
        const { error: updateError } = await supabase
          .from('delivery_proofs')
          .update({
            file_urls: uploadedUrls,
            delivery_notes: deliveryNotes.trim() || null,
            delivery_date: deliveryDate,
            updated_at: new Date().toISOString(),
          })
          .eq('order_id', orderId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('delivery_proofs').insert({
          order_id: orderId,
          merchant_id: merchant.id,
          file_urls: uploadedUrls,
          delivery_notes: deliveryNotes.trim() || null,
          delivery_date: deliveryDate,
        });

        if (insertError) throw insertError;
      }

      await supabase
        .from('orders')
        .update({ status: 'delivered', delivered_at: deliveryDate })
        .eq('id', orderId);

      await supabase.from('merchant_activity').insert({
        merchant_id: merchant.id,
        activity_type: 'delivery',
        title: 'Delivery Proof Uploaded',
        description: `Uploaded proof for order ${orderPublicId || `#${orderNumber}`}`,
        reference_id: orderId,
        reference_type: 'order',
      });

      toast.success('Proof uploaded successfully');
      navigate(`/merchant-order/${orderId}`);
    } catch (error) {
      console.error('Error uploading proof:', error);
      toast.error('Failed to upload');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !isAuthenticated || !merchant) {
    return <FullPageLoading />;
  }

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border safe-top">
          <div className="flex items-center h-14 px-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Skeleton className="h-5 w-36 ml-2" />
          </div>
        </header>
        <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border safe-top">
        <div className="flex items-center h-14 px-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-full touch-target">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-foreground ml-2">Upload Proof</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 max-w-lg mx-auto">
          {orderPublicId && (
            <div className="bg-muted/30 rounded-xl p-3 mb-4">
              <p className="text-xs text-muted-foreground">Order</p>
              <p className="text-base font-semibold text-foreground font-mono">{orderPublicId}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Existing Proofs */}
            {existingProof && existingProof.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm">Existing Files</Label>
                <div className="grid grid-cols-3 gap-2">
                  {existingProof.map((url, index) => (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-lg bg-muted overflow-hidden active:opacity-80"
                    >
                      <img src={url} alt={`Proof ${index + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Area */}
            <div className="space-y-1.5">
              <Label className="text-sm">Upload Files *</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-6 text-center active:border-primary active:bg-primary/5 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <CloudUpload className="h-7 w-7 text-muted-foreground mb-1.5 block" />
                <p className="text-sm font-medium text-foreground">Tap to upload</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  JPG, PNG, PDF, MP4 (Max 20MB)
                </p>
              </div>
            </div>

            {/* File Previews */}
            {files.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm">Selected Files</Label>
                <div className="grid grid-cols-3 gap-2">
                  {files.map((file, index) => (
                    <div key={index} className="relative">
                      <div className="aspect-square rounded-lg bg-muted overflow-hidden">
                        {file.file.type.startsWith('image/') ? (
                          <img src={file.preview} alt={file.file.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {file.file.type === 'application/pdf' ? (
                              <FileText className="h-6 w-6 text-muted-foreground" />
                            ) : (
                              <Video className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                        )}
                        {file.uploading && (
                          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                            <LoadingSpinner className="h-5 w-5" />
                          </div>
                        )}
                        {file.uploaded && (
                          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                        disabled={file.uploading}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="deliveryDate" className="text-sm">Delivery Date</Label>
              <Input
                id="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deliveryNotes" className="text-sm">Notes (Optional)</Label>
              <Textarea
                id="deliveryNotes"
                placeholder="Additional delivery notes..."
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </form>
        </div>
      </main>

      {/* Bottom Action */}
      <div className="sticky bottom-0 bg-background border-t border-border p-4 safe-bottom">
        <div className="flex gap-3 max-w-lg mx-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            className="flex-1 h-11"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            className="flex-1 h-11" 
            disabled={isSubmitting || (files.length === 0 && !existingProof)}
          >
            {isSubmitting ? (
              <>
                <ButtonSpinner className="h-4 w-4 mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
                Upload Proof
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
