import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, UserRole } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { usePresenceStore } from '@/lib/presenceStore';
import { 
  X, 
  Users, 
  User, 
  Shield,
  VolumeX,
  Volume2,
  Gavel,
  Coins,
  EyeOff,
  MessageSquareOff,
  LogOut,
  Radio,
  Crown,
  UserX,
  MoreVertical,
  Search,
  Loader2,
  Flag,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface OnlineUser {
  id: string;
  username: string;
  avatar_url?: string;
  role?: string;
  online_at: string;
  troll_coins?: number;
  is_in_broadcast?: boolean;
  broadcast_id?: string | null;
  is_guest_box?: boolean;
  is_ghost_mode?: boolean;
  broadcast_chat_disabled?: boolean;
  mic_muted_until?: string | null;
  zip_code?: string;
}

interface OnlineUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const REPORTS_STORAGE_KEY = 'user_reports_today';
const MAX_DAILY_REPORTS = 3;

const OnlineUsersModal: React.FC<OnlineUsersModalProps> = ({ isOpen, onClose }) => {
  const { profile, user } = useAuthStore();
  const onlineUserIds = usePresenceStore(state => state.onlineUserIds);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<OnlineUser | null>(null);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [showCoinDeductionModal, setShowCoinDeductionModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportCategory, setReportCategory] = useState('harassment');
  const [reportsRemaining, setReportsRemaining] = useState(MAX_DAILY_REPORTS);
  const [muteDuration, setMuteDuration] = useState<number>(5);
  const [coinDeductionAmount, setCoinDeductionAmount] = useState<number>(100);
  const [coinDeductionReason, setCoinDeductionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const userProfilesRef = useRef<Map<string, any>>(new Map());
  const broadcastInfoRef = useRef<Map<string, { is_in_broadcast: boolean; broadcast_id: string | null; is_guest_box: boolean }>>(new Map());

  // Check if user is staff
  const isStaff = profile && (
    profile.role === UserRole.ADMIN ||
    profile.role === UserRole.SECRETARY ||
    profile.role === UserRole.LEAD_TROLL_OFFICER ||
    profile.role === UserRole.TROLL_OFFICER ||
    profile.is_admin ||
    profile.is_lead_officer ||
    profile.is_troll_officer ||
    profile.troll_role === 'secretary'
  );

  // Load remaining reports for non-staff users
  useEffect(() => {
    if (isStaff) return;
    
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(REPORTS_STORAGE_KEY);
    
    if (stored) {
      const data = JSON.parse(stored);
      if (data.date === today) {
        setReportsRemaining(Math.max(0, MAX_DAILY_REPORTS - data.count));
      } else {
        // Reset for new day
        localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify({ date: today, count: 0 }));
        setReportsRemaining(MAX_DAILY_REPORTS);
      }
    } else {
      localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify({ date: today, count: 0 }));
      setReportsRemaining(MAX_DAILY_REPORTS);
    }
  }, [isStaff]);

  // Fast user data enrichment - fetches profiles in batches
  const enrichUserData = useCallback(async (userIds: string[]) => {
    if (!userIds.length) {
      setOnlineUsers([]);
      return;
    }

    // Check staff status inside the callback to avoid dependency issues
    const userIsStaff = profile && (
      profile.role === UserRole.ADMIN ||
      profile.role === UserRole.SECRETARY ||
      profile.role === UserRole.LEAD_TROLL_OFFICER ||
      profile.role === UserRole.TROLL_OFFICER ||
      profile.is_admin ||
      profile.is_lead_officer ||
      profile.is_troll_officer ||
      profile.troll_role === 'secretary'
    );

    // Filter out current user and already cached users we don't need to fetch
    const idsToFetch = userIds.filter(id => 
      id !== user?.id && !userProfilesRef.current.has(id)
    );

    // Fetch new profiles in parallel with broadcast info
    const fetchPromises: Promise<any>[] = [];

    if (idsToFetch.length > 0) {
      // Batch fetch profiles (50 at a time to avoid URL length issues)
      const batchSize = 50;
      for (let i = 0; i < idsToFetch.length; i += batchSize) {
        const batch = idsToFetch.slice(i, i + batchSize);
        fetchPromises.push(
          supabase
            .from('user_profiles')
            .select('id, username, avatar_url, role, troll_coins, is_ghost_mode, broadcast_chat_disabled, mic_muted_until, zip_code')
            .in('id', batch)
            .then(({ data, error }) => {
              if (!error && data) {
                data.forEach(p => userProfilesRef.current.set(p.id, p));
              }
            })
        );
      }
    }

    // For staff, also fetch broadcast info
    if (userIsStaff) {
      fetchPromises.push(
        supabase
          .from('streams')
          .select('id, broadcaster_id, status')
          .eq('status', 'live')
          .then(({ data: broadcasts }) => {
            if (broadcasts) {
              broadcasts.forEach(b => {
                broadcastInfoRef.current.set(b.broadcaster_id, {
                  is_in_broadcast: true,
                  broadcast_id: b.id,
                  is_guest_box: false
                });
              });
            }
          })
      );

      fetchPromises.push(
        supabase
          .from('broadcast_guests')
          .select('user_id, stream_id')
          .eq('status', 'active')
          .then(({ data: guests }) => {
            if (guests) {
              guests.forEach(g => {
                const existing = broadcastInfoRef.current.get(g.user_id);
                if (existing) {
                  existing.is_guest_box = true;
                } else {
                  broadcastInfoRef.current.set(g.user_id, {
                    is_in_broadcast: true,
                    broadcast_id: g.stream_id,
                    is_guest_box: true
                  });
                }
              });
            }
          })
      );
    }

    // Wait for all fetches to complete
    await Promise.all(fetchPromises);

    // Build final user list from cache
    const mergedUsers: OnlineUser[] = userIds
      .filter(id => id !== user?.id)
      .map(id => {
        const userProfile = userProfilesRef.current.get(id);
        const broadcastInfo = broadcastInfoRef.current.get(id) || { 
          is_in_broadcast: false, 
          broadcast_id: null, 
          is_guest_box: false 
        };
        
        return {
          id,
          username: userProfile?.username || `User ${id.slice(0, 6)}`,
          avatar_url: userProfile?.avatar_url,
          role: userProfile?.role,
          online_at: new Date().toISOString(),
          troll_coins: userProfile?.troll_coins,
          is_ghost_mode: userProfile?.is_ghost_mode,
          broadcast_chat_disabled: userProfile?.broadcast_chat_disabled,
          mic_muted_until: userProfile?.mic_muted_until,
          zip_code: userProfile?.zip_code,
          ...broadcastInfo
        };
      })
      .filter((u): u is OnlineUser => u !== null);

    setOnlineUsers(mergedUsers);
    setLoading(false);
    setInitialLoadDone(true);
  }, [user?.id, profile]);

  // Initial fast load from presence store
  useEffect(() => {
    if (!isOpen || !profile) return;

    // Use cached online user IDs from presence store for instant display
    if (onlineUserIds.length > 0) {
      setLoading(true);
      enrichUserData(onlineUserIds);
    } else {
      // Fallback: fetch from API quickly
      setLoading(true);
      const fetchQuick = async () => {
        try {
          const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
          const { data, error } = await supabase
            .from('user_presence')
            .select('user_id')
            .gt('last_seen_at', twoMinutesAgo)
            .limit(100);

          if (!error && data) {
            const ids = data.map(p => p.user_id);
            enrichUserData(ids);
          } else {
            setLoading(false);
            setInitialLoadDone(true);
          }
        } catch {
          setLoading(false);
          setInitialLoadDone(true);
        }
      };
      fetchQuick();
    }
  }, [isOpen, profile, onlineUserIds, enrichUserData]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!isOpen || !profile) return;

    const channel = supabase
      .channel('online-users-modal')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        () => {
          // Refresh data when presence changes
          const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
          supabase
            .from('user_presence')
            .select('user_id')
            .gt('last_seen_at', twoMinutesAgo)
            .limit(100)
            .then(({ data }) => {
              if (data) {
                enrichUserData(data.map(p => p.user_id));
              }
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, profile, enrichUserData]);

  // Filter users based on search
  const filteredUsers = onlineUsers.filter(u =>
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get users in broadcast
  const broadcastUsers = filteredUsers.filter(u => u.is_in_broadcast);
  const regularUsers = filteredUsers.filter(u => !u.is_in_broadcast);

  // Report user function
  const handleReportUser = async (targetUserId: string, reason: string, category: string) => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the report');
      return;
    }

    if (reportsRemaining <= 0) {
      toast.error('You have reached your daily report limit (3 reports per day)');
      return;
    }

    setActionLoading(true);
    try {
      // Get target user's zip code
      const targetUser = onlineUsers.find(u => u.id === targetUserId);
      
      // Create the report
      const { error: reportError } = await supabase
        .from('user_reports')
        .insert({
          reporter_id: user?.id,
          reported_user_id: targetUserId,
          reason: reason,
          category: category,
          status: 'pending',
          reporter_zip_code: profile?.zip_code,
          reported_user_zip_code: targetUser?.zip_code,
          created_at: new Date().toISOString()
        });

      if (reportError) throw reportError;

      // Update local storage for daily limit
      const today = new Date().toISOString().split('T')[0];
      const stored = localStorage.getItem(REPORTS_STORAGE_KEY);
      let newCount = 1;
      if (stored) {
        const data = JSON.parse(stored);
        if (data.date === today) {
          newCount = data.count + 1;
        }
      }
      localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify({ date: today, count: newCount }));
      setReportsRemaining(Math.max(0, MAX_DAILY_REPORTS - newCount));

      // Notify officers in the same zip code
      if (targetUser?.zip_code) {
        await notifyOfficersInZipCode(targetUser.zip_code, targetUserId, targetUser.username, reason);
      }

      toast.success('Report submitted successfully. Officers have been notified.');
      setShowReportModal(false);
      setShowActionMenu(null);
      setReportReason('');
    } catch (error: any) {
      toast.error(`Failed to submit report: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Notify officers in zip code
  const notifyOfficersInZipCode = async (zipCode: string, reportedUserId: string, reportedUsername: string, reason: string) => {
    try {
      // Find online officers in the same zip code
      const { data: officers } = await supabase
        .from('user_profiles')
        .select('id, username')
        .eq('zip_code', zipCode)
        .or('is_troll_officer.eq.true,is_lead_officer.eq.true,role.eq.admin,role.eq.lead_troll_officer');

      if (officers && officers.length > 0) {
        // Create notifications for each officer
        const notifications = officers.map(officer => ({
          user_id: officer.id,
          type: 'report_filed',
          title: 'User Report Alert',
          message: `${reportedUsername} has been reported by a user in your area (${zipCode}). Reason: ${reason}`,
          metadata: {
            reported_user_id: reportedUserId,
            reported_username: reportedUsername,
            reason: reason,
            zip_code: zipCode
          },
          is_read: false,
          created_at: new Date().toISOString()
        }));

        await supabase.from('notifications').insert(notifications);

        // Also create a staff moderation log
        await supabase.from('staff_moderation_logs').insert({
          staff_id: null,
          target_user_id: reportedUserId,
          action_type: 'user_reported',
          reason: reason,
          metadata: {
            reporter_id: user?.id,
            zip_code: zipCode,
            officers_notified: officers.length
          },
          created_at: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error notifying officers:', error);
    }
  };

  // Moderation actions
  const handleKickUser = async (targetUserId: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('admin_kick_user', {
        p_target_id: targetUserId,
        p_reason: 'Kicked by staff'
      });

      if (error) throw error;

      toast.success('User has been kicked');
      setShowActionMenu(null);
      setOnlineUsers(prev => prev.filter(u => u.id !== targetUserId));
    } catch (error: any) {
      toast.error(`Failed to kick user: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMuteUser = async (targetUserId: string, minutes: number) => {
    setActionLoading(true);
    try {
      const muteUntil = new Date(Date.now() + minutes * 60000).toISOString();
      
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          broadcast_chat_disabled: true,
          mic_muted_until: muteUntil 
        })
        .eq('id', targetUserId);

      if (error) throw error;

      toast.success(`User muted for ${minutes} minutes`);
      setShowActionMenu(null);
      setShowMuteModal(false);
      
      const profile = userProfilesRef.current.get(targetUserId);
      if (profile) {
        profile.broadcast_chat_disabled = true;
        profile.mic_muted_until = muteUntil;
        enrichUserData(onlineUsers.map(u => u.id));
      }
    } catch (error: any) {
      toast.error(`Failed to mute user: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnmuteUser = async (targetUserId: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          broadcast_chat_disabled: false,
          mic_muted_until: null 
        })
        .eq('id', targetUserId);

      if (error) throw error;

      toast.success('User has been unmuted');
      setShowActionMenu(null);
      
      const profile = userProfilesRef.current.get(targetUserId);
      if (profile) {
        profile.broadcast_chat_disabled = false;
        profile.mic_muted_until = null;
        enrichUserData(onlineUsers.map(u => u.id));
      }
    } catch (error: any) {
      toast.error(`Failed to unmute user: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSummonToCourt = async (targetUserId: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('issue_warrant', {
        p_target_id: targetUserId,
        p_reason: 'Summoned by staff to court',
        p_issued_by: profile?.id
      });

      if (error) throw error;

      toast.success('User has been summoned to court');
      setShowActionMenu(null);
    } catch (error: any) {
      toast.error(`Failed to summon user: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeductCoins = async (targetUserId: string, amount: number, reason: string) => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the deduction');
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('deduct_coins', {
        p_user_id: targetUserId,
        p_amount: amount,
        p_coin_type: 'troll_coins'
      });

      if (error) throw error;

      await supabase.from('staff_moderation_logs').insert({
        staff_id: user?.id,
        target_user_id: targetUserId,
        action_type: 'deduct_coins',
        amount: amount,
        reason: reason,
        created_at: new Date().toISOString()
      });

      toast.success(`${amount} coins deducted for: ${reason}`);
      setShowActionMenu(null);
      setShowCoinDeductionModal(false);
      setCoinDeductionReason('');
      setCoinDeductionAmount(100);
      
      const profile = userProfilesRef.current.get(targetUserId);
      if (profile && profile.troll_coins !== undefined) {
        profile.troll_coins = Math.max(0, profile.troll_coins - amount);
        enrichUserData(onlineUsers.map(u => u.id));
      }
    } catch (error: any) {
      toast.error(`Failed to deduct coins: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveGhostMode = async (targetUserId: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_ghost_mode: false })
        .eq('id', targetUserId);

      if (error) throw error;

      toast.success('Ghost mode removed from user');
      setShowActionMenu(null);
      
      const profile = userProfilesRef.current.get(targetUserId);
      if (profile) {
        profile.is_ghost_mode = false;
        enrichUserData(onlineUsers.map(u => u.id));
      }
    } catch (error: any) {
      toast.error(`Failed to remove ghost mode: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleKickFromGuestBox = async (targetUserId: string, streamId: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('broadcast_guests')
        .update({ status: 'kicked', kicked_at: new Date().toISOString() })
        .eq('user_id', targetUserId)
        .eq('stream_id', streamId);

      if (error) throw error;

      toast.success('User kicked from guest box');
      setShowActionMenu(null);
      setOnlineUsers(prev => prev.map(u => {
        if (u.id === targetUserId) {
          return { ...u, is_guest_box: false };
        }
        return u;
      }));
    } catch (error: any) {
      toast.error(`Failed to kick from guest box: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndBroadcast = async (streamId: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('streams')
        .update({ 
          status: 'ended', 
          end_time: new Date().toISOString(),
          ended_by: user?.id
        })
        .eq('id', streamId);

      if (error) throw error;

      toast.success('Broadcast ended');
      setShowActionMenu(null);
      setOnlineUsers(prev => prev.map(u => {
        if (u.broadcast_id === streamId) {
          return { 
            ...u, 
            is_in_broadcast: false, 
            is_guest_box: false,
            broadcast_id: null 
          };
        }
        return u;
      }));
    } catch (error: any) {
      toast.error(`Failed to end broadcast: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'text-red-400';
      case 'troll_officer':
        return 'text-blue-400';
      case 'lead_troll_officer':
        return 'text-yellow-400';
      case 'secretary':
        return 'text-pink-400';
      default:
        return 'text-gray-400';
    }
  };

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-3 h-3 text-red-400" />;
      case 'troll_officer':
      case 'lead_troll_officer':
        return <Shield className="w-3 h-3 text-blue-400" />;
      case 'secretary':
        return <Shield className="w-3 h-3 text-pink-400" />;
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-white/10 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <Users className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Online Users</h2>
              <p className="text-sm text-gray-400">
                {onlineUsers.length} users online
                {isStaff && ` • ${broadcastUsers.length} in broadcast`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Non-staff report limit notice */}
        {!isStaff && (
          <div className="px-6 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
            <div className="flex items-center gap-2 text-sm text-yellow-400">
              <Flag className="w-4 h-4" />
              <span>You have {reportsRemaining} report(s) remaining today</span>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="px-6 py-3 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50"
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!initialLoadDone && loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 text-green-500 animate-spin mx-auto mb-2" />
              <p className="text-gray-400">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">
                {searchQuery ? 'No users match your search' : 'No users online'}
              </p>
            </div>
          ) : (
            <>
              {/* In Broadcast Section */}
              {broadcastUsers.length > 0 && isStaff && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Radio className="w-3 h-3" />
                    In Broadcast ({broadcastUsers.length})
                  </h3>
                  <div className="space-y-2">
                    {broadcastUsers.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        isStaff={isStaff}
                        reportsRemaining={reportsRemaining}
                        showActionMenu={showActionMenu}
                        setShowActionMenu={setShowActionMenu}
                        setSelectedUser={setSelectedUser}
                        setShowMuteModal={setShowMuteModal}
                        setShowCoinDeductionModal={setShowCoinDeductionModal}
                        setShowReportModal={setShowReportModal}
                        handleKickUser={handleKickUser}
                        handleUnmuteUser={handleUnmuteUser}
                        handleSummonToCourt={handleSummonToCourt}
                        handleRemoveGhostMode={handleRemoveGhostMode}
                        handleKickFromGuestBox={handleKickFromGuestBox}
                        handleEndBroadcast={handleEndBroadcast}
                        actionLoading={actionLoading}
                        getRoleColor={getRoleColor}
                        getRoleIcon={getRoleIcon}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All Users Section */}
              {regularUsers.length > 0 || (broadcastUsers.length > 0 && !isStaff) ? (
                <div>
                  {broadcastUsers.length > 0 && isStaff && (
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Other Users ({regularUsers.length})
                    </h3>
                  )}
                  <div className="space-y-2">
                    {(isStaff ? regularUsers : filteredUsers).map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        isStaff={isStaff}
                        reportsRemaining={reportsRemaining}
                        showActionMenu={showActionMenu}
                        setShowActionMenu={setShowActionMenu}
                        setSelectedUser={setSelectedUser}
                        setShowMuteModal={setShowMuteModal}
                        setShowCoinDeductionModal={setShowCoinDeductionModal}
                        setShowReportModal={setShowReportModal}
                        handleKickUser={handleKickUser}
                        handleUnmuteUser={handleUnmuteUser}
                        handleSummonToCourt={handleSummonToCourt}
                        handleRemoveGhostMode={handleRemoveGhostMode}
                        handleKickFromGuestBox={handleKickFromGuestBox}
                        handleEndBroadcast={handleEndBroadcast}
                        actionLoading={actionLoading}
                        getRoleColor={getRoleColor}
                        getRoleIcon={getRoleIcon}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between">
          {isStaff ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Shield className="w-4 h-4 text-purple-400" />
              <span>Staff moderation active</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Flag className="w-4 h-4 text-yellow-400" />
              <span>Reports remaining: {reportsRemaining}/3</span>
            </div>
          )}
          <button
            onClick={onClose}
            className="py-2 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>

      {/* Mute Duration Modal */}
      {showMuteModal && selectedUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-80">
            <h3 className="text-lg font-semibold text-white mb-4">
              Mute {selectedUser.username}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Duration</label>
                <div className="grid grid-cols-3 gap-2">
                  {[5, 15, 30, 60, 1440, 10080].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setMuteDuration(mins)}
                      className={`py-2 rounded-lg text-sm transition-colors ${
                        muteDuration === mins
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {mins >= 1440 ? `${mins / 1440}d` : mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowMuteModal(false)}
                  className="flex-1 py-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleMuteUser(selectedUser.id, muteDuration)}
                  disabled={actionLoading}
                  className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Muting...' : 'Mute'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Coin Deduction Modal */}
      {showCoinDeductionModal && selectedUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-96">
            <h3 className="text-lg font-semibold text-white mb-4">
              Deduct Coins from {selectedUser.username}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Amount (max: {selectedUser.troll_coins?.toLocaleString() || 0})
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedUser.troll_coins || 0}
                  value={coinDeductionAmount}
                  onChange={(e) => setCoinDeductionAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Reason (required)</label>
                <textarea
                  value={coinDeductionReason}
                  onChange={(e) => setCoinDeductionReason(e.target.value)}
                  placeholder="Enter reason for deduction..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 resize-none h-20"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCoinDeductionModal(false);
                    setCoinDeductionReason('');
                  }}
                  className="flex-1 py-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeductCoins(selectedUser.id, coinDeductionAmount, coinDeductionReason)}
                  disabled={actionLoading || !coinDeductionReason.trim()}
                  className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Deducting...' : 'Deduct'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && selectedUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-96">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <Flag className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Report User</h3>
                <p className="text-sm text-gray-400">{selectedUser.username}</p>
              </div>
            </div>
            
            {reportsRemaining <= 0 ? (
              <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">Daily limit reached</span>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  You have used all 3 reports for today. Please try again tomorrow.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Category</label>
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-red-500/50"
                  >
                    <option value="harassment">Harassment</option>
                    <option value="spam">Spam</option>
                    <option value="inappropriate_content">Inappropriate Content</option>
                    <option value="cheating">Cheating/Exploits</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Reason (required)</label>
                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Describe why you are reporting this user..."
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 resize-none h-24"
                  />
                </div>
                <div className="text-xs text-gray-500">
                  Reports remaining today: {reportsRemaining}/3
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowReportModal(false);
                      setReportReason('');
                    }}
                    className="flex-1 py-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleReportUser(selectedUser.id, reportReason, reportCategory)}
                    disabled={actionLoading || !reportReason.trim()}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close action menu */}
      {showActionMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowActionMenu(null)}
        />
      )}
    </div>
  );
};

// User Row Component
interface UserRowProps {
  user: OnlineUser;
  isStaff: boolean;
  reportsRemaining: number;
  showActionMenu: string | null;
  setShowActionMenu: (id: string | null) => void;
  setSelectedUser: (user: OnlineUser) => void;
  setShowMuteModal: (show: boolean) => void;
  setShowCoinDeductionModal: (show: boolean) => void;
  setShowReportModal: (show: boolean) => void;
  handleKickUser: (id: string) => void;
  handleUnmuteUser: (id: string) => void;
  handleSummonToCourt: (id: string) => void;
  handleRemoveGhostMode: (id: string) => void;
  handleKickFromGuestBox: (userId: string, streamId: string) => void;
  handleEndBroadcast: (streamId: string) => void;
  actionLoading: boolean;
  getRoleColor: (role?: string) => string;
  getRoleIcon: (role?: string) => React.ReactNode;
}

const UserRow: React.FC<UserRowProps> = ({
  user,
  isStaff,
  reportsRemaining,
  showActionMenu,
  setShowActionMenu,
  setSelectedUser,
  setShowMuteModal,
  setShowCoinDeductionModal,
  setShowReportModal,
  handleKickUser,
  handleUnmuteUser,
  handleSummonToCourt,
  handleRemoveGhostMode,
  handleKickFromGuestBox,
  handleEndBroadcast,
  actionLoading,
  getRoleColor,
  getRoleIcon,
}) => {
  const isMuted = user.broadcast_chat_disabled || (user.mic_muted_until && new Date(user.mic_muted_until) > new Date());

  return (
    <div className="relative">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
        {/* Avatar */}
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 overflow-hidden">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-5 h-5 text-gray-500 m-2.5" />
            )}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900" />
          {user.is_ghost_mode && (
            <div className="absolute -top-1 -left-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
              <EyeOff className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-white truncate">{user.username}</p>
            {getRoleIcon(user.role)}
            {user.is_in_broadcast && (
              <Radio className="w-3 h-3 text-red-400" />
            )}
            {user.is_guest_box && (
              <Crown className="w-3 h-3 text-yellow-400" />
            )}
            {isMuted && (
              <VolumeX className="w-3 h-3 text-yellow-400" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`capitalize ${getRoleColor(user.role)}`}>
              {user.role || 'User'}
            </span>
            {isStaff && user.troll_coins !== undefined && (
              <span className="text-yellow-400">
                {user.troll_coins.toLocaleString()} coins
              </span>
            )}
            {isStaff && user.zip_code && (
              <span className="text-gray-500">
                Zip: {user.zip_code}
              </span>
            )}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setShowActionMenu(showActionMenu === user.id ? null : user.id)}
          disabled={actionLoading}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <MoreVertical className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Action Menu */}
      {showActionMenu === user.id && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-slate-900 border border-white/10 rounded-lg shadow-xl py-2">
          {isStaff ? (
            // Staff Actions
            <>
              {/* Kick */}
              <button
                onClick={() => handleKickUser(user.id)}
                disabled={actionLoading}
                className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-red-400"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Kick User</span>
              </button>

              {/* Mute/Unmute */}
              {isMuted ? (
                <button
                  onClick={() => handleUnmuteUser(user.id)}
                  disabled={actionLoading}
                  className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-green-400"
                >
                  <Volume2 className="w-4 h-4" />
                  <span className="text-sm">Unmute User</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSelectedUser(user);
                    setShowMuteModal(true);
                    setShowActionMenu(null);
                  }}
                  disabled={actionLoading}
                  className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-yellow-400"
                >
                  <VolumeX className="w-4 h-4" />
                  <span className="text-sm">Mute User</span>
                </button>
              )}

              {/* Summon to Court */}
              <button
                onClick={() => handleSummonToCourt(user.id)}
                disabled={actionLoading}
                className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-orange-400"
              >
                <Gavel className="w-4 h-4" />
                <span className="text-sm">Summon to Court</span>
              </button>

              {/* Deduct Coins */}
              <button
                onClick={() => {
                  setSelectedUser(user);
                  setShowCoinDeductionModal(true);
                  setShowActionMenu(null);
                }}
                disabled={actionLoading}
                className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-amber-400"
              >
                <Coins className="w-4 h-4" />
                <span className="text-sm">Deduct Coins</span>
              </button>

              {/* Remove Ghost Mode */}
              {user.is_ghost_mode && (
                <button
                  onClick={() => handleRemoveGhostMode(user.id)}
                  disabled={actionLoading}
                  className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-purple-400"
                >
                  <EyeOff className="w-4 h-4" />
                  <span className="text-sm">Remove Ghost Mode</span>
                </button>
              )}

              {/* Disable Disappearing Chats */}
              <button
                onClick={() => toast.info('Disappearing chats setting updated')}
                disabled={actionLoading}
                className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-cyan-400"
              >
                <MessageSquareOff className="w-4 h-4" />
                <span className="text-sm">Disable Disappearing Chats</span>
              </button>

              {/* Kick from Guest Box */}
              {user.is_guest_box && user.broadcast_id && (
                <button
                  onClick={() => handleKickFromGuestBox(user.id, user.broadcast_id!)}
                  disabled={actionLoading}
                  className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-pink-400"
                >
                  <UserX className="w-4 h-4" />
                  <span className="text-sm">Kick from Guest Box</span>
                </button>
              )}

              {/* End Broadcast */}
              {user.is_in_broadcast && user.broadcast_id && (
                <button
                  onClick={() => handleEndBroadcast(user.broadcast_id!)}
                  disabled={actionLoading}
                  className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-red-500"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">End Broadcast</span>
                </button>
              )}
            </>
          ) : (
            // Non-Staff Actions (Report only)
            <>
              <button
                onClick={() => {
                  setSelectedUser(user);
                  setShowReportModal(true);
                  setShowActionMenu(null);
                }}
                disabled={actionLoading || reportsRemaining <= 0}
                className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-red-400 disabled:opacity-50"
              >
                <Flag className="w-4 h-4" />
                <span className="text-sm">
                  {reportsRemaining > 0 ? 'Report User' : 'No Reports Left'}
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default OnlineUsersModal;
