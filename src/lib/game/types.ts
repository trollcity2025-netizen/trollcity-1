import { GameType } from '@//pages/TrollGamesPage';

// Base interfaces
export interface PlayerState {
  id: string; // User ID
  username: string; // User's display name
  score: number;
  isHost: boolean;
  isConnected: boolean; // Indicates if the player is currently connected via Realtime presence
  // Add other player-specific state as needed (e.g., connected, ready)
}

export type MatchStatus = 'waiting' | 'ready' | 'active' | 'finished' | 'cancelled';

export interface GameState {
  matchId: string;
  gameType: GameType;
  players: PlayerState[];
  status: MatchStatus;
  currentTurnPlayerId?: string; // For turn-based games
  timerRemaining: number; // Seconds
  winnerId?: string;
  // Generic game-specific state (e.g., board, positions, scores)
  // This will be specialized in extended interfaces
  [key: string]: any; 
}

// Reaction Speed Arena specific interfaces
export type ReactionSpeedPhase = 'countdown' | 'waiting_for_reaction' | 'finished';

export interface ReactionSpeedPlayerState extends PlayerState {
  reactionTime: number | null; // Milliseconds from trigger
  hasReacted: boolean;
}

export interface ReactionSpeedGameState extends GameState {
  gameType: 'reaction-speed';
  players: ReactionSpeedPlayerState[];
  phase: ReactionSpeedPhase;
  triggerTimestamp: number | null; // Server timestamp when the reaction trigger occurred
  countdownStartTime: number | null; // Server timestamp when countdown started
  // You can add more specific state for Reaction Speed here, e.g.,
  // reactionPrompt: string; // What players need to react to
}
