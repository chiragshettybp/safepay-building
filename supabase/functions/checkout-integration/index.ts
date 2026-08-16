// checkout-integration — SafePay Checkout Integration platform.
//
// COMPLETELY SEPARATE feature from "payment links". This edge function is the
// external merchant API gateway (API-key authenticated), the merchant
// integration console backend, the customer checkout backend for hosted
// integration checkouts, and the merchant webhook delivery worker.
//
// It reuses the existing shared checkout engine (checkout_sessions,
// checkout_items, payment_transactions, payment_attempts, and the engine RPCs
// create_checkout_session / finalize_checkout_payment /
// get_public_checkout_session / cancel_checkout_session) and the existing
// Razorpay gateway — it never re-implements payment/order/ledger logic.
//
// Action groups:
//   Merchant console   (Authorization: Bearer <merchant session token>)
//     integration.*    — get / create / update / set-status / request-live
//     keys.*           — list / create / revoke / rotate API keys
//     webhooks.*       — endpoints CRUD, events, deliveries, test, replay, worker
//     requests.*       — API request log
//     sessions.*       — list / get integration sessions
//     health.get       — real integration health metrics
//     tests.*          — integration test runs
//     overview         — dashboard bundle
//
//   External API       (Authorization: Bearer sp_test_secret_xxx / sp_live_...)
//     api.create-session / api.get-session / api.cancel-session /
//     api.get-payment / api.verify-key
//
//   Public customer checkout (session token is the capability, no auth)
//     open-session / create-payment / verify-payment / cancel-payment / get-status
//
//   Admin             (merchant session token whose user has role 'admin')
//     admin.list-integrations / admin.set-status / admin.revoke-key /
//     admin.replay-webhook
//
// Security guarantees:
//   * Secret keys are stored ONLY as SHA-256 hashes; full key returned once.
//   * Environment is enforced by the DB RPC (test keys never create live
//     sessions). Test-environment payments use the test handshake — no real
//     gateway call, no real money.
//   * Idempotency via Idempotency-Key header + idempotency_keys table.
//   * Rate limiting per API key (sliding window over api_request_logs).
//   * Every API request logged with a unique request_id.
//   * Webhook payloads signed HMAC-SHA256 with the endpoint secret; retries
//     with exponential backoff; delivery status persisted.
//   * The browser redirect is NEVER the source of truth for payment success —
//     only finalize_checkout_payment() records success.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key, x-request-id',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return hex(new Uint8Array(bytes));
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return hex(arr);
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

// Merchant dashboard auth: custom session token (same as payment-links).
async function authorizeMerchant(req: Request, merchantId: string) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return json({ error: "UNAUTHORIZED" }, 401);

  const { data: session, error } = await supabase
    .from("user_sessions")
    .select("user_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !session) return json({ error: "UNAUTHORIZED" }, 401);

  const { data: merchant, error: mErr } = await supabase
    .from("merchants")
    .select("id, user_id")
    .eq("id", merchantId)
    .eq("user_id", session.user_id)
    .maybeSingle();
  if (mErr || !merchant) return json({ error: "FORBIDDEN" }, 403);

  return { userId: session.user_id };
}

async function hasAdminRole(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) return false;
  return true;
}

async function resolveIntegration(integrationId: string, merchantId: string) {
  const { data, error } = await supabase
    .from("checkout_integrations")
    .select("*")
    .eq("id", integrationId)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// API-key auth: Bearer sp_test_secret_xxx. Returns the key row + integration.
async function authorizeApiKey(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const key = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!key) return { error: json({ error: "MISSING_API_KEY" }, 401) };

  const keyHash = await sha256Hex(key);
  const { data: keyRow, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (error || !keyRow) return { error: json({ error: "INVALID_API_KEY" }, 401) };
  if (keyRow.status !== "active") return { error: json({ error: "API_KEY_REVOKED" }, 401) };

  const { data: integration } = await supabase
    .from("checkout_integrations")
    .select("*")
    .eq("id", keyRow.integration_id)
    .maybeSingle();
  if (!integration) return { error: json({ error: "INTEGRATION_NOT_FOUND" }, 404) };
  if (integration.status !== "active") return { error: json({ error: "INTEGRATION_DISABLED" }, 403) };

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, business_name, is_active, verification_status")
    .eq("id", integration.merchant_id)
    .maybeSingle();
  if (!merchant || !merchant.is_active || merchant.verification_status !== "approved") {
    return { error: json({ error: "MERCHANT_NOT_ELIGIBLE" }, 403) };
  }

  return { keyRow, integration, merchant };
}

// ---------------------------------------------------------------------------
// Request logging + rate limiting
// ---------------------------------------------------------------------------
async function logRequest(opts: {
  requestId: string;
  integrationId?: string | null;
  apiKeyId?: string | null;
  method: string;
  endpoint: string;
  statusCode: number;
  startedAt: number;
  environment?: string | null;
  errorCode?: string | null;
}) {
  try {
    await supabase.from("api_request_logs").insert({
      request_id: opts.requestId,
      integration_id: opts.integrationId ?? null,
      api_key_id: opts.apiKeyId ?? null,
      method: opts.method,
      endpoint: opts.endpoint,
      status_code: opts.statusCode,
      latency_ms: Math.max(0, Date.now() - opts.startedAt),
      environment: opts.environment ?? null,
      error_code: opts.errorCode ?? null,
    });
  } catch {
    // logging must never break the API
  }
}

// Simple sliding-window rate limit per API key (uses api_request_logs as the
// counter store so it survives restarts and is shared across function instances).
async function rateLimit(apiKeyId: string, windowMs: number, limit: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await supabase
    .from("api_request_logs")
    .select("*", { count: "exact", head: true })
    .eq("api_key_id", apiKeyId)
    .gte("created_at", since);
  if (error) return false;
  return (count ?? 0) >= limit;
}

function makeRequestId(): string {
  return "req_" + randomHex(8);
}

// ---------------------------------------------------------------------------
// API key generation
// ---------------------------------------------------------------------------
const KEY_PREFIXES = {
  "test": { publishable: "sp_test_public", secret: "sp_test_secret" },
  "live": { publishable: "sp_live_public", secret: "sp_live_secret" },
} as const;

async function createApiKeyRecord(opts: {
  integrationId: string;
  name: string;
  keyType: "publishable" | "secret";
  environment: "test" | "live";
  scopes: string[];
}) {
  const prefix = KEY_PREFIXES[opts.environment][opts.keyType];
  const raw = prefix + "_" + randomHex(24);
  const keyHash = await sha256Hex(raw);
  const fingerprint = (await sha256Hex(prefix)).slice(0, 16);
  const lastFour = raw.slice(-4);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      integration_id: opts.integrationId,
      name: opts.name,
      key_type: opts.keyType,
      environment: opts.environment,
      key_prefix: prefix,
      key_hash: keyHash,
      last_four: lastFour,
      fingerprint,
      scopes: opts.scopes,
      status: "active",
    })
    .select()
    .single();
  if (error || !data) return { error };

  if (opts.scopes.length > 0) {
    await supabase.from("api_key_scopes").insert(
      opts.scopes.map((s) => ({ api_key_id: data.id, scope: s }))
    );
  }

  return { data, raw };
}

// ---------------------------------------------------------------------------
// Webhook delivery worker
// ---------------------------------------------------------------------------
const WEBHOOK_MAX_ATTEMPTS = 5;
const WEBHOOK_TIMEOUT_MS = 10000;

async function signWebhookPayload(secret: string, timestamp: number, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  return hex(new Uint8Array(sig));
}

// Deliver one pending delivery row. Returns the updated status.
async function deliverWebhook(deliveryId: string): Promise<{ status: string; httpStatus?: number; responseTime?: number }> {
  const { data: delivery } = await supabase
    .from("webhook_deliveries")
    .select("*, webhook_events(*), webhook_endpoints(*)")
    .eq("id", deliveryId)
    .single();
  if (!delivery) return { status: "failed" };

  const event = delivery.webhook_events;
  const endpoint = delivery.webhook_endpoints;
  if (!event || !endpoint || endpoint.status !== "active") {
    return { status: "failed" };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    event_id: event.event_id,
    event_type: event.event_type,
    timestamp,
    integration_id: event.integration_id,
    session_id: event.session_id,
    merchant_order_id: event.payload?.merchant_order_id ?? null,
    data: event.payload ?? {},
  });
  const signature = await signWebhookPayload(endpoint.secret, timestamp, payload);

  const started = Date.now();
  let httpStatus = 0;
  let body = "";
  let failed = false;
  try {
    const resp = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-safepay-signature": `t=${timestamp},v1=${signature}`,
        "x-safepay-event-id": event.event_id,
        "x-safepay-event-type": event.event_type,
      },
      body: payload,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    httpStatus = resp.status;
    body = (await resp.text()).slice(0, 2000);
    failed = resp.status < 200 || resp.status >= 300;
  } catch {
    failed = true;
  }
  const responseTime = Date.now() - started;

  const attempt = (delivery.attempt_count ?? 0) + 1;
  const now = new Date();

  let status: string;
  if (!failed) {
    status = "delivered";
  } else if (httpStatus >= 400 && httpStatus < 500) {
    status = "failed"; // permanent client-side error
  } else if (attempt >= WEBHOOK_MAX_ATTEMPTS) {
    status = "exhausted";
  } else {
    status = "retrying";
  }

  const backoffSeconds = Math.min(60 * 60, 15 * Math.pow(2, attempt - 1));
  await supabase
    .from("webhook_deliveries")
    .update({
      status,
      attempt_count: attempt,
      http_status: httpStatus || null,
      response_body: body,
      response_time_ms: responseTime,
      last_attempt_at: now.toISOString(),
      next_retry_at: failed ? new Date(Date.now() + backoffSeconds * 1000).toISOString() : null,
    })
    .eq("id", deliveryId);

  if (status === "delivered") {
    await supabase.from("webhook_endpoints").update({ last_delivered_at: now.toISOString(), last_success_at: now.toISOString() }).eq("id", endpoint.id);
    await updateTestRunFromMerchantOrder(event.integration_id, event.payload?.merchant_order_id, "webhook", `Delivered ${event.event_type} (HTTP ${httpStatus})`);
  } else {
    await supabase.from("webhook_endpoints").update({ last_failure_at: now.toISOString() }).eq("id", endpoint.id);
  }

  return { status, httpStatus, responseTime };
}

