const PUBLIC_ID_REGEX = /^[A-Z]{3}-[0-9]{12}$/;

export const PUBLIC_ID_PREFIXES = {
  ORD: 'ORD',
  TXN: 'TXN',
  PAY: 'PAY',
  REF: 'REF',
  DSP: 'DSP',
  WDR: 'WDR',
  PYO: 'PYO',
  TKT: 'TKT',
  CUS: 'CUS',
  MER: 'MER',
  KYC: 'KYC',
  NTF: 'NTF',
  DOC: 'DOC',
} as const;

export type PublicIdPrefix = keyof typeof PUBLIC_ID_PREFIXES;

export function isPublicId(value: string | null | undefined): boolean {
  return typeof value === 'string' && PUBLIC_ID_REGEX.test(value);
}

/**
 * Client-side generator. Used ONLY for display fallbacks / transient UX.
 * Financial records must be created server/db-side (the DB triggers always
 * win and will replace/backfill these on insert).
 */
export function generatePublicId(prefix: PublicIdPrefix): string {
  const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
  return `${prefix}-${digits}`;
}

/**
 * Resolve the display public id for a row. Prefers the real public id column;
 * falls back to a locally generated one (e.g. for brand-new rows that have not
 * been persisted yet) or a derived value when a legacy column is present.
 */
export function publicIdOf(
  row: Record<string, unknown> | null | undefined,
  publicColumn: string,
  prefix: PublicIdPrefix,
  legacyColumn?: string
): string {
  const publicValue = row?.[publicColumn];
  if (isPublicId(publicValue as string)) return publicValue as string;
  if (publicValue) return String(publicValue);
  const legacy = legacyColumn ? row?.[legacyColumn] : undefined;
  if (legacy && String(legacy).length > 0) return String(legacy);
  return generatePublicId(prefix);
}
