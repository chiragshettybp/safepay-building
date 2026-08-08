import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';

interface MerchantProtectedRouteProps {
  children: ReactNode;
}

export function MerchantProtectedRoute({ children }: MerchantProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useMerchantAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/merchant-login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
