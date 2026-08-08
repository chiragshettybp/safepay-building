-- Insert demo merchant account for testing payments
INSERT INTO public.profiles (
  phone,
  password_hash,
  full_name,
  email,
  auth_method,
  account_source,
  account_claimed
) VALUES (
  '+919876543210',
  '5e884898da28047d9166e1c80b5d68c839e15f28e5e5a8e5c5a4e8c5a8e5c5a5',
  'Demo Merchant Store',
  'merchant@demo.com',
  'phone_password',
  'signup',
  true
);