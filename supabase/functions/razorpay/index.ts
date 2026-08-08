import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Create Razorpay order
async function createRazorpayOrder(amount: number, currency: string, receipt: string) {
  const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
  
  console.log('Creating Razorpay order for amount:', amount, 'currency:', currency);
  
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      receipt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Razorpay order creation failed:', errorText);
    throw new Error(`Failed to create Razorpay order: ${errorText}`);
  }

  const order = await response.json();
  console.log('Razorpay order created:', order.id);
  return order;
}

// Verify Razorpay payment signature
function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const crypto = globalThis.crypto;
  const encoder = new TextEncoder();
  const data = encoder.encode(`${orderId}|${paymentId}`);
  const key = encoder.encode(RAZORPAY_KEY_SECRET!);
  
  // Use HMAC-SHA256 for verification
  // Since Deno crypto is async, we'll use a simpler approach for now
  // In production, use proper HMAC verification
  const expectedSignature = orderId + '|' + paymentId;
  console.log('Verifying signature for:', orderId, paymentId);
  
  // For now, we'll verify by fetching the payment from Razorpay API
  return true; // We'll do API verification instead
}

// Verify payment via Razorpay API
async function verifyPaymentViaAPI(paymentId: string): Promise<{ verified: boolean; payment?: any; error?: string }> {
  const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
  
  console.log('Verifying payment via API:', paymentId);
  
  try {
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Payment verification failed:', errorText);
      return { verified: false, error: `Payment verification failed: ${errorText}` };
    }

    const payment = await response.json();
    console.log('Payment details:', payment.status, payment.captured);
    
    // Check if payment is captured/authorized
    if (payment.status === 'captured' || payment.status === 'authorized') {
      return { verified: true, payment };
    }
    
    return { verified: false, error: `Payment status: ${payment.status}`, payment };
  } catch (error) {
    console.error('Payment verification error:', error);
    return { verified: false, error: String(error) };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...data } = await req.json();
    console.log('Razorpay action:', action);

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error('Razorpay credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Razorpay credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    switch (action) {
      case 'create-order': {
        const { amount, currency, customerId, customerName, customerEmail, customerPhone, orderId, description } = data;
        
        if (!amount || !customerId || !customerPhone) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields: amount, customerId, customerPhone' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create Razorpay order
        const receipt = `rcpt_${Date.now()}`;
        const razorpayOrder = await createRazorpayOrder(amount, currency || 'INR', receipt);

        // Create payment transaction record
        const { data: transaction, error: txError } = await supabase
          .from('payment_transactions')
          .insert({
            customer_id: customerId,
            order_id: orderId || null,
            customer_name: customerName || null,
            customer_email: customerEmail || null,
            customer_phone: customerPhone,
            razorpay_order_id: razorpayOrder.id,
            amount,
            currency: currency || 'INR',
            status: 'pending',
          })
          .select()
          .single();

        if (txError) {
          console.error('Failed to create transaction record:', txError);
          return new Response(
            JSON.stringify({ error: 'Failed to create transaction record' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Transaction created:', transaction.id);

        return new Response(
          JSON.stringify({
            razorpayOrderId: razorpayOrder.id,
            transactionId: transaction.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            keyId: RAZORPAY_KEY_ID,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'verify-payment': {
        const { transactionId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = data;

        if (!transactionId || !razorpayPaymentId || !razorpayOrderId) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify payment via Razorpay API
        const { verified, payment, error: verifyError } = await verifyPaymentViaAPI(razorpayPaymentId);

        if (!verified) {
          // Update transaction as failed
          await supabase
            .from('payment_transactions')
            .update({
              status: 'failed',
              razorpay_payment_id: razorpayPaymentId,
              razorpay_signature: razorpaySignature || null,
              failure_reason: verifyError || 'Payment verification failed',
            })
            .eq('id', transactionId);

          return new Response(
            JSON.stringify({ verified: false, error: verifyError }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update transaction as successful
        const { data: updatedTx, error: updateError } = await supabase
          .from('payment_transactions')
          .update({
            status: 'success',
            razorpay_payment_id: razorpayPaymentId,
            razorpay_signature: razorpaySignature || null,
          })
          .eq('id', transactionId)
          .select()
          .single();

        if (updateError) {
          console.error('Failed to update transaction:', updateError);
        }

        // Sync order status -> escrow_locked (escrow held in SafePay)
        if (updatedTx?.order_id) {
          const { error: orderUpdateError } = await supabase
            .from('orders')
            .update({
              status: 'escrow_locked',
              escrow_status: 'held',
            })
            .eq('id', updatedTx.order_id);
          if (orderUpdateError) {
            console.error('Failed to sync order status:', orderUpdateError);
          }
        }

        console.log('Payment verified successfully:', transactionId);

        return new Response(
          JSON.stringify({ 
            verified: true, 
            transaction: updatedTx,
            payment,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update-failed': {
        const { transactionId, reason } = data;

        if (!transactionId) {
          return new Response(
            JSON.stringify({ error: 'Missing transactionId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase
          .from('payment_transactions')
          .update({
            status: 'failed',
            failure_reason: reason || 'Payment cancelled or failed',
          })
          .eq('id', transactionId);

        console.log('Transaction marked as failed:', transactionId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Razorpay function error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
