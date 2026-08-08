import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SafepayLogo } from '@/components/ui/SafepayLogo';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { title: 'Dashboard', icon: 'dashboard', path: '/dashboard' },
  { title: 'New Payment', icon: 'add_circle', path: '/payment/new' },
  { title: 'Orders', icon: 'shopping_bag', path: '/orders' },
  { title: 'Transactions', icon: 'receipt_long', path: '/transactions' },
  { title: 'Disputes', icon: 'gavel', path: '/disputes' },
  { title: 'Refunds', icon: 'currency_rupee', path: '/refunds' },
  { title: 'Wallet', icon: 'account_balance_wallet', path: '/wallet' },
  { title: 'Profile', icon: 'person', path: '/profile' },
  { title: 'Settings', icon: 'settings', path: '/settings/security' },
  { title: 'Help & Support', icon: 'help', path: '/help' },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/customer-login');
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-[280px] bg-card border-r border-border z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border h-14 md:h-16">
            <div className="w-24">
              <SafepayLogo />
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-muted active:bg-muted/80 lg:hidden"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || 
                (item.path === '/dashboard' && location.pathname === '/dashboard');
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors min-h-[48px]",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-muted active:bg-muted/80 hover:text-foreground"
                  )}
                >
                  <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                  <span className="font-medium text-sm">{item.title}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-3 border-t border-border">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-destructive hover:bg-destructive/10 active:bg-destructive/15 w-full transition-colors min-h-[48px]"
            >
              <span className="material-symbols-outlined text-[22px]">logout</span>
              <span className="font-medium text-sm">Log Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
