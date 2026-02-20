import React from 'react';
import { User, Gift, MicOff, Ban, Shield, X, UserPlus, MessageSquare, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import UserNameWithAge from '../UserNameWithAge';
import { shouldBlockKick } from '../../lib/insuranceSystem';
import { useAuthStore } from '../../lib/store';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../../lib/chatStore';

function getTierColor(tier: string) {
  switch (tier) {
    case 'Elite': return 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30';
    case 'Trusted': return 'text-green-400 bg-green-400/10 border-green-500/30';
    case 'Reliable': return 'text-blue-400 bg-blue-400/10 border-blue-500/30';
    case 'Building': return 'text-purple-400 bg-purple-400/10 border-purple-500/30';
    case 'Shaky': return 'text-orange-400 bg-orange-400/10 border-orange-500/30';
    case 'Untrusted': return 'text-red-400 bg-red-400/10 border-red-500/30';
    default: return 'text-gray-400 bg-gray-400/10 border-gray-500/30';
  }
}

interface UserActionModalProps {
  streamId: string;
  userId: string; // The user being acted upon
  username?: string; // Optional if we have it
  role?: string; // Target user's role
  createdAt?: string; // Target user's account creation date
  isHost: boolean;
  isModerator: boolean;
  onClose: () => void;
  onGift: () => void;
  onGiftAll?: () => void;
  onKickStage?: () => void;
  isBroadofficer?: boolean;
}

export default function UserActionModal({ 
  streamId, 
  userId, 
  username, 
  role,
  createdAt,
  isHost, 
  isModerator, 
  onClose, 
  onGift,
  onGiftAll,
  onKickStage,
  isBroadofficer: initialIsBroadofficer,
}: UserActionModalProps) {
  const [fetchedUsername, setFetchedUsername] = React.useState<string | null>(null);
  const [fetchedCreatedAt, setFetchedCreatedAt] = React.useState<string | null>(null);
  const [targetRole, setTargetRole] = React.useState<string | null>(role || null);
  const [fetchedTier, setFetchedTier] = React.useState<string | null>(null);
  const [fetchedAvatar, setFetchedAvatar] = React.useState<string | null>(null);
  const [isFollowing, setIsFollowing] = React.useState(false);
  const [isBroadofficer, setIsBroadofficer] = React.useState(initialIsBroadofficer || false);
  const { user: currentUser } = useAuthStore.getState();

  React.useEffect(() => {
    const fetchProfile = async () => {
        // Fetch profile if needed
        if (!username || !role || !createdAt) {
          const { data } = await supabase.from('user_profiles').select('username, role, troll_role, created_at, avatar_url').eq('id', userId).maybeSingle();
          if (data) {
              setFetchedUsername(data.username);
              setTargetRole(data.role || data.troll_role);
              setFetchedCreatedAt(data.created_at);
              setFetchedAvatar(data.avatar_url);
          }
        } else {
             // If we have basic info, still fetch avatar if missing
             const { data } = await supabase.from('user_profiles').select('avatar_url').eq('id', userId).maybeSingle();
             if (data) {
                 setFetchedAvatar(data.avatar_url);
             }
        }

        // Fetch credit tier
        const { data: creditData } = await supabase.from('user_credit').select('tier').eq('user_id', userId).maybeSingle();
        if (creditData) {
            setFetchedTier(creditData.tier);
        }

        // Check follow status
        if (currentUser) {
            const { data: followData, error: _followError } = await supabase
                .from('user_follows')
                .select('*')
                .eq('follower_id', currentUser.id)
                .eq('following_id', userId)
                .maybeSingle();
            
            if (followData) {
                setIsFollowing(true);
            }
        }

        // Check broadofficer status
        if (isHost && currentUser) {
            const { data: broadofficerData, error: _broadofficerError } = await supabase
                .from('broadcast_officers')
                .select('*')
                .eq('officer_id', userId)
                .eq('broadcaster_id', currentUser.id)
                .maybeSingle();
            
            if (broadofficerData) {
                setIsBroadofficer(true);
            }
        }
    };
    fetchProfile();
  }, [userId, username, role, createdAt, currentUser, isHost]);

  const displayName = username || fetchedUsername || userId;
  const displayCreatedAt = createdAt || fetchedCreatedAt || undefined;
  const isTargetStaff = targetRole === 'admin' || targetRole === 'moderator' || targetRole === 'staff';
  const navigate = useNavigate();
  const hasModActions = isHost || isModerator || isBroadofficer;

  const handleKick = async () => {
    if (isTargetStaff) {
        toast.error("Cannot kick staff members. Please report them instead.");
        return;
    }

    // Check for kick insurance
    const isProtected = await shouldBlockKick(userId);
    
    if (isProtected) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const { data: currentUserProfile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', currentUser?.id)
            .maybeSingle();
            
        const isKickerStaff = currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'moderator';
        
        if (!isKickerStaff) {
            toast.error("This user has Kick Insurance! They cannot be kicked.");
            return;
        }
    }

    if (!confirm("Kick this user for 100 coins? They will be removed for 24h unless they pay the fee.")) return;
    
    // Use the new paid kick RPC
    const { data, error } = await supabase.rpc('kick_user_paid', { 
        p_stream_id: streamId, 
        p_target_user_id: userId,
        p_kicker_id: (await supabase.auth.getUser()).data.user?.id 
    });

    if (error) {
        toast.error("Failed to kick user");
        console.error(error);
    } else if (data && !data.success) {
        toast.error(data.message || "Failed to kick user");
    } else {
        toast.success("User kicked (100 coins deducted)");
        onClose();
    }
  };
  
  const handleBan = async () => {
      if (isTargetStaff) {
          toast.error("Cannot ban staff members.");
          return;
      }
      if (!confirm("Permanently BAN this user from your broadcasts?")) return;
      
      const { error } = await supabase.from('stream_bans').insert({
          stream_id: streamId,
          user_id: userId,
          banned_by: (await supabase.auth.getUser()).data.user?.id,
          reason: 'Manual Ban'
      }); // Permanent ban (no expires_at)

      if (error) {
          toast.error("Failed to ban user");
      } else {
           // Also remove from viewers
           await supabase.from('stream_viewers').delete().match({ stream_id: streamId, user_id: userId });
           toast.success("User banned");
           onClose();
      }
  };
  
  const handleReport = async () => {
      // Implement report logic
      // For now just toast
      toast.success("User reported to Admins.");
      onClose();
  };

  const handleMute = async () => {
    if (isTargetStaff) {
        toast.error("Cannot mute staff members.");
        return;
    }
    if (!streamId || !streamId.trim()) {
      toast.error("Stream not found");
      return;
    }
    const { error } = await supabase.rpc('mute_user', { p_stream_id: streamId, p_user_id: userId });
    if (error) toast.error("Failed to mute user");
    else {
        toast.success("User muted");
        onClose();
    }
  };

  const handlePromote = async () => {
    if (!confirm("Promote this user to Broadofficer? They will have moderation powers.")) return;
    if (!currentUser) return;
    const { error } = await supabase.rpc('assign_broadofficer', { p_officer_id: userId, p_broadcaster_id: currentUser.id });
    if (error) {
      toast.error("Failed to promote user");
    } else {
      toast.success("User promoted to Broadofficer");
      setIsBroadofficer(true);
      onClose();
    }
  };

  const handleDemote = async () => {
    if (!confirm("Demote this user from Broadofficer?")) return;
    if (!currentUser) return;
    const { error } = await supabase.rpc('unassign_broadofficer', { p_officer_id: userId, p_broadcaster_id: currentUser.id });
    if (error) {
      toast.error("Failed to demote user");
    } else {
      toast.success("User demoted from Broadofficer");
      setIsBroadofficer(false);
      onClose();
    }
  };

  const handleAlertTrollOfficers = async () => {
    const reason = prompt("Please provide a reason for alerting the Troll Officers.");
    if (!reason) return;

    const { error } = await supabase.rpc('alert_troll_officers', { p_target_user_id: userId, p_stream_id: streamId, p_reason: reason });

    if (error) {
      toast.error("Failed to alert Troll Officers.");
    } else {
      toast.success("Troll Officers have been alerted.");
      onClose();
    }
  };

  const handleFollow = async () => {
    if (!currentUser) {
        navigate('/auth?mode=signup');
        return;
    }
    if (isFollowing) {
        // Unfollow
        const { error } = await supabase.from('user_follows').delete().eq('follower_id', currentUser.id).eq('following_id', userId);
        if (!error) {
            setIsFollowing(false);
            toast.success(`Unfollowed ${displayName}`);
        }
    } else {
        // Follow
        const { error } = await supabase.from('user_follows').insert({ follower_id: currentUser.id, following_id: userId });
        if (!error) {
            setIsFollowing(true);
            toast.success(`Followed ${displayName}`);
        }
    }
  };

  const openChatBubble = useChatStore((state) => state.openChatBubble);

  const handleMessage = () => {
    if (!currentUser) {
        navigate('/auth?mode=signup');
        return;
    }
    openChatBubble(userId, displayName, fetchedAvatar);
    onClose();
  };

  const handleViewProfile = () => {
    navigate(`/profile/${userId}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
              {fetchedAvatar ? (
                  <img src={fetchedAvatar} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                  displayName ? displayName.charAt(0).toUpperCase() : <User size={20} />
              )}
            </div>
            <div>
              <div className="font-bold text-white">
                <UserNameWithAge 
                  user={{
                    username: displayName,
                    created_at: displayCreatedAt || undefined,
                    id: userId
                  }}
                  showBadges={false} // Header already has badges/role info maybe? or simpler look
                />
              </div>
              <p className="text-xs text-zinc-400">Viewer</p>
              {fetchedTier && (
                <div className={`mt-1 px-2 py-0.5 rounded text-[10px] font-semibold inline-block border ${getTierColor(fetchedTier)}`}>
                  {fetchedTier}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-3">
          
          {/* Primary Action: Gift */}
          <div className="grid grid-cols-2 gap-2">
            <button 
                onClick={onGift}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:scale-[1.02]"
            >
                <Gift size={20} />
                Gift User
            </button>
            
            {onGiftAll && (
                <button 
                    onClick={onGiftAll}
                    className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all border border-white/10"
                >
                    <Gift size={20} className="text-purple-400" />
                    Gift All
                </button>
            )}
          </div>

          {onKickStage && (isHost || isModerator) && (
            <button 
              onClick={() => {
                if (confirm("Remove this user from the stage?")) {
                  onKickStage();
                  onClose();
                }
              }}
              className="flex items-center gap-2 w-full p-3 hover:bg-white/10 rounded-lg transition-colors text-left text-orange-400"
            >
              <Ban size={20} />
              <span>Remove from Stage</span>
            </button>
          )}

          {/* Standard Actions (Available to everyone, but filtered by role requirements) */}
          <div className="space-y-2 pt-2 border-t border-white/10 mt-2">
             {/* Follow / Message / Report */}
             <div className="grid grid-cols-3 gap-2">
                 <button onClick={handleFollow} className="flex flex-col items-center justify-center gap-1 p-2 bg-zinc-800 hover:bg-zinc-700 text-blue-400 rounded-lg transition-colors border border-white/5">
                    <UserPlus size={16} className={isFollowing ? "text-green-500" : ""} />
                    <span className="text-[10px]">{isFollowing ? "Following" : "Follow"}</span>
                 </button>
                 <button onClick={handleMessage} className="flex flex-col items-center justify-center gap-1 p-2 bg-zinc-800 hover:bg-zinc-700 text-purple-400 rounded-lg transition-colors border border-white/5">
                    <MessageSquare size={16} />
                    <span className="text-[10px]">Message</span>
                 </button>
                 <button onClick={handleReport} className="flex flex-col items-center justify-center gap-1 p-2 bg-zinc-800 hover:bg-zinc-700 text-yellow-500 rounded-lg transition-colors border border-white/5">
                    <Shield size={16} />
                    <span className="text-[10px]">Report</span>
                 </button>
             </div>
          </div>

          {/* Moderation Actions (Broadcaster / Staff / Broadofficer) */}
          {hasModActions && (
            <div className="space-y-2 pt-2 border-t border-white/10 mt-2">
               <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Moderation</p>
               
               {/* View Profile (Only for Staff/Broadcaster/Broadofficer) */}
               <button onClick={handleViewProfile} className="w-full flex items-center justify-center gap-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors border border-white/5 mb-2">
                  <Eye size={16} />
                  <span>View Profile</span>
               </button>

               {isTargetStaff ? (
                   <button onClick={handleReport} className="w-full flex items-center justify-center gap-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-yellow-500 rounded-lg transition-colors border border-white/5">
                      <Shield size={16} />
                      <span>Report Staff</span>
                   </button>
               ) : (
                   <div className="grid grid-cols-3 gap-2">
                     <button onClick={handleMute} className="flex items-center justify-center gap-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-yellow-500 rounded-lg transition-colors border border-white/5">
                        <MicOff size={16} />
                        <span>Mute</span>
                     </button>
                     <button onClick={handleKick} className="flex items-center justify-center gap-2 p-2 bg-zinc-800 hover:bg-red-900/30 text-red-500 rounded-lg transition-colors border border-white/5">
                       <X size={16} />
                       <span>Kick (100c)</span>
                    </button>
                     <button onClick={handleBan} className="flex items-center justify-center gap-2 p-2 bg-zinc-800 hover:bg-red-900/30 text-red-500 rounded-lg transition-colors border border-white/5">
                        <Ban size={16} />
                        <span>Ban</span>
                     </button>
                   </div>
               )}

               {isHost && !isTargetStaff && (
                 isBroadofficer ? (
                  <button onClick={handleDemote} className="w-full flex items-center justify-center gap-2 p-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg transition-colors border border-red-500/20 mt-2">
                     <Shield size={16} />
                     <span>Demote from Officer</span>
                  </button>
                 ) : (
                  <button onClick={handlePromote} className="w-full flex items-center justify-center gap-2 p-2 bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 rounded-lg transition-colors border border-blue-500/20 mt-2">
                      <Shield size={16} />
                      <span>Promote to Officer</span>
                  </button>
                 )
               )}

               {hasModActions && !isTargetStaff && (
                <button onClick={handleAlertTrollOfficers} className="w-full flex items-center justify-center gap-2 p-2 bg-yellow-900/20 hover:bg-yellow-900/40 text-yellow-400 rounded-lg transition-colors border border-yellow-500/20 mt-2">
                    <Shield size={16} />
                    <span>Alert Troll Officers</span>
                </button>
               )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
