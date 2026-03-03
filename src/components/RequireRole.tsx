import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { hasRole, UserRole, validateProfile, isAdminEmail, supabase } from '../lib/supabase';

interface RequireRoleProps {
  roles: UserRole | UserRole[];
  children: React.ReactNode;
  fallbackPath?: string; // Custom redirect path
  showValidationErrors?: boolean; // For development
}

const RequireRole: React.FC<RequireRoleProps> = ({
  roles,
  children,
  fallbackPath,
  showValidationErrors = false
}) => {
  const { profile, user, refreshProfile } = useAuthStore();

  // Real-time role change detection - redirects immediately if role is revoked
  useEffect(() => {
    if (!profile?.id) return

    const channel = supabase
      .channel(`require-role-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${profile.id}`,
        },
        (payload) => {
          // Check if role-related fields changed
          const newData = payload.new as any
          const oldData = payload.old as any
          
          const roleFields = ['role', 'is_admin', 'is_lead_officer', 'is_troll_officer', 'troll_role', 'is_pastor', 'is_secretary']
          const hasRoleChange = roleFields.some(field => newData[field] !== oldData[field])
          
          if (hasRoleChange) {
            console.log('[RequireRole] Role change detected, refreshing profile...')
            // Refresh the profile to get updated role data
            refreshProfile()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id, refreshProfile])

  // Basic authentication check
  if (!profile) {
    return <Navigate to="/" replace />;
  }

  // Validate profile data
  const validation = validateProfile(profile);
  if (!validation.isValid) {
    console.error('Profile validation failed:', validation.errors);
    if (showValidationErrors) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0A0814] text-white">
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-bold mb-2">Profile Validation Error</h2>
            <ul className="text-sm space-y-1">
              {validation.errors.map((error, index) => (
                <li key={index} className="text-red-300">• {error}</li>
              ))}
            </ul>
            {validation.warnings.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mt-4 mb-2">Warnings:</h3>
                <ul className="text-sm space-y-1">
                  {validation.warnings.map((warning, index) => (
                    <li key={index} className="text-yellow-300">• {warning}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      );
    }
    return <Navigate to="/" replace />;
  }

  // Check role permissions with enhanced validation
  const hasRequiredRole = hasRole(profile, roles, {
    allowAdminOverride: true
  });

  if (!hasRequiredRole) {
    console.warn('Access denied:', {
      userRole: profile.role,
      requiredRoles: roles,
      isAdmin: profile.is_admin || (user?.email && isAdminEmail(user.email))
    });
    
    return <Navigate to={fallbackPath || "/access-denied"} replace />;
  }

  return <>{children}</>;
};

export default RequireRole;