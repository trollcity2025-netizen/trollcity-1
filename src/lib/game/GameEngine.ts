import { GameState, ReactionSpeedGameState, ReactionSpeedPhase, ReactionSpeedPlayerState } from './types';
import { GameType } from './gameTypes';

interface GameEngineInterface<T extends GameState> {
  initializeGame: (players: { id: string; username: string }[]) => T;
  // Add other generic methods for game progression
}

export class ReactionSpeedGameEngine implements GameEngineInterface<ReactionSpeedGameState> {
  private readonly COUNTDOWN_DURATION_MS = 3000; // 3 seconds
  private readonly MIN_WAIT_MS = 2000; // Minimum wait after countdown before trigger
  private readonly MAX_WAIT_MS = 5000; // Maximum wait after countdown before trigger
  private readonly REACTION_WINDOW_MS = 1000; // How long players have to react after trigger

  initializeGame(players: { id: string; username: string }[]): ReactionSpeedGameState {
    const initialPlayers: ReactionSpeedPlayerState[] = players.map(p => ({
      id: p.id,
      username: p.username,
      score: 0,
      isHost: false, // Will be set by MatchController based on match creation
      reactionTime: null,
      hasReacted: false,
    }));

    return {
      matchId: '', // Will be set by MatchController
      gameType: 'reaction-speed',
      players: initialPlayers,
      status: 'waiting',
      phase: 'countdown',
      timerRemaining: this.COUNTDOWN_DURATION_MS / 1000, // in seconds
      triggerTimestamp: null,
      countdownStartTime: null,
    };
  }

  startGame(initialState: ReactionSpeedGameState): ReactionSpeedGameState {
    return {
      ...initialState,
      status: 'active',
      phase: 'countdown',
      countdownStartTime: Date.now(), // Server start time
      timerRemaining: this.COUNTDOWN_DURATION_MS / 1000, // Start countdown
    };
  }

  // Called when countdown finishes and game transitions to waiting for reaction
  private calculateTriggerTime(countdownEndTime: number): number {
    const randomDelay = Math.random() * (this.MAX_WAIT_MS - this.MIN_WAIT_MS) + this.MIN_WAIT_MS;
    return countdownEndTime + randomDelay;
  }

  // This function would be called by MatchController to advance the game state
  // It's stateless, takes current state and returns next state
  updateState(currentState: ReactionSpeedGameState, currentTime: number): ReactionSpeedGameState {
    let newState = { ...currentState };

    switch (newState.phase) {
      case 'countdown':
        if (newState.countdownStartTime !== null) {
          const elapsed = currentTime - newState.countdownStartTime;
          const remaining = this.COUNTDOWN_DURATION_MS - elapsed;

          if (remaining <= 0) {
            // Countdown finished, transition to waiting_for_reaction
            const triggerTime = this.calculateTriggerTime(newState.countdownStartTime + this.COUNTDOWN_DURATION_MS);
            newState = {
              ...newState,
              phase: 'waiting_for_reaction',
              timerRemaining: (triggerTime - currentTime) / 1000, // Time until trigger
              triggerTimestamp: triggerTime,
              players: newState.players.map(p => ({ ...p, reactionTime: null, hasReacted: false })) // Reset reactions
            };
          } else {
            newState.timerRemaining = Math.ceil(remaining / 1000); // Update timer for UI
          }
        }
        break;

      case 'waiting_for_reaction':
        if (newState.triggerTimestamp !== null && currentTime >= newState.triggerTimestamp) {
          // Trigger event occurred, now players can react
          newState = {
            ...newState,
            timerRemaining: this.REACTION_WINDOW_MS / 1000, // Reaction window timer
            // No phase change yet, still waiting for players to react within the window
          };
        } else if (newState.triggerTimestamp !== null && currentTime > newState.triggerTimestamp + this.REACTION_WINDOW_MS) {
            // Reaction window expired, determine winner
            newState = this.determineWinner(newState);
            newState.status = 'finished';
        } else if (newState.triggerTimestamp !== null) {
            // Update timer until trigger for UI
            newState.timerRemaining = Math.ceil((newState.triggerTimestamp - currentTime) / 1000);
        }
        break;

      case 'finished':
        // Game is over, no further state updates from engine
        break;
    }
    return newState;
  }

  recordReaction(currentState: ReactionSpeedGameState, playerId: string, reactionTime: number): ReactionSpeedGameState {
    const newPlayers = currentState.players.map(p => {
      if (p.id === playerId && !p.hasReacted && currentState.phase === 'waiting_for_reaction' && currentState.triggerTimestamp !== null) {
        // Only record if within the valid reaction window
        const serverReactionTime = reactionTime - currentState.triggerTimestamp; // Time relative to trigger
        if (serverReactionTime >= 0 && serverReactionTime <= this.REACTION_WINDOW_MS) {
          return { ...p, reactionTime: serverReactionTime, hasReacted: true };
        }
      }
      return p;
    });
    return { ...currentState, players: newPlayers };
  }

  determineWinner(currentState: ReactionSpeedGameState): ReactionSpeedGameState {
    let fastestReaction: number | null = null;
    let winnerId: string | null = null;

    currentState.players.forEach(p => {
      if (p.hasReacted && p.reactionTime !== null) {
        if (fastestReaction === null || p.reactionTime < fastestReaction) {
          fastestReaction = p.reactionTime;
          winnerId = p.id;
        }
      }
    });

    return {
      ...currentState,
      status: 'finished',
      winnerId: winnerId || undefined, // Set winner or undefined if no one reacted
      phase: 'finished',
      timerRemaining: 0, // Game over
    };
  }

  // Add any other game-specific logic methods here
}

// Placeholder engine for games that are not yet implemented
class PlaceholderGameEngine implements GameEngineInterface<GameState> {
  initializeGame(players: { id: string; username: string }[]): GameState {
    return {
      matchId: '',
      gameType: 'placeholder',
      players: players.map(p => ({
        id: p.id,
        username: p.username,
        score: 0,
        isHost: false,
        isConnected: true,
      })),
      status: 'waiting',
      timerRemaining: 0,
    };
  }
}

// Factory function to get the correct game engine
export function getGameEngine(gameType: GameType): GameEngineInterface<any> {
  switch (gameType) {
    case 'reaction-speed':
      return new ReactionSpeedGameEngine();
    // Placeholder for games not yet implemented
    case 'two-truths-lie':
    case 'fame-shame-wheel':
    case 'troll-identity-hunt':
    case 'multiplayer-solitaire':
    case 'multiplayer-dominoes':
      return new PlaceholderGameEngine();
    default:
      throw new Error(`Unknown game type: ${gameType}`);
  }
}
