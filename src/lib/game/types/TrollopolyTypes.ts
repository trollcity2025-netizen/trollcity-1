// Trollopoly Game Types - 3D Mini City Board Game

import { PlayerState, BaseGameState } from '../InternetGameTypes';
import { GameAction } from '../InternetGameTypes';

export type TrollopolyGamePhase = 
  | 'queue'           // Waiting in queue for players
  | 'countdown'       // Match starting countdown
  | 'waiting_for_roll' // Waiting for current player to roll
  | 'rolling_dice'    // Dice rolling animation
  | 'moving'          // Player vehicle moving
  | 'property_action' // Buy/rent decision
  | 'card_draw'       // Drawing chance/community card
  | 'jail'            // In jail
  | 'auction'         // Property auction
  | 'trade'           // Trading between players
  | 'finished';       // Game over

export type PropertyType = 
  | 'residential' 
  | 'business' 
  | 'media' 
  | 'luxury' 
  | 'shopping' 
  | 'government' 
  | 'entertainment'
  | 'utility' 
  | 'transport' 
  | 'special'; // GO, Jail, Chance, etc.

export type CardType = 'chance' | 'community';

export interface Property {
  id: number;
  name: string;
  type: PropertyType;
  price: number;
  baseRent: number;
  houseCost: number;
  hotelCost: number;
  rents: number[]; // [base, 1house, 2houses, 3houses, 4houses, hotel]
  ownerId?: string;
  houseCount: number;
  hasHotel: boolean;
  isMortgaged: boolean;
  color: string; // Color group
  position: { x: number; z: number }; // 3D board position
  rotation: number; // Building rotation
}

export interface Card {
  id: string;
  type: CardType;
  title: string;
  description: string;
  action: CardAction;
}

export type CardAction = 
  | { type: 'move_to'; propertyId: number }
  | { type: 'move_to_nearest'; propertyType: 'transport' | 'utility' }
  | { type: 'move_spaces'; spaces: number }
  | { type: 'pay'; amount: number; target?: 'bank' | 'players' }
  | { type: 'receive'; amount: number; from?: 'bank' | 'players' }
  | { type: 'go_to_jail' }
  | { type: 'get_out_of_jail_free' }
  | { type: 'repairs'; houseCost: number; hotelCost: number };

export interface TrollopolyPlayer extends PlayerState {
  position: number; // 0-39 board position
  coins: number;
  properties: number[]; // Property IDs owned
  isInJail: boolean;
  jailTurns: number;
  hasGetOutOfJailFree: boolean;
  isBankrupt: boolean;
  vehicleType: VehicleType;
  vehicleColor: string;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  isConnected: boolean;
  lastRoll?: { die1: number; die2: number };
  doublesCount: number;
}

export type VehicleType = 
  | 'sports_car' 
  | 'taxi' 
  | 'police_car' 
  | 'limousine' 
  | 'hover_car';

export interface DiceState {
  die1: number;
  die2: number;
  isRolling: boolean;
  animationProgress: number;
}

export interface AuctionState {
  propertyId: number;
  currentBid: number;
  currentBidderId?: string;
  participants: string[];
  timeRemaining: number;
}

export interface TradeOffer {
  fromPlayerId: string;
  toPlayerId: string;
  offeredProperties: number[];
  requestedProperties: number[];
  offeredCoins: number;
  requestedCoins: number;
}

export interface Spectator {
  id: string;
  username: string;
  avatarUrl?: string;
  joinedAt: string;
}

export interface TrollopolyGameState extends BaseGameState {
  gameType: 'trollopoly';
  phase: TrollopolyGamePhase;
  players: TrollopolyPlayer[];
  properties: Property[];
  currentPlayerIndex: number;
  dice: DiceState;
  cards: {
    chance: Card[];
    community: Card[];
    chanceIndex: number;
    communityIndex: number;
  };
  auction?: AuctionState;
  activeCard?: Card;
  tradeOffer?: TradeOffer;
  spectators: Spectator[];
  spectatorCount: number;
  streamId?: string; // Broadcast stream ID
  chatChannelId?: string;
  queueState?: {
    playersInQueue: string[];
    countdownStartTime?: number;
    countdownDuration: number;
  };
  gameLog: GameLogEntry[];
  freeParkingCoins: number;
  turnCount: number;
  startTime: number;
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  type: 'roll' | 'move' | 'purchase' | 'rent' | 'card' | 'jail' | 'auction' | 'trade' | 'bankrupt' | 'system';
  playerId?: string;
  message: string;
  data?: any;
}

