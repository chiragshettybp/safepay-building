import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface PaymentLinkSummaryLine {
  id: string;
  item_name: string;
  variant_label?: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface PaymentLinkSummaryData {
  items: PaymentLinkSummaryLine[];
  subtotal: number;
  shipping_amount: number;
  discount_amount: number;
  tax_amount: number;
  service_fee_amount: number;
  final_amount: number;
  service_fee_percent?: number | null;
  currency?: string | null;
}

export function PaymentLinkSummary({
  data,
  compact,
  className,
}: {
  data: PaymentLinkSummaryData;
  compact?: boolean;
  className?: string;
}) {
  const {
    items,
    subtotal,
    shipping_amount,
    discount_amount,
    tax_amount,
    service_fee_amount,
    final_amount,
    service_fee_percent,
    currency,
  } = data;

  return (
    <div className={cn('bg-card rounded-2xl border border-border p-4', compact && 'p-3', className)}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={cn('text-sm font-semibold text-foreground', compact && 'text-xs')}>Order summary</h2>
        <span className="text-xs text-muted-foreground">
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={cn('text-sm font-medium text-foreground truncate', compact && 'text-xs')}>{item.item_name}</p>
              <p className="text-xs text-muted-foreground">
                {item.variant_label && `${item.variant_label} · `}
                {formatAmount(item.unit_price, currency)} × {item.quantity}
              </p>
            </div>
            <span className={cn('text-sm font-medium text-foreground shrink-0', compact && 'text-xs')}>
              {formatAmount(item.line_total, currency)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium text-foreground">{formatAmount(subtotal, currency)}</span>
        </div>
        {discount_amount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span className="font-medium text-destructive">−{formatAmount(discount_amount, currency)}</span>
          </div>
        )}
        {shipping_amount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span className="font-medium text-foreground">{formatAmount(shipping_amount, currency)}</span>
          </div>
        )}
        {tax_amount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span className="font-medium text-foreground">{formatAmount(tax_amount, currency)}</span>
          </div>
        )}
        {service_fee_amount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              SafePay fee{service_fee_percent ? ` (${service_fee_percent}%)` : ''}
            </span>
            <span className="font-medium text-foreground">{formatAmount(service_fee_amount, currency)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t border-border">
          <span className="font-semibold text-foreground">Total</span>
          <span className="font-bold text-foreground">{formatAmount(final_amount, currency)}</span>
        </div>
      </div>
    </div>
  );
}
