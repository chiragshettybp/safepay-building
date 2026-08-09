import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  FileText,
  Info,
  Lock,
  LogOut,
  Phone,
  Scale,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';

export default function SecuritySettings() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

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
    return <FullPageLoading />;
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
            <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
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
                <Lock className="text-primary h-[18px] w-[18px] sm:h-5 sm:w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm sm:text-base">Change Password</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Update your account password</p>
              </div>
              <ChevronRight className="h-[18px] w-[18px] sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
            </div>
          </div>
        </section>

        {/* Session Management */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Sessions</h2>
          <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                <Smartphone className="text-success h-[18px] w-[18px] sm:h-5 sm:w-5" />
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
                <LogOut className="h-[18px] w-[18px] sm:h-5 sm:w-5 mr-2" />
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
                <Bell className="text-emerald-600 h-[18px] w-[18px] sm:h-5 sm:w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm sm:text-base">Notification Preferences</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Choose what you hear about</p>
              </div>
              <ChevronRight className="h-[18px] w-[18px] sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
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
                <ShieldCheck className="text-purple-600 h-[18px] w-[18px] sm:h-5 sm:w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm sm:text-base">Privacy Settings</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Data, visibility & exports</p>
              </div>
              <ChevronRight className="h-[18px] w-[18px] sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
            </div>
          </div>
        </section>

        {/* Account Info */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Account</h2>
          <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="text-primary h-[18px] w-[18px] sm:h-5 sm:w-5" />
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
                <FileText className="text-muted-foreground h-[18px] w-[18px] sm:h-5 sm:w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm sm:text-base">Privacy Policy</p>
              </div>
              <ChevronRight className="h-[18px] w-[18px] sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
            </div>
            <div
              onClick={() => navigate('/terms-of-service')}
              className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Scale className="text-muted-foreground h-[18px] w-[18px] sm:h-5 sm:w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm sm:text-base">Terms of Service</p>
              </div>
              <ChevronRight className="h-[18px] w-[18px] sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
            </div>
            <div
              onClick={() => navigate('/about')}
              className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Info className="text-muted-foreground h-[18px] w-[18px] sm:h-5 sm:w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm sm:text-base">About Safepay</p>
              </div>
              <ChevronRight className="h-[18px] w-[18px] sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
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
                <Trash2 className="text-destructive h-[18px] w-[18px] sm:h-5 sm:w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-destructive text-sm sm:text-base">Delete Account</p>
                <p className="text-xs sm:text-sm text-destructive/70">Permanently remove your account and data</p>
              </div>
              <ChevronRight className="h-[18px] w-[18px] sm:h-5 sm:w-5 text-destructive shrink-0" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
