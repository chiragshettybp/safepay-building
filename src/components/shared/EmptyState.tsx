import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Shared empty state. Explains what is empty, why it might be empty,
 * and what the user can do next — without decoration.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('empty-state', className)}>
      <div className="empty-state-icon">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
