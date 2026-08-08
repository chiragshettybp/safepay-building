import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// Generate PDF receipt
const generateReceiptPDF = (transaction: Transaction): void => {
  const currencySymbol = transaction.currency === 'INR' ? '₹' : '$';
  const formattedAmount = `${currencySymbol}${transaction.amount.toLocaleString('en-IN')}`;
  const formattedDate = format(new Date(transaction.created_at), 'MMMM d, yyyy h:mm a');
  
  // Create PDF content using HTML
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Receipt - ${transaction.id}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; padding: 40px; }
        .receipt { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 32px; text-align: center; }
        .logo { font-size: 28px; font-weight: bold; margin-bottom: 8px; }
        .tagline { font-size: 12px; opacity: 0.9; }
        .success-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; margin-top: 16px; font-size: 14px; font-weight: 600; }
        .amount-section { padding: 32px; text-align: center; border-bottom: 1px dashed #e5e5e5; }
        .amount-label { color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .amount { font-size: 42px; font-weight: bold; color: #1a1a1a; }
        .details { padding: 24px 32px; }
        .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: #666; font-size: 14px; }
        .detail-value { color: #1a1a1a; font-size: 14px; font-weight: 500; text-align: right; max-width: 60%; word-break: break-all; }
        .footer { padding: 24px 32px; background: #fafafa; text-align: center; }
        .footer-text { color: #999; font-size: 11px; line-height: 1.6; }
        .secure-badge { display: inline-flex; align-items: center; gap: 4px; color: #22c55e; font-size: 12px; font-weight: 500; margin-top: 12px; }
        @media print { body { padding: 0; background: white; } .receipt { box-shadow: none; } }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <div class="logo">🛡️ Safepay</div>
          <div class="tagline">Secure SafePay Payments</div>
          <div class="success-badge">✓ Payment Successful</div>
        </div>
        <div class="amount-section">
          <div class="amount-label">Amount Paid</div>
          <div class="amount">${formattedAmount}</div>
        </div>
        <div class="details">
          <div class="detail-row">
            <span class="detail-label">Transaction ID</span>
            <span class="detail-value">${transaction.id.slice(0, 8)}...${transaction.id.slice(-4)}</span>
          </div>
          ${transaction.razorpay_payment_id ? `
          <div class="detail-row">
            <span class="detail-label">Payment ID</span>
            <span class="detail-value">${transaction.razorpay_payment_id}</span>
          </div>
          ` : ''}
          <div class="detail-row">
            <span class="detail-label">Date & Time</span>
            <span class="detail-value">${formattedDate}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Currency</span>
            <span class="detail-value">${transaction.currency}</span>
          </div>
          ${transaction.customer_name ? `
          <div class="detail-row">
            <span class="detail-label">Customer Name</span>
            <span class="detail-value">${transaction.customer_name}</span>
          </div>
          ` : ''}
          <div class="detail-row">
            <span class="detail-label">Phone</span>
            <span class="detail-value">${transaction.customer_phone}</span>
          </div>
          ${transaction.customer_email ? `
          <div class="detail-row">
            <span class="detail-label">Email</span>
            <span class="detail-value">${transaction.customer_email}</span>
          </div>
          ` : ''}
        </div>
        <div class="footer">
          <div class="footer-text">
            This is a computer-generated receipt and does not require a signature.<br>
            For any queries, please contact support@safepay.com
          </div>
          <div class="secure-badge">🔒 Secured by Safepay</div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Create blob and download
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  // Open in new window for printing/saving as PDF
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  } else {
    // Fallback: download as HTML
    const link = document.createElement('a');
    link.href = url;
    link.download = `safepay-receipt-${transaction.id.slice(0, 8)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  URL.revokeObjectURL(url);
};

interface Transaction {
  id: string;
  customer_id: string;
  order_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  amount: number;
  currency: string;
  status: string;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export default function TransactionDetail() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !transactionId) return;

    const fetchTransaction = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('id', transactionId)
          .eq('customer_id', user.id)
          .single();

        if (error) throw error;
        setTransaction(data);
      } catch (error) {
        console.error('Error fetching transaction:', error);
        toast({
          title: 'Error',
          description: 'Failed to load transaction details',
          variant: 'destructive',
        });
        navigate('/transactions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransaction();
  }, [user?.id, transactionId, navigate, toast]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-success/10 text-success border-success/20 text-sm px-3 py-1">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="text-sm px-3 py-1">Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="text-sm px-3 py-1">Pending</Badge>;
      default:
        return <Badge variant="outline" className="text-sm px-3 py-1">{status}</Badge>;
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: `${label} copied to clipboard`,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border h-14 flex items-center px-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted">
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <Skeleton className="h-5 w-40 ml-4" />
        </header>
        <main className="flex-1 w-full max-w-md mx-auto px-4 py-6">
          <div className="space-y-4">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <span className="material-symbols-outlined text-muted-foreground text-[48px] mb-4">error</span>
        <p className="text-foreground font-medium">Transaction not found</p>
        <Link to="/transactions" className="text-primary text-sm mt-2">Go to Transactions</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border h-14 flex items-center justify-between px-4">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted"
        >
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>
        <span className="font-semibold text-foreground">Transaction Details</span>
        <div className="w-10" />
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-6 pb-32">
        {/* Status Card */}
        <div className="bg-card rounded-2xl border border-border p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            {getStatusBadge(transaction.status)}
            <span className="text-muted-foreground text-xs">
              {format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}
            </span>
          </div>
          <div className="text-center py-4">
            <span className="text-muted-foreground text-sm">Amount</span>
            <h2 className="text-3xl font-bold text-foreground mt-1">
              {transaction.currency === 'INR' ? '₹' : '$'}{transaction.amount.toLocaleString('en-IN')}
            </h2>
          </div>
          {transaction.failure_reason && (
            <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <p className="text-destructive text-sm font-medium">Failure Reason:</p>
              <p className="text-destructive/80 text-xs mt-1">{transaction.failure_reason}</p>
            </div>
          )}
        </div>

        {/* Transaction IDs */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold text-foreground">Transaction IDs</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <span className="text-muted-foreground text-xs block">Internal ID</span>
                <span className="text-foreground text-sm font-mono truncate block">{transaction.id}</span>
              </div>
              <button
                onClick={() => copyToClipboard(transaction.id, 'Transaction ID')}
                className="p-2 hover:bg-muted rounded-lg shrink-0"
              >
                <span className="material-symbols-outlined text-muted-foreground text-[18px]">content_copy</span>
              </button>
            </div>
            
            {transaction.razorpay_order_id && (
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <span className="text-muted-foreground text-xs block">Razorpay Order ID</span>
                  <span className="text-foreground text-sm font-mono truncate block">{transaction.razorpay_order_id}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(transaction.razorpay_order_id!, 'Order ID')}
                  className="p-2 hover:bg-muted rounded-lg shrink-0"
                >
                  <span className="material-symbols-outlined text-muted-foreground text-[18px]">content_copy</span>
                </button>
              </div>
            )}
            
            {transaction.razorpay_payment_id && (
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <span className="text-muted-foreground text-xs block">Razorpay Payment ID</span>
                  <span className="text-foreground text-sm font-mono truncate block">{transaction.razorpay_payment_id}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(transaction.razorpay_payment_id!, 'Payment ID')}
                  className="p-2 hover:bg-muted rounded-lg shrink-0"
                >
                  <span className="material-symbols-outlined text-muted-foreground text-[18px]">content_copy</span>
                </button>
              </div>
            )}

            {transaction.razorpay_signature && (
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <span className="text-muted-foreground text-xs block">Payment Signature</span>
                  <span className="text-foreground text-sm font-mono truncate block">{transaction.razorpay_signature.slice(0, 32)}...</span>
                </div>
                <button
                  onClick={() => copyToClipboard(transaction.razorpay_signature!, 'Signature')}
                  className="p-2 hover:bg-muted rounded-lg shrink-0"
                >
                  <span className="material-symbols-outlined text-muted-foreground text-[18px]">content_copy</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Customer Details */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold text-foreground">Customer Details</h3>
          </div>
          <div className="p-4 space-y-3">
            {transaction.customer_name && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Name</span>
                <span className="text-foreground text-sm font-medium">{transaction.customer_name}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Phone</span>
              <span className="text-foreground text-sm font-medium">{transaction.customer_phone}</span>
            </div>
            {transaction.customer_email && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Email</span>
                <span className="text-foreground text-sm font-medium">{transaction.customer_email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payment Details */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold text-foreground">Payment Details</h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Amount</span>
              <span className="text-foreground text-sm font-medium">
                {transaction.currency === 'INR' ? '₹' : '$'}{transaction.amount.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Currency</span>
              <span className="text-foreground text-sm font-medium">{transaction.currency}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Created</span>
              <span className="text-foreground text-sm font-medium">
                {format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Updated</span>
              <span className="text-foreground text-sm font-medium">
                {format(new Date(transaction.updated_at), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 pb-6 z-40">
        <div className="max-w-md mx-auto flex flex-col gap-3">
          {transaction.status === 'success' && (
            <Button 
              onClick={() => generateReceiptPDF(transaction)}
              className="w-full h-12 rounded-xl"
            >
              <span className="material-symbols-outlined mr-2 text-[18px]">download</span>
              Download Receipt
            </Button>
          )}
          <div className="flex gap-3">
            <Link to="/transactions" className="flex-1">
              <Button variant="outline" className="w-full h-12 rounded-xl">
                <span className="material-symbols-outlined mr-2 text-[18px]">list</span>
                All Transactions
              </Button>
            </Link>
            {transaction.status === 'failed' && (
              <Link to="/payment/new" className="flex-1">
                <Button className="w-full h-12 rounded-xl">
                  <span className="material-symbols-outlined mr-2 text-[18px]">refresh</span>
                  Retry Payment
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Material Icons */}
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
    </div>
  );
}
