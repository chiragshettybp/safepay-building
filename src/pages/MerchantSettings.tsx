import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/toast';
import { Bell, BellRing, ChevronRight, Headphones, LogOut, LucideIcon, Mail, Megaphone, MessageSquare, Store, Truck } from 'lucide-react';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { Switch } from '@/components/ui/switch';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';

interface Preferences {
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  order_updates: boolean;
  marketing_emails: boolean;
}

const DEFAULTS: Preferences = {
  email_notifications: true,
  sms_notifications: true,
  push_notifications: true,
  order_updates: true,
  marketing_emails: false,
};

export default function MerchantSettings() {
  const { user, merchant, logout } = useMerchantAuth();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const fetchPrefs = async () => {
      const { data } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setPrefs({
          email_notifications: data.email_notifications,
          sms_notifications: data.sms_notifications,
          push_notifications: data.push_notifications,
          order_updates: data.order_updates,
          marketing_emails: data.marketing_emails,
        });
      }
      setIsLoading(false);
    };

    fetchPrefs();
  }, [user?.id]);

  const handleToggle = async (key: keyof Preferences, value: boolean) => {
    if (!user?.id) return;

    setPrefs(prev => ({ ...prev, [key]: value }));
    setSavingKey(key);

    try {
      const payload = {
        user_id: user.id,
        ...prefs,
        [key]: value,
      };

      const { error } = await supabase
        .from('user_preferences')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;
      toast({ title: 'Preferences saved', description: 'Your notification preferences have been updated.' });
    } catch (error) {
      console.error('Save preferences error:', error);
      setPrefs(prev => ({ ...prev, [key]: !value }));
      toast({ title: 'Error', description: 'Failed to save preferences', variant: 'destructive' });
    } finally {
      setSavingKey(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/merchant-login');
  };

  if (isLoading) {
    return <FullPageLoading />;
  }

  const toggleRows: { key: keyof Preferences; label: string; description: string; icon: LucideIcon }[] = [
    { key: 'push_notifications', label: 'Push Notifications', description: 'In-app alerts for orders, disputes and payouts', icon: Bell },
    { key: 'order_updates', label: 'Order Updates', description: 'New orders, tracking and delivery alerts', icon: Truck },
    { key: 'email_notifications', label: 'Email Notifications', description: 'Important updates to your business email', icon: Mail },
    { key: 'sms_notifications', label: 'SMS Notifications', description: 'Text alerts for critical account activity', icon: MessageSquare },
    { key: 'marketing_emails', label: 'Marketing Emails', description: 'Offers and product updates from Safepay', icon: Megaphone },
  ];

  return (
    <div className="mobile-page">
      <div className="px-4 sm:px-6 py-4 sm:py-5">
        <MerchantPageHeader
          title="Settings"
          subtitle={merchant?.businessName || 'Account'}
        />
      </div>

      <main className="max-w-2xl mx-auto mobile-section pb-24 space-y-6">
        {/* Notifications */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Notifications</h2>
          <div className="space-y-2.5">
            {toggleRows.map((row) => (
              <div key={row.key} className="flex items-center gap-3.5 p-4 bg-card border border-border rounded-xl">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <row.icon className="h-[18px] w-[18px] text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.description}</p>
                </div>
                <Switch
                  checked={prefs[row.key]}
                  onCheckedChange={(checked) => handleToggle(row.key, checked)}
                  disabled={savingKey === row.key}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Account */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Account</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Link to="/merchant-profile" className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Store className="h-[18px] w-[18px] text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Business Profile</p>
                <p className="text-xs text-muted-foreground">Edit business information & verification</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link to="/merchant-notifications" className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <BellRing className="h-[18px] w-[18px] text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Notifications</p>
                <p className="text-xs text-muted-foreground">View all notifications</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link to="/merchant-support" className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <Headphones className="h-[18px] w-[18px] text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Help & Support</p>
                <p className="text-xs text-muted-foreground">Contact our support team</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 p-4 hover:bg-destructive/5 transition-colors w-full text-left"
            >
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <LogOut className="h-[18px] w-[18px] text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive">Log Out</p>
                <p className="text-xs text-muted-foreground">Sign out of merchant account</p>
              </div>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