// Process due pending/retrying deliveries for an integration (limit batch).
async function processWebhookDeliveries(integrationId: string, limit = 10): Promise<number> {
  const { data: endpoints, error: epErr } = await supabase
    .from("webhook_endpoints")
    .select("id")
    .eq("integration_id", integrationId);
  if (epErr || !endpoints || endpoints.length === 0) return 0;
  const endpointIds = endpoints.map((e) => e.id);

  const { data: pending, error } = await supabase
    .from("webhook_deliveries")
    .select("id")
    .eq("status", "pending")
    .in("endpoint_id", endpointIds)
    .limit(limit);
  if (error || !pending) return 0;

  const { data: retrying, error: rErr } = await supabase
    .from("webhook_deliveries")
    .select("id")
    .eq("status", "retrying")
    .lte("next_retry_at", new Date().toISOString())
    .in("endpoint_id", endpointIds)
    .limit(limit);
  if (rErr) return 0;

  const ids = [...(pending ?? []), ...(retrying ?? [])].map((d) => d.id);
  let delivered = 0;
  for (const id of ids) {
    const res = await deliverWebhook(id);
    if (res.status === "delivered") delivered++;
  }
  return delivered;
}

// ---------------------------------------------------------------------------
// Razorpay gateway helpers (reused engine)
// ---------------------------------------------------------------------------
async function createRazorpayOrder(amount: number, currency: string, receipt: string) {
  const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
  const resp = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Math.round(amount * 100), currency, receipt }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Razorpay order creation failed: ${text}`);
  }
  return resp.json();
}

async function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): Promise<boolean> {
  if (!RAZORPAY_KEY_SECRET || !orderId || !paymentId || !signature) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(RAZORPAY_KEY_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${orderId}|${paymentId}`));
    const hexSig = hex(new Uint8Array(sig));
    if (hexSig.length !== signature.length) return false;
    let result = 0;
    for (let i = 0; i < hexSig.length; i++) result |= hexSig.charCodeAt(i) ^ signature.charCodeAt(i);
    return result === 0;
  } catch {
    return false;
  }
}

async function verifyRazorpayPaymentViaAPI(paymentId: string): Promise<boolean> {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return false;
  try {
    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const resp = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!resp.ok) return false;
    const payment = await resp.json();
    return payment.status === "captured" || payment.status === "authorized";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Customer helpers
// ---------------------------------------------------------------------------
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, "");
  if (/^\d{10}$/.test(cleaned)) cleaned = "+91" + cleaned;
  else if (/^91\d{10}$/.test(cleaned)) cleaned = "+" + cleaned;
  else if (/^\d{11,15}$/.test(cleaned) && !cleaned.startsWith("+")) cleaned = "+" + cleaned;
  return cleaned;
}

function isValidIndiaPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return /^(\+91)?[6-9]\d{9}$/.test(cleaned);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---------------------------------------------------------------------------
// Merchant console actions
// ---------------------------------------------------------------------------
async function getIntegration(req: Request, data: Record<string, unknown>) {
  const { merchantId } = data;
  if (!merchantId || typeof merchantId !== "string") return json({ error: "MERCHANT_REQUIRED" }, 400);
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;

  const { data: integration, error } = await supabase
    .from("checkout_integrations")
    .select("*")
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (error) return json({ error: "INTEGRATION_LOOKUP_FAILED" }, 500);

  if (!integration) {
    // Auto-create on first visit (kept in sync with DB trigger).
    const { data: created, error: cErr } = await supabase
      .from("checkout_integrations")
      .insert({ merchant_id: merchantId })
      .select()
      .single();
    if (cErr || !created) return json({ error: "INTEGRATION_CREATE_FAILED" }, 500);
    return json({ integration: created, isNew: true });
  }

  return json({ integration, isNew: false });
}

async function updateIntegration(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId, name, status } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string") {
    return json({ error: "MERCHANT_AND_INTEGRATION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  if (status !== undefined && !["active", "disabled"].includes(status as string)) {
    return json({ error: "INVALID_STATUS" }, 400);
  }

  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = String(name).trim().slice(0, 100);
  if (status !== undefined) patch.status = status;

  const { data: updated, error } = await supabase
    .from("checkout_integrations")
    .update(patch)
    .eq("id", integrationId)
    .select()
    .single();
  if (error) return json({ error: "UPDATE_FAILED", detail: error.message }, 500);

  await supabase.from("integration_audit_logs").insert({
    integration_id: integrationId,
    actor_user_id: auth.userId,
    action: "integration.updated",
    metadata: patch,
  });

  return json(updated);
}

