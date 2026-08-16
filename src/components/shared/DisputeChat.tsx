import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatFileSize } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ButtonSpinner } from '@/components/shared/LoadingSpinner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  FilePlus,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Send,
  ShieldCheck,
  WifiOff,
  X,
} from 'lucide-react';

interface ChatAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface DisputeMessage {
  id: string;
  dispute_id: string;
  order_id: string | null;
  sender_type: 'merchant' | 'customer' | 'system';
  sender_id: string | null;
  sender_name: string | null;
  message: string;
  attachments: ChatAttachment[];
  read_at: string | null;
  created_at: string;
}

type SendStatus = 'sending' | 'sent' | 'failed';

type LocalMessage = DisputeMessage & { sendStatus?: SendStatus };

interface DisputeChatProps {
  disputeId: string;
  orderId?: string | null;
  senderType: 'merchant' | 'customer';
  senderId: string;
  senderName: string;
  canSend?: boolean;
  quickReplies?: string[];
  storageBucket?: string;
  onMessageSent?: () => void | Promise<void>;
  className?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PAGE_SIZE = 30;
const ACCEPTED_DOC_TYPES = '.pdf,.doc,.docx,.txt,.csv';

function getDayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) return 'Today';
  if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) return 'Yesterday';

  const diff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff > 0 && diff < 7) return format(date, 'EEEE');
  return format(date, 'MMMM d, yyyy');
}

function mergeMessages(...lists: LocalMessage[][]): LocalMessage[] {
  const map = new Map<string, LocalMessage>();
  for (const list of lists) {
    for (const message of list) {
      if (!map.has(message.id)) map.set(message.id, message);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.id < b.id ? -1 : 1;
  });
}

function isImage(type: string): boolean {
  return type.startsWith('image/');
}

