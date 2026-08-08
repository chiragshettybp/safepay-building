import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface MerchantData {
  public_merchant_id: string;
  business_name: string;
  business_category: string;
  business_email: string | null;
  business_phone: string | null;
  business_address: string | null;
  business_city: string | null;
  business_state: string | null;
  business_pincode: string | null;
  business_logo_url: string | null;
  gst_number: string | null;
  verification_status: string;
  verified_at: string | null;
  is_active: boolean;
  total_orders: number;
  total_revenue: number;
  average_rating: number | null;
  created_at: string;
}

export default function MerchantProfile() {
  const { user, merchant, logout, isLoading } = useMerchantAuth();
  const navigate = useNavigate();
  const [merchantData, setMerchantData] = useState<MerchantData | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/merchant-login');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (merchant?.id) {
      fetchMerchantData();

      const channel = supabase
        .channel('merchant-profile-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'merchants',
          filter: `id=eq.${merchant.id}`
        }, () => fetchMerchantData())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [merchant?.id]);

  const fetchMerchantData = async () => {
    if (!merchant?.id) return;

    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', merchant.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching merchant:', error);
        return;
      }

      if (data) {
        setMerchantData(data);
      }
    } catch (error) {
      console.error('Error fetching merchant:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/merchant-login');
  };

  const getVerificationDisplay = () => {
    const status = merchantData?.verification_status || merchant?.verificationStatus || 'pending';
    switch (status) {
      case 'approved':
        return { label: 'Verified', color: 'text-success', bg: 'bg-success/10', icon: 'verified' };
      case 'pending':
        return { label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: 'hourglass_top' };
      case 'rejected':
        return { label: 'Rejected', color: 'text-destructive', bg: 'bg-destructive/10', icon: 'cancel' };
      default:
        return { label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: 'hourglass_top' };
    }
  };

  if (isLoading || loadingData) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const verification = getVerificationDisplay();
  const displayName = merchantData?.business_name || merchant?.businessName || 'Business';
  const category = merchantData?.business_category || merchant?.businessCategory || 'General';

  return (
    <div className="mobile-page">
      {/* Header */}
      <header className="sticky-header bg-card">
        <div className="sticky-header-content px-4 sm:px-6">
          <button
            onClick={() => navigate('/merchant-dashboard')}
            className="back-btn"
          >
            <span className="material-symbols-outlined text-xl sm:text-2xl">arrow_back</span>
          </button>
          <h1 className="text-sm sm:text-base font-semibold text-foreground">Business Profile</h1>
          <Link to="/merchant-profile/edit">
            <Button variant="ghost" size="sm" className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3">
              Edit
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto mobile-section pb-28 sm:pb-24">
        {/* Business Identity */}
        <div className="flex flex-col items-center mb-5 sm:mb-8">
          <div className="w-[72px] h-[72px] sm:w-24 sm:h-24 rounded-2xl bg-primary/10 flex items-center justify-center mb-2.5 sm:mb-4 overflow-hidden border-2 border-primary/20">
            {merchantData?.business_logo_url ? (
              <img
                src={merchantData.business_logo_url}
                alt="Business logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="material-symbols-outlined text-primary text-3xl sm:text-5xl">storefront</span>
            )}
          </div>
          <h2 className="text-base sm:text-xl font-bold text-foreground text-center">{displayName}</h2>
          <p className="text-muted-foreground text-xs sm:text-sm capitalize">{category}</p>
          <div className={`mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full ${verification.bg}`}>
            <span className={`material-symbols-outlined text-sm ${verification.color}`}>{verification.icon}</span>
            <span className={`text-[11px] sm:text-xs font-medium ${verification.color}`}>{verification.label}</span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-5 sm:mb-6">
          <div className="bg-card border border-border rounded-xl p-3 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-foreground">{merchantData?.total_orders ?? 0}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Orders</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-foreground">
              ₹{((merchantData?.total_revenue ?? 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Revenue</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-foreground">
              {merchantData?.average_rating ? merchantData.average_rating.toFixed(1) : '—'}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Rating</p>
          </div>
        </div>

        {/* Info Cards */}
        <div className="space-y-2.5 sm:space-y-4">
          {/* Business Info */}
          <div className="info-card p-3.5 sm:p-4">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-2.5 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
              <span className="material-symbols-outlined text-primary text-base sm:text-lg">store</span>
              Business Information
            </h3>
            <div className="space-y-2.5 sm:space-y-3">
              <div className="flex justify-between items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Business Name</span>
                <span className="text-xs sm:text-sm font-medium text-foreground truncate">{displayName}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Category</span>
                <span className="text-xs sm:text-sm font-medium text-foreground capitalize">{category}</span>
              </div>
              {merchantData?.gst_number && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground shrink-0">GST Number</span>
                  <span className="text-xs sm:text-sm font-medium text-foreground font-mono">{merchantData.gst_number}</span>
                </div>
              )}
              <div className="flex justify-between items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Status</span>
                <span className={`text-xs sm:text-sm font-medium ${merchantData?.is_active ? 'text-success' : 'text-destructive'}`}>
                  {merchantData?.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="info-card p-3.5 sm:p-4">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-2.5 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
              <span className="material-symbols-outlined text-primary text-base sm:text-lg">contact_phone</span>
              Contact Details
            </h3>
            <div className="space-y-2.5 sm:space-y-3">
              <div className="flex justify-between items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Phone</span>
                <span className="text-xs sm:text-sm font-medium text-foreground">{merchantData?.business_phone || user?.phone || 'Not set'}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Email</span>
                <span className="text-xs sm:text-sm font-medium text-foreground truncate max-w-[160px]">{merchantData?.business_email || 'Not set'}</span>
              </div>
              {merchantData?.business_address && (
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Address</span>
                  <span className="text-xs sm:text-sm font-medium text-foreground text-right max-w-[180px]">
                    {[merchantData.business_address, merchantData.business_city, merchantData.business_state, merchantData.business_pincode]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Account Info */}
          <div className="info-card p-3.5 sm:p-4">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-2.5 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
              <span className="material-symbols-outlined text-primary text-base sm:text-lg">info</span>
              Account Information
            </h3>
            <div className="space-y-2.5 sm:space-y-3">
              <div className="flex justify-between items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Merchant ID</span>
                <span className="text-[10px] sm:text-xs font-mono text-muted-foreground truncate max-w-[160px]">{merchantData?.public_merchant_id || `${merchant?.id?.slice(0, 8)}...`}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Member Since</span>
                <span className="text-xs sm:text-sm font-medium text-foreground">
                  {merchantData?.created_at ? format(new Date(merchantData.created_at), 'MMM d, yyyy') : '—'}
                </span>
              </div>
              {merchantData?.verified_at && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Verified On</span>
                  <span className="text-xs sm:text-sm font-medium text-foreground">
                    {format(new Date(merchantData.verified_at), 'MMM d, yyyy')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-5 sm:mt-8 space-y-2">
          <Link
            to="/merchant-payouts"
            className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-lg sm:text-xl">payments</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm sm:text-base">Payouts</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Withdraw & payout history</p>
            </div>
            <span className="material-symbols-outlined text-muted-foreground text-lg sm:text-xl shrink-0">chevron_right</span>
          </Link>

          <Link
            to="/merchant-bank-account"
            className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-blue-600 text-lg sm:text-xl">account_balance</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm sm:text-base">Bank Accounts</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Manage bank accounts</p>
            </div>
            <span className="material-symbols-outlined text-muted-foreground text-lg sm:text-xl shrink-0">chevron_right</span>
          </Link>

          <Link
            to="/merchant-disputes"
            className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-amber-600 text-lg sm:text-xl">gavel</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm sm:text-base">Disputes</p>
              <p className="text-xs sm:text-sm text-muted-foreground">View & respond to disputes</p>
            </div>
            <span className="material-symbols-outlined text-muted-foreground text-lg sm:text-xl shrink-0">chevron_right</span>
          </Link>

          <Link
            to="/merchant-refunds"
            className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-success text-lg sm:text-xl">currency_rupee</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm sm:text-base">Refunds</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Refunds issued on your orders</p>
            </div>
            <span className="material-symbols-outlined text-muted-foreground text-lg sm:text-xl shrink-0">chevron_right</span>
          </Link>

          <Link
            to="/merchant-support"
            className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-blue-600 text-lg sm:text-xl">support_agent</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm sm:text-base">Help & Support</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Tickets & contact us</p>
            </div>
            <span className="material-symbols-outlined text-muted-foreground text-lg sm:text-xl shrink-0">chevron_right</span>
          </Link>

          <Link
            to="/merchant-settings"
            className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-lg sm:text-xl">settings</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm sm:text-base">Settings</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Notifications & account</p>
            </div>
            <span className="material-symbols-outlined text-muted-foreground text-lg sm:text-xl shrink-0">chevron_right</span>
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors w-full text-left"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-destructive text-lg sm:text-xl">logout</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-destructive text-sm sm:text-base">Log Out</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Sign out of merchant account</p>
            </div>
          </button>
        </div>
      </main>

      {/* Material Icons */}
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
    </div>
  );
}
