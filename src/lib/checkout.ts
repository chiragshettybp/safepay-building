import { Smartphone, CreditCard, Landmark, Wallet, type LucideIcon } from 'lucide-react';

export type CheckoutMethodId = 'upi' | 'card' | 'netbanking' | 'wallet';

export interface CheckoutMethodMeta {
  id: CheckoutMethodId;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const CHECKOUT_METHODS: CheckoutMethodMeta[] = [
  { id: 'upi', label: 'UPI', description: 'GPay, PhonePe, Paytm & more', icon: Smartphone },
  { id: 'card', label: 'Credit / Debit Card', description: 'Visa, Mastercard, RuPay', icon: CreditCard },
  { id: 'netbanking', label: 'Net Banking', description: 'All major Indian banks', icon: Landmark },
  { id: 'wallet', label: 'Wallets', description: 'Amazon Pay, Mobikwik & more', icon: Wallet },
];

export function checkoutMethodLabel(id: string): string {
  return CHECKOUT_METHODS.find((m) => m.id === id)?.label ?? id;
}

export interface CheckoutItemPayload {
  item_name: string;
  variant_label?: string;
  unit_price: number;
  quantity: number;
  image_url?: string;
}

export interface CheckoutItem {
  id: string;
  session_id: string;
  item_name: string;
  variant_label: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  image_url: string | null;
  created_at: string;
}

export interface CheckoutEvent {
  id: string;
  session_id: string;
  event_type: string;
  step: string;
  event_data: Record<string, unknown> | null;
  created_at: string;
}

export interface CheckoutSessionSummary {
  id: string;
  public_checkout_id: string;
  token: string;
  status: string;
  current_step: string;
  final_amount: number;
  currency: string;
  guest_name: string | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
  order_id: string | null;
  checkout_items: { count: number } | null;
}

export interface CheckoutSessionDetail {
  id: string;
  public_checkout_id: string;
  token: string;
  status: string;
  current_step: string;
  subtotal: number;
  shipping_amount: number;
  discount_amount: number;
  tax_amount: number;
  service_fee_amount: number;
  final_amount: number;
  currency: string;
  requires_shipping: boolean;
  collect_email: boolean;
  guest_name: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  selected_payment_method: string | null;
  shipping_address: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
  customer_id: string | null;
  order_id: string | null;
}

export interface CheckoutAnalytics {
  sessions_created: number;
  sessions_completed: number;
  sessions_expired: number;
  sessions_cancelled: number;
  sessions_failed: number;
  sessions_active: number;
  sessions_last_30: number;
  conversion_rate: number;
  revenue: number;
  average_order_value: number;
}

export interface CreateSessionResponse {
  id: string;
  token: string;
  public_checkout_id: string;
  subtotal: number;
  shipping_amount: number;
  discount_amount: number;
  tax_amount: number;
  service_fee_amount: number;
  final_amount: number;
  expires_at: string;
}

export interface CreateLinkResponse {
  id: string;
  public_link_id: string;
  token: string;
  title: string | null;
  status: string;
  expires_at: string | null;
  session_expiry_hours: number;
  created_at: string;
}

export interface CheckoutLinkSummary {
  id: string;
  public_link_id: string;
  token: string;
  title: string | null;
  status: string;
  expires_at: string | null;
  session_expiry_hours: number;
  created_at: string;
  updated_at: string;
  sessions_count: number;
  orders_count: number;
  success_payments: number;
  failed_payments: number;
  revenue: number;
  last_activity_at: string | null;
}

export interface CheckoutLinkItemTemplate {
  id: string;
  item_name: string;
  variant_label: string | null;
  unit_price: number;
  quantity: number;
  discount: number;
  tax_amount: number;
  line_total: number;
}

export interface CheckoutLinkSession {
  id: string;
  public_checkout_id: string;
  status: string;
  final_amount: number;
  currency: string;
  guest_name: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  created_at: string;
  completed_at: string | null;
  order_id: string | null;
  order_public_id: string | null;
  order_number: string | null;
}

export interface CheckoutLinkDetail {
  id: string;
  public_link_id: string;
  token: string;
  title: string | null;
  status: string;
  requires_shipping: boolean;
  collect_email: boolean;
  shipping_amount: number;
  discount_amount: number;
  tax_amount: number;
  expires_at: string | null;
  session_expiry_hours: number;
  created_at: string;
  updated_at: string;
  items: CheckoutLinkItemTemplate[];
  sessions: CheckoutLinkSession[];
}

export interface OpenLinkResponse extends PublicCheckoutData {
  resumed: boolean;
  link: {
    id: string;
    public_link_id: string;
    title: string | null;
    token: string;
    status: string;
    expires_at: string | null;
  };
}

export interface CreatePaymentResponse {
  mode: 'test' | 'razorpay';
  transactionId: string;
  finalAmount: number;
  currency: string;
  razorpayOrderId?: string;
  keyId?: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  alreadyProcessed?: boolean;
  order?: {
    created: boolean;
    order_id?: string;
    order_number?: string;
    public_order_id?: string;
  };
}

export interface PublicCheckoutItem {
  id: string;
  item_name: string;
  variant_label: string | null;
  variant_attributes: Record<string, unknown> | null;
  sku: string | null;
  unit_price: number;
  quantity: number;
  discount: number;
  tax_amount: number;
  line_total: number;
}

export interface PublicCheckoutConfig {
  merchant_id: string;
  guest_checkout_enabled: boolean;
  email_required: boolean;
  shipping_required: boolean;
  payment_cards_enabled: boolean;
  payment_upi_enabled: boolean;
  payment_netbanking_enabled: boolean;
  payment_wallets_enabled: boolean;
  session_expiry_hours: number;
  service_fee_percent: number;
  success_url: string | null;
  cancel_url: string | null;
}

export interface PublicCheckoutData {
  not_found: boolean;
  session: {
    id: string;
    public_checkout_id: string;
    token: string;
    status: string;
    current_step: string;
    currency: string;
    subtotal: number;
    discount_amount: number;
    shipping_amount: number;
    tax_amount: number;
    service_fee_amount: number;
    final_amount: number;
    requires_shipping: boolean;
    collect_email: boolean;
    expires_at: string;
    completed_at: string | null;
    guest_name: string | null;
    guest_phone: string | null;
    guest_email: string | null;
    shipping_address: Record<string, unknown> | null;
    selected_payment_method: string | null;
    created_at: string;
    order_id: string | null;
    payment_transaction_id: string | null;
  };
  items: PublicCheckoutItem[];
  merchant: {
    id: string;
    public_merchant_id: string;
    business_name: string;
    business_logo_url: string | null;
    business_category: string | null;
    verification_status: string;
    is_active: boolean;
  };
  config: PublicCheckoutConfig;
  order: {
    id: string;
    public_order_id: string;
    order_number: string;
    status: string;
    escrow_status: string;
    amount: number;
    currency: string;
    product_name: string;
    created_at: string;
  } | null;
}

export class CheckoutApiError extends Error {
  code: string;
  detail?: string;
  status: number;

