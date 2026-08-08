-- 20260809_refund_success_completion.sql
-- Refund lifecycle root-cause fixes for the E2E phase:
--
--  1. notify_refund_status_change only handled 'completed' as the terminal
--     refund state, but the app drives refunds to 'success'
--     (RefundInitiated.tsx redirects on 'success'; RefundSuccess.tsx renders
--     only for status = 'success'). As a result a successful refund produced
--     NO "Refund Completed" notification and completed_at was never stamped.
--     Fix: handle the 'success' transition (keep 'completed' for backward
--     compatibility), emit the "Refund Completed" notification and set
--     completed_at. The trigger is BEFORE UPDATE so completed_at persists.
--
--  2. Add an integrity guard: a refund in the terminal 'success' state can
--     never be moved back to an earlier state (no double-processing or
--     status rollback), and a successful refund cannot be updated to a
--     different status.

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
    -- Refund completed (app terminal state is 'success'; keep 'completed' for compat)
    ELSIF NEW.status IN ('completed', 'success') THEN
      NEW.completed_at := COALESCE(NEW.completed_at, now());
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

DROP TRIGGER IF EXISTS refund_status_change_notification ON public.refunds;
CREATE TRIGGER refund_status_change_notification
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_refund_status_change();

-- Integrity guard: no transitions out of the terminal 'success' state.
CREATE OR REPLACE FUNCTION public.guard_refund_terminal_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'success' AND NEW.status IS DISTINCT FROM 'success' THEN
    RAISE EXCEPTION 'Refund % is already completed and cannot be reopened (status %)', OLD.id, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refund_terminal_state_guard ON public.refunds;
CREATE TRIGGER refund_terminal_state_guard
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_refund_terminal_state();
