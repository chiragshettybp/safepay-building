import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  ChevronRight,
  HelpCircle,
  Info,
  Lock,
  LogOut,
  Pencil,
  Scale,
  ShieldCheck,
  User,
  Wallet,
} from 'lucide-react';

interface KycRecord {
  status: string;
  kyc_level: string;
  verified_at: string | null;
}

interface ProfileData {
  avatar_url: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  last_login_at: string | null;
  created_at: string;
}

export default function Profile() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const [kycRecord, setKycRecord] = useState<KycRecord | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/customer-login');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user?.id) {
      fetchProfileData();
      fetchKycRecord();
      
      // Set up realtime subscriptions
      const channel = supabase
        .channel('profile-kyc-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'kyc_records',
          filter: `customer_id=eq.${user.id}`
        }, () => fetchKycRecord())
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        }, () => fetchProfileData())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id]);

  const fetchProfileData = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url, address, city, country, last_login_at, created_at')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }
      
      if (data) {
        setProfileData(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchKycRecord = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('kyc_records')
        .select('status, kyc_level, verified_at')
        .eq('customer_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching KYC record:', error);
        return;
      }
      
      setKycRecord(data);
    } catch (error) {
      console.error('Error fetching KYC record:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/customer-login');
  };

  const getKycStatusDisplay = () => {
    if (!kycRecord || kycRecord.status === 'not_started') {
      return { label: 'Not Started', color: 'text-muted-foreground', bg: 'bg-muted' };
    }
    switch (kycRecord.status) {
      case 'approved':
        return { label: 'Verified', color: 'text-success', bg: 'bg-success/10' };
      case 'pending_review':
      case 'submitted':
        return { label: 'Under Review', color: 'text-warning', bg: 'bg-warning/10' };
      case 'rejected':
        return { label: 'Rejected', color: 'text-destructive', bg: 'bg-destructive/10' };
      case 'incomplete':
        return { label: 'Incomplete', color: 'text-warning', bg: 'bg-warning/10' };
      default:
        return { label: 'Not Started', color: 'text-muted-foreground', bg: 'bg-muted' };
    }
  };

  const getKycLevelDisplay = () => {
    if (!kycRecord) return 'None';
    switch (kycRecord.kyc_level) {
      case 'verified': return 'Full Verified';
      case 'basic': return 'Basic';
      default: return 'None';
    }
  };

  if (isLoading || loadingData) {
    return <FullPageLoading />;
  }

  const kycStatus = getKycStatusDisplay();

  return (
    <div className="mobile-page">
      {/* Header */}
      <header className="sticky-header bg-card">
        <div className="sticky-header-content px-4 sm:px-6">
          <button 
            onClick={() => navigate('/dashboard')}
            className="back-btn"
          >
            <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <h1 className="text-sm sm:text-base font-semibold text-foreground">Profile</h1>
          <Link to="/profile/edit">
            <Button variant="ghost" size="sm" className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3">
              Edit
            </Button>
          </Link>
        </div>
      </header>

      {/* Profile Content */}
      <main className="max-w-2xl mx-auto mobile-section pb-28 sm:pb-24">
        {/* Avatar & Name */}
        <div className="flex flex-col items-center mb-5 sm:mb-8">
          <div className="w-[72px] h-[72px] sm:w-24 sm:h-24 rounded-full bg-primary/10 flex items-center justify-center mb-2.5 sm:mb-4 overflow-hidden">
            {profileData?.avatar_url ? (
              <img 
                src={profileData.avatar_url} 
                alt="User profile photo" 
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="text-primary h-7 w-7 sm:h-10 sm:w-10" />
            )}
          </div>
          <h2 className="text-base sm:text-xl font-bold text-foreground">
            {user?.fullName || 'User'}
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm">{user?.phone}</p>
          <p className="text-muted-foreground text-[10px] sm:text-xs mt-0.5 sm:mt-1">{user?.email}</p>
        </div>

        {/* Profile Info Cards */}
        <div className="space-y-2.5 sm:space-y-4">
          {/* Personal Info Card */}
          <div className="info-card p-3.5 sm:p-4">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-2.5 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
              <User className="text-primary h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              Personal Information
            </h3>
            <div className="space-y-2.5 sm:space-y-3">
              <div className="flex justify-between items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Full Name</span>
                <span className="text-xs sm:text-sm font-medium text-foreground truncate">{user?.fullName || 'Not set'}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Email</span>
                <span className="text-xs sm:text-sm font-medium text-foreground truncate max-w-[160px] sm:max-w-[180px]">{user?.email || 'Not added'}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Phone</span>
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span className="text-xs sm:text-sm font-medium text-foreground truncate">{user?.phone}</span>
                  <span className="text-[9px] sm:text-[10px] bg-success/10 text-success px-1 sm:px-1.5 py-0.5 rounded shrink-0">Verified</span>
                </div>
              </div>
            </div>
          </div>

          {/* Account Info Card */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Info className="text-primary h-[18px] w-[18px]" />
              Account Information
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">User ID</span>
                <span className="text-xs font-mono text-muted-foreground truncate max-w-[140px]">{user?.id?.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Member Since</span>
                <span className="text-sm font-medium text-foreground">
                  {profileData?.created_at ? format(new Date(profileData.created_at), 'MMM d, yyyy') : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Last Login</span>
                <span className="text-sm font-medium text-foreground">
                  {profileData?.last_login_at ? format(new Date(profileData.last_login_at), 'MMM d, yyyy h:mm a') : 'Current session'}
                </span>
              </div>
            </div>
          </div>

          {/* KYC Status Card */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BadgeCheck className="text-primary h-[18px] w-[18px]" />
                KYC Verification
              </h3>
              <span className={`text-xs px-2 py-1 rounded-full ${kycStatus.bg} ${kycStatus.color}`}>
                {kycStatus.label}
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">KYC Level</span>
                <span className="text-sm font-medium text-foreground">{getKycLevelDisplay()}</span>
              </div>
              {kycRecord?.verified_at && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Verified On</span>
                  <span className="text-sm font-medium text-foreground">
                    {format(new Date(kycRecord.verified_at), 'MMM d, yyyy')}
                  </span>
                </div>
              )}
              <Link to="/profile/kyc">
                <Button 
                  variant={kycRecord?.status === 'approved' ? 'outline' : 'default'} 
                  size="sm" 
                  className="w-full mt-2"
                >
                  {!kycRecord || kycRecord.status === 'not_started' 
                    ? 'Start KYC Verification'
                    : kycRecord.status === 'incomplete'
                    ? 'Continue KYC'
                    : kycRecord.status === 'approved'
                    ? 'View KYC Details'
                    : kycRecord.status === 'rejected'
                    ? 'Resubmit KYC'
                    : 'View KYC Status'
                  }
                </Button>
              </Link>
            </div>
          </div>

          {/* Wallet Quick Link */}
          <Link 
            to="/wallet"
            className="flex items-center gap-3 sm:gap-4 p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Wallet className="text-primary h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm">Wallet</p>
              <p className="text-xs text-muted-foreground">View balance & transactions</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </Link>
        </div>

        {/* Quick Links */}
        <div className="mt-6 sm:mt-8 space-y-2">
          <Link 
            to="/disputes"
            className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
              <Scale className="text-amber-600 h-[18px] w-[18px] sm:h-5 sm:w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm sm:text-base">My Disputes</p>
              <p className="text-xs sm:text-sm text-muted-foreground">View & track disputes</p>
            </div>
            <ChevronRight className="h-[18px] w-[18px] sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
          </Link>

          <Link 
            to="/settings/security"
            className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="text-primary h-[18px] w-[18px] sm:h-5 sm:w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm sm:text-base">Security Settings</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Password, sessions</p>
            </div>
            <ChevronRight className="h-[18px] w-[18px] sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
          </Link>

          <Link 
            to="/settings/notifications"
            className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Bell className="text-emerald-600 h-[18px] w-[18px] sm:h-5 sm:w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm sm:text-base">Notification Settings</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Choose what you hear about</p>
            </div>
            <ChevronRight className="h-[18px] w-[18px] sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
          </Link>

          <Link 
            to="/settings/privacy"
            className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="text-purple-600 h-[18px] w-[18px] sm:h-5 sm:w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm sm:text-base">Privacy Settings</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Data, visibility & exports</p>
            </div>
            <ChevronRight className="h-[18px] w-[18px] sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
          </Link>

          <Link 
            to="/help"
            className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <HelpCircle className="text-blue-600 h-[18px] w-[18px] sm:h-5 sm:w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm sm:text-base">Help & Support</p>
              <p className="text-xs sm:text-sm text-muted-foreground">FAQs, contact us</p>
            </div>
            <ChevronRight className="h-[18px] w-[18px] sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
          </Link>

          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors w-full text-left"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <LogOut className="text-destructive h-[18px] w-[18px] sm:h-5 sm:w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-destructive text-sm sm:text-base">Log Out</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Sign out of your account</p>
            </div>
          </button>
        </div>
      </main>

      {/* Sticky Edit Button (Mobile) */}
      <div className="bottom-action sm:hidden">
        <Link to="/profile/edit" className="block">
          <Button className="bottom-action-btn bg-primary text-primary-foreground">
            <Pencil className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
            Edit Profile
          </Button>
        </Link>
      </div>
    </div>
  );
}
