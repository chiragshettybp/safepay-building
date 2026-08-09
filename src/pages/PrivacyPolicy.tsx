import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Eye, Pencil, ShieldCheck, Trash2 } from 'lucide-react';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

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
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-base font-semibold text-foreground">Privacy Policy</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-muted-foreground text-sm mb-6">
            Last updated: January 2, 2026
          </p>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Information We Collect</h2>
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div>
                <h3 className="font-medium text-foreground text-sm">Personal Information</h3>
                <p className="text-sm text-muted-foreground">
                  Name, phone number, email address, and government-issued ID for KYC verification.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Financial Information</h3>
                <p className="text-sm text-muted-foreground">
                  Bank account details, transaction history, and payment information.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Device Information</h3>
                <p className="text-sm text-muted-foreground">
                  Device type, operating system, and unique device identifiers.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
            <div className="bg-card border border-border rounded-xl p-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <BadgeCheck className="text-primary h-[18px] w-[18px] shrink-0" />
                  Process and secure escrow payments
                </li>
                <li className="flex items-start gap-2">
                  <BadgeCheck className="text-primary h-[18px] w-[18px] shrink-0" />
                  Verify your identity for regulatory compliance
                </li>
                <li className="flex items-start gap-2">
                  <BadgeCheck className="text-primary h-[18px] w-[18px] shrink-0" />
                  Communicate about transactions and disputes
                </li>
                <li className="flex items-start gap-2">
                  <BadgeCheck className="text-primary h-[18px] w-[18px] shrink-0" />
                  Improve our services and prevent fraud
                </li>
                <li className="flex items-start gap-2">
                  <BadgeCheck className="text-primary h-[18px] w-[18px] shrink-0" />
                  Comply with legal obligations
                </li>
              </ul>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Data Security</h2>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm text-muted-foreground mb-3">
                We implement industry-standard security measures to protect your data:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ShieldCheck className="text-success h-[18px] w-[18px] shrink-0" />
                  256-bit SSL encryption for all data transfers
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="text-success h-[18px] w-[18px] shrink-0" />
                  Secure, encrypted storage of sensitive information
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="text-success h-[18px] w-[18px] shrink-0" />
                  Regular security audits and penetration testing
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="text-success h-[18px] w-[18px] shrink-0" />
                  Strict access controls and monitoring
                </li>
              </ul>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Your Rights</h2>
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Eye className="text-primary h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground text-sm">Access</h3>
                  <p className="text-xs text-muted-foreground">Request a copy of your personal data</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Pencil className="text-primary h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground text-sm">Correction</h3>
                  <p className="text-xs text-muted-foreground">Update or correct inaccurate information</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Trash2 className="text-primary h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground text-sm">Deletion</h3>
                  <p className="text-xs text-muted-foreground">Request deletion of your account and data</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Contact Us</h2>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm text-muted-foreground mb-3">
                For privacy-related inquiries, contact our Data Protection Officer:
              </p>
              <a href="mailto:privacy@safepay.com" className="text-primary text-sm font-medium">
                privacy@safepay.com
              </a>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