// Queue System Types
export interface TrollopolyQueueState {
  id: string;
  status: 'waiting' | 'countdown' | 'starting';
  players: QueuePlayer[];
  maxPlayers: number;
  minPlayers: number;
  countdownStartedAt?: number;
  countdownDuration: number;
  createdAt: string;
  matchId?: string;
}

export interface QueuePlayer {
  userId: string;
  username: string;
  avatarUrl?: string;
  joinedAt: string;
  isReady: boolean;
}

// Live Match Types
export interface LiveTrollopolyMatch {
  id: string;
  status: 'waiting' | 'active' | 'finished';
  players: { id: string; username: string; avatarUrl?: string }[];
  spectatorCount: number;
  maxPlayers: number;
  currentPlayerUsername?: string;
  startedAt?: string;
  canJoin: boolean;
}

// Camera Layout Types
export interface CameraPosition {
  playerId: string;
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  isActive: boolean;
  isHighlighted: boolean;
}

// Constants
export const TROLLOPOLY_PROPERTIES: Omit<Property, 'ownerId' | 'houseCount' | 'hasHotel' | 'isMortgaged'>[] = [
  // Bottom row (0-10)
  { id: 0, name: 'City Center', type: 'special', price: 0, baseRent: 0, houseCost: 0, hotelCost: 0, rents: [], color: '#ffffff', position: { x: 8, z: 8 }, rotation: 0 },
  { id: 1, name: 'Residential Block A', type: 'residential', price: 60, baseRent: 2, houseCost: 50, hotelCost: 250, rents: [2, 10, 30, 90, 160, 250], color: '#8B4513', position: { x: 6.5, z: 8 }, rotation: 0 },
  { id: 2, name: 'Community Fund', type: 'special', price: 0, baseRent: 0, houseCost: 0, hotelCost: 0, rents: [], color: '#ffffff', position: { x: 5.5, z: 8 }, rotation: 0 },
  { id: 3, name: 'Residential Block B', type: 'residential', price: 60, baseRent: 4, houseCost: 50, hotelCost: 250, rents: [4, 20, 60, 180, 320, 450], color: '#8B4513', position: { x: 4.5, z: 8 }, rotation: 0 },
  { id: 4, name: 'Income Tax', type: 'special', price: 0, baseRent: 200, houseCost: 0, hotelCost: 0, rents: [], color: '#ffffff', position: { x: 3.5, z: 8 }, rotation: 0 },
  { id: 5, name: 'Train Station', type: 'transport', price: 200, baseRent: 25, houseCost: 0, hotelCost: 0, rents: [25, 50, 100, 200], color: '#ffffff', position: { x: 2.5, z: 8 }, rotation: 0 },
  { id: 6, name: 'Marketplace', type: 'business', price: 100, baseRent: 6, houseCost: 50, hotelCost: 250, rents: [6, 30, 90, 270, 400, 550], color: '#87CEEB', position: { x: 1.5, z: 8 }, rotation: 0 },
  { id: 7, name: 'Chance', type: 'special', price: 0, baseRent: 0, houseCost: 0, hotelCost: 0, rents: [], color: '#ff6b6b', position: { x: 0.5, z: 8 }, rotation: 0 },
  { id: 8, name: 'Apartment District A', type: 'residential', price: 100, baseRent: 6, houseCost: 50, hotelCost: 250, rents: [6, 30, 90, 270, 400, 550], color: '#87CEEB', position: { x: -0.5, z: 8 }, rotation: 0 },
  { id: 9, name: 'Apartment District B', type: 'residential', price: 120, baseRent: 8, houseCost: 50, hotelCost: 250, rents: [8, 40, 100, 300, 450, 600], color: '#87CEEB', position: { x: -1.5, z: 8 }, rotation: 0 },
  { id: 10, name: 'Troll Jail', type: 'special', price: 0, baseRent: 0, houseCost: 0, hotelCost: 0, rents: [], color: '#333333', position: { x: -3, z: 8 }, rotation: 0 },
  
  // Left row (11-20)
  { id: 11, name: 'Business District A', type: 'business', price: 140, baseRent: 10, houseCost: 100, hotelCost: 500, rents: [10, 50, 150, 450, 625, 750], color: '#ff69b4', position: { x: -3, z: 6.5 }, rotation: -Math.PI / 2 },
  { id: 12, name: 'Electric Utility', type: 'utility', price: 150, baseRent: 0, houseCost: 0, hotelCost: 0, rents: [], color: '#ffd700', position: { x: -3, z: 5.5 }, rotation: -Math.PI / 2 },
  { id: 13, name: 'Business District B', type: 'business', price: 140, baseRent: 10, houseCost: 100, hotelCost: 500, rents: [10, 50, 150, 450, 625, 750], color: '#ff69b4', position: { x: -3, z: 4.5 }, rotation: -Math.PI / 2 },
  { id: 14, name: 'Business District C', type: 'business', price: 160, baseRent: 12, houseCost: 100, hotelCost: 500, rents: [12, 60, 180, 500, 700, 900], color: '#ff69b4', position: { x: -3, z: 3.5 }, rotation: -Math.PI / 2 },
  { id: 15, name: 'Central Train Station', type: 'transport', price: 200, baseRent: 25, houseCost: 0, hotelCost: 0, rents: [25, 50, 100, 200], color: '#ffffff', position: { x: -3, z: 2.5 }, rotation: -Math.PI / 2 },
  { id: 16, name: 'Media City Studio A', type: 'media', price: 180, baseRent: 14, houseCost: 100, hotelCost: 500, rents: [14, 70, 200, 550, 750, 950], color: '#ff8c00', position: { x: -3, z: 1.5 }, rotation: -Math.PI / 2 },
  { id: 17, name: 'Community Fund', type: 'special', price: 0, baseRent: 0, houseCost: 0, hotelCost: 0, rents: [], color: '#ffffff', position: { x: -3, z: 0.5 }, rotation: -Math.PI / 2 },
  { id: 18, name: 'Media City Studio B', type: 'media', price: 180, baseRent: 14, houseCost: 100, hotelCost: 500, rents: [14, 70, 200, 550, 750, 950], color: '#ff8c00', position: { x: -3, z: -0.5 }, rotation: -Math.PI / 2 },
  { id: 19, name: 'Media City Studio C', type: 'media', price: 200, baseRent: 16, houseCost: 100, hotelCost: 500, rents: [16, 80, 220, 600, 800, 1000], color: '#ff8c00', position: { x: -3, z: -1.5 }, rotation: -Math.PI / 2 },
  { id: 20, name: 'Public Park', type: 'special', price: 0, baseRent: 0, houseCost: 0, hotelCost: 0, rents: [], color: '#228b22', position: { x: -3, z: -3 }, rotation: -Math.PI / 2 },
  
  // Top row (21-30)
  { id: 21, name: 'Luxury Avenue A', type: 'luxury', price: 220, baseRent: 18, houseCost: 150, hotelCost: 750, rents: [18, 90, 250, 700, 875, 1050], color: '#dc143c', position: { x: -1.5, z: -3 }, rotation: Math.PI },
  { id: 22, name: 'Chance', type: 'special', price: 0, baseRent: 0, houseCost: 0, hotelCost: 0, rents: [], color: '#ff6b6b', position: { x: -0.5, z: -3 }, rotation: Math.PI },
  { id: 23, name: 'Luxury Avenue B', type: 'luxury', price: 220, baseRent: 18, houseCost: 150, hotelCost: 750, rents: [18, 90, 250, 700, 875, 1050], color: '#dc143c', position: { x: 0.5, z: -3 }, rotation: Math.PI },
  { id: 24, name: 'Luxury Avenue C', type: 'luxury', price: 240, baseRent: 20, houseCost: 150, hotelCost: 750, rents: [20, 100, 300, 750, 925, 1100], color: '#dc143c', position: { x: 1.5, z: -3 }, rotation: Math.PI },
  { id: 25, name: 'Train Depot', type: 'transport', price: 200, baseRent: 25, houseCost: 0, hotelCost: 0, rents: [25, 50, 100, 200], color: '#ffffff', position: { x: 2.5, z: -3 }, rotation: Math.PI },
  { id: 26, name: 'Government Plaza A', type: 'government', price: 260, baseRent: 22, houseCost: 150, hotelCost: 750, rents: [22, 110, 330, 800, 975, 1150], color: '#ffff00', position: { x: 3.5, z: -3 }, rotation: Math.PI },
  { id: 27, name: 'Government Plaza B', type: 'government', price: 260, baseRent: 22, houseCost: 150, hotelCost: 750, rents: [22, 110, 330, 800, 975, 1150], color: '#ffff00', position: { x: 4.5, z: -3 }, rotation: Math.PI },
  { id: 28, name: 'Water Utility', type: 'utility', price: 150, baseRent: 0, houseCost: 0, hotelCost: 0, rents: [], color: '#4169e1', position: { x: 5.5, z: -3 }, rotation: Math.PI },
  { id: 29, name: 'Government Plaza C', type: 'government', price: 280, baseRent: 24, houseCost: 150, hotelCost: 750, rents: [24, 120, 360, 850, 1025, 1200], color: '#ffff00', position: { x: 6.5, z: -3 }, rotation: Math.PI },
  { id: 30, name: 'Go To Jail', type: 'special', price: 0, baseRent: 0, houseCost: 0, hotelCost: 0, rents: [], color: '#333333', position: { x: 8, z: -3 }, rotation: Math.PI },
  
  // Right row (31-39)
  { id: 31, name: 'Shopping District A', type: 'shopping', price: 300, baseRent: 26, houseCost: 200, hotelCost: 1000, rents: [26, 130, 390, 900, 1100, 1275], color: '#32cd32', position: { x: 8, z: -1.5 }, rotation: Math.PI / 2 },
  { id: 32, name: 'Shopping District B', type: 'shopping', price: 300, baseRent: 26, houseCost: 200, hotelCost: 1000, rents: [26, 130, 390, 900, 1100, 1275], color: '#32cd32', position: { x: 8, z: -0.5 }, rotation: Math.PI / 2 },
  { id: 33, name: 'Community Fund', type: 'special', price: 0, baseRent: 0, houseCost: 0, hotelCost: 0, rents: [], color: '#ffffff', position: { x: 8, z: 0.5 }, rotation: Math.PI / 2 },
  { id: 34, name: 'Shopping District C', type: 'shopping', price: 320, baseRent: 28, houseCost: 200, hotelCost: 1000, rents: [28, 150, 450, 1000, 1200, 1400], color: '#32cd32', position: { x: 8, z: 1.5 }, rotation: Math.PI / 2 },
  { id: 35, name: 'Train Station', type: 'transport', price: 200, baseRent: 25, houseCost: 0, hotelCost: 0, rents: [25, 50, 100, 200], color: '#ffffff', position: { x: 8, z: 2.5 }, rotation: Math.PI / 2 },
  { id: 36, name: 'Chance', type: 'special', price: 0, baseRent: 0, houseCost: 0, hotelCost: 0, rents: [], color: '#ff6b6b', position: { x: 8, z: 3.5 }, rotation: Math.PI / 2 },
  { id: 37, name: 'Entertainment District A', type: 'entertainment', price: 350, baseRent: 35, houseCost: 200, hotelCost: 1000, rents: [35, 175, 500, 1100, 1300, 1500], color: '#4169e1', position: { x: 8, z: 4.5 }, rotation: Math.PI / 2 },
  { id: 38, name: 'Luxury Tax', type: 'special', price: 0, baseRent: 100, houseCost: 0, hotelCost: 0, rents: [], color: '#ffffff', position: { x: 8, z: 5.5 }, rotation: Math.PI / 2 },
  { id: 39, name: 'Entertainment District B', type: 'entertainment', price: 400, baseRent: 50, houseCost: 200, hotelCost: 1000, rents: [50, 200, 600, 1400, 1700, 2000], color: '#4169e1', position: { x: 8, z: 6.5 }, rotation: Math.PI / 2 },
];

export const VEHICLE_COLORS = ['#ff4444', '#4444ff', '#44ff44', '#ffff44'];

export const INITIAL_PLAYER_COINS = 1500;

export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;

export const QUEUE_COUNTDOWN_SECONDS = 15;
