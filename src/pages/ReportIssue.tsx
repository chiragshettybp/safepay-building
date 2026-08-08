import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, HelpCircle, CheckCircle, Upload, Send, Package, MessageCircle, X, Trash2, Image, FileText, Film } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Order {
  id: string;
  order_number: string;
  merchant_name: string;
  product_name: string;
  amount: number;
  currency: string;
  status: string;
}

interface Dispute {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  resolution: string | null;
}

interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  url?: string;
  error?: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return Image;
  if (type.startsWith('video/')) return Film;
  return FileText;
};

export default function ReportIssue() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', priority: 'medium', description: '' });
  const [files, setFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !user?.id) return;
      try {
        // Fetch order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', id)
          .eq('customer_id', user.id)
          .maybeSingle();
        
        if (orderError) throw orderError;
        if (!orderData) { navigate('/orders'); return; }
        setOrder(orderData);

        // Fetch existing disputes for this order
        const { data: disputeData, error: disputeError } = await supabase
          .from('disputes')
          .select('*')
          .eq('order_id', id)
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });

        if (disputeError) throw disputeError;
        setDisputes(disputeData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        navigate('/orders');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, user?.id, navigate]);

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    const newFiles: UploadedFile[] = [];

    Array.from(selectedFiles).forEach(file => {
      if (files.length + newFiles.length >= 5) {
        toast({ title: 'Limit Reached', description: 'Maximum 5 files allowed', variant: 'destructive' });
        return;
      }

      const uploadedFile: UploadedFile = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        progress: 0,
        status: file.size > maxSize ? 'error' : 'pending',
        error: file.size > maxSize ? 'File too large (Max 10MB)' : undefined,
      };

      newFiles.push(uploadedFile);
    });

    setFiles(prev => [...prev, ...newFiles]);
  }, [files.length, toast]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadFilesToStorage = async (disputeId: string) => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    for (const file of pendingFiles) {
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'uploading', progress: 30 } : f
      ));

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${disputeId}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        const { error } = await supabase.storage
          .from('dispute-files')
          .upload(fileName, file.file);

        if (error) throw error;

        const { data: publicUrl } = supabase.storage
          .from('dispute-files')
          .getPublicUrl(fileName);

        await supabase.from('dispute_files').insert({
          dispute_id: disputeId,
          file_url: publicUrl.publicUrl,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          upload_status: 'completed',
        });

        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'success', progress: 100, url: publicUrl.publicUrl } : f
        ));
      } catch (error: any) {
        console.error('Upload error:', error);
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'error', error: error.message || 'Upload failed' } : f
        ));
      }
    }
  };

  const handleSubmit = async () => {
    if (!order || !user?.id || !form.title.trim() || !form.description.trim()) {
      toast({ title: 'Missing Info', description: 'Please fill all required fields.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);

    try {
      const { data: newDispute, error: disputeError } = await supabase
        .from('disputes')
        .insert({ 
          order_id: order.id, 
          customer_id: user.id, 
          reason: form.title, 
          description: form.description, 
          status: 'open' 
        })
        .select()
        .single();

      if (disputeError) throw disputeError;

      // Upload files if any
      if (files.filter(f => f.status === 'pending').length > 0) {
        await uploadFilesToStorage(newDispute.id);
      }

      await supabase.from('orders').update({ status: 'disputed' }).eq('id', order.id);
      await supabase.from('notifications').insert({ 
        user_id: user.id, 
        type: 'warning', 
        title: 'Issue Reported', 
        message: `Issue for order #${order.order_number} submitted`, 
        link: `/orders/${order.id}` 
      });

      // Add dispute update
      await supabase.from('dispute_updates').insert({
        dispute_id: newDispute.id,
        title: 'Dispute Created',
        description: `Issue reported: ${form.title}`,
        update_type: 'status_change',
        actor_type: 'customer',
      });

      toast({ title: 'Issue Reported', description: "We'll get back to you shortly." });
      
      // Navigate to dispute status page
      navigate(`/disputes/${newDispute.id}`);
    } catch (error) {
      console.error('Submit error:', error);
      toast({ title: 'Error', description: 'Failed to submit. Try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  const canSubmit = form.title.trim() && form.description.trim();
  const hasExistingDispute = order.status === 'disputed';

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(`/orders/${order.id}`)} className="p-2 -ml-2 rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dispute Resolution</span>
          <button className="p-2 rounded-full hover:bg-muted">
            <HelpCircle className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-background px-4 py-5 border-b border-border">
        <h1 className="text-xl font-bold text-destructive mb-3">Report Issue</h1>
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl border border-border">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Package className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Order #{order.order_number}</p>
            <p className="text-sm font-medium text-foreground">{order.product_name}</p>
            <p className="text-sm font-bold text-foreground">{order.currency === 'USD' ? '$' : '₹'}{Number(order.amount).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <main className="flex-1 p-4 space-y-4">
        {/* Existing Dispute Warning */}
        {hasExistingDispute && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex gap-3">
            <MessageCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-foreground">Dispute Already Active</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This order already has an open dispute. You can add more details below.
              </p>
            </div>
          </div>
        )}

        {/* Title */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Issue Title *</label>
          <div className="relative">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Item not received"
              className="w-full h-12 px-4 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
            {form.title && <CheckCircle className="absolute right-3 top-3.5 w-5 h-5 text-success" />}
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority Level</label>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="w-full h-12 px-4 bg-background border border-border rounded-xl text-foreground appearance-none focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </select>
          {form.priority === 'high' && (
            <p className="text-xs text-warning">High priority issues get responses within 2 hours.</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description *</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the problem in detail..."
            rows={5}
            className="w-full p-4 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none transition-all"
          />
        </div>

        {/* Upload */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Evidence (Optional)</label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-28 bg-background border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-muted/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Tap to upload files (max 5)</p>
          </button>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2 mt-3">
              {files.map((file) => {
                const FileIcon = getFileIcon(file.type);
                return (
                  <div 
                    key={file.id}
                    className={`p-3 rounded-xl border flex items-center gap-3 ${
                      file.status === 'error' 
                        ? 'bg-destructive/5 border-destructive/20' 
                        : 'bg-background border-border'
                    }`}
                  >
                    <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${
                      file.status === 'error' ? 'bg-destructive/10' : 'bg-muted'
                    }`}>
                      <FileIcon className={`w-5 h-5 ${file.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                        {file.status === 'error' && <span className="text-destructive ml-2">{file.error}</span>}
                        {file.status === 'uploading' && <span className="text-warning ml-2">Uploading...</span>}
                        {file.status === 'success' && <span className="text-success ml-2">✓ Uploaded</span>}
                      </p>
                    </div>
                    <button 
                      onClick={() => removeFile(file.id)}
                      className="p-1 rounded-full hover:bg-muted text-muted-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Previous Disputes History */}
        {disputes.length > 0 && (
          <div className="space-y-3 mt-6">
            <h3 className="font-bold text-foreground">Previous Issues</h3>
            <div className="space-y-3">
              {disputes.map((dispute) => (
                <div key={dispute.id} className="bg-background border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm text-foreground">{dispute.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(dispute.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      dispute.status === 'open' ? 'bg-warning/10 text-warning' :
                      dispute.status === 'resolved' ? 'bg-success/10 text-success' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {dispute.status.charAt(0).toUpperCase() + dispute.status.slice(1)}
                    </span>
                  </div>
                  {dispute.description && (
                    <p className="text-sm text-muted-foreground">{dispute.description}</p>
                  )}
                  {dispute.resolution && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">Resolution:</p>
                      <p className="text-sm text-foreground">{dispute.resolution}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Previous Issues */}
        {disputes.length === 0 && !hasExistingDispute && (
          <div className="bg-muted/50 rounded-xl p-4 text-center">
            <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No previous issues reported for this order</p>
          </div>
        )}
      </main>

      {/* Bottom Submit */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border p-4 pb-6 z-40">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="w-full h-14 bg-destructive text-destructive-foreground rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-sm"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-destructive-foreground border-t-transparent rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              Submit Issue
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
