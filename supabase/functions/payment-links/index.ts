// payment-links — SafePay payment links engine.
//
// Actions:
//   Merchant (service-role server-side ops):
//     create-link      — create a reusable payment link (template + settings)
//     update-link      — edit a link template (items / amounts / flags)
//     set-link-status  — enable / disable a link
//     list-links       — merchant's links with aggregate order/revenue metrics
//     get-link         — link + items + session/order ledger
//     analytics        — merchant payment link metrics
//
//   Public (token is the capability, no auth):
//     open-link        — validate a link, resume the caller's active session or
//                        create a brand-new session (link stays reusable)
//     create-payment   — validate + persist customer details, create pending transaction + attempt,
//                        return Razorpay order (real) or test handshake
//     verify-payment   — HMAC + gateway verification, then idempotent finalize (order creation)
//     cancel-payment   — mark attempt cancelled; session stays active for retry
//     get-status       — authoritative session/order state for refresh/back/reopen
//
// A payment link is reusable: every customer interaction gets its own
// checkout session (checkout_sessions.checkout_link_id), payment transaction
// and order. Sessions, transactions and orders are single-use (their own unique
// keys / idempotency guards); only the link is shared between customers.
//
// The frontend redirect is NEVER the source of truth for payment success. Success
// is recorded only by finalize_checkout_payment(), which the client cannot invoke
// (revoked from anon/authenticated).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
const CHECKOUT_TEST_MODE = Deno.env.get("CHECKOUT_TEST_MODE") ?? "false";

// Test mode is an explicit server-side decision. It must NEVER engage
// implicitly when gateway credentials are missing — otherwise a misconfigured
// production deployment would silently "succeed" without moving any money.
// Production runs with CHECKOUT_TEST_MODE unset/false and real keys configured.
const isTestMode = () => CHECKOUT_TEST_MODE === "true";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Merchant actions are authorized by the app's custom session token (the same
// token issued by merchant-auth, stored in user_sessions). The token must be
// live (not expired) and its user must own the target merchant.
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
    .select("id")
    .eq("id", merchantId)
    .eq("user_id", session.user_id)
    .maybeSingle();
  if (mErr || !merchant) return json({ error: "FORBIDDEN" }, 403);

  return null;
}

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

