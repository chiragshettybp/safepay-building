import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, Building, CheckCircle, Clock, AlertCircle, 
  Shield, Trash2, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BankAccount {
  id: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  account_type: string;
  is_default: boolean;
  verification_status: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

const bankNameFromIFSC: Record<string, string> = {
  'HDFC': 'HDFC Bank',
  'ICIC': 'ICICI Bank',
  'SBIN': 'State Bank of India',
  'UTIB': 'Axis Bank',
  'KKBK': 'Kotak Mahindra Bank',
  'PUNB': 'Punjab National Bank',
  'BARB': 'Bank of Baroda',
  'CNRB': 'Canara Bank',
  'UBIN': 'Union Bank of India',
  'IOBA': 'Indian Overseas Bank',
};

export default function BankAccount() {
  const { accountId } = useParams<{ accountId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditMode = !!accountId;

  const [formData, setFormData] = useState({
    account_holder_name: '',
    account_number: '',
    confirm_account_number: '',
    ifsc_code: '',
    bank_name: '',
    account_type: 'savings',
    is_default: false,
  });
  const [existingAccount, setExistingAccount] = useState<BankAccount | null>(null);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEditMode && accountId) {
      fetchAccount();
    }
  }, [accountId, isEditMode]);

  const fetchAccount = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('id', accountId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        navigate('/wallet');
        return;
      }

      setExistingAccount(data);
      setFormData({
        account_holder_name: data.account_holder_name,
        account_number: data.account_number,
        confirm_account_number: data.account_number,
        ifsc_code: data.ifsc_code,
        bank_name: data.bank_name,
        account_type: data.account_type,
        is_default: data.is_default,
      });
    } catch (error) {
      console.error('Error fetching account:', error);
      toast({ title: 'Error', description: 'Failed to load bank account', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleIFSCChange = (value: string) => {
    const ifsc = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
    setFormData(prev => ({ ...prev, ifsc_code: ifsc }));

    // Auto-detect bank name
    if (ifsc.length >= 4) {
      const prefix = ifsc.slice(0, 4);
      const detectedBank = bankNameFromIFSC[prefix];
      if (detectedBank) {
        setFormData(prev => ({ ...prev, bank_name: detectedBank }));
      }
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.account_holder_name.trim()) {
      newErrors.account_holder_name = 'Account holder name is required';
    }

    if (!formData.account_number.trim()) {
      newErrors.account_number = 'Account number is required';
    } else if (formData.account_number.length < 9 || formData.account_number.length > 18) {
      newErrors.account_number = 'Account number must be 9-18 digits';
    }

    if (!isEditMode && formData.account_number !== formData.confirm_account_number) {
      newErrors.confirm_account_number = 'Account numbers do not match';
    }

    if (!formData.ifsc_code.trim()) {
      newErrors.ifsc_code = 'IFSC code is required';
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifsc_code)) {
      newErrors.ifsc_code = 'Invalid IFSC code format';
    }

    if (!formData.bank_name.trim()) {
      newErrors.bank_name = 'Bank name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !user?.id) return;

    setIsSaving(true);

    try {
      // If setting as default, unset other defaults first
      if (formData.is_default) {
        await supabase
          .from('bank_accounts')
          .update({ is_default: false })
          .eq('customer_id', user.id);
      }

      const accountData = {
        customer_id: user.id,
        account_holder_name: formData.account_holder_name.trim(),
        account_number: formData.account_number.trim(),
        ifsc_code: formData.ifsc_code.trim(),
        bank_name: formData.bank_name.trim(),
        account_type: formData.account_type,
        is_default: formData.is_default,
      };

      if (isEditMode && accountId) {
        const { error } = await supabase
          .from('bank_accounts')
          .update(accountData)
          .eq('id', accountId);

        if (error) throw error;
        toast({ title: 'Success', description: 'Bank account updated successfully' });
      } else {
        const { error } = await supabase
          .from('bank_accounts')
          .insert(accountData);

        if (error) throw error;
        toast({ title: 'Success', description: 'Bank account added successfully' });
      }

      navigate('/wallet');
    } catch (error: any) {
      console.error('Error saving bank account:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to save bank account', 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!accountId || !confirm('Are you sure you want to delete this bank account?')) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;
      toast({ title: 'Success', description: 'Bank account deleted' });
      navigate('/wallet');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({ title: 'Error', description: 'Failed to delete account', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/wallet')} className="p-2 -ml-2 rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-foreground">
            {isEditMode ? 'Edit Bank Account' : 'Add Bank Account'}
          </h1>
          <div className="w-9" />
        </div>
      </header>

      {/* Verification Status (Edit mode only) */}
      {isEditMode && existingAccount && (
        <div className={`px-4 py-3 flex items-center gap-3 ${
          existingAccount.verification_status === 'verified' 
            ? 'bg-success/10' 
            : 'bg-warning/10'
        }`}>
          {existingAccount.verification_status === 'verified' ? (
            <>
              <CheckCircle className="w-5 h-5 text-success" />
              <div>
                <p className="text-sm font-medium text-success">Verified Account</p>
                <p className="text-xs text-muted-foreground">Your bank account has been verified</p>
              </div>
            </>
          ) : (
            <>
              <Clock className="w-5 h-5 text-warning" />
              <div>
                <p className="text-sm font-medium text-warning">Pending Verification</p>
                <p className="text-xs text-muted-foreground">Your bank account is being verified</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-4">
        {/* Account Holder Name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Account Holder Name
          </label>
          <input
            type="text"
            value={formData.account_holder_name}
            onChange={(e) => setFormData(prev => ({ ...prev, account_holder_name: e.target.value }))}
            placeholder="As per bank records"
            className={`w-full h-12 px-4 rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
              errors.account_holder_name ? 'border-destructive' : 'border-border'
            }`}
          />
          {errors.account_holder_name && (
            <p className="text-xs text-destructive mt-1">{errors.account_holder_name}</p>
          )}
        </div>

        {/* Account Number */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Account Number
          </label>
          <input
            type="text"
            value={formData.account_number}
            onChange={(e) => setFormData(prev => ({ ...prev, account_number: e.target.value.replace(/\D/g, '') }))}
            placeholder="Enter account number"
            maxLength={18}
            className={`w-full h-12 px-4 rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
              errors.account_number ? 'border-destructive' : 'border-border'
            }`}
          />
          {errors.account_number && (
            <p className="text-xs text-destructive mt-1">{errors.account_number}</p>
          )}
        </div>

        {/* Confirm Account Number (only for new accounts) */}
        {!isEditMode && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Confirm Account Number
            </label>
            <input
              type="text"
              value={formData.confirm_account_number}
              onChange={(e) => setFormData(prev => ({ ...prev, confirm_account_number: e.target.value.replace(/\D/g, '') }))}
              placeholder="Re-enter account number"
              maxLength={18}
              className={`w-full h-12 px-4 rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                errors.confirm_account_number ? 'border-destructive' : 'border-border'
              }`}
            />
            {errors.confirm_account_number && (
              <p className="text-xs text-destructive mt-1">{errors.confirm_account_number}</p>
            )}
          </div>
        )}

        {/* IFSC Code */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            IFSC Code
          </label>
          <input
            type="text"
            value={formData.ifsc_code}
            onChange={(e) => handleIFSCChange(e.target.value)}
            placeholder="e.g., HDFC0001234"
            maxLength={11}
            className={`w-full h-12 px-4 rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase ${
              errors.ifsc_code ? 'border-destructive' : 'border-border'
            }`}
          />
          {errors.ifsc_code && (
            <p className="text-xs text-destructive mt-1">{errors.ifsc_code}</p>
          )}
        </div>

        {/* Bank Name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Bank Name
          </label>
          <input
            type="text"
            value={formData.bank_name}
            onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
            placeholder="Auto-detected from IFSC or enter manually"
            className={`w-full h-12 px-4 rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
              errors.bank_name ? 'border-destructive' : 'border-border'
            }`}
          />
          {errors.bank_name && (
            <p className="text-xs text-destructive mt-1">{errors.bank_name}</p>
          )}
        </div>

        {/* Account Type */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Account Type
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, account_type: 'savings' }))}
              className={`flex-1 h-12 rounded-xl border font-medium text-sm transition-colors ${
                formData.account_type === 'savings'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-foreground hover:bg-muted'
              }`}
            >
              Savings
            </button>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, account_type: 'current' }))}
              className={`flex-1 h-12 rounded-xl border font-medium text-sm transition-colors ${
                formData.account_type === 'current'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-foreground hover:bg-muted'
              }`}
            >
              Current
            </button>
          </div>
        </div>

        {/* Default Account Toggle */}
        <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Set as Default</p>
              <p className="text-xs text-muted-foreground">Refunds will be credited here</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, is_default: !prev.is_default }))}
            className={`w-12 h-7 rounded-full transition-colors ${
              formData.is_default ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
              formData.is_default ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* Info Notice */}
        <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Your bank account details will be verified. This usually takes 1-2 business days. 
            You'll receive a notification once verified.
          </p>
        </div>

        {/* Delete Button (Edit mode only) */}
        {isEditMode && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full h-12 flex items-center justify-center gap-2 text-destructive font-medium rounded-xl border border-destructive/30 hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Trash2 className="w-5 h-5" />
                Delete Bank Account
              </>
            )}
          </button>
        )}
      </form>

      {/* Sticky Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-6 z-40">
        <Button
          onClick={handleSubmit}
          disabled={isSaving}
          className="w-full h-12 rounded-xl font-semibold"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Building className="w-5 h-5 mr-2" />
              {isEditMode ? 'Update Bank Account' : 'Save Bank Account'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
