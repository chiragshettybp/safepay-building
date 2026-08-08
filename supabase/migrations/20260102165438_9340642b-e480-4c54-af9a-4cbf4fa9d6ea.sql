-- Create a function to handle KYC status change notifications
CREATE OR REPLACE FUNCTION public.notify_kyc_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Handle approved status
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'KYC Verification Approved',
        'Your identity verification has been approved. You now have full access to all features.',
        'success',
        '/profile'
      );
    -- Handle rejected status
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'KYC Verification Rejected',
        COALESCE('Your identity verification was rejected. Reason: ' || NEW.rejection_reason, 'Your identity verification was rejected. Please review and resubmit your documents.'),
        'error',
        '/profile/kyc'
      );
    -- Handle pending_review status (submitted for review)
    ELSIF NEW.status = 'pending_review' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'KYC Under Review',
        'Your identity documents have been submitted and are now under review. We will notify you once the verification is complete.',
        'info',
        '/profile'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on kyc_records table
DROP TRIGGER IF EXISTS kyc_status_change_notification ON public.kyc_records;

CREATE TRIGGER kyc_status_change_notification
  AFTER UPDATE ON public.kyc_records
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_kyc_status_change();