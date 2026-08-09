import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn('h-6 w-6 animate-spin text-primary', className)}
      aria-label="Loading"
    />
  );
}

export function FullPageLoading({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex min-h-[60vh] flex-col items-center justify-center gap-3', className)}>
      <LoadingSpinner className="h-8 w-8" />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}

export function ButtonSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} aria-label="Loading" />;
}
