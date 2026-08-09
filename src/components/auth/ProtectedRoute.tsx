import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullPageLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/customer-login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
