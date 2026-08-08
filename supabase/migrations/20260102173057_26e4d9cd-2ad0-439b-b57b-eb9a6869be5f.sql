-- Create order_events table for detailed status tracking
CREATE TABLE public.order_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'status_change',
  previous_status TEXT,
  new_status TEXT,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  actor_type TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient order lookups
CREATE INDEX idx_order_events_order_id ON public.order_events(order_id);
CREATE INDEX idx_order_events_created_at ON public.order_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

-- Users can view events for their own orders
CREATE POLICY "Users can view events for their orders"
ON public.order_events
FOR SELECT
USING (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE customer_id IN (SELECT id FROM public.profiles)
  )
);

-- Allow insert for order events (system/triggers)
CREATE POLICY "Allow insert for order events"
ON public.order_events
FOR INSERT
WITH CHECK (true);

-- Create function to track order status changes
CREATE OR REPLACE FUNCTION public.track_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_title TEXT;
  event_desc TEXT;
BEGIN
  -- Only trigger when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Determine event title and description based on new status
    CASE NEW.status
      WHEN 'pending' THEN
        event_title := 'Order Created';
        event_desc := 'Order placed and payment secured in escrow';
      WHEN 'awaiting_shipment' THEN
        event_title := 'Awaiting Shipment';
        event_desc := 'Merchant is preparing your order for shipment';
      WHEN 'shipped' THEN
        event_title := 'Order Shipped';
        event_desc := 'Package has been dispatched by the merchant';
      WHEN 'delivered' THEN
        event_title := 'Delivered';
        event_desc := 'Package has been delivered to your address';
      WHEN 'completed' THEN
        event_title := 'Order Completed';
        event_desc := 'Delivery confirmed and funds released to merchant';
      WHEN 'disputed' THEN
        event_title := 'Dispute Opened';
        event_desc := 'A dispute has been filed for this order';
      WHEN 'refunded' THEN
        event_title := 'Order Refunded';
        event_desc := 'Refund has been processed for this order';
      WHEN 'cancelled' THEN
        event_title := 'Order Cancelled';
        event_desc := 'This order has been cancelled';
      ELSE
        event_title := 'Status Updated';
        event_desc := 'Order status changed to ' || NEW.status;
    END CASE;

    -- Insert the event
    INSERT INTO public.order_events (
      order_id,
      event_type,
      previous_status,
      new_status,
      title,
      description,
      actor_type
    ) VALUES (
      NEW.id,
      'status_change',
      OLD.status,
      NEW.status,
      event_title,
      event_desc,
      'system'
    );
  END IF;

  -- Track escrow status changes separately
  IF OLD.escrow_status IS DISTINCT FROM NEW.escrow_status THEN
    INSERT INTO public.order_events (
      order_id,
      event_type,
      previous_status,
      new_status,
      title,
      description,
      actor_type
    ) VALUES (
      NEW.id,
      'escrow_change',
      OLD.escrow_status,
      NEW.escrow_status,
      CASE NEW.escrow_status
        WHEN 'held' THEN 'Payment Secured'
        WHEN 'released' THEN 'Funds Released'
        WHEN 'refunded' THEN 'Funds Refunded'
        ELSE 'Escrow Updated'
      END,
      CASE NEW.escrow_status
        WHEN 'held' THEN 'Payment is securely held in escrow'
        WHEN 'released' THEN 'Funds have been released to the merchant'
        WHEN 'refunded' THEN 'Funds have been refunded to your account'
        ELSE 'Escrow status updated to ' || NEW.escrow_status
      END,
      'system'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for order status tracking
CREATE TRIGGER track_order_status_changes
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.track_order_status_change();

-- Create function to insert initial event on order creation
CREATE OR REPLACE FUNCTION public.track_order_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert order created event
  INSERT INTO public.order_events (
    order_id,
    event_type,
    new_status,
    title,
    description,
    actor_type
  ) VALUES (
    NEW.id,
    'created',
    NEW.status,
    'Order Created',
    'Order #' || NEW.order_number || ' created with payment secured in escrow',
    'system'
  );

  -- Insert payment secured event
  INSERT INTO public.order_events (
    order_id,
    event_type,
    new_status,
    title,
    description,
    actor_type
  ) VALUES (
    NEW.id,
    'escrow_change',
    NEW.escrow_status,
    'Payment Secured',
    'Payment of ' || NEW.currency || ' ' || NEW.amount || ' secured in Safepay escrow',
    'system'
  );

  RETURN NEW;
END;
$$;

-- Create trigger for order creation
CREATE TRIGGER track_order_creation
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.track_order_creation();