import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MerchantSidebar } from '@/components/merchant/MerchantSidebar';
import { MerchantHeader } from '@/components/merchant/MerchantHeader';
import { MerchantNavProvider } from '@/components/merchant/MerchantNavContext';
import { MerchantProfileProvider, type MerchantProfileRow } from '@/components/merchant/MerchantProfileContext';

export function MerchantLayout() {
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<MerchantProfileRow | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/merchant-login', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!merchant?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('merchants')
          .select('id, user_id, business_name, business_category, business_email, business_phone, business_logo_url, verification_status, is_active, public_merchant_id')
          .eq('id', merchant.id)
          .single();
        if (!cancelled && data) {
          setProfile(data as MerchantProfileRow);
        }
      } catch {
        // profile fetch failure is non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [merchant?.id]);

  if (authLoading || !isAuthenticated || !merchant) {
    return <FullPageLoading />;
  }

  return (
    <SidebarProvider>
      <MerchantProfileProvider value={profile}>
        <MerchantNavProvider merchantId={merchant.id} userId={profile?.user_id ?? null}>
          <div className="flex min-h-svh w-full">
            <MerchantSidebar />
            <SidebarInset className="min-w-0 flex-1">
              <MerchantHeader />
              <main className="flex-1">
                <Outlet />
              </main>
            </SidebarInset>
          </div>
        </MerchantNavProvider>
      </MerchantProfileProvider>
    </SidebarProvider>
  );
}
