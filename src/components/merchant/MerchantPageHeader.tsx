import { ReactNode } from 'react';
import { MerchantBackButton } from '@/components/merchant/MerchantBackButton';
import { cn } from '@/lib/utils';

export interface MerchantPageHeaderBack {
  /** Deterministic parent route used when no in-app history exists. */
  fallback: string;
  /** Contextual accessibility label for the back button. */
  label?: string;
  disabled?: boolean;
  onBeforeNavigate?: () => boolean | void;
}

export interface MerchantPageHeaderProps {
  /** Page title. Use a ReactNode so pages can render ids/skeletons. */
  title: ReactNode;
  /** Optional supporting subtitle shown under the title. */
  subtitle?: ReactNode;
  /** When provided, renders the standard MerchantBackButton before the title. */
  back?: MerchantPageHeaderBack;
  /** Page-specific actions rendered on the right (never pushed around by the back button). */
  actions?: ReactNode;
  className?: string;
}

/**
 * The single page header for the merchant app.
 *
 * Layout:
 *   ←   Page Title              Action
 *       Optional subtitle
 *
 * The back button owns a fixed 44×44px touch target, the title truncates in a
 * flexible area, and actions sit in a fixed, non-shrinking zone on the right.
 * Top-level pages simply omit `back` (no back arrow is rendered).
 */
export function MerchantPageHeader({
  title,
  subtitle,
  back,
  actions,
  className,
}: MerchantPageHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-1">
        {back && (
          <MerchantBackButton
            fallback={back.fallback}
            label={back.label}
            disabled={back.disabled}
            onBeforeNavigate={back.onBeforeNavigate}
          />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