  constructor(code: string, detail?: string, status = 400) {
    super(detail || code);
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}

const CHECKOUT_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL ?? 'https://jcxhagmfbezpgrxdxfvs.supabase.co'}/functions/v1/checkout-payment`;

const MERCHANT_TOKEN_KEY = 'safepay_merchant_token';

export async function callCheckout<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const merchantToken = localStorage.getItem(MERCHANT_TOKEN_KEY);
  if (merchantToken) headers.Authorization = `Bearer ${merchantToken}`;

  const res = await fetch(CHECKOUT_FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...data }),
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok || !payload || (payload as { error?: string }).error) {
    const err = (payload ?? {}) as { error?: string; detail?: string };
    throw new CheckoutApiError(err.error || 'REQUEST_FAILED', err.detail, res.status);
  }

  return payload as T;
}

export function buildCheckoutLink(token: string): string {
  return `${window.location.origin}/checkout/${token}`;
}

const SESSION_TOKEN_KEY_PREFIX = 'safepay_checkout_session:';

export function getCheckoutSessionToken(linkToken: string): string | null {
  try {
    return sessionStorage.getItem(`${SESSION_TOKEN_KEY_PREFIX}${linkToken}`);
  } catch {
    return null;
  }
}

export function setCheckoutSessionToken(linkToken: string, sessionToken: string): void {
  try {
    sessionStorage.setItem(`${SESSION_TOKEN_KEY_PREFIX}${linkToken}`, sessionToken);
  } catch {
    // Storage unavailable (private mode) — the session still works for the
    // lifetime of this page load.
  }
}

export function clearCheckoutSessionToken(linkToken: string): void {
  try {
    sessionStorage.removeItem(`${SESSION_TOKEN_KEY_PREFIX}${linkToken}`);
  } catch {
    // ignore
  }
}

export function checkoutStatusMeta(status: string): { label: string; tone: 'success' | 'warning' | 'destructive' | 'info' | 'neutral' } {
  switch (status) {
    case 'active':
      return { label: 'Active', tone: 'info' };
    case 'completed':
      return { label: 'Completed', tone: 'success' };
    case 'expired':
      return { label: 'Expired', tone: 'neutral' };
    case 'failed':
      return { label: 'Failed', tone: 'destructive' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'neutral' };
    case 'abandoned':
      return { label: 'Abandoned', tone: 'warning' };
    default:
      return { label: status, tone: 'neutral' };
  }
}
