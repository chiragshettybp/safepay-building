import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/toast';
import { 
  ArrowLeft, Building, CheckCircle, AlertCircle, 
  Loader2, ArrowUpRight, Shield, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WalletData {
  id: string;
  balance: number;
  currency: string;
}

interface BankAccount {
  id: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  account_type: string;
  is_default: boolean;
  verification_status: string;
}

export default function WalletWithdraw() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    try {
      // Fetch wallet
      const { data: walletData } = await supabase
        .from('wallets')
        .select('*')
        .eq('customer_id', user!.id)
        .maybeSingle();

      setWallet(walletData);

      // Fetch verified bank accounts
      const { data: accounts } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('customer_id', user!.id)
        .order('is_default', { ascending: false });

      const allAccounts = accounts || [];
      setBankAccounts(allAccounts);

      // Pre-select default account
      const defaultAccount = allAccounts.find(a => a.is_default);
      if (defaultAccount) {
        setSelectedAccountId(defaultAccount.id);
      } else if (allAccounts.length > 0) {
        setSelectedAccountId(allAccounts[0].id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const maskAccountNumber = (number: string) => {
    return '••••' + number.slice(-4);
  };

  const handleAmountChange = (value: string) => {
    // Only allow numbers and one decimal point
    const sanitized = value.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    
    setAmount(sanitized);
    setError('');
  };

  const setQuickAmount = (percentage: number) => {
    if (!wallet) return;
    const quickAmount = (wallet.balance * percentage / 100).toFixed(2);
    setAmount(quickAmount);
    setError('');
  };

  const validateWithdrawal = (): boolean => {
    const numAmount = parseFloat(amount);

    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return false;
    }

    if (numAmount < 100) {
      setError('Minimum withdrawal amount is ₹100');
      return false;
    }

    if (!wallet || numAmount > wallet.balance) {
      setError('Insufficient balance');
      return false;
    }

    if (!selectedAccountId) {
      setError('Please select a bank account');
      return false;
    }

    const selectedAccount = bankAccounts.find(a => a.id === selectedAccountId);
    if (!selectedAccount) {
      setError('Please select a valid bank account');
      return false;
    }

    return true;
  };

  const handleWithdraw = async () => {
    if (!validateWithdrawal() || !user?.id || !wallet) return;

    setIsSubmitting(true);
    const numAmount = parseFloat(amount);
    const selectedAccount = bankAccounts.find(a => a.id === selectedAccountId);

    try {
      // Create withdrawal transaction
      const { data: transaction, error: txError } = await supabase
        .from('wallet_transactions')
        .insert({
          wallet_id: wallet.id,
          customer_id: user.id,
          type: 'withdrawal',
          amount: numAmount,
          currency: wallet.currency,
          status: 'pending',
          description: `Withdrawal to ${selectedAccount?.bank_name} (${maskAccountNumber(selectedAccount?.account_number || '')})`,
          bank_account_id: selectedAccountId,
        })
        .select()
        .single();

      if (txError) throw txError;

      // Deduct balance from wallet
      const { error: walletError } = await supabase
        .from('wallets')
        .update({ 
          balance: wallet.balance - numAmount,
          last_updated: new Date().toISOString()
        })
        .eq('id', wallet.id);

      if (walletError) throw walletError;

      toast({
        title: 'Withdrawal Initiated',
        description: `₹${numAmount.toLocaleString('en-IN')} will be credited to your bank account within 2-3 business days.`,
      });

      navigate('/wallet');
    } catch (error: any) {
      console.error('Error processing withdrawal:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process withdrawal',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const numAmount = parseFloat(amount) || 0;
  const hasInsufficientBalance = wallet && numAmount > wallet.balance;
  const canWithdraw = wallet && wallet.balance >= 100;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/wallet')} className="p-2 -ml-2 rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-foreground">Withdraw Funds</h1>
          <div className="w-9" />
        </div>
      </header>

      <div className="flex-1 p-4 space-y-4">
        {/* Available Balance Card */}
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-primary-foreground">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4" />
            <span className="text-primary-foreground/80 text-xs">Available Balance</span>
          </div>
          <h2 className="text-3xl font-bold">
            ₹{(wallet?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h2>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Withdrawal Amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-foreground">₹</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              className={`w-full h-14 pl-8 pr-4 rounded-xl border bg-background text-foreground text-xl font-semibold placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                error || hasInsufficientBalance ? 'border-destructive' : 'border-border'
              }`}
            />
          </div>
          {error && (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {error}
            </p>
          )}
        </div>

        {/* Quick Amount Buttons */}
        <div className="flex gap-2">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => setQuickAmount(pct)}
              disabled={!canWithdraw}
              className="flex-1 h-10 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {pct}%
            </button>
          ))}
        </div>

        {/* Select Bank Account */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Credit To
          </label>
          
          {bankAccounts.length > 0 ? (
            <div className="space-y-2">
              {bankAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => setSelectedAccountId(account.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                    selectedAccountId === account.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/30'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    selectedAccountId === account.id ? 'bg-primary/20' : 'bg-muted'
                  }`}>
                    <Building className={`w-5 h-5 ${
                      selectedAccountId === account.id ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-foreground font-medium text-sm truncate">{account.bank_name}</p>
                      {account.is_default && (
                        <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-medium rounded">Default</span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {account.account_type} • {maskAccountNumber(account.account_number)}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {selectedAccountId === account.id ? (
                      <CheckCircle className="w-5 h-5 text-primary" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-card border border-border rounded-xl">
              <Building className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-foreground font-medium text-sm">No bank accounts linked</p>
              <p className="text-muted-foreground text-xs mb-4">Add a bank account to withdraw funds</p>
              <Button
                size="sm"
                onClick={() => navigate('/wallet/bank-account')}
                className="rounded-xl"
              >
                Add Bank Account
              </Button>
            </div>
          )}
        </div>

        {/* Info Notice */}
        <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="mb-1">Withdrawals are typically processed within 2-3 business days.</p>
            <p>Minimum withdrawal: ₹100 • No withdrawal fees</p>
          </div>
        </div>
      </div>

      {/* Sticky Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-6 z-40">
        <Button
          onClick={handleWithdraw}
          disabled={isSubmitting || !canWithdraw || bankAccounts.length === 0 || !amount || hasInsufficientBalance}
          className="w-full h-12 rounded-xl font-semibold"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <ArrowUpRight className="w-5 h-5 mr-2" />
              Withdraw {numAmount > 0 ? `₹${numAmount.toLocaleString('en-IN')}` : ''}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
