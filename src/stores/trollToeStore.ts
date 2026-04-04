// src/stores/trollToeStore.ts
// Zustand store for Live Troll Toe game state

import { create } from 'zustand';
import type {
  TrollToeMatch,
  TrollToeConfig,
  TrollToeBox,
  TrollToePlayer,
  TrollToeTeam,
  TrollToeSymbol,
  MatchPhase,
  ViewerStatus,
  FogEvent,
} from '../types/trollToe';
import { DEFAULT_TROLLTOE_CONFIG, createNewMatch, createEmptyBoard, WIN_PATTERNS } from '../types/trollToe';

interface TrollToeStore {
  match: TrollToeMatch | null;
  config: TrollToeConfig;
  viewerStatus: ViewerStatus;
  viewerTeam: TrollToeTeam | null;
  viewerBoxIndex: number | null;
  isControllerOpen: boolean;
  lastFogTime: Record<string, number>;

  setMatch: (match: TrollToeMatch | null) => void;
  setControllerOpen: (open: boolean) => void;
  setConfig: (config: Partial<TrollToeConfig>) => void;

  createMatch: (streamId: string, broadcasterId: string) => void;
  startMatch: () => void;
  pauseMatch: () => void;
  resumeMatch: () => void;
  endMatch: () => void;
  resetBoard: () => void;

  openSideSelection: () => void;
  closeSideSelection: () => void;

  joinTeam: (player: TrollToePlayer) => void;
  removePlayer: (userId: string) => void;
  assignPlayerToBox: (player: TrollToePlayer, boxIndex: number) => void;

  applyFog: (boxIndex: number, fogUserId: string, fogUsername: string) => boolean;

  tickTimer: () => void;
  setRemainingSeconds: (seconds: number) => void;

  setViewerStatus: (status: ViewerStatus) => void;
  setViewerTeam: (team: TrollToeTeam | null) => void;
  setViewerBoxIndex: (index: number | null) => void;

  checkWinCondition: () => TrollToeTeam | null;
  getTeamCounts: () => { broadcaster: number; challenger: number };
  isBoxAvailable: (index: number) => boolean;
  canUseFog: (userId: string) => boolean;
}

