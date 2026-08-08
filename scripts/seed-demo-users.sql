-- Seed demo users: customer (7777777777) and merchant (8888888888), password = test123
-- Password hash format matches the auth edge functions (PBKDF2, 100k iterations, SHA-256):
--   <salt>:<hex>
DO $$
DECLARE
  v_customer_id    uuid;
  v_merchant_uid   uuid;
  v_merchant_id    uuid;
  v_pwd            text := '65d98f82-f8e2-44a5-88b9-e4b5612309a6:24eb9979c20e81a29e25ff59abffa0d2bf2af8f6ea725d7d622a8dcf4dba6656';
BEGIN
  -- ================= CUSTOMER: 7777777777 =================
  INSERT INTO public.profiles (phone, password_hash, full_name, email, auth_method, account_source, account_claimed)
  VALUES ('+917777777777', v_pwd, 'Demo Customer', 'democustomer@safepay.test', 'phone_password', 'signup', true)
  ON CONFLICT (phone) DO UPDATE SET password_hash = EXCLUDED.password_hash, account_claimed = true
  RETURNING id INTO v_customer_id;

  INSERT INTO public.wallets (customer_id, balance, currency)
  VALUES (v_customer_id, 0, 'INR')
  ON CONFLICT (customer_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_customer_id, 'customer'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- ================= MERCHANT: 8888888888 =================
  INSERT INTO public.profiles (phone, password_hash, full_name, email, auth_method, account_source, account_claimed)
  VALUES ('+918888888888', v_pwd, 'Demo Merchant', 'demomerchant@safepay.test', 'phone_password', 'merchant_signup', true)
  ON CONFLICT (phone) DO UPDATE SET password_hash = EXCLUDED.password_hash, account_claimed = true
  RETURNING id INTO v_merchant_uid;

  INSERT INTO public.merchants (user_id, business_name, business_category, business_phone, business_email, verification_status, is_active)
  VALUES (v_merchant_uid, 'Demo Merchant Store', 'general', '+918888888888', 'demomerchant@safepay.test', 'approved', true)
  ON CONFLICT (user_id) DO UPDATE SET verification_status = 'approved', is_active = true
  RETURNING id INTO v_merchant_id;

  IF v_merchant_id IS NULL THEN
    SELECT id INTO v_merchant_id FROM public.merchants WHERE user_id = v_merchant_uid;
  END IF;

  INSERT INTO public.merchant_wallets (merchant_id, balance, pending_balance, total_earned, total_withdrawn, currency)
  VALUES (v_merchant_id, 0, 0, 0, 0, 'INR')
  ON CONFLICT (merchant_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_merchant_uid, 'merchant'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Customer id=%, merchant user id=%, merchant id=%', v_customer_id, v_merchant_uid, v_merchant_id;
END
$$;

SELECT p.phone, p.full_name, r.role, m.verification_status AS merchant_status
FROM public.profiles p
LEFT JOIN public.user_roles r ON r.user_id = p.id
LEFT JOIN public.merchants m ON m.user_id = p.id
WHERE p.phone IN ('+917777777777', '+918888888888')
ORDER BY p.phone;
