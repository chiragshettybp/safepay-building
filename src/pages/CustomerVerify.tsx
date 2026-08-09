import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { ButtonSpinner } from '@/components/shared/LoadingSpinner';

export default function CustomerVerify() {
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);
  
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // If authenticated and verified, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleResend = async () => {
    setIsResending(true);
    // Simulate resend
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsResending(false);
    setCountdown(30);
    setCanResend(false);
    toast({
      title: 'Verification email sent!',
      description: 'Please check your inbox.',
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-card text-foreground min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden flex flex-col items-center justify-center relative px-4">
      {/* Safe Area / Content Container */}
      <div className="w-full max-w-sm sm:max-w-md px-2 sm:px-6 flex flex-col items-center text-center animate-fade-in-up">
        {/* Hero Icon */}
        <div className="mb-6 sm:mb-8 relative flex items-center justify-center">
          {/* Decorative background blur for modern feel */}
          <div className="absolute w-16 h-16 sm:w-20 sm:h-20 bg-success/20 rounded-full blur-xl"></div>
          <CheckCircle2 className="text-success h-12 w-12 sm:h-[80px] sm:w-[80px]" />
        </div>

        {/* Text Content */}
        <div className="space-y-3 sm:space-y-4 mb-8 sm:mb-10 w-full">
          <h1 className="text-foreground text-xl sm:text-2xl font-bold leading-tight tracking-tight">
            Verify your email
          </h1>
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground text-sm sm:text-base font-normal">
              We've sent a link to
            </p>
            <p className="text-foreground text-base sm:text-lg font-bold break-all">
              {user?.email || 'user@email.com'}
            </p>
          </div>
        </div>

        {/* Action Area */}
        <div className="w-full flex flex-col gap-3 sm:gap-4">
          {/* Resend Button */}
          <Button
            onClick={handleResend}
            disabled={!canResend || isResending}
            className="group relative w-full h-12 sm:h-14 bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground font-semibold text-sm sm:text-base rounded-xl transition-all duration-200 shadow-subtle flex items-center justify-center outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
          >
            {isResending ? (
              <span className="flex items-center gap-2">
                <ButtonSpinner className="h-5 w-5" />
                Sending...
              </span>
            ) : (
              <>
                <Mail className="mr-2 h-[18px] w-[18px] sm:h-5 sm:w-5" />
                Resend email
              </>
            )}
          </Button>

          {/* Timer / Cooldown Indicator */}
          {!canResend && (
            <div className="h-6 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium">
              <span className="text-muted-foreground">You can resend in</span>
              <span className="text-primary font-semibold tabular-nums">{formatTime(countdown)}</span>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="mt-auto pt-10 sm:pt-12 pb-4 sm:pb-6">
          <Link 
            to="/customer-login"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-medium text-xs sm:text-sm transition-colors duration-200 py-2 px-4 rounded-lg hover:bg-surface"
          >
            <ArrowLeft className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
            Return to Login
          </Link>
        </div>
      </div>

      {/* Decorative Top/Bottom gradients for that 'Light Mode' sheen */}
      <div className="fixed top-0 left-0 right-0 h-24 sm:h-32 bg-gradient-to-b from-card to-transparent pointer-events-none z-10"></div>
      <div className="fixed bottom-0 left-0 right-0 h-10 sm:h-12 bg-gradient-to-t from-card to-transparent pointer-events-none z-10"></div>
    </div>
  );
}
