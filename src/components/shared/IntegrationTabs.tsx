import { Link, useLocation } from 'react-router-dom';
import { KeyRound, LayoutDashboard, Plug, Radio, ScrollText, FlaskConical, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { label: 'Overview', icon: LayoutDashboard, path: '/merchant/integration' },
  { label: 'API Keys', icon: KeyRound, path: '/merchant/integration/api-keys' },
  { label: 'Webhooks', icon: Plug, path: '/merchant/integration/webhooks' },
  { label: 'Sessions', icon: Radio, path: '/merchant/integration/sessions' },
  { label: 'Logs', icon: ScrollText, path: '/merchant/integration/logs' },
  { label: 'Test Mode', icon: FlaskConical, path: '/merchant/integration/test' },
  { label: 'Developers', icon: Code2, path: '/merchant/integration/developers' },
];

/**
 * Tab navigation for the Checkout Integration merchant console. Mirrors the
 * mobile-first pill layout used elsewhere in the merchant app.
 */
export function IntegrationTabs({ className }: { className?: string }) {
  const location = useLocation();

  return (
    <nav className={cn('flex gap-1 overflow-x-auto px-4 pb-3 -mx-4 scrollbar-hide', className)}>
      {TABS.map((tab) => {
        const active = tab.path === '/merchant/integration'
          ? location.pathname === tab.path
          : location.pathname.startsWith(tab.path);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors touch-target',
              active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
