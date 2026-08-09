import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/lib/toast';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
} from 'lucide-react';

const SUPABASE_URL = 'https://jcxhagmfbezpgrxdxfvs.supabase.co';
const TOKEN_KEY = 'safepay_auth_token';

export default function ChangePassword() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('One number');
    return errors;
  };

  const passwordErrors = validatePassword(formData.newPassword);
  const passwordsMatch = formData.newPassword === formData.confirmPassword;
  const isFormValid = 
    formData.currentPassword.length > 0 &&
    passwordErrors.length === 0 &&
    passwordsMatch &&
    formData.confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !user?.id) return;

    setIsLoading(true);

    try {
      const token = localStorage.getItem(TOKEN_KEY);
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
          token: token,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      toast({
        title: 'Password Changed',
        description: 'Your password has been updated successfully.',
      });

      navigate('/profile');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to change password',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ArrowLeft className="text-foreground h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-foreground">Change Password</h1>
          </div>
        </div>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        {/* Security Notice */}
        <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
          <ShieldCheck className="text-primary h-5 w-5" />
          <div>
            <p className="text-sm font-medium text-foreground">Keep your account secure</p>
            <p className="text-xs text-muted-foreground mt-1">
              Choose a strong password that you haven't used before. You'll be logged out of other devices after changing your password.
            </p>
          </div>
        </div>

        {/* Current Password */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Current Password</label>
          <div className="relative">
            <input
              type={showPasswords.current ? 'text' : 'password'}
              value={formData.currentPassword}
              onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
              placeholder="Enter current password"
              className="w-full h-12 px-4 pr-12 rounded-xl bg-muted border-0 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPasswords.current ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">New Password</label>
          <div className="relative">
            <input
              type={showPasswords.new ? 'text' : 'password'}
              value={formData.newPassword}
              onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              placeholder="Enter new password"
              className="w-full h-12 px-4 pr-12 rounded-xl bg-muted border-0 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPasswords.new ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          
          {/* Password Requirements */}
          {formData.newPassword.length > 0 && (
            <div className="space-y-1 mt-2">
              {['At least 8 characters', 'One uppercase letter', 'One lowercase letter', 'One number'].map((req) => {
                const isValid = !passwordErrors.includes(req);
                return (
                  <div key={req} className="flex items-center gap-2">
                    {isValid ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Circle className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className={`text-xs ${isValid ? 'text-emerald-500' : 'text-muted-foreground'}`}>{req}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Confirm New Password</label>
          <div className="relative">
            <input
              type={showPasswords.confirm ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="Confirm new password"
              className={`w-full h-12 px-4 pr-12 rounded-xl bg-muted border-0 text-foreground placeholder:text-muted-foreground focus:ring-2 ${
                formData.confirmPassword.length > 0 && !passwordsMatch 
                  ? 'ring-2 ring-destructive focus:ring-destructive' 
                  : 'focus:ring-primary'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPasswords.confirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {formData.confirmPassword.length > 0 && !passwordsMatch && (
            <p className="text-xs text-destructive">Passwords do not match</p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={!isFormValid || isLoading}
            className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-medium transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Lock className="h-5 w-5" />
                Change Password
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
