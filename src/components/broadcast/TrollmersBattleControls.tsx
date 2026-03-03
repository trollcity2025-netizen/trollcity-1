import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Stream } from '../../types/broadcast';
import { Swords, Loader2, SkipForward, Crown, Users, Zap, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { getCategoryConfig } from '../../config/broadcastCategories';

interface OnlineUser {
  id: string;
  username: string;
  avatar_url?: string;
  role?: string;
  stream_id?: string;
}

interface BattleControlsProps {
  currentStream: Stream;
  onBattleAccepted?: () => void;
}

export default function TrollmersBattleControls({ currentStream, onBattleAccepted }: BattleControlsProps) {
  const [loading, setLoading] = useState(false);
  const [pendingBattle, setPendingBattle] = useState<any>(null);
  const [matchStatus, setMatchStatus] = useState<string>(''); // 'searching', 'found', 'none'
  const [outgoingBattleId, setOutgoingBattleId] = useState<string | null>(null);
  const [skipLoading, setSkipLoading] = useState(false);
  const [waitingForAccept, setWaitingForAccept] = useState(false);

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [trollmersStats, setTrollmersStats] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  // Poll for pending challenges and online users
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
            .select('id, username, battle_wins, created_at, troll_role')
            .order('battle_wins', { ascending: false })
            .limit(5);
        setLeaderboard(data || []);
    };

    const fetchTrollmersStats = async () => {
      const { data } = await supabase
        .from('trollmers_stats')
        .select('*')
        .eq('stream_id', currentStream.id)
        .maybeSingle();
      setTrollmersStats(data || null);
    };

    // Fetch online trollmers users
    const fetchOnlineUsers = async () => {
      // Get live trollmers streams
      const { data: liveStreams } = await supabase
        .from('streams')
        .select('id, user_id, title, category')
        .eq('status', 'live')
        .eq('category', 'trollmers')
        .neq('user_id', currentStream.user_id);
      
      if (liveStreams && liveStreams.length > 0) {
        const userIds = liveStreams.map(s => s.user_id);
        
        // Get profiles for these users
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url, role')
          .in('id', userIds);
        
        const users: OnlineUser[] = liveStreams.map(stream => {
          const profile = profiles?.find(p => p.id === stream.user_id);
          return {
            id: stream.user_id,
            username: profile?.username || 'Unknown',
            avatar_url: profile?.avatar_url,
            role: profile?.role,
            stream_id: stream.id,
          };
        });
        
        setOnlineUsers(users);
      } else {
        setOnlineUsers([]);
      }
    };

    const interval = setInterval(fetchPending, 3000);
    fetchPending();
    fetchLeaderboard();
    fetchTrollmersStats();
    fetchOnlineUsers();
    
    // Refresh online users every 10 seconds
    const onlineUsersInterval = setInterval(fetchOnlineUsers, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(onlineUsersInterval);
    };
  }, [currentStream.id, currentStream.user_id]);

  // Poll for outgoing battle status - for challenger to detect when battle becomes active
  useEffect(() => {
    if (!outgoingBattleId) {
      setWaitingForAccept(false);
      return;
    }

    setWaitingForAccept(true);

    const pollOutgoingBattle = async () => {
      const { data: battle } = await supabase
        .from('battles')
        .select('status')
        .eq('id', outgoingBattleId)
        .maybeSingle();

      if (battle?.status === 'active') {
        // Battle is active - challenger should also navigate to battle view
        if (onBattleAccepted) {
          onBattleAccepted();
        }
      } else if (battle?.status === 'ended' || battle?.status === 'cancelled') {
        // Battle was cancelled or ended without acceptance
        setOutgoingBattleId(null);
        setMatchStatus('');
        setWaitingForAccept(false);
      }
    };

    const pollInterval = setInterval(pollOutgoingBattle, 2000);
    pollOutgoingBattle(); // Check immediately

    return () => {
      clearInterval(pollInterval);
      setWaitingForAccept(false);
    };
  }, [outgoingBattleId, onBattleAccepted, supabase]);

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

        if (!opponent || !opponent.id) {
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
        // Show the actual error message from the server
        toast.error(e.message || "Failed to find match");
        setMatchStatus('');
        setOutgoingBattleId(null);
    } finally {
        setLoading(false);
    }
  };

  const handleSkipMatch = async () => {
    if (!outgoingBattleId || !currentStream || !currentStream.user_id) return;

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
    if (!pendingBattle || !pendingBattle.id) return;
    setLoading(true);
    try {
        console.log('[TrollmersBattleControls] Accepting battle:', pendingBattle.id);
        const { error } = await supabase.rpc('accept_battle', {
            p_battle_id: pendingBattle.id
        });
        if (error) {
            console.error('[TrollmersBattleControls] accept_battle error:', error);
            throw error;
        }
        toast.success("Battle Accepted! Loading Arena...");
        
        // Poll for battle status to become active, then refresh the page
        const pollBattleStatus = async () => {
            let attempts = 0;
            const maxAttempts = 20; // 10 seconds max wait
            
            const checkStatus = async () => {
                attempts++;
                const { data: battle } = await supabase
                    .from('battles')
                    .select('status, challenger_stream_id, opponent_stream_id')
                    .eq('id', pendingBattle.id)
                    .maybeSingle();
                
                console.log('[TrollmersBattleControls] Poll battle status:', battle?.status, 'attempt:', attempts);
                
                if (battle?.status === 'active') {
                    // Battle is active, refresh the page to show battle view
                    if (onBattleAccepted) {
                        onBattleAccepted();
                    }
                    return true;
                }
                return false;
            };
            
            while (attempts < maxAttempts) {
                const isActive = await checkStatus();
                if (isActive) break;
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // If we exit the loop without battle becoming active, show error
            if (attempts >= maxAttempts) {
                toast.error('Battle did not become active. The challenger may have ended their stream.');
                setPendingBattle(null);
            }
        };
        
        pollBattleStatus();
        
    } catch (e: any) {
        console.error('[TrollmersBattleControls] handleAccept error:', e);
        const errorMsg = e.message || "";
        
        // Handle specific error cases
        if (errorMsg.includes('Challenger stream not found') || errorMsg.includes('Opponent stream not found')) {
            toast.error('Cannot accept battle - the other streamer has ended their broadcast.');
            // Clear the pending battle since it can't be accepted
            setPendingBattle(null);
        } else if (errorMsg.includes('not live')) {
            toast.error('Cannot accept battle - the other streamer is no longer live.');
            setPendingBattle(null);
        } else if (errorMsg.includes('not pending')) {
            toast.error('This battle has already been accepted or cancelled.');
            setPendingBattle(null);
        } else {
            // Show other error messages
            toast.error(errorMsg || 'Failed to accept battle');
        }
    } finally {
        setLoading(false);
    }
  };

  // Invite a specific user to battle
  const inviteUserToBattle = async (user: OnlineUser) => {
    if (!user.stream_id) {
      toast.error('User is not currently streaming');
      return;
    }
    
    setInvitingUserId(user.id);
    try {
      const { data: battleId, error: challengeError } = await supabase.rpc('create_battle_challenge', {
        p_challenger_id: currentStream.id,
        p_opponent_id: user.stream_id
      });
      
      if (challengeError) throw challengeError;

      if (battleId) {
        setOutgoingBattleId(battleId);
        setMatchStatus('found');
        toast.success(`Invited ${user.username} to battle! Waiting for accept...`);
      }
    } catch (e: any) {
      console.error('Invite error:', e);
      toast.error(e.message || 'Failed to send invite');
    } finally {
      setInvitingUserId(null);
    }
  };

  // Enhanced trollmers-specific features
  const handleTrollmersSpecial = async () => {
    if (!trollmersStats) return;
    
    // Trollmers special abilities
    if (trollmersStats.special_ability_cooldown > Date.now()) {
      toast.error(`Special ability on cooldown! Available in ${Math.ceil((trollmersStats.special_ability_cooldown - Date.now()) / 1000)}s`);
      return;
    }

    try {
      const { error } = await supabase.rpc('activate_trollmers_ability', {
        p_stream_id: currentStream.id,
        p_ability_type: 'chaos_field'
      });

      if (error) {
        toast.error(error.message || "Failed to activate ability");
        return;
      }

      toast.success("Chaos Field Activated! Disrupting opponent's controls...");
      
      // Update stats
      setTrollmersStats(prev => prev ? { ...prev, special_ability_cooldown: Date.now() + 30000 } : null);
    } catch (e: any) {
      console.error("Trollmers ability error:", e);
      toast.error("Failed to activate ability");
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
        {/* Horizontal Layout Container */}
        <div className="flex flex-col lg:flex-row gap-4">
            {/* Left Side: Battle Actions */}
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-3 text-amber-500">
                    <Swords size={18} />
                    <h3 className="font-bold">Trollmers Head to Head</h3>
                    <Crown size={14} className="text-yellow-400 animate-pulse" />
                </div>

                {pendingBattle ? (
                    <div className="bg-amber-500/10 border border-amber-500/50 p-3 rounded-lg animate-pulse">
                        <p className="text-amber-200 font-bold mb-2 text-sm">Incoming Challenge!</p>
                        <button 
                            onClick={handleAccept}
                            disabled={loading}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-2 rounded-lg transition text-sm"
                        >
                            {loading ? <Loader2 className="animate-spin mx-auto" size={16} /> : "ACCEPT BATTLE"}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs text-zinc-400">
                            Find a worthy opponent! The system will match you with a random broadcaster.
                        </p>
                        
                        <div className="flex flex-wrap gap-2">
                            <button 
                                onClick={findAndChallengeRandom}
                                disabled={loading || matchStatus === 'searching'}
                                className="flex-1 min-w-[140px] bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} />
                                        Finding...
                                    </>
                                ) : (
                                    <>
                                        <Swords size={16} />
                                        FIND MATCH
                                    </>
                                )}
                            </button>

                            {matchStatus === 'found' && outgoingBattleId && !waitingForAccept && (
                                <button
                                    onClick={handleSkipMatch}
                                    disabled={skipLoading}
                                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg border border-white/10 flex items-center justify-center gap-2 transition-all text-sm"
                                >
                                    {skipLoading ? <Loader2 className="animate-spin" size={14} /> : <SkipForward size={14} />}
                                    Skip
                                </button>
                            )}

                            {matchStatus === 'found' && outgoingBattleId && waitingForAccept && (
                                <button
                                    onClick={async () => {
                                        if (!outgoingBattleId || !currentStream.user_id) return;
                                        setSkipLoading(true);
                                        try {
                                            const { error: cancelError } = await supabase.rpc('cancel_battle_challenge', {
                                                p_battle_id: outgoingBattleId,
                                                p_user_id: currentStream.user_id
                                            });
                                            if (cancelError) throw cancelError;
                                            setMatchStatus('');
                                            setOutgoingBattleId(null);
                                            setWaitingForAccept(false);
                                            toast.success('Challenge cancelled. Find a new match!');
                                        } catch (e: any) {
                                            toast.error(e.message || 'Failed to cancel challenge');
                                        } finally {
                                            setSkipLoading(false);
                                        }
                                    }}
                                    disabled={skipLoading}
                                    className="px-4 py-2 bg-red-900/50 hover:bg-red-800 text-red-200 font-bold rounded-lg border border-red-500/30 flex items-center justify-center gap-2 transition-all text-sm"
                                >
                                    {skipLoading ? <Loader2 className="animate-spin" size={14} /> : <SkipForward size={14} />}
                                    Cancel
                                </button>
                            )}
                        </div>

                        {matchStatus === 'found' && (
                            <div className="text-center text-xs text-green-400 animate-pulse">
                                {waitingForAccept ? 'Waiting for opponent to accept...' : 'Challenge sent! Waiting for opponent to accept...'}
                            </div>
                        )}

                        {/* Trollmers Special Abilities */}
                        {trollmersStats && (
                          <div className="pt-2 border-t border-white/10 mt-2">
                            <button
                              onClick={handleTrollmersSpecial}
                              disabled={loading || (trollmersStats.special_ability_cooldown > Date.now())}
                              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                            >
                              <Zap size={14} />
                              Activate Chaos Field
                              {trollmersStats.special_ability_cooldown > Date.now() && (
                                <span className="ml-2 text-xs bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                                  {Math.ceil((trollmersStats.special_ability_cooldown - Date.now()) / 1000)}s
                                </span>
                              )}
                            </button>
                          </div>
                        )}
                    </div>
                )}
            </div>

            {/* Right Side: Online Users to Invite */}
            <div className="lg:w-64 xl:w-72 border-t lg:border-t-0 lg:border-l border-white/10 pt-3 lg:pt-0 lg:pl-4">
                <h4 className="text-zinc-400 font-bold text-xs uppercase mb-2 flex items-center gap-2">
                    <Users size={12} className="text-green-500" />
                    Online Trollmers ({onlineUsers.length})
                </h4>
                <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-hide">
                    {onlineUsers.length === 0 ? (
                        <div className="text-xs text-zinc-500 text-center py-4">
                            No other live Trollmers streams
                        </div>
                    ) : (
                        onlineUsers.map((user) => (
                            <div key={user.id} className="flex justify-between items-center bg-black/20 p-2 rounded text-xs border border-white/5">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-zinc-300 font-medium truncate">
                                        {user.username}
                                    </span>
                                    {user.role && (
                                      <span className="text-[10px] bg-purple-500/20 px-1 py-0.5 rounded text-zinc-400">
                                        {user.role}
                                      </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => inviteUserToBattle(user)}
                                    disabled={invitingUserId === user.id || matchStatus === 'found'}
                                    className="ml-2 px-2 py-1 bg-green-600/80 hover:bg-green-500 text-white rounded text-[10px] font-bold transition disabled:opacity-50 flex items-center gap-1"
                                >
                                    {invitingUserId === user.id ? (
                                        <Loader2 className="animate-spin" size={10} />
                                    ) : (
                                        <UserPlus size={10} />
                                    )}
                                    Invite
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    </div>
  );
}

// Helper for classNames
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}