import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MatchController } from '@/lib/game/MatchController';
import { GameState, ReactionSpeedGameState, ReactionSpeedPlayerState } from '@/lib/game/types';
import { useAuthStore } from '@/lib/store';
import { GameType } from '@/lib/game/gameTypes';
import { TrollopolyGame } from './games/TrollopolyGame';
import { TrollopolyCityBoard } from './games/TrollopolyCityBoard';
import { InternetMatchController } from '@/lib/game/InternetMatchController';
import { InternetGameState, GameAction } from '@/lib/game/InternetGameTypes';
import { TrollopolyGameState } from '@/lib/game/types/TrollopolyTypes';
import { supabase } from '@/lib/supabase';

interface GameMatchProps {
  matchId: string;
  gameType: GameType;
  onMatchEnd: (winnerId?: string) => void;
}

const GameMatch: React.FC<GameMatchProps> = ({ matchId, gameType, onMatchEnd }) => {
  const { user, profile } = useAuthStore();
  const [gameState, setGameState] = useState<GameState | InternetGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const legacyControllerRef = useRef<MatchController | null>(null);
  const internetControllerRef = useRef<InternetMatchController | null>(null);

  // Check if this is an internet game (now only Trollopoly)
  const isInternetGame = gameType === 'trollopoly';

  useEffect(() => {
    if (!user?.id) {
      setError('User not authenticated.');
      return;
    }

    if (isInternetGame) {
      // Check if user is a player or spectator
      checkUserRole();
      
      // Create or get stream for the match
      createBroadcastStream();
      
      // Use InternetMatchController for Trollopoly
      console.log(`[GameMatch] Initializing Trollopoly game`);
      const controller = new InternetMatchController({
        matchId,
        gameType: 'trollopoly',
        userId: user.id,
        onStateChange: (newState) => {
          setGameState(newState);
        },
        onMatchEnd: (winnerId) => {
          onMatchEnd(winnerId);
          internetControllerRef.current?.dispose();
        },
      });
      internetControllerRef.current = controller;

      controller.init().catch((err) => {
        console.error('[GameMatch] Failed to initialize Trollopoly:', err);
        setError(err.message || 'Failed to initialize Trollopoly game.');
      });

      return () => {
        controller.dispose();
      };
    } else {
      // Use legacy MatchController for existing games
      const controller = new MatchController({
        matchId,
        gameType,
        userId: user.id,
        onStateChange: (newState) => {
          setGameState(newState);
        },
        onMatchEnd: (winnerId) => {
          onMatchEnd(winnerId);
          legacyControllerRef.current?.dispose();
        },
      });
      legacyControllerRef.current = controller;

      controller.init().catch((err) => {
        console.error('Failed to initialize MatchController:', err);
        setError(err.message || 'Failed to initialize game.');
      });

      return () => {
        controller.dispose();
      };
    }
  }, [matchId, gameType, user?.id, onMatchEnd, isInternetGame]);

  const checkUserRole = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('internet_game_matches')
      .select('player_ids')
      .eq('id', matchId)
      .single();
    
    if (data && !data.player_ids?.includes(user.id)) {
      setIsSpectator(true);
      // Add spectator to match
      await supabase.rpc('add_trollopoly_spectator', {
        p_match_id: matchId,
        p_user_id: user.id,
        p_username: profile?.username || 'Anonymous'
      });
    }
  };

  const createBroadcastStream = async () => {
    // Create or get existing stream for this match
    const { data: existingStream } = await supabase
      .from('streams')
      .select('id')
      .eq('trollopoly_match_id', matchId)
      .single();

    if (existingStream) {
      setStreamId(existingStream.id);
    } else {
      // Auto-create broadcast stream for the match
      const { data: newStream } = await supabase
        .from('streams')
        .insert({
          broadcaster_id: user?.id,
          title: `Trollopoly Match - ${matchId.slice(0, 8)}`,
          is_live: true,
          trollopoly_match_id: matchId,
          chat_enabled: true,
        })
        .select('id')
        .single();
      
      if (newStream) {
        setStreamId(newStream.id);
      }
    }
  };

  const handleGameAction = useCallback((action: GameAction) => {
    if (internetControllerRef.current) {
      internetControllerRef.current.sendGameAction(action.type, action.payload);
    }
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-red-500 text-xl">Error: {error}</div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
          <p className="text-slate-400">Loading Trollopoly...</p>
        </div>
      </div>
    );
  }

  // Render Trollopoly
  if (isInternetGame && gameState) {
    const trollopolyState = gameState as TrollopolyGameState;
    const isHost = trollopolyState.players.find(p => p.id === user?.id)?.isHost ?? false;
    
    return (
      <TrollopolyCityBoard
        gameState={trollopolyState}
        playerId={user?.id || ''}
        onAction={handleGameAction}
        isHost={isHost}
        isSpectator={isSpectator}
        streamId={streamId || matchId}
      />
    );
  }

  // Placeholder for other legacy games
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h2 className="text-3xl font-bold text-white mb-4">
          Trollopoly
        </h2>
        <p className="text-slate-400 mb-6">
          This game is coming soon! Check back later for updates.
        </p>
        <button
          onClick={() => onMatchEnd()}
          className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold"
        >
          Back to Games
        </button>
      </div>
    </div>
  );
};

export default GameMatch;
