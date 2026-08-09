import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/toast';
import { ArrowLeft, Info, MapPin, Phone, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FullPageLoading, ButtonSpinner } from '@/components/shared/LoadingSpinner';

interface MerchantFormData {
  business_name: string;
  business_category: string;
  business_email: string;
  business_phone: string;
  business_address: string;
  business_city: string;
  business_state: string;
  business_pincode: string;
  gst_number: string;
}

const CATEGORIES = [
  'general', 'electronics', 'fashion', 'food', 'health', 'beauty',
  'home', 'sports', 'books', 'toys', 'automotive', 'services', 'other'
];

export default function MerchantProfileEdit() {
  const { user, merchant, isLoading: authLoading } = useMerchantAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<MerchantFormData>({
    business_name: '',
    business_category: 'general',
    business_email: '',
    business_phone: '',
    business_address: '',
    business_city: '',
    business_state: '',
    business_pincode: '',
    gst_number: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/merchant-login');
    } else if (merchant?.id) {
      fetchMerchantData();
    }
  }, [user, authLoading, merchant?.id, navigate]);

  const fetchMerchantData = async () => {
    if (!merchant?.id) return;

    const { data, error } = await supabase
      .from('merchants')
      .select('business_name, business_category, business_email, business_phone, business_address, business_city, business_state, business_pincode, gst_number')
      .eq('id', merchant.id)
      .maybeSingle();

    if (data) {
      setFormData({
        business_name: data.business_name || '',
        business_category: data.business_category || 'general',
        business_email: data.business_email || '',
        business_phone: data.business_phone || '',
        business_address: data.business_address || '',
        business_city: data.business_city || '',
        business_state: data.business_state || '',
        business_pincode: data.business_pincode || '',
        gst_number: data.gst_number || '',
      });
    }
    setLoadingProfile(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.business_name.trim()) {
      setError('Business name is required');
      return;
    }
    if (formData.business_name.length > 100) {
      setError('Business name is too long (max 100 characters)');
      return;
    }
    if (formData.business_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.business_email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (formData.business_pincode && !/^\d{6}$/.test(formData.business_pincode)) {
      setError('Pincode must be 6 digits');
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('merchants')
        .update({
          business_name: formData.business_name.trim(),
          business_category: formData.business_category,
          business_email: formData.business_email.trim() || null,
          business_phone: formData.business_phone.trim() || null,
          business_address: formData.business_address.trim() || null,
          business_city: formData.business_city.trim() || null,
          business_state: formData.business_state.trim() || null,
          business_pincode: formData.business_pincode.trim() || null,
          gst_number: formData.gst_number.trim() || null,
        })
        .eq('id', merchant?.id);

      if (updateError) {
        setError('Failed to update profile. Please try again.');
        setIsLoading(false);
        return;
      }

      toast({
        title: 'Profile updated!',
        description: 'Your business details have been saved. Changes will reflect across the platform.',
      });
      navigate('/merchant-profile');
    } catch (err) {
      console.error('Update error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = (field: keyof MerchantFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (authLoading || loadingProfile) {
    return <FullPageLoading />;
  }

  return (
    <div className="mobile-page">
      {/* Header */}
      <header className="sticky-header bg-card">
        <div className="sticky-header-content px-4 sm:px-6">
          <button
            onClick={() => navigate('/merchant-profile')}
            className="back-btn"
          >
            <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <h1 className="text-sm sm:text-base font-semibold text-foreground">Edit Business Profile</h1>
          <div className="w-10"></div>
        </div>
      </header>

      {/* Form Content */}
      <main className="max-w-2xl mx-auto mobile-section pb-28 sm:pb-24">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Business Name */}
          <div className="space-y-1.5">
            <Label htmlFor="businessName" className="text-foreground font-medium text-xs sm:text-sm">
              Business Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="businessName"
              type="text"
              placeholder="Enter your business name"
              value={formData.business_name}
              onChange={(e) => updateField('business_name', e.target.value)}
              className="h-11 sm:h-12 rounded-xl bg-muted/50 border-0 text-sm sm:text-base"
              maxLength={100}
            />
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              This name is visible to customers during payments.
            </p>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="category" className="text-foreground font-medium text-xs sm:text-sm">
              Business Category
            </Label>
            <select
              id="category"
              value={formData.business_category}
              onChange={(e) => updateField('business_category', e.target.value)}
              className="w-full h-11 sm:h-12 rounded-xl bg-muted/50 border-0 text-sm sm:text-base px-3 text-foreground"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat} className="capitalize">
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* GST Number */}
          <div className="space-y-1.5">
            <Label htmlFor="gst" className="text-foreground font-medium text-xs sm:text-sm">
              GST Number <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="gst"
              type="text"
              placeholder="e.g., 22AAAAA0000A1Z5"
              value={formData.gst_number}
              onChange={(e) => updateField('gst_number', e.target.value.toUpperCase())}
              className="h-11 sm:h-12 rounded-xl bg-muted/50 border-0 text-sm sm:text-base font-mono"
              maxLength={15}
            />
          </div>

          {/* Divider */}
          <div className="pt-2 pb-1">
            <p className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-primary" />
              Contact Details
            </p>
          </div>

          {/* Business Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-foreground font-medium text-xs sm:text-sm">
              Business Phone
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs sm:text-sm">+91</span>
              <Input
                id="phone"
                type="tel"
                placeholder="Enter business phone"
                value={formData.business_phone}
                onChange={(e) => updateField('business_phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="h-11 sm:h-12 rounded-xl bg-muted/50 border-0 text-sm sm:text-base pl-11"
                maxLength={10}
              />
            </div>
          </div>

          {/* Business Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-foreground font-medium text-xs sm:text-sm">
              Business Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="business@example.com"
              value={formData.business_email}
              onChange={(e) => updateField('business_email', e.target.value)}
              className="h-11 sm:h-12 rounded-xl bg-muted/50 border-0 text-sm sm:text-base"
              maxLength={255}
            />
          </div>

          {/* Divider */}
          <div className="pt-2 pb-1">
            <p className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              Business Address
            </p>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-foreground font-medium text-xs sm:text-sm">
              Street Address
            </Label>
            <Input
              id="address"
              type="text"
              placeholder="Enter street address"
              value={formData.business_address}
              onChange={(e) => updateField('business_address', e.target.value)}
              className="h-11 sm:h-12 rounded-xl bg-muted/50 border-0 text-sm sm:text-base"
              maxLength={200}
            />
          </div>

          {/* City & State */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="city" className="text-foreground font-medium text-xs sm:text-sm">City</Label>
              <Input
                id="city"
                type="text"
                placeholder="City"
                value={formData.business_city}
                onChange={(e) => updateField('business_city', e.target.value)}
                className="h-11 sm:h-12 rounded-xl bg-muted/50 border-0 text-sm sm:text-base"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state" className="text-foreground font-medium text-xs sm:text-sm">State</Label>
              <Input
                id="state"
                type="text"
                placeholder="State"
                value={formData.business_state}
                onChange={(e) => updateField('business_state', e.target.value)}
                className="h-11 sm:h-12 rounded-xl bg-muted/50 border-0 text-sm sm:text-base"
                maxLength={100}
              />
            </div>
          </div>

          {/* Pincode */}
          <div className="space-y-1.5">
            <Label htmlFor="pincode" className="text-foreground font-medium text-xs sm:text-sm">Pincode</Label>
            <Input
              id="pincode"
              type="text"
              placeholder="6-digit pincode"
              value={formData.business_pincode}
              onChange={(e) => updateField('business_pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="h-11 sm:h-12 rounded-xl bg-muted/50 border-0 text-sm sm:text-base"
              maxLength={6}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-destructive text-xs sm:text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Info Note */}
          <div className="flex items-start gap-2.5 p-3 bg-primary/5 border border-primary/10 rounded-xl">
            <Info className="h-4 w-4 text-primary mt-0.5" />
            <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
              Changes to your business name will be reflected on all customer-facing pages including the payment flow and order details.
            </p>
          </div>
        </form>
      </main>

      {/* Sticky Submit */}
      <div className="bottom-action">
        <div className="max-w-2xl mx-auto">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !formData.business_name.trim()}
            className="bottom-action-btn bg-primary text-primary-foreground"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <ButtonSpinner className="h-4 w-4" />
                Saving...
              </span>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
