import React from 'react';
import { User, Gift, MicOff, Ban, Shield, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import UserNameWithAge from '../UserNameWithAge';
import { deductCoins } from '../../lib/coinTransactions';
import { useAuthStore } from '../../lib/store';

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
  onGiftAll
}: UserActionModalProps) {
  const { user } = useAuthStore();
  const [fetchedUsername, setFetchedUsername] = React.useState<string | null>(null);
  const [fetchedCreatedAt, setFetchedCreatedAt] = React.useState<string | null>(null);
  const [targetRole, setTargetRole] = React.useState<string | null>(role || null);

  React.useEffect(() => {
    if (username && role && createdAt) return;
    const fetchProfile = async () => {
        const { data } = await supabase.from('user_profiles').select('username, role, troll_role, created_at').eq('id', userId).single();
        if (data) {
            setFetchedUsername(data.username);
            setTargetRole(data.role || data.troll_role);
            setFetchedCreatedAt(data.created_at);
        }
    };
    fetchProfile();
  }, [userId, username, role, createdAt]);

  const displayName = username || fetchedUsername || userId;
  const displayCreatedAt = createdAt || fetchedCreatedAt || undefined;
  const isTargetStaff = targetRole === 'admin' || targetRole === 'moderator' || targetRole === 'staff';

  const handleKick = async () => {
    if (isTargetStaff) {
        toast.error("Cannot kick staff members. Please report them instead.");
        return;
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
    const { error } = await supabase.rpc('mute_user', { p_stream_id: streamId, p_user_id: userId });
    if (error) toast.error("Failed to mute user");
    else {
        toast.success("User muted");
        onClose();
    }
  };

  const handleKick = async () => {
    if (!user) return;
    if (isTargetStaff) {
        toast.error("Cannot kick staff members.");
        return;
    }
    
    if (!confirm(`Kick ${displayName} for 100 coins? This cannot be undone.`)) return;

    // Deduct coins first
    const { success, error: payError } = await deductCoins({
        userId: user.id,
        amount: 100,
        type: 'moderation_action',
        description: `Paid kick on user ${displayName}`,
        metadata: { target_user_id: userId, stream_id: streamId }
    });

    if (!success) {
        toast.error(payError || "Insufficient coins or payment failed");
        return;
    }

    // Execute Kick
    // Try to use kick_user RPC, fallback to updating stream_viewers or similar if needed
    // Assuming kick_user exists as it's a standard mod action
    const { error } = await supabase.rpc('kick_user', { p_stream_id: streamId, p_user_id: userId });
    
    if (error) {
        console.error("Kick failed:", error);
        toast.error("Failed to kick user (coins deducted - contact support if issue persists)");
    } else {
        toast.success("User kicked!");
        onClose();
    }
  };

  const handleBan = async () => {
    if (isTargetStaff) {
        toast.error("Cannot ban staff members.");
        return;
    }
    if (!confirm(`Are you sure you want to ban ${displayName}?`)) return;

    const { error } = await supabase.rpc('ban_user', { p_stream_id: streamId, p_user_id: userId });
    if (error) toast.error("Failed to ban user");
    else {
        toast.success("User banned");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
              {displayName ? displayName.charAt(0).toUpperCase() : <User size={20} />}
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

          {/* Moderation Actions */}
          {(isHost || isModerator) && (
            <div className="space-y-2 pt-2 border-t border-white/10 mt-2">
               <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Moderation</p>
               
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
    </div>
  );
}