async function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<boolean> {
  if (!RAZORPAY_KEY_SECRET || !orderId || !paymentId || !signature) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(RAZORPAY_KEY_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const data = encoder.encode(`${orderId}|${paymentId}`);
    const sig = await crypto.subtle.sign("HMAC", key, data);
    const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hex.length !== signature.length) return false;
    let result = 0;
    for (let i = 0; i < hex.length; i++) result |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
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

// ---------------------------------------------------------------------------
// Public actions
// ---------------------------------------------------------------------------
async function getStatus(data: Record<string, unknown>) {
  const { token } = data;
  if (!token || typeof token !== "string") return json({ error: "TOKEN_REQUIRED" }, 400);
  const { data: result, error } = await supabase.rpc("get_public_checkout_session", { p_token: token });
  if (error) return json({ error: "LOOKUP_FAILED", detail: error.message }, 500);
  return json(result ?? { not_found: true });
}

async function createPayment(data: Record<string, unknown>) {
  const { token, name, phone, email, shippingAddress, method, customerId } = data;

  if (!token || typeof token !== "string") return json({ error: "TOKEN_REQUIRED" }, 400);
  if (!name || typeof name !== "string" || name.trim().length < 2) return json({ error: "NAME_REQUIRED" }, 400);
  if (!phone || typeof phone !== "string" || !isValidIndiaPhone(phone)) {
    return json({ error: "PHONE_INVALID" }, 400);
  }
  if (!method || typeof method !== "string") return json({ error: "METHOD_REQUIRED" }, 400);

  const normalizedPhone = normalizePhone(phone);

  const { data: session, error: sessionError } = await supabase
    .from("checkout_sessions")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (sessionError) return json({ error: "SESSION_LOOKUP_FAILED", detail: sessionError.message }, 500);
  if (!session) return json({ error: "SESSION_NOT_FOUND" }, 404);

  // Lazy expiry
  if (session.status === "active" && new Date(session.expires_at).getTime() < Date.now()) {
    await supabase.from("checkout_sessions").update({ status: "expired" }).eq("id", session.id);
    await supabase.from("checkout_events").insert({
      session_id: session.id, event_type: "expired", step: session.current_step,
      event_data: { reason: "session_expired" },
    });
    return json({ error: "SESSION_EXPIRED" }, 410);
  }

  if (session.status === "completed") return json({ error: "ALREADY_COMPLETED" }, 409);
  if (session.status === "expired") return json({ error: "SESSION_EXPIRED" }, 410);
  if (session.status !== "active") return json({ error: "SESSION_NOT_ACTIVE", status: session.status }, 409);

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("id, is_active, verification_status")
    .eq("id", session.merchant_id)
    .maybeSingle();
  if (merchantError) return json({ error: "MERCHANT_LOOKUP_FAILED" }, 500);
  if (!merchant || !merchant.is_active) return json({ error: "MERCHANT_INACTIVE" }, 403);

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
    const a = shippingAddress;
    if (!a || !a.full_name || !a.line1 || !a.city || !a.state || !/^\d{6}$/.test(a.pincode || "")) {
      return json({ error: "SHIPPING_REQUIRED" }, 400);
    }
  }

  // Resolve / create the customer (guest or logged-in)
  let custId: string | null = (customerId as string) || session.customer_id || null;
  if (!custId) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", normalizedPhone)
      .maybeSingle();
    if (existing) {
      custId = existing.id;
    } else {
      // Guest identity resolution: a returning guest may use a new phone with
      // the same email. Reuse the existing profile by email when present.
      const cleanEmail = email && typeof email === "string" ? email.trim().toLowerCase() : null;
      let matchedByEmail: { id: string } | null = null;
      if (cleanEmail) {
        const { data: byEmail } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", cleanEmail)
          .maybeSingle();
        matchedByEmail = byEmail;
      }
      if (matchedByEmail) {
        custId = matchedByEmail.id;
      } else {
        const { data: newProfile, error: profileError } = await supabase
          .from("profiles")
          .insert({
            phone: normalizedPhone,
            password_hash: "guest:" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
            full_name: name.trim(),
            email: cleanEmail,
            account_source: "payment_link",
            account_claimed: false,
          })
          .select("id")
          .single();
        if (profileError || !newProfile) {
          // Unique race on phone or email — reuse the existing profile.
          const { data: raced } = await supabase
            .from("profiles")
            .select("id")
            .eq("phone", normalizedPhone)
            .maybeSingle();
          if (!raced && cleanEmail) {
            const { data: racedEmail } = await supabase
              .from("profiles")
              .select("id")
              .eq("email", cleanEmail)
              .maybeSingle();
            custId = racedEmail?.id ?? null;
          } else {
            custId = raced?.id ?? null;
          }
          if (!custId) return json({ error: "PROFILE_FAILED", detail: profileError?.message ?? "unknown" }, 500);
        } else {
          custId = newProfile.id;
        }
      }
    }
  }

  // Persist customer details on the session + advance step
  const { error: sessionUpdateError } = await supabase
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
  if (sessionUpdateError) return json({ error: "SESSION_UPDATE_FAILED", detail: sessionUpdateError.message }, 500);

  await supabase.from("checkout_events").insert({
    session_id: session.id,
    event_type: "payment_started",
    step: "payment",
    event_data: { method },
  });

  // Pending transaction + attempt. Amount ALWAYS comes from the session.
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

  if (isTestMode()) {
    return json({
      mode: "test",
      transactionId: tx.id,
      finalAmount: session.final_amount,
      currency: session.currency,
    });
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    await supabase.from("payment_attempts").update({ status: "failed", failure_reason: "provider_not_configured" })
      .eq("payment_transaction_id", tx.id);
    return json({ error: "PAYMENT_PROVIDER_NOT_CONFIGURED" }, 503);
  }

  try {
    const razorpayOrder = await createRazorpayOrder(
      Number(session.final_amount),
      session.currency,
      session.public_checkout_id || session.id
    );
    await supabase.from("payment_transactions").update({ razorpay_order_id: razorpayOrder.id }).eq("id", tx.id);
    return json({
      mode: "razorpay",
      transactionId: tx.id,
      razorpayOrderId: razorpayOrder.id,
      keyId: RAZORPAY_KEY_ID,
      finalAmount: session.final_amount,
      currency: session.currency,
    });
  } catch (err) {
    await supabase.from("payment_attempts").update({ status: "failed", failure_reason: "gateway_error" })
      .eq("payment_transaction_id", tx.id);
    return json({ error: "GATEWAY_ERROR", detail: String(err) }, 502);
  }
}

