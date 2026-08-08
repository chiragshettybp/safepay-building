ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_account_source;
ALTER TABLE public.profiles ADD CONSTRAINT check_account_source
  CHECK (account_source = ANY (ARRAY['signup','direct_signup','payment_link','merchant_invite','admin_created']));