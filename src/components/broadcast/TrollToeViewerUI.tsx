// src/components/broadcast/TrollToeViewerUI.tsx
// Viewer-facing UI for Live Troll Toe: join side, fog, status display

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Swords, Cloud, Coins, Timer, Trophy, User, Crown, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TrollToeMatch, TrollToeTeam, ViewerStatus } from '../../types/trollToe';

interface TrollToeViewerUIProps {
  match: TrollToeMatch;
  viewerStatus: ViewerStatus;
  viewerTeam: TrollToeTeam | null;
  currentUserId?: string;
  trollCoins: number;
  onJoinSide: (team: TrollToeTeam) => void;
  onUseFog: (boxIndex: number) => void;
  canUseFog: boolean;
  className?: string;
}

export default function TrollToeViewerUI({
  match, viewerStatus, viewerTeam, currentUserId, trollCoins,
  onJoinSide, onUseFog, canUseFog, className,
}: TrollToeViewerUIProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isPlayerInGame = match.broadcasterTeam.some(p => p.userId === currentUserId) ||
    match.challengerTeam.some(p => p.userId === currentUserId);

  const statusLabels: Record<ViewerStatus, { text: string; color: string }> = {
    idle: { text: 'Spectating', color: 'text-zinc-400' },
    queued: { text: 'Queued', color: 'text-yellow-400' },
    assigned: { text: 'In Game!', color: 'text-green-400' },
    removed_by_fog: { text: 'Fogged!', color: 'text-orange-400' },
    winner: { text: 'Winner!', color: 'text-yellow-300' },
    loser: { text: 'Defeated', color: 'text-red-400' },
  };

  const statusInfo = statusLabels[viewerStatus];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={cn(
        'fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-80 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-purple-900/40 to-pink-900/40 border-b border-white/10"
      >
        <div className="flex items-center gap-2">
          <Crown size={16} className="text-yellow-400" />
          <span className="text-sm font-black text-white uppercase tracking-wider">Troll Toe</span>
          <span className={cn('text-[10px] font-bold', statusInfo.color)}>{statusInfo.text}</span>
        </div>
        <div className="flex items-center gap-2">
          {(match.phase === 'live' || match.phase === 'paused') && (
            <div className="flex items-center gap-1 bg-black/40 rounded-full px-2 py-0.5">
              <Timer size={10} className={cn(match.remainingSeconds <= 30 ? 'text-red-400 animate-pulse' : 'text-white/60')} />
              <span className={cn('text-[10px] font-mono font-bold', match.remainingSeconds <= 30 ? 'text-red-400' : 'text-white')}>
                {Math.floor(match.remainingSeconds / 60)}:{(match.remainingSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>
          )}
          {isExpanded ? <ChevronDown size={14} className="text-white/40" /> : <ChevronUp size={14} className="text-white/40" />}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3">
              {/* Phase: Waiting */}
              {match.phase === 'waiting' && (
                <div className="text-center py-2">
                  <p className="text-xs text-zinc-400">Game is being set up...</p>
                  <p className="text-[10px] text-zinc-600 mt-1">Get ready to pick a side!</p>
                </div>
              )}

              {/* Phase: Filling - Side Selection */}
              {match.sideSelectionOpen && !isPlayerInGame && (match.phase === 'filling' || match.phase === 'live') && (
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-2 text-center">Choose Your Side</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onJoinSide('broadcaster')}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 transition-all active:scale-95"
                    >
                      <Shield size={20} className="text-red-400" />
                      <span className="text-xs font-bold text-red-300">Broadcaster</span>
                      <span className="text-[9px] text-red-400/60">{match.broadcasterTeam.length} players</span>
                    </button>
                    <button
                      onClick={() => onJoinSide('challenger')}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 transition-all active:scale-95"
                    >
                      <Swords size={20} className="text-blue-400" />
                      <span className="text-xs font-bold text-blue-300">Challenger</span>
                      <span className="text-[9px] text-blue-400/60">{match.challengerTeam.length} players</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Player Status */}
              {isPlayerInGame && (
                <div className={cn(
                  'rounded-xl p-3 border text-center',
                  viewerTeam === 'broadcaster' ? 'bg-red-500/10 border-red-500/20' : 'bg-blue-500/10 border-blue-500/20'
                )}>
                  <div className="flex items-center justify-center gap-2">
                    {viewerTeam === 'broadcaster' ? <Shield size={14} className="text-red-400" /> : <Swords size={14} className="text-blue-400" />}
                    <span className="text-sm font-bold text-white">
                      You're on {viewerTeam === 'broadcaster' ? 'Broadcaster' : 'Challenger'} Team
                    </span>
                  </div>
                  <span className={cn('text-[10px] font-bold mt-1 block', statusInfo.color)}>{statusInfo.text}</span>
                </div>
              )}

              {/* Side Selection Closed */}
              {!match.sideSelectionOpen && !isPlayerInGame && match.phase === 'filling' && (
                <div className="text-center py-2">
                  <p className="text-xs text-zinc-500">Side selection is closed</p>
                </div>
              )}

              {/* Fog Section */}
              {match.phase === 'live' && match.fogEnabled && !isPlayerInGame && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Cloud size={14} className="text-orange-400" />
                      <span className="text-xs font-bold text-orange-300">Fog</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Coins size={10} className="text-amber-400" />
                      <span className="text-[10px] font-bold text-amber-300">{match.fogCost}</span>
                    </div>
                  </div>
                  <p className="text-[9px] text-orange-300/60 mb-2">
                    Click a player's box to remove them with Fog. Costs {match.fogCost} Troll Coins.
                  </p>
                  {!canUseFog && (
                    <p className="text-[9px] text-orange-400/80 font-bold">On cooldown...</p>
                  )}
                  {trollCoins < match.fogCost && (
                    <p className="text-[9px] text-red-400 font-bold">Not enough coins!</p>
                  )}
                </div>
              )}

              {/* Match Ended */}
              {match.phase === 'ended' && (
                <div className="text-center py-2">
                  <div className={cn(
                    'inline-block px-4 py-2 rounded-xl font-black text-sm border',
                    match.winnerTeam === 'broadcaster' ? 'bg-red-600/30 border-red-500/40 text-red-300'
                      : match.winnerTeam === 'challenger' ? 'bg-blue-600/30 border-blue-500/40 text-blue-300'
                      : 'bg-zinc-700/30 border-zinc-500/40 text-white'
                  )}>
                    <Trophy size={14} className="inline mr-1" />
                    {match.winnerTeam ? `${match.winnerTeam === 'broadcaster' ? 'Broadcaster' : 'Challenger'} Wins!` : "Draw!"}
                  </div>
                  {match.winnerTeam && (
                    <div className="mt-1 text-[10px] text-yellow-400 font-bold">
                      {match.rewardAmount} Troll Coins distributed
                    </div>
                  )}
                </div>
              )}

              {/* Team Score */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 bg-red-500/15 rounded-full px-3 py-1">
                  <Shield size={10} className="text-red-400" />
                  <span className="text-[10px] font-bold text-red-300">{match.broadcasterTeam.length}</span>
                </div>
                <span className="text-[9px] text-zinc-600 font-bold uppercase">VS</span>
                <div className="flex items-center gap-1.5 bg-blue-500/15 rounded-full px-3 py-1">
                  <span className="text-[10px] font-bold text-blue-300">{match.challengerTeam.length}</span>
                  <Swords size={10} className="text-blue-400" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
