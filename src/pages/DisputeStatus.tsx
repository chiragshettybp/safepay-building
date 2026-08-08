import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, Check, Clock, Flag, AlertCircle, Upload, X, Send, Download, HourglassIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Dispute {
  id: string;
  order_id: string;
  reason: string;
  issue_type: string | null;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  resolution: string | null;
  refund_amount: number | null;
  admin_notes: string | null;
}

interface DisputeUpdate {
  id: string;
  dispute_id: string;
  title: string;
  description: string | null;
  update_type: string;
  actor_type: string;
  created_at: string;
}

interface DisputeFile {
  id: string;
  dispute_id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

interface DisputeComment {
  id: string;
  dispute_id: string;
  user_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  open: { color: 'bg-destructive', icon: <AlertCircle className="w-5 h-5" />, label: 'Submitted' },
  submitted: { color: 'bg-destructive', icon: <AlertCircle className="w-5 h-5" />, label: 'Submitted' },
  under_review: { color: 'bg-warning', icon: <HourglassIcon className="w-5 h-5" />, label: 'Under Review' },
  awaiting_response: { color: 'bg-primary', icon: <Clock className="w-5 h-5" />, label: 'Awaiting Response' },
  resolved: { color: 'bg-success', icon: <Check className="w-5 h-5" />, label: 'Resolved' },
  withdrawn: { color: 'bg-muted-foreground', icon: <X className="w-5 h-5" />, label: 'Withdrawn' },
  closed: { color: 'bg-muted-foreground', icon: <X className="w-5 h-5" />, label: 'Closed' },
};

export default function DisputeStatus() {
  const { disputeId } = useParams<{ disputeId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [updates, setUpdates] = useState<DisputeUpdate[]>([]);
  const [files, setFiles] = useState<DisputeFile[]>([]);
  const [comments, setComments] = useState<DisputeComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const fetchData = async () => {
    if (!disputeId || !user?.id) return;
    
    try {
      // Fetch dispute
      const { data: disputeData, error: disputeError } = await supabase
        .from('disputes')
        .select('*')
        .eq('id', disputeId)
        .eq('customer_id', user.id)
        .maybeSingle();
      
      if (disputeError) throw disputeError;
      if (!disputeData) {
        navigate('/orders');
        return;
      }
      setDispute(disputeData);

      // Fetch updates
      const { data: updatesData } = await supabase
        .from('dispute_updates')
        .select('*')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: false });
      setUpdates(updatesData || []);

      // Fetch files
      const { data: filesData } = await supabase
        .from('dispute_files')
        .select('*')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: false });
      setFiles(filesData || []);

