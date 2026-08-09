import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/toast';
import { ArrowLeft, BadgeCheck, CircleAlert, Eye, EyeOff } from 'lucide-react';
import { ButtonSpinner } from '@/components/shared/LoadingSpinner';
import { CountryCodeSelect } from '@/components/shared/CountryCodeSelect';

export default function ResetPassword() {
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    const fullPhoneNumber = countryCode + phone;
    const result = await resetPassword(fullPhoneNumber, newPassword);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      toast({
        title: 'Password reset successful!',
        description: 'You can now log in with your new password.',
      });
      navigate('/dashboard');
    }
  };

  const isFormValid = phone.length >= 10 && newPassword.length >= 8 && newPassword === confirmPassword;
  const passwordsMatch = confirmPassword.length === 0 || newPassword === confirmPassword;

  return (
    <div className="bg-background font-sans antialiased text-foreground min-h-[100dvh] max-w-[100vw] overflow-x-hidden">
      <div className="relative flex min-h-[100dvh] w-full flex-col pb-36 sm:pb-40">
        {/* Top Bar */}
        <div className="flex items-center p-3 sm:p-4 justify-between sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
          <button 
            onClick={() => navigate(-1)}
            className="text-foreground flex w-10 h-10 sm:w-11 sm:h-11 shrink-0 items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <div className="text-sm font-medium text-muted-foreground"></div>
        </div>

        {/* Headline */}
        <div className="px-4 sm:px-6 pt-2 pb-4 sm:pb-6">
          <h1 className="text-foreground tracking-tight text-xl sm:text-2xl md:text-[28px] font-bold leading-tight">
            Reset Password
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 sm:mt-2">
            Enter your phone number and new password.
          </p>
        </div>

        {/* Form Container */}
        <form className="flex flex-col gap-4 sm:gap-5 px-4 sm:px-6 max-w-md mx-auto w-full" onSubmit={handleSubmit}>
          {/* Phone Number */}
          <div className="relative group">
            <Label className="block text-sm font-medium text-foreground mb-1.5 ml-1">
              Phone Number
            </Label>
            <div className="flex rounded-xl shadow-sm ring-1 ring-inset ring-border focus-within:ring-2 focus-within:ring-primary bg-surface overflow-hidden transition-all">
              <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
              <input
                type="tel"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                className="block w-full border-0 bg-transparent py-3 sm:py-4 pl-3 sm:pl-4 text-foreground placeholder:text-muted-foreground focus:ring-0 text-base h-12 sm:h-14"
              />
            </div>
          </div>

          {/* New Password */}
          <div className="relative group">
            <Label className="block text-sm font-medium text-foreground mb-1.5 ml-1">
              New Password
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border-none bg-surface py-3 sm:py-4 pl-4 pr-12 text-base placeholder:text-muted-foreground shadow-sm ring-1 ring-inset ring-border focus-visible:ring-2 focus-visible:ring-primary h-12 sm:h-14"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-muted-foreground hover:text-primary transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                ) : (
                  <Eye className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="relative group">
            <Label className="block text-sm font-medium text-foreground mb-1.5 ml-1">
              Confirm Password
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border-none bg-surface py-3 sm:py-4 pl-4 pr-12 text-base placeholder:text-muted-foreground shadow-sm ring-1 ring-inset ring-border focus-visible:ring-2 focus-visible:ring-primary h-12 sm:h-14"
              />
              {confirmPassword.length > 0 && (
                <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 ${passwordsMatch ? 'text-success' : 'text-destructive'}`}>
                  {passwordsMatch ? (
                    <BadgeCheck className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                  ) : (
                    <CircleAlert className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-destructive text-sm font-medium px-1">{error}</p>
          )}
        </form>

        {/* Sticky Footer Action */}
        <div className="fixed bottom-0 left-0 right-0 w-full max-w-[100vw] bg-background p-4 sm:p-6 pb-safe border-t border-border shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
          <div className="max-w-md mx-auto">
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid || isLoading}
              className="flex w-full items-center justify-center rounded-xl bg-primary px-6 py-3 sm:py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/30 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none h-12 sm:h-14"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <ButtonSpinner className="h-5 w-5" />
                  Resetting...
                </span>
              ) : (
                'Reset Password'
              )}
            </Button>
            <div className="mt-3 sm:mt-4 text-center text-xs sm:text-sm font-medium text-muted-foreground">
              Remember your password?{' '}
              <Link to="/customer-login" className="text-primary hover:text-primary/80 ml-1">
                Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
