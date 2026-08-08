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

    // Calculate the date 3 days ago
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    console.log(`Deleting cancelled orders older than: ${threeDaysAgo.toISOString()}`);

    // Delete cancelled orders older than 3 days
    const { data, error } = await supabase
      .from('orders')
      .delete()
      .eq('status', 'cancelled')
      .lt('updated_at', threeDaysAgo.toISOString())
      .select('id, order_number');

    if (error) {
      console.error('Error deleting cancelled orders:', error);
      throw error;
    }

    const deletedCount = data?.length || 0;
    console.log(`Successfully deleted ${deletedCount} cancelled orders`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted_count: deletedCount,
        deleted_orders: data 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    console.error('Cleanup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
