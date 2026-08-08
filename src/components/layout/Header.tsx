import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SafepayLogo } from '@/components/ui/SafepayLogo';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user?.id) {
      // Fetch unread notifications count
      const fetchNotifications = async () => {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false);
        
        setUnreadCount(count || 0);
      };

      fetchNotifications();

      // Subscribe to realtime notifications
      const channel = supabase
        .channel('notifications-count')
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
    }
  }, [user?.id]);

  return (
    <header className="flex-none bg-card border-b border-border z-30 sticky top-0">
      <div className="flex items-center justify-between px-3 h-14 md:h-16 md:px-4">
        {/* Menu Button - Mobile */}
        <button 
          onClick={onMenuClick}
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors lg:hidden"
        >
          <span className="material-symbols-outlined text-foreground text-[24px]">menu</span>
        </button>
        
        {/* Logo - Mobile */}
        <div className="w-20 lg:hidden">
          <SafepayLogo />
        </div>
        
        {/* Title - Desktop */}
        <div className="hidden lg:block">
          <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
        </div>
        
        {/* Notifications */}
        <Link 
          to="/notifications"
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors relative"
        >
          <span className="material-symbols-outlined text-foreground text-[22px]">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-card"></span>
          )}
        </Link>
      </div>
    </header>
  );
}
