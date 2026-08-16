import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export interface MerchantBackButtonProps {
  /**
   * Deterministic parent route used when there is no useful in-app history
   * (direct deep link, browser refresh, or fresh tab). Required so the back
   * button never strands the user or exits the merchant app.
   */
  fallback: string;
  /** Contextual accessibility label, e.g. "Back to Orders". Defaults to "Go back". */
  label?: string;
  /** Disable the button (e.g. during a blocking submit). Defaults to false. */
  disabled?: boolean;
  /**
   * Optional guard called before navigating. Return `false` to cancel (used
   * for unsaved-changes protection). Never silently cancels a submitted
   * financial operation.
   */
  onBeforeNavigate?: () => boolean | void;
  className?: string;
}

/**
 * The single back-navigation control for the merchant app.
 *
 * Navigation strategy:
 *  1. If there is a valid in-app previous route (client-side navigation
 *     happened, `location.key !== 'default'`) → `navigate(-1)`.
 *  2. Otherwise (direct deep link, refresh, no history) → `navigate(fallback)`.
 *
 * This keeps list → detail → back predictable, survives browser refresh and
 * deep links, and never relies on raw browser history for the user.
 *
 * Visual spec: 44×44px touch target, 20px ArrowLeft icon, subtle hover/press
 * feedback, accessible focus ring, and a contextual aria-label.
 */
export function MerchantBackButton({
  fallback,
  label = 'Go back',
  disabled = false,
  onBeforeNavigate,
  className,
}: MerchantBackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = () => {
    if (onBeforeNavigate && onBeforeNavigate() === false) return;
    if (location.key === 'default') {
      navigate(fallback);
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground',
        'transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
    >
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
