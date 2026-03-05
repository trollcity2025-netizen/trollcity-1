import { GameType } from './gameTypes';

// ============================================
// BASE TYPES (Shared with existing system)
// ============================================

export interface PlayerState {
  id: string;
  username: string;
  score: number;
  isHost: boolean;
  isConnected: boolean;
}

export type MatchStatus = 'waiting' | 'ready' | 'active' | 'finished' | 'cancelled';

export interface BaseGameState {
  matchId: string;
  gameType: GameType;
  players: PlayerState[];
  status: MatchStatus;
  timerRemaining: number;
  winnerId?: string;
  startTime?: number;
  endTime?: number;
  [key: string]: any;
}

// ============================================
// INTERNET GAME TYPES
// ============================================

export type InternetGameType = 'snake' | 'pong' | 'tetris' | 'pacman' | 'trollopoly';

export interface InternetGameConfig {
  id: InternetGameType;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  supportsMultiplayer: boolean;
  gameDuration: number; // in seconds, 0 for unlimited
  thumbnailUrl?: string;
}

// ============================================
// SNAKE GAME TYPES
// ============================================

export type SnakeDirection = 'up' | 'down' | 'left' | 'right';

export interface SnakePlayerState extends PlayerState {
  snake: { x: number; y: number }[];
  direction: SnakeDirection;
  nextDirection: SnakeDirection;
  isAlive: boolean;
  color: string;
}

export interface SnakeGameState extends BaseGameState {
  gameType: 'snake';
  players: SnakePlayerState[];
  food: { x: number; y: number };
  gridSize: { width: number; height: number };
  gameLoopInterval: number;
  phase: 'countdown' | 'playing' | 'finished';
}

// ============================================
// PONG GAME TYPES
// ============================================

export interface PongPlayerState extends PlayerState {
  paddleY: number;
  paddleHeight: number;
  color: string;
}

export interface PongBall {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
}

export interface PongGameState extends BaseGameState {
  gameType: 'pong';
  players: PongPlayerState[];
  ball: PongBall;
  canvasWidth: number;
  canvasHeight: number;
  winningScore: number;
  phase: 'countdown' | 'playing' | 'finished';
}

// ============================================
// TETRIS GAME TYPES
// ============================================

export type TetrisPieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export interface TetrisPiece {
  type: TetrisPieceType;
  x: number;
  y: number;
  rotation: number;
}

export interface TetrisPlayerState extends PlayerState {
  board: (string | null)[][];
  currentPiece: TetrisPiece | null;
  nextPiece: TetrisPieceType;
  linesCleared: number;
  level: number;
  isGameOver: boolean;
  color: string;
}

export interface TetrisGameState extends BaseGameState {
  gameType: 'tetris';
  players: TetrisPlayerState[];
  gridWidth: number;
  gridHeight: number;
  phase: 'countdown' | 'playing' | 'finished';
}

// ============================================
// PACMAN GAME TYPES
// ============================================

export type PacmanDirection = 'up' | 'down' | 'left' | 'right';

export interface PacmanGhost {
  id: number;
  x: number;
  y: number;
  color: string;
  isScared: boolean;
}

export interface PacmanPlayerState extends PlayerState {
  x: number;
  y: number;
  direction: PacmanDirection;
  nextDirection: PacmanDirection;
  lives: number;
  dotsEaten: number;
  isPowered: boolean;
  powerTimeRemaining: number;
  color: string;
}

export interface PacmanGameState extends BaseGameState {
  gameType: 'pacman';
  players: PacmanPlayerState[];
  ghosts: PacmanGhost[];
  dots: { x: number; y: number }[];
  powerPellets: { x: number; y: number }[];
  walls: { x: number; y: number }[];
  gridSize: { width: number; height: number };
  phase: 'countdown' | 'playing' | 'finished';
}

// ============================================
// GAME ACTION TYPES
// ============================================

export interface GameAction {
  type: string;
  payload: any;
  timestamp: number;
  playerId: string;
}

export type InternetGameState = SnakeGameState | PongGameState | TetrisGameState | PacmanGameState;

// ============================================
// GAME ENGINE INTERFACE
// ============================================

export interface InternetGameEngine<T extends InternetGameState> {
  initializeGame(players: { id: string; username: string }[], matchId: string): T;
  processAction(state: T, action: GameAction): T;
  updateGameState(state: T, deltaTime: number): T;
  checkWinCondition(state: T): { winnerId?: string; isDraw: boolean } | null;
  getGameConfig(): InternetGameConfig;
}

// ============================================
// GAME REGISTRY
// ============================================

export const INTERNET_GAMES: Record<InternetGameType, InternetGameConfig> = {
  snake: {
    id: 'snake',
    name: 'Snake Arena',
    description: 'Classic snake game with multiplayer support. Eat food, grow longer, avoid walls and other snakes!',
    minPlayers: 1,
    maxPlayers: 4,
    supportsMultiplayer: true,
    gameDuration: 180, // 3 minutes
  },
  pong: {
    id: 'pong',
    name: 'Retro Pong',
    description: 'The classic paddle game. First to 10 points wins!',
    minPlayers: 2,
    maxPlayers: 2,
    supportsMultiplayer: true,
    gameDuration: 0, // Unlimited until someone wins
  },
  tetris: {
    id: 'tetris',
    name: 'Block Drop',
    description: 'Race to clear lines in this classic puzzle game. Most lines cleared wins!',
    minPlayers: 1,
    maxPlayers: 4,
    supportsMultiplayer: true,
    gameDuration: 300, // 5 minutes
  },
  pacman: {
    id: 'pacman',
    name: 'Munch Man',
    description: 'Navigate the maze, eat dots, avoid ghosts. Most dots eaten wins!',
    minPlayers: 1,
    maxPlayers: 2,
    supportsMultiplayer: true,
    gameDuration: 180, // 3 minutes
  },
  trollopoly: {
    id: 'trollopoly',
    name: 'Trollopoly',
    description: '3D Mini City Board Game! Buy properties, build your empire, bankrupt your opponents!',
    minPlayers: 2,
    maxPlayers: 4,
    supportsMultiplayer: true,
    gameDuration: 0, // Unlimited until winner
  },
};
