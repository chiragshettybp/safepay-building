import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find orders cancelled 2 days ago (will be deleted tomorrow)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    console.log(`Finding cancelled orders between ${threeDaysAgo.toISOString()} and ${twoDaysAgo.toISOString()}`);

    // Get cancelled orders that are 2-3 days old (will be deleted in ~24 hours)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, customer_id, merchant_name, amount, currency')
      .eq('status', 'cancelled')
      .gte('updated_at', threeDaysAgo.toISOString())
      .lt('updated_at', twoDaysAgo.toISOString());

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      throw ordersError;
    }

    console.log(`Found ${orders?.length || 0} orders to notify about`);

    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notifications_sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create notifications for each order
    const notifications = orders.map(order => ({
      user_id: order.customer_id,
      title: 'Order Will Be Deleted Soon',
      message: `Your cancelled order #${order.order_number} from ${order.merchant_name} (${order.currency} ${order.amount}) will be permanently deleted in 24 hours.`,
      type: 'warning',
      link: `/orders/${order.id}`
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('notifications')
      .insert(notifications)
      .select('id');

    if (insertError) {
      console.error('Error inserting notifications:', insertError);
      throw insertError;
    }

    console.log(`Successfully sent ${inserted?.length || 0} notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notifications_sent: inserted?.length || 0,
        orders_notified: orders.map(o => o.order_number)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Notification error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
