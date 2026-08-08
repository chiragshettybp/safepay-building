-- Drop the old constraint and add updated one with merchant_signup
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_source_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_source_check 
  CHECK (account_source = ANY (ARRAY['signup'::text, 'payment_link'::text, 'merchant_signup'::text]));