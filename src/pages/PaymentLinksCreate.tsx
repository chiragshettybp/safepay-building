import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { toast } from 'sonner';
import { AlertCircle, Check, Copy, Link2, Loader2, Plus, Trash2 } from 'lucide-react';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import { formatAmount } from '@/lib/format';
import { callPaymentLink, buildPaymentLink, type CreateLinkResponse, type PaymentLinkItemPayload } from '@/lib/paymentLinks';

interface ItemRow {
  key: string;
  item_name: string;
  variant_label: string;
  unit_price: string;
  quantity: string;
}

const SERVICE_FEE_RATE = 0.02;

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function PaymentLinksCreate() {
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();

  const [rows, setRows] = useState<ItemRow[]>([{ key: crypto.randomUUID(), item_name: '', variant_label: '', unit_price: '', quantity: '1' }]);
  const [title, setTitle] = useState('');
  const [shipping, setShipping] = useState('');
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('');
  const [requiresShipping, setRequiresShipping] = useState(false);
  const [collectEmail, setCollectEmail] = useState(false);
  const [expiryHours, setExpiryHours] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<CreateLinkResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const subtotal = rows.reduce((sum, r) => sum + toNumber(r.unit_price) * Math.max(0, Math.floor(toNumber(r.quantity))), 0);
  const discountNum = Math.max(0, toNumber(discount));
  const shippingNum = Math.max(0, toNumber(shipping));
  const taxNum = Math.max(0, toNumber(tax));
  const fee = Math.round((subtotal - discountNum + shippingNum + taxNum) * SERVICE_FEE_RATE * 100) / 100;
  const total = Math.max(0, subtotal - discountNum + shippingNum + taxNum + fee);

  const updateRow = (key: string, field: keyof ItemRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { key: crypto.randomUUID(), item_name: '', variant_label: '', unit_price: '', quantity: '1' }]);
  };

  const removeRow = (key: string) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== key)));
  };

  const copyLink = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(buildPaymentLink(created.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast('Copied', { description: 'Payment link copied to clipboard' });
    } catch {
      toast.error('Copy failed', { description: 'Could not access the clipboard' });
    }
  };

  const handleSubmit = async () => {
    if (!merchant?.id) return;

    const items: PaymentLinkItemPayload[] = rows
      .filter((r) => r.item_name.trim() && r.unit_price)
      .map((r) => ({
        item_name: r.item_name.trim(),
        variant_label: r.variant_label.trim() || undefined,
        unit_price: toNumber(r.unit_price),
        quantity: Math.floor(toNumber(r.quantity)) || 1,
      }));

    if (items.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    if (items.some((i) => i.unit_price <= 0)) {
      toast.error('Item prices must be greater than zero');
      return;
    }

    try {
      setIsSubmitting(true);
      const hours = Math.floor(toNumber(expiryHours));
      const result = await callPaymentLink<CreateLinkResponse>('create-link', {
        merchantId: merchant.id,
        title: title.trim() || null,
        items,
        shippingAmount: shippingNum,
        discountAmount: discountNum,
        taxAmount: taxNum,
        requiresShipping,
        collectEmail,
        expiresAt: hours > 0 ? new Date(Date.now() + hours * 3600_000).toISOString() : null,
        sessionExpiryHours: 24,
      });
      setCreated(result);
      toast.success('Reusable payment link created');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create payment link');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !isAuthenticated || !merchant) {
    return <FullPageLoading />;
  }

  if (created) {
    const link = buildPaymentLink(created.token);
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <div className="px-4 py-5 sm:px-6">
          <MerchantPageHeader
            title="Payment link created"
            back={{ fallback: '/payment-links', label: 'Back to Payment Links' }}
          />
        </div>

        <main className="flex-1 overflow-y-auto pb-24">
          <div className="px-4 py-6">
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <Check className="h-7 w-7 text-success" />
            </div>
            <h2 className="text-lg font-semibold text-foreground text-center mb-1">{created.public_link_id}</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              This link is reusable — every customer who opens it gets their own payment session and order. Share it anywhere, any number of times.
              {created.expires_at && (
                <span className="block mt-1">
                  It expires on{' '}
                  {new Date(created.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.
                </span>
              )}
            </p>

            <div className="bg-muted/30 rounded-xl p-4 mb-6">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Payment link</p>
                  <p className="text-sm font-medium text-foreground break-all font-mono">{link}</p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0" onClick={copyLink}>
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Reusable link</span>
                <span className="font-semibold text-foreground">Unlimited orders</span>
              </div>
            </div>

            <Button className="w-full mb-2" onClick={copyLink}>
              {copied ? <Check className="h-4 w-4 mr-2 text-success" /> : <Copy className="h-4 w-4 mr-2" />}
              Copy payment link
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate('/payment-links')}>
              View all payment links
            </Button>
          </div>
        </main>

        <MerchantBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <div className="px-4 py-5 sm:px-6">
        <MerchantPageHeader
          title="Create payment link"
          back={{ fallback: '/payment-links', label: 'Back to Payment Links' }}
        />
      </div>

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-xl px-3 py-2.5 mb-4">
            <Link2 className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs text-foreground">
              Reusable link — each customer who opens it gets their own payment session and order. Money is held in escrow until you ship.
            </p>
          </div>

          <Label className="mb-2 block">Link title (optional)</Label>
          <Input
            placeholder="e.g. Summer collection 2026"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-10 text-sm mb-4"
          />

          <Label className="mb-2 block">Items</Label>
          <div className="space-y-2 mb-4">
            {rows.map((row, index) => (
              <div key={row.key} className="bg-muted/30 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Item {index + 1}</span>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(row.key)} className="p-1 hover:bg-muted rounded-md touch-target" aria-label="Remove item">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Input
                      placeholder="Item name (e.g. Cotton T-Shirt)"
                      value={row.item_name}
                      onChange={(e) => updateRow(row.key, 'item_name', e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                  <Input
                    placeholder="Variant (optional)"
                    value={row.variant_label}
                    onChange={(e) => updateRow(row.key, 'variant_label', e.target.value)}
                    className="h-10 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Price"
                      value={row.unit_price}
                      onChange={(e) => updateRow(row.key, 'unit_price', e.target.value)}
                      className="h-10 text-sm"
                    />
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={(e) => updateRow(row.key, 'quantity', e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full h-9 text-xs" onClick={addRow}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add item
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Shipping</Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Discount</Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Tax</Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
          </div>

          <div className="bg-muted/30 rounded-xl p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-sm font-medium text-foreground">{formatAmount(subtotal)}</span>
            </div>
            {discountNum > 0 && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Discount</span>
                <span className="text-sm font-medium text-destructive">−{formatAmount(discountNum)}</span>
              </div>
            )}
            {shippingNum > 0 && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Shipping</span>
                <span className="text-sm font-medium text-foreground">{formatAmount(shippingNum)}</span>
              </div>
            )}
            {taxNum > 0 && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Tax</span>
                <span className="text-sm font-medium text-foreground">{formatAmount(taxNum)}</span>
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">SafePay fee (2%)</span>
              <span className="text-sm font-medium text-foreground">{formatAmount(fee)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm font-semibold text-foreground">Total</span>
              <span className="text-base font-bold text-foreground">{formatAmount(total)}</span>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Collect shipping address</Label>
                <p className="text-xs text-muted-foreground">Required before payment for physical delivery</p>
              </div>
              <Switch checked={requiresShipping} onCheckedChange={setRequiresShipping} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Collect email</Label>
                <p className="text-xs text-muted-foreground">Send order updates to your customer</p>
              </div>
              <Switch checked={collectEmail} onCheckedChange={setCollectEmail} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Link expiry</Label>
              <Select value={expiryHours} onValueChange={setExpiryHours}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Never expires</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                  <SelectItem value="720">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {subtotal > 0 && discountNum > subtotal && (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5 mb-4">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">Discount cannot exceed subtotal</p>
            </div>
          )}

          <Button className="w-full h-11" onClick={handleSubmit} disabled={isSubmitting || subtotal === 0 || discountNum > subtotal}>
            {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
            Create payment link
          </Button>
        </div>
      </main>

      <MerchantBottomNav />
    </div>
  );
}
