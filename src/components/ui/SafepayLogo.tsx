import safepayLogo from '@/assets/safepay-logo.png';

export const SafepayLogo = ({ showWordmark = true }: { showWordmark?: boolean }) => (
  <div className="flex items-center gap-2 w-full">
    <img
      src={safepayLogo}
      alt="Safepay logo"
      className="h-9 w-9 sm:h-10 sm:w-10 object-contain shrink-0"
    />
    {showWordmark && (
      <span className="text-foreground text-lg sm:text-xl font-bold tracking-tight">
        Safepay
      </span>
    )}
  </div>
);
