import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

const APP_VERSION = '1.0.0';

export default function About() {
  const navigate = useNavigate();
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'up-to-date' | 'update-available'>('idle');

  const handleShare = async () => {
    const shareData = {
      title: 'Safepay - Secure Protected Payments',
      text: 'Check out Safepay! A SafePay-protected platform that protects buyers and sellers in online transactions.',
      url: 'https://safepay.com',
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy link to clipboard
        await navigator.clipboard.writeText(shareData.url);
        toast({
          title: 'Link Copied!',
          description: 'App link copied to clipboard. Share it with your friends!',
        });
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing:', error);
        toast({
          title: 'Share Failed',
          description: 'Unable to share. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatus('idle');

    // Simulate checking for updates
    await new Promise(resolve => setTimeout(resolve, 1500));

    // For demo, always show up-to-date (in production, this would call an API)
    setUpdateStatus('up-to-date');
    setIsCheckingUpdate(false);

    toast({
      title: 'You\'re up to date!',
      description: `Safepay v${APP_VERSION} is the latest version.`,
    });
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <span className="material-symbols-outlined text-xl text-foreground">arrow_back</span>
          </button>
          <h1 className="text-base font-semibold text-foreground">About Safepay</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* App Info */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-primary text-4xl">shield</span>
          </div>
          <h2 className="text-xl font-bold text-foreground">Safepay</h2>
          <p className="text-muted-foreground text-sm mt-1">Secure Protected Payments</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">Version {APP_VERSION}</span>
            {updateStatus === 'up-to-date' && (
              <span className="inline-flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-xs">check_circle</span>
                Up to date
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <Button
            variant="outline"
            onClick={handleCheckUpdate}
            disabled={isCheckingUpdate}
            className="flex-1 h-12 rounded-xl"
          >
            {isCheckingUpdate ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Checking...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">system_update</span>
                Check for Updates
              </span>
            )}
          </Button>
          <Button
            onClick={handleShare}
            className="flex-1 h-12 rounded-xl"
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">share</span>
              Share App
            </span>
          </Button>
        </div>

        {/* Description */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Safepay is a SafePay-protected payment system designed to protect both buyers and sellers in online transactions. 
            We lock funds securely in SafePay until delivery is confirmed, reducing fraud and building trust in digital commerce.
          </p>
        </div>

        {/* Features */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Key Features</h3>
          <div className="space-y-3">
            {[
              { icon: 'lock', title: 'Secure SafePay', desc: 'Funds locked safely until delivery confirmed' },
              { icon: 'verified_user', title: 'Fraud Protection', desc: 'Reduces risk of scams and non-delivery' },
              { icon: 'gavel', title: 'Fair Disputes', desc: 'Neutral resolution for transaction issues' },
              { icon: 'flash_on', title: 'Fast Refunds', desc: 'Quick processing when disputes are resolved' },
            ].map((feature, index) => (
              <div key={index} className="flex items-start gap-3 bg-card border border-border rounded-xl p-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-lg">{feature.icon}</span>
                </div>
                <div>
                  <h4 className="font-medium text-foreground text-sm">{feature.title}</h4>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legal Links */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Legal</h3>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Link
              to="/privacy-policy"
              className="flex items-center justify-between p-4 hover:bg-muted transition-colors border-b border-border"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-muted-foreground">description</span>
                <span className="text-sm font-medium text-foreground">Privacy Policy</span>
              </div>
              <span className="material-symbols-outlined text-muted-foreground">chevron_right</span>
            </Link>
            <Link
              to="/terms-of-service"
              className="flex items-center justify-between p-4 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-muted-foreground">gavel</span>
                <span className="text-sm font-medium text-foreground">Terms of Service</span>
              </div>
              <span className="material-symbols-outlined text-muted-foreground">chevron_right</span>
            </Link>
          </div>
        </div>

        {/* Contact */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Contact</h3>
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <a href="mailto:support@safepay.com" className="flex items-center gap-3 text-sm">
              <span className="material-symbols-outlined text-muted-foreground">mail</span>
              <span className="text-foreground">support@safepay.com</span>
            </a>
            <a href="https://safepay.com" className="flex items-center gap-3 text-sm">
              <span className="material-symbols-outlined text-muted-foreground">language</span>
              <span className="text-primary">www.safepay.com</span>
            </a>
          </div>
        </div>

        {/* Copyright */}
        <p className="text-center text-xs text-muted-foreground">
          © 2026 Safepay. All rights reserved.
        </p>
      </main>

      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
    </div>
  );
}
