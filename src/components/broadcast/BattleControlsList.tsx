import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Stream } from '../../types/broadcast';
import { Swords, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import UserNameWithAge from '../UserNameWithAge';
import { cn } from '../../lib/utils';

interface BattleControlsListProps {
  currentStream: Stream;
}

export default function BattleControlsList({ currentStream }: BattleControlsListProps) {
  const [loading, setLoading] = useState(false);
  const [pendingBattle, setPendingBattle] = useState<any>(null);
  const [matchStatus, setMatchStatus] = useState<string>(''); // 'searching', 'found', 'none'

  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // Poll for pending challenges
  useEffect(() => {
    const fetchPending = async () => {
        // Check if I have been challenged (opponent_stream_id = my id)
        const { data } = await supabase
            .from('battles')
            .select('*')
            .eq('opponent_stream_id', currentStream.id)
            .eq('status', 'pending')
            .maybeSingle();
        
        if (data) setPendingBattle(data);
    };

    const fetchLeaderboard = async () => {
        const { data } = await supabase
            .from('user_profiles')
            .select('id, username, battle_wins, created_at')
            .order('battle_wins', { ascending: false })
            .limit(5);
        setLeaderboard(data || []);
    };

    const interval = setInterval(fetchPending, 3000);
    fetchPending();
    fetchLeaderboard();

    return () => clearInterval(interval);
  }, [currentStream.id]);

  const findAndChallengeRandom = async () => {
    if (matchStatus === 'searching') return;
    
    setLoading(true);
    setMatchStatus('searching');

    try {
        // Use RPC to find a valid opponent (excludes recent opponents, busy streams, etc.)
        const { data: target, error } = await supabase.rpc('find_match_candidate', {
            p_stream_id: currentStream.id
        });
        
        if (error) throw error;
        
        // rpc returns a single row if using maybeSingle or an array? 
        // RETURNS TABLE returns rows. We used LIMIT 1.
        // If no rows, data might be [] or null depending on client.
        
        // Since we used RETURNS TABLE, it returns an array of objects.
        const opponent = Array.isArray(target) && target.length > 0 ? target[0] : null;

        if (!opponent) {
            throw new Error("No suitable opponents found. Try again later!");
        }

        // Challenge the found opponent
        const { error: challengeError } = await supabase.rpc('create_battle_challenge', {
            p_challenger_id: currentStream.id,
            p_opponent_id: opponent.id
        });
        
        if (challengeError) throw challengeError;
        
        toast.success(`Challenged ${opponent.title || 'Streamer'}! Waiting for accept...`);
        setMatchStatus('found');

    } catch (e: any) {
        console.error("Matchmaking error:", e);
        toast.error(e.message || "Failed to find match");
        setMatchStatus('');
    } finally {
        setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!pendingBattle) return;
    setLoading(true);
    try {
        const { error } = await supabase.rpc('accept_battle', {
            p_battle_id: pendingBattle.id
        });
        if (error) throw error;
        toast.success("Battle Accepted! Loading Arena...");
    } catch (e: any) {
        // Don't show "no suitable" errors - it means it actually connected
        const errorMsg = e.message || "";
        if (errorMsg && !errorMsg.includes("Battl")) {
            toast.error(errorMsg);
        }
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="w-full">
        {pendingBattle ? (
            <div className="bg-amber-500/10 border border-amber-500/50 p-4 rounded-lg animate-pulse mb-4">
                <p className="text-amber-200 font-bold mb-2">Incoming Challenge!</p>
                <button 
                    onClick={handleAccept}
                    disabled={loading}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-2 rounded-lg transition"
                >
                    {loading ? <Loader2 className="animate-spin mx-auto" /> : "ACCEPT BATTLE"}
                </button>
            </div>
        ) : (
            <div className="space-y-4">
                <p className="text-sm text-zinc-400">
                    Find a worthy opponent! The system will match you with a random broadcaster you haven&apos;t battled yet.
                </p>
                
                <button 
                    onClick={findAndChallengeRandom}
                    disabled={loading || matchStatus === 'searching'}
                    className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                    {loading ? (
                        <>
                            <Loader2 className="animate-spin" />
                            Finding Match...
                        </>
                    ) : (
                        <>
                            <Swords size={20} />
                            FIND RANDOM MATCH
                        </>
                    )}
                </button>

                {matchStatus === 'found' && (
                    <div className="text-center text-xs text-green-400 animate-pulse">
                        Challenge sent! Waiting for opponent to accept...
                    </div>
                )}

                {/* Leaderboard */}
                {leaderboard.length > 0 && (
                    <div className="mt-6 border-t border-white/10 pt-4">
                        <h4 className="text-zinc-400 font-bold text-xs uppercase mb-3 flex items-center gap-2">
                            <Swords size={12} className="text-amber-500" />
                            Top Battlers
                        </h4>
                        <div className="space-y-2">
                            {leaderboard.map((p, i) => (
                                <div key={i} className="flex justify-between items-center bg-black/20 p-2 rounded text-sm border border-white/5">
                                    <div className="flex items-center gap-2">
                                        <span className={cn("font-mono font-bold w-4 text-center", 
                                            i === 0 ? "text-yellow-400" : 
                                            i === 1 ? "text-zinc-400" : 
                                            i === 2 ? "text-amber-700" : "text-zinc-600"
                                        )}>
                                            {i+1}
                                        </span>
                                        <UserNameWithAge 
                                            user={{
                                                username: p.username || 'Unknown',
                                                id: p.id,
                                                created_at: p.created_at
                                            }}
                                            className="text-zinc-300 font-medium truncate max-w-[120px]"
                                        />
                                    </div>
                                    <span className="text-amber-500 font-bold text-xs bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                        {p.battle_wins} Wins
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}
    </div>
  );
}