      // Fetch comments
      const { data: commentsData } = await supabase
        .from('dispute_comments')
        .select('*')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: true });
      setComments(commentsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      navigate('/orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Real-time subscriptions
    const disputeChannel = supabase
      .channel('dispute-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disputes', filter: `id=eq.${disputeId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispute_updates', filter: `dispute_id=eq.${disputeId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispute_comments', filter: `dispute_id=eq.${disputeId}` }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(disputeChannel);
    };
  }, [disputeId, user?.id]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !dispute || !user?.id) return;
    
    setIsSending(true);
    try {
      await supabase.from('dispute_comments').insert({
        dispute_id: dispute.id,
        user_id: user.id,
        message: newMessage.trim(),
        is_admin: false,
      });
      setNewMessage('');
      toast({ title: 'Message sent' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const withdrawDispute = async () => {
    if (!dispute) return;
    
    try {
      await supabase
        .from('disputes')
        .update({ status: 'closed' })
        .eq('id', dispute.id);

      await supabase.from('dispute_updates').insert({
        dispute_id: dispute.id,
        title: 'Dispute Withdrawn',
        description: 'Customer withdrew the dispute',
        update_type: 'status_change',
        actor_type: 'customer',
      });

      toast({ title: 'Dispute Withdrawn' });
      navigate(`/orders/${dispute.order_id}`);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to withdraw dispute', variant: 'destructive' });
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return format(date, 'MMM d');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!dispute) return null;

  // Check if resolved and redirect
  if (dispute.status === 'resolved') {
    navigate(`/disputes/${dispute.id}/result`);
    return null;
  }

  const status = statusConfig[dispute.status] || statusConfig.submitted;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden pb-24">
        {/* Top Navigation */}
        <header className="sticky top-0 z-40 flex items-center justify-between bg-background/95 px-4 py-3 backdrop-blur-md">
          <button 
            onClick={() => navigate(`/orders/${dispute.order_id}`)}
            className="group flex size-10 items-center justify-center rounded-full text-foreground hover:bg-surface active:scale-95 transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-lg font-bold tracking-tight text-foreground">Dispute Details</h2>
          <div className="size-10"></div>
        </header>

        {/* Main Content */}
        <main className="flex flex-col gap-6 px-4 pt-4">
          {/* Hero Summary Card */}
          <section className="relative flex flex-col items-center gap-5 rounded-3xl bg-surface px-6 py-8 shadow-xl shadow-black/[0.03] border border-border">
            {/* Dispute ID Badge */}
            <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5">
              <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              <span className="text-sm font-bold text-primary tracking-wide">
                #DSP-{dispute.id.slice(0, 6).toUpperCase()}
              </span>
            </div>

            {/* Status Pill */}
            <div className={`flex h-12 w-full items-center justify-center gap-2 rounded-full ${status.color} px-6 shadow-lg`}>
              <span className="text-white">{status.icon}</span>
              <span className="text-lg font-bold text-white tracking-wide">{dispute.reason}</span>
            </div>

            {/* Time Chip */}
            <div className="flex items-center gap-1.5 rounded-full bg-border/50 px-4 py-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                Submitted {getTimeAgo(dispute.created_at)}
              </p>
            </div>
          </section>

          {/* Progress Timeline */}
          <section className="rounded-xl bg-surface p-6 border border-border shadow-sm">
            <h3 className="mb-5 text-base font-bold text-foreground">Timeline</h3>
            <div className="relative flex flex-col gap-0">
              {updates.map((update, index) => {
                const isLast = index === updates.length - 1;
                const isCurrent = index === 0;
                
                let iconBg = 'bg-muted';
                let iconColor = 'text-muted-foreground';
                let Icon = Flag;
                
                if (update.update_type === 'status_change' && update.title.includes('Submitted')) {
                  iconBg = 'bg-destructive/10';
                  iconColor = 'text-destructive';
                  Icon = Check;
                } else if (update.title.includes('Review') || update.title.includes('Under')) {
                  iconBg = isCurrent ? 'bg-warning' : 'bg-muted';
                  iconColor = isCurrent ? 'text-white' : 'text-muted-foreground';
                  Icon = HourglassIcon;
                } else if (update.update_type === 'evidence') {
                  iconBg = 'bg-primary/10';
                  iconColor = 'text-primary';
                  Icon = Upload;
                }

                return (
                  <div key={update.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${iconBg} ${iconColor} ring-4 ring-background ${isCurrent ? 'shadow-md z-10' : ''}`}>
                        {isCurrent && update.title.includes('Review') && (
                          <div className="absolute inset-0 rounded-full bg-warning animate-ping opacity-25"></div>
                        )}
                        <Icon className="w-4 h-4" />
                      </div>
                      {!isLast && <div className="h-full w-0.5 bg-border min-h-10"></div>}
                    </div>
                    <div className={`${isLast ? 'pt-1' : 'pb-6 pt-1'}`}>
                      <p className={`text-base leading-none ${isCurrent ? 'font-bold' : 'font-semibold'} text-foreground`}>
                        {update.title}
                      </p>
                      <p className={`mt-1 text-sm ${isCurrent && update.title.includes('Review') ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
                        {update.description}
                      </p>
                      {isCurrent && update.title.includes('Review') && (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-1">
                          <span className="size-1.5 rounded-full bg-warning animate-pulse"></span>
                          <span className="text-xs font-semibold text-warning">In Progress</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {/* Resolution placeholder */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-4 ring-background">
                    <Flag className="w-4 h-4" />
                  </div>
                </div>
                <div className="pt-1">
                  <p className="text-base font-medium text-muted-foreground leading-none">Resolution</p>
                  <p className="mt-1 text-sm text-muted-foreground/70">Estimated in 2 days</p>
                </div>
              </div>
            </div>
          </section>

          {/* Uploaded Proof */}
          {files.length > 0 && (
            <section className="rounded-xl bg-surface p-6 border border-border shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-foreground">Uploaded Proof</h3>
                <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded-full">
                  {files.length} Files
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {files.map((file) => (
                  <div key={file.id} className="group relative flex flex-col gap-2 rounded-2xl bg-background p-3 border border-border transition-all hover:border-primary/50 hover:shadow-md">
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
                      {file.file_type.startsWith('image/') ? (
                        <img 
                          src={file.file_url} 
                          alt={file.file_name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <svg className="w-12 h-12 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                          </svg>
                        </div>
                      )}
                      <a 
                        href={file.file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="absolute bottom-2 right-2 flex size-8 items-center justify-center rounded-full bg-background/90 shadow-sm backdrop-blur-sm text-success hover:bg-success hover:text-white transition-colors cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                    <div className="flex flex-col">
                      <span className="truncate text-xs font-semibold text-foreground">{file.file_name}</span>
                      <a 
                        href={file.file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-1 text-left text-xs font-bold text-primary hover:underline"
                      >
                        View
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Messages Thread */}
          <section className="rounded-xl bg-surface p-6 border border-border shadow-sm mb-6">
            <div className="flex items-center gap-2 mb-6">
              <h3 className="text-base font-bold text-foreground">Messages</h3>
              <div className="size-2 rounded-full bg-success animate-pulse"></div>
            </div>
            
            <div className="flex flex-col gap-6">
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No messages yet. Start the conversation!</p>
              )}
              
              {comments.map((comment) => (
                <div key={comment.id} className={`flex gap-3 ${comment.is_admin ? '' : 'flex-row-reverse'} items-end`}>
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${comment.is_admin ? 'bg-primary/20 text-primary' : 'bg-primary text-white'} shadow-sm`}>
                    {comment.is_admin ? (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                      </svg>
                    ) : (
                      <span className="text-xs font-bold">ME</span>
                    )}
                  </div>
                  <div className={`flex flex-col gap-1 max-w-[85%] ${comment.is_admin ? '' : 'items-end'}`}>
                    <div className={`rounded-2xl ${comment.is_admin ? 'rounded-bl-sm bg-background border border-border' : 'rounded-br-sm bg-primary/10 border border-primary/20'} p-4 shadow-sm`}>
                      <p className="text-sm text-foreground leading-relaxed">{comment.message}</p>
                    </div>
                    <span className={`text-[11px] text-muted-foreground ${comment.is_admin ? 'pl-1' : 'pr-1'}`}>
                      {comment.is_admin ? 'Admin' : 'Read'} • {format(new Date(comment.created_at), 'h:mm a')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Field */}
            <div className="mt-6 flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a reply..."
                  className="h-12 w-full rounded-full border border-border bg-background px-5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                />
              </div>
              <button 
                onClick={sendMessage}
                disabled={!newMessage.trim() || isSending}
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-md shadow-primary/30 active:scale-95 transition-all hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="w-5 h-5 ml-0.5" />
              </button>
            </div>
          </section>
        </main>

        {/* Sticky Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 flex h-[72px] items-center justify-center gap-3 border-t border-border bg-background/90 px-4 backdrop-blur-lg">
          <button 
            onClick={() => navigate(`/disputes/${dispute.id}/upload`)}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border-2 border-primary bg-background text-sm font-bold text-primary transition-all hover:bg-primary/5 active:bg-primary/10"
          >
            <Upload className="w-4 h-4" />
            Upload Proof
          </button>
          <button 
            onClick={withdrawDispute}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border-2 border-destructive bg-background text-sm font-bold text-destructive transition-all hover:bg-destructive/5 active:bg-destructive/10"
          >
            <X className="w-4 h-4" />
            Withdraw
          </button>
        </div>
      </div>
    </div>
  );
}
