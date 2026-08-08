ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS auth_method TEXT DEFAULT 'phone_password',
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;