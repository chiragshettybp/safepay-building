export type FormatAmountOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export function currencySymbol(currency?: string | null): string {
  switch ((currency ?? '').toUpperCase()) {
    case 'USD':
      return '$';
    case 'EUR':
      return '\u20AC';
    case 'GBP':
      return '\u00A3';
    default:
      return '\u20B9';
  }
}

export function formatAmount(
  amount: number | string | null | undefined,
  currency?: string | null,
  options: FormatAmountOptions = {}
): string {
  const value = typeof amount === 'string' ? Number(amount) : amount ?? 0;
  const { minimumFractionDigits, maximumFractionDigits } = options;
  const formatted = value.toLocaleString('en-IN', {
    ...(minimumFractionDigits !== undefined ? { minimumFractionDigits } : {}),
    ...(maximumFractionDigits !== undefined ? { maximumFractionDigits } : {}),
  });
  return `${currencySymbol(currency)}${formatted}`;
}

export type WalletTransactionDirection = 'credit' | 'debit' | 'unknown';

export type WalletTransactionLike = {
  type?: string | null;
  amount: number | string | null | undefined;
  currency?: string | null;
};

export function walletTransactionDirection(type?: string | null): WalletTransactionDirection {
  switch (type) {
    case 'credit':
    case 'refund':
      return 'credit';
    case 'debit':
    case 'withdrawal':
      return 'debit';
    default:
      return 'unknown';
  }
}

export function walletTransactionTone(type?: string | null): 'credit' | 'debit' | 'neutral' {
  switch (walletTransactionDirection(type)) {
    case 'credit':
      return 'credit';
    case 'debit':
      return 'debit';
    default:
      return 'neutral';
  }
}

export function formatWalletTransactionAmount(transaction: WalletTransactionLike): string {
  const value = Number(transaction.amount);
  const amount = Number.isFinite(value) ? Math.abs(value) : 0;
  const base = formatAmount(amount, transaction.currency);
  const direction = walletTransactionDirection(transaction.type);
  if (direction === 'credit') return `+${base}`;
  if (direction === 'debit') return `-${base}`;
  return base;
}

export type Country = { code: string; flag: string; name: string };

export const COUNTRIES: Country[] = [
  { code: '+91', flag: '\u{1F1EE}\u{1F1F3}', name: 'India' },
  { code: '+1', flag: '\u{1F1FA}\u{1F1F8}', name: 'United States' },
  { code: '+44', flag: '\u{1F1EC}\u{1F1E7}', name: 'United Kingdom' },
  { code: '+234', flag: '\u{1F1F3}\u{1F1EC}', name: 'Nigeria' },
];

export function countryFlag(countryCode: string): string {
  return COUNTRIES.find((c) => c.code === countryCode)?.flag ?? COUNTRIES[0].flag;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
