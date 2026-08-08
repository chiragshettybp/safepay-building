import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface MerchantResult {
  id: string;
  name: string;
  avatar?: string | null;
  verified: boolean;
  category?: string;
}

export default function NewPayment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [merchantSearch, setMerchantSearch] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantResult | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [merchants, setMerchants] = useState<MerchantResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Clear any stale pending payment data on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('edit')) {
      sessionStorage.removeItem('pendingPayment');
    }
  }, []);

  // Search merchants from Supabase with debounce
  const searchMerchants = useCallback(async (query: string) => {
    if (query.length < 2) {
      setMerchants([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('id, user_id, business_name, logo_url, status, category')
        .eq('status', 'active')
        .ilike('business_name', `%${query}%`)
        .limit(10);

      if (error) throw error;

      const results: MerchantResult[] = (data || []).map((m: any) => ({
        id: m.user_id, // orders.merchant_id references the merchant's auth user id
        name: m.business_name,
        avatar: m.logo_url,
        verified: m.status === 'active',
        category: m.category,
      }));

      setMerchants(results);
    } catch (err) {
      console.error('Error searching merchants:', err);
      toast({
        title: 'Search Error',
        description: 'Failed to search merchants. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  }, [toast]);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (merchantSearch && !selectedMerchant) {
        searchMerchants(merchantSearch);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [merchantSearch, selectedMerchant, searchMerchants]);

  const filteredMerchants = merchants;

  const handleAmountChange = (value: string) => {
    // Only allow numbers and decimal
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setAmount(cleaned);
  };

  const parsedAmount = parseFloat(amount) || 0;
  const isValidAmount = parsedAmount >= 100 && parsedAmount <= 50000;
  const canContinue = selectedMerchant && isValidAmount;

  const handleContinue = () => {
    if (!canContinue || isSubmitting) return;
    
    setIsSubmitting(true);
    
    // Validate amount range
    if (parsedAmount < 100 || parsedAmount > 50000) {
      toast({
        title: 'Invalid Amount',
        description: 'Amount must be between ₹100 and ₹50,000',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    // Validate description length
    if (description.length > 500) {
      toast({
        title: 'Description Too Long',
        description: 'Description must be under 500 characters',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }
    
    // Store payment data in session for review page
    const paymentData = {
      merchantId: selectedMerchant.id,
      merchantName: selectedMerchant.name,
      merchantVerified: selectedMerchant.verified || false,
      amount: parsedAmount,
      description: description.trim(),
      currency: 'INR' as const,
    };
    
    sessionStorage.setItem('pendingPayment', JSON.stringify(paymentData));
    setIsSubmitting(false);
    navigate('/payment/review');
  };

  return (
    <div className="mobile-page flex flex-col">
      {/* Header */}
      <header className="sticky-header bg-card/95 backdrop-blur-sm">
        <div className="sticky-header-content">
          <button 
            onClick={() => navigate(-1)}
            className="back-btn"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">S</div>
            <span className="font-bold text-sm sm:text-base text-foreground">Safepay</span>
          </div>
          <button className="p-2 rounded-full hover:bg-muted active:bg-muted/80 shrink-0">
            <span className="material-symbols-outlined text-[22px]">more_vert</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-4 sm:pt-5 pb-36 sm:pb-40">
        {/* Hero Title */}
        <section className="mb-5 sm:mb-6">
          <h1 className="text-foreground text-xl sm:text-2xl md:text-[28px] font-bold leading-tight">
            New Secure<br />SafePay Payment
          </h1>
          <p className="text-muted-foreground mt-1.5 sm:mt-2 text-xs sm:text-sm">Create a safe transaction protected by Safepay.</p>
        </section>

        {/* Form Card */}
        <div className="bg-card rounded-xl border border-border p-3.5 sm:p-4 md:p-5 flex flex-col gap-4 sm:gap-5">
          {/* Merchant Search */}
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <label className="text-foreground text-xs sm:text-sm font-medium">Who are you paying?</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none text-muted-foreground">
                <span className="material-symbols-outlined text-[20px] sm:text-[22px]">search</span>
              </div>
              <Input
                type="text"
                placeholder="Search merchant name or ID..."
                value={merchantSearch}
                onChange={(e) => {
                  setMerchantSearch(e.target.value);
                  setSelectedMerchant(null);
                  if (e.target.value.length < 2) {
                    setMerchants([]);
                  }
                }}
                className="h-11 sm:h-12 pl-10 sm:pl-11 pr-4 text-sm bg-muted/50 border-0 rounded-xl"
              />
              {isSearching && (
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            
            {/* Search Hint */}
            {merchantSearch.length > 0 && merchantSearch.length < 2 && !selectedMerchant && (
              <p className="text-xs text-muted-foreground px-1">Type at least 2 characters to search...</p>
            )}
            
            {/* No Results */}
            {merchantSearch.length >= 2 && !isSearching && filteredMerchants.length === 0 && !selectedMerchant && (
              <div className="mt-1 p-4 bg-card border border-border rounded-xl text-center">
                <span className="material-symbols-outlined text-muted-foreground text-[32px] mb-2">search_off</span>
                <p className="text-sm text-muted-foreground">No merchants found for "{merchantSearch}"</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
              </div>
            )}
            
            {/* Search Results Dropdown */}
            {filteredMerchants.length > 0 && !selectedMerchant && (
              <div className="mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden max-h-[240px] overflow-y-auto">
                {filteredMerchants.map((merchant) => (
                  <button
                    key={merchant.id}
                    onClick={() => {
                      setSelectedMerchant(merchant);
                      setMerchantSearch(merchant.name);
                      setMerchants([]);
                    }}
                    className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 active:bg-muted border-b border-border last:border-0 text-left"
                  >
                    {merchant.avatar ? (
                      <img src={merchant.avatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-muted-foreground text-[20px]">store</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-semibold text-foreground truncate">{merchant.name}</p>
                        {merchant.verified && (
                          <span className="material-symbols-outlined text-primary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {merchant.category && <span>{merchant.category} • </span>}
                        ID: {merchant.id.slice(0, 8)}...
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {/* Selected Merchant Badge */}
            {selectedMerchant && (
              <div className="flex items-center gap-2 p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
                {selectedMerchant.avatar ? (
                  <img src={selectedMerchant.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <span className="material-symbols-outlined text-muted-foreground text-[16px]">store</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium text-foreground truncate">{selectedMerchant.name}</p>
                    {selectedMerchant.verified && (
                      <span className="material-symbols-outlined text-primary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">ID: {selectedMerchant.id.slice(0, 8)}...</p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedMerchant(null);
                    setMerchantSearch('');
                    setMerchants([]);
                  }}
                  className="p-1 rounded-full hover:bg-muted"
                >
                  <span className="material-symbols-outlined text-[16px] text-muted-foreground">close</span>
                </button>
              </div>
            )}
          </div>

          {/* Amount Field */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-foreground text-sm font-medium">Amount</label>
              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">INR</span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-muted-foreground text-lg font-medium">₹</span>
              </div>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="h-12 pl-9 pr-4 text-lg font-semibold bg-muted/50 border-0 rounded-xl"
              />
            </div>
            <div className="flex justify-between px-1">
              <p className="text-[10px] text-muted-foreground">Limit: ₹100 - ₹50,000</p>
              {amount && !isValidAmount && (
                <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">error</span>
                  {parsedAmount < 100 ? 'Min ₹100 required' : 'Max ₹50,000'}
                </p>
              )}
            </div>
          </div>

          {/* Description Field */}
          <div className="flex flex-col gap-2">
            <label className="text-foreground text-sm font-medium">
              What is this for? <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Textarea
                placeholder="e.g., Web design services for Project X..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                className="min-h-[100px] p-3 text-sm bg-muted/50 border-0 rounded-xl resize-none"
              />
              <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded">
                {description.length}/500
              </div>
            </div>
          </div>

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-2 p-3 bg-primary/5 rounded-xl border border-primary/10">
            <span className="material-symbols-outlined text-primary text-[18px]">lock</span>
            <p className="text-xs text-primary/80 font-medium">Your payment is locked in SafePay until approved.</p>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Action */}
      <div className="bottom-action">
        <div className="max-w-md mx-auto">
          {/* Selected Merchant Preview */}
          {selectedMerchant && parsedAmount > 0 && (
            <div className="flex items-center justify-between px-1 mb-2.5 sm:mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-muted-foreground text-[14px] sm:text-[16px]">store</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground">Paying</span>
                  <span className="text-[11px] sm:text-xs font-semibold text-foreground truncate">{selectedMerchant.name}</span>
                </div>
              </div>
              <span className="text-sm sm:text-base font-bold text-foreground shrink-0">₹{parsedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          
          <Button
            onClick={handleContinue}
            disabled={!canContinue || isSubmitting}
            className="bottom-action-btn bg-primary text-primary-foreground"
          >
            Continue to Review
            <span className="material-symbols-outlined text-[18px] sm:text-[20px]">arrow_forward</span>
          </Button>
        </div>
      </div>

      {/* Material Icons */}
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
    </div>
  );
}