async function verifyPayment(data: Record<string, unknown>) {
  const { token, transactionId, razorpayPaymentId, razorpaySignature, razorpayOrderId } = data;

  if (!token || typeof token !== "string") return json({ error: "TOKEN_REQUIRED" }, 400);
  if (!transactionId || typeof transactionId !== "string") return json({ error: "TRANSACTION_REQUIRED" }, 400);

  const { data: session } = await supabase.from("checkout_sessions").select("*").eq("token", token).maybeSingle();
  if (!session) return json({ error: "SESSION_NOT_FOUND" }, 404);

  const { data: tx, error: txError } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("id", transactionId)
    .eq("session_id", session.id)
    .maybeSingle();
  if (txError) return json({ error: "TRANSACTION_LOOKUP_FAILED" }, 500);
  if (!tx) return json({ error: "TRANSACTION_NOT_FOUND" }, 404);

  // Safe re-entry / duplicate delivery: already finalized => return existing order.
  if (tx.status === "success" || session.order_id) {
    const { data: existing, error: rerunError } = await supabase.rpc("finalize_checkout_payment", {
      p_transaction_id: transactionId,
      p_gateway_payment_id: razorpayPaymentId ?? null,
      p_gateway_signature: razorpaySignature ?? null,
    });
    if (rerunError) return json({ error: "FINALIZE_FAILED", detail: rerunError.message }, 500);
    return json({ success: true, alreadyProcessed: true, order: existing });
  }

  if (tx.status !== "pending") {
    return json({ error: "TRANSACTION_NOT_FINALIZABLE", status: tx.status }, 409);
  }

  // Server decides the mode — a client can never opt into test mode.
  let verified = false;
  if (isTestMode()) {
    verified = true;
  } else if (razorpayPaymentId && razorpayOrderId && razorpaySignature) {
    const sigOk = await verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    const apiOk = await verifyRazorpayPaymentViaAPI(razorpayPaymentId);
    verified = sigOk && apiOk;
  }

  if (!verified) {
    await supabase
      .from("payment_transactions")
      .update({
        status: "failed",
        razorpay_payment_id: razorpayPaymentId ?? null,
        failure_reason: "Payment verification failed",
      })
      .eq("id", transactionId);
    await supabase.from("payment_attempts").update({ status: "failed", failure_reason: "verification_failed" })
      .eq("payment_transaction_id", transactionId);
    await supabase.from("checkout_events").insert({
      session_id: session.id, event_type: "payment_failed", step: "payment",
      event_data: { reason: "verification_failed" },
    });
    return json({ verified: false, error: "PAYMENT_VERIFICATION_FAILED" }, 400);
  }

  const { data: result, error: finalizeError } = await supabase.rpc("finalize_checkout_payment", {
    p_transaction_id: transactionId,
    p_gateway_payment_id: razorpayPaymentId ?? null,
    p_gateway_signature: razorpaySignature ?? null,
  });
  if (finalizeError) {
    return json({ error: "FINALIZE_FAILED", detail: finalizeError.message }, 500);
  }

  await supabase.from("payment_attempts").update({ status: "success" })
    .eq("payment_transaction_id", transactionId);

  return json({ success: true, order: result });
}

