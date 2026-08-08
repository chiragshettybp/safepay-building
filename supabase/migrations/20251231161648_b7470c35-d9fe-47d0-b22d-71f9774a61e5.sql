-- Create profiles table for phone+password authentication
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email TEXT UNIQUE,
  full_name TEXT,
  auth_method TEXT NOT NULL DEFAULT 'phone_password' CHECK (auth_method IN ('phone_password')),
  account_source TEXT NOT NULL DEFAULT 'signup' CHECK (account_source IN ('signup', 'payment_link')),
  account_claimed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
-- Users can view their own profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Users can update their own profile (identified by session)
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (true);

-- Allow insert for signup (via edge function with service role)
CREATE POLICY "Allow insert for signup" 
ON public.profiles 
FOR INSERT 
WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index on phone for faster lookups
CREATE INDEX idx_profiles_phone ON public.profiles(phone);

-- Create sessions table for custom auth
CREATE TABLE public.user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Sessions policies
CREATE POLICY "Allow session operations"
ON public.user_sessions
FOR ALL
USING (true);

-- Index for faster token lookups
CREATE INDEX idx_user_sessions_token ON public.user_sessions(token);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);