import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Camera, User } from 'lucide-react';
import { LoadingSpinner, FullPageLoading, ButtonSpinner } from '@/components/shared/LoadingSpinner';

interface ProfileData {
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
}

export default function ProfileEdit() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<ProfileData>({
    full_name: '',
    email: '',
    avatar_url: null,
    address: '',
    city: '',
    country: 'India',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/customer-login');
    } else if (user) {
      fetchProfile();
    }
  }, [user, authLoading, navigate]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, email, avatar_url, address, city, country')
      .eq('id', user.id)
      .maybeSingle();
    
    if (data) {
      setFormData({
        full_name: data.full_name || '',
        email: data.email || '',
        avatar_url: data.avatar_url,
        address: data.address || '',
        city: data.city || '',
        country: data.country || 'India',
      });
    }
    setLoadingProfile(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: `${publicUrl}?t=${Date.now()}` })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setFormData(prev => ({ ...prev, avatar_url: `${publicUrl}?t=${Date.now()}` }));
      
      toast({
        title: 'Avatar updated!',
        description: 'Your profile photo has been changed.',
      });
    } catch (err) {
      console.error('Avatar upload error:', err);
      toast({
        title: 'Upload failed',
        description: 'Could not upload avatar. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Input validation
    if (formData.full_name && formData.full_name.length > 100) {
      setError('Name is too long (max 100 characters)');
      return;
    }
    if (formData.email && formData.email.length > 255) {
      setError('Email is too long (max 255 characters)');
      return;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (formData.address && formData.address.length > 200) {
      setError('Address is too long (max 200 characters)');
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name?.trim() || null,
          email: formData.email?.trim() || null,
          address: formData.address?.trim() || null,
          city: formData.city?.trim() || null,
          country: formData.country?.trim() || 'India',
        })
        .eq('id', user?.id);

      if (updateError) {
        if (updateError.message.includes('duplicate')) {
          setError('This email is already in use by another account.');
        } else {
          setError('Failed to update profile. Please try again.');
        }
        setIsLoading(false);
        return;
      }

      toast({
        title: 'Profile updated!',
        description: 'Your changes have been saved.',
      });
      navigate('/profile');
    } catch (err) {
      console.error('Update error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || loadingProfile) {
    return <FullPageLoading />;
  }

  return (
    <div className="min-h-[100dvh] bg-background max-w-[100vw] overflow-x-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => navigate('/profile')}
            className="text-foreground flex w-10 h-10 shrink-0 items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-foreground">Edit Profile</h1>
          <div className="w-10"></div>
        </div>
      </header>

      {/* Form Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-28">
        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center mb-6 sm:mb-8">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-primary/10 flex items-center justify-center mb-3 sm:mb-4 relative overflow-hidden">
              {formData.avatar_url ? (
                <img 
                  src={formData.avatar_url} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="text-primary h-10 w-10 sm:h-12 sm:w-12" />
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <LoadingSpinner className="h-6 w-6" />
                </div>
              )}
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
              >
                <Camera className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">Tap to change photo</p>
          </div>

          {/* Full Name */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="fullName" className="text-foreground font-medium text-sm">
              Full Name
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Enter your full name"
              value={formData.full_name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              className="h-12 sm:h-14 rounded-xl bg-surface text-base"
              maxLength={100}
            />
          </div>

          {/* Phone (Read-only) */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label className="text-foreground font-medium text-sm">
              Phone Number
            </Label>
            <div className="h-12 sm:h-14 rounded-xl bg-muted flex items-center px-4 text-muted-foreground text-sm sm:text-base">
              <span className="truncate flex-1">{user?.phone}</span>
              <span className="ml-2 text-[10px] sm:text-xs bg-success/10 text-success px-2 py-1 rounded-full shrink-0">
                Verified
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Phone number cannot be changed.
            </p>
          </div>

          {/* Email */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="email" className="text-foreground font-medium text-sm">
              Email Address <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={formData.email || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="h-12 sm:h-14 rounded-xl bg-surface text-base"
              maxLength={255}
            />
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Email is used for receipts and notifications only. Not used for login.
            </p>
          </div>

          {/* Address */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="address" className="text-foreground font-medium text-sm">
              Address <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="address"
              type="text"
              placeholder="Enter your address"
              value={formData.address || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="h-12 sm:h-14 rounded-xl bg-surface text-base"
              maxLength={200}
            />
          </div>

          {/* City */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="city" className="text-foreground font-medium text-sm">
              City <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="city"
              type="text"
              placeholder="Enter your city"
              value={formData.city || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
              className="h-12 sm:h-14 rounded-xl bg-surface text-base"
              maxLength={100}
            />
          </div>

          {/* Country */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="country" className="text-foreground font-medium text-sm">
              Country
            </Label>
            <Input
              id="country"
              type="text"
              placeholder="Enter your country"
              value={formData.country || 'India'}
              onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
              className="h-12 sm:h-14 rounded-xl bg-surface text-base"
              maxLength={100}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-destructive text-sm font-medium">{error}</p>
            </div>
          )}
        </form>
      </main>

      {/* Sticky Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <div className="max-w-2xl mx-auto">
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full h-12 sm:h-14 rounded-xl text-base font-semibold"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <ButtonSpinner className="h-5 w-5" />
                Saving...
              </span>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
