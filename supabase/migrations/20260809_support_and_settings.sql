-- 20260809_support_and_settings.sql
-- Refund + Profile + Settings + Support phase (E2E phase 3):
--  1) support_tickets gains merchant_id  -> merchant support
--  2) ticket_messages                   -> threaded support conversations
--  3) ticket_attachments                -> message attachments (storage-backed)
--  4) user_preferences                  -> customer + merchant notification & privacy settings
--  5) Notification triggers: ticket created + ticket reply (both parties)
--  6) Storage bucket + policies for ticket attachments

-- 1) Merchant support
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS support_tickets_merchant_id_idx
  ON public.support_tickets (merchant_id) WHERE merchant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_tickets_customer_id_created_idx
  ON public.support_tickets (customer_id, created_at DESC);

-- 2) Conversation messages
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('customer','merchant','admin')),
  sender_name text NOT NULL,
  message     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_messages_ticket_created_idx
  ON public.ticket_messages (ticket_id, created_at);

CREATE OR REPLACE FUNCTION public.update_ticket_messages_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS update_ticket_messages_updated_at ON public.ticket_messages;
CREATE TRIGGER update_ticket_messages_updated_at
  BEFORE UPDATE ON public.ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_ticket_messages_updated_at();

-- 3) Attachments
CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  message_id   uuid REFERENCES public.ticket_messages(id) ON DELETE SET NULL,
  file_name    text NOT NULL,
  file_url     text NOT NULL,
  content_type text,
  file_size    bigint,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_attachments_ticket_idx
  ON public.ticket_attachments (ticket_id);

-- 4) User preferences (shared by customers and merchants, keyed on profile user_id)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id            uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_notifications boolean NOT NULL DEFAULT true,
  sms_notifications  boolean NOT NULL DEFAULT true,
  push_notifications boolean NOT NULL DEFAULT true,
  order_updates      boolean NOT NULL DEFAULT true,
  marketing_emails   boolean NOT NULL DEFAULT false,
  profile_visibility text NOT NULL DEFAULT 'public' CHECK (profile_visibility IN ('public','private')),
  show_activity      boolean NOT NULL DEFAULT true,
  two_factor_enabled boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.update_user_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_user_preferences_updated_at();

-- 5a) Notify the creator that their ticket was submitted
-- (respects the user's push_notifications preference; default = notified)
CREATE OR REPLACE FUNCTION public.notify_support_ticket_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_link   text;
  v_enabled boolean;
BEGIN
  v_link := CASE
    WHEN NEW.merchant_id IS NOT NULL THEN '/merchant-support/' || NEW.id
    ELSE '/help/tickets/' || NEW.id
  END;

  SELECT COALESCE((SELECT push_notifications FROM public.user_preferences WHERE user_id = NEW.customer_id), true)
    INTO v_enabled;

  IF v_enabled THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.customer_id,
      'Support Ticket Created',
      'Your ticket "' || NEW.subject || '" has been submitted. Our team will get back to you soon.',
      'info',
      v_link
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS support_ticket_created_notification ON public.support_tickets;
CREATE TRIGGER support_ticket_created_notification
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_support_ticket_created();

-- 5b) Notify the counterparty when a reply is posted (no self-notifications).
--     Respects each recipient's push_notifications preference (default = notified).
CREATE OR REPLACE FUNCTION public.notify_support_ticket_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer      uuid;
  v_merchant_user uuid;
  v_cust_enabled  boolean;
  v_merch_enabled boolean;
BEGIN
  SELECT t.customer_id, m.user_id
    INTO v_customer, v_merchant_user
  FROM public.support_tickets t
  LEFT JOIN public.merchants m ON m.id = t.merchant_id
  WHERE t.id = NEW.ticket_id;

  SELECT COALESCE((SELECT push_notifications FROM public.user_preferences WHERE user_id = v_customer), true)
    INTO v_cust_enabled;
  SELECT COALESCE((SELECT push_notifications FROM public.user_preferences WHERE user_id = v_merchant_user), true)
    INTO v_merch_enabled;

  -- Creator/customer side of a support conversation
  IF NEW.sender_type <> 'customer' AND v_customer IS NOT NULL AND NEW.sender_id <> v_customer AND v_cust_enabled THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (v_customer, 'Support Reply', 'You have a new reply on your support ticket.', 'info', '/help/tickets/' || NEW.ticket_id);
  END IF;

  -- Merchant side of a merchant-owned ticket
  IF v_merchant_user IS NOT NULL AND NEW.sender_id <> v_merchant_user AND v_merch_enabled THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (v_merchant_user, 'Support Reply', 'You have a new reply on your support ticket.', 'info', '/merchant-support/' || NEW.ticket_id);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS support_ticket_reply_notification ON public.ticket_messages;
CREATE TRIGGER support_ticket_reply_notification
  AFTER INSERT ON public.ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_support_ticket_reply();

-- 6) Storage bucket + policies for ticket attachments (mirrors dispute-files)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can upload to ticket-attachments" ON storage.objects;
CREATE POLICY "Anyone can upload to ticket-attachments"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'ticket-attachments'::text);

DROP POLICY IF EXISTS "Anyone can view ticket-attachments" ON storage.objects;
CREATE POLICY "Anyone can view ticket-attachments"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'ticket-attachments'::text);

DROP POLICY IF EXISTS "Anyone can delete from ticket-attachments" ON storage.objects;
CREATE POLICY "Anyone can delete from ticket-attachments"
  ON storage.objects FOR DELETE TO public
  USING (bucket_id = 'ticket-attachments'::text);

-- 7) Table RLS policies for the new tables (mirrors the repo's custom-auth
--    existence-based policy pattern; row-level authorization is enforced at the
--    app layer by filtering on customer_id / merchant_id / sender_id).
DROP POLICY IF EXISTS "Allow insert for ticket messages" ON public.ticket_messages;
CREATE POLICY "Allow insert for ticket messages"
  ON public.ticket_messages FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view ticket messages" ON public.ticket_messages;
CREATE POLICY "Users can view ticket messages"
  ON public.ticket_messages FOR SELECT TO public
  USING (ticket_id IN (SELECT id FROM public.support_tickets));

DROP POLICY IF EXISTS "Users can update ticket messages" ON public.ticket_messages;
CREATE POLICY "Users can update ticket messages"
  ON public.ticket_messages FOR UPDATE TO public
  USING (ticket_id IN (SELECT id FROM public.support_tickets));

DROP POLICY IF EXISTS "Allow insert for ticket attachments" ON public.ticket_attachments;
CREATE POLICY "Allow insert for ticket attachments"
  ON public.ticket_attachments FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view ticket attachments" ON public.ticket_attachments;
CREATE POLICY "Users can view ticket attachments"
  ON public.ticket_attachments FOR SELECT TO public
  USING (ticket_id IN (SELECT id FROM public.support_tickets));

DROP POLICY IF EXISTS "Allow insert for user preferences" ON public.user_preferences;
CREATE POLICY "Allow insert for user preferences"
  ON public.user_preferences FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their preferences" ON public.user_preferences;
CREATE POLICY "Users can view their preferences"
  ON public.user_preferences FOR SELECT TO public
  USING (user_id IN (SELECT id FROM public.profiles));

DROP POLICY IF EXISTS "Users can update their preferences" ON public.user_preferences;
CREATE POLICY "Users can update their preferences"
  ON public.user_preferences FOR UPDATE TO public
  USING (user_id IN (SELECT id FROM public.profiles));
