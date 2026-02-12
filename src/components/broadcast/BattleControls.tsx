import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Stream } from '../../types/broadcast';
import { Swords, Loader2, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import UserNameWithAge from '../UserNameWithAge';

interface BattleControlsProps {
  currentStream: Stream;
}

export default function BattleControls({ currentStream }: BattleControlsProps) {
  const [loading, setLoading] = useState(false);
  const [pendingBattle, setPendingBattle] = useState<any>(null);
  const [matchStatus, setMatchStatus] = useState<string>(''); // 'searching', 'found', 'none'
    const [outgoingBattleId, setOutgoingBattleId] = useState<string | null>(null);
    const [skipLoading, setSkipLoading] = useState(false);

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
            .select('username, battle_wins')
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
        const { data: target, error } = await supabase.rpc('find_match_candidate', {
            p_stream_id: currentStream.id
        });
        
        if (error) throw error;
        
        const opponent = Array.isArray(target) && target.length > 0 ? target[0] : null;

        if (!opponent) {
            throw new Error("No suitable opponents found. Try again later!");
        }

        // Challenge the found opponent
        const { data: battleId, error: challengeError } = await supabase.rpc('create_battle_challenge', {
            p_challenger_id: currentStream.id,
            p_opponent_id: opponent.id
        });
        
        if (challengeError) throw challengeError;

        if (battleId) {
            setOutgoingBattleId(battleId);
        }
        
        toast.success(`Challenged ${opponent.title || 'Streamer'}! Waiting for accept...`);
        setMatchStatus('found');

    } catch (e: any) {
        console.error("Matchmaking error:", e);
        toast.error(e.message || "Failed to find match");
        setMatchStatus('');
        setOutgoingBattleId(null);
    } finally {
        setLoading(false);
    }
  };

  const handleSkipMatch = async () => {
    if (!outgoingBattleId || !currentStream.user_id) return;

    setSkipLoading(true);
    try {
        const { data: skipResult, error: skipError } = await supabase.rpc('record_battle_skip', {
            p_user_id: currentStream.user_id
        });

        if (skipError || skipResult?.success === false) {
            throw new Error(skipResult?.message || skipError?.message || 'Failed to skip');
        }

        const { error: cancelError } = await supabase.rpc('cancel_battle_challenge', {
            p_battle_id: outgoingBattleId,
            p_user_id: currentStream.user_id
        });

        if (cancelError) throw cancelError;

        const chargedText = skipResult?.charged ? ` (charged ${skipResult?.cost || 50} coins)` : '';
        toast.success(`Skipped opponent${chargedText}. Finding a new match...`);
        setMatchStatus('');
        setOutgoingBattleId(null);
        await findAndChallengeRandom();
    } catch (e: any) {
        toast.error(e.message || 'Failed to skip match');
    } finally {
        setSkipLoading(false);
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
    <div className="bg-zinc-900/90 border border-white/10 rounded-xl p-4 mt-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-4 text-amber-500">
            <Swords size={20} />
            <h3 className="font-bold text-lg">Troll Battles</h3>
        </div>

        {pendingBattle ? (
            <div className="bg-amber-500/10 border border-amber-500/50 p-4 rounded-lg animate-pulse">
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

                {matchStatus === 'found' && outgoingBattleId && (
                    <button
                        onClick={handleSkipMatch}
                        disabled={skipLoading}
                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 rounded-lg border border-white/10 flex items-center justify-center gap-2 transition-all"
                    >
                        {skipLoading ? <Loader2 className="animate-spin" size={16} /> : <SkipForward size={16} />}
                        Skip Opponent
                    </button>
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

// Helper for classNames
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
