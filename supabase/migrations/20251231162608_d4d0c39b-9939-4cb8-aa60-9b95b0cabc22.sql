-- Create orders table for escrow transactions
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  merchant_name TEXT NOT NULL,
  merchant_avatar TEXT,
  product_name TEXT NOT NULL,
  product_description TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'awaiting_shipment', 'shipped', 'delivered', 'completed', 'disputed', 'refunded', 'cancelled')),
  escrow_status TEXT NOT NULL DEFAULT 'held' CHECK (escrow_status IN ('held', 'released', 'refunded')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expected_delivery TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Policies for orders
CREATE POLICY "Users can view their own orders"
ON public.orders FOR SELECT
USING (customer_id IN (SELECT id FROM public.profiles));

CREATE POLICY "Users can update their own orders"
ON public.orders FOR UPDATE
USING (customer_id IN (SELECT id FROM public.profiles));

CREATE POLICY "Allow insert for orders"
ON public.orders FOR INSERT
WITH CHECK (true);

-- Create trigger for timestamp updates
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);

-- Create disputes table
CREATE TABLE public.disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'closed')),
  resolution TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Policies for disputes
CREATE POLICY "Users can view their own disputes"
ON public.disputes FOR SELECT
USING (customer_id IN (SELECT id FROM public.profiles));

CREATE POLICY "Users can insert disputes"
ON public.disputes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own disputes"
ON public.disputes FOR UPDATE
USING (customer_id IN (SELECT id FROM public.profiles));

-- Create trigger for timestamp updates
CREATE TRIGGER update_disputes_updated_at
BEFORE UPDATE ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (user_id IN (SELECT id FROM public.profiles));

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (user_id IN (SELECT id FROM public.profiles));

CREATE POLICY "Allow insert for notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Index for notifications
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;