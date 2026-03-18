import React from 'react';
import { User, Gift, MicOff, Ban, Shield, X, UserPlus, MessageSquare, Eye, AlertTriangle } from 'lucide-react';
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
  onKickStage
}: UserActionModalProps) {
  const [fetchedUsername, setFetchedUsername] = React.useState<string | null>(null);
  const [fetchedCreatedAt, setFetchedCreatedAt] = React.useState<string | null>(null);
  const [targetRole, setTargetRole] = React.useState<string | null>(role || null);
  const [fetchedTier, setFetchedTier] = React.useState<string | null>(null);
  const [fetchedAvatar, setFetchedAvatar] = React.useState<string | null>(null);
  const [isFollowing, setIsFollowing] = React.useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [selectedReason, setSelectedReason] = React.useState<string>('');
  const [reportDescription, setReportDescription] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { user: currentUser } = useAuthStore.getState();

  // Report reasons
  const reportReasons = [
    { id: 'spam', label: 'Spam / Advertising', description: 'Posting promotional content or repetitive messages' },
    { id: 'harassment', label: 'Harassment / Bullying', description: 'Targeting or insulting other users' },
    { id: 'inappropriate', label: 'Inappropriate Content', description: 'Sharing NSFW or offensive material' },
    { id: ' impersonation', label: 'Impersonation', description: 'Pretending to be someone else' },
    { id: 'violence', label: 'Violence / Threats', description: 'Threatening or promoting violence' },
    { id: 'scam', label: 'Scam / Fraud', description: 'Attempting to scam other users' },
    { id: 'other', label: 'Other', description: 'Any other violation' },
  ];

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
    };
    fetchProfile();
  }, [userId, username, role, createdAt, currentUser]);

  const displayName = username || fetchedUsername || userId;
  const displayCreatedAt = createdAt || fetchedCreatedAt || undefined;
  const isTargetStaff = targetRole === 'admin' || targetRole === 'moderator' || targetRole === 'staff';
  const navigate = useNavigate();
  const hasModActions = isHost || isModerator;

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
            
        const isKickerStaff = 
            currentUserProfile?.role === 'admin' || 
            currentUserProfile?.role === 'moderator' ||
            currentUserProfile?.is_admin === true ||
            currentUserProfile?.is_troll_officer === true;
        
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

      // Check for ban insurance - only admins/moderators can ban users with insurance
      const isProtected = await shouldBlockKick(userId);
      
      if (isProtected) {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          const { data: currentUserProfile } = await supabase
              .from('user_profiles')
              .select('role, troll_role')
              .eq('id', currentUser?.id)
              .maybeSingle();
              
          const isKickerAdmin = 
            currentUserProfile?.role === 'admin' || 
            currentUserProfile?.troll_role === 'admin' ||
            currentUserProfile?.is_admin === true;
          const isKickerModerator = 
            currentUserProfile?.role === 'moderator' || 
            currentUserProfile?.role === 'troll_officer' ||
            currentUserProfile?.troll_role === 'troll_officer' ||
            currentUserProfile?.troll_role === 'lead_officer' ||
            currentUserProfile?.is_troll_officer === true ||
            currentUserProfile?.is_lead_officer === true;
          
          if (!isKickerAdmin && !isKickerModerator) {
              toast.error("This user has Insurance! Only admins can ban insured users.");
              return;
          }
      }

      if (!confirm("Permanently BAN this user from your broadcasts?")) return;
      
      const { data, error } = await supabase.rpc('ban_user_from_stream', {
          p_stream_id: streamId,
          p_user_id: userId,
          p_reason: 'Manual Ban'
      });

      if (error) {
          toast.error("Failed to ban user");
          console.error(error);
      } else if (data && !data.success) {
          toast.error(data.message || "Failed to ban user");
      } else {
          toast.success("User banned");
          onClose();
      }
  };
  
  const handleReport = () => {
    // Show the report modal
    setShowReportModal(true);
  };

  const submitReport = async () => {
    if (!currentUser) {
      navigate('/auth?mode=signup');
      return;
    }

    if (!selectedReason) {
      toast.error('Please select a reason for reporting');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get reporter's profile info
      const { data: reporterProfile } = await supabase
        .from('user_profiles')
        .select('username, avatar_url')
        .eq('id', currentUser.id)
        .single();

      // Get reported user's profile info
      const { data: reportedProfile } = await supabase
        .from('user_profiles')
        .select('username, avatar_url')
        .eq('id', userId)
        .single();

      // Insert report into database
      const { error: reportError } = await supabase.from('user_reports').insert({
        reporter_id: currentUser.id,
        reported_user_id: userId,
        reason: selectedReason,
        description: reportDescription || null,
        stream_id: streamId || null,
        status: 'pending'
      });

      if (reportError) {
        console.error('Report error:', reportError);
        toast.error('Failed to submit report');
        setIsSubmitting(false);
        return;
      }

      // Notify officers via realtime
      // Get all officers
      const { data: officers } = await supabase
        .from('user_profiles')
        .select('id')
        .in('role', ['admin', 'moderator', 'troll_officer']);

      // Send notification to each officer
      if (officers && officers.length > 0) {
        const reportChannel = supabase.channel('officer-notifications');
        await reportChannel.send({
          type: 'broadcast',
          event: 'new_report',
          payload: {
            report_id: `report-${Date.now()}`,
            reporter_id: currentUser.id,
            reporter_name: reporterProfile?.username || 'Unknown',
            reporter_avatar: reporterProfile?.avatar_url || null,
            reported_user_id: userId,
            reported_user_name: reportedProfile?.username || 'Unknown',
            reported_user_avatar: reportedProfile?.avatar_url || null,
            reason: selectedReason,
            description: reportDescription || null,
            stream_id: streamId,
            timestamp: new Date().toISOString()
          }
        });
      }

      toast.success('Report submitted. Officers will review shortly.');
      setShowReportModal(false);
      onClose();
    } catch (err) {
      console.error('Submit report error:', err);
      toast.error('Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
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
    const { error } = await supabase.rpc('assign_broadofficer', { p_user_id: userId });
    if (error) toast.error("Failed to promote user");
    else {
        toast.success("User promoted to Broadofficer");
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
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div 
        className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
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
          <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-zinc-400 hover:text-white transition-colors">
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
                 <button onClick={handlePromote} className="w-full flex items-center justify-center gap-2 p-2 bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 rounded-lg transition-colors border border-blue-500/20 mt-2">
                    <Shield size={16} />
                    <span>Promote to Officer</span>
                 </button>
               )}
            </div>
          )}
        </div>

      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => { e.stopPropagation(); setShowReportModal(false); }}
        >
          <div 
            className="bg-zinc-900 border border-yellow-500/30 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-red-900/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Report User</h3>
                  <p className="text-xs text-zinc-400">Reporting {displayName}</p>
                </div>
              </div>
              <button type="button" onClick={(e) => { e.stopPropagation(); setShowReportModal(false); }} className="text-zinc-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Reason for reporting <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {reportReasons.map((reason) => (
                    <label
                      key={reason.id}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                        selectedReason === reason.id
                          ? 'bg-red-500/20 border-red-500/50'
                          : 'bg-zinc-800 border-transparent hover:border-white/10'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reportReason"
                        value={reason.id}
                        checked={selectedReason === reason.id}
                        onChange={(e) => setSelectedReason(e.target.value)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-white text-sm">{reason.label}</div>
                        <div className="text-xs text-zinc-400">{reason.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Additional details (optional)
                </label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Provide more context about the issue..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitReport}
                  disabled={!selectedReason || isSubmitting}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Shield size={16} />
                      Submit Report
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
