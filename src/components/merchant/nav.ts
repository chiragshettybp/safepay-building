import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Building2,
  Gavel,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  Package,
  PackageSearch,
  Plug,
  Settings,
  Truck,
  Undo2,
  Users,
  Wallet,
} from 'lucide-react';

export type MerchantNavBadge = 'orders' | 'shipments' | 'disputes' | 'notifications';

export interface MerchantNavChild {
  label: string;
  path: string;
}

export interface MerchantNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  badge?: MerchantNavBadge;
  /** Extra paths that count as "this item is active" (e.g. detail pages). */
  activePaths?: string[];
  children?: MerchantNavChild[];
}

export interface MerchantNavGroup {
  id: string;
  label: string;
  items: MerchantNavItem[];
}

export const MERCHANT_NAV: MerchantNavGroup[] = [
  {
    id: 'main',
    label: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/merchant-dashboard' },
      {
        id: 'orders',
        label: 'Orders',
        icon: Package,
        path: '/merchant-orders',
        badge: 'orders',
        activePaths: ['/merchant-orders', '/merchant-order', '/merchant-add-tracking', '/merchant-edit-tracking', '/merchant-delivery-proof'],
        children: [
          { label: 'All Orders', path: '/merchant-orders' },
          { label: 'Pending', path: '/merchant-orders?status=pending' },
          { label: 'In Transit', path: '/merchant-orders?status=in_transit' },
          { label: 'Delivered', path: '/merchant-orders?status=delivered' },
          { label: 'Completed', path: '/merchant-orders?status=completed' },
          { label: 'Disputed', path: '/merchant-orders?status=disputed' },
        ],
      },
      { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight, path: '/merchant-transactions', activePaths: ['/merchant-transactions'] },
      { id: 'wallet', label: 'Wallet', icon: Wallet, path: '/merchant-payouts', activePaths: ['/merchant-payouts', '/merchant-withdraw'] },
      {
        id: 'shipments',
        label: 'Shipments',
        icon: Truck,
        path: '/merchant-shipments',
        badge: 'shipments',
        activePaths: ['/merchant-shipments'],
      },
      { id: 'disputes', label: 'Disputes', icon: Gavel, path: '/merchant-disputes', badge: 'disputes', activePaths: ['/merchant-disputes', '/merchant-dispute-response', '/merchant-dispute-upload', '/merchant-dispute-result'] },
      { id: 'customers', label: 'Customers', icon: Users, path: '/merchant-customers' },
      { id: 'products', label: 'Products', icon: PackageSearch, path: '/merchant-products', activePaths: ['/merchant-products'] },
      { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/merchant-analytics' },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    items: [
      { id: 'business-profile', label: 'Business Profile', icon: Building2, path: '/merchant-profile' },
      { id: 'payment-links', label: 'Payment Links', icon: Link2, path: '/payment-links' },
      { id: 'checkout', label: 'Checkout', icon: Plug, path: '/merchant/integration', activePaths: ['/merchant/integration'] },
      { id: 'payouts', label: 'Payouts', icon: Landmark, path: '/merchant-payout-history' },
      { id: 'refunds', label: 'Refunds', icon: Undo2, path: '/merchant-refunds' },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      { id: 'notifications', label: 'Notifications', icon: Bell, path: '/merchant-notifications', badge: 'notifications' },
      { id: 'support', label: 'Support', icon: LifeBuoy, path: '/merchant-support' },
      { id: 'settings', label: 'Settings', icon: Settings, path: '/merchant-settings' },
    ],
  },
];

/** True when the current location matches an item (including its children/active paths). */
export function isNavItemActive(item: MerchantNavItem, pathname: string, search: string): boolean {
  const candidates = [item.path ?? '', ...(item.activePaths ?? []), ...(item.children ?? []).map((c) => c.path.split('?')[0])].filter(Boolean);
  if (candidates.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true;
  if (item.children?.some((c) => c.path === `${pathname}${search}`)) return true;
  return false;
}

export function isNavChildActive(child: MerchantNavChild, pathname: string, search: string): boolean {
  return `${pathname}${search}` === child.path;
}
