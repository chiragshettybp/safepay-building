ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.profiles ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN user_id SET DEFAULT gen_random_uuid();