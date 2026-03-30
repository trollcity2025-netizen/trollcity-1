import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Shield, Clock, Coins, Gift, Zap, Snowflake, RotateCcw, Star, Timer, Users, Trophy, Flame } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FiveVFiveBattleState, BattleParticipant } from '../../hooks/useFiveVFiveBattle';

interface FiveVFiveBattleOverlayProps {
  state: FiveVFiveBattleState;
  currentUserId: string;
  onUseAbility: (type: 'team_freeze' | 'reverse' | 'double_xp') => void;
  onRequestRematch: () => void;
  TEAM_FREEZE_COOLDOWN: number;
  REVERSE_COOLDOWN: number;
  DOUBLE_XP_COOLDOWN: number;
}

export default function FiveVFiveBattleOverlay({
  state,
  currentUserId,
  onUseAbility,
  onRequestRematch,
  TEAM_FREEZE_COOLDOWN,
  REVERSE_COOLDOWN,
  DOUBLE_XP_COOLDOWN,
}: FiveVFiveBattleOverlayProps) {
  const { phase } = state;

  const myTeam = useMemo(() => {
    return state.participants.find(p => p.userId === currentUserId)?.team || 'A';
  }, [state.participants, currentUserId]);

  const teamAParticipants = useMemo(() =>
    state.participants.filter(p => p.team === 'A').sort((a, b) => a.seatIndex - b.seatIndex),
    [state.participants]
  );

  const teamBParticipants = useMemo(() =>
    state.participants.filter(p => p.team === 'B').sort((a, b) => a.seatIndex - b.seatIndex),
    [state.participants]
  );

  const myAbilities = state.abilities[currentUserId];
  const now = Date.now();

  const freezeOnCooldown = myAbilities?.teamFreeze.cooldownEndsAt > now;
  const freezeCooldownLeft = freezeOnCooldown ? Math.ceil((myAbilities.teamFreeze.cooldownEndsAt - now) / 1000) : 0;
  const reverseOnCooldown = myAbilities?.reverse.cooldownEndsAt > now;
  const reverseCooldownLeft = reverseOnCooldown ? Math.ceil((myAbilities.reverse.cooldownEndsAt - now) / 1000) : 0;
  const dxpOnCooldown = myAbilities?.doubleXp.cooldownEndsAt > now;
  const dxpCooldownLeft = dxpOnCooldown ? Math.ceil((myAbilities.doubleXp.cooldownEndsAt - now) / 1000) : 0;

  const timerMinutes = Math.floor(state.timerSeconds / 60);
  const timerSeconds = state.timerSeconds % 60;
  const timerPercent = state.totalDuration > 0 ? (state.timerSeconds / state.totalDuration) * 100 : 0;

  const scoreDiff = state.teamAScore - state.teamBScore;

  if (phase === 'idle') return null;

  // ─── PRE-BATTLE / COUNTDOWN ───
  if (phase === 'pre_battle' || phase === 'matchmaking') {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          {phase === 'matchmaking' ? (
            <>
              <div className="relative mb-6">
                <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-purple-600/30 to-blue-600/30 border-2 border-purple-500/50 flex items-center justify-center animate-pulse">
                  <Swords size={40} className="text-purple-400" />
                </div>
                <div className="absolute inset-0 w-24 h-24 mx-auto rounded-full border-2 border-purple-400/30 animate-ping" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2 tracking-tight">SEARCHING FOR BATTLE</h2>
              <p className="text-purple-300 text-sm">Finding your 5v5 opponent...</p>
            </>
          ) : (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 10 }}
                className="mb-6"
              >
                <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 animate-pulse">
                  {state.timerSeconds}
                </div>
              </motion.div>
              <h2 className="text-3xl font-black text-white mb-4 tracking-tight">
                <span className="text-red-400">5v5</span> BATTLE
              </h2>

              {/* Teams preview */}
              <div className="flex items-start gap-8 justify-center mt-6">
                {/* Team A */}
                <div className="text-center">
                  <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-1 justify-center">
                    <Shield size={12} /> Team A
                  </div>
                  <div className="space-y-2">
                    {teamAParticipants.map(p => (
                      <div key={p.userId} className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5">
                        <div className="w-6 h-6 rounded-full bg-red-500/30 flex items-center justify-center text-[10px] font-bold text-red-300">
                          {p.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-red-200 font-medium truncate max-w-[100px]">{p.username}</span>
                        {p.role === 'host' && <span className="text-[8px] bg-red-600 text-white px-1 rounded">HOST</span>}
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, 5 - teamAParticipants.length) }).map((_, i) => (
                      <div key={`empty-a-${i}`} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 opacity-30">
                        <div className="w-6 h-6 rounded-full bg-white/10" />
                        <span className="text-xs text-zinc-500">Empty</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-3xl font-black text-zinc-600 self-center mt-4">VS</div>

                {/* Team B */}
                <div className="text-center">
                  <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-1 justify-center">
                    <Swords size={12} /> Team B
                  </div>
                  <div className="space-y-2">
                    {teamBParticipants.map(p => (
                      <div key={p.userId} className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-1.5">
                        <div className="w-6 h-6 rounded-full bg-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-300">
                          {p.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-blue-200 font-medium truncate max-w-[100px]">{p.username}</span>
                        {p.role === 'host' && <span className="text-[8px] bg-blue-600 text-white px-1 rounded">HOST</span>}
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, 5 - teamBParticipants.length) }).map((_, i) => (
                      <div key={`empty-b-${i}`} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 opacity-30">
                        <div className="w-6 h-6 rounded-full bg-white/10" />
                        <span className="text-xs text-zinc-500">Empty</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  // ─── ACTIVE BATTLE ───
  if (phase === 'active') {
    return (
      <div className="absolute inset-0 z-40 pointer-events-none">
        {/* Top HUD - Score + Timer */}
        <div className="absolute top-0 left-0 right-0 z-50 pointer-events-auto">
          <div className="flex items-start justify-center pt-3 px-4">
            <div className="bg-black/85 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-2.5 shadow-2xl flex items-center gap-4 max-w-md w-full">
              {/* Team A Score */}
              <div className="flex-1 text-center">
                <div className="text-[9px] font-bold text-red-400 uppercase tracking-wider mb-0.5">Team A</div>
                <div className={cn(
                  "text-2xl font-black tabular-nums transition-all",
                  scoreDiff > 0 ? "text-red-400" : "text-white"
                )}>
                  {state.teamAScore.toLocaleString()}
                </div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <Gift size={10} className="text-red-400/60" />
                  <span className="text-[10px] text-red-400/80 font-medium">{state.teamAGiftCount}</span>
                </div>
              </div>

              {/* Timer */}
              <div className="flex flex-col items-center min-w-[70px]">
                <div className={cn(
                  "px-3 py-1 rounded-full font-mono font-black text-lg tabular-nums",
                  state.timerSeconds <= 10
                    ? "bg-red-600 text-white animate-pulse"
                    : state.timerSeconds <= 30
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                    : "bg-white/10 text-white border border-white/20"
                )}>
                  {timerMinutes}:{timerSeconds.toString().padStart(2, '0')}
                </div>
                {/* Progress bar */}
                <div className="w-full h-1 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                  <motion.div
                    className={cn(
                      "h-full rounded-full",
                      state.timerSeconds <= 10 ? "bg-red-500" :
                      state.timerSeconds <= 30 ? "bg-yellow-500" : "bg-gradient-to-r from-red-500 to-blue-500"
                    )}
                    style={{ width: `${timerPercent}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                {state.frozenTeams.A && (
                  <span className="text-[8px] text-cyan-400 font-bold mt-0.5 animate-pulse">❄️ FROZEN</span>
                )}
                {state.doubleXpTeams.A && (
                  <span className="text-[8px] text-yellow-400 font-bold mt-0.5 animate-pulse">💰 2x XP</span>
                )}
              </div>

              {/* Team B Score */}
              <div className="flex-1 text-center">
                <div className="text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-0.5">Team B</div>
                <div className={cn(
                  "text-2xl font-black tabular-nums transition-all",
                  scoreDiff < 0 ? "text-blue-400" : "text-white"
                )}>
                  {state.teamBScore.toLocaleString()}
                </div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <Gift size={10} className="text-blue-400/60" />
                  <span className="text-[10px] text-blue-400/80 font-medium">{state.teamBGiftCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Frozen team indicators */}
          <AnimatePresence>
            {(state.frozenTeams.A || state.frozenTeams.B) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex justify-center mt-1"
              >
                {state.frozenTeams.A && (
                  <div className="bg-cyan-500/20 border border-cyan-400/30 rounded-full px-3 py-0.5 text-[10px] font-bold text-cyan-300 flex items-center gap-1">
                    <Snowflake size={10} /> Team A Frozen
                  </div>
                )}
                {state.frozenTeams.B && (
                  <div className="bg-cyan-500/20 border border-cyan-400/30 rounded-full px-3 py-0.5 text-[10px] font-bold text-cyan-300 flex items-center gap-1 ml-2">
                    <Snowflake size={10} /> Team B Frozen
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Last Gift Toast */}
        <AnimatePresence>
          {state.lastGiftUser && (
            <motion.div
              key={`${state.lastGiftUser.username}-${state.lastGiftUser.amount}-${Date.now()}`}
              initial={{ opacity: 0, x: state.lastGiftUser.team === 'A' ? -50 : 50, y: 0 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "absolute top-28 z-50 pointer-events-none",
                state.lastGiftUser.team === 'A' ? 'left-4' : 'right-4'
              )}
            >
              <div className={cn(
                "bg-black/80 backdrop-blur-md border rounded-xl px-3 py-2 shadow-xl flex items-center gap-2",
                state.lastGiftUser.team === 'A' ? 'border-red-500/30' : 'border-blue-500/30'
              )}>
                <Gift size={14} className={state.lastGiftUser.team === 'A' ? 'text-red-400' : 'text-blue-400'} />
                <div>
                  <div className="text-[10px] font-bold text-white">{state.lastGiftUser.username}</div>
                  <div className={cn("text-xs font-black", state.lastGiftUser.team === 'A' ? 'text-red-400' : 'text-blue-400')}>
                    +{state.lastGiftUser.amount.toLocaleString()} pts
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Abilities Bar (bottom) */}
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-2.5 shadow-2xl flex items-center gap-3">
            {/* Team Freeze */}
            <AbilityButton
              icon={Snowflake}
              label="Freeze"
              color="cyan"
              cooldown={freezeCooldownLeft}
              maxCooldown={TEAM_FREEZE_COOLDOWN}
              onClick={() => onUseAbility('team_freeze')}
              description="Freeze opponents"
            />

            <div className="w-px h-8 bg-white/10" />

            {/* Reverse */}
            <AbilityButton
              icon={RotateCcw}
              label="Reverse"
              color="orange"
              cooldown={reverseCooldownLeft}
              maxCooldown={REVERSE_COOLDOWN}
              onClick={() => onUseAbility('reverse')}
              description="Reverse freeze"
            />

            <div className="w-px h-8 bg-white/10" />

            {/* Double XP */}
            <AbilityButton
              icon={Zap}
              label="2x XP"
              color="yellow"
              cooldown={dxpCooldownLeft}
              maxCooldown={DOUBLE_XP_COOLDOWN}
              onClick={() => onUseAbility('double_xp')}
              description="Double points"
            />
          </div>
        </div>

        {/* Team Labels on grid sides */}
        <div className="absolute top-1/2 left-2 -translate-y-1/2 z-30 pointer-events-none hidden md:block">
          <div className="bg-red-600/80 backdrop-blur-sm text-white text-xs font-black px-2 py-1 rounded-lg -rotate-90 origin-center tracking-wider">
            TEAM A
          </div>
        </div>
        <div className="absolute top-1/2 right-2 -translate-y-1/2 z-30 pointer-events-none hidden md:block">
          <div className="bg-blue-600/80 backdrop-blur-sm text-white text-xs font-black px-2 py-1 rounded-lg rotate-90 origin-center tracking-wider">
            TEAM B
          </div>
        </div>

        {/* Score bar at bottom showing lead */}
        <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
          <div className="flex h-1.5">
            <motion.div
              className="bg-gradient-to-r from-red-600 to-red-500"
              animate={{ width: `${state.teamAScore + state.teamBScore > 0 ? (state.teamAScore / (state.teamAScore + state.teamBScore)) * 100 : 50}%` }}
              transition={{ duration: 0.5 }}
            />
            <motion.div
              className="bg-gradient-to-r from-blue-500 to-blue-600"
              animate={{ width: `${state.teamAScore + state.teamBScore > 0 ? (state.teamBScore / (state.teamAScore + state.teamBScore)) * 100 : 50}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ─── ENDED / RESULTS ───
  if (phase === 'ended') {
    const isWinner = (state.winner === 'A' && myTeam === 'A') || (state.winner === 'B' && myTeam === 'B');
    const isDraw = state.winner === 'draw';

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.8, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 12 }}
          className="bg-zinc-900/95 border border-white/10 rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center"
        >
          {/* Result */}
          <div className="mb-4">
            {isDraw ? (
              <div className="text-4xl font-black text-yellow-400 mb-2">DRAW</div>
            ) : isWinner ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 8 }}
              >
                <Trophy size={48} className="text-yellow-400 mx-auto mb-2" />
                <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                  VICTORY
                </div>
              </motion.div>
            ) : (
              <div>
                <div className="text-3xl font-black text-zinc-500 mb-2">DEFEAT</div>
              </div>
            )}
          </div>

          {/* Final Scores */}
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="text-center">
              <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Team A</div>
              <div className={cn(
                "text-3xl font-black tabular-nums",
                state.winner === 'A' ? 'text-red-400' : 'text-zinc-400'
              )}>
                {state.teamAScore.toLocaleString()}
              </div>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Gift size={10} className="text-red-400/50" />
                <span className="text-[10px] text-red-400/60">{state.teamAGiftCount} gifts</span>
              </div>
            </div>
            <div className="text-zinc-600 text-lg font-bold">vs</div>
            <div className="text-center">
              <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Team B</div>
              <div className={cn(
                "text-3xl font-black tabular-nums",
                state.winner === 'B' ? 'text-blue-400' : 'text-zinc-400'
              )}>
                {state.teamBScore.toLocaleString()}
              </div>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Gift size={10} className="text-blue-400/50" />
                <span className="text-[10px] text-blue-400/60">{state.teamBGiftCount} gifts</span>
              </div>
            </div>
          </div>

          {/* Top earners */}
          <div className="mb-4">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Top Earners</div>
            <div className="space-y-1">
              {[...state.participants]
                .sort((a, b) => b.coinsEarned - a.coinsEarned)
                .slice(0, 3)
                .map((p, i) => (
                  <div key={p.userId} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs font-bold",
                        i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-400" : "text-amber-700"
                      )}>
                        #{i + 1}
                      </span>
                      <span className="text-xs text-white font-medium">{p.username}</span>
                      <span className={cn(
                        "text-[8px] px-1 rounded font-bold",
                        p.team === 'A' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                      )}>
                        {p.team}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Coins size={10} className="text-yellow-500" />
                      <span className="text-xs font-bold text-yellow-400">{p.coinsEarned.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Rematch */}
          <div className="space-y-2">
            {state.rematchAccepted[myTeam] ? (
              <div className="text-xs text-purple-400 font-medium animate-pulse">
                Waiting for opponent to accept rematch...
              </div>
            ) : (
              <button
                onClick={onRequestRematch}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Flame size={16} />
                REMATCH
              </button>
            )}
            <div className="text-[10px] text-zinc-500 text-center">
              Auto-returns in {state.rematchCountdown}s
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return null;
}

// ─── ABILITY BUTTON COMPONENT ───

function AbilityButton({
  icon: Icon,
  label,
  color,
  cooldown,
  maxCooldown,
  onClick,
  description,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  cooldown: number;
  maxCooldown: number;
  onClick: () => void;
  description: string;
}) {
  const isOnCooldown = cooldown > 0;
  const cooldownPercent = isOnCooldown ? (cooldown / maxCooldown) * 100 : 0;

  const colorMap: Record<string, string> = {
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400 hover:from-cyan-500/30',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400 hover:from-orange-500/30',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 text-yellow-400 hover:from-yellow-500/30',
  };

  return (
    <button
      onClick={onClick}
      disabled={isOnCooldown}
      title={description}
      className={cn(
        "relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border transition-all",
        isOnCooldown
          ? "bg-zinc-800/50 border-zinc-700/30 text-zinc-600 cursor-not-allowed"
          : `bg-gradient-to-b ${colorMap[color] || colorMap.cyan} active:scale-95`
      )}
    >
      {isOnCooldown && (
        <div
          className="absolute inset-0 rounded-xl bg-zinc-700/20 transition-all duration-1000"
          style={{ clipPath: `inset(${100 - cooldownPercent}% 0 0 0)` }}
        />
      )}
      <Icon size={18} />
      <span className="text-[9px] font-bold tracking-wider uppercase">{label}</span>
      {isOnCooldown && (
        <span className="text-[8px] text-zinc-500 font-mono">{cooldown}s</span>
      )}
    </button>
  );
}
