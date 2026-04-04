// src/types/trollToe.ts
// Live Troll Toe game types for Troll City broadcast integration

export type TrollToeTeam = 'broadcaster' | 'challenger';
export type TrollToeSymbol = 'X' | 'O';
export type MatchPhase = 'waiting' | 'filling' | 'live' | 'paused' | 'ended';
export type BoxState = 'empty' | 'occupied' | 'broken';
export type ViewerStatus = 'idle' | 'queued' | 'assigned' | 'removed_by_fog' | 'winner' | 'loser';

export interface TrollToePlayer {
  userId: string;
  username: string;
  avatarUrl?: string;
  team: TrollToeTeam;
  symbol: TrollToeSymbol;
  boxIndex: number; // 0-8
  joinedAt: string;
  spawnProtectedUntil?: string;
}

export interface TrollToeBox {
  index: number;
  state: BoxState;
  player: TrollToePlayer | null;
  symbol: TrollToeSymbol | null;
  brokenAt: string | null;
  brokenCooldownEnds: string | null;
}

export interface FogEvent {
  id: string;
  userId: string;
  username: string;
  boxIndex: number;
  timestamp: string;
  cost: number;
}

export interface TrollToeMatch {
  id: string;
  streamId: string;
  broadcasterId: string;
  phase: MatchPhase;
  boxes: TrollToeBox[];
  broadcasterTeam: TrollToePlayer[];
  challengerTeam: TrollToePlayer[];
  winnerTeam: TrollToeTeam | null;
  timerStartTime: string | null;
  timerEndTime: string | null;
  remainingSeconds: number;
  fogEnabled: boolean;
  fogCost: number;
  rewardAmount: number;
  sideSelectionOpen: boolean;
  fogEvents: FogEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface TrollToeConfig {
  fogCost: number;
  rewardAmount: number;
  roundTimerSeconds: number;
  fogCooldownSeconds: number;
  boxRecoverySeconds: number;
  spawnProtectionSeconds: number;
}

export const DEFAULT_TROLLTOE_CONFIG: TrollToeConfig = {
  fogCost: 50,
  rewardAmount: 100,
  roundTimerSeconds: 180, // 3 minutes
  fogCooldownSeconds: 15,
  boxRecoverySeconds: 10,
  spawnProtectionSeconds: 3,
};

export interface TrollToeState {
  match: TrollToeMatch | null;
  config: TrollToeConfig;
  viewerStatus: ViewerStatus;
  viewerTeam: TrollToeTeam | null;
  viewerBoxIndex: number | null;
  isControllerOpen: boolean;
}

// Win check patterns (rows, columns, diagonals)
export const WIN_PATTERNS: number[][] = [
  [0, 1, 2], // top row
  [3, 4, 5], // middle row
  [6, 7, 8], // bottom row
  [0, 3, 6], // left column
  [1, 4, 7], // middle column
  [2, 5, 8], // right column
  [0, 4, 8], // diagonal top-left to bottom-right
  [2, 4, 6], // diagonal top-right to bottom-left
];

export function createEmptyBoard(): TrollToeBox[] {
  return Array.from({ length: 9 }, (_, i) => ({
    index: i,
    state: 'empty' as BoxState,
    player: null,
    symbol: null,
    brokenAt: null,
    brokenCooldownEnds: null,
  }));
}

export function createNewMatch(streamId: string, broadcasterId: string): TrollToeMatch {
  return {
    id: `trolltoe-${streamId}-${Date.now()}`,
    streamId,
    broadcasterId,
    phase: 'waiting',
    boxes: createEmptyBoard(),
    broadcasterTeam: [],
    challengerTeam: [],
    winnerTeam: null,
    timerStartTime: null,
    timerEndTime: null,
    remainingSeconds: DEFAULT_TROLLTOE_CONFIG.roundTimerSeconds,
    fogEnabled: true,
    fogCost: DEFAULT_TROLLTOE_CONFIG.fogCost,
    rewardAmount: DEFAULT_TROLLTOE_CONFIG.rewardAmount,
    sideSelectionOpen: false,
    fogEvents: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
