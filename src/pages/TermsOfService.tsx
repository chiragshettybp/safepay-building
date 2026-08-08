import { useNavigate } from 'react-router-dom';

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <span className="material-symbols-outlined text-xl text-foreground">arrow_back</span>
          </button>
          <h1 className="text-base font-semibold text-foreground">Terms of Service</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-muted-foreground text-sm mb-6">
            Last updated: January 2, 2026
          </p>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm text-muted-foreground">
                By accessing or using Safepay, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
              </p>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Escrow Services</h2>
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div>
                <h3 className="font-medium text-foreground text-sm">How It Works</h3>
                <p className="text-sm text-muted-foreground">
                  Safepay acts as a neutral third party holding funds in escrow until the buyer confirms delivery of goods or services.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Fund Release</h3>
                <p className="text-sm text-muted-foreground">
                  Funds are released to the merchant only after you confirm successful delivery or after the dispute resolution process.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Holding Period</h3>
                <p className="text-sm text-muted-foreground">
                  Funds may be held for up to 14 days. Auto-release may occur if no action is taken.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">3. User Responsibilities</h2>
            <div className="bg-card border border-border rounded-xl p-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-primary text-lg shrink-0">task_alt</span>
                  Provide accurate and complete information
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-primary text-lg shrink-0">task_alt</span>
                  Complete KYC verification as required
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-primary text-lg shrink-0">task_alt</span>
                  Maintain security of your account credentials
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-primary text-lg shrink-0">task_alt</span>
                  Use the platform only for lawful purposes
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-primary text-lg shrink-0">task_alt</span>
                  Report suspicious activity immediately
                </li>
              </ul>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Disputes & Refunds</h2>
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div>
                <h3 className="font-medium text-foreground text-sm">Filing a Dispute</h3>
                <p className="text-sm text-muted-foreground">
                  You may file a dispute within 14 days of the expected delivery date if goods are not received or not as described.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Resolution Process</h3>
                <p className="text-sm text-muted-foreground">
                  Our team reviews evidence from both parties and makes a fair determination. Decisions are final and binding.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Refund Timeline</h3>
                <p className="text-sm text-muted-foreground">
                  Approved refunds are typically processed within 3-5 business days.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Fees</h2>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Escrow Transaction Fee</span>
                  <span className="text-sm font-medium text-foreground">1-2%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Withdrawal Fee</span>
                  <span className="text-sm font-medium text-foreground">₹10 per withdrawal</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Dispute Filing</span>
                  <span className="text-sm font-medium text-success">Free</span>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Prohibited Activities</h2>
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
              <ul className="space-y-2 text-sm text-destructive/80">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-destructive text-lg shrink-0">block</span>
                  Fraudulent transactions or money laundering
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-destructive text-lg shrink-0">block</span>
                  Selling prohibited or illegal items
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-destructive text-lg shrink-0">block</span>
                  Creating multiple accounts to bypass limits
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-destructive text-lg shrink-0">block</span>
                  Attempting to manipulate the dispute system
                </li>
              </ul>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Account Termination</h2>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm text-muted-foreground">
                We reserve the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or pose a risk to our platform or other users.
              </p>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Contact</h2>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm text-muted-foreground mb-2">
                For questions about these terms:
              </p>
              <a href="mailto:legal@safepay.com" className="text-primary text-sm font-medium">
                legal@safepay.com
              </a>
            </div>
          </section>
        </div>
      </main>

      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
    </div>
  );
}
