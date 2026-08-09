import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { ArrowLeft, HelpCircle, Lock, TriangleAlert, Trash2, X } from 'lucide-react';

export default function DeleteAccount() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [step, setStep] = useState(1);

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      toast({
        title: 'Confirmation Required',
        description: 'Please type DELETE to confirm account deletion.',
        variant: 'destructive',
      });
      return;
    }

    if (!user?.id) return;

    setIsDeleting(true);

    try {
      // Delete user data (profile will cascade delete related data)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (error) throw error;

      await logout();
      
      toast({
        title: 'Account Deleted',
        description: 'Your account has been permanently deleted.',
      });

      navigate('/customer-login');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete account. Please contact support.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-base font-semibold text-foreground">Delete Account</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {step === 1 && (
          <div className="space-y-6">
            {/* Warning Card */}
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
              <div className="flex gap-3">
                <TriangleAlert className="text-destructive h-5 w-5 shrink-0" />
                <div>
                  <h2 className="font-semibold text-destructive">Warning: This action is permanent</h2>
                  <p className="text-sm text-destructive/80 mt-1">
                    Deleting your account will permanently remove all your data, including orders, wallet balance, and transaction history.
                  </p>
                </div>
              </div>
            </div>

            {/* What will be deleted */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-medium text-foreground mb-3">What will be deleted:</h3>
              <ul className="space-y-2">
                {[
                  'Your profile and personal information',
                  'All order history and transaction records',
                  'Wallet balance and bank accounts',
                  'All disputes and refund records',
                  'KYC documents and verification status',
                  'Support tickets and communications',
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <X className="text-destructive h-[18px] w-[18px] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Alternatives */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-medium text-foreground mb-3">Before you go:</h3>
              <p className="text-sm text-muted-foreground mb-3">
                If you're having issues with your account, consider these alternatives:
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => navigate('/help')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
                >
                  <HelpCircle className="text-primary h-5 w-5" />
                  <span className="text-sm font-medium text-foreground">Contact Support</span>
                </button>
                <button
                  onClick={() => navigate('/change-password')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
                >
                  <Lock className="text-primary h-5 w-5" />
                  <span className="text-sm font-medium text-foreground">Change Password</span>
                </button>
              </div>
            </div>

            <Button
              variant="destructive"
              onClick={() => setStep(2)}
              className="w-full h-12 rounded-xl"
            >
              Continue to Delete Account
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-destructive h-7 w-7" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Confirm Account Deletion</h2>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. Type <strong>DELETE</strong> below to confirm.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Type DELETE to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="DELETE"
                className="w-full h-12 px-4 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-destructive focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1 h-12 rounded-xl"
              >
                Go Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={confirmText !== 'DELETE' || isDeleting}
                className="flex-1 h-12 rounded-xl"
              >
                {isDeleting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </span>
                ) : (
                  'Delete My Account'
                )}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
