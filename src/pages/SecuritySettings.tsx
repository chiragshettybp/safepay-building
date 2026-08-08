import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function SecuritySettings() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/customer-login');
    }
  }, [user, authLoading, navigate]);

  const handleLogoutAllDevices = async () => {
    await logout();
    toast({
      title: 'Logged out',
      description: 'You have been logged out from all devices.',
    });
    navigate('/customer-login');
  };

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background max-w-[100vw] overflow-x-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="text-foreground flex w-10 h-10 shrink-0 items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <span className="material-symbols-outlined text-xl sm:text-2xl">arrow_back</span>
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-foreground">Security</h1>
          <div className="w-10"></div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Change Password Section */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Change Password</h2>
          <div 
            onClick={() => navigate('/change-password')}
            className="bg-card border border-border rounded-xl p-4 sm:p-6 cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-lg sm:text-xl">lock</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm sm:text-base">Change Password</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Update your account password</p>
              </div>
              <span className="material-symbols-outlined text-muted-foreground text-lg sm:text-xl shrink-0">chevron_right</span>
            </div>
          </div>
        </section>

        {/* Session Management */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Sessions</h2>
          <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-success text-lg sm:text-xl">smartphone</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm sm:text-base">Current Device</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Active now</p>
              </div>
              <span className="text-[10px] sm:text-xs bg-success/10 text-success px-2 py-1 rounded-full shrink-0">
                This device
              </span>
            </div>

            <div className="border-t border-border pt-3 sm:pt-4">
              <Button
                variant="outline"
                onClick={handleLogoutAllDevices}
                className="w-full h-11 sm:h-12 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 text-sm sm:text-base"
              >
                <span className="material-symbols-outlined mr-2 text-lg sm:text-xl">logout</span>
                Log Out All Devices
              </Button>
            </div>
          </div>
        </section>

        {/* Notification Preferences */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Notifications</h2>
          <div
            onClick={() => navigate('/settings/notifications')}
            className="bg-card border border-border rounded-xl p-4 sm:p-6 cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-emerald-600 text-lg sm:text-xl">notifications</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm sm:text-base">Notification Preferences</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Choose what you hear about</p>
              </div>
              <span className="material-symbols-outlined text-muted-foreground text-lg sm:text-xl shrink-0">chevron_right</span>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Privacy & Data</h2>
          <div
            onClick={() => navigate('/settings/privacy')}
            className="bg-card border border-border rounded-xl p-4 sm:p-6 cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-purple-600 text-lg sm:text-xl">shield</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm sm:text-base">Privacy Settings</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Data, visibility & exports</p>
              </div>
              <span className="material-symbols-outlined text-muted-foreground text-lg sm:text-xl shrink-0">chevron_right</span>
            </div>
          </div>
        </section>

        {/* Account Info */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Account</h2>
          <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-lg sm:text-xl">phone</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Login Method</p>
                <p className="font-medium text-foreground text-sm sm:text-base">Phone + Password</p>
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-3 sm:mt-4">
              Your account uses phone number authentication. Email is for notifications only.
            </p>
          </div>
        </section>

        {/* Legal */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Legal</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div
              onClick={() => navigate('/privacy-policy')}
              className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-muted-foreground text-lg sm:text-xl">description</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm sm:text-base">Privacy Policy</p>
              </div>
              <span className="material-symbols-outlined text-muted-foreground text-lg sm:text-xl shrink-0">chevron_right</span>
            </div>
            <div
              onClick={() => navigate('/terms-of-service')}
              className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-muted-foreground text-lg sm:text-xl">gavel</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm sm:text-base">Terms of Service</p>
              </div>
              <span className="material-symbols-outlined text-muted-foreground text-lg sm:text-xl shrink-0">chevron_right</span>
            </div>
            <div
              onClick={() => navigate('/about')}
              className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-muted-foreground text-lg sm:text-xl">info</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm sm:text-base">About Safepay</p>
              </div>
              <span className="material-symbols-outlined text-muted-foreground text-lg sm:text-xl shrink-0">chevron_right</span>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <h2 className="text-base sm:text-lg font-semibold text-destructive mb-3 sm:mb-4">Danger Zone</h2>
          <div
            onClick={() => navigate('/delete-account')}
            className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 sm:p-6 cursor-pointer hover:bg-destructive/10 transition-colors"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-destructive text-lg sm:text-xl">delete_forever</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-destructive text-sm sm:text-base">Delete Account</p>
                <p className="text-xs sm:text-sm text-destructive/70">Permanently remove your account and data</p>
              </div>
              <span className="material-symbols-outlined text-destructive text-lg sm:text-xl shrink-0">chevron_right</span>
            </div>
          </div>
        </section>
      </main>

      {/* Material Icons */}
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
    </div>
  );
}
