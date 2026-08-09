import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { toast } from '@/lib/toast';
import { AlertCircle, BadgeCheck, Eye, EyeOff, Store, UserPlus } from 'lucide-react';
import { ButtonSpinner } from '@/components/shared/LoadingSpinner';

export default function MerchantLogin() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useMerchantAuth();
  
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate('/merchant-dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(phone, password);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      toast({
        title: 'Welcome back!',
        description: 'You have successfully logged in.',
      });
      navigate('/merchant-dashboard', { replace: true });
    }
  };

  const isFormValid = phone.length >= 10 && password.length >= 8;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center h-14 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold text-foreground">Merchant Portal</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-center px-4 py-8">
        <div className="w-full max-w-md mx-auto">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Store className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Merchant Login</h1>
            <p className="text-muted-foreground mt-2">
              Sign in to manage your orders and payouts
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  +91
                </span>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="pl-12 h-12"
                  maxLength={10}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="h-[18px] w-[18px] text-destructive mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                  Remember me
                </Label>
              </div>
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              disabled={!isFormValid || isLoading}
              className="w-full h-12 text-base font-medium"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <ButtonSpinner className="h-5 w-5" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                New to Safepay?
              </span>
            </div>
          </div>

          {/* Create Account Link */}
          <Link to="/merchant-signup">
            <Button variant="outline" className="w-full h-12 text-base">
              <UserPlus className="h-[18px] w-[18px] mr-2" />
              Create Merchant Account
            </Button>
          </Link>

          {/* Customer Login Link */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Are you a customer?{' '}
            <Link to="/customer-login" className="text-primary hover:underline">
              Login here
            </Link>
          </p>
        </div>
      </main>

      {/* Info Section */}
      <div className="px-4 pb-6">
        <div className="max-w-md mx-auto bg-muted/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <BadgeCheck className="h-6 w-6 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Secure Merchant Portal</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your transactions and data are protected with bank-grade security.
                Only verified merchants can access this portal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
