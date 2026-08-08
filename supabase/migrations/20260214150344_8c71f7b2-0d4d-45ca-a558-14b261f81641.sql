-- Allow customers to view tracking for their own orders
CREATE POLICY "Customers can view tracking for their orders"
ON public.order_tracking FOR SELECT
USING (order_id IN (
  SELECT id FROM orders WHERE customer_id IN (
    SELECT id FROM profiles
  )
));

-- Also allow customers to view tracking_updates for their orders
CREATE POLICY "Customers can view tracking updates for their orders"
ON public.tracking_updates FOR SELECT
USING (tracking_id IN (
  SELECT ot.id FROM order_tracking ot
  JOIN orders o ON o.id = ot.order_id
  WHERE o.customer_id IN (SELECT id FROM profiles)
));