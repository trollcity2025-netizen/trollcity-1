// src/hooks/useTrollToe.ts
// Hook for Live Troll Toe game management with real-time sync

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useTrollToeStore } from '../stores/trollToeStore';
import { useAuthStore } from '../lib/store';
import { deductCoins, addCoins } from '../lib/coinTransactions';
import type { TrollToePlayer, TrollToeTeam, TrollToeMatch } from '../types/trollToe';
import { DEFAULT_TROLLTOE_CONFIG } from '../types/trollToe';
import { toast } from 'sonner';

interface UseTrollToeOptions {
  streamId: string;
  isHost: boolean;
  enabled?: boolean;
}

export function useTrollToe({ streamId, isHost, enabled = true }: UseTrollToeOptions) {
  const { user, profile, refreshProfile } = useAuthStore();
  const store = useTrollToeStore();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const originalBoxCountRef = useRef<number | null>(null);

  const channelName = `trolltoe-${streamId}`;

  const broadcastState = useCallback(
    async (event: string, payload: any) => {
      if (!channelRef.current) return;
      try {
        await channelRef.current.send({
          type: 'broadcast',
          event,
          payload: { ...payload, _senderId: user?.id, _timestamp: Date.now() },
        });
      } catch (err) {
        console.error('[useTrollToe] Broadcast error:', err);
      }
    },
    [user?.id]
  );

  const syncMatchState = useCallback(async () => {
    const match = store.match;
    if (!match) return;
    await broadcastState('match-sync', { match });
  }, [store.match, broadcastState]);

  // Initialize realtime channel
  useEffect(() => {
    if (!enabled || !streamId) return;

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: true, ack: true } },
    });

    channel.on('broadcast', { event: 'match-sync' }, ({ payload }) => {
      if (payload._senderId === user?.id) return;
      if (payload.match) store.setMatch(payload.match as TrollToeMatch);
    });
    channel.on('broadcast', { event: 'player-join' }, ({ payload }) => {
      if (payload._senderId === user?.id) return;
      if (payload.player) store.joinTeam(payload.player as TrollToePlayer);
    });
    channel.on('broadcast', { event: 'player-assigned' }, ({ payload }) => {
      if (payload._senderId === user?.id) return;
      if (payload.player && typeof payload.boxIndex === 'number')
        store.assignPlayerToBox(payload.player as TrollToePlayer, payload.boxIndex);
    });
    channel.on('broadcast', { event: 'fog-applied' }, ({ payload }) => {
      if (payload._senderId === user?.id) return;
      if (typeof payload.boxIndex === 'number')
        store.applyFog(payload.boxIndex, payload.fogUserId, payload.fogUsername);
    });
    channel.on('broadcast', { event: 'match-start' }, () => store.startMatch());
    channel.on('broadcast', { event: 'match-pause' }, () => store.pauseMatch());
    channel.on('broadcast', { event: 'match-resume' }, () => store.resumeMatch());
    channel.on('broadcast', { event: 'match-end' }, () => store.endMatch());
    channel.on('broadcast', { event: 'match-reset' }, () => store.resetBoard());
    channel.on('broadcast', { event: 'side-selection-open' }, () => store.openSideSelection());
    channel.on('broadcast', { event: 'side-selection-close' }, () => store.closeSideSelection());
    channel.on('broadcast', { event: 'config-update' }, ({ payload }) => {
      if (payload.config) store.setConfig(payload.config);
    });

    channel.subscribe((status) => console.log('[useTrollToe] Channel status:', status));
    channelRef.current = channel;

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [streamId, enabled, channelName, user?.id]);

  // Timer tick
  useEffect(() => {
    if (store.match?.phase === 'live') {
      timerRef.current = setInterval(() => store.tickTimer(), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [store.match?.phase]);

  // ─── HOST ACTIONS ───

  const createGame = useCallback(async () => {
    if (!isHost || !user) return;
    store.createMatch(streamId, user.id);
    await broadcastState('match-sync', { match: store.match });
    toast.success('Troll Toe game created!');
  }, [isHost, user, streamId, store, broadcastState]);

  const startGame = useCallback(async () => {
    if (!isHost) return;
    // Save original box_count and set to 9 for 3x3 Troll Toe grid
    try {
      const { data: streamData } = await supabase
        .from('streams')
        .select('box_count')
        .eq('id', streamId)
        .single();
      originalBoxCountRef.current = streamData?.box_count || 1;
      await supabase
        .from('streams')
        .update({ box_count: 9 })
        .eq('id', streamId);
    } catch (err) {
      console.error('[useTrollToe] Failed to set box_count to 9:', err);
    }
    store.startMatch();
    await broadcastState('match-start', {});
    toast.success('Game started! Grid expanded to 9 seats!');
  }, [isHost, store, broadcastState, streamId]);

  const pauseGame = useCallback(async () => {
    if (!isHost) return;
    store.pauseMatch();
    await broadcastState('match-pause', {});
    toast.info('Game paused');
  }, [isHost, store, broadcastState]);

  const resumeGame = useCallback(async () => {
    if (!isHost) return;
    store.resumeMatch();
    await broadcastState('match-resume', {});
    toast.info('Game resumed');
  }, [isHost, store, broadcastState]);

  const endGame = useCallback(async () => {
    if (!isHost) return;
    store.endMatch();
    await broadcastState('match-end', {});
    // Restore original box_count
    if (originalBoxCountRef.current !== null) {
      try {
        await supabase
          .from('streams')
          .update({ box_count: originalBoxCountRef.current })
          .eq('id', streamId);
      } catch (err) {
        console.error('[useTrollToe] Failed to restore box_count:', err);
      }
    }
    const winner = store.match?.winnerTeam;
    if (winner && store.match) {
      const winningPlayers = winner === 'broadcaster' ? store.match.broadcasterTeam : store.match.challengerTeam;
      if (winningPlayers.length > 0) {
        const rewardPerPlayer = Math.floor(store.config.rewardAmount / winningPlayers.length);
        for (const player of winningPlayers) {
          try {
            await addCoins({
              userId: player.userId,
              amount: rewardPerPlayer,
              type: 'reward',
              description: `Troll Toe ${winner} team win`,
              sourceId: store.match.id,
            });
          } catch (err) {
            console.error('[useTrollToe] Reward distribution error:', err);
          }
        }
        toast.success(`${winner} team wins! ${store.config.rewardAmount} coins split among ${winningPlayers.length} players!`);
      }
    } else {
      toast.info('Match ended in a draw!');
    }
  }, [isHost, store, broadcastState, streamId]);

  const resetGame = useCallback(async () => {
    if (!isHost) return;
    store.resetBoard();
    // Restore original box_count
    if (originalBoxCountRef.current !== null) {
      try {
        await supabase
          .from('streams')
          .update({ box_count: originalBoxCountRef.current })
          .eq('id', streamId);
      } catch (err) {
        console.error('[useTrollToe] Failed to restore box_count on reset:', err);
      }
    }
    originalBoxCountRef.current = null;
    await broadcastState('match-reset', {});
    toast.info('Board reset');
  }, [isHost, store, broadcastState, streamId]);

  const openSideSelection = useCallback(async () => {
    if (!isHost) return;
    store.openSideSelection();
    await broadcastState('side-selection-open', {});
  }, [isHost, store, broadcastState]);

  const closeSideSelection = useCallback(async () => {
    if (!isHost) return;
    store.closeSideSelection();
    await broadcastState('side-selection-close', {});
  }, [isHost, store, broadcastState]);

  const updateConfig = useCallback(
    async (config: Partial<typeof DEFAULT_TROLLTOE_CONFIG>) => {
      if (!isHost) return;
      store.setConfig(config);
      await broadcastState('config-update', { config });
    },
    [isHost, store, broadcastState]
  );

  const toggleFog = useCallback(async () => {
    if (!isHost || !store.match) return;
    const newMatch = { ...store.match, fogEnabled: !store.match.fogEnabled, updatedAt: new Date().toISOString() };
    store.setMatch(newMatch);
    await broadcastState('match-sync', { match: newMatch });
  }, [isHost, store, broadcastState]);

  const setFogCost = useCallback(async (cost: number) => {
    if (!isHost || !store.match) return;
    const newMatch = { ...store.match, fogCost: cost, updatedAt: new Date().toISOString() };
    store.setMatch(newMatch);
    store.setConfig({ fogCost: cost });
    await broadcastState('match-sync', { match: newMatch });
  }, [isHost, store, broadcastState]);

  const setRewardAmount = useCallback(async (amount: number) => {
    if (!isHost || !store.match) return;
    const newMatch = { ...store.match, rewardAmount: amount, updatedAt: new Date().toISOString() };
    store.setMatch(newMatch);
    store.setConfig({ rewardAmount: amount });
    await broadcastState('match-sync', { match: newMatch });
  }, [isHost, store, broadcastState]);

  // ─── VIEWER ACTIONS ───

  const joinSide = useCallback(
    async (team: TrollToeTeam) => {
      if (!user || !profile || !store.match) return;
      if (store.match.phase !== 'filling' && store.match.phase !== 'live') return;
      const player: TrollToePlayer = {
        userId: user.id,
        username: profile.username || 'Anonymous',
        avatarUrl: profile.avatar_url,
        team,
        symbol: 'X',
        boxIndex: -1,
        joinedAt: new Date().toISOString(),
      };
      store.joinTeam(player);
      store.setViewerTeam(team);
      store.setViewerStatus('queued');
      await broadcastState('player-join', { player });
      toast.success(`Joined ${team} team!`);
    },
    [user, profile, store, broadcastState]
  );

  const useFog = useCallback(
    async (boxIndex: number) => {
      if (!user || !profile || !store.match) return false;
      if (!store.match.fogEnabled) { toast.error('Fog is disabled'); return false; }
      if (store.match.phase !== 'live') { toast.error('Game is not live'); return false; }
      const box = store.match.boxes[boxIndex];
      if (box.state !== 'occupied') { toast.error('This box is empty'); return false; }
      const isInGame = store.match.broadcasterTeam.some((p) => p.userId === user.id) ||
        store.match.challengerTeam.some((p) => p.userId === user.id);
      if (isInGame) { toast.error("You can't use Fog while in the game!"); return false; }
      if (!store.canUseFog(user.id)) { toast.error('Fog is on cooldown!'); return false; }
      const fogCost = store.match.fogCost;
      if ((profile.troll_coins || 0) < fogCost) { toast.error(`You need ${fogCost} Troll Coins to use Fog!`); return false; }

      const result = await deductCoins({
        userId: user.id,
        amount: fogCost,
        type: 'reward',
        description: 'Troll Toe Fog ability',
        metadata: { boxIndex, streamId, matchId: store.match.id },
      });
      if (!result.success) { toast.error(result.error || 'Failed to use Fog'); return false; }

      const success = store.applyFog(boxIndex, user.id, profile.username || 'Anonymous');
      if (success) {
        refreshProfile();
        await broadcastState('fog-applied', { boxIndex, fogUserId: user.id, fogUsername: profile.username || 'Anonymous' });
        toast.success('Fog deployed! Box destroyed!');
      }
      return success;
    },
    [user, profile, store, streamId, broadcastState, refreshProfile]
  );

  const assignQueuedPlayers = useCallback(async () => {
    const match = store.match;
    if (!match || (match.phase !== 'filling' && match.phase !== 'live')) return;
    const availableBoxes = match.boxes.map((b, i) => ({ box: b, index: i })).filter(({ box }) => box.state === 'empty');
    const unassignedBroadcaster = match.broadcasterTeam.filter((p) => !match.boxes.some((b) => b.player?.userId === p.userId));
    const unassignedChallenger = match.challengerTeam.filter((p) => !match.boxes.some((b) => b.player?.userId === p.userId));
    const allUnassigned = [...unassignedBroadcaster, ...unassignedChallenger];
    const toAssign = Math.min(allUnassigned.length, availableBoxes.length);
    for (let i = 0; i < toAssign; i++) {
      const player = allUnassigned[i];
      const boxSlot = availableBoxes[i];
      store.assignPlayerToBox(player, boxSlot.index);
      await broadcastState('player-assigned', { player, boxIndex: boxSlot.index });
    }
    if (toAssign > 0) await syncMatchState();
  }, [store, broadcastState, syncMatchState]);

  return {
    match: store.match,
    config: store.config,
    viewerStatus: store.viewerStatus,
    viewerTeam: store.viewerTeam,
    viewerBoxIndex: store.viewerBoxIndex,
    isControllerOpen: store.isControllerOpen,
    setControllerOpen: store.setControllerOpen,
    createGame,
    startGame,
    pauseGame,
    resumeGame,
    endGame,
    resetGame,
    openSideSelection,
    closeSideSelection,
    updateConfig,
    toggleFog,
    setFogCost,
    setRewardAmount,
    assignQueuedPlayers,
    syncMatchState,
    joinSide,
    useFog,
    checkWinCondition: store.checkWinCondition,
    getTeamCounts: store.getTeamCounts,
    isBoxAvailable: store.isBoxAvailable,
    canUseFog: store.canUseFog,
  };
}
