import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { isAdminEmail } from '../lib/supabase';

interface RequireRoleProps {
  roles: string[];
  children: React.ReactNode;
  requireActive?: boolean; // For officers, require is_officer_active = true
}

const RequireRole: React.FC<RequireRoleProps> = ({ roles, children, requireActive = false }) => {
  const { profile, user } = useAuthStore();

  if (!profile) {
    return <Navigate to="/" replace />;
  }

  const isAdmin = profile.is_admin || profile.role === 'admin' || (user?.email && isAdminEmail(user.email))
  
  // Check if user has required role
  const hasRole = roles.includes(profile.role || '') || 
                  (roles.includes('troll_officer') && (profile.is_troll_officer || isAdmin)) ||
                  (roles.includes('admin') && isAdmin);

  if (!hasRole) {
    return <Navigate to="/access-denied" replace />;
  }

  // If requireActive is true and user is an officer, check if they're active
  if (requireActive && (profile.is_troll_officer || profile.role === 'troll_officer')) {
    if (!profile.is_officer_active) {
      // Redirect to orientation if not active
      return <Navigate to="/officer/orientation" replace />;
    }
  }

  return <>{children}</>;
};

export default RequireRole;