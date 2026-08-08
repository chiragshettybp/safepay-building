import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

interface PrivacyPrefs {
  profile_visibility: 'public' | 'private';
  show_activity: boolean;
}

const DEFAULTS: PrivacyPrefs = {
  profile_visibility: 'public',
  show_activity: true,
};

export default function PrivacySettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<PrivacyPrefs>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const fetchPrefs = async () => {
      const { data } = await supabase
        .from('user_preferences')
        .select('profile_visibility, show_activity')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setPrefs({
          profile_visibility: data.profile_visibility,
          show_activity: data.show_activity,
        });
      }
      setIsLoading(false);
    };

    fetchPrefs();
  }, [user?.id]);

  const save = async (next: PrivacyPrefs) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          profile_visibility: next.profile_visibility,
          show_activity: next.show_activity,
        }, { onConflict: 'user_id' });

      if (error) throw error;
      setPrefs(next);
      toast({ title: 'Privacy settings saved', description: 'Your preferences have been updated.' });
    } catch (error) {
      console.error('Save privacy error:', error);
      toast({ title: 'Error', description: 'Failed to save privacy settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!user?.id) return;
    setExporting(true);
    try {
      const [profile, orders, refunds, disputes, tickets] = await Promise.all([
        supabase.from('profiles').select('id, phone, email, full_name, address, city, country, created_at').eq('id', user.id).maybeSingle(),
        supabase.from('orders').select('id, order_number, product_name, amount, currency, status, created_at').eq('customer_id', user.id),
        supabase.from('refunds').select('id, order_id, amount, currency, status, reason, created_at, completed_at').eq('customer_id', user.id),
        supabase.from('disputes').select('id, order_id, reason, status, resolution, created_at, resolved_at').eq('customer_id', user.id),
        supabase.from('support_tickets').select('id, subject, category, status, created_at').eq('customer_id', user.id),
      ]);

      const payload = {
        exported_at: new Date().toISOString(),
        profile: profile.data || null,
        orders: orders.data || [],
        refunds: refunds.data || [],
        disputes: disputes.data || [],
        support_tickets: tickets.data || [],
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `safepay-data-${user.id.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: 'Data exported', description: 'Your data download has started.' });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'Error', description: 'Failed to export your data', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

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
            <h1 className="text-sm sm:text-base font-semibold text-foreground">Privacy</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Control your data & visibility</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto mobile-section pb-24 space-y-5">
        {/* Visibility */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">visibility</span>
            Profile Visibility
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => save({ ...prefs, profile_visibility: 'public' })}
              disabled={saving}
              className={`p-3 rounded-xl border text-left transition-colors ${
                prefs.profile_visibility === 'public'
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-muted/40 hover:bg-muted/70'
              }`}
            >
              <p className="text-sm font-medium text-foreground">Public</p>
              <p className="text-xs text-muted-foreground mt-0.5">Other users can view your profile</p>
            </button>
            <button
              onClick={() => save({ ...prefs, profile_visibility: 'private' })}
              disabled={saving}
              className={`p-3 rounded-xl border text-left transition-colors ${
                prefs.profile_visibility === 'private'
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-muted/40 hover:bg-muted/70'
              }`}
            >
              <p className="text-sm font-medium text-foreground">Private</p>
              <p className="text-xs text-muted-foreground mt-0.5">Only you can view your profile</p>
            </button>
          </div>
        </div>

        {/* Activity */}
        <div className="flex items-center gap-3.5 p-4 bg-card border border-border rounded-xl">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-lg">receipt_long</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Show Order Activity</p>
            <p className="text-xs text-muted-foreground">Display recent orders and activity on your profile</p>
          </div>
          <Switch
            checked={prefs.show_activity}
            onCheckedChange={(checked) => save({ ...prefs, show_activity: checked })}
            disabled={saving}
          />
        </div>

        {/* Data & privacy actions */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <h2 className="text-sm font-semibold text-foreground px-4 pt-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">shield</span>
            Your Data
          </h2>
          <div className="p-4">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              className="w-full h-11 rounded-xl text-sm"
            >
              <span className="material-symbols-outlined text-base mr-2">download</span>
              {exporting ? 'Exporting...' : 'Download My Data'}
            </Button>
          </div>
          <div className="border-t border-border">
            <Link to="/privacy-policy" className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Privacy Policy</p>
                <p className="text-xs text-muted-foreground">How Safepay handles your data</p>
              </div>
              <span className="material-symbols-outlined text-muted-foreground">chevron_right</span>
            </Link>
          </div>
          <div className="border-t border-border">
            <Link to="/delete-account" className="flex items-center gap-3 p-4 hover:bg-destructive/5 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive">Delete My Account</p>
                <p className="text-xs text-muted-foreground">Permanently remove your account and data</p>
              </div>
              <span className="material-symbols-outlined text-destructive">chevron_right</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
