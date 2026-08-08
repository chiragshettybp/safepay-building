import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import type { PublicIdPrefix } from '@/lib/public-ids';

interface PublicIdBadgeProps {
  value: string;
  label?: string;
  className?: string;
  copyable?: boolean;
  monospace?: boolean;
  copyLabel?: string;
}

/**
 * Standardized SafePay public ID display with optional one-tap copy.
 * Always renders only the public ID (never internal UUIDs).
 */
export function PublicIdBadge({
  value,
  label,
  className,
  copyable = false,
  monospace = true,
  copyLabel,
}: PublicIdBadgeProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast({ title: 'Copied', description: `${copyLabel || label || 'ID'} copied to clipboard` });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not access the clipboard', variant: 'destructive' });
    }
  };

  return (
    <span className={cn('inline-flex items-center gap-1.5 min-w-0', className)}>
      {label && <span className="text-xs text-muted-foreground shrink-0">{label}</span>}
      <span
        className={cn(
          'text-sm font-medium text-foreground truncate',
          monospace && 'font-mono'
        )}
        title={value}
      >
        {value}
      </span>
      {copyable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          aria-label={`Copy ${copyLabel || label || 'ID'}`}
          className="p-1 hover:bg-muted rounded-md shrink-0"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-success" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
      )}
    </span>
  );
}
