import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  LifeBuoy,
  LogOut,
  ShieldCheck,
  Store,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SafepayLogo } from '@/components/ui/SafepayLogo';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useMerchantNav } from '@/components/merchant/MerchantNavContext';
import { useMerchantProfile } from '@/components/merchant/MerchantProfileContext';
import { MERCHANT_NAV, isNavChildActive, isNavItemActive } from '@/components/merchant/nav';

function BadgeValue({ badge, value }: { badge?: string; value?: number }) {
  if (!badge || !value || value <= 0) return null;
  return (
    <SidebarMenuBadge className="min-w-5 h-5 px-1.5 rounded-full text-[10px] font-semibold bg-primary text-primary-foreground">
      {value > 99 ? '99+' : value}
    </SidebarMenuBadge>
  );
}

function MerchantNavMenu() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { logout } = useMerchantAuth();
  const { counts } = useMerchantNav();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (id: string, open: boolean) => {
    setOpenGroups((prev) => ({ ...prev, [id]: open }));
  };

  return (
    <>
      <SidebarContent className="px-2">
        {MERCHANT_NAV.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-wide">
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const active = isNavItemActive(item, pathname, search);
                const childActive = item.children?.some((c) => isNavChildActive(c, pathname, search));
                const hasChildren = !!item.children && item.children.length > 0;
                const isOpen = openGroups[item.id] ?? (active || !!childActive);

                const Icon = item.icon;
                const badgeValue = item.badge ? counts[item.badge] : undefined;

                if (!hasChildren) {
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton asChild isActive={active} size="lg" className="h-11">
                        <Link to={item.path!} className="gap-3">
                          <Icon className="h-5 w-5" />
                          <span className="text-sm font-medium">{item.label}</span>
                          <BadgeValue badge={item.badge} value={badgeValue} />
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <Collapsible key={item.id} open={isOpen} onOpenChange={(o) => toggleGroup(item.id, o)} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton asChild isActive={active} size="lg" className="h-11">
                          <Link to={item.path!} className="gap-3">
                            <Icon className="h-5 w-5" />
                            <span className="text-sm font-medium">{item.label}</span>
                            <BadgeValue badge={item.badge} value={badgeValue} />
                            <ChevronRight
                              className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                              aria-hidden
                            />
                          </Link>
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.children!.map((child) => (
                            <SidebarMenuSubItem key={child.label}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isNavChildActive(child, pathname, search)}
                                className="py-1.5"
                              >
                                <Link to={child.path} className="h-8">
                                  <span className="text-[13px]">{child.label}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-10">
              <Link to="/merchant-support" className="gap-3">
                <LifeBuoy className="h-5 w-5" />
                <span className="text-sm">Help & Support</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="h-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={async () => {
                await logout();
                navigate('/merchant-login', { replace: true });
              }}
            >
              <LogOut className="h-5 w-5" />
              <span className="text-sm">Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}

export function MerchantSidebar() {
  const profile = useMerchantProfile();
  const { merchant } = useMerchantAuth();

  return (
    <Sidebar collapsible="offcanvas" className="top-0">
      <h2 className="sr-only">Merchant navigation</h2>
      <SidebarHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <SafepayLogo showWordmark size="sm" />
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
            {profile?.business_logo_url ? (
              <img src={profile.business_logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Store className="h-[18px] w-[18px] text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">
              {profile?.business_name ?? merchant?.businessName ?? 'Merchant'}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              {profile?.verification_status === 'approved' ? (
                <StatusBadge tone="success" label="Verified Merchant" dot className="text-[10px] px-1.5 py-0" />
              ) : (
                <StatusBadge tone="warning" label="Verification pending" dot className="text-[10px] px-1.5 py-0" />
              )}
            </div>
          </div>
          <ShieldCheck className="h-4 w-4 shrink-0 text-sidebar-accent-foreground" aria-hidden />
        </div>
      </SidebarHeader>
      <SidebarSeparator className="mx-3" />
      <MerchantNavMenu />
    </Sidebar>
  );
}
