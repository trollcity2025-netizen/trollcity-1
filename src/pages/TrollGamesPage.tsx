import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import GameMatch from '@/components/GameMatch';
import TrollopolyQueue from '@/components/games/TrollopolyQueue';
import TrollopolyLiveMatches from '@/components/games/TrollopolyLiveMatches';
import { supabase } from '@/lib/supabase';
import {
  Gamepad2,
  Users,
  Trophy,
  ArrowRight,
  Sparkles,
  Globe,
  Play,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import {
  GAME_REWARD_AMOUNT
} from '@/lib/gameService'

export type TrollopolyTab = 'lobby' | 'queue' | 'live' | 'match';

export default function TrollGamesPage() {
  const { matchId, tab } = useParams<{ matchId?: string; tab?: string }>();
  const { profile, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TrollopolyTab>((tab as TrollopolyTab) || 'lobby');
  const [activeMatchId, setActiveMatchId] = useState<string | null>(matchId || null);

  const handleStartGame = async () => {
    if (!profile?.id) {
      toast.error('Please log in to play');
      return;
    }

    // Navigate to queue
    navigate('/troll-games/queue');
  };

  const handleMatchStart = (newMatchId: string) => {
    setActiveMatchId(newMatchId);
    navigate(`/troll-games/match/${newMatchId}`);
  };

  const handleWatchMatch = (watchMatchId: string) => {
    setActiveMatchId(watchMatchId);
    navigate(`/troll-games/match/${watchMatchId}`);
  };

  const handleJoinMatch = async (joinMatchId: string) => {
    if (!profile?.id) {
      toast.error('Please log in to join');
      return;
    }

    // Join existing match
    const { error } = await supabase.rpc('join_trollopoly_match', {
      p_match_id: joinMatchId,
      p_user_id: profile.id,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setActiveMatchId(joinMatchId);
    navigate(`/troll-games/match/${joinMatchId}`);
  };

  const handleMatchEnd = (winnerId?: string) => {
    if (winnerId) {
      toast.success(`🏆 ${winnerId === profile?.id ? 'You won' : 'Match ended'} ${GAME_REWARD_AMOUNT} Troll Coins!`);
    } else {
      toast.info('Game ended.');
    }
    setActiveMatchId(null);
    navigate('/troll-games');
  };

  // Show loading while auth is initializing
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Route to specific views based on URL
  if (tab === 'queue') {
    return <TrollopolyQueue onMatchStart={handleMatchStart} />;
  }

  if (tab === 'live') {
    return (
      <TrollopolyLiveMatches
        onWatchMatch={handleWatchMatch}
        onJoinMatch={handleJoinMatch}
      />
    );
  }

  if (matchId || activeMatchId) {
    const gameMatchId = matchId || activeMatchId || '';
    return (
      <GameMatch
        matchId={gameMatchId}
        gameType="trollopoly"
        onMatchEnd={handleMatchEnd}
      />
    );
  }

  // Main Lobby
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-lg shadow-green-500/20">
            <Gamepad2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Trollopoly
            </h1>
            <p className="text-slate-400 text-sm">
              3D Mini City Board Game - Buy, Build, Bankrupt!
            </p>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto mb-12">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700">
          <div className="absolute inset-0 bg-[url('/trollopoly-bg.jpg')] opacity-20 bg-cover bg-center" />
          
          <div className="relative p-8 md:p-12">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 text-sm font-medium rounded-full mb-4">
                <Sparkles size={16} />
                <span>Now Available</span>
              </div>
              
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                The Ultimate 3D Board Game
              </h2>
              
              <p className="text-slate-300 text-lg mb-6">
                Drive through a mini city, buy properties, build your empire, 
                and bankrupt your opponents in this modern take on the classic board game.
              </p>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handleStartGame}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-xl transition-all hover:scale-105 shadow-lg shadow-green-500/20"
                >
                  <Play size={24} />
                  Play Now
                </button>
                
                <a
                  href="/troll-games/live"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all"
                >
                  <Eye size={24} />
                  Watch Live
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto mb-12">
        <h3 className="text-2xl font-bold text-white mb-6">Game Features</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
              <Globe className="w-6 h-6 text-blue-400" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">3D Mini City</h4>
            <p className="text-slate-400 text-sm">
              Explore a beautiful 3D city with animated buildings, roads, and vehicles.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">2-4 Players</h4>
            <p className="text-slate-400 text-sm">
              Play with friends or match with random opponents. Unlimited spectators can watch!
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center mb-4">
              <Trophy className="w-6 h-6 text-yellow-400" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Win Rewards</h4>
            <p className="text-slate-400 text-sm">
              Earn Troll Coins for winning matches and climb the leaderboard.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Join Queue Card */}
          <a
            href="/troll-games/queue"
            className="group bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-green-500/50 transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xl font-bold text-white mb-2">Join Queue</h4>
                <p className="text-slate-400">Find a match quickly with our queue system</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                <ArrowRight className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </a>

          {/* Watch Live Card */}
          <a
            href="/troll-games/live"
            className="group bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-purple-500/50 transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xl font-bold text-white mb-2">Watch Live</h4>
                <p className="text-slate-400">Spectate ongoing matches in real-time</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                <Eye className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
