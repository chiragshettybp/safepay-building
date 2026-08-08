-- Mirror custom-auth profiles into Supabase Auth so they appear in the
-- dashboard (Authentication > Users). The app itself never reads auth.users;
-- this is purely for visibility/admin convenience.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  phone, phone_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  p.id,
  'authenticated',
  'authenticated',
  NULL,
  NULL,
  NULL,
  p.phone,
  p.created_at,
  '{"provider":"phone","providers":["phone"]}'::jsonb,
  jsonb_build_object('full_name', p.full_name),
  p.created_at,
  p.created_at,
  false,
  false
FROM public.profiles p
ON CONFLICT (id) DO NOTHING;

SELECT id, phone, created_at FROM auth.users ORDER BY created_at;
