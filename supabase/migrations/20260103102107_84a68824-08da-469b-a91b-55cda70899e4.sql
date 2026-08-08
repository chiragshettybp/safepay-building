-- Create app_role enum for role management
CREATE TYPE public.app_role AS ENUM ('customer', 'merchant', 'admin');

-- Create user_roles table for proper role management (avoiding privilege escalation)
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents recursive RLS issues)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id IN (SELECT id FROM profiles));

CREATE POLICY "Allow insert for user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (true);

-- Create merchants table for business-specific data
CREATE TABLE public.merchants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    business_name TEXT NOT NULL,
    business_category TEXT NOT NULL DEFAULT 'general',
    gst_number TEXT,
    business_address TEXT,
    business_city TEXT,
    business_state TEXT,
    business_pincode TEXT,
    business_phone TEXT,
    business_email TEXT,
    business_logo_url TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending',
    verified_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_revenue NUMERIC NOT NULL DEFAULT 0,
    average_rating NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on merchants
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

-- RLS policies for merchants
CREATE POLICY "Users can view their own merchant profile"
ON public.merchants
FOR SELECT
USING (user_id IN (SELECT id FROM profiles));

CREATE POLICY "Users can insert their own merchant profile"
ON public.merchants
FOR INSERT
WITH CHECK (user_id IN (SELECT id FROM profiles));

CREATE POLICY "Users can update their own merchant profile"
ON public.merchants
FOR UPDATE
USING (user_id IN (SELECT id FROM profiles));

-- Add trigger for updated_at on merchants
CREATE TRIGGER update_merchants_updated_at
BEFORE UPDATE ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create merchant_wallets table (separate from customer wallets)
CREATE TABLE public.merchant_wallets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL UNIQUE REFERENCES public.merchants(id) ON DELETE CASCADE,
    balance NUMERIC NOT NULL DEFAULT 0,
    pending_balance NUMERIC NOT NULL DEFAULT 0,
    total_earned NUMERIC NOT NULL DEFAULT 0,
    total_withdrawn NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on merchant_wallets
ALTER TABLE public.merchant_wallets ENABLE ROW LEVEL SECURITY;

-- RLS policies for merchant_wallets
CREATE POLICY "Merchants can view their own wallet"
ON public.merchant_wallets
FOR SELECT
USING (merchant_id IN (SELECT id FROM merchants WHERE user_id IN (SELECT id FROM profiles)));

CREATE POLICY "Merchants can update their own wallet"
ON public.merchant_wallets
FOR UPDATE
USING (merchant_id IN (SELECT id FROM merchants WHERE user_id IN (SELECT id FROM profiles)));

CREATE POLICY "Allow insert for merchant wallets"
ON public.merchant_wallets
FOR INSERT
WITH CHECK (true);

-- Function to create merchant wallet when merchant is created
CREATE OR REPLACE FUNCTION public.create_wallet_for_new_merchant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.merchant_wallets (merchant_id, balance, currency)
  VALUES (NEW.id, 0, 'INR')
  ON CONFLICT (merchant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to auto-create merchant wallet
CREATE TRIGGER on_merchant_created
AFTER INSERT ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.create_wallet_for_new_merchant();

-- Function to assign merchant role
CREATE OR REPLACE FUNCTION public.assign_merchant_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'merchant')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to auto-assign merchant role
CREATE TRIGGER on_merchant_role_assign
AFTER INSERT ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.assign_merchant_role();

-- Also assign customer role when new profile is created (default role)
CREATE OR REPLACE FUNCTION public.assign_customer_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_customer_role
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_customer_role();