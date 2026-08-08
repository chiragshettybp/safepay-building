import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, ArrowRight, Camera, X, Check, Trash2, Plus, AlertCircle, FileText, Image, Film } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Dispute {
  id: string;
  order_id: string;
  status: string;
  reason: string;
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

export default function UploadProof() {
  const { disputeId } = useParams<{ disputeId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [totalSize, setTotalSize] = useState(0);

  useEffect(() => {
    const fetchDispute = async () => {
      if (!disputeId || !user?.id) return;
      try {
        const { data, error } = await supabase
          .from('disputes')
          .select('*')
          .eq('id', disputeId)
          .eq('customer_id', user.id)
          .maybeSingle();
        
        if (error) throw error;
        if (!data) {
          navigate('/orders');
          return;
        }
        setDispute(data);
      } catch (error) {
        console.error('Error fetching dispute:', error);
        navigate('/orders');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDispute();
  }, [disputeId, user?.id, navigate]);

  const uploadFile = async (uploadedFile: UploadedFile) => {
    if (!dispute) return;

    setFiles(prev => prev.map(f => 
      f.id === uploadedFile.id ? { ...f, status: 'uploading', progress: 10 } : f
    ));

    try {
      const fileExt = uploadedFile.name.split('.').pop();
      const fileName = `${dispute.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

      // Simulate progress
      let progress = 10;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress > 90) progress = 90;
        setFiles(prev => prev.map(f => 
          f.id === uploadedFile.id ? { ...f, progress } : f
        ));
      }, 300);

      const { data, error } = await supabase.storage
        .from('dispute-files')
        .upload(fileName, uploadedFile.file);

      clearInterval(progressInterval);

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from('dispute-files')
        .getPublicUrl(fileName);

      // Save to database
      await supabase.from('dispute_files').insert({
        dispute_id: dispute.id,
        file_url: publicUrl.publicUrl,
        file_name: uploadedFile.name,
        file_size: uploadedFile.size,
        file_type: uploadedFile.type,
        upload_status: 'completed',
      });

      setFiles(prev => prev.map(f => 
        f.id === uploadedFile.id ? { ...f, status: 'success', progress: 100, url: publicUrl.publicUrl } : f
      ));
    } catch (error: any) {
      console.error('Upload error:', error);
      setFiles(prev => prev.map(f => 
        f.id === uploadedFile.id ? { ...f, status: 'error', error: error.message || 'Upload failed' } : f
      ));
    }
  };

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    const newFiles: UploadedFile[] = [];

    Array.from(selectedFiles).forEach(file => {
      if (files.length + newFiles.length >= 10) {
        toast({ title: 'Limit Reached', description: 'Maximum 10 files allowed', variant: 'destructive' });
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
    setTotalSize(prev => prev + newFiles.reduce((acc, f) => acc + f.size, 0));

    // Start uploading valid files
    newFiles.filter(f => f.status === 'pending').forEach(file => {
      uploadFile(file);
    });
  }, [files.length, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = (id: string) => {
    const file = files.find(f => f.id === id);
    if (file) {
      setTotalSize(prev => prev - file.size);
      setFiles(prev => prev.filter(f => f.id !== id));
    }
  };

  const handleContinue = async () => {
    if (!dispute) return;

    const successfulUploads = files.filter(f => f.status === 'success');
    
    if (successfulUploads.length === 0) {
      toast({
        title: 'No Files Uploaded',
        description: 'Please upload at least one file as evidence.',
        variant: 'destructive',
      });
      return;
    }

    // Add timeline update
    await supabase.from('dispute_updates').insert({
      dispute_id: dispute.id,
      title: 'Evidence Submitted',
      description: `Customer uploaded ${successfulUploads.length} file(s)`,
      update_type: 'evidence',
      actor_type: 'customer',
    });

    // Update dispute status
    await supabase
      .from('disputes')
      .update({ status: 'under_review' })
      .eq('id', dispute.id);

    // Add another timeline update
    await supabase.from('dispute_updates').insert({
      dispute_id: dispute.id,
      title: 'Under Review',
      description: 'Pending action from support',
      update_type: 'status_change',
      actor_type: 'system',
    });

    toast({
      title: 'Evidence Uploaded',
      description: 'Your dispute is now under review.',
    });

    navigate(`/disputes/${dispute.id}`);
  };

  const successCount = files.filter(f => f.status === 'success').length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!dispute) return null;

  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-surface shrink-0 pb-6 pt-4">
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-muted transition-colors text-muted-foreground"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1"></div>
          {/* Progress Pill */}
          <div className="bg-primary/10 px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-primary/20">
            <span className="text-primary text-xs font-bold tracking-wide uppercase">Step 2/3</span>
          </div>
        </div>
        
        {/* Hero Content */}
        <div className="px-6 flex flex-col gap-2 mt-1">
          <h1 className="text-foreground text-2xl font-bold leading-tight tracking-tight">
            📎 Upload Supporting Proof
          </h1>
          <p className="text-muted-foreground text-base font-normal leading-relaxed">
            Photos, screenshots, and chat logs help resolve disputes faster.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full relative">
        <div className="flex flex-col p-4 gap-6 pb-32">
          {/* Drag & Drop Zone */}
          <div 
            className="relative group cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
            <div className={`flex flex-col items-center justify-center gap-5 rounded-3xl border-4 border-dashed bg-surface h-[320px] transition-all duration-300 ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-border group-hover:border-primary group-hover:bg-primary/5'
            }`}>
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Camera className="w-12 h-12 text-primary/70" />
              </div>
              <div className="text-center px-6">
                <p className="text-foreground text-lg font-bold mb-1">Drag files here or click</p>
                <p className="text-muted-foreground text-sm">Supports JPG, PNG, PDF (max 10MB each)</p>
              </div>
              <button className="mt-2 h-12 px-8 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-full shadow-lg shadow-primary/20 flex items-center gap-2 transition-transform transform group-hover:scale-105">
                <Plus className="w-5 h-5" />
                <span>Select Files</span>
              </button>
            </div>
          </div>

          {/* File List Section */}
          {files.length > 0 && (
            <div className="flex flex-col gap-4">
              {/* File Stats */}
              <div className="flex items-center justify-between px-2">
                <span className="text-muted-foreground text-sm font-medium">Files uploaded</span>
                <span className="text-muted-foreground text-sm">
                  {successCount}/10 files • {formatFileSize(totalSize)} used
                </span>
              </div>

              {/* File Items */}
              {files.map((file) => {
                const FileIcon = getFileIcon(file.type);
                
                return (
                  <div 
                    key={file.id}
                    className={`p-3 rounded-xl border flex items-center gap-3 shadow-sm ${
                      file.status === 'error' 
                        ? 'bg-destructive/5 border-destructive/20' 
                        : 'bg-surface border-border'
                    }`}
                  >
                    <div className={`relative w-[72px] h-[72px] shrink-0 rounded-lg overflow-hidden flex items-center justify-center border ${
                      file.status === 'error' ? 'bg-destructive/10 border-destructive/20' : 'bg-muted border-border'
                    }`}>
                      <FileIcon className={`w-8 h-8 ${file.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} />
                      {file.type.startsWith('image/') && file.status === 'success' && file.url && (
                        <img 
                          src={file.url} 
                          alt={file.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                      <div className="flex items-center justify-between">
                        <p className="text-foreground text-sm font-semibold truncate">{file.name}</p>
                        <button 
                          onClick={() => removeFile(file.id)}
                          className={`p-1 rounded-full transition-colors ${
                            file.status === 'error' 
                              ? 'text-destructive hover:bg-destructive/10' 
                              : 'text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {file.status === 'uploading' ? (
                            <X className="w-4 h-4" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {file.status === 'uploading' && (
                        <>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                            <div 
                              className="h-full bg-warning rounded-full transition-all relative"
                              style={{ width: `${file.progress}%` }}
                            >
                              <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-muted-foreground text-xs">
                              {formatFileSize(file.size)} • {Math.round(file.progress)}%
                            </span>
                            <span className="text-warning text-xs font-medium">Uploading...</span>
                          </div>
                        </>
                      )}

                      {file.status === 'success' && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs">{formatFileSize(file.size)}</span>
                          <span className="text-success flex items-center gap-1 text-xs font-medium">
                            <Check className="w-3.5 h-3.5" />
                            Uploaded
                          </span>
                        </div>
                      )}

                      {file.status === 'error' && (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">{formatFileSize(file.size)}</span>
                            <span className="text-destructive flex items-center gap-1 text-xs font-bold">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {file.error}
                            </span>
                          </div>
                          <button className="text-primary text-xs font-semibold text-left mt-1 hover:underline">
                            Try compressing
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Sticky Footer Actions */}
      <footer className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-6 z-10 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)]">
        <div className="flex gap-4 items-center max-w-lg mx-auto">
          <button 
            onClick={() => navigate(-1)}
            className="flex-1 h-14 rounded-full flex items-center justify-center text-muted-foreground font-semibold text-base hover:bg-muted transition-colors"
          >
            Back
          </button>
          <button 
            onClick={handleContinue}
            disabled={successCount === 0}
            className="flex-1 h-14 bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all text-white rounded-full font-bold text-base shadow-lg shadow-primary/30 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Continue</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </footer>
    </div>
  );
}
