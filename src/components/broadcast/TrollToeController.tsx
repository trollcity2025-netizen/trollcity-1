// src/components/broadcast/TrollToeController.tsx
// Broadcaster Game Controller for Live Troll Toe

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Gamepad2, Play, Pause, RotateCcw, Square, Users, Cloud,
  Timer, Coins, Trophy, Lock, Unlock, ChevronDown, ChevronUp,
  X, Swords, PlayCircle, StopCircle, BarChart3, Shield
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TrollToeMatch, TrollToeConfig } from '../../types/trollToe';

interface TrollToeControllerProps {
  match: TrollToeMatch | null;
  config: TrollToeConfig;
  onCreateGame: () => void;
  onStartGame: () => void;
  onPauseGame: () => void;
  onResumeGame: () => void;
  onEndGame: () => void;
  onResetBoard: () => void;
  onOpenSideSelection: () => void;
  onCloseSideSelection: () => void;
  onToggleFog: () => void;
  onSetFogCost: (cost: number) => void;
  onSetRewardAmount: (amount: number) => void;
  onAssignPlayers: () => void;
  onClose: () => void;
}

export default function TrollToeController({
  match, config, onCreateGame, onStartGame, onPauseGame, onResumeGame, onEndGame,
  onResetBoard, onOpenSideSelection, onCloseSideSelection, onToggleFog,
  onSetFogCost, onSetRewardAmount, onAssignPlayers, onClose,
}: TrollToeControllerProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('controls');
  const [fogCostInput, setFogCostInput] = useState(match?.fogCost ?? config.fogCost);
  const [rewardInput, setRewardInput] = useState(match?.rewardAmount ?? config.rewardAmount);

  const phase = match?.phase ?? 'waiting';
  const phaseColors: Record<string, string> = {
    waiting: 'bg-zinc-600 text-white',
    filling: 'bg-yellow-600 text-white animate-pulse',
    live: 'bg-green-600 text-white',
    paused: 'bg-orange-600 text-white animate-pulse',
    ended: 'bg-red-600 text-white',
  };

  const toggleSection = (id: string) => setExpandedSection(expandedSection === id ? null : id);

  const SectionHeader = ({ id, icon: Icon, label, color }: { id: string; icon: any; label: string; color?: string }) => (
    <button onClick={() => toggleSection(id)}
      className={cn('w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors', expandedSection === id ? 'bg-white/10' : 'bg-white/5 hover:bg-white/8')}>
      <div className="flex items-center gap-2">
        <Icon size={14} className={color || 'text-white/70'} />
        <span className="text-xs font-bold text-white/90 uppercase tracking-wider">{label}</span>
      </div>
      {expandedSection === id ? <ChevronUp size={12} className="text-white/40" /> : <ChevronDown size={12} className="text-white/40" />}
    </button>
  );

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      className="w-80 max-h-[80vh] bg-zinc-900/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-purple-900/30 to-pink-900/30">
        <div className="flex items-center gap-2">
          <Gamepad2 size={18} className="text-purple-400" />
          <span className="text-sm font-black text-white uppercase tracking-wider">Troll Toe</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold uppercase', phaseColors[phase])}>{phase}</span>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X size={14} /></button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
        {!match && (
          <div className="text-center py-8">
            <Gamepad2 size={40} className="text-white/10 mx-auto mb-3" />
            <p className="text-xs text-zinc-500 mb-4">No active game</p>
            <button onClick={onCreateGame}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-purple-500/20">
              <PlayCircle size={16} className="inline mr-2" />Create Game
            </button>
          </div>
        )}

        {match && (
          <>
            {/* Mini Board Preview */}
            <div className="bg-black/40 rounded-xl p-2 mb-2">
              <div className="grid grid-cols-3 gap-1 max-w-[180px] mx-auto">
                {match.boxes.map((box, i) => (
                  <div key={i} className={cn(
                    'aspect-square rounded-md flex items-center justify-center text-xs font-black border',
                    box.state === 'empty' && 'bg-white/5 border-white/10 text-white/20',
                    box.state === 'occupied' && box.player?.team === 'broadcaster' && 'bg-red-500/30 border-red-500/50 text-red-300',
                    box.state === 'occupied' && box.player?.team === 'challenger' && 'bg-blue-500/30 border-blue-500/50 text-blue-300',
                    box.state === 'broken' && 'bg-orange-500/30 border-orange-500/50 text-orange-300'
                  )}>
                    {box.state === 'occupied' && <span className="text-sm">{box.symbol}</span>}
                    {box.state === 'broken' && <Cloud size={12} />}
                    {box.state === 'empty' && <span className="text-[8px]">{i + 1}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Timer */}
            {(phase === 'live' || phase === 'paused') && (
              <div className="flex items-center justify-center gap-3 mb-2">
                <Timer size={16} className={cn(match.remainingSeconds <= 30 ? 'text-red-400 animate-pulse' : 'text-white/60')} />
                <span className={cn('text-2xl font-black font-mono tracking-wider', match.remainingSeconds <= 30 ? 'text-red-400' : 'text-white')}>
                  {Math.floor(match.remainingSeconds / 60)}:{(match.remainingSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}

            {/* Team Counts */}
            <div className="flex items-center justify-between px-2 mb-2">
              <div className="flex items-center gap-1.5 bg-red-500/15 rounded-full px-3 py-1">
                <Shield size={12} className="text-red-400" />
                <span className="text-xs font-bold text-red-300">{match.broadcasterTeam.length}</span>
                <span className="text-[8px] text-red-400/50">BC</span>
              </div>
              <span className="text-[10px] text-zinc-600 font-bold">VS</span>
              <div className="flex items-center gap-1.5 bg-blue-500/15 rounded-full px-3 py-1">
                <span className="text-[8px] text-blue-400/50">CH</span>
                <span className="text-xs font-bold text-blue-300">{match.challengerTeam.length}</span>
                <Swords size={12} className="text-blue-400" />
              </div>
            </div>

            {/* CONTROLS */}
            <SectionHeader id="controls" icon={Play} label="Match Controls" />
            {expandedSection === 'controls' && (
              <div className="space-y-2 px-1 pb-2">
                {phase === 'waiting' && (
                  <div className="grid grid-cols-2 gap-2">
                    <ControlBtn icon={Unlock} label="Open Sides" onClick={onOpenSideSelection} color="green" />
                    <ControlBtn icon={Play} label="Start Game" onClick={onStartGame} color="purple" />
                  </div>
                )}
                {phase === 'filling' && (
                  <div className="grid grid-cols-2 gap-2">
                    <ControlBtn icon={Users} label="Assign" onClick={onAssignPlayers} color="blue" />
                    <ControlBtn icon={Play} label="Start Game" onClick={onStartGame} color="purple" />
                    <ControlBtn icon={Lock} label="Lock Sides" onClick={onCloseSideSelection} color="yellow" />
                    <ControlBtn icon={Square} label="End Match" onClick={onEndGame} color="red" />
                  </div>
                )}
                {phase === 'live' && (
                  <div className="grid grid-cols-2 gap-2">
                    <ControlBtn icon={Users} label="Assign" onClick={onAssignPlayers} color="blue" />
                    <ControlBtn icon={Pause} label="Pause" onClick={onPauseGame} color="yellow" />
                    <ControlBtn icon={Square} label="End Match" onClick={onEndGame} color="red" />
                    <ControlBtn icon={StopCircle} label="End & Reward" onClick={onEndGame} color="orange" />
                  </div>
                )}
                {phase === 'paused' && (
                  <div className="grid grid-cols-2 gap-2">
                    <ControlBtn icon={Play} label="Resume" onClick={onResumeGame} color="green" />
                    <ControlBtn icon={Square} label="End Match" onClick={onEndGame} color="red" />
                  </div>
                )}
                {phase === 'ended' && (
                  <div className="grid grid-cols-2 gap-2">
                    <ControlBtn icon={RotateCcw} label="Reset Board" onClick={onResetBoard} color="blue" />
                    <ControlBtn icon={PlayCircle} label="New Game" onClick={() => { onResetBoard(); onCreateGame(); }} color="purple" />
                  </div>
                )}
              </div>
            )}

            {/* FOG */}
            <SectionHeader id="fog" icon={Cloud} label="Fog Settings" color="text-orange-400" />
            {expandedSection === 'fog' && (
              <div className="space-y-2 px-1 pb-2">
                <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-xs text-white/70">Fog Enabled</span>
                  <button onClick={onToggleFog}
                    className={cn('w-10 h-5 rounded-full transition-colors relative', match.fogEnabled ? 'bg-green-600' : 'bg-zinc-700')}>
                    <div className={cn('w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all', match.fogEnabled ? 'left-5' : 'left-0.5')} />
                  </button>
                </div>
                <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-xs text-white/70">Fog Cost</span>
                  <div className="flex items-center gap-1">
                    <input type="number" value={fogCostInput} onChange={(e) => setFogCostInput(parseInt(e.target.value) || 0)}
                      onBlur={() => onSetFogCost(fogCostInput)}
                      className="w-16 bg-black/40 border border-amber-500/20 rounded-lg px-2 py-1 text-xs font-bold text-white text-center focus:outline-none focus:border-amber-500/50" />
                    <Coins size={12} className="text-amber-400" />
                  </div>
                </div>
                {match.fogEvents.length > 0 && (
                  <div className="bg-white/5 rounded-lg p-2 max-h-24 overflow-y-auto">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">Fog Events</span>
                    {match.fogEvents.slice(-5).reverse().map((evt) => (
                      <div key={evt.id} className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-orange-300">{evt.username}</span>
                        <span className="text-[9px] text-zinc-500">box {evt.boxIndex + 1} · -{evt.cost} coins</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* REWARDS */}
            <SectionHeader id="rewards" icon={Trophy} label="Rewards" color="text-yellow-400" />
            {expandedSection === 'rewards' && (
              <div className="space-y-2 px-1 pb-2">
                <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-xs text-white/70">Win Reward</span>
                  <div className="flex items-center gap-1">
                    <input type="number" value={rewardInput} onChange={(e) => setRewardInput(parseInt(e.target.value) || 0)}
                      onBlur={() => onSetRewardAmount(rewardInput)}
                      className="w-20 bg-black/40 border border-amber-500/20 rounded-lg px-2 py-1 text-xs font-bold text-white text-center focus:outline-none focus:border-amber-500/50" />
                    <Coins size={12} className="text-amber-400" />
                  </div>
                </div>
                <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Trophy size={14} className="text-yellow-400" />
                    <div>
                      <span className="text-[10px] text-yellow-300 font-bold">Split evenly among winning team</span>
                      <div className="text-[9px] text-zinc-500">
                        {match.broadcasterTeam.length > 0 && match.winnerTeam === 'broadcaster'
                          ? `${Math.floor(match.rewardAmount / match.broadcasterTeam.length)} per player`
                          : match.challengerTeam.length > 0 && match.winnerTeam === 'challenger'
                          ? `${Math.floor(match.rewardAmount / match.challengerTeam.length)} per player`
                          : `Up to ${match.rewardAmount} coins total`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STATS */}
            <SectionHeader id="stats" icon={BarChart3} label="Stats" color="text-cyan-400" />
            {expandedSection === 'stats' && (
              <div className="space-y-1.5 px-1 pb-2">
                <StatRow label="Active Players" value={match.broadcasterTeam.length + match.challengerTeam.length} />
                <StatRow label="Broadcaster Team" value={match.broadcasterTeam.length} color="text-red-400" />
                <StatRow label="Challenger Team" value={match.challengerTeam.length} color="text-blue-400" />
                <StatRow label="Boxes Occupied" value={match.boxes.filter(b => b.state === 'occupied').length} />
                <StatRow label="Boxes Broken" value={match.boxes.filter(b => b.state === 'broken').length} color="text-orange-400" />
                <StatRow label="Fog Events" value={match.fogEvents.length} />
                <StatRow label="Side Selection" value={match.sideSelectionOpen ? 'Open' : 'Closed'} />
                {match.winnerTeam && (
                  <StatRow label="Winner" value={match.winnerTeam === 'broadcaster' ? 'Broadcaster' : 'Challenger'}
                    color={match.winnerTeam === 'broadcaster' ? 'text-red-400' : 'text-blue-400'} />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

function ControlBtn({ icon: Icon, label, onClick, color, disabled }: { icon: any; label: string; onClick: () => void; color: string; disabled?: boolean }) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-600/20 hover:bg-green-600/30 border-green-500/30 text-green-400',
    red: 'bg-red-600/20 hover:bg-red-600/30 border-red-500/30 text-red-400',
    blue: 'bg-blue-600/20 hover:bg-blue-600/30 border-blue-500/30 text-blue-400',
    yellow: 'bg-yellow-600/20 hover:bg-yellow-600/30 border-yellow-500/30 text-yellow-400',
    purple: 'bg-purple-600/20 hover:bg-purple-600/30 border-purple-500/30 text-purple-400',
    orange: 'bg-orange-600/20 hover:bg-orange-600/30 border-orange-500/30 text-orange-400',
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={cn('flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all font-bold text-[11px] uppercase tracking-wider',
        colorMap[color] || colorMap.blue, disabled && 'opacity-40 cursor-not-allowed')}>
      <Icon size={14} />{label}
    </button>
  );
}

function StatRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5">
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</span>
      <span className={cn('text-xs font-bold', color || 'text-white/80')}>{value}</span>
    </div>
  );
}
