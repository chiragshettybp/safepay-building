import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/lib/toast';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, XCircle } from 'lucide-react';
import { ButtonSpinner } from '@/components/shared/LoadingSpinner';
import { CountryCodeSelect } from '@/components/shared/CountryCodeSelect';

export default function CustomerSignup() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { signup } = useAuth();
  const navigate = useNavigate();

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }, [password]);

  const getStrengthColor = (index: number) => {
    if (index >= passwordStrength) return 'bg-border';
    if (passwordStrength <= 2) return 'bg-destructive';
    if (passwordStrength <= 3) return 'bg-warning';
    return 'bg-success';
  };

  const getStrengthLabel = () => {
    if (passwordStrength <= 1) return { text: 'Weak', color: 'text-destructive' };
    if (passwordStrength <= 2) return { text: 'Fair', color: 'text-warning' };
    if (passwordStrength <= 3) return { text: 'Medium Strength', color: 'text-warning' };
    return { text: 'Strong', color: 'text-success' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    setIsLoading(true);

    const fullPhoneNumber = countryCode + phone;
    const result = await signup(fullPhoneNumber, password, fullName);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      toast({
        title: 'Account created!',
        description: 'Welcome to Safepay.',
      });
      navigate('/dashboard');
    }
  };

  const isFormValid = 
    fullName.length >= 2 && 
    phone.length >= 10 && 
    password.length >= 8 && 
    password === confirmPassword && 
    agreedToTerms;

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;

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
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">Step 1 of 3</div>
        </div>

        {/* Headline */}
        <div className="px-4 sm:px-6 pt-2 pb-4 sm:pb-6">
          <h1 className="text-foreground tracking-tight text-xl sm:text-2xl md:text-[28px] font-bold leading-tight">
            Create Safepay Account
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 sm:mt-2">
            Join millions of users worldwide.
          </p>
        </div>

        {/* Form Container */}
        <form className="flex flex-col gap-4 sm:gap-5 px-4 sm:px-6 max-w-md mx-auto w-full" onSubmit={handleSubmit}>
          {/* Full Name */}
          <div className="relative group">
            <Label className="block text-sm font-medium text-foreground mb-1.5 ml-1">
              Full Name
            </Label>
            <div className="relative">
              <Input
                type="text"
                placeholder="e.g. Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border-none bg-surface py-3 sm:py-4 pl-4 pr-12 text-base placeholder:text-muted-foreground shadow-sm ring-1 ring-inset ring-border focus-visible:ring-2 focus-visible:ring-primary h-12 sm:h-14"
              />
              {fullName.length >= 2 && (
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-success">
                  <CheckCircle2 className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                </div>
              )}
            </div>
          </div>

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

          {/* Password */}
          <div className="relative group">
            <Label className="block text-sm font-medium text-foreground mb-1.5 ml-1">
              Password
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border-none bg-surface py-3 sm:py-4 pl-4 pr-12 text-base placeholder:text-muted-foreground shadow-sm ring-1 ring-inset ring-border focus-visible:ring-2 focus-visible:ring-primary h-12 sm:h-14"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-muted-foreground hover:text-primary transition-colors"
              >
                {showPassword ? <Eye className="h-[18px] w-[18px] sm:h-5 sm:w-5" /> : <EyeOff className="h-[18px] w-[18px] sm:h-5 sm:w-5" />}
              </button>
            </div>
            {/* Strength Meter */}
            {password.length > 0 && (
              <>
                <div className="mt-2 sm:mt-3 flex gap-1.5 sm:gap-2 w-full">
                  {[0, 1, 2, 3].map((index) => (
                    <div 
                      key={index}
                      className={`h-1 sm:h-1.5 flex-1 rounded-full transition-colors ${getStrengthColor(index)}`}
                    />
                  ))}
                </div>
                <div className="mt-1 sm:mt-1.5 flex justify-between text-[10px] sm:text-xs">
                  <span className={`${getStrengthLabel().color} font-medium`}>
                    {getStrengthLabel().text}
                  </span>
                  <span className="text-muted-foreground">Use 8+ characters</span>
                </div>
              </>
            )}
          </div>

          {/* Confirm Password */}
          <div className="relative group">
            <Label className="block text-sm font-medium text-foreground mb-1.5 ml-1">
              Confirm Password
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border-none bg-surface py-3 sm:py-4 pl-4 pr-12 text-base placeholder:text-muted-foreground shadow-sm ring-1 ring-inset ring-border focus-visible:ring-2 focus-visible:ring-primary h-12 sm:h-14"
              />
              {confirmPassword.length > 0 && (
                <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 ${passwordsMatch ? 'text-success' : 'text-destructive'}`}>
                  {passwordsMatch ? (
                    <CheckCircle2 className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                  ) : (
                    <XCircle className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-destructive text-sm font-medium px-1">{error}</p>
          )}

          {/* Terms Checkbox */}
          <div className="flex items-start mt-1 sm:mt-2">
            <div className="flex h-6 items-center">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                className="w-5 h-5 rounded border-border"
              />
            </div>
            <div className="ml-2 sm:ml-3 text-xs sm:text-sm leading-5 sm:leading-6">
              <label htmlFor="terms" className="font-medium text-muted-foreground">
                I agree to the{' '}
                <Link to="/terms-of-service" className="font-semibold text-primary hover:text-primary/80">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy-policy" className="font-semibold text-primary hover:text-primary/80">
                  Privacy Policy
                </Link>.
              </label>
            </div>
          </div>
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
                  Creating Account...
                </span>
              ) : (
                'Create Account'
              )}
            </Button>
            <div className="mt-3 sm:mt-4 text-center text-xs sm:text-sm font-medium text-muted-foreground">
              Already have an account?{' '}
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
