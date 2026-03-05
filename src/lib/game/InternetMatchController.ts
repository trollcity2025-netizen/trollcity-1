import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { InternetGameState, InternetGameType, GameAction } from './InternetGameTypes';
import { getInternetGameEngine } from './InternetGameEngineFactory';

interface InternetMatchControllerConfig {
  matchId: string;
  gameType: InternetGameType;
  userId: string;
  onStateChange: (newState: InternetGameState) => void;
  onMatchEnd: (winnerId?: string) => void;
}

export class InternetMatchController {
  private matchId: string;
  private gameType: InternetGameType;
  private userId: string;
  private onStateChange: (newState: InternetGameState) => void;
  private onMatchEnd: (winnerId?: string) => void;
  private channel: RealtimeChannel | null = null;
  private _gameState: InternetGameState | null = null;
  private gameEngine: ReturnType<typeof getInternetGameEngine>;
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private lastActionTime: number = 0;

  constructor(config: InternetMatchControllerConfig) {
    this.matchId = config.matchId;
    this.gameType = config.gameType;
    this.userId = config.userId;
    this.onStateChange = config.onStateChange;
    this.onMatchEnd = config.onMatchEnd;
    this.gameEngine = getInternetGameEngine(this.gameType);
  }

  public get gameState(): InternetGameState | null {
    return this._gameState;
  }

  async init() {
    // 1. Fetch initial match state from DB
    const { data, error } = await supabase
      .from('internet_game_matches')
      .select('*')
      .eq('id', this.matchId)
      .single();

    if (error || !data) {
      console.error('Error fetching initial match state:', error);
      throw new Error(`Could not load match ${this.matchId}`);
    }

    // 2. Initialize local game state
    if (data.game_state) {
      this._gameState = data.game_state as InternetGameState;
    } else {
      // Initialize new game state
      const players = data.player_ids.map((id: string, index: number) => ({
        id,
        username: data.player_usernames?.[index] || `Player ${index + 1}`,
      }));
      
      this._gameState = this.gameEngine.initializeGame(players, this.matchId);
      
      // Update DB with initialized state
      await supabase
        .from('internet_game_matches')
        .update({ game_state: this._gameState })
        .eq('id', this.matchId);
    }

    // Ensure gameType in state matches config
    if (this._gameState && this._gameState.gameType !== this.gameType) {
      console.error(`Mismatch game type. Expected ${this.gameType}, got ${this._gameState.gameType}`);
    }

    // Set host based on first player
    if (this._gameState) {
      this._gameState.players = this._gameState.players.map((p, index) => ({
        ...p,
        isHost: index === 0,
      }));
    }

    this.onStateChange(this._gameState!);

    // 3. Subscribe to Realtime updates
    this.channel = supabase
      .channel(`internet_match:${this.matchId}`, {
        config: {
          presence: { key: this.userId },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'internet_game_matches',
          filter: `id=eq.${this.matchId}`,
        },
        (payload) => this.handleDbUpdate(payload.new)
      )
      .on('presence', { event: 'sync' }, () => this.handlePresenceSync())
      .on('presence', { event: 'join' }, ({ newPresences }) =>
        this.handlePresenceChange(newPresences, 'join')
      )
      .on('presence', { event: 'leave' }, ({ leftPresences }) =>
        this.handlePresenceChange(leftPresences, 'leave')
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to internet_match:${this.matchId}`);
          await this.channel?.track({
            user_id: this.userId,
            game_type: this.gameType,
          });
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Supabase Realtime Channel Error for match ${this.matchId}`);
        }
      });

    // 4. Start game loop (only for host)
    if (this._gameState?.players.find((p) => p.id === this.userId)?.isHost) {
      this.startGameLoop();
    }
  }

  private startGameLoop() {
    this.updateInterval = setInterval(async () => {
      if (!this._gameState || this._gameState.phase === 'finished') return;

      // Only host runs the game loop
      const isHost = this._gameState.players.find((p) => p.id === this.userId)?.isHost;
      if (!isHost) return;

      // Update game state via engine
      const updatedState = this.gameEngine.updateGameState(this._gameState, 1000 / 60);

      // Check win condition
      const winResult = this.gameEngine.checkWinCondition(updatedState);
      if (winResult) {
        updatedState.phase = 'finished';
        updatedState.winnerId = winResult.winnerId;
        updatedState.status = 'finished';
        updatedState.endTime = Date.now();
      }

      // Update DB with new state
      const { error } = await supabase
        .from('internet_game_matches')
        .update({ game_state: updatedState })
        .eq('id', this.matchId);

      if (error) {
        console.error('Error updating game state:', error);
      }
    }, 1000 / 60);
  }

  private handleDbUpdate(payload: any) {
    const newGameState = payload.game_state as InternetGameState;
    if (newGameState) {
      this._gameState = newGameState;
      this.onStateChange(this._gameState);

      if (this._gameState.status === 'finished' || this._gameState.status === 'cancelled') {
        this.onMatchEnd(this._gameState.winnerId);
        this.dispose();
      }
    }
  }

  private handlePresenceSync() {
    if (!this.channel || !this._gameState) return;
    const presenceState = this.channel.presenceState();
    const connectedUserIds = new Set<string>();

    Object.values(presenceState).forEach((states: any) => {
      (states as any[]).forEach((state) => {
        connectedUserIds.add(state.user_id);
      });
    });

    this._gameState.players = this._gameState.players.map((player) => ({
      ...player,
      isConnected: connectedUserIds.has(player.id),
    }));
    this.onStateChange(this._gameState);
  }

  private handlePresenceChange(presences: any[], type: 'join' | 'leave') {
    if (!this._gameState) return;
    this.handlePresenceSync();
  }

  async sendGameAction(actionType: string, payload: any) {
    if (!this._gameState) return { success: false, error: 'Match not initialized' };

    // Rate limiting
    const now = Date.now();
    if (now - this.lastActionTime < 50) {
      return { success: false, error: 'Action rate limited' };
    }
    this.lastActionTime = now;

    // Process action locally first (optimistic update)
    const action: GameAction = {
      type: actionType,
      payload,
      timestamp: now,
      playerId: this.userId,
    };

    const updatedState = this.gameEngine.processAction(this._gameState, action);

    // Update DB
    const { error } = await supabase
      .from('internet_game_matches')
      .update({ game_state: updatedState })
      .eq('id', this.matchId);

    if (error) {
      console.error(`Error sending game action ${actionType}:`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  dispose() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this._gameState = null;
    console.log(`InternetMatchController for ${this.matchId} disposed.`);
  }
}
