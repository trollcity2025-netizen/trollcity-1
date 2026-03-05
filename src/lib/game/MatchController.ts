import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { GameState, ReactionSpeedGameState, PlayerState, MatchStatus } from './types';
import { getGameEngine } from './GameEngine';
import { GameType } from './gameTypes';

interface MatchControllerConfig {
  matchId: string;
  gameType: GameType;
  userId: string;
  onStateChange: (newState: GameState) => void;
  onMatchEnd: (winnerId?: string) => void;
}

export class MatchController {
  private matchId: string;
  private gameType: GameType;
  private userId: string;
  private onStateChange: (newState: GameState) => void;
  private onMatchEnd: (winnerId?: string) => void;
  private channel: RealtimeChannel | null = null;
  private _gameState: GameState | null = null;
  private gameEngine: ReturnType<typeof getGameEngine>;
  private timerInterval: NodeJS.Timeout | null = null;

  constructor(config: MatchControllerConfig) {
    this.matchId = config.matchId;
    this.gameType = config.gameType;
    this.userId = config.userId;
    this.onStateChange = config.onStateChange;
    this.onMatchEnd = config.onMatchEnd;
    this.gameEngine = getGameEngine(this.gameType);
  }

  public get gameState(): GameState | null {
    return this._gameState;
  }

  async init() {
    // 1. Fetch initial match state from DB
    const { data, error } = await supabase
      .from('troll_battles')
      .select('*, player1_id, player2_id')
      .eq('id', this.matchId)
      .single();

    if (error || !data) {
      console.error('Error fetching initial match state:', error);
      throw new Error(`Could not load match ${this.matchId}`);
    }

    // 2. Initialize local game state
    // The game_state column now exists and should be JSONB
    if (data.game_state) {
        this._gameState = data.game_state as GameState; // Cast to GameState type
    } else {
        // This case should ideally not happen if create_game_match RPC initializes it properly
        console.warn('game_state not found in DB, initializing from engine.');
        const players = [
            { id: data.player1_id, username: 'Player 1' }, // TODO: Fetch actual usernames
            ...(data.player2_id ? [{ id: data.player2_id, username: 'Player 2' }] : [])
        ];
        this._gameState = this.gameEngine.initializeGame(players);
        this._gameState.matchId = this.matchId; // Ensure matchId is set
        // Update DB with this initialized state if it was missing
        await supabase.from('troll_battles').update({ game_state: this._gameState }).eq('id', this.matchId);
    }

    // Ensure gameType in state matches config
    if (this._gameState && this._gameState.gameType !== this.gameType) {
      console.error(`Mismatch game type. Expected ${this.gameType}, got ${this._gameState.gameType}`);
      // Potentially recover or throw error
    }

    // Set initial player status (e.g., host based on player1_id)
    if (this._gameState) {
        this._gameState.players = this._gameState.players.map(p => ({
            ...p,
            isHost: p.id === data.player1_id, // player1_id is the host for troll_battles
        }));
    }

    this.onStateChange(this._gameState!); // Notify UI with initial state

    // 3. Subscribe to Realtime updates for the match
    this.channel = supabase.channel(`match:${this.matchId}`, {
        config: {
            presence: { key: this.userId },
        },
    })
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'troll_battles', filter: `id=eq.${this.matchId}` },
      (payload) => this.handleDbUpdate(payload.new)
    )
    .on(
      'presence',
      { event: 'sync' },
      () => this.handlePresenceSync()
    )
    .on(
      'presence',
      { event: 'join' },
      ({ newPresences }) => this.handlePresenceChange(newPresences, 'join')
    )
    .on(
      'presence',
      { event: 'leave' },
      ({ leftPresences }) => this.handlePresenceChange(leftPresences, 'leave')
    )
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to match:${this.matchId}`);
        await this.channel?.track({ user_id: this.userId, game_type: this.gameType });
      } else if (status === 'CHANNEL_ERROR') {
          console.error(`Supabase Realtime Channel Error for match ${this.matchId}`);
          // Implement retry logic or error handling
      }
    });

    // Start server-synced timer updates (simplified for now, will be refined)
    this.timerInterval = setInterval(async () => {
        if (!this._gameState) return;

        // Only the host (player1_id) should trigger timer updates to avoid race conditions
        // and duplicate calls to the RPC. The server will then broadcast the updated state.
        if (this._gameState.players.find(p => p.id === this.userId)?.isHost) {
            const { success, error } = await this.sendGameAction('update_timer_and_state', {});
            if (!success) {
                console.error('Failed to update timer and state:', error);
            }
        }
    }, 1000);
  }

  private handleDbUpdate(payload: any) {
    const newGameState = payload.game_state as GameState;
    if (newGameState) {
      this._gameState = newGameState;
      this.onStateChange(this._gameState);
      if (this._gameState.status === 'finished' || this._gameState.status === 'cancelled') {
        this.onMatchEnd(this._gameState.winnerId);
        this.dispose(); // Clean up when match ends
      }
    }
  }

  private handlePresenceSync() {
    if (!this.channel || !this._gameState) return;
    const presenceState = this.channel.presenceState();
    const connectedUserIds = new Set<string>();

    Object.values(presenceState).forEach((states: any) => {
      (states as any[]).forEach(state => {
        connectedUserIds.add(state.user_id);
      });
    });

    this._gameState.players = this._gameState.players.map(player => ({
      ...player,
      isConnected: connectedUserIds.has(player.id),
    }));
    this.onStateChange(this._gameState);
  }

  private handlePresenceChange(presences: any[], type: 'join' | 'leave') {
    if (!this._gameState) return;
    // Re-sync all presences to get the most accurate state
    this.handlePresenceSync();
  }

  async joinMatch(playerId: string, username: string) {
    if (!this._gameState) return { success: false, error: 'Match not initialized' };

    // Call RPC to add player to game_state in DB
    const { data, error } = await supabase.rpc('join_game_match', {
      p_match_id: this.matchId,
      p_user_id: playerId,
      p_username: username,
    });

    if (error) {
      console.error('Error joining match:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  async sendGameAction(actionType: string, payload: any) {
    if (!this._gameState) return { success: false, error: 'Match not initialized' };

    // Call RPC to process game action
    const { data, error } = await supabase.rpc('process_game_action', {
      p_match_id: this.matchId,
      p_user_id: this.userId,
      p_action_type: actionType,
      p_payload: payload,
    });

    if (error) {
      console.error(`Error sending game action ${actionType}:`, error);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  }

  dispose() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this._gameState = null;
    console.log(`MatchController for ${this.matchId} disposed.`);
  }
}