async function cancelPayment(data: Record<string, unknown>) {
  const { token, transactionId, reason } = data;
  if (!token || typeof token !== "string" || !transactionId || typeof transactionId !== "string") {
    return json({ error: "TOKEN_AND_TRANSACTION_REQUIRED" }, 400);
  }

  const { data: session } = await supabase.from("checkout_sessions").select("*").eq("token", token).maybeSingle();
  if (!session) return json({ error: "SESSION_NOT_FOUND" }, 404);

  const { data: tx } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("id", transactionId)
    .eq("session_id", session.id)
    .maybeSingle();
  if (!tx) return json({ error: "TRANSACTION_NOT_FOUND" }, 404);

  if (tx.status === "pending") {
    await supabase
      .from("payment_transactions")
      .update({ status: "failed", failure_reason: reason || "Payment cancelled" })
      .eq("id", transactionId)
      .eq("status", "pending");
    await supabase.from("payment_attempts").update({ status: "cancelled" })
      .eq("payment_transaction_id", transactionId)
      .eq("status", "initiated");
    await supabase.from("checkout_events").insert({
      session_id: session.id, event_type: "payment_cancelled", step: session.current_step,
      event_data: { reason: reason || "cancelled_by_customer" },
    });
  }

  return json({ success: true });
}

// ---------------------------------------------------------------------------
// Merchant actions — checkout LINKS (reusable parent entities). Every link can
// receive unlimited independent orders; each customer opening the link gets
// their own checkout session created server-side by open_link below.
// ---------------------------------------------------------------------------
async function createLink(req: Request, data: Record<string, unknown>) {
  const { merchantId, title, items, shippingAmount, discountAmount, taxAmount, requiresShipping, collectEmail, expiresAt, sessionExpiryHours } = data;
  if (!merchantId || typeof merchantId !== "string") return json({ error: "MERCHANT_REQUIRED" }, 400);
  const denied = await authorizeMerchant(req, merchantId);
  if (denied) return denied;
  if (!Array.isArray(items) || items.length === 0) return json({ error: "NO_ITEMS" }, 400);

  for (const item of items) {
    const p = Number(item.unit_price);
    const q = Number(item.quantity);
    if (!item.item_name || String(item.item_name).trim().length === 0) return json({ error: "ITEM_NAME_REQUIRED" }, 400);
    if (!Number.isFinite(p) || p <= 0 || p > 1000000) return json({ error: "INVALID_ITEM_PRICE" }, 400);
    if (!Number.isInteger(q) || q < 1 || q > 9999) return json({ error: "INVALID_ITEM_QTY" }, 400);
  }

  const { data: result, error } = await supabase.rpc("create_checkout_link", {
    p_merchant_id: merchantId,
    p_title: title ?? null,
    p_items: items,
    p_shipping_amount: Number(shippingAmount) || 0,
    p_discount_amount: Number(discountAmount) || 0,
    p_tax_amount: Number(taxAmount) || 0,
    p_requires_shipping: !!requiresShipping,
    p_collect_email: !!collectEmail,
    p_expires_at: expiresAt ?? null,
    p_session_expiry_hours: sessionExpiryHours ? Number(sessionExpiryHours) : null,
  });

  if (error) return json({ error: error.message || "CREATE_LINK_FAILED" }, 400);
  return json(result);
}

async function updateLink(req: Request, data: Record<string, unknown>) {
  const { merchantId, linkId, title, items, shippingAmount, discountAmount, taxAmount, requiresShipping, collectEmail, expiresAt, sessionExpiryHours } = data;
  if (!merchantId || typeof merchantId !== "string" || !linkId || typeof linkId !== "string") {
    return json({ error: "MERCHANT_AND_LINK_REQUIRED" }, 400);
  }
  const denied = await authorizeMerchant(req, merchantId);
  if (denied) return denied;

  const rpcArgs: Record<string, unknown> = { p_merchant_id: merchantId, p_link_id: linkId };
  if (title !== undefined) rpcArgs.p_title = title;
  if (items !== undefined) rpcArgs.p_items = items;
  if (shippingAmount !== undefined) rpcArgs.p_shipping_amount = Number(shippingAmount);
  if (discountAmount !== undefined) rpcArgs.p_discount_amount = Number(discountAmount);
  if (taxAmount !== undefined) rpcArgs.p_tax_amount = Number(taxAmount);
  if (requiresShipping !== undefined) rpcArgs.p_requires_shipping = !!requiresShipping;
  if (collectEmail !== undefined) rpcArgs.p_collect_email = !!collectEmail;
  if (expiresAt !== undefined) rpcArgs.p_expires_at = expiresAt ?? null;
  if (sessionExpiryHours !== undefined) rpcArgs.p_session_expiry_hours = sessionExpiryHours ? Number(sessionExpiryHours) : null;

  const { data: result, error } = await supabase.rpc("update_checkout_link", rpcArgs);
  if (error) return json({ error: error.message || "UPDATE_LINK_FAILED" }, 400);
  return json(result);
}

