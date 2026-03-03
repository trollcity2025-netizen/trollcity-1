/**
 * ProtectedTCNNRoute Component
 * 
 * Route guard component for TCNN-specific routes
 * Validates user has appropriate TCNN role before rendering children
 */
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { useTCNNRoles } from '@/hooks/useTCNNRoles';
import { Loader2, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ProtectedTCNNRouteProps {
  children: ReactNode;
  requiredRole?: 'journalist' | 'news_caster' | 'chief_news_caster';
  requireAuth?: boolean;
}

export default function ProtectedTCNNRoute({
  children,
  requiredRole,
  requireAuth = true
}: ProtectedTCNNRouteProps) {
  const { user, loading: authLoading } = useAuthStore();
  const location = useLocation();
  const { 
    isJournalist, 
    isNewsCaster, 
    isChiefNewsCaster, 
    canPublishArticles, 
    loading: rolesLoading 
  } = useTCNNRoles(user?.id);

  // Show loading state
  if (authLoading || rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Redirect to login if authentication is required but user is not logged in
  if (requireAuth && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If no specific role required, just check auth
  if (!requiredRole) {
    return <>{children}</>;
  }

  // Check role permissions
  const hasRequiredRole = () => {
    switch (requiredRole) {
      case 'journalist':
        return isJournalist || isNewsCaster || isChiefNewsCaster;
      case 'news_caster':
        return isNewsCaster || isChiefNewsCaster;
      case 'chief_news_caster':
        return isChiefNewsCaster;
      default:
        return true;
    }
  };

  if (!hasRequiredRole()) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-4">
        <Card className="max-w-md w-full p-8 text-center bg-slate-900/80 border-red-500/30">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
          <p className="text-gray-400 mb-6">
            This area is restricted to TCNN {requiredRole.replace('_', ' ')}s only.
            You do not have the required permissions to access this page.
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="w-full bg-transparent border-slate-600 text-gray-300 hover:bg-slate-800"
            >
              Go Back
            </Button>
            <Button
              onClick={() => window.location.href = '/tcnn'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Visit TCNN Main Page
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

// Convenience exports for common role requirements
export const RequireJournalist = ({ children }: { children: ReactNode }) => (
  <ProtectedTCNNRoute requiredRole="journalist">{children}</ProtectedTCNNRoute>
);

export const RequireNewsCaster = ({ children }: { children: ReactNode }) => (
  <ProtectedTCNNRoute requiredRole="news_caster">{children}</ProtectedTCNNRoute>
);

export const RequireChiefNewsCaster = ({ children }: { children: ReactNode }) => (
  <ProtectedTCNNRoute requiredRole="chief_news_caster">{children}</ProtectedTCNNRoute>
);