export const useTrollToeStore = create<TrollToeStore>((set, get) => ({
  match: null,
  config: { ...DEFAULT_TROLLTOE_CONFIG },
  viewerStatus: 'idle',
  viewerTeam: null,
  viewerBoxIndex: null,
  isControllerOpen: false,
  lastFogTime: {},

  setMatch: (match) => set({ match }),
  setControllerOpen: (open) => set({ isControllerOpen: open }),
  setConfig: (config) => set((s) => ({ config: { ...s.config, ...config } })),

  createMatch: (streamId, broadcasterId) => {
    const match = createNewMatch(streamId, broadcasterId);
    set({ match, viewerStatus: 'idle', viewerTeam: null, viewerBoxIndex: null });
  },

  startMatch: () => {
    const { match, config } = get();
    if (!match) return;
    const now = new Date();
    const endTime = new Date(now.getTime() + config.roundTimerSeconds * 1000);
    set({
      match: {
        ...match,
        phase: 'live',
        sideSelectionOpen: false,
        timerStartTime: now.toISOString(),
        timerEndTime: endTime.toISOString(),
        remainingSeconds: config.roundTimerSeconds,
        updatedAt: now.toISOString(),
      },
    });
  },

  pauseMatch: () => {
    const { match } = get();
    if (!match || match.phase !== 'live') return;
    set({
      match: {
        ...match,
        phase: 'paused',
        updatedAt: new Date().toISOString(),
      },
    });
  },

  resumeMatch: () => {
    const { match } = get();
    if (!match || match.phase !== 'paused') return;
    const now = new Date();
    const endTime = new Date(now.getTime() + match.remainingSeconds * 1000);
    set({
      match: {
        ...match,
        phase: 'live',
        timerStartTime: now.toISOString(),
        timerEndTime: endTime.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
  },

  endMatch: () => {
    const { match } = get();
    if (!match) return;
    const winner = get().checkWinCondition();
    set({
      match: {
        ...match,
        phase: 'ended',
        winnerTeam: winner,
        updatedAt: new Date().toISOString(),
      },
      viewerStatus: winner
        ? (get().viewerTeam === winner ? 'winner' : 'loser')
        : get().viewerStatus,
    });
  },

  resetBoard: () => {
    const { match } = get();
    if (!match) return;
    set({
      match: {
        ...match,
        phase: 'waiting',
        boxes: createEmptyBoard(),
        broadcasterTeam: [],
        challengerTeam: [],
        winnerTeam: null,
        timerStartTime: null,
        timerEndTime: null,
        remainingSeconds: DEFAULT_TROLLTOE_CONFIG.roundTimerSeconds,
        sideSelectionOpen: false,
        fogEvents: [],
        updatedAt: new Date().toISOString(),
      },
      viewerStatus: 'idle',
      viewerTeam: null,
      viewerBoxIndex: null,
    });
  },

  openSideSelection: () => {
    const { match } = get();
    if (!match) return;
    set({
      match: {
        ...match,
        sideSelectionOpen: true,
        phase: match.phase === 'waiting' ? 'filling' : match.phase,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  closeSideSelection: () => {
    const { match } = get();
    if (!match) return;
    set({
      match: {
        ...match,
        sideSelectionOpen: false,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  joinTeam: (player) => {
    const { match } = get();
    if (!match) return;
    const isBroadcaster = player.team === 'broadcaster';
    const team = isBroadcaster ? match.broadcasterTeam : match.challengerTeam;
    if (team.some((p) => p.userId === player.userId)) return;
    const newTeam = [...team, player];
    set({
      match: {
        ...match,
        broadcasterTeam: isBroadcaster ? newTeam : match.broadcasterTeam,
        challengerTeam: !isBroadcaster ? newTeam : match.challengerTeam,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  removePlayer: (userId) => {
    const { match } = get();
    if (!match) return;
    const updatedBoxes = match.boxes.map((box) => {
      if (box.player?.userId === userId) {
        return { ...box, state: 'empty' as const, player: null, symbol: null };
      }
      return box;
    });
    const broadcasterTeam = match.broadcasterTeam.filter((p) => p.userId !== userId);
    const challengerTeam = match.challengerTeam.filter((p) => p.userId !== userId);
    set({
      match: {
        ...match,
        boxes: updatedBoxes,
        broadcasterTeam,
        challengerTeam,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  assignPlayerToBox: (player, boxIndex) => {
    const { match } = get();
    if (!match) return;
    if (match.boxes[boxIndex].state !== 'empty') return;
    const symbol: TrollToeSymbol = Math.random() > 0.5 ? 'X' : 'O';
    const now = new Date();
    const spawnProtectionEnds = new Date(now.getTime() + get().config.spawnProtectionSeconds * 1000);
    const updatedPlayer = {
      ...player,
      boxIndex,
      symbol,
      spawnProtectedUntil: spawnProtectionEnds.toISOString(),
    };
    const updatedBoxes = [...match.boxes];
    updatedBoxes[boxIndex] = {
      ...updatedBoxes[boxIndex],
      state: 'occupied',
      player: updatedPlayer,
      symbol,
    };
    const isBroadcaster = player.team === 'broadcaster';
    const teamKey = isBroadcaster ? 'broadcasterTeam' : 'challengerTeam';
    const teamArr = match[teamKey].map((p) =>
      p.userId === player.userId ? updatedPlayer : p
    );
    set({
      match: {
        ...match,
        boxes: updatedBoxes,
        [teamKey]: teamArr,
        updatedAt: now.toISOString(),
      },
    });
  },

  applyFog: (boxIndex, fogUserId, fogUsername) => {
    const { match, config, lastFogTime } = get();
    if (!match || !match.fogEnabled) return false;
    if (match.phase !== 'live') return false;
    const box = match.boxes[boxIndex];
    if (box.state !== 'occupied' || !box.player) return false;
    const lastFog = lastFogTime[fogUserId] || 0;
    if (Date.now() - lastFog < config.fogCooldownSeconds * 1000) return false;
    if (box.player.spawnProtectedUntil && new Date(box.player.spawnProtectedUntil) > new Date()) return false;

    const now = new Date();
    const cooldownEnds = new Date(now.getTime() + config.boxRecoverySeconds * 1000);
    const updatedBoxes = [...match.boxes];
    updatedBoxes[boxIndex] = {
      ...updatedBoxes[boxIndex],
      state: 'broken',
      player: null,
      symbol: null,
      brokenAt: now.toISOString(),
      brokenCooldownEnds: cooldownEnds.toISOString(),
    };
    const removedPlayer = box.player;
    const teamKey = removedPlayer.team === 'broadcaster' ? 'broadcasterTeam' : 'challengerTeam';
    const teamArr = match[teamKey].filter((p) => p.userId !== removedPlayer.userId);
    const fogEvent: FogEvent = {
      id: `fog-${Date.now()}`,
      userId: fogUserId,
      username: fogUsername,
      boxIndex,
      timestamp: now.toISOString(),
      cost: match.fogCost,
    };
    set({
      match: {
        ...match,
        boxes: updatedBoxes,
        [teamKey]: teamArr,
        fogEvents: [...match.fogEvents, fogEvent],
        updatedAt: now.toISOString(),
      },
      lastFogTime: { ...lastFogTime, [fogUserId]: Date.now() },
    });

    setTimeout(() => {
      const currentMatch = get().match;
      if (!currentMatch) return;
      const currentBox = currentMatch.boxes[boxIndex];
      if (currentBox.state === 'broken' && currentBox.brokenCooldownEnds) {
        if (new Date() >= new Date(currentBox.brokenCooldownEnds)) {
          const recoveredBoxes = [...currentMatch.boxes];
          recoveredBoxes[boxIndex] = {
            ...recoveredBoxes[boxIndex],
            state: 'empty',
            brokenAt: null,
            brokenCooldownEnds: null,
          };
          set({
            match: { ...currentMatch, boxes: recoveredBoxes, updatedAt: new Date().toISOString() },
          });
        }
      }
    }, config.boxRecoverySeconds * 1000);

    return true;
  },

  tickTimer: () => {
    const { match } = get();
    if (!match || match.phase !== 'live') return;
    if (match.remainingSeconds <= 0) {
      get().endMatch();
      return;
    }
    set({
      match: { ...match, remainingSeconds: match.remainingSeconds - 1, updatedAt: new Date().toISOString() },
    });
  },

  setRemainingSeconds: (seconds) => {
    const { match } = get();
    if (!match) return;
    set({
      match: { ...match, remainingSeconds: seconds, updatedAt: new Date().toISOString() },
    });
  },

  setViewerStatus: (status) => set({ viewerStatus: status }),
  setViewerTeam: (team) => set({ viewerTeam: team }),
  setViewerBoxIndex: (index) => set({ viewerBoxIndex: index }),

  checkWinCondition: () => {
    const { match } = get();
    if (!match) return null;
    for (const pattern of WIN_PATTERNS) {
      const [a, b, c] = pattern;
      const boxA = match.boxes[a];
      const boxB = match.boxes[b];
      const boxC = match.boxes[c];
      if (
        boxA.player && boxB.player && boxC.player &&
        boxA.player.team === boxB.player.team &&
        boxB.player.team === boxC.player.team
      ) {
        return boxA.player.team;
      }
    }
    return null;
  },

  getTeamCounts: () => {
    const { match } = get();
    if (!match) return { broadcaster: 0, challenger: 0 };
    return {
      broadcaster: match.broadcasterTeam.length,
      challenger: match.challengerTeam.length,
    };
  },

  isBoxAvailable: (index) => {
    const { match } = get();
    if (!match) return false;
    return match.boxes[index]?.state === 'empty';
  },

  canUseFog: (userId) => {
    const { match, config, lastFogTime } = get();
    if (!match || !match.fogEnabled || match.phase !== 'live') return false;
    const lastFog = lastFogTime[userId] || 0;
    return Date.now() - lastFog >= config.fogCooldownSeconds * 1000;
  },
}));
