import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { toast } from '@/lib/toast';
import { BadgeCheck, Headphones, HelpCircle, Hourglass, LayoutDashboard, Mail, RefreshCw, Store, XCircle } from 'lucide-react';
import { ButtonSpinner } from '@/components/shared/LoadingSpinner';

export default function MerchantVerify() {
  const navigate = useNavigate();
  const { user, merchant, isAuthenticated, refreshStatus, logout } = useMerchantAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/merchant-login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Redirect to dashboard if already approved
  useEffect(() => {
    if (merchant?.verificationStatus === 'approved') {
      navigate('/merchant-dashboard', { replace: true });
    }
  }, [merchant, navigate]);

  // Auto-refresh status every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshStatus]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshStatus();
    setIsRefreshing(false);
    
    if (merchant?.verificationStatus === 'approved') {
      toast({
        title: 'Congratulations!',
        description: 'Your merchant account has been approved.',
      });
      navigate('/merchant-dashboard', { replace: true });
    } else if (merchant?.verificationStatus === 'rejected') {
      toast({
        title: 'Account Not Approved',
        description: 'Please check the rejection reason and contact support.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Status Updated',
        description: 'Your application is still under review.',
      });
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/merchant-login', { replace: true });
  };

  const getStatusConfig = () => {
    switch (merchant?.verificationStatus) {
      case 'approved':
        return {
          icon: BadgeCheck,
          color: 'text-success',
          bgColor: 'bg-success/10',
          borderColor: 'border-success/20',
          title: 'Account Approved',
          description: 'Your merchant account has been verified. You can now access your dashboard.',
        };
      case 'rejected':
        return {
          icon: XCircle,
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          borderColor: 'border-destructive/20',
          title: 'Account Not Approved',
          description: 'Unfortunately, your merchant application was not approved. Please see the reason below.',
        };
      default:
        return {
          icon: Hourglass,
          color: 'text-warning',
          bgColor: 'bg-warning/10',
          borderColor: 'border-warning/20',
          title: 'Verification Pending',
          description: 'Your merchant account is being reviewed. This typically takes 1-2 business days.',
        };
    }
  };

  const statusConfig = getStatusConfig();

  if (!isAuthenticated || !merchant) {
    return null;
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold text-foreground">Merchant Portal</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-center px-4 py-8">
        <div className="w-full max-w-md mx-auto">
          {/* Status Card */}
          <div className={`rounded-2xl ${statusConfig.bgColor} border ${statusConfig.borderColor} p-6 text-center mb-6`}>
            <div className={`w-20 h-20 rounded-full ${statusConfig.bgColor} flex items-center justify-center mx-auto mb-4`}>
              <statusConfig.icon className={`h-12 w-12 ${statusConfig.color}`} />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">{statusConfig.title}</h1>
            <p className="text-muted-foreground text-sm">{statusConfig.description}</p>
          </div>

          {/* Business Info */}
          <div className="bg-muted/30 rounded-xl p-4 mb-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Business Details</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Business Name</span>
                <span className="text-sm font-medium text-foreground">{merchant.businessName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Contact</span>
                <span className="text-sm font-medium text-foreground">{user?.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Category</span>
                <span className="text-sm font-medium text-foreground capitalize">
                  {merchant.businessCategory || 'General'}
                </span>
              </div>
            </div>
          </div>

          {/* Status-specific content */}
          {merchant.verificationStatus === 'pending' && (
            <>
              {/* What happens next */}
              <div className="space-y-3 mb-6">
                <h2 className="text-sm font-semibold text-foreground">What happens next?</h2>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">1</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Document Review</p>
                      <p className="text-xs text-muted-foreground">Our team will verify your business information</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-muted-foreground">2</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Approval Notification</p>
                      <p className="text-xs text-muted-foreground">You'll receive an SMS when approved</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-muted-foreground">3</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Start Selling</p>
                      <p className="text-xs text-muted-foreground">Accept payments with SafePay protection</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Refresh Button */}
              <Button
                onClick={handleRefresh}
                variant="outline"
                className="w-full h-12"
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <span className="flex items-center gap-2">
                    <ButtonSpinner className="h-4 w-4" />
                    Checking Status...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-[18px] w-[18px]" />
                    Check Verification Status
                  </span>
                )}
              </Button>
            </>
          )}

          {merchant.verificationStatus === 'approved' && (
            <Link to="/merchant-dashboard">
              <Button className="w-full h-12">
                <LayoutDashboard className="h-5 w-5 mr-2" />
                Go to Dashboard
              </Button>
            </Link>
          )}

          {merchant.verificationStatus === 'rejected' && (
            <div className="space-y-4">
              {/* Rejection Reason */}
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
                <h3 className="text-sm font-medium text-destructive mb-2">Reason for Rejection</h3>
                <p className="text-sm text-foreground">
                  Your application could not be approved at this time. Please contact our support team for more details.
                </p>
              </div>

              {/* Contact Support */}
              <Button variant="outline" className="w-full h-12">
                <Headphones className="h-5 w-5 mr-2" />
                Contact Support
              </Button>

              {/* Reapply */}
              <Button
                onClick={() => navigate('/merchant-signup')}
                className="w-full h-12"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Submit New Application
              </Button>
            </div>
          )}

          {/* Help Section */}
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-center justify-center gap-4 text-sm">
              <Link to="/merchant-support" className="text-primary hover:underline flex items-center gap-1">
                <HelpCircle className="h-[18px] w-[18px]" />
                Help Center
              </Link>
              <span className="text-muted-foreground">•</span>
              <a href="mailto:support@safepay.com" className="text-primary hover:underline flex items-center gap-1">
                <Mail className="h-[18px] w-[18px]" />
                Email Support
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <div className="px-4 pb-6">
        <p className="text-center text-xs text-muted-foreground">
          Logged in as {user?.phone}
        </p>
      </div>
    </div>
  );
}
