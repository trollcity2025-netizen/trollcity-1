import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Stream } from '../../types/broadcast';
import { Swords, Loader2, Crown, Users, LogOut, UserPlus, Radio, Timer, Trophy, Flame } from 'lucide-react';
import { toast } from 'sonner';

interface OnlineBroadcaster {
  id: string;
  username: string;
  avatar_url?: string;
  stream_id: string;
  title: string;
}

interface PendingChallenge {
  id: string;
  challenger_stream_id: string;
  challenger_name: string;
  created_at: string;
}

interface BattleScore {
  stream_id: string;
  score: number;
  username?: string;
}

interface BattleControlsProps {
  currentStream: Stream;
  onBattleAccepted?: () => void;
}

export default function TrollmersBattleControls({ currentStream, onBattleAccepted }: BattleControlsProps) {
  const [loading, setLoading] = useState(false);
  const [battleStatus, setBattleStatus] = useState<'idle' | 'waiting' | 'battling'>('idle');
  const [battleId, setBattleId] = useState<string | null>(null);
  const [opponentInfo, setOpponentInfo] = useState<any>(null);
  const [onlineBroadcasters, setOnlineBroadcasters] = useState<OnlineBroadcaster[]>([]);
  const [pendingChallenges, setPendingChallenges] = useState<PendingChallenge[]>([]);
  const [myChallengeId, setMyChallengeId] = useState<string | null>(null);
  
  // Battle timer state
  const [battleTimeRemaining, setBattleTimeRemaining] = useState<number>(180);
  const [battleTimerActive, setBattleTimerActive] = useState(false);
  
  // Battle score state
  const [battleScores, setBattleScores] = useState<BattleScore[]>([]);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  
  // Countdown state
  const [countdown, setCountdown] = useState<number | null>(null);

  // Fetch online broadcasters (other live streams)
  const fetchOnlineBroadcasters = useCallback(async () => {
    console.log('[Trollmers] Fetching online broadcasters, excluding user:', currentStream.user_id);
    
    // First get live streams
    const { data: liveStreams, error: streamsError } = await supabase
      .from('streams')
      .select('id, user_id, title')
      .eq('status', 'live')
      .neq('user_id', currentStream.user_id)
      .limit(20);
    
    if (streamsError) {
      console.error('[Trollmers] Error fetching streams:', streamsError);
      return;
    }
    
    console.log('[Trollmers] Found live streams:', liveStreams?.length || 0);
    
    if (liveStreams && liveStreams.length > 0) {
      // Get user IDs from streams
      const userIds = liveStreams.map(s => s.user_id).filter(Boolean);
      
      if (userIds.length === 0) {
        setOnlineBroadcasters([]);
        return;
      }
      
      // Fetch profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);
      
      if (profilesError) {
        console.error('[Trollmers] Error fetching profiles:', profilesError);
        // Still show broadcasters even without profiles
        const broadcasters: OnlineBroadcaster[] = liveStreams.map(stream => ({
          id: stream.user_id,
          username: 'Unknown',
          avatar_url: undefined,
          stream_id: stream.id,
          title: stream.title || 'Untitled Stream',
        }));
        setOnlineBroadcasters(broadcasters);
        return;
      }
      
      // Create a map for quick lookup
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      const broadcasters: OnlineBroadcaster[] = liveStreams.map(stream => {
        const profile = profileMap.get(stream.user_id);
        return {
          id: stream.user_id,
          username: profile?.username || 'Unknown',
          avatar_url: profile?.avatar_url,
          stream_id: stream.id,
          title: stream.title || 'Untitled Stream',
        };
      });
      
      console.log('[Trollmers] Broadcasters found:', broadcasters.length);
      setOnlineBroadcasters(broadcasters);
    } else {
      setOnlineBroadcasters([]);
    }
  }, [currentStream.user_id]);

  // Check for open pending challenges (any broadcaster can accept)
  const checkPendingChallenges = useCallback(async () => {
    // Fetch open challenges where opponent_stream_id is null (open to anyone)
    // OR challenges specifically targeted at this stream
    const { data: challenges, error } = await supabase
      .from('battle_challenges')
      .select(`
        id,
        challenger_stream_id,
        created_at,
        streams!battle_challenges_challenger_stream_id_fkey(
          user_id,
          title,
          user_profiles(username, avatar_url)
        )
      `)
      .eq('status', 'pending')
      .or(`opponent_stream_id.is.null,opponent_stream_id.eq.${currentStream.id}`)
      .neq('challenger_stream_id', currentStream.id) // Don't show my own challenges
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error checking challenges:', error);
      return;
    }

    if (challenges && challenges.length > 0) {
      const enrichedChallenges: PendingChallenge[] = challenges.map((challenge: any) => ({
        id: challenge.id,
        challenger_stream_id: challenge.challenger_stream_id,
        challenger_name: challenge.streams?.user_profiles?.username || 'Unknown',
        created_at: challenge.created_at,
      }));
      
      setPendingChallenges(enrichedChallenges);
    } else {
      setPendingChallenges([]);
    }

    // Check if this stream has an active challenge they created
    const { data: myChallenge } = await supabase
      .from('battle_challenges')
      .select('id, status')
      .eq('challenger_stream_id', currentStream.id)
      .eq('status', 'pending')
      .maybeSingle();
    
    if (myChallenge) {
      setMyChallengeId(myChallenge.id);
      setBattleStatus('waiting');
    } else if (battleStatus === 'waiting' && !myChallenge) {
      setBattleStatus('idle');
      setMyChallengeId(null);
    }
  }, [currentStream.id, battleStatus]);

  // Check battle status and timer
  const checkBattleStatus = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_battle_status', {
      p_stream_id: currentStream.id
    });
    
    if (error) {
      console.error('Error checking battle status:', error);
      return;
    }
    
    if (data?.in_battle && data?.battle_id) {
      if (battleStatus !== 'battling') {
        console.log('[TrollmersBattleControls] Battle detected! Transitioning to battle mode...');
        
        setBattleStatus('battling');
        setBattleId(data.battle_id);
        setBattleTimerActive(true);
        
        // Start countdown
        setCountdown(3);
        
        // Fetch opponent info
        if (data.opponent_stream_id) {
          const { data: opponentData } = await supabase
            .from('streams')
            .select('id, user_id, title')
            .eq('id', data.opponent_stream_id)
            .single();
            
          if (opponentData) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('username, avatar_url')
              .eq('id', opponentData.user_id)
              .single();
              
            setOpponentInfo({
              ...opponentData,
              ...profile
            });
          }
        }
        
        if (onBattleAccepted) {
          console.log('[TrollmersBattleControls] Calling onBattleAccepted to merge broadcasts...');
          onBattleAccepted();
        }
      }
      
      // Update battle timer if available
      if (data.remaining_seconds !== undefined) {
        setBattleTimeRemaining(data.remaining_seconds);
      }
    } else if (!data?.in_battle && battleStatus === 'battling') {
      // Battle ended
      setBattleStatus('idle');
      setBattleId(null);
      setOpponentInfo(null);
      setBattleTimerActive(false);
      setBattleScores([]);
      setMyScore(0);
      setOpponentScore(0);
    }
  }, [currentStream.id, battleStatus, onBattleAccepted]);
  
  // Fetch battle scores
  const fetchBattleScores = useCallback(async () => {
    if (!battleId) return;
    
    const { data, error } = await supabase
      .from('battle_scores')
      .select('*')
      .eq('battle_id', battleId);
      
    if (error) {
      console.error('Error fetching battle scores:', error);
      return;
    }
    
    if (data) {
      setBattleScores(data);
      
      // Update my score and opponent score
      const myScoreData = data.find((s: any) => s.stream_id === currentStream.id);
      const opponentScoreData = data.find((s: any) => s.stream_id !== currentStream.id);
      
      if (myScoreData) setMyScore(myScoreData.score);
      if (opponentScoreData) setOpponentScore(opponentScoreData.score);
    }
  }, [battleId, currentStream.id]);

  // Poll for updates
  useEffect(() => {
    fetchOnlineBroadcasters();
    checkPendingChallenges();
    checkBattleStatus();
    
    const interval = setInterval(() => {
      fetchOnlineBroadcasters();
      checkPendingChallenges();
      checkBattleStatus();
      if (battleStatus === 'battling') {
        fetchBattleScores();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [fetchOnlineBroadcasters, checkPendingChallenges, checkBattleStatus, fetchBattleScores, battleStatus]);
  
  // Countdown timer effect
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [countdown]);
  
  // Battle timer effect
  useEffect(() => {
    if (!battleTimerActive || battleTimeRemaining <= 0) return;
    
    const timer = setInterval(() => {
      setBattleTimeRemaining(prev => {
        if (prev <= 1) {
          setBattleTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [battleTimerActive, battleTimeRemaining]);

  // Realtime subscription for instant battle detection
  useEffect(() => {
    if (!currentStream.id) return;
    
    const channel = supabase
      .channel(`stream-battle:${currentStream.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${currentStream.id}`
        },
        (payload) => {
          const newStream = payload.new as any;
          if (newStream.is_battle && battleStatus !== 'battling') {
            console.log('[TrollmersBattleControls] Battle detected via realtime!');
            checkBattleStatus();
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentStream.id, battleStatus]);

  // Realtime subscription for challenge updates (to remove accepted challenges immediately)
  useEffect(() => {
    if (!currentStream.id) return;
    
    const channel = supabase
      .channel('battle-challenges')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battle_challenges',
        },
        (payload) => {
          const updatedChallenge = payload.new as any;
          // If a challenge was accepted, remove it from pending list
          if (updatedChallenge.status === 'accepted') {
            setPendingChallenges(prev =>
              prev.filter(c => c.id !== updatedChallenge.id)
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'battle_challenges',
        },
        () => {
          // New challenge created, refresh the list
          checkPendingChallenges();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentStream.id]);

  // Create an OPEN battle challenge (any broadcaster can accept)
  const handleFindMatch = async () => {
    if (loading || onlineBroadcasters.length === 0) return;
    
    setLoading(true);
    
    try {
      // Check if a pending challenge already exists for this stream
      const { data: existingChallenge, error: checkError } = await supabase
        .from('battle_challenges')
        .select('id')
        .eq('challenger_stream_id', currentStream.id)
        .eq('status', 'pending')
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      if (existingChallenge) {
        toast.info('You already have a pending challenge');
        setMyChallengeId(existingChallenge.id);
        setBattleStatus('waiting');
        setLoading(false);
        return;
      }
      
      // Create an OPEN challenge - any broadcaster can accept
      const { data: challenge, error } = await supabase
        .from('battle_challenges')
        .insert({
          challenger_stream_id: currentStream.id,
          challenger_user_id: currentStream.user_id,
          opponent_stream_id: null, // Open to anyone
          opponent_user_id: null,
          status: 'pending',
        })
        .select('id')
        .single();
      
      if (error) throw error;
      
      if (challenge) {
        setMyChallengeId(challenge.id);
        setBattleStatus('waiting');
        toast.info('Open challenge created! Waiting for any broadcaster to accept...');
      }
    } catch (e: any) {
      console.error('Find match error:', e);
      toast.error(e.message || 'Failed to find match');
    } finally {
      setLoading(false);
    }
  };

  // Accept a battle challenge - First come first served
  const handleAcceptChallenge = async (challengeId: string, challengerStreamId: string) => {
    if (loading) return;
    
    setLoading(true);
    
    try {
      // Step 1: Try to claim the challenge by updating it with our stream ID
      // This is an atomic operation - only one broadcaster will succeed
      const { data: updatedChallenge, error: updateError } = await supabase
        .from('battle_challenges')
        .update({
          opponent_stream_id: currentStream.id,
          opponent_user_id: currentStream.user_id,
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', challengeId)
        .eq('status', 'pending') // Only update if still pending
        .select()
        .single();
      
      if (updateError || !updatedChallenge) {
        toast.error('This challenge was already accepted by someone else!');
        setLoading(false);
        return;
      }
      
      // Step 2: Create the battle
      const { data: battleData, error: battleError } = await supabase.rpc('create_battle_challenge', {
        p_challenger_id: challengerStreamId,
        p_opponent_id: currentStream.id
      });
      
      if (battleError) throw battleError;
      if (!battleData) throw new Error('Failed to create battle');
      
      // Step 3: Accept the battle
      const { error: acceptError } = await supabase.rpc('accept_battle', {
        p_battle_id: battleData
      });
      
      if (acceptError) throw acceptError;
      
      // Step 4: Update streams to battle mode
      await supabase
        .from('streams')
        .update({ is_battle: true, battle_id: battleData })
        .eq('id', currentStream.id);
      
      await supabase
        .from('streams')
        .update({ is_battle: true, battle_id: battleData })
        .eq('id', challengerStreamId);
      
      setBattleId(battleData);
      setBattleStatus('battling');
      
      // Step 5: Get challenger info
      const { data: challengerData } = await supabase
        .from('streams')
        .select('id, user_id, title')
        .eq('id', challengerStreamId)
        .single();
        
      if (challengerData) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('username, avatar_url')
          .eq('id', challengerData.user_id)
          .single();
          
        setOpponentInfo({
          ...challengerData,
          ...profile
        });
      }
      
      toast.success('Battle accepted! You got it first! Merging broadcasts...');
      if (onBattleAccepted) onBattleAccepted();
    } catch (e: any) {
      console.error('Accept challenge error:', e);
      toast.error(e.message || 'Failed to accept challenge');
    } finally {
      setLoading(false);
    }
  };

  // Cancel my challenge
  const handleCancelChallenge = async () => {
    if (!myChallengeId) return;
    
    try {
      await supabase
        .from('battle_challenges')
        .delete()
        .eq('id', myChallengeId);
      
      setMyChallengeId(null);
      setBattleStatus('idle');
      toast.success('Challenge cancelled');
    } catch (e) {
      console.error('Cancel challenge error:', e);
    }
  };

  // End battle
  const handleEndBattle = async () => {
    if (!battleId) return;
    
    try {
      const { data, error } = await supabase.rpc('end_battle_with_rewards', {
        p_battle_id: battleId,
        p_winner_stream_id: null
      });
      
      if (!error && data?.success) {
        toast.success('Battle ended');
        setBattleStatus('idle');
        setBattleId(null);
        setOpponentInfo(null);
        setBattleTimerActive(false);
        
        await supabase
          .from('streams')
          .update({ is_battle: false, battle_id: null })
          .eq('id', currentStream.id);
      }
    } catch (e) {
      console.error('End battle error:', e);
      toast.error('Failed to end battle');
    }
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-zinc-900/90 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-3 text-amber-500">
        <Swords size={18} />
        <h3 className="font-bold">Trollmers Head to Head</h3>
        <Crown size={14} className="text-yellow-400 animate-pulse" />
      </div>

      {/* Countdown Overlay */}
      {countdown !== null && countdown > 0 && battleStatus === 'battling' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center">
            <p className="text-6xl font-bold text-amber-500 animate-pulse">{countdown}</p>
            <p className="text-white mt-4">Battle Starting...</p>
          </div>
        </div>
      )}

      {/* IDLE STATE */}
      {battleStatus === 'idle' && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">
            Battle other Trollmers broadcasters! Winner earns 10 crowns.
          </p>
          
          {pendingChallenges.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-amber-400 font-bold">Incoming Challenges:</p>
              {pendingChallenges.map((challenge) => (
                <div key={challenge.id} className="bg-amber-500/10 border border-amber-500/30 p-2 rounded-lg">
                  <p className="text-sm text-white font-medium">{challenge.challenger_name}</p>
                  <p className="text-xs text-zinc-400 mb-2">wants to battle!</p>
                  <button
                    onClick={() => handleAcceptChallenge(challenge.id, challenge.challenger_stream_id)}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <>
                        <UserPlus size={14} />
                        ACCEPT MATCH
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <button
            onClick={handleFindMatch}
            disabled={loading || onlineBroadcasters.length === 0}
            className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <>
                <Radio size={18} />
                FIND MATCH
              </>
            )}
          </button>
          
          {onlineBroadcasters.length === 0 && (
            <p className="text-xs text-red-400 text-center">
              No other broadcasters online. Wait for someone to go live!
            </p>
          )}
          
          {onlineBroadcasters.length > 0 && (
            <p className="text-xs text-green-400 text-center">
              {onlineBroadcasters.length} broadcaster{onlineBroadcasters.length !== 1 ? 's' : ''} available
            </p>
          )}
        </div>
      )}

      {/* WAITING STATE */}
      {battleStatus === 'waiting' && (
        <div className="space-y-3">
          <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg">
            <p className="text-amber-200 text-sm text-center font-bold">
              Challenge Sent!
            </p>
            <p className="text-amber-300 text-xs text-center mt-1">
              Waiting for opponent to accept...
            </p>
            <div className="flex justify-center mt-2">
              <Loader2 className="animate-spin text-amber-500" size={20} />
            </div>
          </div>
          
          <button
            onClick={handleCancelChallenge}
            className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <LogOut size={16} />
            Cancel
          </button>
        </div>
      )}

      {/* BATTLING STATE */}
      {battleStatus === 'battling' && (
        <div className="space-y-3">
          {/* Battle Timer */}
          <div className="bg-gradient-to-r from-amber-500/20 to-red-500/20 border border-amber-500/30 p-3 rounded-lg">
            <div className="flex items-center justify-center gap-2">
              <Timer size={18} className="text-amber-400" />
              <span className="text-2xl font-bold text-amber-400">
                {formatTime(battleTimeRemaining)}
              </span>
            </div>
          </div>
          
          {/* Battle Scores */}
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-400">Battle Score</span>
              <Trophy size={14} className="text-yellow-400" />
            </div>
            
            {/* My Score */}
            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-green-400">You</span>
                <span className="text-green-400 font-bold">{myScore}</span>
              </div>
              <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all"
                  style={{ width: `${Math.min((myScore / Math.max(myScore + opponentScore, 1)) * 100, 100)}%` }}
                />
              </div>
            </div>
            
            {/* Opponent Score */}
            {opponentInfo && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-red-400">{opponentInfo.username}</span>
                  <span className="text-red-400 font-bold">{opponentScore}</span>
                </div>
                <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-red-500 to-rose-500 transition-all"
                    style={{ width: `${Math.min((opponentScore / Math.max(myScore + opponentScore, 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Battle Status */}
          <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <p className="text-green-400 font-bold">
                Battle Live!
              </p>
            </div>
            {opponentInfo && (
              <p className="text-zinc-300 text-sm text-center">
                vs {opponentInfo.username}
              </p>
            )}
            <div className="flex items-center justify-center gap-1 mt-2">
              <Flame size={14} className="text-orange-400" />
              <span className="text-xs text-zinc-500">Gift to score points!</span>
            </div>
          </div>
          
          <button
            onClick={handleEndBattle}
            className="w-full bg-red-900/50 hover:bg-red-800 text-red-200 font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition text-sm"
          >
            <LogOut size={14} />
            End Battle
          </button>
        </div>
      )}

      {/* Online Broadcasters List */}
      <div className="mt-4 pt-3 border-t border-white/10">
        <h4 className="text-zinc-400 font-bold text-xs uppercase mb-2 flex items-center gap-2">
          <Users size={12} className="text-green-500" />
          Online Broadcasters ({onlineBroadcasters.length})
        </h4>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {onlineBroadcasters.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-2">
              No other live streams
            </p>
          ) : (
            onlineBroadcasters.map((broadcaster) => (
              <div 
                key={broadcaster.id} 
                className="flex items-center justify-between bg-black/20 p-2 rounded text-xs"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-zinc-300 truncate">{broadcaster.username}</span>
                </div>
                <span className="text-[10px] text-zinc-500 truncate max-w-[80px]">
                  {broadcaster.title}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
