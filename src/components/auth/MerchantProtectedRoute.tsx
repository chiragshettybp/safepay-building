import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';

interface MerchantProtectedRouteProps {
  children: ReactNode;
}

export function MerchantProtectedRoute({ children }: MerchantProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useMerchantAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullPageLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/merchant-login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
