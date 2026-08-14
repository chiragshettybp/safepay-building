import { cn } from '@/lib/utils';

export type SafepayLogoSize = 'sm' | 'md' | 'lg';

const SIZE_STYLES: Record<SafepayLogoSize, { img: string; word: string }> = {
  sm: { img: 'h-7 w-auto', word: 'text-sm sm:text-base' },
  md: { img: 'h-8 w-auto sm:h-9', word: 'text-lg sm:text-xl' },
  lg: { img: 'h-10 w-auto sm:h-12', word: 'text-2xl sm:text-3xl' },
};

interface SafepayLogoProps {
  showWordmark?: boolean;
  size?: SafepayLogoSize;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
}

export const SafepayLogo = ({
  showWordmark = true,
  size = 'md',
  className,
  imgClassName,
  priority = false,
}: SafepayLogoProps) => {
  const styles = SIZE_STYLES[size];
  return (
    <div className={cn('flex items-center gap-2 w-full', className)}>
      <img
        src="/brand/safepay-logo.png"
        alt={showWordmark ? '' : 'Safepay'}
        aria-hidden={showWordmark || undefined}
        width={66}
        height={96}
        loading={priority ? 'eager' : 'lazy'}
        className={cn('w-auto object-contain shrink-0', styles.img, imgClassName)}
      />
      {showWordmark && (
        <span className={cn('text-foreground font-bold tracking-tight', styles.word)}>
          Safepay
        </span>
      )}
    </div>
  );
};
