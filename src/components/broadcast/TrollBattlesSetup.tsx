import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { Crown, Swords, Clock, Gift, User, Loader2, X, AlertTriangle } from 'lucide-react';

interface TrollBattlesSetupProps {
  streamId?: string;
  onOpponentFound: (opponent: any, battleId: string) => void;
  onCancel: () => void;
}

export default function TrollBattlesSetup({ streamId, onOpponentFound, onCancel: _onCancel }: TrollBattlesSetupProps) {
  const { user, profile } = useAuthStore();
  const [status, setStatus] = useState<'idle' | 'searching' | 'matched'>('idle');
  const [opponent, setOpponent] = useState<any>(null);
  const [battleId, setBattleId] = useState<string | null>(null);
  const [skipsUsed, setSkipsUsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [_error, setError] = useState<string | null>(null);

  const assignTopGuests = useCallback(async (battleId: string, isPlayer1: boolean) => {
    if (!streamId) return;
    
    try {
        const { data: gifts } = await supabase
            .from('stream_gifts')
            .select('recipient_id, coins_amount')
            .eq('stream_id', streamId);

        if (!gifts) return;

        const totals: Record<string, number> = {};
        gifts.forEach(g => {
            if (g.recipient_id === user?.id) return;
            if (g.recipient_id) {
                totals[g.recipient_id] = (totals[g.recipient_id] || 0) + (g.coins_amount || 0);
            }
        });

        const sortedIds = Object.entries(totals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 2)
            .map(([id]) => id);

        if (sortedIds.length === 0) return;

        const { data: guests } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url')
            .in('id', sortedIds);

        if (!guests || guests.length === 0) return;

        const battleParticipants = guests.map(g => ({
            user_id: g.id,
            username: g.username,
            avatar_url: g.avatar_url
        }));

        const updateField = isPlayer1 ? 'host_guests' : 'challenger_guests';
        
        await supabase
            .from('troll_battles')
            .update({ [updateField]: battleParticipants })
            .eq('id', battleId);

    } catch (err) {
        console.error('Failed to assign guests', err);
    }
  }, [streamId, user]);

  // Poll for battle status if searching
  useEffect(() => {
    let interval: any;

    const checkMatch = async () => {
        // Check if we have been matched
        const { data } = await supabase
            .from('troll_battles')
            .select('*, player1:player1_id(username, avatar_url, level), player2:player2_id(username, avatar_url, level)')
            .or(`player1_id.eq.${user?.id},player2_id.eq.${user?.id}`)
            .eq('status', 'pending')
            .maybeSingle();

        if (data) {
            const isPlayer1 = data.player1_id === user?.id;
            const opp = isPlayer1 ? data.player2 : data.player1;
            setBattleId(data.id);
            setOpponent(opp);
            setStatus('matched');
            
            // Auto-assign top guests if we are the host/broadcaster
            if (streamId) {
                assignTopGuests(data.id, isPlayer1);
            }
        }
    };

    if (status === 'searching' && user) {
      interval = setInterval(checkMatch, 3000);
      checkMatch(); // Check immediately too
    }

    return () => clearInterval(interval);
  }, [status, user, streamId, assignTopGuests]);

  const handleFindOpponent = async () => {
    if (!user) {
      toast.error('You must be logged in to battle');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc('find_opponent', { p_user_id: user.id });
      
      if (error) throw error;

      if (data.status === 'matched') {
        // If RPC returns matched immediately (rare but possible if someone is waiting)
        // We still need to fetch opponent details if not provided fully
        // The polling effect will catch it, or we can set it here if RPC returns full object.
        // Let's rely on the polling/subscription for consistency or a second fetch.
        setStatus('searching'); // Will catch it in next poll
      } else {
        setStatus('searching');
      }
    } catch (err: any) {
      console.error('Error finding opponent:', err);
      setError(err.message || 'Failed to join matchmaking queue');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!user || !battleId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('skip_opponent', { 
        p_user_id: user.id,
        p_battle_id: battleId 
      });

      if (error) throw error;

      if (data.success) {
        setSkipsUsed(data.skips_used);
        setStatus('searching'); // Go back to searching
        setOpponent(null);
        setBattleId(null);
        toast.success('Opponent skipped. Searching for new match...');
      }
    } catch (err: any) {
      console.error('Error skipping:', err);
      toast.error(err.message || 'Failed to skip opponent');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmStart = () => {
    if (opponent && battleId) {
        onOpponentFound(opponent, battleId);
    }
  };

  return (
    <div className="bg-[#0E0A1A] border border-purple-700/40 p-6 rounded-xl space-y-6 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-blue-900/10 pointer-events-none" />
      
      {/* Header */}
      <div className="text-center relative z-10">
        <div className="inline-flex items-center justify-center p-3 bg-purple-900/30 rounded-full mb-3 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
          <Crown className="w-8 h-8 text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]" />
          <Swords className="w-6 h-6 text-purple-300 absolute -bottom-1 -right-1" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-wider uppercase font-['Orbitron']">
          <span className="text-purple-400">Troll</span> <span className="text-pink-500">Battles</span>
        </h2>
        <p className="text-sm text-purple-200/70 mt-1">Head-to-Head Live Competition</p>
      </div>

      {status === 'idle' && (
        <div className="space-y-6 relative z-10">
            {/* Rules Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#151226] p-4 rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-colors">
                    <Clock className="w-5 h-5 text-cyan-400 mb-2" />
                    <div className="text-sm font-bold text-white">3-Minute Match</div>
                    <div className="text-xs text-gray-400">Fast-paced battles</div>
                </div>
                <div className="bg-[#151226] p-4 rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-colors">
                    <User className="w-5 h-5 text-pink-400 mb-2" />
                    <div className="text-sm font-bold text-white">Random Match</div>
                    <div className="text-xs text-gray-400">Fair matchmaking</div>
                </div>
                <div className="bg-[#151226] p-4 rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-colors">
                    <Gift className="w-5 h-5 text-yellow-400 mb-2" />
                    <div className="text-sm font-bold text-white">Gifts = Score</div>
                    <div className="text-xs text-gray-400">Crowd decides winner</div>
                </div>
                <div className="bg-[#151226] p-4 rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-colors">
                    <Crown className="w-5 h-5 text-purple-400 mb-2" />
                    <div className="text-sm font-bold text-white">Weekly Rewards</div>
                    <div className="text-xs text-gray-400">Top 5 earn 500 Coins</div>
                </div>
            </div>

            <button
                onClick={handleFindOpponent}
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-lg shadow-lg shadow-purple-900/40 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Swords className="w-5 h-5" />}
                FIND OPPONENT
            </button>
        </div>
      )}

      {status === 'searching' && (
        <div className="py-12 text-center space-y-6 relative z-10">
            <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full animate-ping" />
                <div className="absolute inset-0 border-4 border-t-purple-500 rounded-full animate-spin" />
                <img 
                    src={profile?.avatar_url || 'https://via.placeholder.com/150'} 
                    className="absolute inset-2 rounded-full object-cover border-2 border-white/20"
                />
            </div>
            <div>
                <h3 className="text-xl font-bold text-white animate-pulse">Searching for Opponent...</h3>
                <p className="text-sm text-gray-400 mt-2">Matching you with a worthy troll</p>
            </div>
            <button
                onClick={() => setStatus('idle')} // Cancel search logic needed?
                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-full text-sm font-medium transition-colors"
            >
                Cancel Search
            </button>
        </div>
      )}

      {status === 'matched' && opponent && (
        <div className="space-y-6 relative z-10">
             <div className="flex items-center justify-between gap-4">
                {/* Me */}
                <div className="flex-1 text-center">
                    <div className="w-20 h-20 mx-auto rounded-full border-2 border-purple-500 p-1 bg-purple-900/50">
                        <img 
                            src={profile?.avatar_url} 
                            className="w-full h-full rounded-full object-cover"
                        />
                    </div>
                    <div className="mt-2 font-bold text-white">{profile?.username}</div>
                </div>

                {/* VS */}
                <div className="text-center">
                    <div className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                        VS
                    </div>
                </div>

                {/* Opponent */}
                <div className="flex-1 text-center">
                    <div className="w-20 h-20 mx-auto rounded-full border-2 border-red-500 p-1 bg-red-900/50">
                         <img 
                            src={opponent.avatar_url || 'https://via.placeholder.com/150'} 
                            className="w-full h-full rounded-full object-cover"
                        />
                    </div>
                    <div className="mt-2 font-bold text-white">{opponent.username}</div>
                    <div className="text-xs text-red-400">Lvl {opponent.level || 1}</div>
                </div>
             </div>

             <div className="flex gap-3">
                <button
                    onClick={handleSkip}
                    disabled={loading}
                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    <X className="w-4 h-4" />
                    Skip ({5 - skipsUsed > 0 ? `${5 - skipsUsed} free` : '5 Coins'})
                </button>
                <button
                    onClick={handleConfirmStart}
                    className="flex-[2] py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-2"
                >
                    <Swords className="w-5 h-5" />
                    BATTLE!
                </button>
             </div>
             
             {skipsUsed >= 5 && (
                <p className="text-xs text-center text-yellow-500/80 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Paid skip: 5 Troll Coins
                </p>
             )}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm text-center">
            {error}
        </div>
      )}
    </div>
  );
}
