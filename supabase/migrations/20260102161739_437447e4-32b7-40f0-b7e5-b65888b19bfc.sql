-- Create wallets table
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id)
);

-- Create bank_accounts table
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_holder_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'savings',
  is_default BOOLEAN NOT NULL DEFAULT false,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wallet_transactions table
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'credit', 'debit', 'refund', 'withdrawal'
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  description TEXT,
  reference_id UUID, -- order_id or refund_id
  reference_type TEXT, -- 'order', 'refund', 'withdrawal'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Wallet policies
CREATE POLICY "Users can view their own wallet" ON public.wallets
  FOR SELECT USING (customer_id IN (SELECT id FROM profiles));

CREATE POLICY "Users can insert their own wallet" ON public.wallets
  FOR INSERT WITH CHECK (customer_id IN (SELECT id FROM profiles));

CREATE POLICY "Users can update their own wallet" ON public.wallets
  FOR UPDATE USING (customer_id IN (SELECT id FROM profiles));

-- Bank accounts policies
CREATE POLICY "Users can view their own bank accounts" ON public.bank_accounts
  FOR SELECT USING (customer_id IN (SELECT id FROM profiles));

CREATE POLICY "Users can insert their own bank accounts" ON public.bank_accounts
  FOR INSERT WITH CHECK (customer_id IN (SELECT id FROM profiles));

CREATE POLICY "Users can update their own bank accounts" ON public.bank_accounts
  FOR UPDATE USING (customer_id IN (SELECT id FROM profiles));

CREATE POLICY "Users can delete their own bank accounts" ON public.bank_accounts
  FOR DELETE USING (customer_id IN (SELECT id FROM profiles));

-- Wallet transactions policies
CREATE POLICY "Users can view their own wallet transactions" ON public.wallet_transactions
  FOR SELECT USING (customer_id IN (SELECT id FROM profiles));

CREATE POLICY "Allow insert for wallet transactions" ON public.wallet_transactions
  FOR INSERT WITH CHECK (true);

-- Create trigger for bank_accounts updated_at
CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for wallet tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_accounts;