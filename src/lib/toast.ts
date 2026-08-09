import { toast as sonnerToast } from 'sonner';

interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

/**
 * Thin compatibility layer over sonner so every page shares one toast
 * system and one visual language. The object API mirrors the previous
 * radix-toast API, so call sites are unchanged.
 */
export function toast({ title, description, variant, duration }: ToastOptions) {
  if (variant === 'destructive') {
    return sonnerToast.error(title, { description, duration });
  }
  return sonnerToast(title, { description, duration });
}
