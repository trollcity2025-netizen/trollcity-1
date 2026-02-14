import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { UserRole, supabase } from '../lib/supabase';
import { toast } from 'sonner';

const AdminOfficerQuickMenu: React.FC = () => {
  const { profile, showLegacySidebar, setShowLegacySidebar } = useAuthStore();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isOnDuty, setIsOnDuty] = useState(false);
  const [loadingDuty, setLoadingDuty] = useState(false);

  const checkDutyStatus = useCallback(async () => {
    try {
      const { data, error: _error } = await supabase
        .from('user_profiles')
        .select('on_duty')
        .eq('id', profile!.id)
        .single();
      
      if (data) {
        setIsOnDuty(data.on_duty || false);
      }
    } catch (error) {
      console.error('Error checking duty status:', error);
    }
  }, [profile]);

  useEffect(() => {
    if (isOpen && profile?.id) {
      checkDutyStatus();
    }
  }, [isOpen, profile?.id, checkDutyStatus]);

  const toggleDuty = async () => {
    if (loadingDuty) return;
    setLoadingDuty(true);
    try {
      const newStatus = !isOnDuty;
      const { error } = await supabase.rpc('toggle_staff_duty', {
        status: newStatus
      });

      if (error) throw error;

      setIsOnDuty(newStatus);
      toast.success(newStatus ? 'You are now ON DUTY' : 'You are now OFF DUTY');
      
      // Force a heartbeat to update status immediately
      await supabase.rpc('heartbeat_presence');
    } catch (error) {
      console.error('Error toggling duty:', error);
      toast.error('Failed to update duty status');
    } finally {
      setLoadingDuty(false);
    }
  };

  if (!profile) return null;

  const isAdmin = profile.role === UserRole.ADMIN || profile.is_admin;
  const isLeadOfficer = profile.role === UserRole.LEAD_TROLL_OFFICER || profile.is_lead_officer;
  const isOfficer = profile.role === UserRole.TROLL_OFFICER || profile.is_troll_officer;
  const isHR = profile.role === UserRole.HR_ADMIN;

  if (!isAdmin && !isLeadOfficer && !isOfficer && !isHR) return null;

  const getDashboardPath = () => {
    if (isAdmin) return '/admin';
    if (isLeadOfficer) return '/lead-officer';
    if (isOfficer) return '/officer/dashboard';
    if (isHR) return '/admin/hr';
    return '/';
  };

  const getRoleLabel = () => {
    if (isAdmin) return 'Admin';
    if (isLeadOfficer) return 'Lead Officer';
    if (isOfficer) return 'Officer';
    if (isHR) return 'HR Admin';
    return '';
  };

  const quickActions = [
    {
      label: showLegacySidebar ? 'Switch to Game Hub View (Hide Sidebar)' : 'Switch to Legacy Sidebar View',
      action: () => setShowLegacySidebar(!showLegacySidebar),
      icon: '🎮'
    },
    {
      label: 'Go to Dashboard',
      action: () => navigate(getDashboardPath()),
      icon: '📊'
    },
    ...(isAdmin ? [
      // Core
      // Removed: Admin HQ (deprecated)
      { label: 'City Control Center', action: () => navigate('/admin/system/health'), icon: '🏥' },
      
      // Management
      { label: 'User Search', action: () => navigate('/admin/user-search'), icon: '🔍' },
      { label: 'Ban Management', action: () => navigate('/admin/ban-management'), icon: '🔨' },
      { label: 'Role Management', action: () => navigate('/admin/role-management'), icon: '👥' },
      { label: 'Officer Operations', action: () => navigate('/admin/officer-operations'), icon: '👮' },
      { label: 'Officer Shifts', action: () => navigate('/admin/officer-shifts'), icon: '📅' },
      
      // Finance
      { label: 'Economy Dashboard', action: () => navigate('/admin/economy'), icon: '💰' },
      { label: 'Finance & Cashouts', action: () => navigate('/admin/finance'), icon: '💸' },
      { label: 'Grant Coins', action: () => navigate('/admin/grant-coins'), icon: '🪙' },
      
      // Content & Apps
      { label: 'Reports Queue', action: () => navigate('/admin/reports-queue'), icon: '📋' },
      { label: 'Applications', action: () => navigate('/admin/applications'), icon: '📝' },
      { label: 'Empire Applications', action: () => navigate('/admin/empire-applications'), icon: '🏰' },
      { label: 'Marketplace', action: () => navigate('/admin/marketplace'), icon: '🛍️' },
      { label: 'Support Tickets', action: () => navigate('/admin/support-tickets'), icon: '🎫' },
      
      // System
      { label: 'System Config', action: () => navigate('/admin/system/config'), icon: '⚙️' },
      { label: 'Database Backup', action: () => navigate('/admin/system/backup'), icon: '💾' },
      { label: 'Test Diagnostics', action: () => navigate('/admin/test-diagnostics'), icon: '🧪' },
    ] : []),
    ...((isOfficer || isLeadOfficer) ? [
      { label: 'Moderation', action: () => navigate('/officer/moderation'), icon: '🛡️' },
      { label: 'Officer Lounge', action: () => navigate('/officer/lounge'), icon: '🏢' },
      { label: 'OWC Dashboard', action: () => navigate('/officer/owc'), icon: '⭐' }
    ] : []),
    ...(isHR ? [
      { label: 'HR Dashboard', action: () => navigate('/admin/hr'), icon: '👥' }
    ] : [])
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded-lg border border-[#333] transition-colors"
      >
        <span className="text-sm text-gray-300">{getRoleLabel()}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-64 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-lg z-50 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div className="py-2">
            {/* Duty Toggle for Staff */}
            {(isOfficer || isLeadOfficer || isAdmin) && (
              <div className="px-4 py-2 border-b border-[#333] mb-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">
                    Status: <span className={isOnDuty ? "text-green-400" : "text-gray-500"}>{isOnDuty ? 'ON DUTY' : 'OFF DUTY'}</span>
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDuty();
                    }}
                    disabled={loadingDuty}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#1a1a1a] ${
                      isOnDuty ? 'bg-green-600' : 'bg-gray-700'
                    }`}
                  >
                    <span
                      className={`${
                        isOnDuty ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </button>
                </div>
              </div>
            )}

            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  action.action();
                  setIsOpen(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-[#2a2a2a] transition-colors flex items-center space-x-3"
              >
                <span className="text-lg">{action.icon}</span>
                <span className="text-sm text-gray-300">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminOfficerQuickMenu;
