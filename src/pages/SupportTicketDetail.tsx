import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from '@/lib/toast';
import { formatFileSize } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FullPageLoading, ButtonSpinner } from '@/components/shared/LoadingSpinner';
import {
  ArrowLeft,
  ExternalLink,
  FilePlus,
  FileText,
  MessageSquare,
  Paperclip,
  Send,
  X,
} from 'lucide-react';

interface Ticket {
  id: string;
  public_ticket_id: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: string;
  sender_name: string;
  message: string;
  created_at: string;
}

interface Attachment {
  id: string;
  ticket_id: string;
  message_id: string | null;
  file_name: string;
  file_url: string;
  content_type: string | null;
  file_size: number | null;
  created_at: string;
}

const getStatusTone = (status: string): 'info' | 'warning' | 'success' | 'neutral' => {
  switch (status) {
    case 'open': return 'info';
    case 'in_progress': return 'warning';
    case 'resolved': return 'success';
    case 'closed': return 'neutral';
    default: return 'neutral';
  }
};

export default function SupportTicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ticketId || !user?.id) return;

    const fetchData = async () => {
      try {
        const { data: ticketData, error } = await supabase
          .from('support_tickets')
          .select('*')
          .eq('id', ticketId)
          .eq('customer_id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (!ticketData) {
          navigate('/help');
          return;
        }
        setTicket(ticketData);

        const [{ data: msgData }, { data: attData }] = await Promise.all([
          supabase
            .from('ticket_messages')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true }),
          supabase
            .from('ticket_attachments')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true }),
        ]);

        setMessages(msgData || []);
        setAttachments(attData || []);
      } catch (error) {
        console.error('Error fetching ticket:', error);
        toast({ title: 'Error', description: 'Failed to load ticket', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    const channel = supabase
      .channel(`ticket-messages-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, user?.id, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !ticket) return;

    const message = reply.trim();
    if (!message && !selectedFile) {
      toast({ title: 'Error', description: 'Please type a message or attach a file', variant: 'destructive' });
      return;
    }

    setIsSending(true);
    try {
      let messageId: string | null = null;

      if (message) {
        const { data: msg, error: msgErr } = await supabase
          .from('ticket_messages')
          .insert({
            ticket_id: ticket.id,
            sender_id: user.id,
            sender_type: 'customer',
            sender_name: user.fullName || 'You',
            message,
          })
          .select('id')
          .single();

        if (msgErr) throw msgErr;
        messageId = msg.id;
      }

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${ticket.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const { error: upErr } = await supabase.storage
          .from('ticket-attachments')
          .upload(filePath, selectedFile);

        if (upErr) throw upErr;

        const { data: publicUrl } = supabase.storage
          .from('ticket-attachments')
          .getPublicUrl(filePath);

        const { error: attErr } = await supabase.from('ticket_attachments').insert({
          ticket_id: ticket.id,
          message_id: messageId,
          file_name: selectedFile.name,
          file_url: publicUrl.publicUrl,
          content_type: selectedFile.type,
          file_size: selectedFile.size,
        });

        if (attErr) throw attErr;
      }

      setReply('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      const { data: fresh, error: fErr } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });
      if (!fErr) setMessages(fresh || []);
      const { data: freshAtt } = await supabase
        .from('ticket_attachments')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });
      if (freshAtt) setAttachments(freshAtt || []);

      toast({ title: 'Sent', description: 'Your reply has been sent' });
    } catch (error) {
      console.error('Reply error:', error);
      toast({ title: 'Error', description: 'Failed to send reply. Please try again.', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!ticket) return;
    setIsClosing(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: 'closed' })
        .eq('id', ticket.id);

      if (error) throw error;
      setTicket({ ...ticket, status: 'closed' });
      toast({ title: 'Ticket Closed', description: 'This ticket has been closed.' });
    } catch (error) {
      console.error('Close ticket error:', error);
      toast({ title: 'Error', description: 'Failed to close ticket', variant: 'destructive' });
    } finally {
      setIsClosing(false);
    }
  };

  if (isLoading) {
    return (
      <FullPageLoading />
    );
  }

  if (!ticket) return null;

  const attachmentsForMessage = (messageId: string | null) =>
    attachments.filter(a => a.message_id === messageId);

  return (
    <div className="mobile-page">
      {/* Header */}
      <header className="sticky-header bg-card">
        <div className="sticky-header-content px-4 sm:px-6">
          <button
            onClick={() => navigate('/help')}
            className="back-btn"
          >
            <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-foreground truncate">Support Ticket</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              {ticket.public_ticket_id || `#${ticket.id.slice(0, 8).toUpperCase()}`} • {ticket.category.replace(/_/g, ' ')}
            </p>
          </div>
          <StatusBadge tone={getStatusTone(ticket.status)} label={ticket.status.replace('_', ' ')} />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-28">
        {/* Subject */}
        <div className="px-4 py-4 bg-card border-b border-border">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">{ticket.subject}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Opened {format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}
          </p>
        </div>

        {/* Conversation */}
        <div className="px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-10">
              <MessageSquare className="text-muted-foreground h-7 w-7" />
              <p className="text-sm text-foreground mt-2">No messages yet</p>
              <p className="text-xs text-muted-foreground">Send a message to start the conversation</p>
            </div>
          )}

          {messages.map((msg) => {
            const isCustomer = msg.sender_type === 'customer';
            const msgAttachments = attachmentsForMessage(msg.id);
            return (
              <div key={msg.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                  isCustomer ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card border border-border rounded-bl-md'
                }`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${isCustomer ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {msg.sender_type === 'admin' ? 'Safepay Support' : msg.sender_name}
                    </span>
                    <span className={`text-[9px] ${isCustomer ? 'text-primary-foreground/60' : 'text-muted-foreground/70'}`}>
                      {format(new Date(msg.created_at), 'h:mm a')}
                    </span>
                  </div>
                  <p className={`text-sm whitespace-pre-wrap ${isCustomer ? 'text-primary-foreground' : 'text-foreground'}`}>
                    {msg.message}
                  </p>
                  {msgAttachments.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {msgAttachments.map((att) => (
                        <a
                          key={att.id}
                          href={att.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs ${
                            isCustomer ? 'bg-primary-foreground/15 text-primary-foreground' : 'bg-muted text-foreground'
                          }`}
                        >
                          {att.content_type?.startsWith('image/') ? (
                            <img
                              src={att.file_url}
                              alt={att.file_name}
                              className="w-10 h-10 rounded object-cover"
                            />
                          ) : (
                            <Paperclip className="h-[18px] w-[18px]" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{att.file_name}</p>
                            {att.file_size && (
                              <p className={`text-[9px] ${isCustomer ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                {formatFileSize(att.file_size)}
                              </p>
                            )}
                          </div>
                          <ExternalLink className="h-[18px] w-[18px]" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Close ticket */}
        {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
          <div className="px-4 pb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseTicket}
              disabled={isClosing}
              className="w-full h-10 rounded-xl text-xs"
            >
              Close Ticket
            </Button>
          </div>
        )}
      </main>

      {/* Reply bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-3 pb-6 z-40">
        {ticket.status === 'closed' || ticket.status === 'resolved' ? (
          <p className="text-center text-xs text-muted-foreground py-2">
            This ticket is {ticket.status}. Replies are disabled.
          </p>
        ) : (
          <form onSubmit={handleSend} className="flex items-end gap-2 max-w-lg mx-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 hover:bg-muted/80 transition-colors"
              title="Attach file"
            >
              {selectedFile ? (
                <FilePlus className="text-muted-foreground h-5 w-5" />
              ) : (
                <Paperclip className="text-muted-foreground h-5 w-5" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              {selectedFile && (
                <div className="flex items-center gap-2 px-2 py-1 mb-1 bg-muted rounded-lg text-xs text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="truncate flex-1">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your reply..."
                className="min-h-[44px] max-h-28 rounded-xl resize-none"
                rows={1}
                maxLength={2000}
              />
            </div>
            <Button
              type="submit"
              disabled={isSending || (!reply.trim() && !selectedFile)}
              className="h-10 px-4 rounded-xl shrink-0"
            >
              {isSending ? (
                <ButtonSpinner className="h-4 w-4" />
              ) : (
                <Send className="h-[18px] w-[18px]" />
              )}
            </Button>
          </form>
        )}
      </footer>
    </div>
  );
}
