import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, X, Check, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import type { TMFamilyInvite } from '../../types/trollMatch';

interface TMFamilyInviteHandlerProps {
  // Optionally pass a user ID to invite directly
  targetUserId?: string;
  onInviteSent?: () => void;
}

export function TMFamilyInviteHandler({ targetUserId, onInviteSent }: TMFamilyInviteHandlerProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [pendingInvites, setPendingInvites] = useState<TMFamilyInvite[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch pending family invites for current user
  useEffect(() => {
    if (!user) return;

    const fetchPendingInvites = async () => {
      try {
        const { data, error } = await supabase
          .from('family_invites')
          .select(`
            *,
            inviter:user_profiles!inviter_id(username),
            family:troll_families(name)
          `)
          .eq('invitee_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPendingInvites(data || []);
      } catch (err) {
        console.error('Error fetching family invites:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingInvites();

    // Subscribe to new invites
    const channel = supabase
      .channel(`family-invites:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'family_invites',
          filter: `invitee_id=eq.${user.id}`
        },
        (payload) => {
          // New invite received - refetch
          fetchPendingInvites();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'family_invites',
          filter: `invitee_id=eq.${user.id}`
        },
        (payload) => {
          // Invite updated - refetch
          fetchPendingInvites();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      await supabase.rpc('respond_family_invite', {
        p_invite_id: inviteId,
        p_status: 'accepted'
      });

      // Navigate to family page
      navigate('/family/home');
    } catch (err) {
      console.error('Error accepting invite:', err);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await supabase.rpc('respond_family_invite', {
        p_invite_id: inviteId,
        p_status: 'declined'
      });

      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (err) {
      console.error('Error declining invite:', err);
    }
  };

  if (loading || pendingInvites.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3">
      <AnimatePresence>
        {pendingInvites.map((invite) => (
          <motion.div
            key={invite.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-80 bg-slate-800 rounded-2xl border border-purple-500/30 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Family Invitation</h3>
                  <p className="text-sm text-white/80">
                    {(invite as any)?.inviter?.username || 'Someone'} invited you to join their family
                  </p>
                </div>
              </div>
            </div>

            {/* Family Info */}
            <div className="p-4 bg-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-purple-400" />
                <span className="font-medium text-white">
                  {(invite as any)?.family?.name || 'a Family'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleDeclineInvite(invite.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Decline
                </button>
                <button
                  onClick={() => handleAcceptInvite(invite.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 transition-all"
                >
                  <Check className="w-4 h-4" />
                  Accept
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default TMFamilyInviteHandler;
