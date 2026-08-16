import type { StatusTone } from '@/components/shared/StatusBadge';

// =============================================================================
// Checkout Integration — client library + types for the external merchant API
// platform. Completely separate from Payment Links.
// =============================================================================

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL ?? 'https://jcxhagmfbezpgrxdxfvs.supabase.co'}/functions/v1/checkout-integration`;
const MERCHANT_TOKEN_KEY = 'safepay_merchant_token';

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

export interface CheckoutIntegration {
  id: string;
  public_integration_id: string;
  merchant_id: string;
  name: string;
  status: 'active' | 'disabled';
  live_enabled: boolean;
  live_requested: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyRow {
  id: string;
  name: string;
  key_type: 'publishable' | 'secret';
  environment: 'test' | 'live';
  key_prefix: string;
  last_four: string;
  fingerprint: string;
  scopes?: string[];
  status: 'active' | 'revoked';
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface CreatedApiKey extends ApiKeyRow {
  raw?: string;
  secret?: string;
  display_secret?: string;
}

export interface WebhookEndpointRow {
  id: string;
  public_webhook_id: string;
  url: string;
  events: string[];
  status: 'active' | 'disabled';
  last_delivered_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  created_at: string;
}

export interface CreatedWebhookEndpoint extends WebhookEndpointRow {
  secret?: string;
  display_secret?: string;
}

export interface WebhookEventRow {
  id: string;
  event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  webhook_deliveries?: WebhookDeliveryMini[];
}

export interface WebhookDeliveryMini {
  id: string;
  status: string;
  attempt_count: number;
  http_status: number | null;
  response_time_ms: number | null;
  last_attempt_at: string | null;
}

export interface WebhookDeliveryRow {
  id: string;
  status: 'pending' | 'delivered' | 'failed' | 'retrying' | 'exhausted';
  attempt_count: number;
  http_status: number | null;
  response_body: string | null;
  response_time_ms: number | null;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  created_at: string;
  webhook_events?: { event_id: string; event_type: string; created_at: string };
  webhook_endpoints?: { url: string; public_webhook_id: string };
}

export interface ApiRequestLogRow {
  request_id: string;
  method: string;
  endpoint: string;
  status_code: number;
  latency_ms: number;
  environment: 'test' | 'live' | null;
  error_code: string | null;
  created_at: string;
}

export interface IntegrationSessionRow {
  id: string;
  public_checkout_id: string;
  merchant_order_id: string | null;
  environment: 'test' | 'live' | null;
  status: string;
  final_amount: number;
  currency: string;
  guest_name: string | null;
  guest_email: string | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
  order_id: string | null;
}

export interface IntegrationSessionDetail {
  id: string;
  public_checkout_id: string;
  merchant_order_id: string | null;
  environment: 'test' | 'live' | null;
  status: string;
  current_step: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  shipping_amount: number;
  tax_amount: number;
  service_fee_amount: number;
  final_amount: number;
  guest_name: string | null;
  guest_email: string | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
  items: IntegrationSessionItem[];
  payment: IntegrationPayment | null;
  order: IntegrationOrder | null;
  payment_attempts: IntegrationAttempt[];
}

export interface IntegrationSessionItem {
  item_name: string;
  variant_label: string | null;
  sku: string | null;
  unit_price: number;
  quantity: number;
  discount: number;
  tax_amount: number;
  line_total: number;
}

export interface IntegrationPayment {
  id: string;
  public_payment_id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  gateway: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  failure_reason: string | null;
  created_at: string;
}

export interface IntegrationOrder {
  id: string;
  public_order_id: string;
  order_number: string;
  status: string;
  escrow_status: string;
  amount: number;
  currency: string;
  created_at: string;
}

export interface IntegrationAttempt {
  method: string;
  status: string;
  failure_reason: string | null;
  created_at: string;
}

export interface IntegrationHealth {
  sessions_created: number;
  sessions_completed: number;
  sessions_failed: number;
  revenue: number;
  webhook_successes: number;
  webhook_failures: number;
  avg_api_latency_ms: number | null;
  recent_api_errors_7d: number;
  last_successful_checkout: string | null;
  last_successful_webhook: string | null;
  sessions_24h: number;
  health_score: number;
}

export interface IntegrationIncident {
  id: string;
  integration_id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface IntegrationTestRun {
  id: string;
  integration_id: string;
  status: 'running' | 'passed' | 'failed';
  steps: IntegrationTestStep[];
  started_at: string;
  finished_at: string | null;
}

export interface IntegrationTestStep {
  name: string;
  status: 'running' | 'passed' | 'failed' | 'pending';
  detail?: string;
}

export interface IntegrationOverview {
  integration: CheckoutIntegration;
  health: IntegrationHealth | null;
  keys: ApiKeyRow[];
  endpoints: WebhookEndpointRow[];
  recent_requests: ApiRequestLogRow[];
  recent_deliveries: WebhookDeliveryRow[];
  recent_sessions: IntegrationSessionRow[];
  incidents: IntegrationIncident[];
}

export interface AdminIntegrationRow extends CheckoutIntegration {
  merchants: { business_name: string } | null;
}

// ---------------------------------------------------------------------------
// Public checkout data
// ---------------------------------------------------------------------------

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

export interface PublicCheckoutSession {
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
}

export interface OpenSessionResponse {
  not_found: boolean;
  session: PublicCheckoutSession;
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
  config: {
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
  };
  order: IntegrationOrder | null;
}

export interface CreatePaymentResponse {
  mode: 'test' | 'razorpay';
  transactionId: string;
  finalAmount: number;
  currency: string;
  environment?: 'test' | 'live';
  razorpayOrderId?: string;
  keyId?: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  alreadyProcessed?: boolean;
  order?: IntegrationOrder | null;
  verified?: boolean;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export class IntegrationApiError extends Error {
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

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok || !payload || (payload as { error?: unknown }).error) {
    const err = (payload ?? {}) as { error?: string; detail?: string };
    throw new IntegrationApiError(err.error || 'REQUEST_FAILED', err.detail, res.status);
  }

  return payload;
}

/**
 * Call the checkout-integration edge function with the merchant session token
 * (used by the merchant console, the public checkout actions and admin).
 */
export async function callCheckoutIntegration<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const merchantToken = localStorage.getItem(MERCHANT_TOKEN_KEY);
  if (merchantToken) headers.Authorization = `Bearer ${merchantToken}`;
  return (await postJson(FUNCTION_URL, headers, { action, ...data })) as T;
}

/**
 * Call the external integration API with a raw API key
 * (sp_test_secret_... / sp_live_secret_...). Used by the SDK and the
 * Developers sandbox.
 */
export async function callIntegrationApi<T>(apiKey: string, action: string, data: Record<string, unknown> = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
  return (await postJson(FUNCTION_URL, headers, { action, ...data })) as T;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export async function getIntegrationId(merchantId: string): Promise<string> {
  const res = await callCheckoutIntegration<{ integration: CheckoutIntegration }>('get-integration', { merchantId });
  return res.integration.id;
}

export function buildIntegrationCheckoutUrl(token: string): string {
  return `${window.location.origin}/integration-checkout/${token}`;
}

export function buildIntegrationCheckoutSuccessUrl(token: string): string {
  return `${window.location.origin}/integration-checkout/${token}/success`;
}

export function integrationStatusMeta(status: string): { label: string; tone: StatusTone } {
  switch (status) {
    case 'active':
      return { label: 'Active', tone: 'info' };
    case 'disabled':
      return { label: 'Disabled', tone: 'neutral' };
    case 'completed':
      return { label: 'Completed', tone: 'success' };
    case 'expired':
      return { label: 'Expired', tone: 'neutral' };
    case 'failed':
      return { label: 'Failed', tone: 'destructive' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'neutral' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

export function deliveryStatusMeta(status: string): { label: string; tone: StatusTone } {
  switch (status) {
    case 'delivered':
      return { label: 'Delivered', tone: 'success' };
    case 'pending':
      return { label: 'Pending', tone: 'warning' };
    case 'retrying':
      return { label: 'Retrying', tone: 'warning' };
    case 'exhausted':
      return { label: 'Exhausted', tone: 'destructive' };
    case 'failed':
      return { label: 'Failed', tone: 'destructive' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

export function keyTone(keyType: string, status: string): StatusTone {
  if (status === 'revoked') return 'neutral';
  return keyType === 'secret' ? 'warning' : 'info';
}

export const INTEGRATION_EVENTS = [
  'checkout.created',
  'checkout.expired',
  'checkout.cancelled',
  'checkout.completed',
  'payment.succeeded',
  'payment.failed',
  'order.created',
] as const;

// Public checkout session token persistence (per checkout token)
const SESSION_TOKEN_PREFIX = 'safepay_integration_session:';

export function getIntegrationSessionToken(checkoutToken: string): string | null {
  try {
    return sessionStorage.getItem(`${SESSION_TOKEN_PREFIX}${checkoutToken}`);
  } catch {
    return null;
  }
}

export function setIntegrationSessionToken(checkoutToken: string, sessionToken: string): void {
  try {
    sessionStorage.setItem(`${SESSION_TOKEN_PREFIX}${checkoutToken}`, sessionToken);
  } catch {
    // ignore
  }
}

export function clearIntegrationSessionToken(checkoutToken: string): void {
  try {
    sessionStorage.removeItem(`${SESSION_TOKEN_PREFIX}${checkoutToken}`);
  } catch {
    // ignore
  }
}
