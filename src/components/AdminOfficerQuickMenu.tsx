import React from 'react';
import { useAuthStore } from '../lib/store';
import { UserRole } from '../lib/supabase';

const AdminOfficerQuickMenu: React.FC = () => {
  const { profile } = useAuthStore();

  if (!profile) return null;

  const isAdmin = profile.role === UserRole.ADMIN || profile.is_admin;
  const isOfficer = profile.role === UserRole.TROLL_OFFICER || profile.is_troll_officer;
  const isHR = profile.role === UserRole.HR_ADMIN;

  if (!isAdmin && !isOfficer && !isHR) return null;

  return (
    <div className="flex items-center space-x-2">
      {/* Quick actions menu - placeholder for now */}
      <div className="text-sm text-gray-400">
        {isAdmin && 'Admin'}
        {isOfficer && 'Officer'}
        {isHR && 'HR'}
      </div>
    </div>
  );
};

export default AdminOfficerQuickMenu;