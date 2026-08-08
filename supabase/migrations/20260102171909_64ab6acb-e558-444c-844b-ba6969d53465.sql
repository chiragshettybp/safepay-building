-- Create missing wallets for existing users
INSERT INTO wallets (customer_id, balance, currency)
SELECT p.id, 0, 'INR'
FROM profiles p
LEFT JOIN wallets w ON p.id = w.customer_id
WHERE w.id IS NULL;

-- Create a trigger to auto-create wallets for new profiles
CREATE OR REPLACE FUNCTION public.create_wallet_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (customer_id, balance, currency)
  VALUES (NEW.id, 0, 'INR')
  ON CONFLICT (customer_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS create_wallet_after_profile ON public.profiles;
CREATE TRIGGER create_wallet_after_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_wallet_for_new_user();