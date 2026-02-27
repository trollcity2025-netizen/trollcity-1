import React, { useEffect, useState, useRef } from 'react';
import { MatchController } from '@/lib/game/MatchController';
import { GameState, ReactionSpeedGameState, PlayerState, MatchStatus, ReactionSpeedPhase, ReactionSpeedPlayerState } from '@/lib/game/types';
import { useAuthStore } from '@/lib/store';
import { GameType } from '@/pages/TrollGamesPage';

interface GameMatchProps {
  matchId: string;
  gameType: GameType;
  onMatchEnd: (winnerId?: string) => void;
}

const GameMatch: React.FC<GameMatchProps> = ({ matchId, gameType, onMatchEnd }) => {
  const { user } = useAuthStore();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const matchControllerRef = useRef<MatchController | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setError('User not authenticated.');
      return;
    }

    const controller = new MatchController({
      matchId,
      gameType,
      userId: user.id,
      onStateChange: (newState) => {
        setGameState(newState);
      },
      onMatchEnd: (winnerId) => {
        onMatchEnd(winnerId);
        matchControllerRef.current?.dispose();
      },
    });
    matchControllerRef.current = controller;

    controller.init().catch(err => {
      console.error('Failed to initialize MatchController:', err);
      setError(err.message || 'Failed to initialize game.');
    });

    return () => {
      controller.dispose();
    };
  }, [matchId, gameType, user?.id, onMatchEnd]);

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (!gameState) {
    return <div className="text-center text-xl">Loading game...</div>;
  }

  const handleReact = async () => {
    if (matchControllerRef.current && gameState && gameState.gameType === 'reaction-speed') {
      const reactionSpeedState = gameState as ReactionSpeedGameState;
      if (reactionSpeedState.phase === 'waiting_for_reaction' && reactionSpeedState.triggerTimestamp) {
        const reactionTime = Date.now() - reactionSpeedState.triggerTimestamp;
        const { success, error } = await matchControllerRef.current.sendGameAction('react_to_trigger', { reactionTime });
        if (!success) {
          console.error('Failed to send reaction:', error);
          setError(error || 'Failed to send reaction.');
        }
      } else {
        setError('Cannot react outside of reaction phase.');
      }
    }
  };

  const renderReactionSpeedGame = (state: ReactionSpeedGameState) => {
    const myPlayerState = state.players.find(p => p.id === user?.id);
    const otherPlayerState = state.players.find(p => p.id !== user?.id);

    let statusMessage = '';
    switch (state.phase) {
      case 'countdown':
        statusMessage = `Starting in ${state.timerRemaining}...`;
        break;
      case 'waiting_for_reaction':
        if (state.triggerTimestamp === null) {
          statusMessage = 'Get Ready...';
        } else if (Date.now() < state.triggerTimestamp) {
            statusMessage = 'Waiting for GO!';
        } else {
            statusMessage = 'GO!';
        }
        break;
      case 'finished':
        statusMessage = 'Game Over!';
        break;
    }

    const reactionDisplay = (player: ReactionSpeedPlayerState) => {
      if (player.reactionTime !== null) {
        return `${player.username} reacted in ${player.reactionTime}ms`;
      } else if (player.hasReacted) {
        return `${player.username} reacted (time pending)`;
      } else {
        return `${player.username} awaiting reaction`;
      }
    };

    return (
      <div className="flex flex-col items-center justify-center p-4">
        <h2 className="text-3xl font-bold mb-4">Reaction Speed Arena</h2>
        <p className="text-xl mb-4">Match ID: {matchId}</p>
        <p className="text-2xl mb-6">{statusMessage}</p>

        {state.status === 'waiting' && (
          <p className="text-lg">Waiting for another player to join...</p>
        )}

        {state.status === 'ready' && state.phase === 'countdown' && (
          <p className="text-lg">Match starting soon!</p>
        )}

        {state.status === 'active' && state.phase === 'waiting_for_reaction' && (
          <button
            onClick={handleReact}
            disabled={myPlayerState?.hasReacted || state.triggerTimestamp === null || Date.now() < state.triggerTimestamp}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-full text-2xl mt-4"
          >
            {myPlayerState?.hasReacted ? 'Reacted!' : 'REACT!'}
          </button>
        )}

        {state.status === 'finished' && (
          <div className="text-center">
            <p className="text-3xl font-bold mb-4">{state.winnerId === user?.id ? 'YOU WIN!' : state.winnerId ? 'You Lose!' : 'Draw!'}</p>
            {state.winnerId && <p className="text-xl">Winner: {state.players.find(p => p.id === state.winnerId)?.username}</p>}
            <div className="mt-4">
              {myPlayerState && <p className="text-lg">{reactionDisplay(myPlayerState)}</p>}
              {otherPlayerState && <p className="text-lg">{reactionDisplay(otherPlayerState)}</p>}
            </div>
          </div>
        )}

        <div className="mt-8 w-full max-w-md">
          <h3 className="text-xl font-semibold mb-2">Players:</h3>
          <ul className="list-disc list-inside">
            {state.players.map(player => (
              <li key={player.id} className="text-lg">
                {player.username} ({player.id === user?.id ? 'You' : 'Opponent'})
                {player.isHost && ' (Host)'}
                {player.isConnected ? ' (Connected)' : ' (Disconnected)'}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="game-match-container">
      {gameType === 'reaction-speed' && renderReactionSpeedGame(gameState as ReactionSpeedGameState)}
      {/* Add rendering for other game types here */}
    </div>
  );
};

export default GameMatch;
