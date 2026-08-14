import { cn } from '@/lib/utils';
import { PaymentLogo } from '@/components/ui/payment-logo';

export type PaymentBrandId =
  | 'upi'
  | 'gpay'
  | 'phonepe'
  | 'paytm'
  | 'bhim'
  | 'visa'
  | 'mastercard'
  | 'rupay'
  | 'sbi'
  | 'hdfc'
  | 'icici'
  | 'axis'
  | 'amazonpay'
  | 'mobikwik';

export const PAYMENT_METHOD_BRANDS: Record<string, PaymentBrandId[]> = {
  upi: ['gpay', 'phonepe', 'paytm', 'bhim'],
  card: ['visa', 'mastercard', 'rupay'],
  netbanking: ['sbi', 'hdfc', 'icici', 'axis'],
  wallet: ['paytm', 'amazonpay', 'mobikwik'],
};

export const ACCEPTED_PAYMENT_BRANDS: PaymentBrandId[] = ['upi', 'visa', 'mastercard', 'rupay', 'paytm'];

export const PAYMENT_BRAND_LABELS: Record<PaymentBrandId, string> = {
  upi: 'UPI',
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  bhim: 'BHIM',
  visa: 'Visa',
  mastercard: 'Mastercard',
  rupay: 'RuPay',
  sbi: 'SBI',
  hdfc: 'HDFC Bank',
  icici: 'ICICI Bank',
  axis: 'Axis Bank',
  amazonpay: 'Amazon Pay',
  mobikwik: 'MobiKwik',
};

const BRAND_ASSET_URLS: Record<PaymentBrandId, string> = {
  upi: '/payment-logos/upi.svg',
  gpay: '/payment-logos/gpay.png',
  phonepe: '/payment-logos/phonepe.svg',
  paytm: '/payment-logos/paytm.svg',
  bhim: '/payment-logos/bhim.svg',
  visa: '/payment-logos/visa.png',
  mastercard: '/payment-logos/mastercard.svg',
  rupay: '/payment-logos/rupay.png',
  sbi: '/payment-logos/sbi.png',
  hdfc: '/payment-logos/hdfc.webp',
  icici: '/payment-logos/icici.png',
  axis: '/payment-logos/axis.png',
  amazonpay: '/payment-logos/amazon-pay.png',
  mobikwik: '/payment-logos/mobikwik.png',
};

/**
 * Default responsive brand size. Normalizes logos by visual height rather
 * than forcing a uniform width: smaller on narrow phones, larger on desktop.
 */
const BRAND_DEFAULT_SIZE = 'max-[360px]:h-[15px] h-[18px] sm:h-5';

export function PaymentBrand({ id, className }: { id: PaymentBrandId; className?: string }) {
  return (
    <PaymentLogo
      src={BRAND_ASSET_URLS[id]}
      alt={PAYMENT_BRAND_LABELS[id]}
      title={PAYMENT_BRAND_LABELS[id]}
      className={cn(
        'rounded-md bg-white border border-border/70 px-1.5',
        BRAND_DEFAULT_SIZE,
        className
      )}
    />
  );
}

export function PaymentBrandsStrip({ ids, className }: { ids: PaymentBrandId[]; className?: string }) {
  return (
    <div className={cn('flex items-center flex-wrap gap-1.5', className)}>
      {ids.map((id) => (
        <PaymentBrand key={id} id={id} />
      ))}
    </div>
  );
}
