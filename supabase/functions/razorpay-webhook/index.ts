// Razorpay webhook handler — server-authoritative payment status sync.
// Configure in Razorpay Dashboard → Settings → Webhooks:
//   URL:    https://jcxhagmfbezpgrxdxfvs.supabase.co/functions/v1/razorpay-webhook
//   Events: payment.captured, payment.failed, payment.authorized, refund.processed, refund.failed
//   Secret: RAZORPAY_WEBHOOK_SECRET (set via Lovable Cloud secrets)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-razorpay-signature",
};

const WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Constant-time compare
  if (hex.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < hex.length; i++) result |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return result === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";

  if (!WEBHOOK_SECRET) {
    console.error("RAZORPAY_WEBHOOK_SECRET not configured");
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const valid = await verifySignature(body, signature, WEBHOOK_SECRET);
  if (!valid) {
    console.error("Invalid webhook signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const type: string = event.event;
  const gatewayEventId: string = event.id;
  console.log("Razorpay webhook:", type, gatewayEventId);

  try {
    // Idempotency: the unique gateway_event_id guarantees exactly-once processing.
    // A duplicate delivery (retry or re-send) hits the unique violation and is
    // treated as already-handled without mutating any state.
    const { error: logInsertError } = await supabase.from("payment_webhook_logs").insert({
      gateway: "razorpay",
      gateway_event_id: gatewayEventId,
      event_type: type,
      payload: event,
      status: "received",
    });

    if (logInsertError) {
      if (logInsertError.code === "23505") {
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`webhook log insert failed: ${logInsertError.message}`);
    }

    let outcome: "processed" | "ignored" = "processed";

    if (type === "payment.captured" || type === "payment.authorized") {
      const p = event.payload.payment.entity;
      const { data: tx } = await supabase
        .from("payment_transactions")
        .update({
          status: "success",
          razorpay_payment_id: p.id,
        })
        .eq("razorpay_order_id", p.order_id)
        .select()
        .maybeSingle();

      if (tx?.session_id) {
        // Browser-close robustness: finalize the checkout server-side. This is
        // idempotent and covers both integration checkouts and payment links.
        // The shared engine completes the session, creates the order and lets
        // the DB trigger enqueue integration webhook events.
        const { data: session } = await supabase
          .from("checkout_sessions")
          .select("id, status, integration_id")
          .eq("id", tx.session_id)
          .maybeSingle();
        if (session && session.status !== "completed") {
          await supabase.rpc("finalize_checkout_payment", {
            p_transaction_id: tx.id,
            p_gateway_payment_id: p.id,
            p_gateway_signature: null,
          });
        }
      }

      if (tx?.order_id) {
        await supabase
          .from("orders")
          .update({ status: "pending", escrow_status: "held" })
          .eq("id", tx.order_id);
      }
    } else if (type === "payment.failed") {
      const p = event.payload.payment.entity;
      const { data: tx } = await supabase
        .from("payment_transactions")
        .update({
          status: "failed",
          razorpay_payment_id: p.id,
          failure_reason: p.error_description || p.error_reason || "Payment failed",
        })
        .eq("razorpay_order_id", p.order_id)
        .select()
        .maybeSingle();

      if (tx?.order_id) {
        await supabase
          .from("orders")
          .update({ status: "cancelled", escrow_status: "refunded" })
          .eq("id", tx.order_id);
      }
    } else if (type === "refund.processed") {
      const r = event.payload.refund.entity;
      const { data: tx } = await supabase
        .from("payment_transactions")
        .update({ status: "refunded" })
        .eq("razorpay_payment_id", r.payment_id)
        .select()
        .maybeSingle();

      if (tx?.order_id) {
        await supabase
          .from("orders")
          .update({ status: "refunded", escrow_status: "refunded" })
          .eq("id", tx.order_id);
      }
    } else {
      // Unknown/unsupported events are logged and ignored, never fatal.
      outcome = "ignored";
    }

    await supabase
      .from("payment_webhook_logs")
      .update({ status: outcome, processed_at: new Date().toISOString() })
      .eq("gateway_event_id", gatewayEventId);
  } catch (err) {
    console.error("Webhook processing error:", err);
    await supabase
      .from("payment_webhook_logs")
      .update({ status: "error", error: String(err), processed_at: new Date().toISOString() })
      .eq("gateway_event_id", gatewayEventId);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
