-- Create function for order status change notifications
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Order completed
    IF NEW.status = 'completed' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Order Completed',
        'Your order #' || NEW.order_number || ' has been completed. Funds have been released to the merchant.',
        'success',
        '/orders/' || NEW.id
      );
    -- Order shipped
    ELSIF NEW.status = 'shipped' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Order Shipped',
        'Your order #' || NEW.order_number || ' from ' || NEW.merchant_name || ' has been shipped.',
        'info',
        '/orders/' || NEW.id
      );
    -- Order delivered
    ELSIF NEW.status = 'delivered' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Order Delivered',
        'Your order #' || NEW.order_number || ' has been delivered. Please confirm receipt to release funds.',
        'info',
        '/orders/' || NEW.id || '/confirm'
      );
    -- Order cancelled
    ELSIF NEW.status = 'cancelled' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Order Cancelled',
        'Your order #' || NEW.order_number || ' has been cancelled. A refund will be initiated.',
        'warning',
        '/orders/' || NEW.id
      );
    -- Order disputed
    ELSIF NEW.status = 'disputed' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Dispute Opened',
        'A dispute has been opened for order #' || NEW.order_number || '. Our team will review it.',
        'warning',
        '/orders/' || NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS order_status_change_notification ON public.orders;

CREATE TRIGGER order_status_change_notification
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_status_change();

-- Create function for refund status change notifications
CREATE OR REPLACE FUNCTION public.notify_refund_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Refund processing
    IF NEW.status = 'processing' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Refund Processing',
        'Your refund of ' || NEW.currency || ' ' || NEW.amount || ' is being processed.',
        'info',
        '/refunds/' || NEW.id
      );
    -- Refund completed
    ELSIF NEW.status = 'completed' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Refund Completed',
        'Your refund of ' || NEW.currency || ' ' || NEW.amount || ' has been credited to your account.',
        'success',
        '/refunds/' || NEW.id || '/success'
      );
    -- Refund failed
    ELSIF NEW.status = 'failed' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Refund Failed',
        COALESCE('Your refund failed: ' || NEW.failure_reason, 'Your refund could not be processed. Please contact support.'),
        'error',
        '/refunds/' || NEW.id || '/failed'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on refunds table
DROP TRIGGER IF EXISTS refund_status_change_notification ON public.refunds;

CREATE TRIGGER refund_status_change_notification
  AFTER UPDATE ON public.refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_refund_status_change();

-- Also notify when a new refund is initiated
CREATE OR REPLACE FUNCTION public.notify_refund_initiated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    NEW.customer_id,
    'Refund Initiated',
    'A refund of ' || NEW.currency || ' ' || NEW.amount || ' has been initiated for your order.',
    'info',
    '/refunds/' || NEW.id
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for new refunds
DROP TRIGGER IF EXISTS refund_initiated_notification ON public.refunds;

CREATE TRIGGER refund_initiated_notification
  AFTER INSERT ON public.refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_refund_initiated();