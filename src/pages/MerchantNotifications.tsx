import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isYesterday } from 'date-fns';
import { toast } from '@/lib/toast';
import { AlertCircle, AlertTriangle, ArrowLeft, BellOff, CheckCircle2, Gavel, Info, ShoppingBag, Wallet } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export default function MerchantNotifications() {
  const { user, merchant } = useMerchantAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Get the profile id (user_id from merchants table) for notifications lookup
  useEffect(() => {
    if (!merchant?.id) return;

    const fetchProfileId = async () => {
      const { data } = await supabase
        .from('merchants')
        .select('user_id')
        .eq('id', merchant.id)
        .maybeSingle();

      if (data?.user_id) {
        setProfileId(data.user_id);
      }
    };

    fetchProfileId();
  }, [merchant?.id]);

  useEffect(() => {
    if (!profileId) return;

    fetchNotifications();

    const channel = supabase
      .channel('merchant-notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profileId}`,
        },
        () => fetchNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  const fetchNotifications = async () => {
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching notifications:', error);
        toast({
          title: 'Error',
          description: 'Failed to load notifications',
          variant: 'destructive',
        });
      } else {
        setNotifications(data || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to mark notification as read',
        variant: 'destructive',
      });
    } else {
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
    }
  };

  const markAllAsRead = async () => {
    if (!profileId) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', profileId)
      .eq('read', false);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to mark all as read',
        variant: 'destructive',
      });
    } else {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast({
        title: 'Done',
        description: 'All notifications marked as read',
      });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`;
    if (isYesterday(date)) return `Yesterday, ${format(date, 'h:mm a')}`;
    return format(date, 'MMM d, h:mm a');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return CheckCircle2;
      case 'error': return AlertCircle;
      case 'warning': return AlertTriangle;
      case 'order': return ShoppingBag;
      case 'payout': return Wallet;
      case 'dispute': return Gavel;
      default: return Info;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-success';
      case 'error': return 'text-destructive';
      case 'warning': return 'text-amber-500';
      default: return 'text-primary';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="mobile-page">
      {/* Header */}
      <header className="sticky-header bg-card">
        <div className="sticky-header-content px-4 sm:px-6">
          <button
            onClick={() => navigate('/merchant-dashboard')}
            className="back-btn"
          >
            <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-foreground">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-[10px] sm:text-xs text-muted-foreground">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs sm:text-sm text-primary font-medium hover:underline shrink-0"
            >
              Mark all read
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="pb-20">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <BellOff className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-foreground mb-1">No notifications</h2>
            <p className="text-muted-foreground text-xs sm:text-sm">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`px-4 py-3.5 sm:py-4 transition-colors ${
                  !notification.read ? 'bg-primary/5' : 'bg-background'
                }`}
              >
                <div className="flex gap-3">
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${
                      !notification.read ? 'bg-primary/10' : 'bg-muted'
                    }`}
                  >
                    {(() => {
                      const TypeIcon = getTypeIcon(notification.type);
                      return <TypeIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${getTypeColor(notification.type)}`} />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-xs sm:text-sm text-foreground ${!notification.read ? 'font-semibold' : 'font-medium'}`}>
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-[11px] sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 sm:mt-2">
                      <span className="text-[10px] sm:text-xs text-muted-foreground">
                        {formatDate(notification.created_at)}
                      </span>
                      {notification.link && (
                        <Link
                          to={notification.link}
                          onClick={() => markAsRead(notification.id)}
                          className="text-[10px] sm:text-xs text-primary font-medium hover:underline"
                        >
                          View details
                        </Link>
                      )}
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
