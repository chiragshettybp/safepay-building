import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { CheckCircle2, Info, Save } from 'lucide-react';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { ButtonSpinner } from '@/components/shared/LoadingSpinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface BankAccount {
  id: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  branch: string | null;
  account_type: string;
  is_default: boolean;
  verification_status: string;
}

// Common Indian banks with IFSC prefixes
const BANK_IFSC_PREFIXES: Record<string, string> = {
  'SBIN': 'State Bank of India',
  'HDFC': 'HDFC Bank',
  'ICIC': 'ICICI Bank',
  'AXIS': 'Axis Bank',
  'KKBK': 'Kotak Mahindra Bank',
  'PUNB': 'Punjab National Bank',
  'BARB': 'Bank of Baroda',
  'CNRB': 'Canara Bank',
  'UBIN': 'Union Bank of India',
  'IDIB': 'Indian Bank',
  'IOBA': 'Indian Overseas Bank',
  'CBIN': 'Central Bank of India',
  'YESB': 'Yes Bank',
  'INDB': 'IndusInd Bank',
  'FDRL': 'Federal Bank',
  'RATN': 'RBL Bank',
};

export default function MerchantBankAccount() {
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [existingAccount, setExistingAccount] = useState<BankAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [branch, setBranch] = useState('');
  const [accountType, setAccountType] = useState('savings');
  const [isDefault, setIsDefault] = useState(true);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/merchant-login', { replace: true });
    }
    if (!authLoading && merchant && merchant.verificationStatus !== 'approved') {
      navigate('/merchant-verify', { replace: true });
    }
  }, [merchant, isAuthenticated, authLoading, navigate]);

  const fetchExistingAccount = useCallback(async () => {
    if (!merchant?.id) return;

    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('merchant_bank_accounts')
        .select('*')
        .eq('merchant_id', merchant.id)
        .eq('is_default', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching bank account:', error);
      }

      if (data) {
        setExistingAccount(data);
        setAccountHolderName(data.account_holder_name);
        setAccountNumber(data.account_number);
        setConfirmAccountNumber(data.account_number);
        setIfscCode(data.ifsc_code);
        setBankName(data.bank_name);
        setBranch(data.branch || '');
        setAccountType(data.account_type);
        setIsDefault(data.is_default);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    if (merchant?.id) {
      fetchExistingAccount();
    }
  }, [merchant?.id, fetchExistingAccount]);

  // Auto-detect bank name from IFSC
  useEffect(() => {
    if (ifscCode.length >= 4) {
      const prefix = ifscCode.substring(0, 4).toUpperCase();
      const detectedBank = BANK_IFSC_PREFIXES[prefix];
      if (detectedBank && !bankName) {
        setBankName(detectedBank);
      }
    }
  }, [ifscCode, bankName]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!accountHolderName.trim()) {
      newErrors.accountHolderName = 'Account holder name is required';
    } else if (accountHolderName.length < 3) {
      newErrors.accountHolderName = 'Name must be at least 3 characters';
    }

    if (!accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required';
    } else if (!/^\d{9,18}$/.test(accountNumber)) {
      newErrors.accountNumber = 'Enter a valid account number (9-18 digits)';
    }

    if (accountNumber !== confirmAccountNumber) {
      newErrors.confirmAccountNumber = 'Account numbers do not match';
    }

    if (!ifscCode.trim()) {
      newErrors.ifscCode = 'IFSC code is required';
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
      newErrors.ifscCode = 'Enter a valid IFSC code (e.g., SBIN0001234)';
    }

    if (!bankName.trim()) {
      newErrors.bankName = 'Bank name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    if (!merchant?.id) {
      toast.error('Merchant not found');
      return;
    }

    setIsSubmitting(true);

    try {
      const bankData = {
        merchant_id: merchant.id,
        account_holder_name: accountHolderName.trim(),
        account_number: accountNumber.trim(),
        ifsc_code: ifscCode.toUpperCase().trim(),
        bank_name: bankName.trim(),
        branch: branch.trim() || null,
        account_type: accountType,
        is_default: isDefault,
        verification_status: 'pending',
      };

      if (existingAccount) {
        // Update existing account
        const { error } = await supabase
          .from('merchant_bank_accounts')
          .update({
            ...bankData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAccount.id);

        if (error) throw error;
        toast.success('Bank account updated successfully');
      } else {
        // Insert new account
        const { error } = await supabase
          .from('merchant_bank_accounts')
          .insert(bankData);

        if (error) throw error;
        toast.success('Bank account added successfully');
      }

      // Simulate verification (in production, trigger actual verification)
      setTimeout(async () => {
        if (existingAccount?.id) {
          await supabase
            .from('merchant_bank_accounts')
            .update({ 
              verification_status: 'verified',
              verified_at: new Date().toISOString()
            })
            .eq('id', existingAccount.id);
        }
      }, 3000);

      navigate('/merchant-payouts');
    } catch (error: any) {
      console.error('Error saving bank account:', error);
      toast.error(error.message || 'Failed to save bank account');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="px-4 py-5 sm:px-6">
          <MerchantPageHeader
            title={<Skeleton className="h-6 w-32" />}
            back={{ fallback: '/merchant-payouts', label: 'Back to Payouts' }}
          />
        </div>
        <main className="p-4 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ))}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 py-5 sm:px-6">
        <MerchantPageHeader
          title={`${existingAccount ? 'Update' : 'Add'} Bank Account`}
          subtitle="For receiving payouts"
          back={{ fallback: '/merchant-payouts', label: 'Back to Payouts' }}
        />
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Info Banner */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
          <div className="flex gap-2">
            <Info className="h-[18px] w-[18px] text-blue-600" />
            <div>
              <p className="text-xs font-medium text-blue-700">Verification Required</p>
              <p className="text-[10px] text-blue-600/80 mt-0.5">
                Your bank account will undergo verification. Withdrawals are enabled only after verification.
              </p>
            </div>
          </div>
        </div>

        {/* Account Holder Name */}
        <div className="space-y-1.5">
          <Label htmlFor="accountHolderName" className="text-xs font-medium">
            Account Holder Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="accountHolderName"
            value={accountHolderName}
            onChange={(e) => setAccountHolderName(e.target.value)}
            placeholder="Enter name as per bank records"
            className={`h-12 rounded-xl text-sm ${errors.accountHolderName ? 'border-destructive' : ''}`}
          />
          {errors.accountHolderName && (
            <p className="text-[10px] text-destructive">{errors.accountHolderName}</p>
          )}
        </div>

        {/* Account Number */}
        <div className="space-y-1.5">
          <Label htmlFor="accountNumber" className="text-xs font-medium">
            Account Number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="accountNumber"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter account number"
            className={`h-12 rounded-xl text-sm ${errors.accountNumber ? 'border-destructive' : ''}`}
            inputMode="numeric"
            maxLength={18}
          />
          {errors.accountNumber && (
            <p className="text-[10px] text-destructive">{errors.accountNumber}</p>
          )}
        </div>

        {/* Confirm Account Number */}
        <div className="space-y-1.5">
          <Label htmlFor="confirmAccountNumber" className="text-xs font-medium">
            Confirm Account Number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="confirmAccountNumber"
            value={confirmAccountNumber}
            onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="Re-enter account number"
            className={`h-12 rounded-xl text-sm ${errors.confirmAccountNumber ? 'border-destructive' : ''}`}
            inputMode="numeric"
            maxLength={18}
          />
          {errors.confirmAccountNumber && (
            <p className="text-[10px] text-destructive">{errors.confirmAccountNumber}</p>
          )}
          {accountNumber && confirmAccountNumber && accountNumber === confirmAccountNumber && (
            <p className="text-[10px] text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Account numbers match
            </p>
          )}
        </div>

        {/* IFSC Code */}
        <div className="space-y-1.5">
          <Label htmlFor="ifscCode" className="text-xs font-medium">
            IFSC Code <span className="text-destructive">*</span>
          </Label>
          <Input
            id="ifscCode"
            value={ifscCode}
            onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
            placeholder="e.g., SBIN0001234"
            className={`h-12 rounded-xl text-sm uppercase ${errors.ifscCode ? 'border-destructive' : ''}`}
            maxLength={11}
          />
          {errors.ifscCode && (
            <p className="text-[10px] text-destructive">{errors.ifscCode}</p>
          )}
        </div>

        {/* Bank Name */}
        <div className="space-y-1.5">
          <Label htmlFor="bankName" className="text-xs font-medium">
            Bank Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="bankName"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Enter bank name"
            className={`h-12 rounded-xl text-sm ${errors.bankName ? 'border-destructive' : ''}`}
          />
          {errors.bankName && (
            <p className="text-[10px] text-destructive">{errors.bankName}</p>
          )}
        </div>

        {/* Branch (Optional) */}
        <div className="space-y-1.5">
          <Label htmlFor="branch" className="text-xs font-medium">
            Branch <span className="text-muted-foreground">(Optional)</span>
          </Label>
          <Input
            id="branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="Enter branch name"
            className="h-12 rounded-xl text-sm"
          />
        </div>

        {/* Account Type */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Account Type</Label>
          <Select value={accountType} onValueChange={setAccountType}>
            <SelectTrigger className="h-12 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="savings">Savings Account</SelectItem>
              <SelectItem value="current">Current Account</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Set as Default */}
        <div className="flex items-center justify-between bg-card border border-border rounded-xl p-3">
          <div>
            <p className="text-sm font-medium">Set as Default</p>
            <p className="text-[10px] text-muted-foreground">Use for all withdrawals</p>
          </div>
          <Switch checked={isDefault} onCheckedChange={setIsDefault} />
        </div>
      </form>

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
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <ButtonSpinner className="h-[18px] w-[18px] mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-[18px] w-[18px] mr-2" />
                {existingAccount ? 'Update' : 'Save'} Account
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}