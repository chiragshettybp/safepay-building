import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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

export default function NotificationSettings() {
  const { user } = useAuth();
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

  const rows: { key: keyof Preferences; label: string; description: string; icon: string }[] = [
    { key: 'push_notifications', label: 'Push Notifications', description: 'In-app alerts for orders, refunds, disputes and tickets', icon: 'notifications' },
    { key: 'order_updates', label: 'Order Updates', description: 'Status changes, shipping and delivery alerts', icon: 'local_shipping' },
    { key: 'email_notifications', label: 'Email Notifications', description: 'Send important updates to your email', icon: 'mail' },
    { key: 'sms_notifications', label: 'SMS Notifications', description: 'Text alerts for critical account activity', icon: 'sms' },
    { key: 'marketing_emails', label: 'Marketing Emails', description: 'Promotions, offers and product news', icon: 'campaign' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="mobile-page">
      <header className="sticky-header bg-card">
        <div className="sticky-header-content px-4 sm:px-6">
          <button onClick={() => navigate(-1)} className="back-btn">
            <span className="material-symbols-outlined text-xl sm:text-2xl">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-foreground">Notifications</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Choose what you want to hear about</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto mobile-section pb-24">
        <div className="space-y-2.5">
          {rows.map((row) => (
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

        <p className="text-[11px] text-muted-foreground mt-4 px-1 leading-relaxed">
          You can manage how Safepay contacts you. These preferences apply to your account
          across all devices. Critical security and legal notices will always be sent.
        </p>
      </main>
    </div>
  );
}
