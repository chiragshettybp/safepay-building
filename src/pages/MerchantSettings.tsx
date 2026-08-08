import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';

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
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const toggleRows: { key: keyof Preferences; label: string; description: string; icon: string }[] = [
    { key: 'push_notifications', label: 'Push Notifications', description: 'In-app alerts for orders, disputes and payouts', icon: 'notifications' },
    { key: 'order_updates', label: 'Order Updates', description: 'New orders, tracking and delivery alerts', icon: 'local_shipping' },
    { key: 'email_notifications', label: 'Email Notifications', description: 'Important updates to your business email', icon: 'mail' },
    { key: 'sms_notifications', label: 'SMS Notifications', description: 'Text alerts for critical account activity', icon: 'sms' },
    { key: 'marketing_emails', label: 'Marketing Emails', description: 'Offers and product updates from Safepay', icon: 'campaign' },
  ];

  return (
    <div className="mobile-page">
      <header className="sticky-header bg-card">
        <div className="sticky-header-content px-4 sm:px-6">
          <button onClick={() => navigate('/merchant-dashboard')} className="back-btn">
            <span className="material-symbols-outlined text-xl sm:text-2xl">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-foreground">Settings</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{merchant?.businessName || 'Account'}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto mobile-section pb-24 space-y-6">
        {/* Notifications */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Notifications</h2>
          <div className="space-y-2.5">
            {toggleRows.map((row) => (
              <div key={row.key} className="flex items-center gap-3.5 p-4 bg-card border border-border rounded-xl">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-lg">{row.icon}</span>
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
                <span className="material-symbols-outlined text-primary text-lg">store</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Business Profile</p>
                <p className="text-xs text-muted-foreground">Edit business information & verification</p>
              </div>
              <span className="material-symbols-outlined text-muted-foreground">chevron_right</span>
            </Link>
            <Link to="/merchant-notifications" className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-blue-600 text-lg">notifications_active</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Notifications</p>
                <p className="text-xs text-muted-foreground">View all notifications</p>
              </div>
              <span className="material-symbols-outlined text-muted-foreground">chevron_right</span>
            </Link>
            <Link to="/merchant-support" className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-amber-600 text-lg">support_agent</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Help & Support</p>
                <p className="text-xs text-muted-foreground">Contact our support team</p>
              </div>
              <span className="material-symbols-outlined text-muted-foreground">chevron_right</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 p-4 hover:bg-destructive/5 transition-colors w-full text-left"
            >
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-destructive text-lg">logout</span>
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
