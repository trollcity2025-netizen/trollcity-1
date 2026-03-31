import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';

// ─── TYPES ───

export interface BattleParticipant {
  userId: string;
  username: string;
  avatarUrl: string;
  team: 'A' | 'B';
  seatIndex: number;
  role: 'host' | 'guest';
  coinsEarned: number;
  isActive: boolean;
}

export interface AbilityState {
  teamFreeze: { available: boolean; cooldownEndsAt: number; isActive: boolean; activeEndsAt: number };
  reverse: { available: boolean; cooldownEndsAt: number };
  doubleXp: { available: boolean; cooldownEndsAt: number; isActive: number; activeEndsAt: number };
}

export interface FiveVFiveBattleState {
  active: boolean;
  battleId: string | null;
  phase: 'idle' | 'matchmaking' | 'pre_battle' | 'countdown' | 'active' | 'ended' | 'rematch';
  teamAScore: number;
  teamBScore: number;
  teamAGiftCount: number;
  teamBGiftCount: number;
  timerSeconds: number;
  totalDuration: number;
  participants: BattleParticipant[];
  abilities: Record<string, AbilityState>;
  frozenTeams: { A: boolean; B: boolean };
  doubleXpTeams: { A: boolean; B: boolean };
  lastGiftUser: { username: string; amount: number; team: 'A' | 'B' } | null;
  winner: 'A' | 'B' | 'draw' | null;
  rematchOffered: boolean;
  rematchAccepted: { A: boolean; B: boolean };
  rematchCountdown: number;
  abilityEffects: Array<{ id: string; type: string; team?: 'A' | 'B'; username: string; timestamp: number }>;
}

const BATTLE_DURATION = 180; // 3 minutes
const REMATCH_DURATION = 10; // 10 seconds to accept rematch
const PRE_BATTLE_COUNTDOWN = 5;
const TEAM_FREEZE_DURATION = 5; // 5 seconds
const TEAM_FREEZE_COOLDOWN = 30; // 30 seconds
const REVERSE_COOLDOWN = 20; // 20 seconds
const DOUBLE_XP_DURATION = 10; // 10 seconds
const DOUBLE_XP_COOLDOWN = 25; // 25 seconds

const INITIAL_STATE: FiveVFiveBattleState = {
  active: false,
  battleId: null,
  phase: 'idle',
  teamAScore: 0,
  teamBScore: 0,
  teamAGiftCount: 0,
  teamBGiftCount: 0,
  timerSeconds: 0,
  totalDuration: BATTLE_DURATION,
  participants: [],
  abilities: {},
  frozenTeams: { A: false, B: false },
  doubleXpTeams: { A: false, B: false },
  lastGiftUser: null,
  winner: null,
  rematchOffered: false,
  rematchAccepted: { A: false, B: false },
  rematchCountdown: 0,
  abilityEffects: [],
};

export interface UseFiveVFiveBattleProps {
  streamId: string;
  isHost: boolean;
  category: string;
}

