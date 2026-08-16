import { Link, useLocation } from 'react-router-dom';
import { Home, Package, Link2, Plug, Gavel, Wallet, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MerchantBottomNavProps {
  className?: string;
}

const NAV_ITEMS = [
  { title: 'Home', icon: Home, path: '/merchant-dashboard' },
  { title: 'Orders', icon: Package, path: '/merchant-orders' },
  { title: 'Links', icon: Link2, path: '/payment-links' },
  { title: 'Integration', icon: Plug, path: '/merchant/integration' },
  { title: 'Disputes', icon: Gavel, path: '/merchant-disputes' },
  { title: 'Payouts', icon: Wallet, path: '/merchant-payouts' },
  { title: 'Profile', icon: User, path: '/merchant-profile' },
];

/**
 * Shared bottom navigation for the merchant app. Rendered once per page
 * instead of being copy-pasted across files.
 */
export function MerchantBottomNav({ className }: MerchantBottomNavProps) {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className={cn('fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-30 safe-bottom', className)}>
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-1.5 px-3 touch-target',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('w-5 h-5', active && 'fill-primary/10')} />
              <span className={cn('text-[10px]', active ? 'font-semibold' : 'font-medium')}>{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
