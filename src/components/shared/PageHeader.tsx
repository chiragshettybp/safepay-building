import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: {
    label?: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Consistent page header used across the product.
 * Renders a title, optional supporting subtitle, an optional primary
 * action on the right and an optional back control for nested pages.
 */
export function PageHeader({ title, subtitle, action, back, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {back && (
            <button
              onClick={back.onClick}
              className="back-btn mb-3 text-muted-foreground"
              aria-label={back.label || 'Go back'}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
