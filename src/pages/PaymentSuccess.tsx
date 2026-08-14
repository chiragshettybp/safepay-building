import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import { PaymentSuccessAnimation } from '@/components/ui/payment-success-animation';

interface SuccessData {
  orderId: string;
  orderNumber: string;
  publicOrderId?: string;
  merchantName: string;
  amount: number;
  currency: string;
}

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const navigatedRef = useRef(false);

  // The success flag is only written after the payment was genuinely verified
  // and the order/transaction were persisted (see PaymentReview). It is kept in
  // sessionStorage until we actually leave, so refreshing mid-animation recovers
  // and never treats a completed payment as unpaid.
  useEffect(() => {
    const stored = sessionStorage.getItem('paymentSuccess');
    if (!stored) {
      navigate('/dashboard', { replace: true });
      return;
    }
    try {
      setSuccessData(JSON.parse(stored));
    } catch {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleComplete = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    sessionStorage.removeItem('paymentSuccess');
    navigate(successData?.orderId ? `/orders/${successData.orderId}` : '/orders', {
      replace: true,
    });
  }, [navigate, successData]);

  if (!successData) {
    return <FullPageLoading />;
  }

  return <PaymentSuccessAnimation onComplete={handleComplete} />;
}
