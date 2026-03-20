import React from 'react';
import { X, Swords, Zap, Crown, Users, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { useAuthStore } from '../../lib/store';

interface ChallengeRequestModalProps {
  streamId: string;
  broadcasterId: string;
  broadcasterName: string;
  broadcasterAvatar?: string;
  isOpen: boolean;
  onClose: () => void;
  onChallengeSent?: () => void;
}

export default function ChallengeRequestModal({
  streamId,
  broadcasterId,
  broadcasterName,
  broadcasterAvatar,
  isOpen,
  onClose,
  onChallengeSent
}: ChallengeRequestModalProps) {
  const { user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [username, setUsername] = React.useState('');
  const [fetchedProfile, setFetchedProfile] = React.useState<{
    username: string;
    avatar_url: string | null;
    battle_crowns: number;
  } | null>(null);

  // Fetch current user profile
  React.useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('user_profiles')
        .select('username, avatar_url, battle_crowns')
        .eq('id', user.id)
        .maybeSingle();
      
      if (data) {
        setFetchedProfile(data);
        setUsername(data.username || '');
      }
    };
    
    fetchProfile();
  }, [user]);

  if (!isOpen) return null;

  const handleSubmitChallenge = async () => {
    if (!user) {
      toast.error('Please sign in to send a challenge');
      return;
    }

    if (!username.trim()) {
      toast.error('Please enter your username');
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if there's already a pending challenge from this user
      const { data: existingChallenge } = await supabase
        .from('broadcast_challenges')
        .select('id, status')
        .eq('stream_id', streamId)
        .eq('challenger_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingChallenge) {
        toast.error('You already have a pending challenge');
        setIsSubmitting(false);
        return;
      }

      // Check if broadcaster is currently in a battle
      const { data: activeBattle } = await supabase
        .from('battles')
        .select('id, status')
        .eq('opponent_id', broadcasterId)
        .eq('status', 'active')
        .maybeSingle();

      if (activeBattle) {
        toast.error('Broadcaster is currently in a battle');
        setIsSubmitting(false);
        return;
      }

      // Create the challenge
      const { data, error } = await supabase
        .from('broadcast_challenges')
        .insert({
          stream_id: streamId,
          challenger_id: user.id,
          challenger_username: username,
          status: 'pending',
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
        })
        .select()
        .single();

      if (error) {
        console.error('Challenge error:', error);
        toast.error('Failed to send challenge');
        return;
      }

      // Notify broadcaster via realtime - use same channel as BroadcastChat listens on
      const streamChannel = supabase.channel(`chat-challenges-${streamId}`);
      
      // Subscribe to the channel first before sending
      await streamChannel.subscribe();
      
      await streamChannel.send({
        type: 'broadcast',
        event: 'new_challenge',
        payload: {
          challenge_id: data.id,
          challenger_id: user.id,
          challenger_username: username,
          challenger_avatar: fetchedProfile?.avatar_url,
          challenger_crowns: fetchedProfile?.battle_crowns || 0,
          stream_id: streamId,
          expires_at: data.expires_at,
          timestamp: new Date().toISOString()
        }
      });

      toast.success('Challenge sent! Waiting for broadcaster to accept.');
      onChallengeSent?.();
      onClose();
    } catch (err) {
      console.error('Submit challenge error:', err);
      toast.error('Failed to send challenge');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div 
        className="bg-zinc-900 border border-purple-500/30 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-900/30 to-red-900/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-red-500 flex items-center justify-center text-white font-bold overflow-hidden ring-2 ring-purple-500/50">
              {broadcasterAvatar ? (
                <img src={broadcasterAvatar} alt={broadcasterName} className="w-full h-full object-cover" />
              ) : (
                <Crown size={24} />
              )}
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Challenge Broadcast</h3>
              <p className="text-xs text-zinc-400">vs {broadcasterName}</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); onClose(); }} 
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Challenge Info */}
          <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-purple-400">
              <Swords size={18} />
              <span className="font-semibold">5v5 Battle Grid</span>
            </div>
            <p className="text-sm text-zinc-400">
              Challenge this broadcaster to a 5v5 battle. If they accept, the broadcast transforms into a battle arena!
            </p>
            
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="bg-zinc-800 rounded-lg p-2 flex items-center gap-2">
                <Zap size={14} className="text-yellow-400" />
                <span className="text-xs text-zinc-400">Instant Grid</span>
              </div>
              <div className="bg-zinc-800 rounded-lg p-2 flex items-center gap-2">
                <Crown size={14} className="text-amber-400" />
                <span className="text-xs text-zinc-400">2 Crowns/Person</span>
              </div>
            </div>
          </div>

          {/* Username Input */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Your Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
            />
          </div>

          {/* Your Stats */}
          {fetchedProfile && (
            <div className="flex items-center gap-3 bg-zinc-800/30 rounded-lg p-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center overflow-hidden">
                {fetchedProfile.avatar_url ? (
                  <img src={fetchedProfile.avatar_url} alt={username} className="w-full h-full object-cover" />
                ) : (
                  <Users size={20} className="text-purple-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{username}</p>
                <div className="flex items-center gap-1 text-amber-400">
                  <Crown size={12} />
                  <span className="text-xs">{fetchedProfile.battle_crowns || 0} Crowns</span>
                </div>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/20">
            <AlertTriangle size={16} className="text-yellow-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-200/70">
              Challenge expires in 5 minutes. Broadcaster may deny or ignore challenges.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitChallenge}
              disabled={!username.trim() || isSubmitting}
              className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-red-600 hover:from-purple-500 hover:to-red-500 disabled:from-purple-600/50 disabled:to-red-600/50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Swords size={18} />
                  Send Challenge
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
