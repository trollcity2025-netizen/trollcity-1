import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

export type BattleStatus = 'idle' | 'waiting_for_opponent' | 'pending_locked' | 'countdown' | 'active' | 'ended' | 'cancelled';

export interface BattleState {
  active: boolean;
  battleId: string | null;
  teamACaptain: string | null;
  teamBCaptain: string | null;
  teamAMembers: string[];
  teamBMembers: string[];
  teamAScore: number;
  teamBScore: number;
  startedAt: Date | null;
  endsAt: Date | null;
  suddenDeath: boolean;
  status: BattleStatus;
  scheduledStartAt: Date | null;
}

export interface BattleSupporter {
  userId: string;
  team: 'broadcaster' | 'challenger';
}

export interface UseBattleStateProps {
  streamId: string;
  localUserId: string;
  isHost: boolean;
  hostId?: string;
}

export function useBattleState({ streamId, localUserId, isHost, hostId }: UseBattleStateProps) {
  const { profile } = useAuthStore();
  const [battleState, setBattleState] = useState<BattleState>({
    active: false,
    battleId: null,
    teamACaptain: null,
    teamBCaptain: null,
    teamAMembers: [],
    teamBMembers: [],
    teamAScore: 0,
    teamBScore: 0,
    startedAt: null,
    endsAt: null,
    suddenDeath: false,
    status: 'idle',
    scheduledStartAt: null,
  });
  const [supporters, setSupporters] = useState<Map<string, BattleSupporter>>(new Map());
  const [userTeam, setUserTeam] = useState<'broadcaster' | 'challenger' | null>(null);
  const [joinWindowOpen, setJoinWindowOpen] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0); // in seconds
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const joinWindowTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerSyncChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Listen for timer sync broadcasts from the host
  useEffect(() => {
    if (!battleState.battleId || !battleState.active) return;

    const timerChannel = supabase.channel(`battle_timer:${battleState.battleId}`);
    timerChannel.on('broadcast', { event: 'timer_sync' }, (payload) => {
      const syncData = payload.payload;
      if (syncData && syncData.timeLeft !== undefined) {
        setRemainingTime(syncData.timeLeft);
        if (syncData.isSuddenDeath !== undefined) {
          setBattleState(prev => ({ ...prev, suddenDeath: syncData.isSuddenDeath }));
        }
      }
    }).subscribe();

    timerSyncChannelRef.current = timerChannel;

    return () => {
      if (timerSyncChannelRef.current) {
        supabase.removeChannel(timerSyncChannelRef.current);
      }
    };
  }, [battleState.battleId, battleState.active]);
  
  // ✅ SINGLE BATTLE STATE CHANNEL
  // ALL CLIENTS SUBSCRIBE TO THIS. ONLY UPDATE FROM SERVER RECORD.
  useEffect(() => {
    if (!battleState.battleId) return;
    
    const battleChannel = supabase.channel(`battle:${battleState.battleId}`);
    
    battleChannel
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'battles',
        filter: `id=eq.${battleState.battleId}`
      }, (payload) => {
        const battle = payload.new;
        
        // ✅ ONLY UPDATE STATE FROM SERVER RECORD
        setBattleState({
          active: battle.status === 'active',
          battleId: battle.id,
          teamACaptain: battle.team_a_captain,
          teamBCaptain: battle.team_b_captain,
          teamAMembers: battle.team_a_member_ids || [],
          teamBMembers: battle.team_b_member_ids || [],
          teamAScore: battle.team_a_score || 0,
          teamBScore: battle.team_b_score || 0,
          startedAt: battle.started_at ? new Date(battle.started_at) : null,
          endsAt: battle.ends_at ? new Date(battle.ends_at) : null,
          suddenDeath: false,
          status: battle.status,
          scheduledStartAt: battle.scheduled_start_at ? new Date(battle.scheduled_start_at) : null,
        });
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(battleChannel);
    };
  }, [battleState.battleId]);
  
  // ✅ LISTEN FOR BATTLE RECORD CHANGES - SERVER IS ONLY AUTHORITY
  useEffect(() => {
    if (!battleState.battleId) return;
    
    const battleChannel = supabase.channel(`battle-state:${battleState.battleId}`);
    
    // Subscribe FIRST before listening
    battleChannel.subscribe((status) => {
      console.log('[BattleState] Battle channel status:', status);
    });
    
    battleChannel
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'battles',
        filter: `id=eq.${battleState.battleId}`
      }, (payload) => {
        const battle = payload.new;
        console.log('[BattleState] Battle updated:', battle);
        
        // ✅ ONLY UPDATE FROM SERVER - NO CLIENT DECISIONS
        setBattleState({
          active: battle.status === 'active',
          battleId: battle.id,
          teamACaptain: battle.team_a_captain,
          teamBCaptain: battle.team_b_captain,
          teamAMembers: battle.team_a_member_ids || [],
          teamBMembers: battle.team_b_member_ids || [],
          teamAScore: battle.team_a_score || 0,
          teamBScore: battle.team_b_score || 0,
          startedAt: battle.started_at ? new Date(battle.started_at) : null,
          endsAt: battle.ends_at ? new Date(battle.ends_at) : null,
          suddenDeath: false,
          status: battle.status,
          scheduledStartAt: battle.scheduled_start_at ? new Date(battle.scheduled_start_at) : null,
        });
      });
      
    return () => {
      supabase.removeChannel(battleChannel);
    };
  }, [battleState.battleId]);

  // ✅ LISTEN FOR BATTLE STATE CHANGES - SERVER IS ONLY AUTHORITY
  useEffect(() => {
    if (!streamId || battleState.battleId) return;

    const streamChannel = supabase.channel(`stream-battle:${streamId}`);
    
    // Subscribe FIRST, then react to updates
    streamChannel.subscribe((status) => {
      console.log('[BattleState] Stream channel status:', status);
    });
    
    streamChannel
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'streams',
        filter: `id=eq.${streamId}`
      }, (payload) => {
        console.log('[BattleState] Stream updated:', payload.new);
        
        // Only react to battle_id being set - that means BOTH sides have clicked
        if (payload.new.battle_id && !payload.old.battle_id) {
          console.log('[BattleState] Battle confirmed for this stream:', payload.new.battle_id);
          setBattleState(prev => ({
            ...prev,
            battleId: payload.new.battle_id,
          }));
        }
        // Clear battle state if battle_id is removed
        if (!payload.new.battle_id && payload.old.battle_id) {
          setBattleState({
            active: false,
            battleId: null,
            teamACaptain: null,
            teamBCaptain: null,
            teamAMembers: [],
            teamBMembers: [],
            teamAScore: 0,
            teamBScore: 0,
            startedAt: null,
            endsAt: null,
            suddenDeath: false,
            status: 'idle',
            scheduledStartAt: null,
          });
        }
      });
      
    return () => {
      supabase.removeChannel(streamChannel);
    };
  }, [streamId, battleState.battleId]);

  // ✅ SERVER-AUTHORITATIVE TIMER
  // NO LOCAL DECISIONS. NO DRIFT. PERFECT SYNC.
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    const updateTimer = () => {
      const now = Date.now();
      
      // Countdown phase - count down to server scheduled start time
      if (battleState.status === 'countdown' && battleState.scheduledStartAt) {
        const remaining = Math.max(0, Math.floor((battleState.scheduledStartAt.getTime() - now) / 1000));
        setRemainingTime(remaining);
        return;
      }
      
      // Active battle
      if (battleState.status === 'active' && battleState.endsAt) {
        const remaining = Math.max(0, Math.floor((battleState.endsAt.getTime() - now) / 1000));
        setRemainingTime(remaining);

        if (remaining <= 10 && remaining > 0 && !battleState.suddenDeath) {
          setBattleState(prev => ({ ...prev, suddenDeath: true }));
        }
        
        return;
      }
      
      setRemainingTime(0);
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [battleState.status, battleState.scheduledStartAt, battleState.endsAt, battleState.suddenDeath]);

  // Subscribe to battle state changes via Supabase realtime
  useEffect(() => {
    if (!streamId) return;

    // Fetch current battle state on mount (for users who join after battle starts)
    const fetchCurrentBattle = async () => {
      try {
        // Check both team_a_stream_id and team_b_stream_id
        const { data: teamABattle } = await supabase
          .from('battles')
          .select('*')
          .eq('team_a_stream_id', streamId)
          .in('status', ['waiting_for_opponent', 'pending_locked', 'countdown', 'active'])
          .maybeSingle();

        const { data: teamBBattle } = await supabase
          .from('battles')
          .select('*')
          .eq('team_b_stream_id', streamId)
          .in('status', ['waiting_for_opponent', 'pending_locked', 'countdown', 'active'])
          .maybeSingle();

        const currentBattle = teamABattle || teamBBattle;

        if (currentBattle) {
          console.log('[BattleState] Found battle on mount:', currentBattle.id);
           setBattleState({
            active: currentBattle.status === 'active',
            battleId: currentBattle.id,
            teamACaptain: currentBattle.team_a_captain,
            teamBCaptain: currentBattle.team_b_captain,
            teamAMembers: currentBattle.team_a_member_ids || [],
            teamBMembers: currentBattle.team_b_member_ids || [],
            teamAScore: currentBattle.team_a_score || 0,
            teamBScore: currentBattle.team_b_score || 0,
            startedAt: currentBattle.started_at ? new Date(currentBattle.started_at) : null,
            endsAt: currentBattle.ends_at ? new Date(currentBattle.ends_at) : null,
            suddenDeath: false,
            status: currentBattle.status,
            scheduledStartAt: currentBattle.scheduled_start_at ? new Date(currentBattle.scheduled_start_at) : null,
          });

          // Auto-assign team
          if (localUserId === currentBattle.team_b_captain) {
            setUserTeam('challenger');
          } else if (localUserId === currentBattle.team_a_captain) {
            setUserTeam('broadcaster');
          }
        }
      } catch (err) {
        console.error('[BattleState] Error fetching current battle:', err);
      }
    };

    fetchCurrentBattle();

    const channel = supabase.channel(`battle-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'battles',
          filter: `team_a_stream_id=eq.${streamId}`
        },
        (payload) => {
          console.log('[BattleState] Battle INSERT received:', payload.new);
          const newBattle = payload.new;
          setBattleState({
            active: newBattle.status === 'active',
            battleId: newBattle.id,
            hostId: newBattle.host_id,
            challengerId: newBattle.challenger_id,
            broadcasterScore: newBattle.broadcaster_score || 0,
            challengerScore: newBattle.challenger_score || 0,
            startedAt: newBattle.started_at ? new Date(newBattle.started_at) : null,
            endsAt: newBattle.ends_at ? new Date(newBattle.ends_at) : null,
            suddenDeath: newBattle.sudden_death || false,
          });

          // Auto-assign team for challenger and host
          if (localUserId === newBattle.challenger_id) {
            setUserTeam('challenger');
          } else if (localUserId === newBattle.host_id) {
            setUserTeam('broadcaster');
          }

          setJoinWindowOpen(true);
          joinWindowTimerRef.current = setTimeout(() => {
            setJoinWindowOpen(false);
          }, 10000);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battles',
          filter: `challenger_stream_id=eq.${streamId}`
        },
        (payload) => {
          console.log('[BattleState] Battle UPDATE received:', payload.new);
          const updated = payload.new;
          setBattleState(prev => ({
            ...prev,
            active: updated.status === 'active',
            broadcasterScore: updated.broadcaster_score || 0,
            challengerScore: updated.challenger_score || 0,
            suddenDeath: updated.sudden_death || false,
            endsAt: updated.ends_at ? new Date(updated.ends_at) : null,
          }));
          
          if (updated.status === 'ended') {
            setJoinWindowOpen(false);
            if (joinWindowTimerRef.current) {
              clearTimeout(joinWindowTimerRef.current);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'battle_supporters'
        },
        (payload) => {
          const newSupporter = payload.new;
          setSupporters(prev => {
            const newMap = new Map(prev);
            newMap.set(newSupporter.user_id, {
              userId: newSupporter.user_id,
              team: newSupporter.team,
            });
            return newMap;
          });
          
          if (newSupporter.user_id === localUserId) {
            setUserTeam(newSupporter.team);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battle_supporters'
        },
        (payload) => {
          const updated = payload.new;
          setSupporters(prev => {
            const newMap = new Map(prev);
            newMap.set(updated.user_id, {
              userId: updated.user_id,
              team: updated.team,
            });
            return newMap;
          });
          
          if (updated.user_id === localUserId) {
            setUserTeam(updated.team);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Also subscribe to battles where this stream is the opponent
    const opponentChannel = supabase.channel(`battle-opponent-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battles',
          filter: `opponent_stream_id=eq.${streamId}`
        },
        (payload) => {
          console.log('[BattleState] Opponent battle UPDATE received:', payload.new);
          const updated = payload.new;
           setBattleState(prev => ({
             ...prev,
             active: updated.status === 'active',
             battleId: updated.id || prev.battleId,
             hostId: updated.host_id || prev.hostId,
             challengerId: updated.challenger_id || prev.challengerId,
             broadcasterScore: updated.broadcaster_score || 0,
             challengerScore: updated.challenger_score || 0,
             suddenDeath: updated.sudden_death || false,
             startedAt: updated.started_at ? new Date(updated.started_at) : prev.startedAt,
             endsAt: updated.ends_at ? new Date(updated.ends_at) : prev.endsAt,
             status: updated.status,
             hostReady: updated.host_ready || false,
             opponentReady: updated.opponent_ready || false,
             scheduledStartAt: updated.scheduled_start_at ? new Date(updated.scheduled_start_at) : prev.scheduledStartAt,
           }));
          
          if (updated.status === 'ended') {
            setJoinWindowOpen(false);
          }
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      supabase.removeChannel(opponentChannel);
      if (joinWindowTimerRef.current) {
        clearTimeout(joinWindowTimerRef.current);
      }
    };
  }, [streamId, localUserId]);

  // Start a battle (called by guest who is in a seat)
  const startBattle = useCallback(async (opponentId: string, opponentStreamId: string) => {
    if (!localUserId || !streamId || !opponentId || !opponentStreamId) {
      console.error('[BattleState] Cannot start battle: missing required parameters');
      return;
    }

    try {
      console.log('[BattleState] Starting battle:', { streamId, hostId: hostId, opponentId, opponentStreamId });
      
      const { data, error } = await supabase.functions.invoke('battles', {
        body: {
          action: 'start_battle',
          stream_id: streamId,
          host_id: hostId,
          opponent_id: opponentId,
          opponent_stream_id: opponentStreamId,
        },
      });

      if (error) {
        console.error('[BattleState] Error starting battle:', error);
        return;
      }

      console.log('[BattleState] Battle created response:', data);
      
      if (data.battle) {
        setBattleState({
          active: false,
          battleId: data.battle.id,
          hostId: data.battle.host_id,
          challengerId: data.battle.opponent_id,
          broadcasterScore: 0,
          challengerScore: 0,
          startedAt: null,
          endsAt: null,
          suddenDeath: false,
          status: 'pending',
          hostReady: false,
          opponentReady: false,
          scheduledStartAt: new Date(data.battle.scheduled_start_at),
        });
        setJoinWindowOpen(true);
        joinWindowTimerRef.current = setTimeout(() => {
          setJoinWindowOpen(false);
        }, 10000);
      }
    } catch (err) {
      console.error('[BattleState] Exception starting battle:', err);
    }
  }, [streamId, localUserId, hostId]);

  // ✅ LISTEN FOR FORFEIT EVENTS
  useEffect(() => {
    if (!battleState.battleId) return;
    
    const forfeitChannel = supabase.channel(`battle:${battleState.battleId}`);
    forfeitChannel.on('broadcast', { event: 'battle_forfeited' }, (payload) => {
      const data = payload.payload;
      
      // Reset battle state
      setBattleState({
        active: false,
        battleId: null,
        hostId: null,
        challengerId: null,
        broadcasterScore: 0,
        challengerScore: 0,
        startedAt: null,
        endsAt: null,
        suddenDeath: false,
        status: null,
        hostReady: false,
        opponentReady: false,
        scheduledStartAt: null,
      });
      
      // Show victory/defeat popup
      const isWinner = (data.winner === 'A' && isHost) || (data.winner === 'B' && !isHost);
      
      // Trigger redirect back to broadcast
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('battle:ended', { 
          detail: { victory: isWinner, crowns: isWinner ? 2 : 0 }
        }));
      }, 1500);
    }).subscribe();
    
    return () => {
      supabase.removeChannel(forfeitChannel);
    };
  }, [battleState.battleId, isHost]);

  // Confirm broadcaster is ready for battle
  const confirmBattleReady = useCallback(async () => {
    if (!battleState.battleId) {
      console.error('[BattleState] No active battle to confirm ready');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('battles', {
        body: {
          action: 'confirm_battle_screen',
          battle_id: battleState.battleId,
        },
      });

      if (error) {
        console.error('[BattleState] Error confirming ready:', error);
        return;
      }

      console.log('[BattleState] Ready confirmed:', data);
      
      if (data.countdown_started) {
        setBattleState(prev => ({
          ...prev,
          status: 'pending',
          scheduledStartAt: new Date(data.start_time),
          hostReady: true,
          opponentReady: true,
        }));
      } else {
        setBattleState(prev => ({
          ...prev,
          hostReady: data.host_confirmed,
          opponentReady: data.opponent_confirmed,
        }));
      }
    } catch (err) {
      console.error('[BattleState] Exception confirming ready:', err);
    }
  }, [battleState.battleId]);

  // Pick a side (broadcaster or challenger)
  const pickSide = useCallback(async (team: 'broadcaster' | 'challenger') => {
    if (!battleState.battleId || !localUserId) {
      console.error('[BattleState] Cannot pick side: missing battle or user');
      return;
    }

    try {
      await supabase.rpc('pick_battle_side', {
        p_battle_id: battleState.battleId,
        p_user_id: localUserId,
        p_team: team,
      });
      
      setUserTeam(team);
    } catch (err) {
      console.error('[BattleState] Error picking side:', err);
    }
  }, [battleState.battleId, localUserId]);

  // End battle (called by host)
  const endBattle = useCallback(async () => {
    if (!battleState.battleId) {
      console.error('[BattleState] No active battle to end');
      return;
    }

    try {
      await supabase.rpc('end_battle', {
        p_battle_id: battleState.battleId,
      });
      
      setBattleState({
        active: false,
        battleId: null,
        hostId: null,
        challengerId: null,
        broadcasterScore: 0,
        challengerScore: 0,
        startedAt: null,
        endsAt: null,
        suddenDeath: false,
      });
      setSupporters(new Map());
      setUserTeam(null);
    } catch (err) {
      console.error('[BattleState] Error ending battle:', err);
    }
  }, [battleState.battleId]);

  // Check if user is on broadcaster's team
  const isBroadcasterTeam = useCallback(() => {
    return userTeam === 'broadcaster';
  }, [userTeam]);

  // Check if user is on challenger's team
  const isChallengerTeam = useCallback(() => {
    return userTeam === 'challenger';
  }, [userTeam]);

  // Check if host/challenger can gift (they cannot during battle)
  const canGift = useCallback(() => {
    // If not in battle, can gift
    if (!battleState.active) return true;
    
    // If user is host or challenger, cannot gift
    if (localUserId === battleState.hostId || localUserId === battleState.challengerId) {
      return false;
    }
    
    return true;
  }, [battleState, localUserId]);

  // Calculate remaining time
  const getRemainingTime = useCallback(() => {
    if (!battleState.endsAt) return 0;
    const remaining = battleState.endsAt.getTime() - Date.now();
    return Math.max(0, remaining);
  }, [battleState.endsAt]);

  // Send a gift to a battle team (records score)
  const sendBattleGift = useCallback(async (team: 'broadcaster' | 'challenger', amount: number) => {
    if (!battleState.battleId || !localUserId) {
      console.error('[BattleState] Cannot send battle gift: missing battle or user');
      return false;
    }

    // Optimistic update - show score immediately
    setBattleState(prev => ({
      ...prev,
      broadcasterScore: team === 'broadcaster' ? prev.broadcasterScore + amount : prev.broadcasterScore,
      challengerScore: team === 'challenger' ? prev.challengerScore + amount : prev.challengerScore,
    }));

    try {
      await supabase.rpc('record_battle_gift', {
        p_battle_id: battleState.battleId,
        p_sender_id: localUserId,
        p_team: team,
        p_amount: amount,
      });
      return true;
    } catch (err) {
      console.error('[BattleState] Error sending battle gift:', err);
      // Revert optimistic update on error
      setBattleState(prev => ({
        ...prev,
        broadcasterScore: team === 'broadcaster' ? prev.broadcasterScore - amount : prev.broadcasterScore,
        challengerScore: team === 'challenger' ? prev.challengerScore - amount : prev.challengerScore,
      }));
      return false;
    }
  }, [battleState.battleId, localUserId]);

  // Check if user should see side picker (not host, not challenger)
  const shouldShowSidePicker = useCallback(() => {
    if (!battleState.active) return false;
    if (localUserId === battleState.hostId) return false;
    if (localUserId === battleState.challengerId) return false;
    return true;
  }, [battleState, localUserId]);

  return {
    battleState,
    supporters,
    userTeam,
    joinWindowOpen,
    remainingTime,
    startBattle,
    confirmBattleReady,
    pickSide,
    endBattle,
    isBroadcasterTeam,
    isChallengerTeam,
    canGift,
    getRemainingTime,
    sendBattleGift,
    shouldShowSidePicker,
  };
}
