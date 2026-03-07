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

  // Show loading while auth is initializing
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Route to specific views based on URL - TEMPORARILY DISABLED
  // Uncomment when Troll Wheel is ready
  /*
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
  */

  // Main Lobby - Coming Soon
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8 flex items-center justify-center">
      {/* Coming Soon Content */}
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full mb-6 shadow-lg shadow-yellow-500/30">
          <Gamepad2 className="w-12 h-12 text-white" />
        </div>
        
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Troll Wheel
        </h1>
        
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 text-sm font-medium rounded-full mb-6">
          <Sparkles size={16} />
          <span>Coming Soon</span>
        </div>
        
        <p className="text-slate-300 text-lg mb-8">
          Get ready for an exciting new gaming experience! 
          Troll Wheel will bring you hours of entertainment with friends and opponents.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <div className="px-8 py-4 bg-slate-800 text-slate-400 font-bold rounded-xl border border-slate-700">
            🚧 Under Construction 🚧
          </div>
        </div>
        
        <p className="text-slate-500 text-sm mt-8">
          Check back soon for updates!
        </p>
      </div>
    </div>
  )
}