export function useFiveVFiveBattle({ streamId, isHost, category }: UseFiveVFiveBattleProps) {
  const { user, profile } = useAuthStore();
  const [state, setState] = useState<FiveVFiveBattleState>(INITIAL_STATE);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const isGeneralChat = category === 'general';

  // ─── CLEANUP ───
  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // ─── BROADCAST STATE ───
  const broadcastState = useCallback((event: string, data: any) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event,
      payload: { ...data, timestamp: Date.now() },
    });
  }, []);

  // ─── MATCHMAKING ───
  const findMatch = useCallback(async () => {
    if (!user || !streamId || !isGeneralChat) return;
    if (state.phase !== 'idle') return;

    setState(prev => ({ ...prev, phase: 'matchmaking' }));
    toast.loading('Searching for opponent...', { id: 'battle-matchmaking' });

    try {
      let opponent: { id: string; user_id: string; title: string; category: string; current_viewers: number } | null = null;

      // Try TM (Troll Match) matchmaking first - use users you've matched with
      try {
        const { data: tmMatches } = await supabase.rpc('get_tm_matches', {
          p_user_id: user.id,
          p_dating: false,
          p_limit: 20,
        });

        if (tmMatches && tmMatches.length > 0) {
          // Find which matched users have a live stream in general chat
          const matchedUserIds = tmMatches.map((m: any) => m.user_id);
          const { data: liveStreams } = await supabase
            .from('streams')
            .select('id, user_id, title, category, current_viewers')
            .in('user_id', matchedUserIds)
            .eq('is_live', true)
            .eq('category', 'general')
            .neq('id', streamId)
            .gt('current_viewers', 0);

          if (liveStreams && liveStreams.length > 0) {
            // Pick a random matched user's stream
            opponent = liveStreams[Math.floor(Math.random() * liveStreams.length)];
          }
        }
      } catch (tmErr) {
        console.warn('[FiveVFive] TM matchmaking unavailable, falling back to random:', tmErr);
      }

      // Fallback: random matching via find_5v5_match
      if (!opponent) {
        const { data: opponents, error } = await supabase.rpc('find_5v5_match', {
          p_stream_id: streamId,
        });
        if (error) throw error;
        opponent = Array.isArray(opponents) && opponents.length > 0 ? opponents[0] : null;
      }

      if (!opponent || !opponent.id) {
        toast.dismiss('battle-matchmaking');
        toast.error('No opponents found. Try again later!');
        setState(prev => ({ ...prev, phase: 'idle' }));
        return;
      }

      toast.dismiss('battle-matchmaking');
      toast.success(`Match found: ${opponent.title || 'Opponent'}!`);

      // Create the battle
      const battleId = `battle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Fetch participants from both streams
      const { data: mySeats } = await supabase
        .from('stream_seat_sessions')
        .select('user_id, seat_index, status')
        .eq('stream_id', streamId)
        .eq('status', 'active')
        .order('seat_index', { ascending: true });

      const { data: oppSeats } = await supabase
        .from('stream_seat_sessions')
        .select('user_id, seat_index, status')
        .eq('stream_id', opponent.id)
        .eq('status', 'active')
        .order('seat_index', { ascending: true });

      // Build participants list
      const participants: BattleParticipant[] = [];

      // Team A - My stream (up to 5)
      const teamAPeople = [
        { userId: user.id, seatIndex: 0, role: 'host' as const },
        ...(mySeats || []).filter(s => s.user_id !== user.id).slice(0, 4).map((s, i) => ({
          userId: s.user_id,
          seatIndex: i + 1,
          role: 'guest' as const,
        })),
      ];

      // Fetch profiles for team A
      const teamAIds = teamAPeople.map(p => p.userId);
      const { data: teamAProfiles } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .in('id', teamAIds);

      const profileMapA = new Map((teamAProfiles || []).map((p: any) => [p.id, p]));

      for (const p of teamAPeople) {
        const prof = profileMapA.get(p.userId);
        participants.push({
          userId: p.userId,
          username: prof?.username || 'Player',
          avatarUrl: prof?.avatar_url || '',
          team: 'A',
          seatIndex: p.seatIndex,
          role: p.role,
          coinsEarned: 0,
          isActive: true,
        });
      }

      // Team B - Opponent stream (up to 5)
      const teamBPeople = [
        { userId: opponent.user_id, seatIndex: 0, role: 'host' as const },
        ...(oppSeats || []).filter(s => s.user_id !== opponent.user_id).slice(0, 4).map((s, i) => ({
          userId: s.user_id,
          seatIndex: i + 1,
          role: 'guest' as const,
        })),
      ];

      const teamBIds = teamBPeople.map(p => p.userId);
      const { data: teamBProfiles } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .in('id', teamBIds);

      const profileMapB = new Map((teamBProfiles || []).map((p: any) => [p.id, p]));

      for (const p of teamBPeople) {
        const prof = profileMapB.get(p.userId);
        participants.push({
          userId: p.userId,
          username: prof?.username || 'Player',
          avatarUrl: prof?.avatar_url || '',
          team: 'B',
          seatIndex: p.seatIndex,
          role: p.role,
          coinsEarned: 0,
          isActive: true,
        });
      }

      // Initialize abilities for all participants
      const abilities: Record<string, AbilityState> = {};
      for (const p of participants) {
        abilities[p.userId] = {
          teamFreeze: { available: true, cooldownEndsAt: 0, isActive: false, activeEndsAt: 0 },
          reverse: { available: true, cooldownEndsAt: 0 },
          doubleXp: { available: true, cooldownEndsAt: 0, isActive: false, activeEndsAt: 0 },
        };
      }

      // Save battle to database
      const { error: battleError } = await supabase
        .from('battle_sessions')
        .insert({
          id: battleId,
          stream_id_a: streamId,
          stream_id_b: opponent.id,
          host_id_a: user.id,
          host_id_b: opponent.user_id,
          status: 'pre_battle',
          participants: JSON.stringify(participants),
          score_a: 0,
          score_b: 0,
          created_at: new Date().toISOString(),
        });

      if (battleError) {
        // If table doesn't exist, we still continue with local state
        console.warn('[FiveVFive] Could not save battle to DB:', battleError.message);
      }

      // Set both streams to battle mode so ALL viewers on both sides see the battle
      await Promise.all([
        supabase
          .from('streams')
          .update({ is_battle: true, battle_id: battleId })
          .eq('id', streamId),
        supabase
          .from('streams')
          .update({ is_battle: true, battle_id: battleId })
          .eq('id', opponent.id),
      ]);

      // Subscribe to battle channel
      const channel = supabase.channel(`5v5-battle:${battleId}`);
      channel.on('broadcast', { event: '*' }, (payload) => {
        handleBattleEvent(payload.event, payload.payload);
      });
      await channel.subscribe();
      channelRef.current = channel;

      // Set state to pre-battle
      setState(prev => ({
        ...prev,
        active: true,
        battleId,
        phase: 'pre_battle',
        participants,
        abilities,
        timerSeconds: PRE_BATTLE_COUNTDOWN,
      }));

      // Broadcast battle start to opponent
      broadcastState('battle_found', {
        battleId,
        participants,
        streamIdA: streamId,
        streamIdB: opponent.id,
      });

      // Start countdown
      startCountdown(battleId, participants, abilities);

    } catch (err: any) {
      console.error('[FiveVFive] Matchmaking error:', err);
      toast.dismiss('battle-matchmaking');
      toast.error(err.message || 'Failed to find match');
      setState(prev => ({ ...prev, phase: 'idle' }));
    }
  }, [user, streamId, isGeneralChat, state.phase, broadcastState]);

  // ─── COUNTDOWN ───
  const startCountdown = useCallback((
    battleId: string,
    participants: BattleParticipant[],
    abilities: Record<string, AbilityState>
  ) => {
    let countdown = PRE_BATTLE_COUNTDOWN;
    countdownRef.current = setInterval(() => {
      countdown--;
      setState(prev => ({ ...prev, timerSeconds: countdown }));
      // Broadcast countdown so ALL participants see the same timer
      broadcastState('timer_sync', { remaining: countdown, phase: 'pre_battle' });

      if (countdown <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        startBattleTimer(battleId, participants, abilities);
      }
    }, 1000);
  }, [broadcastState]);

  // ─── BATTLE TIMER ───
  const startBattleTimer = useCallback((
    battleId: string,
    participants: BattleParticipant[],
    abilities: Record<string, AbilityState>
  ) => {
    const startedAt = Date.now();
    let remaining = BATTLE_DURATION;

    setState(prev => ({
      ...prev,
      phase: 'active',
      timerSeconds: remaining,
      totalDuration: BATTLE_DURATION,
    }));

    broadcastState('battle_start', { battleId, duration: BATTLE_DURATION, startedAt });

    timerRef.current = setInterval(() => {
      // Calculate remaining time based on shared timestamp for sync accuracy
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      remaining = Math.max(0, BATTLE_DURATION - elapsed);

      // Update ability cooldowns
      const now = Date.now();
      setState(prev => {
        const newAbilities = { ...prev.abilities };
        for (const userId of Object.keys(newAbilities)) {
          const ab = { ...newAbilities[userId] };
          if (ab.teamFreeze.isActive && ab.teamFreeze.activeEndsAt <= now) {
            ab.teamFreeze = { ...ab.teamFreeze, isActive: false };
          }
          if (ab.doubleXp.isActive && ab.doubleXp.activeEndsAt <= now) {
            ab.doubleXp = { ...ab.doubleXp, isActive: false };
          }
          newAbilities[userId] = ab;
        }

        // Check frozen teams
        const anyFreezeA = Object.values(newAbilities).some(
          ab => ab.teamFreeze.isActive && participants.find(p => p.userId === Object.keys(newAbilities).find(k => newAbilities[k] === ab))?.team === 'B'
        );
        const anyFreezeB = Object.values(newAbilities).some(
          ab => ab.teamFreeze.isActive && participants.find(p => p.userId === Object.keys(newAbilities).find(k => newAbilities[k] === ab))?.team === 'A'
        );

        // Check double XP teams
        const anyDxpA = Object.values(newAbilities).some(
          ab => ab.doubleXp.isActive && participants.find(p => p.userId === Object.keys(newAbilities).find(k => newAbilities[k] === ab))?.team === 'A'
        );
        const anyDxpB = Object.values(newAbilities).some(
          ab => ab.doubleXp.isActive && participants.find(p => p.userId === Object.keys(newAbilities).find(k => newAbilities[k] === ab))?.team === 'B'
        );

        return {
          ...prev,
          timerSeconds: remaining,
          abilities: newAbilities,
          frozenTeams: { A: anyFreezeA, B: anyFreezeB },
          doubleXpTeams: { A: anyDxpA, B: anyDxpB },
        };
      });

      broadcastState('timer_sync', { remaining });

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        endBattle();
      }
    }, 1000);
  }, [broadcastState]);

  // ─── END BATTLE ───
  const endBattle = useCallback(async () => {
    cleanup();

    const currentState = stateRef.current;
    const winner = currentState.teamAScore > currentState.teamBScore ? 'A' :
      currentState.teamBScore > currentState.teamAScore ? 'B' : 'draw';

    broadcastState('battle_ended', {
      winner,
      teamAScore: currentState.teamAScore,
      teamBScore: currentState.teamBScore,
    });

    // Clear battle mode on ALL streams that reference this battle
    if (currentState.battleId) {
      // Also try to clear by battle_id in case stream IDs differ
      await supabase
        .from('streams')
        .update({ is_battle: false, battle_id: null })
        .eq('battle_id', currentState.battleId);
      // Also clear our own stream explicitly
      await supabase
        .from('streams')
        .update({ is_battle: false, battle_id: null })
        .eq('id', streamId);
    }

    setState(prev => ({
      ...prev,
      phase: 'ended',
      winner,
      active: false,
      rematchCountdown: REMATCH_DURATION,
    }));

    // Start rematch countdown
    let rematchTime = REMATCH_DURATION;
    countdownRef.current = setInterval(() => {
      rematchTime--;
      setState(prev => ({ ...prev, rematchCountdown: rematchTime }));
      if (rematchTime <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        resetBattle();
      }
    }, 1000);
  }, [cleanup, broadcastState, streamId]);

  // ─── RESET ───
  const resetBattle = useCallback(() => {
    cleanup();
    setState(INITIAL_STATE);
  }, [cleanup]);

  // ─── PROCESS GIFT ───
  const processGift = useCallback((
    senderId: string,
    receiverId: string,
    giftAmount: number,
    giftName: string
  ) => {
    if (!state.active || state.phase !== 'active') return;

    setState(prev => {
      const receiver = prev.participants.find(p => p.userId === receiverId);
      if (!receiver) return prev;

      const teamKey = receiver.team === 'A' ? 'teamAScore' : 'teamBScore';
      const giftCountKey = receiver.team === 'A' ? 'teamAGiftCount' : 'teamBGiftCount';

      // Check if this team has double XP active
      const hasDxp = receiver.team === 'A' ? prev.doubleXpTeams.A : prev.doubleXpTeams.B;
      const scoreToAdd = hasDxp ? giftAmount * 2 : giftAmount;

      // Check if team is frozen - frozen teams don't receive score
      const isFrozen = receiver.team === 'A' ? prev.frozenTeams.A : prev.frozenTeams.B;
      const finalScore = isFrozen ? 0 : scoreToAdd;

      // Update participant coins earned
      const updatedParticipants = prev.participants.map(p =>
        p.userId === receiverId
          ? { ...p, coinsEarned: p.coinsEarned + giftAmount }
          : p
      );

      const newState = {
        ...prev,
        [teamKey]: prev[teamKey] + finalScore,
        [giftCountKey]: prev[giftCountKey] + 1,
        participants: updatedParticipants,
        lastGiftUser: {
          username: prev.participants.find(p => p.userId === senderId)?.username || 'Someone',
          amount: giftAmount,
          team: receiver.team,
        },
      };

      broadcastState('gift_scored', {
        team: receiver.team,
        score: finalScore,
        giftAmount,
        senderName: newState.lastGiftUser.username,
        receiverName: receiver.username,
        isDoubled: hasDxp,
        isFrozen,
      });

      return newState;
    });
  }, [state.active, state.phase, broadcastState]);

  // ─── USE ABILITY ───
  const useAbility = useCallback((abilityType: 'team_freeze' | 'reverse' | 'double_xp') => {
    if (!user || !state.active || state.phase !== 'active') return;

    const userId = user.id;
    const participant = state.participants.find(p => p.userId === userId);
    if (!participant) return;

    const now = Date.now();
    const userAbilities = state.abilities[userId];
    if (!userAbilities) return;

    setState(prev => {
      const newAbilities = { ...prev.abilities };
      const ab = { ...newAbilities[userId] };

      switch (abilityType) {
        case 'team_freeze': {
          if (!ab.teamFreeze.available || ab.teamFreeze.cooldownEndsAt > now) {
            toast.error('Team Freeze is on cooldown!');
            return prev;
          }
          ab.teamFreeze = {
            available: true,
            cooldownEndsAt: now + TEAM_FREEZE_COOLDOWN * 1000,
            isActive: true,
            activeEndsAt: now + TEAM_FREEZE_DURATION * 1000,
          };
          toast.success('❄️ Opposing team frozen!');
          const freezeEffect = {
            id: `freeze-${Date.now()}`,
            type: 'team_freeze',
            team: participant.team === 'A' ? 'B' as const : 'A' as const,
            username: participant.username,
            timestamp: Date.now(),
          };
          broadcastState('ability_used', {
            userId,
            ability: 'team_freeze',
            team: participant.team,
            targetTeam: participant.team === 'A' ? 'B' : 'A',
          });
          broadcastState('ability_visual', { effect: freezeEffect });
          break;
        }
        case 'reverse': {
          if (!ab.reverse.available || ab.reverse.cooldownEndsAt > now) {
            toast.error('Reverse is on cooldown!');
            return prev;
          }
          ab.reverse = {
            available: true,
            cooldownEndsAt: now + REVERSE_COOLDOWN * 1000,
          };
          const opposingTeam = participant.team === 'A' ? 'B' : 'A';
          const isOpposingFrozen = opposingTeam === 'A' ? prev.frozenTeams.A : prev.frozenTeams.B;
          if (isOpposingFrozen) {
            toast.success('🔄 Reverse! Freeze sent back!');
          } else {
            toast('🔄 Reverse activated - no freeze to reverse', { icon: '⚡' });
          }
          const reverseEffect = {
            id: `reverse-${Date.now()}`,
            type: 'reverse',
            username: participant.username,
            timestamp: Date.now(),
          };
          broadcastState('ability_used', {
            userId,
            ability: 'reverse',
            team: participant.team,
            reversed: isOpposingFrozen,
          });
          broadcastState('ability_visual', { effect: reverseEffect });
          break;
        }
        case 'double_xp': {
          if (!ab.doubleXp.available || ab.doubleXp.cooldownEndsAt > now) {
            toast.error('Double XP is on cooldown!');
            return prev;
          }
          ab.doubleXp = {
            available: true,
            cooldownEndsAt: now + DOUBLE_XP_COOLDOWN * 1000,
            isActive: true,
            activeEndsAt: now + DOUBLE_XP_DURATION * 1000,
          };
          toast.success('💰 Double XP activated!');
          const dxpEffect = {
            id: `dxp-${Date.now()}`,
            type: 'double_xp',
            team: participant.team,
            username: participant.username,
            timestamp: Date.now(),
          };
          broadcastState('ability_used', {
            userId,
            ability: 'double_xp',
            team: participant.team,
          });
          broadcastState('ability_visual', { effect: dxpEffect });
          break;
        }
      }

      newAbilities[userId] = ab;
      return { ...prev, abilities: newAbilities };
    });
  }, [user, state.active, state.phase, state.abilities, state.participants, broadcastState]);

  // ─── REQUEST REMATCH ───
  const requestRematch = useCallback(() => {
    if (state.phase !== 'ended' || !user) return;

    const participant = state.participants.find(p => p.userId === user.id);
    if (!participant) return;

    setState(prev => {
      const newAccepted = { ...prev.rematchAccepted };
      newAccepted[participant.team] = true;

      broadcastState('rematch_requested', { team: participant.team });

      if (newAccepted.A && newAccepted.B) {
        // Both accepted - start rematch
        toast.success('Rematch starting!');
        if (countdownRef.current) clearInterval(countdownRef.current);

        const battleId = `battle-rematch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const abilities: Record<string, AbilityState> = {};
        for (const p of prev.participants) {
          abilities[p.userId] = {
            teamFreeze: { available: true, cooldownEndsAt: 0, isActive: false, activeEndsAt: 0 },
            reverse: { available: true, cooldownEndsAt: 0 },
            doubleXp: { available: true, cooldownEndsAt: 0, isActive: false, activeEndsAt: 0 },
          };
        }

        const newState = {
          ...prev,
          battleId,
          phase: 'pre_battle' as const,
          teamAScore: 0,
          teamBScore: 0,
          teamAGiftCount: 0,
          teamBGiftCount: 0,
          winner: null,
          rematchOffered: false,
          rematchAccepted: { A: false, B: false },
          rematchCountdown: 0,
          abilities,
          frozenTeams: { A: false, B: false },
          doubleXpTeams: { A: false, B: false },
          lastGiftUser: null,
          timerSeconds: PRE_BATTLE_COUNTDOWN,
        };

        startCountdown(battleId, prev.participants, abilities);
        return newState;
      }

      return { ...prev, rematchAccepted: newAccepted, rematchOffered: true };
    });
  }, [state.phase, state.participants, user, broadcastState, startCountdown]);

  // ─── HANDLE REMOTE EVENTS ───
  const handleBattleEvent = useCallback((event: string, data: any) => {
    switch (event) {
      case 'battle_found': {
        if (!isHost) {
          setState(prev => ({
            ...prev,
            active: true,
            battleId: data.battleId,
            phase: 'pre_battle',
            participants: data.participants,
            timerSeconds: PRE_BATTLE_COUNTDOWN,
          }));
        }
        break;
      }
      case 'battle_start': {
        const battleStartedAt = data.startedAt || Date.now();
        // Start independent timer on non-host side using shared timestamp for sync
        if (!isHost && timerRef.current) {
          clearInterval(timerRef.current);
        }
        if (!isHost) {
          timerRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - battleStartedAt) / 1000);
            const remaining = Math.max(0, BATTLE_DURATION - elapsed);
            setState(prev => ({ ...prev, timerSeconds: remaining }));
            if (remaining <= 0) {
              if (timerRef.current) clearInterval(timerRef.current);
            }
          }, 1000);
        }
        setState(prev => ({
          ...prev,
          phase: 'active',
          timerSeconds: data.duration,
          totalDuration: data.duration,
        }));
        break;
      }
      case 'timer_sync': {
        setState(prev => {
          // Handle pre_battle countdown ending
          if (data.phase === 'pre_battle' && data.remaining <= 0 && prev.phase === 'pre_battle') {
            return {
              ...prev,
              phase: 'active',
              timerSeconds: BATTLE_DURATION,
              totalDuration: BATTLE_DURATION,
            };
          }
          return {
            ...prev,
            timerSeconds: data.remaining,
          };
        });
        break;
      }
      case 'gift_scored': {
        setState(prev => {
          const teamKey = data.team === 'A' ? 'teamAScore' : 'teamBScore';
          const giftCountKey = data.team === 'A' ? 'teamAGiftCount' : 'teamBGiftCount';
          return {
            ...prev,
            [teamKey]: prev[teamKey] + data.score,
            [giftCountKey]: prev[giftCountKey] + 1,
            lastGiftUser: {
              username: data.senderName,
              amount: data.giftAmount,
              team: data.team,
            },
          };
        });
        break;
      }
      case 'ability_used': {
        const { userId, ability, team, targetTeam } = data;
        if (ability === 'team_freeze' && targetTeam) {
          toast(`❄️ Team ${targetTeam} has been frozen!`, { icon: '❄️' });
        } else if (ability === 'double_xp') {
          toast(`💰 Team ${team} has Double XP!`, { icon: '💰' });
        }
        break;
      }
      case 'ability_visual': {
        if (data.effect) {
          setState(prev => ({
            ...prev,
            abilityEffects: [...prev.abilityEffects, data.effect],
          }));
          setTimeout(() => {
            setState(prev => ({
              ...prev,
              abilityEffects: prev.abilityEffects.filter(e => e.id !== data.effect.id),
            }));
          }, 3000);
        }
        break;
      }
      case 'battle_ended': {
        if (timerRef.current) clearInterval(timerRef.current);
        setState(prev => ({
          ...prev,
          phase: 'ended',
          winner: data.winner,
          active: false,
          teamAScore: data.teamAScore,
          teamBScore: data.teamBScore,
        }));
        break;
      }
      case 'rematch_requested': {
        setState(prev => ({
          ...prev,
          rematchAccepted: { ...prev.rematchAccepted, [data.team]: true },
          rematchOffered: true,
        }));
        break;
      }
    }
  }, [isHost]);

  // ─── JOIN BATTLE (for remote side) ───
  const joinBattle = useCallback(async (battleId: string) => {
    if (!channelRef.current) {
      const channel = supabase.channel(`5v5-battle:${battleId}`);
      channel.on('broadcast', { event: '*' }, (payload) => {
        handleBattleEvent(payload.event, payload.payload);
      });
      await channel.subscribe();
      channelRef.current = channel;
    }
  }, [handleBattleEvent]);

  return {
    state,
    findMatch,
    useAbility,
    processGift,
    requestRematch,
    resetBattle,
    joinBattle,
    isGeneralChat,
    BATTLE_DURATION,
    TEAM_FREEZE_DURATION,
    TEAM_FREEZE_COOLDOWN,
    REVERSE_COOLDOWN,
    DOUBLE_XP_DURATION,
    DOUBLE_XP_COOLDOWN,
  };
}
