import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SafepayLogo } from '@/components/ui/SafepayLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

export default function CustomerLogin() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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
      navigate('/dashboard');
    }
  };

  const isFormValid = phone.length >= 10 && password.length >= 8;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground overflow-x-hidden w-full max-w-[100vw]">
      <main className="flex-1 w-full overflow-y-auto no-scrollbar">
        <div className="w-full max-w-md mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-36 sm:pb-40 flex flex-col items-center">
          {/* Logo */}
          <div className="mb-6 sm:mb-8 w-28 sm:w-32 flex justify-center">
            <SafepayLogo />
          </div>

          {/* Title */}
          <h1 className="text-foreground text-xl sm:text-2xl font-bold leading-tight text-center mb-6 sm:mb-8">
            Welcome back
          </h1>

          {/* Form */}
          <form className="w-full flex flex-col gap-4 sm:gap-5" onSubmit={handleSubmit}>
            {/* Phone Number Field */}
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <Label htmlFor="phone" className="text-foreground text-sm font-medium ml-1">
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 sm:h-14 bg-surface border-border rounded-xl px-4 text-base placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
              />
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <Label htmlFor="password" className="text-foreground text-sm font-medium ml-1">
                Password
              </Label>
              <div className="relative w-full">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 sm:h-14 bg-surface border-border rounded-xl pl-4 pr-12 text-base placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 h-full w-12 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="material-symbols-outlined select-none text-xl sm:text-2xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <p className="text-destructive text-sm font-medium px-1">{error}</p>
            )}

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between w-full mt-1 px-1">
              <label className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none group">
                <Checkbox
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  className="w-5 h-5 rounded border-2 border-muted-foreground/40"
                />
                <span className="text-muted-foreground text-sm font-medium">Remember me</span>
              </label>
              <Link 
                to="/reset-password" 
                className="text-primary text-sm font-medium hover:text-primary/80 transition-colors py-1"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Divider */}
            <div className="relative flex py-2 items-center w-full my-1">
              <div className="flex-grow border-t border-border"></div>
              <span className="flex-shrink mx-3 sm:mx-4 text-muted-foreground text-xs sm:text-sm">Or continue with</span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            {/* Social Login Buttons */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full">
              <button
                type="button"
                className="flex items-center justify-center gap-2 sm:gap-3 h-12 sm:h-14 w-full bg-card border border-border rounded-xl hover:bg-surface hover:border-muted-foreground/30 transition-all active:scale-[0.98]"
              >
                <div className="w-5 h-5 sm:w-6 sm:h-6 relative">
                  <svg className="w-full h-full block" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" fill="#EA4335" />
                    <path d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" fill="#4285F4" />
                    <path d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" fill="#FBBC05" />
                    <path d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" fill="#34A853" />
                  </svg>
                </div>
                <span className="text-muted-foreground font-medium text-sm sm:text-base">Google</span>
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 sm:gap-3 h-12 sm:h-14 w-full bg-card border border-border rounded-xl hover:bg-surface hover:border-muted-foreground/30 transition-all active:scale-[0.98]"
              >
                <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-foreground">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 384 512">
                    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 52.3-11.4 69.5-34.3z" />
                  </svg>
                </div>
                <span className="text-muted-foreground font-medium text-sm sm:text-base">Apple</span>
              </button>
            </div>

            {/* Sign Up Link */}
            <div className="mt-3 sm:mt-4 text-center">
              <Link 
                to="/customer-signup" 
                className="text-accent font-medium text-sm sm:text-base p-2 sm:p-3 hover:text-primary transition-colors inline-block"
              >
                New? Create account
              </Link>
            </div>
          </form>
        </div>
      </main>

      {/* Fixed Footer */}
      <footer className="fixed bottom-0 left-0 right-0 w-full max-w-[100vw] bg-card/95 backdrop-blur-md border-t border-border/50 px-4 sm:px-6 pb-safe pt-3 sm:pt-4 z-50">
        <div className="w-full max-w-md mx-auto">
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={!isFormValid || isLoading}
            className="w-full h-12 sm:h-14 bg-primary text-primary-foreground font-semibold text-base rounded-xl shadow-subtle hover:bg-primary/90 focus:ring-4 focus:ring-primary/30 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                Logging in...
              </span>
            ) : (
              'Log In'
            )}
          </Button>
        </div>
      </footer>

      {/* Material Icons */}
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
    </div>
  );
}
