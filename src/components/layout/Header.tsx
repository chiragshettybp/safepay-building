import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SafepayLogo } from '@/components/ui/SafepayLogo';
import { Menu, Bell } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/payment/new': 'New Payment',
  '/orders': 'Orders',
  '/transactions': 'Transactions',
  '/disputes': 'Disputes',
  '/refunds': 'Refunds',
  '/wallet': 'Wallet',
  '/wallet/transactions': 'Wallet Transactions',
  '/wallet/withdraw': 'Withdraw Funds',
  '/wallet/bank-account': 'Bank Account',
  '/profile': 'Profile',
  '/settings/security': 'Security',
  '/settings/notifications': 'Notifications',
  '/settings/privacy': 'Privacy',
  '/notifications': 'Notifications',
  '/help': 'Help & Support',
};

export function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user?.id) {
      const fetchNotifications = async () => {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false);

        setUnreadCount(count || 0);
      };

      fetchNotifications();

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

  const title =
    ROUTE_TITLES[location.pathname] ??
    Object.entries(ROUTE_TITLES).find(([path]) => path !== '/dashboard' && location.pathname.startsWith(path + '/'))?.[1] ??
    'Dashboard';

  return (
    <header className="flex-none bg-card border-b border-border z-30 sticky top-0">
      <div className="flex items-center justify-between px-3 h-14 md:h-16 md:px-5">
        <button
          onClick={onMenuClick}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="w-24 sm:w-28 lg:hidden">
          <SafepayLogo size="sm" />
        </div>

        <div className="hidden lg:flex items-center gap-2 min-w-0">
          <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>
        </div>

        <Link
          to="/notifications"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
