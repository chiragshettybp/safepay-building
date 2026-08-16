import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  HelpCircle,
  LogOut,
  Menu,
  Settings,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useSidebar } from '@/components/ui/sidebar';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useMerchantNav } from '@/components/merchant/MerchantNavContext';
import { useMerchantProfile } from '@/components/merchant/MerchantProfileContext';

export function MerchantHeader() {
  const { toggleSidebar } = useSidebar();
  const { user, logout } = useMerchantAuth();
  const profile = useMerchantProfile();
  const { counts } = useMerchantNav();
  const navigate = useNavigate();

  const unread = counts.notifications;
  const initial = (profile?.business_name ?? user?.fullName ?? 'M').trim().charAt(0).toUpperCase();

  const handleSignOut = async () => {
    await logout();
    navigate('/merchant-login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/95 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 safe-top sm:px-4">
      <div className="flex min-w-0 items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={toggleSidebar}
          aria-label="Open merchant navigation"
          aria-expanded="false"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex min-w-0 items-center gap-2 lg:hidden">
          <span className="hidden min-w-0 flex-col sm:flex">
            <span className="truncate text-sm font-semibold leading-tight text-foreground">
              {profile?.business_name ?? 'Merchant'}
            </span>
            <span className="text-[11px] leading-tight text-muted-foreground">SafePay</span>
          </span>
        </div>
      </div>

      <div className="hidden min-w-0 flex-1 lg:flex lg:justify-center">
        <p className="max-w-md truncate text-center text-sm font-medium text-foreground">
          {profile?.business_name ?? 'Merchant Dashboard'}
          {profile?.business_category ? (
            <span className="text-muted-foreground"> · {profile.business_category}</span>
          ) : null}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="relative h-11 w-11"
          onClick={() => navigate('/merchant-notifications')}
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-11 items-center gap-2 rounded-full pl-1 pr-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              aria-label="Merchant account menu"
            >
              <Avatar className="h-8 w-8 border border-border">
                {profile?.business_logo_url ? (
                  <AvatarImage src={profile.business_logo_url} alt="" />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {initial}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
                  {profile?.business_logo_url ? (
                    <img src={profile.business_logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {profile?.business_name ?? 'Merchant'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {profile?.business_email ?? user?.phone}
                  </p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 pb-1.5">
              {profile?.verification_status === 'approved' ? (
                <StatusBadge tone="success" label="Verified Merchant" dot className="text-[11px] px-2 py-0.5" />
              ) : (
                <StatusBadge tone="warning" label="Verification pending" dot className="text-[11px] px-2 py-0.5" />
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/merchant-profile" className="cursor-pointer">
                <Building2 className="h-4 w-4" /> View Business
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/merchant-settings" className="cursor-pointer">
                <Settings className="h-4 w-4" /> Account Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/merchant-support" className="cursor-pointer">
                <HelpCircle className="h-4 w-4" /> Help & Support
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onSelect={handleSignOut}
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
