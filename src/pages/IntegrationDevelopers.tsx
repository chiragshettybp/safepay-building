import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Check, Code2, Copy, KeyRound } from 'lucide-react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { IntegrationTabs } from '@/components/shared/IntegrationTabs';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import { callCheckoutIntegration, getIntegrationId, INTEGRATION_EVENTS, type CheckoutIntegration } from '@/lib/checkoutIntegration';

function CodeBlock({ title, code, copyId, onCopy }: { title: string; code: string; copyId: string; onCopy: (id: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const maxLen = 320;
  const trimmed = code.length > maxLen && !showAll ? code.slice(0, maxLen) + '\n…' : code;
  return (
    <div className="rounded-xl border border-border bg-card mb-4 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <p className="text-xs font-semibold text-muted-foreground">{title}</p>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onCopy(copyId)} title="Copy">
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
      <pre className="p-4 text-xs leading-relaxed overflow-x-auto bg-muted/30">
        <code className="text-foreground">{trimmed}</code>
      </pre>
      {code.length > maxLen && (
        <button onClick={() => setShowAll((s) => !s)} className="w-full py-1.5 text-xs text-primary hover:bg-muted/40">
          {showAll ? 'Show less' : 'Show all'}
        </button>
      )}
    </div>
  );
}

export default function IntegrationDevelopers() {
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [integration, setIntegration] = useState<CheckoutIntegration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/merchant-login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (merchant && merchant.verificationStatus !== 'approved') navigate('/merchant-verify', { replace: true });
  }, [merchant, navigate]);

  const fetchIntegration = useCallback(async () => {
    if (!merchant?.id) return;
    try {
      setIsLoading(true);
      const id = await getIntegrationId(merchant.id);
      const res = await callCheckoutIntegration<{ integration: CheckoutIntegration }>('get-integration', { merchantId: merchant.id, integrationId: id });
      setIntegration(res.integration);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load integration');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    fetchIntegration();
  }, [fetchIntegration]);

  const copy = async (value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('Copy failed');
    }
  };

  if (authLoading || !isAuthenticated || !merchant) return <FullPageLoading />;

  const sdkScript = `<script src="${window.location.origin}/safepay-checkout.js"></script>`;
  const sdkSnippet = `${sdkScript}

<script>
  const checkout = SafepayCheckout({
    publishableKey: 'sp_test_pub_YOUR_KEY',
    sessionId: 'cs_YOUR_SESSION_ID'
  });
  checkout.open({ paymentMode: 'redirect' });
</script>`;

  const nodeSnippet = `import Safepay from '@safepay/checkout';

const safepay = new Safepay('sp_test_secret_YOUR_KEY');

const session = await safepay.checkout.sessions.create({
  merchant_order_id: 'order_123',
  items: [
    { item_name: 'T-Shirt', unit_price: 499, quantity: 2, sku: 'TS-1' },
  ],
  shipping_amount: 40,
  discount_amount: 0,
  tax_amount: 0,
  // metadata, requires_shipping, collect_email supported
});

// Redirect or return to your customer:
res.redirect(session.checkout_url);`;

  const curlSnippet = `curl -X POST https://jcxhagmfbezpgrxdxfvs.supabase.co/functions/v1/checkout-integration \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sp_test_secret_YOUR_KEY" \\
  -H "Idempotency-Key: a4f9b6d2-7c91-4d2a-9f5e-1b8c0d3e6f21" \\
  -d '{
    "action": "api.create-session",
    "merchant_order_id": "order_123",
    "items": [
      { "item_name": "T-Shirt", "unit_price": 499, "quantity": 2 }
    ]
  }'`;

  const webhookVerifySnippet = `// Verify the x-safepay-signature header on incoming webhooks
import { createHmac, timingSafeEqual } from 'crypto';

const signingSecret = 'whsec_YOUR_SIGNING_SECRET';

export function verifySafepaySignature(rawBody, signatureHeader) {
  const [t, v1] = signatureHeader.split(',');
  const timestamp = Number(t.slice(2));
  // Reject payloads older than 5 minutes to prevent replay attacks
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const signedPayload = \`\${timestamp}.\${rawBody}\`;
  const expected = createHmac('sha256', signingSecret)
    .update(signedPayload)
    .digest('hex');

  return timingSafeEqual(Buffer.from(v1.slice(3)), Buffer.from(expected));
}`;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="bg-background border-b border-border">
        <div className="px-4 py-5 sm:px-6">
          <MerchantPageHeader
            title="Developers"
            back={{ fallback: '/merchant/integration', label: 'Back to Integration' }}
          />
        </div>
        <IntegrationTabs />
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-4">
          {isLoading || !integration ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">Your integration</p>
                  <StatusBadge tone="info" label={integration.status} />
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><KeyRound className="h-3 w-3" /> Integration ID</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs">{integration.public_integration_id}</code>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(integration.public_integration_id, 'intid')}>
                      {copied === 'intid' ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-muted-foreground">Name</span>
                  <span className="text-sm">{integration.name}</span>
                </div>
              </div>

              <p className="text-sm font-semibold mb-2">1 · Create a session</p>
              <CodeBlock title="Node.js" code={nodeSnippet} copyId="node" onCopy={(id) => copy(nodeSnippet, id)} />
              <CodeBlock title="cURL" code={curlSnippet} copyId="curl" onCopy={(id) => copy(curlSnippet, id)} />

              <p className="text-sm font-semibold mb-2">2 · Let the customer pay</p>
              <p className="text-xs text-muted-foreground mb-2">
                The session <code className="text-[11px]">checkout_url</code> hosts the SafePay checkout (cards, UPI, netbanking, wallets). You can also embed it with the JS SDK.
              </p>
              <CodeBlock title="Embed with safepay-checkout.js" code={sdkSnippet} copyId="sdk" onCopy={(id) => copy(sdkSnippet, id)} />

              <p className="text-sm font-semibold mb-2">3 · Listen for webhooks</p>
              <CodeBlock title="Signature verification (Node.js)" code={webhookVerifySnippet} copyId="wh" onCopy={(id) => copy(webhookVerifySnippet, id)} />

              <div className="rounded-xl border border-border bg-card p-4 mb-4">
                <p className="text-sm font-semibold mb-2">Events</p>
                <div className="flex flex-wrap gap-1.5">
                  {INTEGRATION_EVENTS.map((ev) => (
                    <span key={ev} className="text-xs bg-muted rounded px-2 py-1 font-mono">{ev}</span>
                  ))}
                  <span className="text-xs bg-muted rounded px-2 py-1 font-mono">webhook.test</span>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <MerchantBottomNav />
    </div>
  );
}
