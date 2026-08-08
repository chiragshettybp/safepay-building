-- Create support_tickets table for customer support system
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  order_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can only view their own tickets
CREATE POLICY "Users can view their own tickets"
ON public.support_tickets
FOR SELECT
USING (customer_id IN (SELECT profiles.id FROM profiles));

-- Users can create tickets for themselves
CREATE POLICY "Users can create their own tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (customer_id IN (SELECT profiles.id FROM profiles));

-- Users can update their own tickets (for status changes)
CREATE POLICY "Users can update their own tickets"
ON public.support_tickets
FOR UPDATE
USING (customer_id IN (SELECT profiles.id FROM profiles));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for support tickets
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;

-- Create index for faster lookups
CREATE INDEX idx_support_tickets_customer_id ON public.support_tickets(customer_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);