export default function DisputeChat({
  disputeId,
  orderId,
  senderType,
  senderId,
  senderName,
  canSend = true,
  quickReplies = [],
  storageBucket = 'dispute-files',
  onMessageSent,
  className = '',
}: DisputeChatProps) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [unreadUntilId, setUnreadUntilId] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<LocalMessage[]>([]);
  const atBottomRef = useRef(true);
  const initialScrollRef = useRef(false);
  const subscribedOnceRef = useRef(false);
  const onlineInitRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const lastIdRef = useRef<string | null>(null);
  const pendingInputRef = useRef<HTMLInputElement>(null);
  const pendingAcceptRef = useRef('image/*');
  const pendingFilesRef = useRef(new Map<string, File>());

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const isAtBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const revokeBlobUrl = useCallback((tempId: string) => {
    const temp = messagesRef.current.find((m) => m.id === tempId);
    const url = temp?.attachments?.[0]?.url;
    if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
  }, []);

  const fetchLatest = useCallback(async () => {
    if (!disputeId) return;
    try {
      setLoadError(false);
      const { data, error } = await supabase
        .from('dispute_messages')
        .select('*')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;

      const rows = ((data || []) as DisputeMessage[]).slice().reverse();
      setMessages((prev) => mergeMessages(rows, prev));
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching dispute messages:', error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  const loadOlder = useCallback(async () => {
    if (!disputeId || loadingOlderRef.current || !hasMore) return;
    const oldest = messagesRef.current[0];
    if (!oldest) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const { data, error } = await supabase
        .from('dispute_messages')
        .select('*')
        .eq('dispute_id', disputeId)
        .lt('created_at', oldest.created_at)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;

      const rows = ((data || []) as DisputeMessage[]).slice().reverse();
      setMessages((prev) => mergeMessages(rows, prev));
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading older dispute messages:', error);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [disputeId, hasMore]);

  useEffect(() => {
    if (!disputeId) return;

    const channel = supabase
      .channel(`dispute-chat-${disputeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dispute_messages',
          filter: `dispute_id=eq.${disputeId}`,
        },
        (payload) => {
          const incoming = payload.new as DisputeMessage;
          if (!incoming) return;

          const current = messagesRef.current;
          if (current.some((m) => m.id === incoming.id)) return;

          if (incoming.sender_id === senderId) {
            const sendingTemps = current.filter(
              (m) => m.sendStatus === 'sending' && m.sender_id === incoming.sender_id
            );
            if (sendingTemps.length === 1) {
              const temp = sendingTemps[0];
              const withinWindow =
                Math.abs(new Date(temp.created_at).getTime() - new Date(incoming.created_at).getTime()) <
                10000;
              if (withinWindow) {
                pendingFilesRef.current.delete(temp.id);
                setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...incoming } : m)));
              }
            }
            return;
          }

          setMessages((prev) => mergeMessages(prev, [{ ...incoming }]));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && subscribedOnceRef.current) {
          fetchLatest();
        } else if (status === 'SUBSCRIBED') {
          subscribedOnceRef.current = true;
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [disputeId, fetchLatest]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (onlineInitRef.current) {
      onlineInitRef.current = false;
      return;
    }
    if (isOnline) fetchLatest();
  }, [isOnline, fetchLatest]);

  const clearUnread = useCallback(() => {
    setNewCount(0);
    setUnreadUntilId(null);
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const last = messages[messages.length - 1];
    const lastId = last?.id ?? null;
    const isNewLast = lastId !== lastIdRef.current;
    lastIdRef.current = lastId;

    if (!last || !isNewLast) return;

    const own = last.sender_id === senderId && last.sender_type === senderType;
    if (own) {
      scrollToBottom(initialScrollRef.current);
      initialScrollRef.current = true;
      return;
    }

    if (atBottomRef.current) {
      scrollToBottom(initialScrollRef.current);
      initialScrollRef.current = true;
      return;
    }

    setNewCount((count) => count + 1);
    setUnreadUntilId(lastId);
  }, [messages, isLoading, senderId, senderType, scrollToBottom]);

  const handleScroll = useCallback(() => {
    atBottomRef.current = isAtBottom();

    const el = scrollerRef.current;
    if (el && el.scrollTop < 48 && hasMore && !loadingOlderRef.current && messagesRef.current.length > 0) {
      loadOlder();
    }

    if (atBottomRef.current) clearUnread();
  }, [isAtBottom, hasMore, loadOlder, clearUnread]);

  const publish = useCallback(
    async (tempId: string, message: string, file: File | null) => {
      try {
        let attachments: ChatAttachment[] = [];

        if (file) {
          if (file.size > MAX_FILE_SIZE) {
            toast.error(`${file.name} is too large (max 10MB)`);
            throw new Error('FILE_TOO_LARGE');
          }
          const fileExt = file.name.split('.').pop();
          const filePath = `${disputeId}/chat/${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from(storageBucket).upload(filePath, file);
          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage.from(storageBucket).getPublicUrl(filePath);
          attachments = [{ name: file.name, url: urlData.publicUrl, type: file.type, size: file.size }];
        }

        const { data: inserted, error: insertError } = await supabase
          .from('dispute_messages')
          .insert({
            dispute_id: disputeId,
            order_id: orderId || null,
            sender_type: senderType,
            sender_id: senderId,
            sender_name: senderName,
            message,
            attachments,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        pendingFilesRef.current.delete(tempId);
        revokeBlobUrl(tempId);

        const serverMessage = inserted as DisputeMessage;
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...serverMessage, sendStatus: 'sent' } : m)));
        window.setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) => (m.id === serverMessage.id ? { ...m, sendStatus: undefined } : m))
          );
        }, 1600);

        if (onMessageSent) await onMessageSent();
      } catch (error) {
        console.error('Error sending dispute message:', error);
        if (error instanceof Error && error.message === 'FILE_TOO_LARGE') {
          pendingFilesRef.current.delete(tempId);
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          return;
        }
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, sendStatus: 'failed' } : m)));
        toast.error('Failed to send message. Please try again.');
      }
    },
    [disputeId, orderId, senderType, senderId, senderName, storageBucket, onMessageSent, revokeBlobUrl]
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if ((!text && !selectedFile) || !senderId || isSending) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const file = selectedFile;

    const optimistic: LocalMessage = {
      id: tempId,
      dispute_id: disputeId,
      order_id: orderId || null,
      sender_type: senderType,
      sender_id: senderId,
      sender_name: senderName,
      message: text || 'Sent an attachment',
      attachments: file
        ? [{ name: file.name, url: URL.createObjectURL(file), type: file.type, size: file.size }]
        : [],
      read_at: null,
      created_at: new Date().toISOString(),
      sendStatus: 'sending',
    };

    if (file) pendingFilesRef.current.set(tempId, file);

    setMessages((prev) => mergeMessages(prev, [optimistic]));
    setInput('');
    setSelectedFile(null);
    atBottomRef.current = true;
    scrollToBottom(true);

    await publish(tempId, text || 'Sent an attachment', file);
  }, [input, selectedFile, senderId, isSending, disputeId, orderId, senderType, senderName, publish, scrollToBottom]);

  const retryMessage = useCallback(
    (message: LocalMessage) => {
      if (!senderId) return;
      const file = pendingFilesRef.current.get(message.id) || null;
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, sendStatus: 'sending' } : m)));
      atBottomRef.current = true;
      scrollToBottom(true);
      publish(message.id, message.message || 'Sent an attachment', file);
    },
    [senderId, publish, scrollToBottom]
  );

  const openFilePicker = useCallback((accept: string) => {
    pendingAcceptRef.current = accept;
    pendingInputRef.current?.click();
  }, []);

  const commitAttachment = useCallback(() => {
    if (!pendingFile) return;
    setSelectedFile(pendingFile);
    setPendingFile(null);
    setPendingPreviewUrl(null);
    setAttachOpen(false);
    composerRef.current?.focus();
  }, [pendingFile]);

  const handleComposerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  useEffect(() => {
    if (!pendingFile) {
      setPendingPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const renderAttachments = (attachments: ChatAttachment[] | null | undefined, own: boolean) => {
    if (!attachments || attachments.length === 0) return null;
    return (
      <div className="mt-2 space-y-1.5">
        {attachments.map((att, idx) =>
          isImage(att.type) ? (
            <a
              key={idx}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-xl border border-black/5"
            >
              <img src={att.url} alt={att.name} className="max-h-56 w-full object-cover" />
            </a>
          ) : (
            <a
              key={idx}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs ${
                own ? 'bg-primary-foreground/15 text-primary-foreground' : 'bg-muted text-foreground'
              }`}
            >
              <FileText className="h-[18px] w-[18px] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{att.name}</p>
                {att.size > 0 && (
                  <p className={`text-[9px] ${own ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {formatFileSize(att.size)}
                  </p>
                )}
              </div>
            </a>
          )
        )}
      </div>
    );
  };

  const renderStatus = (message: LocalMessage, own: boolean) => {
    if (!own || !message.sendStatus) return null;

    if (message.sendStatus === 'sending') {
      return (
        <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-primary-foreground/60">
          <span className="font-medium">Sending</span>
          <ButtonSpinner className="h-3 w-3" />
        </div>
      );
    }

    if (message.sendStatus === 'failed') {
      return (
        <button
          type="button"
          onClick={() => retryMessage(message)}
          className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-primary-foreground/90 underline underline-offset-2"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Not sent — tap to retry
        </button>
      );
    }

    return (
      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-primary-foreground/60">
        <Check className="h-3 w-3" />
        <span className="font-medium">Sent</span>
      </div>
    );
  };

  const renderDayPill = (day: string) => (
    <div className="flex justify-center">
      <span className="rounded-full bg-muted/70 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
        {day}
      </span>
    </div>
  );

  let lastDay = '';

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      {/* Messages */}
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Dispute conversation"
        className="relative flex-1 overflow-y-auto overscroll-contain"
      >
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className="h-12 w-40 rounded-2xl bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        ) : loadError && messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <AlertTriangle className="mb-3 h-8 w-8 text-destructive" />
            <p className="mb-1 text-sm font-semibold text-foreground">Couldn't load messages</p>
            <p className="mb-4 text-xs text-muted-foreground">Check your connection and try again.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsLoading(true);
                setLoadError(false);
                fetchLatest();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <MessageSquare className="h-7 w-7 text-primary" />
            </div>
            <p className="mb-1 text-sm font-semibold text-foreground">No messages yet</p>
            <p className="max-w-[240px] text-xs leading-relaxed text-muted-foreground">
              Start the conversation to resolve this dispute.
            </p>
          </div>
        ) : (
          <div className="px-3 py-4 sm:px-4">
            {hasMore ? (
              <div className="flex justify-center pb-3">
                <ButtonSpinner className="h-4 w-4 text-muted-foreground" />
              </div>
            ) : (
              <div className="flex justify-center pb-3">
                <span className="rounded-full bg-muted/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                  Start of conversation
                </span>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((message) => {
                const isSystem = message.sender_type === 'system';
                const own = !isSystem && message.sender_id === senderId && message.sender_type === senderType;
                const day = getDayLabel(new Date(message.created_at));
                const showDay = day !== lastDay;
                if (showDay) lastDay = day;
                const showUnread = message.id === unreadUntilId;

                if (isSystem) {
                  return (
                    <div key={message.id}>
                      {showDay && <div className="mb-4">{renderDayPill(day)}</div>}
                      {showUnread && <UnreadDivider />}
                      <div className="flex justify-center">
                        <div className="flex max-w-[90%] items-start gap-2.5 rounded-2xl border border-border bg-muted/40 px-3.5 py-2.5">
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="mb-0.5 flex items-center gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                SafePay
                              </span>
                              <span className="text-[9px] text-muted-foreground/70">
                                {format(new Date(message.created_at), 'h:mm a')}
                              </span>
                            </div>
                            <p className="text-xs whitespace-pre-wrap leading-relaxed text-muted-foreground">
                              {message.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={message.id}>
                    {showDay && <div className="mb-4">{renderDayPill(day)}</div>}
                    {showUnread && <UnreadDivider />}
                    <div className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[75%] ${
                          own
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'rounded-bl-md border border-border bg-card'
                        }`}
                      >
                        {!own && (
                          <div className="mb-0.5 flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-muted-foreground">
                              {message.sender_name ||
                                (message.sender_type === 'customer' ? 'Customer' : 'Merchant')}
                            </span>
                          </div>
                        )}
                        <p
                          className={`text-sm whitespace-pre-wrap ${
                            own ? 'text-primary-foreground' : 'text-foreground'
                          }`}
                        >
                          {message.message}
                        </p>
                        {renderAttachments(message.attachments, own)}
                        <div
                          className={`mt-1 flex items-center gap-1.5 ${
                            own ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <span
                            className={`text-[10px] ${
                              own ? 'text-primary-foreground/60' : 'text-muted-foreground/70'
                            }`}
                          >
                            {format(new Date(message.created_at), 'h:mm a')}
                          </span>
                        </div>
                        {renderStatus(message, own)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {newCount > 0 && !isLoading && (
          <div className="pointer-events-none absolute bottom-4 left-0 right-0 z-10 flex justify-center">
            <button
              type="button"
              onClick={() => {
                scrollToBottom(true);
                clearUnread();
              }}
              className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary shadow-md"
            >
              {newCount} new message{newCount > 1 ? 's' : ''}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Quick replies */}
      {canSend && quickReplies.length > 0 && !isLoading && (
        <div className="flex gap-2 overflow-x-auto border-t border-border px-3 pt-2 pb-1 scrollbar-hide">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => {
                setInput(reply);
                composerRef.current?.focus();
              }}
              className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-medium whitespace-nowrap text-primary transition-all active:scale-95 touch-target"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      {canSend ? (
        <div className="border-t border-border bg-background/95 backdrop-blur-sm">
          {!isOnline && (
            <div className="flex items-center gap-2 bg-warning/10 px-3 py-2 text-xs font-medium text-warning">
              <WifiOff className="h-3.5 w-3.5 shrink-0" />
              <span>You're offline — messages will sync when you reconnect.</span>
            </div>
          )}

          {selectedFile && (
            <div className="flex items-center gap-2 px-3 pt-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                {isImage(selectedFile.type) ? (
                  <ImageIcon className="h-4 w-4 shrink-0" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate flex-1">{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="shrink-0 p-0.5 hover:text-foreground touch-target"
                  aria-label="Remove attachment"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-end gap-2 px-3 pt-1.5 pb-2 safe-bottom">
            <input
              ref={pendingInputRef}
              type="file"
              accept={pendingAcceptRef.current}
              className="hidden"
              onChange={(e) => {
                setPendingFile(e.target.files?.[0] || null);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => setAttachOpen(true)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/70 transition-colors hover:bg-muted touch-target"
              aria-label="Attach file"
              title="Attach file"
            >
              {selectedFile ? (
                <FilePlus className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Paperclip className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            <Textarea
              ref={composerRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Type a message…"
              aria-label="Message"
              className="min-h-[48px] max-h-28 flex-1 resize-none rounded-2xl border-border bg-muted/50 px-3.5 py-3 text-sm focus-visible:border-primary"
              rows={1}
              maxLength={2000}
            />

            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={isSending || (!input.trim() && !selectedFile)}
              className="h-12 w-12 shrink-0 rounded-full"
              aria-label="Send message"
            >
              {isSending ? (
                <ButtonSpinner className="h-5 w-5" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-t border-border px-4 py-3 safe-bottom">
          <p className="py-2 text-center text-xs text-muted-foreground">
            Messages are closed for this dispute.
          </p>
        </div>
      )}

      {/* Attachment bottom sheet */}
      <Sheet open={attachOpen} onOpenChange={setAttachOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
          <SheetHeader>
            <SheetTitle>Add attachment</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 pt-4">
            {pendingPreviewUrl ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                {pendingFile && isImage(pendingFile.type) ? (
                  <img
                    src={pendingPreviewUrl}
                    alt={pendingFile.name}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-7 w-7 text-primary" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{pendingFile?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {pendingFile ? formatFileSize(pendingFile.size) : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingFile(null)}
                  className="shrink-0 p-1 hover:text-foreground touch-target"
                  aria-label="Remove selected attachment"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => openFilePicker('image/*')}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-4 text-sm font-medium text-foreground transition-colors hover:bg-muted active:bg-muted touch-target"
                >
                  <ImageIcon className="h-6 w-6 text-primary" />
                  Photos
                </button>
                <button
                  type="button"
                  onClick={() => openFilePicker(ACCEPTED_DOC_TYPES)}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-4 text-sm font-medium text-foreground transition-colors hover:bg-muted active:bg-muted touch-target"
                >
                  <FileText className="h-6 w-6 text-primary" />
                  Document
                </button>
              </div>
            )}

            <Button className="h-12 w-full" disabled={!pendingFile} onClick={commitAttachment}>
              <Paperclip className="h-4 w-4" />
              Attach file
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function UnreadDivider() {
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-primary uppercase">
        Unread
      </span>
    </div>
  );
}
