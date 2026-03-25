import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

export interface BattleState {
  active: boolean;
  battleId: string | null;
  hostId: string | null;
  challengerId: string | null;
  broadcasterScore: number;
  challengerScore: number;
  startedAt: Date | null;
  endsAt: Date | null;
  suddenDeath: boolean;
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
    hostId: null,
    challengerId: null,
    broadcasterScore: 0,
    challengerScore: 0,
    startedAt: null,
    endsAt: null,
    suddenDeath: false,
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

  // Timer countdown effect
  useEffect(() => {
    if (battleState.active && battleState.endsAt) {
      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      const updateTimer = () => {
        const now = Date.now();
        const endsAt = battleState.endsAt?.getTime() || 0;
        const remaining = Math.max(0, Math.floor((endsAt - now) / 1000));
        setRemainingTime(remaining);

        // Check for sudden death (last 10 seconds)
        if (remaining <= 10 && remaining > 0 && !battleState.suddenDeath) {
          setBattleState(prev => ({ ...prev, suddenDeath: true }));
        }

        // Battle ended
        if (remaining === 0) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          // Auto-end battle when timer reaches 0
          setBattleState(prev => ({ ...prev, active: false }));
        }
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    } else if (battleState.active && battleState.startedAt && !battleState.endsAt) {
      // Fallback: calculate endsAt from startedAt if not set in DB
      const calculatedEndsAt = new Date(battleState.startedAt.getTime() + 3.5 * 60 * 1000);
      setBattleState(prev => ({ ...prev, endsAt: calculatedEndsAt }));
    } else {
      setRemainingTime(0);
    }
  }, [battleState.active, battleState.endsAt, battleState.suddenDeath, battleState.startedAt]);

  // Subscribe to battle state changes via Supabase realtime
  useEffect(() => {
    if (!streamId) return;

    // Fetch current battle state on mount (for users who join after battle starts)
    const fetchCurrentBattle = async () => {
      try {
        // Check both challenger_stream_id and opponent_stream_id
        const { data: challengerBattle } = await supabase
          .from('battles')
          .select('*')
          .eq('challenger_stream_id', streamId)
          .eq('status', 'active')
          .maybeSingle();

        const { data: opponentBattle } = await supabase
          .from('battles')
          .select('*')
          .eq('opponent_stream_id', streamId)
          .eq('status', 'active')
          .maybeSingle();

        const currentBattle = challengerBattle || opponentBattle;

        if (currentBattle) {
          console.log('[BattleState] Found active battle on mount:', currentBattle.id);
          setBattleState({
            active: currentBattle.status === 'active',
            battleId: currentBattle.id,
            hostId: currentBattle.host_id,
            challengerId: currentBattle.challenger_id,
            broadcasterScore: currentBattle.broadcaster_score || 0,
            challengerScore: currentBattle.challenger_score || 0,
            startedAt: currentBattle.started_at ? new Date(currentBattle.started_at) : null,
            endsAt: currentBattle.ends_at ? new Date(currentBattle.ends_at) : null,
            suddenDeath: currentBattle.sudden_death || false,
          });

          // Auto-assign team
          if (localUserId === currentBattle.challenger_id) {
            setUserTeam('challenger');
          } else if (localUserId === currentBattle.host_id) {
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
          filter: `challenger_stream_id=eq.${streamId}`
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
            endsAt: updated.ends_at ? new Date(updated.ends_at) : prev.endsAt,
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
  const startBattle = useCallback(async () => {
    if (!localUserId || !streamId) {
      console.error('[BattleState] Cannot start battle: missing user or stream');
      return;
    }

    try {
      console.log('[BattleState] Starting battle:', { streamId, challengerId: localUserId });
      
      const { data, error } = await supabase.rpc('start_battle', {
        p_stream_id: streamId,
        p_challenger_id: localUserId,
      });

      if (error) {
        console.error('[BattleState] Error starting battle:', error);
        return;
      }

      console.log('[BattleState] Battle started response:', data);
      
      // Optimistic update - immediately show battle UI
      // Data might be the battle ID directly or an object
      const battleId = typeof data === 'string' ? data : data?.id;
      if (battleId) {
        setBattleState({
          active: true,
          battleId: battleId,
          hostId: hostId || null,
          challengerId: localUserId,
          broadcasterScore: 0,
          challengerScore: 0,
          startedAt: new Date(),
          endsAt: new Date(Date.now() + 3.5 * 60 * 1000),
          suddenDeath: false,
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
