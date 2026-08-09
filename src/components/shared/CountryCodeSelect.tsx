import { COUNTRIES } from '@/lib/format';

export function CountryCodeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = COUNTRIES.find((c) => c.code === value) ?? COUNTRIES[0];
  return (
    <div className="flex items-center border-r border-border bg-muted px-2 sm:px-3">
      <span className="text-base sm:text-lg mr-1 sm:mr-2" aria-hidden="true">
        {selected.flag}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Country code"
        className="h-full border-0 bg-transparent py-0 pl-0 pr-5 sm:pr-7 text-foreground focus:ring-0 text-xs sm:text-sm font-medium"
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code}
          </option>
        ))}
      </select>
    </div>
  );
}