async function requestLive(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string") {
    return json({ error: "MERCHANT_AND_INTEGRATION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const { data: updated, error } = await supabase
    .from("checkout_integrations")
    .update({ live_requested: true })
    .eq("id", integrationId)
    .select()
    .single();
  if (error) return json({ error: "UPDATE_FAILED", detail: error.message }, 500);

  await supabase.from("integration_audit_logs").insert({
    integration_id: integrationId,
    actor_user_id: auth.userId,
    action: "integration.live_requested",
  });

  return json(updated);
}

async function listApiKeys(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string") {
    return json({ error: "MERCHANT_AND_INTEGRATION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const { data: keys, error } = await supabase
    .from("api_keys")
    .select("id, name, key_type, environment, key_prefix, last_four, fingerprint, scopes, status, last_used_at, created_at, revoked_at")
    .eq("integration_id", integrationId)
    .order("created_at", { ascending: false });
  if (error) return json({ error: "KEYS_LOOKUP_FAILED" }, 500);

  return json(keys ?? []);
}

async function createApiKey(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId, name, keyType, environment, scopes } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string") {
    return json({ error: "MERCHANT_AND_INTEGRATION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  if (!["publishable", "secret"].includes(keyType as string)) return json({ error: "INVALID_KEY_TYPE" }, 400);
  if (!["test", "live"].includes(environment as string)) return json({ error: "INVALID_ENVIRONMENT" }, 400);
  if (environment === "live" && !integration.live_enabled) {
    return json({ error: "LIVE_NOT_ENABLED" }, 403);
  }
  if (integration.status !== "active") return json({ error: "INTEGRATION_DISABLED" }, 403);

  const defaultScopes =
    keyType === "secret"
      ? ["checkout_session:create", "checkout_session:read", "payment:read", "refund:create"]
      : ["checkout_session:read"];

  const result = await createApiKeyRecord({
    integrationId,
    name: (name as string)?.trim().slice(0, 60) || (keyType === "secret" ? "Secret key" : "Publishable key"),
    keyType: keyType as "publishable" | "secret",
    environment: environment as "test" | "live",
    scopes: Array.isArray(scopes) ? scopes : defaultScopes,
  });
  if (result.error || !result.data || !result.raw) {
    return json({ error: "KEY_CREATE_FAILED", detail: result.error?.message }, 500);
  }

  await supabase.from("integration_audit_logs").insert({
    integration_id: integrationId,
    actor_user_id: auth.userId,
    action: "api_key.created",
    metadata: { key_type: keyType, environment, name: result.data.name },
  });

  // Return the full key exactly once.
  return json({ ...result.data, raw: result.raw, secret: keyType === "secret" ? result.raw : undefined, display_secret: keyType === "secret" ? `${result.raw.slice(0, 12)}...${result.raw.slice(-4)}` : undefined });
}

async function revokeApiKey(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId, keyId } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string" || !keyId) {
    return json({ error: "MERCHANT_AND_KEY_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const { data: key, error } = await supabase
    .from("api_keys")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("integration_id", integrationId)
    .eq("status", "active")
    .select()
    .single();
  if (error || !key) return json({ error: "KEY_NOT_FOUND_OR_REVOKED" }, 404);

  await supabase.from("integration_audit_logs").insert({
    integration_id: integrationId,
    actor_user_id: auth.userId,
    action: "api_key.revoked",
    entity: "api_key",
    entity_id: keyId,
  });

  return json(key);
}

async function rotateApiKey(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId, keyId } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string" || !keyId) {
    return json({ error: "MERCHANT_AND_KEY_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const { data: existing } = await supabase
    .from("api_keys")
    .select("name, key_type, environment, scopes")
    .eq("id", keyId)
    .eq("integration_id", integrationId)
    .maybeSingle();
  if (!existing) return json({ error: "KEY_NOT_FOUND" }, 404);

  await supabase
    .from("api_keys")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", keyId);

  const result = await createApiKeyRecord({
    integrationId,
    name: existing.name,
    keyType: existing.key_type,
    environment: existing.environment,
    scopes: Array.isArray(existing.scopes) ? existing.scopes : [],
  });
  if (result.error || !result.data || !result.raw) {
    return json({ error: "KEY_ROTATE_FAILED" }, 500);
  }

  await supabase.from("integration_audit_logs").insert({
    integration_id: integrationId,
    actor_user_id: auth.userId,
    action: "api_key.rotated",
    entity: "api_key",
    entity_id: keyId,
  });

  return json({ ...result.data, raw: result.raw, secret: existing.key_type === "secret" ? result.raw : undefined, display_secret: existing.key_type === "secret" ? `${result.raw.slice(0, 12)}...${result.raw.slice(-4)}` : undefined });
}

// ---------------------------------------------------------------------------
// Webhook endpoints + events (merchant console)
// ---------------------------------------------------------------------------
async function listWebhookEndpoints(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string") {
    return json({ error: "MERCHANT_AND_INTEGRATION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const { data: endpoints, error } = await supabase
    .from("webhook_endpoints")
    .select("id, public_webhook_id, url, events, status, last_delivered_at, last_success_at, last_failure_at, created_at")
    .eq("integration_id", integrationId)
    .order("created_at", { ascending: false });
  if (error) return json({ error: "ENDPOINTS_LOOKUP_FAILED" }, 500);

  return json(endpoints ?? []);
}

async function createWebhookEndpoint(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId, url, events } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string") {
    return json({ error: "MERCHANT_AND_INTEGRATION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  if (!url || typeof url !== "string") return json({ error: "URL_REQUIRED" }, 400);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return json({ error: "URL_INVALID" }, 400);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return json({ error: "URL_PROTOCOL_INVALID" }, 400);

  const eventList = Array.isArray(events) && events.length > 0 ? events : [
    "checkout.created", "checkout.expired", "checkout.completed",
    "payment.succeeded", "payment.failed", "order.created",
  ];

  const secret = "whsec_" + randomHex(24);

  const { data: endpoint, error } = await supabase
    .from("webhook_endpoints")
    .insert({ integration_id: integrationId, url: url.trim(), secret, events: eventList, status: "active" })
    .select()
    .single();
  if (error || !endpoint) return json({ error: "ENDPOINT_CREATE_FAILED", detail: error?.message }, 500);

  await supabase.from("integration_audit_logs").insert({
    integration_id: integrationId,
    actor_user_id: auth.userId,
    action: "webhook_endpoint.created",
    entity: "webhook_endpoint",
    entity_id: endpoint.id,
    metadata: { url: url.trim(), events: eventList },
  });

  return json({ ...endpoint, secret, display_secret: `${secret.slice(0, 12)}...${secret.slice(-4)}` });
}

async function updateWebhookEndpoint(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId, endpointId, url, events, status } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string" || !endpointId) {
    return json({ error: "MERCHANT_AND_ENDPOINT_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  if (url !== undefined && typeof url === "string") {
    try {
      new URL(url);
    } catch {
      return json({ error: "URL_INVALID" }, 400);
    }
  }
  if (status !== undefined && !["active", "disabled"].includes(status as string)) {
    return json({ error: "INVALID_STATUS" }, 400);
  }
  if (events !== undefined && !Array.isArray(events)) return json({ error: "INVALID_EVENTS" }, 400);

  const patch: Record<string, unknown> = {};
  if (url !== undefined) patch.url = String(url).trim();
  if (events !== undefined) patch.events = events;
  if (status !== undefined) patch.status = status;

  const { data: endpoint, error } = await supabase
    .from("webhook_endpoints")
    .update(patch)
    .eq("id", endpointId)
    .eq("integration_id", integrationId)
    .select()
    .single();
  if (error || !endpoint) return json({ error: "ENDPOINT_NOT_FOUND" }, 404);

  await supabase.from("integration_audit_logs").insert({
    integration_id: integrationId,
    actor_user_id: auth.userId,
    action: "webhook_endpoint.updated",
    entity: "webhook_endpoint",
    entity_id: endpointId,
    metadata: patch,
  });

  return json(endpoint);
}

async function deleteWebhookEndpoint(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId, endpointId } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string" || !endpointId) {
    return json({ error: "MERCHANT_AND_ENDPOINT_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const { error } = await supabase
    .from("webhook_endpoints")
    .delete()
    .eq("id", endpointId)
    .eq("integration_id", integrationId);
  if (error) return json({ error: "ENDPOINT_DELETE_FAILED" }, 500);

  await supabase.from("integration_audit_logs").insert({
    integration_id: integrationId,
    actor_user_id: auth.userId,
    action: "webhook_endpoint.deleted",
    entity: "webhook_endpoint",
    entity_id: endpointId,
  });

  return json({ deleted: true });
}

// Test endpoint: create a webhook.test event and deliver immediately.
async function testWebhookEndpoint(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId, endpointId } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string" || !endpointId) {
    return json({ error: "MERCHANT_AND_ENDPOINT_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const { data: endpoint } = await supabase
    .from("webhook_endpoints")
    .select("id, events, status")
    .eq("id", endpointId)
    .eq("integration_id", integrationId)
    .maybeSingle();
  if (!endpoint) return json({ error: "ENDPOINT_NOT_FOUND" }, 404);

  const { data: event, error } = await supabase
    .from("webhook_events")
    .insert({
      event_id: "evt_" + randomHex(10),
      integration_id: integrationId,
      event_type: "webhook.test",
      payload: { message: "Test event from SafePay" },
    })
    .select()
    .single();
  if (error || !event) return json({ error: "EVENT_CREATE_FAILED" }, 500);

  const { data: delivery } = await supabase
    .from("webhook_deliveries")
    .insert({ event_id: event.id, endpoint_id: endpoint.id, status: "pending", next_retry_at: new Date().toISOString() })
    .select()
    .single();
  if (!delivery) return json({ error: "DELIVERY_CREATE_FAILED" }, 500);

  const result = await deliverWebhook(delivery.id);

  await supabase.from("integration_audit_logs").insert({
    integration_id: integrationId,
    actor_user_id: auth.userId,
    action: "webhook_endpoint.tested",
    entity: "webhook_endpoint",
    entity_id: endpointId,
  });

  return json({ delivered: result.status === "delivered", status: result.status, http_status: result.httpStatus, response_time_ms: result.responseTime });
}

async function listWebhookEvents(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId, page = 0, pageSize = 25 } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string") {
    return json({ error: "MERCHANT_AND_INTEGRATION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const limit = Math.min(100, Number(pageSize) || 25);
  const offset = Math.max(0, Number(page) || 0) * limit;

  const { count } = await supabase
    .from("webhook_events")
    .select("*", { count: "exact", head: true })
    .eq("integration_id", integrationId);

  const { data: events, error } = await supabase
    .from("webhook_events")
    .select("id, event_id, event_type, payload, created_at, webhook_deliveries(id, status, attempt_count, http_status, response_time_ms, last_attempt_at)")
    .eq("integration_id", integrationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return json({ error: "EVENTS_LOOKUP_FAILED" }, 500);

  return json({ events: events ?? [], total: count ?? 0 });
}

async function listWebhookDeliveries(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId, page = 0, pageSize = 25, status, eventId } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string") {
    return json({ error: "MERCHANT_AND_INTEGRATION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const limit = Math.min(100, Number(pageSize) || 25);
  const offset = Math.max(0, Number(page) || 0) * limit;

  let query = supabase
    .from("webhook_deliveries")
    .select("*, webhook_events(event_id, event_type, created_at), webhook_endpoints(url, public_webhook_id)", { count: "exact" })
    .eq("webhook_endpoints.integration_id", integrationId);

  if (status) query = query.eq("status", status);
  if (eventId) query = query.eq("event_id", eventId);

  const { data: deliveriesData, error, count } = await query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) return json({ error: "DELIVERIES_LOOKUP_FAILED", detail: error.message }, 500);

  return json({ deliveries: deliveriesData ?? [], total: count ?? 0 });
}

async function replayWebhook(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId, eventId } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string" || !eventId) {
    return json({ error: "MERCHANT_AND_EVENT_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const { data: event } = await supabase
    .from("webhook_events")
    .select("id, integration_id, webhook_deliveries(id)")
    .eq("event_id", eventId)
    .eq("integration_id", integrationId)
    .maybeSingle();
  if (!event) return json({ error: "EVENT_NOT_FOUND" }, 404);

  // Reset all deliveries for this event to pending.
  const deliveryIds = (event.webhook_deliveries ?? []).map((d: { id: string }) => d.id);
  if (deliveryIds.length === 0) {
    // No endpoint matched originally; re-enqueue against current endpoints.
    const { data: endpoints } = await supabase
      .from("webhook_endpoints")
      .select("id, events")
      .eq("integration_id", integrationId)
      .eq("status", "active");
    for (const ep of endpoints ?? []) {
      const { data: inserted } = await supabase
        .from("webhook_deliveries")
        .insert({
          event_id: event.id, endpoint_id: ep.id, status: "pending", next_retry_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (inserted) deliveryIds.push(inserted.id);
    }
  } else {
    await supabase
      .from("webhook_deliveries")
      .update({ status: "pending", next_retry_at: new Date().toISOString(), attempt_count: 0 })
      .in("id", deliveryIds);
  }

  await supabase.from("integration_audit_logs").insert({
    integration_id: integrationId,
    actor_user_id: auth.userId,
    action: "webhook.replayed",
    entity: "webhook_event",
    entity_id: eventId,
  });

  return json({ replayed: true, delivery_count: deliveryIds.length });
}

async function processPendingWebhooks(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string") {
    return json({ error: "MERCHANT_AND_INTEGRATION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const delivered = await processWebhookDeliveries(integrationId, 10);
  return json({ processed: true, delivered });
}

// ---------------------------------------------------------------------------
// API request log + sessions (merchant console)
// ---------------------------------------------------------------------------
async function listApiRequests(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId, page = 0, pageSize = 25 } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string") {
    return json({ error: "MERCHANT_AND_INTEGRATION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const limit = Math.min(100, Number(pageSize) || 25);
  const offset = Math.max(0, Number(page) || 0) * limit;

  const { count } = await supabase
    .from("api_request_logs")
    .select("*", { count: "exact", head: true })
    .eq("integration_id", integrationId);

  const { data: logsData, error } = await supabase
    .from("api_request_logs")
    .select("request_id, method, endpoint, status_code, latency_ms, environment, error_code, created_at")
    .eq("integration_id", integrationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return json({ error: "LOGS_LOOKUP_FAILED" }, 500);

  return json({ logs: logsData ?? [], total: count ?? 0 });
}

async function listSessions(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId, page = 0, pageSize = 25, status } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string") {
    return json({ error: "MERCHANT_AND_INTEGRATION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const limit = Math.min(100, Number(pageSize) || 25);
  const offset = Math.max(0, Number(page) || 0) * limit;

  const { data: sessionsData, error } = await supabase.rpc("list_integration_sessions", {
    p_integration_id: integrationId,
    p_limit: limit,
    p_offset: offset,
    p_status: status && status !== "all" ? status : null,
  });
  if (error) return json({ error: "SESSIONS_LOOKUP_FAILED", detail: error.message }, 500);
  return json(sessionsData);
}

async function getSession(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId, sessionId } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string" || !sessionId) {
    return json({ error: "MERCHANT_AND_SESSION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const { data: sessionDetail, error } = await supabase.rpc("get_integration_session", {
    p_integration_id: integrationId,
    p_session_id: sessionId,
  });
  if (error) return json({ error: error.message || "SESSION_LOOKUP_FAILED" }, 404);
  return json(sessionDetail);
}

async function cancelSession(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId, sessionId } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string" || !sessionId) {
    return json({ error: "MERCHANT_AND_SESSION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const { data: cancelled, error } = await supabase.rpc("cancel_checkout_session", {
    p_session_id: sessionId,
    p_merchant_id: merchantId,
  });
  if (error) return json({ error: error.message || "CANCEL_FAILED" }, 400);

  await supabase.from("integration_audit_logs").insert({
    integration_id: integrationId,
    actor_user_id: auth.userId,
    action: "session.cancelled",
    entity: "checkout_session",
    entity_id: sessionId,
  });

  return json({ cancelled: true, session: cancelled });
}

async function integrationHealth(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string") {
    return json({ error: "MERCHANT_AND_INTEGRATION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const { data: health, error } = await supabase.rpc("integration_health", { p_integration_id: integrationId });
  if (error) return json({ error: "HEALTH_FAILED", detail: error.message }, 500);
  return json(health);
}

// Integration test workflow — creates a real test session via the API path.
async function startTestRun(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string") {
    return json({ error: "MERCHANT_AND_INTEGRATION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const { data: secretKey } = await supabase
    .from("api_keys")
    .select("id, key_hash, environment")
    .eq("integration_id", integrationId)
    .eq("key_type", "secret")
    .eq("environment", "test")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!secretKey) {
    return json({ error: "NO_TEST_SECRET_KEY" }, 400);
  }

  const { data: run, error: runErr } = await supabase
    .from("integration_test_runs")
    .insert({
      integration_id: integrationId,
      status: "running",
      steps: [
        { name: "api_connection", status: "running" },
        { name: "session_creation", status: "pending" },
        { name: "checkout_open", status: "pending" },
        { name: "payment", status: "pending" },
        { name: "webhook", status: "pending" },
      ],
    })
    .select()
    .single();
  if (runErr || !run) return json({ error: "TEST_RUN_CREATE_FAILED" }, 500);

  const merchantOrderRef = `test-${run.id.slice(0, 8)}`;
  const { data: created, error: createErr } = await supabase.rpc("create_integration_checkout_session", {
    p_integration_id: integrationId,
    p_merchant_id: merchantId,
    p_environment: "test",
    p_merchant_order_id: merchantOrderRef,
    p_items: [{ item_name: "Integration Test", unit_price: 1, quantity: 1, sku: "TEST-1" }],
    p_shipping_amount: 0,
    p_discount_amount: 0,
    p_tax_amount: 0,
  });
  if (createErr) {
    await supabase.from("integration_test_runs").update({ status: "failed", steps: [{ name: "session_creation", status: "failed", detail: createErr.message }], finished_at: new Date().toISOString() }).eq("id", run.id);
    return json({ error: createErr.message || "SESSION_CREATE_FAILED" }, 400);
  }

  const token = created?.token;
  const checkoutUrl = `${getCheckoutOrigin()}/integration-checkout/${token}`;

  await supabase.from("integration_test_runs").update({
    steps: [
      { name: "api_connection", status: "passed", detail: "API key valid" },
      { name: "session_creation", status: "passed", detail: created?.public_checkout_id ?? created?.id },
      { name: "checkout_open", status: "pending", detail: checkoutUrl },
      { name: "payment", status: "pending" },
      { name: "webhook", status: "pending" },
    ],
  }).eq("id", run.id);

  return json({
    run,
    merchant_order_ref: merchantOrderRef,
    session: created,
    checkout_url: checkoutUrl,
    token,
  });
}

async function listTestRuns(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string") {
    return json({ error: "MERCHANT_AND_INTEGRATION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  const { data: testRuns, error } = await supabase
    .from("integration_test_runs")
    .select("id, status, steps, started_at, finished_at")
    .eq("integration_id", integrationId)
    .order("started_at", { ascending: false })
    .limit(10);
  if (error) return json({ error: "TEST_RUNS_LOOKUP_FAILED" }, 500);
  return json(testRuns ?? []);
}

// Update test run steps based on real data (used by public payment flow).
async function updateTestRunSteps(testRunId: string, incoming: Record<string, unknown>[]) {
  const { data: run } = await supabase
    .from("integration_test_runs")
    .select("steps")
    .eq("id", testRunId)
    .maybeSingle();
  if (!run) return;
  const steps = Array.isArray(run.steps) ? run.steps : [];
  const updated = steps.map((st: Record<string, unknown>) => {
    const inc = incoming.find((i) => i.name === st.name);
    return inc ? { ...st, ...inc } : st;
  });
  await supabase.from("integration_test_runs").update({ steps: updated }).eq("id", testRunId);
}

// Test runs are keyed by merchant_order_id like `test-<runId8>`. Mark a step
// passed as the real flow reaches it.
async function updateTestRunFromMerchantOrder(integrationId: unknown, merchantOrderId: unknown, stepName: string, detail: string) {
  if (typeof merchantOrderId !== "string" || !merchantOrderId.startsWith("test-")) return;
  const prefix = merchantOrderId.slice("test-".length);
  if (!prefix) return;
  const { data: runs } = await supabase
    .from("integration_test_runs")
    .select("id, steps, status")
    .eq("integration_id", integrationId)
    .order("started_at", { ascending: false })
    .limit(20);
  const run = (runs ?? []).find((r) => r.id.startsWith(prefix));
  if (!run || run.status !== "running") return;
  const steps = Array.isArray(run.steps) ? run.steps : [];
  const updated = steps.map((st: Record<string, unknown>) =>
    st.name === stepName ? { ...st, status: "passed", detail } : st,
  );
  const allPassed = updated.every((st: Record<string, unknown>) => st.status === "passed");
  await supabase
    .from("integration_test_runs")
    .update({ steps: updated, status: allPassed ? "passed" : "running", finished_at: allPassed ? new Date().toISOString() : null })
    .eq("id", run.id);
}

// ---------------------------------------------------------------------------
// Overview bundle for the merchant dashboard
// ---------------------------------------------------------------------------
async function overview(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string") {
    return json({ error: "MERCHANT_AND_INTEGRATION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  const integration = await resolveIntegration(integrationId, merchantId);
  if (!integration) return json({ error: "INTEGRATION_NOT_FOUND" }, 404);

  await processWebhookDeliveries(integrationId, 10);

  const [{ data: health }, { data: keys }, { data: endpoints }, { data: recentRequests }, { data: recentDeliveries }, { data: recentSessions }, { data: incidents }] = await Promise.all([
    supabase.rpc("integration_health", { p_integration_id: integrationId }),
    supabase.from("api_keys").select("id, name, key_type, environment, key_prefix, last_four, fingerprint, status, last_used_at, created_at").eq("integration_id", integrationId).order("created_at", { ascending: false }).limit(10),
    supabase.from("webhook_endpoints").select("id, public_webhook_id, url, events, status, last_success_at, last_failure_at, created_at").eq("integration_id", integrationId).order("created_at", { ascending: false }).limit(10),
    supabase.from("api_request_logs").select("request_id, method, endpoint, status_code, latency_ms, environment, error_code, created_at").eq("integration_id", integrationId).order("created_at", { ascending: false }).limit(10),
    supabase.from("webhook_deliveries").select("id, status, attempt_count, http_status, response_time_ms, last_attempt_at, webhook_events(event_id, event_type), webhook_endpoints(url)").eq("webhook_endpoints.integration_id", integrationId).order("created_at", { ascending: false }).limit(10),
    supabase.from("checkout_sessions").select("id, public_checkout_id, merchant_order_id, environment, status, final_amount, currency, guest_name, created_at, completed_at, expires_at").eq("integration_id", integrationId).order("created_at", { ascending: false }).limit(10),
    supabase.from("integration_incidents").select("*").eq("integration_id", integrationId).eq("resolved", false).order("created_at", { ascending: false }).limit(10),
  ]);

  return json({
    integration,
    health,
    keys: keys ?? [],
    endpoints: endpoints ?? [],
    recent_requests: recentRequests ?? [],
    recent_deliveries: recentDeliveries ?? [],
    recent_sessions: recentSessions ?? [],
    incidents: incidents ?? [],
  });
}

// ---------------------------------------------------------------------------
// External API actions (API-key authenticated)
// ---------------------------------------------------------------------------
async function apiCreateSession(req: Request, data: Record<string, unknown>) {
  const started = Date.now();
  const requestId = makeRequestId();
  const auth = await authorizeApiKey(req);
  if ("error" in auth) return auth.error;

  const { keyRow, integration, merchant } = auth;
  const environment = keyRow.environment;

  if (keyRow.key_type !== "secret") return json({ error: "SECRET_KEY_REQUIRED", request_id: requestId }, 403);
  if (keyRow.scopes && !keyRow.scopes.includes("checkout_session:create")) {
    return json({ error: "SCOPE_FORBIDDEN", request_id: requestId }, 403);
  }

  // Rate limit: session creation is sensitive.
  if (await rateLimit(keyRow.id, 60_000, 60)) {
    await logRequest({ requestId, integrationId: integration.id, apiKeyId: keyRow.id, method: "POST", endpoint: "/v1/checkout/sessions", statusCode: 429, startedAt: started, environment, errorCode: "RATE_LIMITED" });
    return json({ error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down.", request_id: requestId } }, 429);
  }

  const idempotencyKey = req.headers.get("idempotency-key") ?? null;
  const bodyHash = await sha256Hex(JSON.stringify(data ?? {}));

  // Idempotency: replay returns the existing resource.
  if (idempotencyKey) {
    const { data: existingIdem } = await supabase
      .from("idempotency_keys")
      .select("resource_id")
      .eq("integration_id", integration.id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existingIdem?.resource_id) {
      const { data: existingSession } = await supabase
        .from("checkout_sessions")
        .select("id, public_checkout_id, token, environment, status, final_amount, currency, expires_at, merchant_order_id")
        .eq("id", existingIdem.resource_id)
        .maybeSingle();
      if (existingSession) {
        await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);
        await logRequest({ requestId, integrationId: integration.id, apiKeyId: keyRow.id, method: "POST", endpoint: "/v1/checkout/sessions", statusCode: 200, startedAt: started, environment });
        return json({
          id: existingSession.id,
          public_checkout_id: existingSession.public_checkout_id,
          merchant_order_id: existingSession.merchant_order_id,
          environment: existingSession.environment,
          status: existingSession.status,
          final_amount: existingSession.final_amount,
          currency: existingSession.currency,
          expires_at: existingSession.expires_at,
          checkout_url: `${getCheckoutOrigin()}/integration-checkout/${existingSession.token}`,
          idempotent_replay: true,
          request_id: requestId,
        });
      }
    }
  }

  const merchantOrderId = data.merchant_order_id as string | undefined;
  if (!merchantOrderId || typeof merchantOrderId !== "string" || merchantOrderId.trim().length === 0) {
    await logRequest({ requestId, integrationId: integration.id, apiKeyId: keyRow.id, method: "POST", endpoint: "/v1/checkout/sessions", statusCode: 400, startedAt: started, environment, errorCode: "MERCHANT_ORDER_REQUIRED" });
    return json({ error: { code: "MERCHANT_ORDER_REQUIRED", message: "merchant_order_id is required and must be a non-empty string.", request_id: requestId } }, 400);
  }

  const { data: result, error } = await supabase.rpc("create_integration_checkout_session", {
    p_integration_id: integration.id,
    p_merchant_id: integration.merchant_id,
    p_environment: environment,
    p_merchant_order_id: merchantOrderId.trim(),
    p_items: data.items,
    p_shipping_amount: Number(data.shipping_amount) || 0,
    p_discount_amount: Number(data.discount_amount) || 0,
    p_tax_amount: Number(data.tax_amount) || 0,
    p_requires_shipping: !!data.requires_shipping,
    p_collect_email: !!data.collect_email,
    p_expiry_hours: data.expiry_hours ? Number(data.expiry_hours) : null,
    p_metadata: data.metadata ?? null,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    await logRequest({ requestId, integrationId: integration.id, apiKeyId: keyRow.id, method: "POST", endpoint: "/v1/checkout/sessions", statusCode: 400, startedAt: started, environment, errorCode: error.message.split(":")[0] });
    return json({ error: { code: error.message.split(":")[0] || "SESSION_CREATE_FAILED", message: error.message, request_id: requestId } }, 400);
  }

  // Record idempotency key → resource for safe replays.
  if (idempotencyKey) {
    await supabase.from("idempotency_keys").insert({
      integration_id: integration.id,
      idempotency_key: idempotencyKey,
      request_type: "create_checkout_session",
      request_hash: bodyHash,
      resource_type: "checkout_session",
      resource_id: result.id,
    }).then((r) => {
      if (r.error?.code === "23505") {
        // concurrent duplicate — someone else won; treat as success anyway
      }
    });
  }

  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);
  await logRequest({ requestId, integrationId: integration.id, apiKeyId: keyRow.id, method: "POST", endpoint: "/v1/checkout/sessions", statusCode: 200, startedAt: started, environment });

  const token = result.token;
  return json({
    id: result.id,
    public_checkout_id: result.public_checkout_id,
    merchant_order_id: result.merchant_order_id,
    environment: result.environment,
    status: result.already_exists ? "existing" : "created",
    final_amount: result.final_amount,
    currency: result.currency,
    expires_at: result.expires_at,
    checkout_url: `${getCheckoutOrigin()}/integration-checkout/${token}`,
    request_id: requestId,
  });
}

function getCheckoutOrigin(): string {
  return Deno.env.get("SITE_URL") || "https://jcxhagmfbezpgrxdxfvs.supabase.co";
}

async function apiGetSession(req: Request, data: Record<string, unknown>) {
  const started = Date.now();
  const requestId = makeRequestId();
  const auth = await authorizeApiKey(req);
  if ("error" in auth) return auth.error;

  const { keyRow, integration } = auth;
  const environment = keyRow.environment;

  const sessionId = data.session_id as string | undefined;
  if (!sessionId) return json({ error: { code: "SESSION_ID_REQUIRED", request_id: requestId } }, 400);

  const isPublishable = keyRow.key_type !== "secret";
  if (isPublishable) {
    // Publishable keys are client-side safe and limited to reading session
    // status + the checkout_url. State changes stay secret-only.
    if (!Array.isArray(keyRow.scopes) || !keyRow.scopes.includes("checkout_session:read")) {
      await logRequest({ requestId, integrationId: integration.id, apiKeyId: keyRow.id, method: "GET", endpoint: "/v1/checkout/sessions/:id", statusCode: 403, startedAt: started, environment, errorCode: "SCOPE_FORBIDDEN" });
      return json({ error: { code: "SCOPE_FORBIDDEN", message: "This key cannot read checkout sessions.", request_id: requestId } }, 403);
    }
    if (await rateLimit(keyRow.id, 60_000, 300)) {
      await logRequest({ requestId, integrationId: integration.id, apiKeyId: keyRow.id, method: "GET", endpoint: "/v1/checkout/sessions/:id", statusCode: 429, startedAt: started, environment, errorCode: "RATE_LIMITED" });
      return json({ error: { code: "RATE_LIMITED", message: "Too many requests.", request_id: requestId } }, 429);
    }
    const { data: sess } = await supabase
      .from("checkout_sessions")
      .select("id, public_checkout_id, token, status, environment, currency, final_amount, merchant_order_id, expires_at")
      .eq("id", sessionId)
      .eq("integration_id", integration.id)
      .maybeSingle();
    if (!sess) {
      await logRequest({ requestId, integrationId: integration.id, apiKeyId: keyRow.id, method: "GET", endpoint: "/v1/checkout/sessions/:id", statusCode: 404, startedAt: started, environment, errorCode: "SESSION_NOT_FOUND" });
      return json({ error: { code: "SESSION_NOT_FOUND", message: "No checkout session found for the given id.", request_id: requestId } }, 404);
    }
    await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);
    await logRequest({ requestId, integrationId: integration.id, apiKeyId: keyRow.id, method: "GET", endpoint: "/v1/checkout/sessions/:id", statusCode: 200, startedAt: started, environment });
    return json({
      id: sess.id,
      public_checkout_id: sess.public_checkout_id,
      merchant_order_id: sess.merchant_order_id,
      status: sess.status,
      environment: sess.environment,
      currency: sess.currency,
      final_amount: sess.final_amount,
      expires_at: sess.expires_at,
      checkout_url: `${getCheckoutOrigin()}/integration-checkout/${sess.token}`,
      request_id: requestId,
    });
  }

  if (keyRow.key_type !== "secret") return json({ error: { code: "SECRET_KEY_REQUIRED", request_id: requestId } }, 403);

  if (await rateLimit(keyRow.id, 60_000, 300)) {
    await logRequest({ requestId, integrationId: integration.id, apiKeyId: keyRow.id, method: "GET", endpoint: "/v1/checkout/sessions/:id", statusCode: 429, startedAt: started, environment, errorCode: "RATE_LIMITED" });
    return json({ error: { code: "RATE_LIMITED", message: "Too many requests.", request_id: requestId } }, 429);
  }

  const { data: session, error } = await supabase.rpc("get_integration_session", {
    p_integration_id: integration.id,
    p_session_id: sessionId,
  });
  if (error) {
    await logRequest({ requestId, integrationId: integration.id, apiKeyId: keyRow.id, method: "GET", endpoint: "/v1/checkout/sessions/:id", statusCode: 404, startedAt: started, environment, errorCode: "SESSION_NOT_FOUND" });
    return json({ error: { code: "SESSION_NOT_FOUND", message: "No checkout session found for the given id.", request_id: requestId } }, 404);
  }

  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);
  await logRequest({ requestId, integrationId: integration.id, apiKeyId: keyRow.id, method: "GET", endpoint: "/v1/checkout/sessions/:id", statusCode: 200, startedAt: started, environment });

  const { data: tokRow } = await supabase
    .from("checkout_sessions")
    .select("token")
    .eq("id", sessionId)
    .maybeSingle();

  return json({
    ...session,
    checkout_url: tokRow?.token ? `${getCheckoutOrigin()}/integration-checkout/${tokRow.token}` : undefined,
    request_id: requestId,
  });
}

async function apiCancelSession(req: Request, data: Record<string, unknown>) {
  const started = Date.now();
  const requestId = makeRequestId();
  const auth = await authorizeApiKey(req);
  if ("error" in auth) return auth.error;

  const { keyRow, integration } = auth;
  const environment = keyRow.environment;
  if (keyRow.key_type !== "secret") return json({ error: { code: "SECRET_KEY_REQUIRED", request_id: requestId } }, 403);

  const sessionId = data.session_id as string | undefined;
  if (!sessionId) {
    return json({ error: { code: "SESSION_ID_REQUIRED", request_id: requestId } }, 400);
  }

  const { data: cancelledSession, error } = await supabase.rpc("cancel_checkout_session", {
    p_session_id: sessionId,
    p_merchant_id: integration.merchant_id,
  });
  if (error) {
    await logRequest({ requestId, integrationId: integration.id, apiKeyId: keyRow.id, method: "POST", endpoint: "/v1/checkout/sessions/:id/cancel", statusCode: 400, startedAt: started, environment, errorCode: error.message });
    return json({ error: { code: error.message || "CANCEL_FAILED", request_id: requestId } }, 400);
  }

  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);
  await logRequest({ requestId, integrationId: integration.id, apiKeyId: keyRow.id, method: "POST", endpoint: "/v1/checkout/sessions/:id/cancel", statusCode: 200, startedAt: started, environment });

  return json({ ...cancelledSession, request_id: requestId });
}

async function apiGetPayment(req: Request, data: Record<string, unknown>) {
  const started = Date.now();
  const requestId = makeRequestId();
  const auth = await authorizeApiKey(req);
  if ("error" in auth) return auth.error;

  const { keyRow, integration } = auth;
  const environment = keyRow.environment;
  if (keyRow.key_type !== "secret") return json({ error: { code: "SECRET_KEY_REQUIRED", request_id: requestId } }, 403);

  const sessionId = data.session_id as string | undefined;
  if (!sessionId) return json({ error: { code: "SESSION_ID_REQUIRED", request_id: requestId } }, 400);

  const { data: session } = await supabase
    .from("checkout_sessions")
    .select("id, integration_id")
    .eq("id", sessionId)
    .eq("integration_id", integration.id)
    .maybeSingle();
  if (!session) {
    await logRequest({ requestId, integrationId: integration.id, apiKeyId: keyRow.id, method: "GET", endpoint: "/v1/payments", statusCode: 404, startedAt: started, environment, errorCode: "SESSION_NOT_FOUND" });
    return json({ error: { code: "SESSION_NOT_FOUND", request_id: requestId } }, 404);
  }

  const { data: tx } = await supabase
    .from("payment_transactions")
    .select("id, public_payment_id, amount, currency, status, method, gateway, razorpay_payment_id, razorpay_order_id, failure_reason, created_at, updated_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);
  await logRequest({ requestId, integrationId: integration.id, apiKeyId: keyRow.id, method: "GET", endpoint: "/v1/payments", statusCode: 200, startedAt: started, environment });

  return json({ payment: tx ?? null, request_id: requestId });
}

async function apiVerifyKey(req: Request, data: Record<string, unknown>) {
  const started = Date.now();
  const requestId = makeRequestId();
  const auth = await authorizeApiKey(req);
  if ("error" in auth) return auth.error;

  const { keyRow, integration, merchant } = auth;

  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);
  await logRequest({ requestId, integrationId: integration.id, apiKeyId: keyRow.id, method: "GET", endpoint: "/v1/verify-key", statusCode: 200, startedAt: started, environment: keyRow.environment });

  return json({
    valid: true,
    key_type: keyRow.key_type,
    environment: keyRow.environment,
    scopes: Array.isArray(keyRow.scopes) ? keyRow.scopes : [],
    integration: {
      id: integration.id,
      public_integration_id: integration.public_integration_id,
      name: integration.name,
      status: integration.status,
      live_enabled: integration.live_enabled,
    },
    merchant: { id: merchant.id, business_name: merchant.business_name },
    request_id: requestId,
  });
}

// ---------------------------------------------------------------------------
// Public customer checkout actions (session token is the capability)
// ---------------------------------------------------------------------------
async function openSession(data: Record<string, unknown>) {
  const { token } = data;
  if (!token || typeof token !== "string") return json({ error: "TOKEN_REQUIRED" }, 400);
  const { data: result, error } = await supabase.rpc("get_public_checkout_session", { p_token: token });
  if (error) return json({ error: "LOOKUP_FAILED", detail: error.message }, 500);

  const { data: sess } = await supabase
    .from("checkout_sessions")
    .select("integration_id, merchant_order_id")
    .eq("token", token)
    .maybeSingle();
  if (sess?.merchant_order_id) {
    await updateTestRunFromMerchantOrder(sess.integration_id, sess.merchant_order_id, "checkout_open", "Checkout page opened");
  }

  return json(result ?? { not_found: true });
}

async function createPayment(data: Record<string, unknown>) {
  const { token, name, phone, email, shippingAddress, method, customerId } = data;

  if (!token || typeof token !== "string") return json({ error: "TOKEN_REQUIRED" }, 400);
  if (!name || typeof name !== "string" || name.trim().length < 2) return json({ error: "NAME_REQUIRED" }, 400);
  if (!phone || typeof phone !== "string" || !isValidIndiaPhone(phone)) return json({ error: "PHONE_INVALID" }, 400);
  if (!method || typeof method !== "string") return json({ error: "METHOD_REQUIRED" }, 400);

  const normalizedPhone = normalizePhone(phone);

  const { data: session, error: sessionError } = await supabase
    .from("checkout_sessions")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (sessionError) return json({ error: "SESSION_LOOKUP_FAILED" }, 500);
  if (!session) return json({ error: "SESSION_NOT_FOUND" }, 404);

  if (session.status === "active" && new Date(session.expires_at).getTime() < Date.now()) {
    await supabase.from("checkout_sessions").update({ status: "expired" }).eq("id", session.id);
    return json({ error: "SESSION_EXPIRED" }, 410);
  }
  if (session.status === "completed") return json({ error: "ALREADY_COMPLETED" }, 409);
  if (session.status !== "active") return json({ error: "SESSION_NOT_ACTIVE", status: session.status }, 409);

  const isTest = session.environment === "test";

  const { data: cfg, error: cfgError } = await supabase.rpc("get_merchant_checkout_config", {
    p_merchant_id: session.merchant_id,
  });
  if (cfgError || !cfg) return json({ error: "CONFIG_MISSING" }, 500);

  const isGuest = !customerId;
  if (isGuest && !cfg.guest_checkout_enabled) return json({ error: "GUEST_CHECKOUT_DISABLED" }, 403);

  const methodKey =
    method === "upi" ? "payment_upi_enabled"
    : method === "card" ? "payment_cards_enabled"
    : method === "netbanking" ? "payment_netbanking_enabled"
    : method === "wallet" ? "payment_wallets_enabled"
    : null;
  if (!methodKey || !cfg[methodKey]) return json({ error: "METHOD_DISABLED" }, 400);

  if (email && typeof email === "string" && !isValidEmail(email)) return json({ error: "EMAIL_INVALID" }, 400);
  if ((cfg.email_required || session.collect_email) && (!email || !isValidEmail(email))) {
    return json({ error: "EMAIL_REQUIRED" }, 400);
  }
  if (session.requires_shipping) {
    const a = shippingAddress as Record<string, unknown> | undefined;
    if (!a || !a.full_name || !a.line1 || !a.city || !a.state || !/^\d{6}$/.test(String(a.pincode || ""))) {
      return json({ error: "SHIPPING_REQUIRED" }, 400);
    }
  }

  let custId: string | null = (customerId as string) || session.customer_id || null;
  if (!custId) {
    const { data: existing } = await supabase.from("profiles").select("id").eq("phone", normalizedPhone).maybeSingle();
    if (existing) {
      custId = existing.id;
    } else {
      const cleanEmail = email && typeof email === "string" ? email.trim().toLowerCase() : null;
      const { data: byEmail } = cleanEmail
        ? await supabase.from("profiles").select("id").eq("email", cleanEmail).maybeSingle()
        : { data: null };
      if (byEmail) {
        custId = byEmail.id;
      } else {
        const { data: newProfile } = await supabase
          .from("profiles")
          .insert({
            phone: normalizedPhone,
            password_hash: "guest:" + randomHex(16),
            full_name: name.trim(),
            email: cleanEmail,
            account_source: "integration_checkout",
            account_claimed: false,
          })
          .select("id")
          .single()
          .then((r) => (r.error ? null : r.data));
        if (newProfile) custId = newProfile.id;
        else {
          const { data: raced } = await supabase.from("profiles").select("id").eq("phone", normalizedPhone).maybeSingle();
          custId = raced?.id ?? null;
          if (!custId && cleanEmail) {
            const { data: racedEmail } = await supabase.from("profiles").select("id").eq("email", cleanEmail).maybeSingle();
            custId = racedEmail?.id ?? null;
          }
          if (!custId) return json({ error: "PROFILE_FAILED" }, 500);
        }
      }
    }
  }

  await supabase
    .from("checkout_sessions")
    .update({
      customer_id: custId,
      guest_name: name.trim(),
      guest_phone: normalizedPhone,
      guest_email: email && typeof email === "string" ? email.trim().toLowerCase() : null,
      shipping_address: shippingAddress ?? null,
      selected_payment_method: method,
      current_step: "payment",
    })
    .eq("id", session.id);

  const { data: tx, error: txError } = await supabase
    .from("payment_transactions")
    .insert({
      customer_id: custId,
      customer_name: name.trim(),
      customer_email: email && typeof email === "string" ? email.trim().toLowerCase() : null,
      customer_phone: normalizedPhone,
      session_id: session.id,
      amount: session.final_amount,
      currency: session.currency,
      status: "pending",
      gateway: "razorpay",
      method,
    })
    .select()
    .single();
  if (txError || !tx) return json({ error: "TRANSACTION_CREATE_FAILED", detail: txError?.message }, 500);

  await supabase.from("payment_attempts").insert({
    session_id: session.id,
    payment_transaction_id: tx.id,
    method,
    status: "initiated",
  });

  // Test environment: test handshake only — never touches the gateway, never moves money.
  if (isTest) {
    return json({ mode: "test", transactionId: tx.id, finalAmount: session.final_amount, currency: session.currency, environment: "test" });
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    await supabase.from("payment_attempts").update({ status: "failed", failure_reason: "provider_not_configured" }).eq("payment_transaction_id", tx.id);
    return json({ error: "PAYMENT_PROVIDER_NOT_CONFIGURED" }, 503);
  }

  try {
    const razorpayOrder = await createRazorpayOrder(Number(session.final_amount), session.currency, session.public_checkout_id || session.id);
    await supabase.from("payment_transactions").update({ razorpay_order_id: razorpayOrder.id }).eq("id", tx.id);
    return json({
      mode: "razorpay",
      transactionId: tx.id,
      razorpayOrderId: razorpayOrder.id,
      keyId: RAZORPAY_KEY_ID,
      finalAmount: session.final_amount,
      currency: session.currency,
      environment: session.environment,
    });
  } catch (err) {
    await supabase.from("payment_attempts").update({ status: "failed", failure_reason: "gateway_error" }).eq("payment_transaction_id", tx.id);
    return json({ error: "GATEWAY_ERROR", detail: String(err) }, 502);
  }
}

async function verifyPayment(data: Record<string, unknown>) {
  const { token, transactionId, razorpayPaymentId, razorpaySignature, razorpayOrderId, testRunId } = data;
  if (!token || typeof token !== "string") return json({ error: "TOKEN_REQUIRED" }, 400);
  if (!transactionId || typeof transactionId !== "string") return json({ error: "TRANSACTION_REQUIRED" }, 400);

  const { data: session } = await supabase.from("checkout_sessions").select("*").eq("token", token).maybeSingle();
  if (!session) return json({ error: "SESSION_NOT_FOUND" }, 404);

  const { data: tx } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("id", transactionId)
    .eq("session_id", session.id)
    .maybeSingle();
  if (!tx) return json({ error: "TRANSACTION_NOT_FOUND" }, 404);

  if (tx.status === "success" || session.order_id) {
    const { data: existing, error: rerunError } = await supabase.rpc("finalize_checkout_payment", {
      p_transaction_id: transactionId,
      p_gateway_payment_id: razorpayPaymentId ?? null,
      p_gateway_signature: razorpaySignature ?? null,
    });
    if (rerunError) return json({ error: "FINALIZE_FAILED", detail: rerunError.message }, 500);
    if (testRunId) await updateTestRunSteps(testRunId as string, [{ name: "payment", status: "passed", detail: "Payment verified" }]);
    await processWebhookDeliveries(session.integration_id, 10);
    return json({ success: true, alreadyProcessed: true, order: existing });
  }

  if (tx.status !== "pending") return json({ error: "TRANSACTION_NOT_FINALIZABLE", status: tx.status }, 409);

  let verified = false;
  if (session.environment === "test") {
    verified = true; // test handshake
  } else if (razorpayPaymentId && razorpayOrderId && razorpaySignature) {
    const sigOk = await verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    const apiOk = await verifyRazorpayPaymentViaAPI(razorpayPaymentId);
    verified = sigOk && apiOk;
  }

  if (!verified) {
    await supabase.from("payment_transactions").update({ status: "failed", razorpay_payment_id: razorpayPaymentId ?? null, failure_reason: "Payment verification failed" }).eq("id", transactionId);
    await supabase.from("payment_attempts").update({ status: "failed", failure_reason: "verification_failed" }).eq("payment_transaction_id", transactionId);
    if (testRunId) await updateTestRunSteps(testRunId as string, [{ name: "payment", status: "failed", detail: "Verification failed" }]);
    return json({ verified: false, error: "PAYMENT_VERIFICATION_FAILED" }, 400);
  }

  const { data: result, error: finalizeError } = await supabase.rpc("finalize_checkout_payment", {
    p_transaction_id: transactionId,
    p_gateway_payment_id: razorpayPaymentId ?? null,
    p_gateway_signature: razorpaySignature ?? null,
  });
  if (finalizeError) return json({ error: "FINALIZE_FAILED", detail: finalizeError.message }, 500);

  await supabase.from("payment_attempts").update({ status: "success" }).eq("payment_transaction_id", transactionId);

  if (testRunId) await updateTestRunSteps(testRunId as string, [{ name: "payment", status: "passed", detail: "Payment verified" }]);

  // The DB trigger already enqueued webhook events; deliver them now.
  await processWebhookDeliveries(session.integration_id, 10);

  return json({ success: true, order: result });
}

async function cancelPayment(data: Record<string, unknown>) {
  const { token, transactionId, reason } = data;
  if (!token || typeof token !== "string" || !transactionId || typeof transactionId !== "string") {
    return json({ error: "TOKEN_AND_TRANSACTION_REQUIRED" }, 400);
  }
  const { data: session } = await supabase.from("checkout_sessions").select("*").eq("token", token).maybeSingle();
  if (!session) return json({ error: "SESSION_NOT_FOUND" }, 404);

  const { data: tx } = await supabase.from("payment_transactions").select("*").eq("id", transactionId).eq("session_id", session.id).maybeSingle();
  if (!tx) return json({ error: "TRANSACTION_NOT_FOUND" }, 404);

  if (tx.status === "pending") {
    await supabase.from("payment_transactions").update({ status: "failed", failure_reason: reason || "Payment cancelled" }).eq("id", transactionId).eq("status", "pending");
    await supabase.from("payment_attempts").update({ status: "cancelled" }).eq("payment_transaction_id", transactionId).eq("status", "initiated");
  }
  return json({ success: true });
}

async function getStatus(data: Record<string, unknown>) {
  const { token } = data;
  if (!token || typeof token !== "string") return json({ error: "TOKEN_REQUIRED" }, 400);
  const { data: result, error } = await supabase.rpc("get_public_checkout_session", { p_token: token });
  if (error) return json({ error: "LOOKUP_FAILED", detail: error.message }, 500);
  return json(result ?? { not_found: true });
}

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------
async function adminListIntegrations(req: Request, data: Record<string, unknown>) {
  const { merchantId } = data;
  if (!merchantId || typeof merchantId !== "string") return json({ error: "MERCHANT_REQUIRED" }, 400);
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  if (!(await hasAdminRole(auth.userId))) return json({ error: "ADMIN_REQUIRED" }, 403);

  const { data: integrations, error } = await supabase
    .from("checkout_integrations")
    .select("id, public_integration_id, merchant_id, name, status, live_enabled, live_requested, created_at, updated_at, merchants(business_name)")
    .order("created_at", { ascending: false });
  if (error) return json({ error: "LIST_FAILED" }, 500);
  return json(integrations ?? []);
}

async function adminSetStatus(req: Request, data: Record<string, unknown>) {
  const { merchantId, integrationId, status, liveEnabled } = data;
  if (!merchantId || typeof merchantId !== "string" || !integrationId || typeof integrationId !== "string") {
    return json({ error: "MERCHANT_AND_INTEGRATION_REQUIRED" }, 400);
  }
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  if (!(await hasAdminRole(auth.userId))) return json({ error: "ADMIN_REQUIRED" }, 403);

  const patch: Record<string, unknown> = {};
  if (status !== undefined && ["active", "disabled"].includes(status as string)) patch.status = status;
  if (liveEnabled !== undefined) patch.live_enabled = !!liveEnabled;

  const { data: updated, error } = await supabase
    .from("checkout_integrations")
    .update(patch)
    .eq("id", integrationId)
    .select()
    .single();
  if (error) return json({ error: "UPDATE_FAILED" }, 500);

  await supabase.from("integration_audit_logs").insert({
    integration_id: integrationId,
    actor_user_id: auth.userId,
    actor_role: "admin",
    action: "admin.integration_status_changed",
    metadata: patch,
  });

  return json(updated);
}

async function adminRevokeKey(req: Request, data: Record<string, unknown>) {
  const { merchantId, keyId } = data;
  if (!merchantId || typeof merchantId !== "string" || !keyId) return json({ error: "MERCHANT_AND_KEY_REQUIRED" }, 400);
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  if (!(await hasAdminRole(auth.userId))) return json({ error: "ADMIN_REQUIRED" }, 403);

  const { data: key } = await supabase.from("api_keys").select("integration_id").eq("id", keyId).maybeSingle();
  if (!key) return json({ error: "KEY_NOT_FOUND" }, 404);

  await supabase.from("api_keys").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", keyId);
  await supabase.from("integration_audit_logs").insert({
    integration_id: key.integration_id,
    actor_user_id: auth.userId,
    actor_role: "admin",
    action: "admin.api_key_revoked",
    entity: "api_key",
    entity_id: keyId,
  });
  return json({ revoked: true });
}

async function adminReplayWebhook(req: Request, data: Record<string, unknown>) {
  const { merchantId, eventId } = data;
  if (!merchantId || typeof merchantId !== "string" || !eventId) return json({ error: "MERCHANT_AND_EVENT_REQUIRED" }, 400);
  const auth = await authorizeMerchant(req, merchantId);
  if (auth instanceof Response) return auth;
  if (!(await hasAdminRole(auth.userId))) return json({ error: "ADMIN_REQUIRED" }, 403);

  const { data: event } = await supabase.from("webhook_events").select("id, integration_id").eq("event_id", eventId).maybeSingle();
  if (!event) return json({ error: "EVENT_NOT_FOUND" }, 404);

  const { data: deliveries } = await supabase
    .from("webhook_deliveries")
    .update({ status: "pending", next_retry_at: new Date().toISOString(), attempt_count: 0 })
    .eq("event_id", event.id)
    .select("id");
  for (const d of deliveries ?? []) await deliverWebhook(d.id);

  await supabase.from("integration_audit_logs").insert({
    integration_id: event.integration_id,
    actor_user_id: auth.userId,
    actor_role: "admin",
    action: "admin.webhook_replayed",
    entity: "webhook_event",
    entity_id: eventId,
  });
  return json({ replayed: true });
}

// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, ...data } = body;
    if (!action || typeof action !== "string") return json({ error: "ACTION_REQUIRED" }, 400);

    switch (action) {
      // Merchant console
      case "get-integration": return await getIntegration(req, data);
      case "update-integration": return await updateIntegration(req, data);
      case "request-live": return await requestLive(req, data);
      case "list-api-keys": return await listApiKeys(req, data);
      case "create-api-key": return await createApiKey(req, data);
      case "revoke-api-key": return await revokeApiKey(req, data);
      case "rotate-api-key": return await rotateApiKey(req, data);
      case "list-webhook-endpoints": return await listWebhookEndpoints(req, data);
      case "create-webhook-endpoint": return await createWebhookEndpoint(req, data);
      case "update-webhook-endpoint": return await updateWebhookEndpoint(req, data);
      case "delete-webhook-endpoint": return await deleteWebhookEndpoint(req, data);
      case "test-webhook-endpoint": return await testWebhookEndpoint(req, data);
      case "list-webhook-events": return await listWebhookEvents(req, data);
      case "list-webhook-deliveries": return await listWebhookDeliveries(req, data);
      case "replay-webhook": return await replayWebhook(req, data);
      case "process-pending-webhooks": return await processPendingWebhooks(req, data);
      case "list-api-requests": return await listApiRequests(req, data);
      case "list-sessions": return await listSessions(req, data);
      case "get-session": return await getSession(req, data);
      case "cancel-session": return await cancelSession(req, data);
      case "integration-health": return await integrationHealth(req, data);
      case "start-test-run": return await startTestRun(req, data);
      case "list-test-runs": return await listTestRuns(req, data);
      case "overview": return await overview(req, data);

      // External API (API-key auth)
      case "api.create-session": return await apiCreateSession(req, data);
      case "api.get-session": return await apiGetSession(req, data);
      case "api.cancel-session": return await apiCancelSession(req, data);
      case "api.get-payment": return await apiGetPayment(req, data);
      case "api.verify-key": return await apiVerifyKey(req, data);

      // Public customer checkout
      case "open-session": return await openSession(data);
      case "create-payment": return await createPayment(data);
      case "verify-payment": return await verifyPayment(data);
      case "cancel-payment": return await cancelPayment(data);
      case "get-status": return await getStatus(data);

      // Admin
      case "admin.list-integrations": return await adminListIntegrations(req, data);
      case "admin.set-status": return await adminSetStatus(req, data);
      case "admin.revoke-key": return await adminRevokeKey(req, data);
      case "admin.replay-webhook": return await adminReplayWebhook(req, data);

      default: return json({ error: "INVALID_ACTION" }, 400);
    }
  } catch (err) {
    console.error("checkout-integration error:", err);
    return json({ error: "INTERNAL_ERROR", detail: String(err) }, 500);
  }
});
