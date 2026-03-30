import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Shield, Snowflake, RotateCcw, Zap, Gift, Coins, Users, Clock, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { BattleParticipant } from '../../hooks/useFiveVFiveBattle';

interface BattleStartModalProps {
  isOpen: boolean;
  participants: BattleParticipant[];
  countdown: number;
  currentUserId: string;
  onClose: () => void;
}

export default function BattleStartModal({
  isOpen,
  participants,
  countdown,
  currentUserId,
  onClose,
}: BattleStartModalProps) {
  if (!isOpen) return null;

  const myTeam = participants.find(p => p.userId === currentUserId)?.team || 'A';
  const teamA = participants.filter(p => p.team === 'A').sort((a, b) => a.seatIndex - b.seatIndex);
  const teamB = participants.filter(p => p.team === 'B').sort((a, b) => a.seatIndex - b.seatIndex);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 15 }}
            className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 rounded-3xl max-w-md w-full mx-4 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-red-600/20 via-purple-600/20 to-blue-600/20 px-6 py-5 border-b border-white/10">
              <button
                onClick={onClose}
                className="absolute top-3 right-3 text-zinc-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/30 to-blue-500/30 border border-white/10 flex items-center justify-center">
                  <Swords size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight">5v5 BATTLE</h2>
                  <p className="text-xs text-zinc-400">You are on Team {myTeam}</p>
                </div>
              </div>

              {/* Countdown */}
              <div className="mt-4 flex items-center justify-center">
                <motion.div
                  key={countdown}
                  initial={{ scale: 1.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-blue-400"
                >
                  {countdown}
                </motion.div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Teams */}
              <div className="flex gap-3">
                {/* Team A */}
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Shield size={10} />
                    Team A {myTeam === 'A' && <span className="text-red-300">(You)</span>}
                  </div>
                  <div className="space-y-1.5">
                    {teamA.map(p => (
                      <div key={p.userId} className={cn(
                        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 border",
                        p.userId === currentUserId
                          ? "bg-red-500/20 border-red-500/40"
                          : "bg-white/5 border-white/5"
                      )}>
                        <div className="w-6 h-6 rounded-full bg-red-500/30 flex items-center justify-center text-[10px] font-bold text-red-300 overflow-hidden">
                          {p.avatarUrl ? (
                            <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            p.username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="text-xs text-white font-medium truncate">{p.username}</span>
                        {p.role === 'host' && (
                          <span className="text-[7px] bg-red-600 text-white px-1 rounded font-bold ml-auto">HOST</span>
                        )}
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, 5 - teamA.length) }).map((_, i) => (
                      <div key={`empty-a-${i}`} className="flex items-center gap-2 bg-white/3 border border-white/5 rounded-lg px-2.5 py-1.5 opacity-30">
                        <div className="w-6 h-6 rounded-full bg-white/5" />
                        <span className="text-[10px] text-zinc-600">Empty slot</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* VS divider */}
                <div className="flex flex-col items-center justify-center">
                  <div className="text-xs font-black text-zinc-600">VS</div>
                </div>

                {/* Team B */}
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Swords size={10} />
                    Team B {myTeam === 'B' && <span className="text-blue-300">(You)</span>}
                  </div>
                  <div className="space-y-1.5">
                    {teamB.map(p => (
                      <div key={p.userId} className={cn(
                        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 border",
                        p.userId === currentUserId
                          ? "bg-blue-500/20 border-blue-500/40"
                          : "bg-white/5 border-white/5"
                      )}>
                        <div className="w-6 h-6 rounded-full bg-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-300 overflow-hidden">
                          {p.avatarUrl ? (
                            <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            p.username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="text-xs text-white font-medium truncate">{p.username}</span>
                        {p.role === 'host' && (
                          <span className="text-[7px] bg-blue-600 text-white px-1 rounded font-bold ml-auto">HOST</span>
                        )}
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, 5 - teamB.length) }).map((_, i) => (
                      <div key={`empty-b-${i}`} className="flex items-center gap-2 bg-white/3 border border-white/5 rounded-lg px-2.5 py-1.5 opacity-30">
                        <div className="w-6 h-6 rounded-full bg-white/5" />
                        <span className="text-[10px] text-zinc-600">Empty slot</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Abilities */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Zap size={12} className="text-yellow-400" />
                  YOUR ABILITIES
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mb-1.5">
                      <Snowflake size={18} className="text-cyan-400" />
                    </div>
                    <div className="text-[10px] font-bold text-cyan-400">Freeze</div>
                    <div className="text-[8px] text-zinc-500 mt-0.5">Freeze opposing team</div>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mb-1.5">
                      <RotateCcw size={18} className="text-orange-400" />
                    </div>
                    <div className="text-[10px] font-bold text-orange-400">Reverse</div>
                    <div className="text-[8px] text-zinc-500 mt-0.5">Bounce freeze back</div>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center mb-1.5">
                      <Zap size={18} className="text-yellow-400" />
                    </div>
                    <div className="text-[10px] font-bold text-yellow-400">2x XP</div>
                    <div className="text-[8px] text-zinc-500 mt-0.5">Double team score</div>
                  </div>
                </div>
              </div>

              {/* Scoring */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Gift size={12} className="text-pink-400" />
                  HOW SCORING WORKS
                </div>
                <div className="space-y-2 text-[10px] text-zinc-400">
                  <div className="flex items-start gap-2">
                    <Coins size={12} className="text-yellow-500 mt-0.5 shrink-0" />
                    <span>Every gift adds points to your team score</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Zap size={12} className="text-yellow-400 mt-0.5 shrink-0" />
                    <span>Double XP makes gifts worth 2x points</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Snowflake size={12} className="text-cyan-400 mt-0.5 shrink-0" />
                    <span>Frozen teams cannot earn score from gifts</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Coins size={12} className="text-green-400 mt-0.5 shrink-0" />
                    <span>Gifts also convert to coins for the receiver</span>
                  </div>
                </div>
              </div>

              {/* Match info */}
              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <div className="flex items-center gap-1">
                  <Clock size={10} />
                  <span>3 minute match</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users size={10} />
                  <span>5 vs 5</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
