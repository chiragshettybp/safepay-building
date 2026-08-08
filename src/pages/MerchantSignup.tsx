import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { toast } from '@/hooks/use-toast';

const BUSINESS_CATEGORIES = [
  { value: 'electronics', label: 'Electronics & Gadgets' },
  { value: 'fashion', label: 'Fashion & Apparel' },
  { value: 'home', label: 'Home & Living' },
  { value: 'beauty', label: 'Beauty & Personal Care' },
  { value: 'food', label: 'Food & Beverages' },
  { value: 'health', label: 'Health & Wellness' },
  { value: 'sports', label: 'Sports & Outdoors' },
  { value: 'toys', label: 'Toys & Games' },
  { value: 'books', label: 'Books & Stationery' },
  { value: 'services', label: 'Services' },
  { value: 'general', label: 'General / Other' },
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh',
];

export default function MerchantSignup() {
  const navigate = useNavigate();
  const { signup, isAuthenticated } = useMerchantAuth();

  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessCity, setBusinessCity] = useState('');
  const [businessState, setBusinessState] = useState('');
  const [businessPincode, setBusinessPincode] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate('/merchant-verify', { replace: true });
    return null;
  }

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  }, [password]);

  const getStrengthColor = () => {
    if (passwordStrength <= 1) return 'bg-destructive';
    if (passwordStrength <= 2) return 'bg-orange-500';
    if (passwordStrength <= 3) return 'bg-yellow-500';
    return 'bg-success';
  };

  const getStrengthLabel = () => {
    if (passwordStrength <= 1) return 'Weak';
    if (passwordStrength <= 2) return 'Fair';
    if (passwordStrength <= 3) return 'Good';
    return 'Strong';
  };

  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const isFormValid =
    fullName.trim().length >= 2 &&
    phone.length === 10 &&
    password.length >= 8 &&
    passwordsMatch &&
    businessName.trim().length >= 2 &&
    businessCategory &&
    agreeTerms;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await signup({
      phone: `+91${phone}`,
      password,
      fullName,
      businessName,
      businessCategory,
      gstNumber: gstNumber || undefined,
      businessEmail: businessEmail || undefined,
      businessAddress: businessAddress || undefined,
      businessCity: businessCity || undefined,
      businessState: businessState || undefined,
      businessPincode: businessPincode || undefined,
    });

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      toast({
        title: 'Account Created!',
        description: 'Your merchant account is pending verification.',
      });
      navigate('/merchant-verify', { replace: true });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Google Fonts */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
      />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center h-14 px-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-full">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="ml-2 text-lg font-semibold">Create Merchant Account</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 pb-32">
        <div className="max-w-lg mx-auto">
          {/* Progress Indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div className="flex-1 h-1 rounded-full bg-primary" />
            <div className="flex-1 h-1 rounded-full bg-muted" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information Section */}
            <div className="space-y-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person</span>
                Personal Information
              </h2>

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-12"
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    +91
                  </span>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="pl-12 h-12"
                    maxLength={10}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                {password && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full ${
                            i <= passwordStrength ? getStrengthColor() : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Password strength: <span className="font-medium">{getStrengthLabel()}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`h-12 pr-12 ${
                      confirmPassword && !passwordsMatch ? 'border-destructive' : ''
                    } ${passwordsMatch ? 'border-success' : ''}`}
                  />
                  {confirmPassword && (
                    <span
                      className={`absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-xl ${
                        passwordsMatch ? 'text-success' : 'text-destructive'
                      }`}
                    >
                      {passwordsMatch ? 'check_circle' : 'cancel'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Business Information Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">storefront</span>
                Business Information
              </h2>

              {/* Business Name */}
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  type="text"
                  placeholder="Enter your business name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="h-12"
                />
              </div>

              {/* Business Category */}
              <div className="space-y-2">
                <Label>Business Category *</Label>
                <Select value={businessCategory} onValueChange={setBusinessCategory}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* GST Number (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="gstNumber">
                  GST Number <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Input
                  id="gstNumber"
                  type="text"
                  placeholder="e.g., 22AAAAA0000A1Z5"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  className="h-12"
                  maxLength={15}
                />
              </div>

              {/* Business Email (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="businessEmail">
                  Business Email <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Input
                  id="businessEmail"
                  type="email"
                  placeholder="business@example.com"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  className="h-12"
                />
              </div>
            </div>

            {/* Business Address Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">location_on</span>
                Business Address <span className="text-muted-foreground font-normal text-sm">(Optional)</span>
              </h2>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="businessAddress">Street Address</Label>
                <Input
                  id="businessAddress"
                  type="text"
                  placeholder="Enter street address"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  className="h-12"
                />
              </div>

              {/* City & Pincode */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="businessCity">City</Label>
                  <Input
                    id="businessCity"
                    type="text"
                    placeholder="City"
                    value={businessCity}
                    onChange={(e) => setBusinessCity(e.target.value)}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessPincode">Pincode</Label>
                  <Input
                    id="businessPincode"
                    type="text"
                    placeholder="6-digit"
                    value={businessPincode}
                    onChange={(e) => setBusinessPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="h-12"
                    maxLength={6}
                  />
                </div>
              </div>

              {/* State */}
              <div className="space-y-2">
                <Label>State</Label>
                <Select value={businessState} onValueChange={setBusinessState}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <span className="material-symbols-outlined text-destructive text-lg mt-0.5">error</span>
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Terms Agreement */}
            <div className="flex items-start gap-3 pt-2">
              <Checkbox
                id="terms"
                checked={agreeTerms}
                onCheckedChange={(checked) => setAgreeTerms(checked === true)}
                className="mt-1"
              />
              <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                I agree to the{' '}
                <Link to="/terms-of-service" className="text-primary hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy-policy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                . I understand that my merchant account will be reviewed before activation.
              </Label>
            </div>
          </form>
        </div>
      </main>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <div className="max-w-lg mx-auto space-y-3">
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isLoading}
            className="w-full h-12 text-base font-medium"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Creating Account...
              </span>
            ) : (
              <>
                <span className="material-symbols-outlined mr-2">storefront</span>
                Create Merchant Account
              </>
            )}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/merchant-login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
