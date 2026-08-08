import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { PAYMENT_CONSTANTS, calculatePayoutFee, calculateNetPayout } from '@/lib/constants';

interface MerchantWallet {
  id: string;
  balance: number;
  pending_balance: number;
  currency: string;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  verification_status: string;
}

const MIN_WITHDRAWAL = PAYMENT_CONSTANTS.MIN_WITHDRAWAL_AMOUNT;
const PROCESSING_FEE_PERCENT = PAYMENT_CONSTANTS.MERCHANT_PAYOUT_FEE_PERCENT;

export default function MerchantWithdraw() {
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [wallet, setWallet] = useState<MerchantWallet | null>(null);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/merchant-login', { replace: true });
    }
    if (!authLoading && merchant && merchant.verificationStatus !== 'approved') {
      navigate('/merchant-verify', { replace: true });
    }
  }, [merchant, isAuthenticated, authLoading, navigate]);

  const fetchData = useCallback(async () => {
    if (!merchant?.id) return;

    try {
      setIsLoading(true);

      // Fetch wallet
      const { data: walletData, error: walletError } = await supabase
        .from('merchant_wallets')
        .select('*')
        .eq('merchant_id', merchant.id)
        .single();

      if (walletError && walletError.code !== 'PGRST116') {
        console.error('Error fetching wallet:', walletError);
      }

      if (walletData) {
        setWallet(walletData);
      }

      // Fetch default bank account
      const { data: bankData } = await supabase
        .from('merchant_bank_accounts')
        .select('*')
        .eq('merchant_id', merchant.id)
        .eq('is_default', true)
        .single();

      if (bankData) {
        setBankAccount(bankData);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    if (merchant?.id) {
      fetchData();
    }
  }, [merchant?.id, fetchData]);

  // Redirect if no bank account or not verified
  useEffect(() => {
    if (!isLoading && !bankAccount) {
      toast.error('Please add a bank account first');
      navigate('/merchant-bank-account');
    }
    if (!isLoading && bankAccount && bankAccount.verification_status !== 'verified') {
      toast.error('Bank account verification pending');
      navigate('/merchant-payouts');
    }
  }, [isLoading, bankAccount, navigate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const handleAmountChange = (value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    setAmount(numericValue);
    setError('');

    const numAmount = parseInt(numericValue) || 0;
    if (numAmount < MIN_WITHDRAWAL && numericValue) {
      setError(`Minimum withdrawal is ${formatCurrency(MIN_WITHDRAWAL)}`);
    } else if (wallet && numAmount > wallet.balance) {
      setError('Amount exceeds available balance');
    }
  };

  const setQuickAmount = (value: number) => {
    if (wallet && value <= wallet.balance) {
      setAmount(value.toString());
      setError('');
    }
  };

  const withdrawAmount = parseInt(amount) || 0;
  const processingFee = Math.round(withdrawAmount * PROCESSING_FEE_PERCENT / 100);
  const netAmount = withdrawAmount - processingFee;

  const canSubmit = 
    withdrawAmount >= MIN_WITHDRAWAL && 
    wallet && 
    withdrawAmount <= wallet.balance && 
    bankAccount?.verification_status === 'verified' &&
    !error;

  const handleSubmit = async () => {
    if (!canSubmit || !merchant?.id || !bankAccount?.id) return;

    setIsSubmitting(true);

    try {
      // Generate transaction ID
      const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      // Insert payout record
      const { data: payoutData, error: payoutError } = await supabase
        .from('merchant_payouts')
        .insert({
          merchant_id: merchant.id,
          bank_account_id: bankAccount.id,
          amount: withdrawAmount,
          currency: 'INR',
          status: 'processing',
          notes: notes.trim() || null,
          transaction_id: transactionId,
          processing_started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (payoutError) throw payoutError;

      // Log activity
      await supabase.from('merchant_activity').insert({
        merchant_id: merchant.id,
        activity_type: 'payout',
        title: 'Withdrawal Requested',
        description: `Withdrawal of ${formatCurrency(withdrawAmount)} initiated`,
        reference_id: payoutData.id,
        reference_type: 'payout',
      });

      toast.success('Withdrawal request submitted');
      
      // Navigate to success page with payout ID
      navigate(`/merchant-withdraw-success?id=${payoutData.id}`);

    } catch (error: any) {
      console.error('Error submitting withdrawal:', error);
      toast.error(error.message || 'Failed to submit withdrawal');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="flex items-center h-14 px-4">
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <main className="p-4 space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center h-14 px-4">
          <button onClick={() => navigate('/merchant-payouts')} className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div className="ml-3">
            <h1 className="text-lg font-semibold">Withdraw Funds</h1>
            <p className="text-[10px] text-muted-foreground">Transfer to bank account</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Available Balance Card */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
          <p className="text-3xl font-bold text-primary">{formatCurrency(wallet?.balance || 0)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Min. withdrawal: {formatCurrency(MIN_WITHDRAWAL)}
          </p>
        </div>

        {/* Bank Account */}
        {bankAccount && (
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-2">Withdrawing to</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">account_balance</span>
              </div>
              <div>
                <p className="text-sm font-medium">{bankAccount.bank_name}</p>
                <p className="text-xs text-muted-foreground">
                  ****{bankAccount.account_number.slice(-4)} • {bankAccount.account_holder_name}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Amount Input */}
        <div className="space-y-3">
          <Label className="text-xs font-medium">Enter Amount</Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">₹</span>
            <Input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0"
              className={`h-16 pl-10 text-3xl font-bold rounded-xl text-center ${error ? 'border-destructive' : ''}`}
            />
          </div>
          {error && (
            <p className="text-[10px] text-destructive flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">error</span>
              {error}
            </p>
          )}

          {/* Quick Amount Buttons */}
          <div className="flex gap-2">
            {[500, 1000, 2000, 5000].map((val) => (
              <button
                key={val}
                onClick={() => setQuickAmount(val)}
                disabled={!wallet || val > wallet.balance}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                  parseInt(amount) === val
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 disabled:opacity-50'
                }`}
              >
                ₹{val.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Withdraw All */}
          {wallet && wallet.balance > 0 && (
            <button
              onClick={() => setQuickAmount(wallet.balance)}
              className="w-full py-2 rounded-lg text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15"
            >
              Withdraw Full Balance ({formatCurrency(wallet.balance)})
            </button>
          )}
        </div>

        {/* Notes (Optional) */}
        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-xs font-medium">
            Notes <span className="text-muted-foreground">(Optional)</span>
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note for your records..."
            className="rounded-xl text-sm resize-none"
            rows={2}
          />
        </div>

        {/* Summary */}
        {withdrawAmount > 0 && !error && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold">Summary</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Withdrawal Amount</span>
                <span>{formatCurrency(withdrawAmount)}</span>
              </div>
              {processingFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Processing Fee ({PROCESSING_FEE_PERCENT}%)</span>
                  <span className="text-destructive">-{formatCurrency(processingFee)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="font-medium">You'll Receive</span>
                <span className="font-bold text-primary">{formatCurrency(netAmount)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Processing Time Notice */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
          <div className="flex gap-2">
            <span className="material-symbols-outlined text-amber-600 text-lg">schedule</span>
            <div>
              <p className="text-xs font-medium text-amber-700">Processing Time</p>
              <p className="text-[10px] text-amber-600/80 mt-0.5">
                Withdrawals are typically processed within 1-3 business days.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border safe-bottom">
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/merchant-payouts')}
            className="flex-1 h-12 rounded-xl text-sm"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1 h-12 rounded-xl text-sm font-semibold"
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-lg animate-spin mr-2">refresh</span>
                Processing...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg mr-2">payments</span>
                Confirm Withdrawal
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}