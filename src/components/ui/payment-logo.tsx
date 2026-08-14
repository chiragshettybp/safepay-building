import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface PaymentLogoProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, 'className' | 'title'> {
  src: string;
  alt: string;
  title?: string;
  className?: string;
}

/**
 * Reusable payment brand logo. The containing span is sized via className
 * (the brand sizing is applied by the caller); the inner image always keeps
 * its aspect ratio, is centered, and never stretches, crops or overflows.
 */
export function PaymentLogo({ src, alt, title, className, ...rest }: PaymentLogoProps) {
  return (
    <span
      {...rest}
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden',
        className
      )}
      title={title ?? alt}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="block h-full w-auto max-w-full object-contain"
      />
    </span>
  );
}
