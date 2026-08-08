import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ReactNode } from 'react';

interface LegalPageLayoutProps {
  title: string;
  subtitle?: string;
  lastUpdated?: string;
  children: ReactNode;
}

export const LegalPageLayout = ({ title, subtitle, lastUpdated = 'June 7, 2026', children }: LegalPageLayoutProps) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{title}</h2>
          {subtitle && <p className="text-sm sm:text-base text-muted-foreground">{subtitle}</p>}
          <p className="text-xs text-muted-foreground mt-3">Last updated: {lastUpdated}</p>
        </div>

        <article className="legal-prose space-y-6 text-sm sm:text-base text-foreground/90 leading-relaxed">
          {children}
        </article>

        <div className="mt-12 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Questions? Reach our compliance team at{' '}
            <Link to="/contact" className="text-primary hover:underline">contact us</Link> or
            email <a href="mailto:legal@safepay.com" className="text-primary hover:underline">legal@safepay.com</a>.
          </p>
        </div>
      </main>
    </div>
  );
};

export const LegalSection = ({ heading, children }: { heading: string; children: ReactNode }) => (
  <section>
    <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">{heading}</h3>
    <div className="text-muted-foreground space-y-3 text-sm sm:text-[15px]">{children}</div>
  </section>
);
