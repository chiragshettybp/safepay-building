import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Info, Loader2, Lock, ShieldCheck, Store } from 'lucide-react';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import { CheckoutSummary } from '@/components/shared/CheckoutSummary';
import {
  ACCEPTED_PAYMENT_BRANDS,
  PAYMENT_METHOD_BRANDS,
  PaymentBrand,
  PaymentBrandsStrip,
} from '@/components/ui/payment-brands';
import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  callCheckout,
  checkoutMethodLabel,
  CHECKOUT_METHODS,
  getCheckoutSessionToken,
  setCheckoutSessionToken,
  type CheckoutApiError,
  type CreatePaymentResponse,
  type OpenLinkResponse,
} from '@/lib/checkout';

type Step = 'details' | 'payment' | 'result';

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutInstance {
  on: (event: string, handler: (response: RazorpayPaymentResponse) => void) => void;
  open: () => void;
}

type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayCheckoutInstance;

function getRazorpay(): RazorpayCtor | null {
  return (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay ?? null;
}

export default function PublicCheckout() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<OpenLinkResponse | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('details');
  const [terminal, setTerminal] = useState<'expired' | 'cancelled' | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [addrLine1, setAddrLine1] = useState('');
  const [addrLine2, setAddrLine2] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrPincode, setAddrPincode] = useState('');
  const [method, setMethod] = useState<string>('upi');
  const [formError, setFormError] = useState<string | null>(null);

  const [payment, setPayment] = useState<CreatePaymentResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [resumeNotice, setResumeNotice] = useState(false);
  const isSubmittingRef = useRef(false);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      // Open the reusable link: the server validates it and either resumes the
      // caller's own active session (refresh/reopen) or creates a brand-new
      // session. A link that has already been used never blocks a new customer.
      const result = await callCheckout<OpenLinkResponse>('open-link', {
        linkToken: token,
        sessionToken: getCheckoutSessionToken(token),
      });
      setData(result);
      if (result.not_found) {
        setLoadError('This payment link is invalid or has been removed.');
      } else if (result.error === 'LINK_EXPIRED') {
        setTerminal('expired');
      } else if (result.error === 'LINK_NOT_ACTIVE') {
        setTerminal('cancelled');
      } else if (result.error === 'MERCHANT_NOT_ELIGIBLE') {
        setLoadError('This merchant is not currently accepting payments.');
      } else {
        setCheckoutSessionToken(token, result.session.token);
        setSessionToken(result.session.token);
        setName(result.session.guest_name || '');
        setPhone(result.session.guest_phone || '');
        setEmail(result.session.guest_email || '');
        if (result.session.shipping_address) {
          const a = result.session.shipping_address as Record<string, string>;
          setAddrLine1(a.line1 || '');
          setAddrLine2(a.line2 || '');
          setAddrCity(a.city || '');
          setAddrState(a.state || '');
          setAddrPincode(a.pincode || '');
        }
        if (result.session.selected_payment_method) {
          setMethod(result.session.selected_payment_method);
        }
        if (result.session.current_step === 'payment') {
          // A payment step was persisted server-side, but a freshly loaded page
          // has no in-memory payment handle (the modal/transaction is gone).
          // Keep the user on the prefilled details step and let them resume via
          // a fresh create-payment instead of rendering a blank payment view.
          setResumeNotice(true);
          setStep('details');
        }
      }
    } catch (error) {
      setLoadError(error instanceof CheckoutApiError ? error.message : 'Something went wrong while loading this payment link.');
    } finally {
      setIsLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const enabledMethods = useMemo(() => {
    if (!data) return [];
    return CHECKOUT_METHODS.filter((m) => {
      if (m.id === 'upi') return data.config.payment_upi_enabled;
      if (m.id === 'card') return data.config.payment_cards_enabled;
      if (m.id === 'netbanking') return data.config.payment_netbanking_enabled;
      if (m.id === 'wallet') return data.config.payment_wallets_enabled;
      return false;
    });
  }, [data]);

  const validateDetails = (): string | null => {
    if (!data) return 'Payment link not loaded.';
    if (name.trim().length < 2) return 'Please enter your full name.';
    if (!/^(\+91)?[6-9]\d{9}$/.test(phone.replace(/[\s\-()]/g, ''))) return 'Please enter a valid 10-digit mobile number.';
    if (data.config.email_required || data.session.collect_email) {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'A valid email address is required.';
    }
    if (data.session.requires_shipping) {
      if (!addrLine1.trim()) return 'Please enter your address.';
      if (!addrCity.trim()) return 'Please enter your city.';
      if (!addrState.trim()) return 'Please enter your state.';
      if (!/^\d{6}$/.test(addrPincode)) return 'Please enter a valid 6-digit PIN code.';
    }
    if (!method) return 'Please choose a payment method.';
    return null;
  };

  const handleContinue = () => {
    const error = validateDetails();
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    setIsProcessing(true);
    isSubmittingRef.current = true;

    callCheckout<CreatePaymentResponse>('create-payment', {
      token: sessionToken,
      name: name.trim(),
      phone,
      email: email.trim() || undefined,
      method,
      shippingAddress: data!.session.requires_shipping
        ? {
            full_name: name.trim(),
            phone,
            line1: addrLine1.trim(),
            line2: addrLine2.trim() || undefined,
            city: addrCity.trim(),
            state: addrState.trim(),
            pincode: addrPincode.trim(),
            country: 'India',
          }
        : undefined,
    })
      .then((result) => {
        setPayment(result);
        setResumeNotice(false);
        setStep('payment');
      })
      .catch((error: unknown) => {
        if (error instanceof CheckoutApiError && error.code === 'SESSION_EXPIRED') {
          setTerminal('expired');
        } else if (error instanceof CheckoutApiError && error.code === 'SESSION_NOT_ACTIVE') {
          setTerminal('cancelled');
        } else {
          setFormError(error instanceof Error ? error.message : 'Could not start payment. Please try again.');
        }
      })
      .finally(() => {
        setIsProcessing(false);
        isSubmittingRef.current = false;
      });
  };

  const handleVerify = (razorpayParams?: { paymentId: string; orderId: string; signature: string }) => {
    if (!payment || isSubmittingRef.current || !agreedToTerms) return;
    isSubmittingRef.current = true;
    setIsProcessing(true);

    callCheckout<{ success: boolean }>('verify-payment', {
      token: sessionToken,
      transactionId: payment.transactionId,
      razorpayPaymentId: razorpayParams?.paymentId,
      razorpayOrderId: razorpayParams?.orderId,
      razorpaySignature: razorpayParams?.signature,
    })
      .then(() => {
        navigate(`/checkout/${token}/success`, { replace: true });
      })
      .catch((error: unknown) => {
        if (error instanceof CheckoutApiError && error.code === 'SESSION_EXPIRED') {
          setTerminal('expired');
        } else {
          setFormError(error instanceof Error ? error.message : 'Payment verification failed.');
          setStep('details');
          setPayment(null);
        }
      })
      .finally(() => {
        setIsProcessing(false);
        isSubmittingRef.current = false;
      });
  };

  const handleCancelPayment = async () => {
    if (!payment || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await callCheckout('cancel-payment', { token: sessionToken, transactionId: payment.transactionId, reason: 'cancelled_by_customer' });
    } catch {
      // Best effort — the session stays active regardless.
    } finally {
      setPayment(null);
      setStep('details');
      isSubmittingRef.current = false;
    }
  };

  const loadRazorpayAndOpen = async () => {
    if (!payment || payment.mode !== 'razorpay') return;
    if (isSubmittingRef.current || !agreedToTerms) return;
    isSubmittingRef.current = true;
    setIsProcessing(true);

    try {
      await new Promise<void>((resolve, reject) => {
        if (getRazorpay()) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = RAZORPAY_SCRIPT_URL;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load the payment gateway.'));
        document.body.appendChild(script);
      });

      const options = {
        key: payment.keyId,
        amount: Math.round(payment.finalAmount * 100),
        currency: payment.currency,
        name: data?.merchant.business_name || 'SafePay',
        description: 'SafePay secured payment',
        order_id: payment.razorpayOrderId,
        prefill: {
          name,
          email: email || undefined,
          contact: phone,
        },
        theme: { color: '#0ea5e9' },
        handler: (response: RazorpayPaymentResponse) => {
          handleVerify({
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
            signature: response.razorpay_signature,
          });
        },
        modal: {
          ondismiss: async () => {
            await handleCancelPayment();
            setIsProcessing(false);
          },
        },
      };

      const razorpayCtor = getRazorpay();
      if (!razorpayCtor) throw new Error('Failed to load the payment gateway.');
      const razorpay = new razorpayCtor(options);
      razorpay.on('payment.failed', async () => {
        await handleCancelPayment();
        setIsProcessing(false);
      });
      razorpay.open();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'Could not start the payment.');
      await handleCancelPayment();
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <FullPageLoading />;
  }

  if (loadError) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6">
        <AlertCircle className="text-destructive h-12 w-12 mb-4" />
        <h1 className="text-lg font-semibold text-foreground text-center mb-2">Payment link unavailable</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">{loadError}</p>
        <Button variant="outline" onClick={() => navigate('/')}>Go to SafePay</Button>
      </div>
    );
  }

  if (terminal) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6">
        <AlertCircle className="text-warning h-12 w-12 mb-4" />
        <h1 className="text-lg font-semibold text-foreground text-center mb-2">
          {terminal === 'expired' ? 'This payment link has expired' : 'This payment link was cancelled'}
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {terminal === 'expired'
            ? 'The link is no longer valid. Please contact the merchant for a fresh payment link.'
            : 'The merchant has closed this payment link.'}
        </p>
        <Button variant="outline" onClick={() => navigate('/')}>Go to SafePay</Button>
      </div>
    );
  }

  if (!data) return null;

  const detailsView = (
    <div className="flex-1 w-full max-w-md mx-auto px-4 pt-4 pb-32">
      {resumeNotice && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 mb-4">
          <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            You have an unfinished payment on this link. Review your details and continue to resume checkout.
          </p>
        </div>
      )}
      {/* Order summary */}
      <CheckoutSummary
        className="mb-4"
        data={{
          items: data.items,
          subtotal: data.session.subtotal,
          shipping_amount: data.session.shipping_amount,
          discount_amount: data.session.discount_amount,
          tax_amount: data.session.tax_amount,
          service_fee_amount: data.session.service_fee_amount,
          final_amount: data.session.final_amount,
          service_fee_percent: data.config.service_fee_percent,
          currency: data.session.currency,
        }}
      />
      {/* Contact */}
      <div className="bg-card rounded-2xl border border-border p-4 mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Your details</h2>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Full name</Label>
            <Input placeholder="e.g. Priya Sharma" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Mobile number</Label>
            <Input placeholder="98765 43210" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" />
          </div>
          {(data.config.email_required || data.session.collect_email) && (
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Email</Label>
              <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
            </div>
          )}
        </div>
      </div>

      {data.session.requires_shipping && (
        <div className="bg-card rounded-2xl border border-border p-4 mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Shipping address</h2>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Address line 1</Label>
              <Input placeholder="House no, street" value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)} className="h-11" />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Address line 2 (optional)</Label>
              <Input placeholder="Area, landmark" value={addrLine2} onChange={(e) => setAddrLine2(e.target.value)} className="h-11" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">City</Label>
                <Input placeholder="Bengaluru" value={addrCity} onChange={(e) => setAddrCity(e.target.value)} className="h-11" />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">PIN code</Label>
                <Input placeholder="560001" inputMode="numeric" value={addrPincode} onChange={(e) => setAddrPincode(e.target.value)} className="h-11" />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">State</Label>
              <Input placeholder="Karnataka" value={addrState} onChange={(e) => setAddrState(e.target.value)} className="h-11" />
            </div>
          </div>
        </div>
      )}

      {/* Method */}
      <div className="bg-card rounded-2xl border border-border p-4 mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Payment method</h2>
        <div className="space-y-2">
          {enabledMethods.map((m) => {
            const Icon = m.icon;
            const active = method === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-[0.99]',
                  active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
                )}
              >
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', active ? 'bg-primary/10' : 'bg-muted')}>
                  <Icon className={cn('w-5 h-5', active ? 'text-primary' : 'text-muted-foreground')} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className={cn('text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                  {PAYMENT_METHOD_BRANDS[m.id] && (
                    <div className="flex flex-wrap items-center gap-1 max-[380px]:gap-0.5 mt-1.5">
                      {PAYMENT_METHOD_BRANDS[m.id].map((bid) => (
                        <PaymentBrand key={bid} id={bid} />
                      ))}
                    </div>
                  )}
                </div>
                <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0', active ? 'border-primary' : 'border-muted-foreground/30')}>
                  {active && <Check className="w-3 h-3 text-primary" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Trust */}
      <div className="bg-muted/40 rounded-2xl border border-border p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-success" />
          <p className="text-xs font-medium text-foreground">SafePay protects every payment</p>
        </div>
        <PaymentBrandsStrip ids={ACCEPTED_PAYMENT_BRANDS} className="mb-3" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Your money is held in escrow until you confirm delivery. Payments are encrypted and processed securely through a certified gateway.
        </p>
      </div>

      {formError && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5 mb-4">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive">{formError}</p>
        </div>
      )}
    </div>
  );

  const paymentView = payment && (
    <div className="flex-1 w-full max-w-md mx-auto px-4 pt-4 pb-32">
      <div className="bg-card rounded-2xl border border-border p-5 mb-4 text-center">
        <div className={cn('w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center', isProcessing ? 'bg-primary/10' : 'bg-muted')}>
          {isProcessing ? (
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
          ) : payment.mode === 'test' ? (
            <ShieldCheck className="w-7 h-7 text-primary" />
          ) : (
            <Lock className="w-7 h-7 text-primary" />
          )}
        </div>
        <h1 className="text-lg font-semibold text-foreground mb-1">
          {payment.mode === 'test' ? 'Test payment' : 'Complete payment'}
        </h1>
        <p className="text-sm text-muted-foreground mb-3">
          {payment.mode === 'test'
            ? 'This link is in test mode — no real money will move.'
            : `Pay via ${checkoutMethodLabel(method)} through the secure gateway.`}
        </p>
        <p className="text-2xl font-bold text-foreground">{formatAmount(payment.finalAmount)}</p>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-medium text-foreground">Paying via {checkoutMethodLabel(method)}</p>
          {PAYMENT_METHOD_BRANDS[method]?.slice(0, 1).map((bid) => (
            <PaymentBrand key={bid} id={bid} />
          ))}
        </div>
        <CheckoutSummary
          compact
          data={{
            items: data.items,
            subtotal: data.session.subtotal,
            shipping_amount: data.session.shipping_amount,
            discount_amount: data.session.discount_amount,
            tax_amount: data.session.tax_amount,
            service_fee_amount: data.session.service_fee_amount,
            final_amount: data.session.final_amount,
            service_fee_percent: data.config.service_fee_percent,
            currency: data.session.currency,
          }}
        />
      </div>

      {formError && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5 mb-4">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive">{formError}</p>
        </div>
      )}

      <label className="flex items-start gap-3 rounded-xl border border-border p-3 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          disabled={isProcessing}
          className="w-5 h-5 mt-0.5 rounded border-2 accent-primary"
        />
        <div>
          <span className="text-foreground text-sm font-medium">I agree to Terms &amp; Conditions</span>
          <br />
          <span className="text-muted-foreground text-xs">By checking this, you agree to the SafePay policy.</span>
        </div>
      </label>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 h-12" onClick={handleCancelPayment} disabled={isProcessing}>
          Cancel
        </Button>
        <Button
          className="flex-1 h-12"
          onClick={payment.mode === 'test' ? () => handleVerify() : loadRazorpayAndOpen}
          disabled={isProcessing || !agreedToTerms}
        >
          {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
          {payment.mode === 'test' ? 'Complete test payment' : 'Pay now'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border h-14 flex items-center justify-between px-4 safe-top">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            <Store className="w-4 h-4 text-primary" />
            {data.merchant.business_logo_url && (
              <img
                src={data.merchant.business_logo_url}
                alt={`${data.merchant.business_name} logo`}
                className="absolute inset-0 w-full h-full object-cover bg-card"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{data.merchant.business_name}</p>
            <p className="text-[11px] text-muted-foreground">SafePay secured checkout</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-success" />
          Escrow protected
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {step === 'details' ? detailsView : paymentView}

        {step === 'details' && (
          <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-3 z-40 safe-bottom">
            <div className="max-w-md mx-auto flex items-center gap-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Total amount</p>
                <p className="text-lg font-bold text-foreground">{formatAmount(data.session.final_amount)}</p>
              </div>
              <Button className="h-12 px-8 rounded-xl" onClick={handleContinue} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowLeft className="h-4 w-4 mr-2 rotate-180" />}
                Continue
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
