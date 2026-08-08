-- Create function for dispute status change notifications
CREATE OR REPLACE FUNCTION public.notify_dispute_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Dispute resolved in customer's favor
    IF NEW.status = 'resolved' AND NEW.resolution = 'customer_favor' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Dispute Resolved in Your Favor',
        'Your dispute has been resolved in your favor. A refund will be processed shortly.',
        'success',
        '/disputes/' || NEW.id || '/result'
      );
    -- Dispute resolved in merchant's favor
    ELSIF NEW.status = 'resolved' AND NEW.resolution = 'merchant_favor' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Dispute Resolved',
        'Your dispute has been reviewed and resolved. The funds have been released to the merchant.',
        'info',
        '/disputes/' || NEW.id || '/result'
      );
    -- Dispute resolved with partial refund
    ELSIF NEW.status = 'resolved' AND NEW.resolution = 'partial_refund' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Dispute Resolved - Partial Refund',
        'Your dispute has been resolved with a partial refund of ' || NEW.refund_amount || '.',
        'info',
        '/disputes/' || NEW.id || '/result'
      );
    -- Dispute under review
    ELSIF NEW.status = 'under_review' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Dispute Under Review',
        'Your dispute is now being reviewed by our team. We will update you soon.',
        'info',
        '/disputes/' || NEW.id
      );
    -- More info required
    ELSIF NEW.status = 'info_required' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Additional Information Required',
        'We need more information to process your dispute. Please provide the requested details.',
        'warning',
        '/disputes/' || NEW.id
      );
    -- Dispute escalated
    ELSIF NEW.status = 'escalated' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Dispute Escalated',
        'Your dispute has been escalated to a senior team member for further review.',
        'info',
        '/disputes/' || NEW.id
      );
    -- Dispute closed
    ELSIF NEW.status = 'closed' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Dispute Closed',
        'Your dispute has been closed. Thank you for your patience.',
        'info',
        '/disputes/' || NEW.id || '/result'
      );
    -- Dispute rejected
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Dispute Rejected',
        COALESCE('Your dispute was rejected. Reason: ' || NEW.admin_notes, 'Your dispute could not be approved based on the evidence provided.'),
        'error',
        '/disputes/' || NEW.id || '/result'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on disputes table
DROP TRIGGER IF EXISTS dispute_status_change_notification ON public.disputes;

CREATE TRIGGER dispute_status_change_notification
  AFTER UPDATE ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_dispute_status_change();