async function setLinkStatus(req: Request, data: Record<string, unknown>) {
  const { merchantId, linkId, status } = data;
  if (!merchantId || typeof merchantId !== "string" || !linkId || typeof linkId !== "string") {
    return json({ error: "MERCHANT_AND_LINK_REQUIRED" }, 400);
  }
  if (status !== "active" && status !== "inactive") return json({ error: "INVALID_STATUS" }, 400);
  const denied = await authorizeMerchant(req, merchantId);
  if (denied) return denied;

  const { data: result, error } = await supabase.rpc("set_checkout_link_status", {
    p_merchant_id: merchantId,
    p_link_id: linkId,
    p_status: status,
  });
  if (error) return json({ error: error.message || "SET_LINK_STATUS_FAILED" }, 400);
  return json(result);
}

async function listLinks(req: Request, data: Record<string, unknown>) {
  const { merchantId } = data;
  if (!merchantId || typeof merchantId !== "string") return json({ error: "MERCHANT_REQUIRED" }, 400);
  const denied = await authorizeMerchant(req, merchantId);
  if (denied) return denied;

  const { data: result, error } = await supabase.rpc("list_checkout_links", { p_merchant_id: merchantId });
  if (error) return json({ error: "LIST_LINKS_FAILED", detail: error.message }, 500);
  return json(result ?? []);
}

async function getLink(req: Request, data: Record<string, unknown>) {
  const { merchantId, linkId } = data;
  if (!merchantId || typeof merchantId !== "string" || !linkId || typeof linkId !== "string") {
    return json({ error: "MERCHANT_AND_LINK_REQUIRED" }, 400);
  }
  const denied = await authorizeMerchant(req, merchantId);
  if (denied) return denied;

  const { data: result, error } = await supabase.rpc("get_checkout_link", {
    p_merchant_id: merchantId,
    p_link_id: linkId,
  });
  if (error) return json({ error: error.message || "GET_LINK_FAILED" }, 400);
  return json(result);
}

// Public action: open a reusable checkout link. Validates the link, then
// resumes the caller's own active session or creates a brand-new session.
async function openLink(data: Record<string, unknown>) {
  const { linkToken, sessionToken } = data;
  if (!linkToken || typeof linkToken !== "string") return json({ error: "LINK_TOKEN_REQUIRED" }, 400);

  const { data: result, error } = await supabase.rpc("open_checkout_link", {
    p_link_token: linkToken,
    p_session_token: sessionToken && typeof sessionToken === "string" ? sessionToken : null,
  });
  if (error) return json({ error: "OPEN_LINK_FAILED", detail: error.message }, 500);
  return json(result ?? { not_found: true });
}

async function analytics(req: Request, data: Record<string, unknown>) {
  const { merchantId } = data;
  if (!merchantId || typeof merchantId !== "string") return json({ error: "MERCHANT_REQUIRED" }, 400);
  const denied = await authorizeMerchant(req, merchantId);
  if (denied) return denied;
  const { data: result, error } = await supabase.rpc("checkout_analytics", { p_merchant_id: merchantId });
  if (error) return json({ error: "ANALYTICS_FAILED", detail: error.message }, 500);
  return json(result);
}

// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...data } = await req.json();
    if (!action || typeof action !== "string") return json({ error: "ACTION_REQUIRED" }, 400);

    switch (action) {
      case "create-link": return await createLink(req, data);
      case "update-link": return await updateLink(req, data);
      case "set-link-status": return await setLinkStatus(req, data);
      case "list-links": return await listLinks(req, data);
      case "get-link": return await getLink(req, data);
      case "analytics": return await analytics(req, data);

      case "open-link": return await openLink(data);
      case "create-payment": return await createPayment(data);
      case "verify-payment": return await verifyPayment(data);
      case "cancel-payment": return await cancelPayment(data);
      case "get-status": return await getStatus(data);
      default: return json({ error: "INVALID_ACTION" }, 400);
    }
  } catch (err) {
    console.error("payment-links error:", err);
    return json({ error: "INTERNAL_ERROR", detail: String(err) }, 500);
  }
});
