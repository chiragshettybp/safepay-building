import shieldAsset from '@/assets/safepay-shield.png.asset.json';

export const SafepayLogo = ({ showWordmark = true }: { showWordmark?: boolean }) => (
  <div className="flex items-center gap-2 w-full">
    <img
      src={shieldAsset.url}
      alt="Safepay logo"
      className="h-8 w-8 sm:h-9 sm:w-9 object-contain shrink-0"
    />
    {showWordmark && (
      <span className="text-foreground text-lg sm:text-xl font-bold tracking-tight">
        Safepay
      </span>
    )}
  </div>
);
