-- 20260809_dispute_merchant_comment_match.sql
-- Follow-up:
--  a) notify_customer_on_merchant_comment must recognize merchant comments posted
--     with user_id = merchants.id (the id the merchant app exposes) OR merchants.user_id
--  b) notify the merchant when a dispute is closed/withdrawn

CREATE OR REPLACE FUNCTION public.notify_customer_on_merchant_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer uuid;
  v_merchant_user uuid;
  v_merchant_id uuid;
BEGIN
  SELECT o.customer_id, m.user_id, m.id INTO v_customer, v_merchant_user, v_merchant_id
  FROM public.disputes d
  JOIN public.orders o ON o.id = d.order_id
  JOIN public.merchants m ON m.id = o.merchant_id
  WHERE d.id = NEW.dispute_id;

  IF v_customer IS NOT NULL AND NEW.is_admin = false
     AND (NEW.user_id = v_merchant_user OR NEW.user_id = v_merchant_id) THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_customer,
      'Merchant Responded',
      'The merchant has responded to your dispute.',
      'info',
      '/disputes/' || NEW.dispute_id
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS customer_notified_on_merchant_comment ON public.dispute_comments;
CREATE TRIGGER customer_notified_on_merchant_comment
  AFTER INSERT ON public.dispute_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_customer_on_merchant_comment();

CREATE OR REPLACE FUNCTION public.notify_merchant_on_dispute_closed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_merchant_user uuid;
BEGIN
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    SELECT m.user_id INTO v_merchant_user
    FROM public.orders o
    JOIN public.merchants m ON m.id = o.merchant_id
    WHERE o.id = NEW.order_id;

    IF v_merchant_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        v_merchant_user,
        'Dispute Closed',
        'A dispute on one of your orders has been closed.',
        'info',
        '/merchant-disputes'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS merchant_dispute_closed_notification ON public.disputes;
CREATE TRIGGER merchant_dispute_closed_notification
  AFTER UPDATE OF status ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.notify_merchant_on_dispute_closed();
