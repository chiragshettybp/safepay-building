import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isYesterday } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      navigate('/login');
      return;
    }

    fetchNotifications();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchNotifications = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100); // Limit to prevent loading too many notifications

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
    if (!user?.id) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
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
        title: 'Success',
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
      case 'success':
        return 'check_circle';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-emerald-500';
      case 'error':
        return 'text-destructive';
      case 'warning':
        return 'text-amber-500';
      default:
        return 'text-primary';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-muted transition-colors"
            >
              <span className="material-symbols-outlined text-foreground">arrow_back</span>
            </button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm text-primary font-medium hover:underline"
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
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-muted-foreground text-3xl">notifications_off</span>
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">No notifications</h2>
            <p className="text-muted-foreground text-sm">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`px-4 py-4 transition-colors ${
                  !notification.read ? 'bg-primary/5' : 'bg-background'
                }`}
              >
                <div className="flex gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      !notification.read ? 'bg-primary/10' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-xl ${getTypeColor(notification.type)}`}
                    >
                      {getTypeIcon(notification.type)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`font-medium text-foreground ${!notification.read ? 'font-semibold' : ''}`}>
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(notification.created_at)}
                      </span>
                      {notification.link && (
                        <Link
                          to={notification.link}
                          onClick={() => markAsRead(notification.id)}
                          className="text-xs text-primary font-medium hover:underline"
                        >
                          View details
                        </Link>
                      )}
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-xs text-muted-foreground hover:text-foreground"
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
