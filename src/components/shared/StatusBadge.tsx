import { cn } from '@/lib/utils';

export type StatusTone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral';

const toneClasses: Record<StatusTone, { badge: string; dot: string }> = {
  success: { badge: 'bg-success/10 text-success', dot: 'bg-success' },
  warning: { badge: 'bg-warning/10 text-warning', dot: 'bg-warning' },
  destructive: { badge: 'bg-destructive/10 text-destructive', dot: 'bg-destructive' },
  info: { badge: 'bg-primary/10 text-primary', dot: 'bg-primary' },
  neutral: { badge: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
};

interface StatusBadgeProps {
  tone?: StatusTone;
  label: string;
  dot?: boolean;
  className?: string;
}

/**
 * The single status pill used across the product. Status meaning is
 * communicated with tone + text (never colour alone), so it stays
 * legible for colour-blind users and consistent everywhere.
 */
export function StatusBadge({ tone = 'neutral', label, dot = false, className }: StatusBadgeProps) {
  const t = toneClasses[tone];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', t.badge, className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', t.dot)} />}
      {label}
    </span>
  );
}
