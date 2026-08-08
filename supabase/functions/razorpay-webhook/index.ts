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
  console.log("Razorpay webhook:", type);

  try {
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
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
