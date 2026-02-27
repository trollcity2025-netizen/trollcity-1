import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import GameMatch from '@/components/GameMatch';
import { supabase } from '@/lib/supabase';
import {
  Gamepad2,
  Users,
  Zap,
  Brain,
  Dice5,
  Target,
  Trophy,
  ArrowRight,
  Sparkles,
  Play,
  Gift
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import {
  GAME_REWARD_AMOUNT
} from '@/lib/gameService'

// Tab types
export type PageTab = 'games' | 'giveaways'

// Game types
export type GameType =
  | 'two-truths-lie'
  | 'fame-shame-wheel'
  | 'troll-identity-hunt'
  | 'reaction-speed'
  | 'multiplayer-solitaire'
  | 'multiplayer-dominoes'

interface Game {
  id: GameType
  title: string
  description: string
  playersOnline: number
  isMultiplayer: boolean
  icon: React.ReactNode
  color: string
}

// New interface for waiting matches
interface WaitingMatch {
  match_id: string;
  game_type: GameType;
  player1_username: string;
}

// Mock data - in real app, fetch from API
const games: Game[] = [
  {
    id: 'two-truths-lie',
    title: 'Two Truths & A Lie',
    description: 'Share three statements, let others guess which one is false. Fool players to win!',
    playersOnline: 42,
    isMultiplayer: true,
    icon: <Brain className="w-8 h-8" />,
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 'fame-shame-wheel',
    title: 'Fame or Shame Wheel',
    description: 'Spin the wheel and complete challenges. Get voted as "Fame" to win coins!',
    playersOnline: 38,
    isMultiplayer: true,
    icon: <Dice5 className="w-8 h-8" />,
    color: 'from-yellow-500 to-orange-500'
  },
  {
    id: 'troll-identity-hunt',
    title: 'Troll Identity Hunt',
    description: 'Guess the secret identity by asking questions. Be the first to crack the code!',
    playersOnline: 25,
    isMultiplayer: true,
    icon: <Target className="w-8 h-8" />,
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'reaction-speed',
    title: 'Reaction Speed Arena',
    description: 'Test your reflexes! Be the fastest to react and claim victory.',
    playersOnline: 67,
    isMultiplayer: true,
    icon: <Zap className="w-8 h-8" />,
    color: 'from-green-500 to-emerald-500'
  },
  {
    id: 'multiplayer-solitaire',
    title: 'Multiplayer Solitaire',
    description: 'Race against others to clear the board. First to finish wins!',
    playersOnline: 15,
    isMultiplayer: true,
    icon: <Trophy className="w-8 h-8" />,
    color: 'from-indigo-500 to-purple-500'
  },
  {
    id: 'multiplayer-dominoes',
    title: 'Multiplayer Dominoes',
    description: 'Classic dominoes with real players. Outsmart your opponents!',
    playersOnline: 22,
    isMultiplayer: true,
    icon: <Gamepad2 className="w-8 h-8" />,
    color: 'from-red-500 to-rose-500'
  }
]

// Find game by ID
const getGameById = (id: string): Game | undefined =>
  games.find(g => g.id === id)

export default function TrollGamesPage() {
  const { gameType, matchId } = useParams<{ gameType?: GameType, matchId?: string }>();
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [waitingMatches, setWaitingMatches] = useState<WaitingMatch[]>([]); // New state for waiting matches
  const [, setActiveMatchId] = useState<string | null>(null);
  const [, setActiveGameType] = useState<GameType | null>(null);
  const [activeTab] = useState<PageTab>('games');

  // Note: Giveaways are now handled by a dedicated route at /troll-games/giveaways
  // This effect is kept for potential future use but currently not needed

  const fetchWaitingMatches = async () => {
    const { data, error } = await supabase.rpc('get_waiting_matches');
    if (error) {
      console.error('Error fetching waiting matches:', error);
      toast.error('Failed to fetch waiting matches.');
      return;
    }
    setWaitingMatches(data || []);
  };

  useEffect(() => {
    fetchWaitingMatches();
    // Optionally, refetch periodically or listen to Realtime for new matches
    const interval = setInterval(fetchWaitingMatches, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []); // Empty dependency array means this runs once on mount

  const handleStartGame = async (gameType: GameType) => {
    if (!profile?.id) {
      toast.error('Please log in to play');
      return;
    }

    // Call the Supabase RPC to create a new game match
    const { data, error } = await supabase.rpc('create_game_match', {
      p_game_type: gameType,
      p_player_ids: [profile.id],
    });

    if (error) {
      toast.error(error.message);
      console.error('Error creating game match:', error);
      return;
    }

    const newMatchId = data as string;
    setActiveMatchId(newMatchId);
    setActiveGameType(gameType);
    navigate(`/troll-games/${gameType}/${newMatchId}`);
  };

  const handleJoinGame = async (matchId: string, gameType: GameType) => {
    if (!profile?.id || !profile?.username) {
        toast.error('Please log in to join a game.');
        return;
    }

    // Call the Supabase RPC to join an existing game match
    const { error } = await supabase.rpc('join_game_match', {
        p_match_id: matchId,
        p_user_id: profile.id,
        p_username: profile.username,
    });

    if (error) {
        toast.error(error.message);
        console.error('Error joining game match:', error);
        return;
    }

    setActiveMatchId(matchId);
    setActiveGameType(gameType);
    navigate(`/troll-games/${gameType}/${matchId}`);
  };

  const handleMatchEnd = (winnerId?: string) => {
    if (winnerId) {
      toast.success(`🏆 Player ${winnerId === profile?.id ? 'You' : 'Opponent'} won ${GAME_REWARD_AMOUNT} Troll Coins!`);
    } else {
      toast.info('Game ended in a draw or no winner.');
    }
    setActiveMatchId(null);
    setActiveGameType(null);
    navigate('/troll-games');
  };

  // If gameType and matchId are present, render the specific game
  if (gameType && matchId) {
    // Ensure gameType is a valid GameType
    const isValidGameType = games.some(g => g.id === gameType);
    if (isValidGameType) {
      return (
        <GameMatch
          matchId={matchId}
          gameType={gameType}
          onMatchEnd={handleMatchEnd}
        />
      );
    }
  }

  // Otherwise render the lobby
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-lg shadow-green-500/20">
            <Gamepad2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Troll Games
            </h1>
            <p className="text-slate-400 text-sm">
              Play free games and earn Troll Coins!
            </p>
          </div>
        </div>

        {/* Reward Info */}
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-lg">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <span className="text-amber-400 font-semibold">
            Winners receive {GAME_REWARD_AMOUNT} Troll Coins per match!
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/troll-games')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'games'
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-5 h-5 inline-block mr-2" />
            Games
          </button>
          <button
            onClick={() => navigate('/troll-games/giveaways')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'giveaways'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Gift className="w-5 h-5 inline-block mr-2" />
            Giveaways
          </button>
        </div>
      </div>

      {/* Waiting Matches Section */}
      {waitingMatches.length > 0 && (
        <div className="max-w-7xl mx-auto mb-8 p-6 bg-slate-900/50 rounded-2xl border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Play className="w-6 h-6 text-green-400" />
            Join an Existing Match
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {waitingMatches.map((match) => (
              <div key={match.match_id} className="bg-slate-800/50 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">{getGameById(match.game_type)?.title || match.game_type}</p>
                  <p className="text-slate-400 text-sm">Host: {match.player1_username}</p>
                </div>
                <button
                  onClick={() => handleJoinGame(match.match_id, match.game_type)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  Join <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Games Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map((game) => (
          <div
            key={game.id}
            onMouseEnter={() => setHoveredGame(game.id)}
            onMouseLeave={() => setHoveredGame(null)}
            className={`
              relative group
              bg-slate-900/80 backdrop-blur-sm
              border border-white/10 rounded-2xl
              overflow-hidden
              transition-all duration-300
              hover:scale-[1.02] hover:shadow-2xl hover:shadow-green-500/10
              ${hoveredGame === game.id ? 'border-green-500/30' : ''}
            `}
          >
            {/* Background Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />

            <div className="relative p-6">
              {/* Game Icon */}
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center mb-4 shadow-lg`}>
                <div className="text-white">
                  {game.icon}
                </div>
              </div>

              {/* Multiplayer Badge */}
              <div className="flex items-center justify-between mb-3">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                  game.isMultiplayer
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'
                }`}>
                  <Users className="w-3 h-3" />
                  {game.isMultiplayer ? 'Multiplayer' : 'Solo'}
                </span>

                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  {game.playersOnline} online
                </span>
              </div>

              {/* Title & Description */}
              <h3 className="text-xl font-bold text-white mb-2">
                {game.title}
              </h3>
              <p className="text-slate-400 text-sm mb-4 line-clamp-2">
                {game.description}
              </p>

              {/* Play Button */}
              <button
                onClick={() => handleStartGame(game.id)}
                className={`
                  inline-flex items-center justify-center gap-2 w-full
                  py-3 px-4 rounded-xl font-semibold
                  bg-gradient-to-r from-green-600 to-emerald-600
                  hover:from-green-500 hover:to-emerald-500
                  text-white
                  transition-all duration-200
                  group/btn
                `}
              >
                <span>Play Now</span>
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Decorative Corner */}
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl ${game.color} opacity-10 rounded-bl-full`} />
          </div>
        ))}
      </div>

      {/* Info Section */}
      <div className="max-w-7xl mx-auto mt-12 p-6 bg-slate-900/50 rounded-2xl border border-white/10">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-500/20 rounded-xl">
            <Trophy className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white mb-2">How Rewards Work</h3>
            <ul className="space-y-2 text-slate-400 text-sm">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Winners receive exactly {GAME_REWARD_AMOUNT} Troll Coins per match
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Rewards are automatically deposited to your wallet
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Each player can only claim one reward per match
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Server-side validation prevents exploits
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}