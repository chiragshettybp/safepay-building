-- Add merchant_id column to orders table for proper merchant-order relationship
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.merchants(id);

-- Create index for faster merchant order lookups
CREATE INDEX IF NOT EXISTS idx_orders_merchant_id ON public.orders(merchant_id);

-- Add RLS policy to allow merchants to view their orders
CREATE POLICY "Merchants can view their orders" 
ON public.orders 
FOR SELECT 
USING (
  merchant_id IN (
    SELECT m.id FROM public.merchants m 
    WHERE m.user_id IN (SELECT p.id FROM public.profiles p)
  )
);

-- Add RLS policy to allow merchants to update their orders
CREATE POLICY "Merchants can update their orders" 
ON public.orders 
FOR UPDATE 
USING (
  merchant_id IN (
    SELECT m.id FROM public.merchants m 
    WHERE m.user_id IN (SELECT p.id FROM public.profiles p)
  )
);