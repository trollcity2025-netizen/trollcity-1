import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LocalVideoTrack, LocalAudioTrack, RemoteParticipant, RemoteVideoTrack, RemoteAudioTrack } from 'livekit-client';
import { Swords, Shield, Clock, Coins, Gift, Zap, Snowflake, RotateCcw, Star, Timer, Users, Trophy, Flame, User, Crown, Home, Flag, Wifi, MicOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FiveVFiveBattleState, BattleParticipant } from '../../hooks/useFiveVFiveBattle';
import type { UserAbility } from '../../types/broadcastAbilities';
import { getAbilityById } from '../../types/broadcastAbilities';
import BattleAbilityVisuals from './BattleAbilityVisuals';

interface BattleAbilityEffect {
  id: string;
  type: string;
  team?: 'A' | 'B';
  username: string;
  timestamp: number;
}

interface FiveVFiveBattleOverlayProps {
  state: FiveVFiveBattleState;
  currentUserId: string;
  onUseAbility: (type: 'team_freeze' | 'reverse' | 'double_xp') => void;
  onRequestRematch: () => void;
  onForfeit?: () => void;
  onDismiss?: () => void;
  TEAM_FREEZE_COOLDOWN: number;
  REVERSE_COOLDOWN: number;
  DOUBLE_XP_COOLDOWN: number;
  userAbilities?: UserAbility[];
  currentUsername?: string;
  onBroadcastEffect?: (effect: BattleAbilityEffect) => void;
  localTracks?: [LocalAudioTrack | undefined, LocalVideoTrack | undefined];
  remoteParticipants?: RemoteParticipant[];
  isHost?: boolean;
  teamAName?: string;
  teamBName?: string;
}

// ─── LIVEKIT VIDEO PLAYER ───

function LiveKitVideoPlayer({
  videoTrack,
  isLocal,
}: {
  videoTrack: LocalVideoTrack | RemoteVideoTrack | undefined;
  isLocal: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const attachedTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!videoTrack || !containerRef.current) return;

    const currentTrackId = videoTrack.sid || (videoTrack as any).id;
    if (attachedTrackIdRef.current === currentTrackId && videoElementRef.current) return;

    if (containerRef.current.querySelector('video')) {
      try { videoTrack.detach(  );
}

// ─── PREMIUM BATTLE SLOT ───

function PremiumBattleSlot({
  participant,
  videoTrack,
  audioTrack,
  hasVideo,
  hasAudio,
  isLocal,
  isCurrent,
  teamColor,
}: {
  participant: BattleParticipant;
  videoTrack: LocalVideoTrack | RemoteVideoTrack | undefined;
  audioTrack: LocalAudioTrack | RemoteAudioTrack | undefined;
  hasVideo: boolean;
  hasAudio: boolean;
  isLocal: boolean;
  isCurrent: boolean;
  teamColor: 'red' | 'blue';
}) {
  const glowColor = teamColor === 'red' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)';
  const borderColor = teamColor === 'red' ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)';
  const borderActive = teamColor === 'red' ? 'rgba(239,68,68,0.6)' : 'rgba(59,130,246,0.6)';
  const avatarBg = teamColor === 'red' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, type: 'spring', damping: 20 }}
      className="relative rounded-xl overflow-hidden border transition-all duration-300"
      style={{
        borderColor: isCurrent ? borderActive : borderColor,
        boxShadow: isCurrent ? `0 0 20px ${glowColor}, inset 0 0 20px ${glowColor}` : `0 0 8px ${glowColor}`,
        background: `linear-gradient(135deg, rgba(15,15,25,0.9), rgba(10,10,20,0.95))`,
      }}
    >
      {hasVideo && videoTrack ? (
        <>
          <LiveKitVideoPlayer videoTrack={videoTrack} isLocal={isLocal} />
          {/* Current user indicator */}
          {isCurrent && (
            <div className="absolute top-1.5 left-1.5 bg-green-500/80 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 z-10">
              <Wifi size={6} /> LIVE
            </div>
          )}
          {/* Bottom info bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-6 pb-1.5 px-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 min-w-0">
                {participant.role === 'host' && <Crown size={8} className="text-amber-400 shrink-0" />}
                <span className="text-[10px] font-bold text-white truncate drop-shadow-lg">{participant.username}</span>
              </div>
              <span className="text-[8px] font-bold text-amber-400/80 tabular-nums shrink-0">+{participant.coinsEarned.toLocaleString()}</span>
            </div>
          </div>
          {!hasAudio && (
            <div className="absolute top-1.5 right-1.5 bg-red-500/70 rounded-full p-0.5 z-10">
              <MicOff size={8} className="text-white" />
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full p-2 gap-1">
          <motion.div
            className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 flex items-center justify-center"
            style={{ borderColor: teamColor === 'red' ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.4)', background: avatarBg }}
            animate={isCurrent ? { boxShadow: [`0 0 0px ${glowColor}`, `0 0 12px ${glowColor}`, `0 0 0px ${glowColor}`] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-sm font-black" style={{ color: teamColor === 'red' ? '#f87171' : '#60a5fa' }}>
              {participant.username.charAt(0).toUpperCase()}
            </span>
          </motion.div>
          <div className="flex items-center gap-0.5 min-w-0 max-w-full">
            {participant.role === 'host' && <Crown size={7} className="text-amber-400 shrink-0" />}
            <span className="text-[9px] font-bold text-white/70 truncate">{participant.username}</span>
          </div>
          <div className="flex items-center gap-1">
            {participant.isActive ? (
              <span className="text-[7px] text-green-400/60 font-medium flex items-center gap-0.5">
                <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse" /> Active
              </span>
            ) : (
              <span className="text-[7px] text-zinc-500">Offline</span>
            )}
            <span className="text-[7px] font-bold text-amber-400/50 tabular-nums">+{participant.coinsEarned.toLocaleString()}</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── EMPTY BATTLE SLOT ───

function EmptyBattleSlot({ teamColor, slotIndex }: { teamColor: 'red' | 'blue'; slotIndex: number }) {
  const borderColor = teamColor === 'red' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: slotIndex * 0.05 }}
      className="rounded-xl border flex flex-col items-center justify-center gap-1.5"
      style={{
        borderColor,
        background: 'rgba(15,15,25,0.4)',
      }}
    >
      <motion.div
        className="w-8 h-8 rounded-full border border-dashed flex items-center justify-center"
        style={{ borderColor: teamColor === 'red' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)' }}
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <User size={14} style={{ color: teamColor === 'red' ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)' }} />
      </motion.div>
      <span className="text-[8px] font-medium" style={{ color: teamColor === 'red' ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)' }}>
        Waiting for player
      </span>
    </motion.div>
  );
} catch {}
    }

    try {
      const videoElement = videoTrack.attach();
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoElement.style.objectFit = 'cover';
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      if (isLocal) videoElement.muted = true;

      containerRef.current.appendChild(videoElement);
      videoElementRef.current = videoElement;
      attachedTrackIdRef.current = currentTrackId;
    } catch (err) {
      console.error('[FiveVFiveBattleOverlay] Error attaching video:', err);
    }

    return () => {
      try {
        if (videoElementRef.current) {
          videoTrack.detach();
          videoElementRef.current = null;
          attachedTrackIdRef.current = null;
        }
      } catch {}
    };
  }, [videoTrack, isLocal]);

  return <div ref={containerRef} className="absolute inset-0" style={isLocal ? { transform: 'scaleX(-1)' } : undefined} />;
}

function BattleParticipantCard({
  participant,
  videoTrack,
  audioTrack,
  hasVideo,
  hasAudio,
  isLocal,
  teamColor,
}: {
  participant: BattleParticipant;
  videoTrack: LocalVideoTrack | RemoteVideoTrack | undefined;
  audioTrack: LocalAudioTrack | RemoteAudioTrack | undefined;
  hasVideo: boolean;
  hasAudio: boolean;
  isLocal: boolean;
  teamColor: 'red' | 'blue';
}) {
  const bgClass = teamColor === 'red' ? 'bg-red-950/40 border-red-500/20' : 'bg-blue-950/40 border-blue-500/20';
  const avatarBgClass = teamColor === 'red' ? 'bg-red-500/30 border-red-500/50' : 'bg-blue-500/30 border-blue-500/50';
  const textClass = teamColor === 'red' ? 'text-red-300' : 'text-blue-300';
  const nameClass = teamColor === 'red' ? 'text-red-200' : 'text-blue-200';
  const coinClass = teamColor === 'red' ? 'text-red-400/60' : 'text-blue-400/60';

  return (
    <div className={cn("border rounded-lg flex flex-col items-center justify-center p-2 min-h-0 relative overflow-hidden", bgClass)}>
      {hasVideo && videoTrack ? (
        <>
          <LiveKitVideoPlayer videoTrack={videoTrack} isLocal={isLocal} />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {participant.role === 'host' && <Crown size={8} className="text-yellow-400" />}
              <span className="text-[10px] md:text-xs font-bold text-white truncate max-w-[80px] drop-shadow-lg">{participant.username}</span>
            </div>
            <span className={cn("text-[8px] font-medium drop-shadow-lg", coinClass)}>+{participant.coinsEarned.toLocaleString()}</span>
          </div>
          {!hasAudio && (
            <div className="absolute bottom-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full" />
          )}
        </>
      ) : (
        <>
          <div className={cn("w-10 h-10 md:w-14 md:h-14 rounded-full border-2 flex items-center justify-center mb-1", avatarBgClass)}>
            <span className={cn("text-sm md:text-lg font-black", textClass)}>{participant.username.charAt(0).toUpperCase()}</span>
          </div>
          <span className={cn("text-[10px] md:text-xs font-bold truncate max-w-full", nameClass)}>{participant.username}</span>
          <div className="flex items-center gap-1 mt-0.5">
            {participant.role === 'host' && <Crown size={8} className="text-yellow-400" />}
            <span className={cn("text-[8px] font-medium", coinClass)}>+{participant.coinsEarned.toLocaleString()}</span>
          </div>
          {!participant.isActive && (
            <span className="text-[8px] text-zinc-500 mt-0.5">Offline</span>
          )}
        </>
      )}
    </div>
  );
}

export default function FiveVFiveBattleOverlay({
  state,
  currentUserId,
  onUseAbility,
  onRequestRematch,
  onForfeit,
  onDismiss,
  TEAM_FREEZE_COOLDOWN,
  REVERSE_COOLDOWN,
  DOUBLE_XP_COOLDOWN,
  userAbilities = [],
  currentUsername = 'Someone',
  onBroadcastEffect,
  localTracks,
  remoteParticipants = [],
  isHost = false,
  teamAName = 'Team A',
  teamBName = 'Team B',
}: FiveVFiveBattleOverlayProps) {
  const navigate = useNavigate();
  const { phase } = state;
  const [abilityEffects, setAbilityEffects] = useState<BattleAbilityEffect[]>([]);

  // Check which battle abilities the user has earned
  const hasFreeze = userAbilities.some(a => a.ability_id === 'team_freeze' && a.quantity > 0);
  const hasReverse = userAbilities.some(a => a.ability_id === 'reverse' && a.quantity > 0);
  const hasDoubleXp = userAbilities.some(a => a.ability_id === 'double_xp' && a.quantity > 0);

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

  // Cooldown state from battle
  const myAbilities = state.abilities[currentUserId];
  const now = Date.now();

  // Merge local effects with battle channel effects
  const allEffects = useMemo(() => {
    const channelEffects = (state as any).abilityEffects || [];
    return [...abilityEffects, ...channelEffects];
  }, [abilityEffects, state]);

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

  // ─── LIVEKIT TRACK HELPERS ───
  const findRemoteParticipant = useCallback((userId: string): RemoteParticipant | undefined => {
    // Try exact identity match first
    let found = remoteParticipants.find(p => p.identity === userId);
    if (found) return found;
    // Try userId as prefix of identity (e.g., "abc123" matches "abc123-suffix")
    found = remoteParticipants.find(p => p.identity.startsWith(userId));
    if (found) return found;
    // Try identity contained in userId or vice versa (handles guest IDs)
    found = remoteParticipants.find(p => userId.startsWith(p.identity) || p.identity.includes(userId));
    if (found) return found;
    // Try without viewer- prefix
    const withoutPrefix = userId.replace(/^viewer-/, '');
    found = remoteParticipants.find(p => p.identity === withoutPrefix || p.identity.startsWith(withoutPrefix));
    return found;
  }, [remoteParticipants]);

  const getVideoTrack = useCallback((participant: RemoteParticipant | undefined): RemoteVideoTrack | undefined => {
    if (!participant) return undefined;
    const pubs = participant.videoTrackPublications as unknown as Map<string, { track?: RemoteVideoTrack }>;
    if (!pubs) return undefined;
    const values = Array.from(pubs.values());
    const pub = values.find(p => p.track?.kind === 'video');
    return pub?.track;
  }, []);

  const getAudioTrack = useCallback((participant: RemoteParticipant | undefined): RemoteAudioTrack | undefined => {
    if (!participant) return undefined;
    const pubs = participant.audioTrackPublications as unknown as Map<string, { track?: RemoteAudioTrack }>;
    if (!pubs) return undefined;
    const values = Array.from(pubs.values());
    const pub = values.find(p => p.track?.kind === 'audio');
    return pub?.track;
  }, []);

  const hasVideoEnabled = useCallback((participant: RemoteParticipant | undefined): boolean => {
    if (!participant) return false;
    const pubs = participant.videoTrackPublications as unknown as Map<string, { track?: RemoteVideoTrack }>;
    if (!pubs) return false;
    return Array.from(pubs.values()).some(p => p.track?.kind === 'video' && p.track.isEnabled);
  }, []);

  const hasAudioEnabled = useCallback((participant: RemoteParticipant | undefined): boolean => {
    if (!participant) return false;
    const pubs = participant.audioTrackPublications as unknown as Map<string, { track?: RemoteAudioTrack }>;
    if (!pubs) return false;
    return Array.from(pubs.values()).some(p => p.track?.kind === 'audio' && p.track.isEnabled);
  }, []);

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
              <div className="flex items-start gap-4 md:gap-8 justify-center mt-4 md:mt-6 px-2">
                {/* Team A */}
                <div className="text-center">
                  <div className="text-[10px] md:text-xs font-bold text-red-400 uppercase tracking-wider mb-2 md:mb-3 flex items-center gap-1 justify-center">
                    <Shield size={10} className="md:w-3 md:h-3" /> {teamAName}
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
                    {Array.from({ length: Math.max(0, 6 - teamAParticipants.length) }).map((_, i) => (
                      <div key={`empty-a-${i}`} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 opacity-30">
                        <div className="w-6 h-6 rounded-full bg-white/10" />
                        <span className="text-xs text-zinc-500">Empty</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-2xl md:text-3xl font-black text-zinc-600 self-center mt-2 md:mt-4">VS</div>

                {/* Team B */}
                <div className="text-center">
                  <div className="text-[10px] md:text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 md:mb-3 flex items-center gap-1 justify-center">
                    <Swords size={10} className="md:w-3 md:h-3" /> {teamBName}
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
                    {Array.from({ length: Math.max(0, 6 - teamBParticipants.length) }).map((_, i) => (
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
    const momentumPercent = state.teamAScore + state.teamBScore > 0
      ? (state.teamAScore / (state.teamAScore + state.teamBScore)) * 100
      : 50;
    const momentumText = momentumPercent > 60 ? 'Team A dominating' :
      momentumPercent > 52 ? 'Team A pushing' :
      momentumPercent < 40 ? 'Team B dominating' :
      momentumPercent < 48 ? 'Team B pushing' : 'Battle tied';

    return (
      <div className="absolute inset-0 z-50 flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #07070d 0%, #0d0a1a 40%, #07070d 100%)' }}>
        {/* Ambient glow effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* ═══ TOP SCOREBOARD ═══ */}
        <div className="shrink-0 z-50 px-3 pt-3">
          <div className="mx-auto max-w-2xl">
            {/* Main score panel */}
            <div className="relative bg-black/70 backdrop-blur-2xl border border-white/8 rounded-2xl shadow-2xl overflow-hidden">
              {/* Momentum bar - very top */}
              <div className="h-1 flex">
                <motion.div
                  className="bg-gradient-to-r from-red-600 to-red-400"
                  animate={{ width: `${momentumPercent}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
                <motion.div
                  className="bg-gradient-to-r from-blue-400 to-blue-600"
                  animate={{ width: `${100 - momentumPercent}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>

              <div className="flex items-center px-4 py-3 gap-4">
                {/* Team A Score */}
                <div className="flex-1">
                  <div className="text-[9px] font-extrabold text-red-400/70 uppercase tracking-[0.2em] mb-0.5">{state.teamAGiftCount} gifts</div>
                  <motion.div
                    key={state.teamAScore}
                    initial={{ scale: 1.15, color: '#f87171' }}
                    animate={{ scale: 1, color: state.teamAScore > state.teamBScore ? '#f87171' : '#ffffff' }}
                    transition={{ duration: 0.3 }}
                    className="text-3xl font-black tabular-nums leading-none"
                  >
                    {state.teamAScore.toLocaleString()}
                  </motion.div>
                </div>

                {/* Timer - center */}
                <div className="flex flex-col items-center min-w-[80px]">
                  <motion.div
                    className={cn(
                      "px-4 py-1.5 rounded-xl font-mono font-black text-xl tabular-nums",
                      state.timerSeconds <= 10
                        ? "bg-red-600/30 text-red-300 border border-red-500/40 animate-pulse"
                        : state.timerSeconds <= 30
                        ? "bg-yellow-500/10 text-yellow-300 border border-yellow-500/20"
                        : "bg-white/5 text-white/90 border border-white/10"
                    )}
                  >
                    {timerMinutes}:{timerSeconds.toString().padStart(2, '0')}
                  </motion.div>
                  <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{momentumText}</div>
                </div>

                {/* Team B Score */}
                <div className="flex-1 text-right">
                  <div className="text-[9px] font-extrabold text-blue-400/70 uppercase tracking-[0.2em] mb-0.5">{state.teamBGiftCount} gifts</div>
                  <motion.div
                    key={state.teamBScore}
                    initial={{ scale: 1.15, color: '#60a5fa' }}
                    animate={{ scale: 1, color: state.teamBScore > state.teamAScore ? '#60a5fa' : '#ffffff' }}
                    transition={{ duration: 0.3 }}
                    className="text-3xl font-black tabular-nums leading-none"
                  >
                    {state.teamBScore.toLocaleString()}
                  </motion.div>
                </div>
              </div>

              {/* Timer progress bar */}
              <div className="h-0.5 flex">
                <motion.div
                  className={cn(
                    "h-full",
                    state.timerSeconds <= 10 ? "bg-red-500" :
                    state.timerSeconds <= 30 ? "bg-yellow-500" : "bg-gradient-to-r from-red-500/60 via-white/20 to-blue-500/60"
                  )}
                  style={{ width: `${timerPercent}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {/* Status indicators row */}
            <div className="flex justify-center gap-2 mt-1.5">
              <AnimatePresence>
                {state.frozenTeams.A && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="bg-cyan-500/15 border border-cyan-400/25 rounded-full px-2.5 py-0.5 text-[9px] font-bold text-cyan-300 flex items-center gap-1">
                    <Snowflake size={8} /> {teamAName} Frozen
                  </motion.div>
                )}
                {state.frozenTeams.B && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="bg-cyan-500/15 border border-cyan-400/25 rounded-full px-2.5 py-0.5 text-[9px] font-bold text-cyan-300 flex items-center gap-1">
                    <Snowflake size={8} /> {teamBName} Frozen
                  </motion.div>
                )}
                {state.doubleXpTeams.A && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    className="bg-yellow-500/15 border border-yellow-400/25 rounded-full px-2.5 py-0.5 text-[9px] font-bold text-yellow-300 animate-pulse">
                    2x XP A
                  </motion.div>
                )}
                {state.doubleXpTeams.B && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    className="bg-yellow-500/15 border border-yellow-400/25 rounded-full px-2.5 py-0.5 text-[9px] font-bold text-yellow-300 animate-pulse">
                    2x XP B
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Forfeit */}
              {onForfeit && (
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to forfeit? The other team will win and receive crowns.')) {
                      onForfeit();
                    }
                  }}
                  className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 hover:border-red-500/30 text-red-400/50 hover:text-red-400 text-[8px] font-bold px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1"
                >
                  <Flag size={8} /> FORFEIT
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══ BATTLE ARENA - 5v5 PLAYER GRID ═══ */}
        <div className="flex-1 flex min-h-0 px-2 md:px-4 pb-2 pt-2 gap-2 md:gap-3">
          {/* ──── TEAM A ──── */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="text-center py-1">
              <span className="text-[10px] font-black text-red-400/80 uppercase tracking-[0.25em] flex items-center justify-center gap-1.5">
                <Shield size={10} /> {teamAName}
              </span>
            </div>
            <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-1.5 auto-rows-fr">
              {teamAParticipants.map((p) => {
                const isCurrentUser = p.userId === currentUserId;
                const isLocal = isCurrentUser && !!localTracks;
                const lkParticipant = isLocal ? undefined : findRemoteParticipant(p.userId);
                const videoTrack = isLocal ? localTracks?.[1] : getVideoTrack(lkParticipant);
                const audioTrack = isLocal ? localTracks?.[0] : getAudioTrack(lkParticipant);
                const hasVideo = isLocal ? !!localTracks?.[1] : hasVideoEnabled(lkParticipant);
                const hasAudio = isLocal ? !!localTracks?.[0] : hasAudioEnabled(lkParticipant);
                return (
                  <PremiumBattleSlot
                    key={p.userId}
                    participant={p}
                    videoTrack={videoTrack}
                    audioTrack={audioTrack}
                    hasVideo={hasVideo}
                    hasAudio={hasAudio}
                    isLocal={isLocal}
                    isCurrent={isCurrentUser}
                    teamColor="red"
                  />
                );
              })}
              {Array.from({ length: Math.max(0, 6 - teamAParticipants.length) }).map((_, i) => (
                <EmptyBattleSlot key={`empty-a-${i}`} teamColor="red" slotIndex={teamAParticipants.length + i} />
              ))}
            </div>
          </div>

          {/* ──── CENTER VS DIVIDER ──── */}
          <div className="flex flex-col items-center justify-center w-12 md:w-16 shrink-0">
            <div className="w-px flex-1 bg-gradient-to-b from-transparent via-red-500/20 to-red-500/40" />
            <div className="relative my-2">
              <div className="absolute inset-0 bg-white/5 rounded-full blur-md" />
              <span className="relative text-sm md:text-base font-black text-white/40 tracking-wider">VS</span>
            </div>
            <div className="w-px flex-1 bg-gradient-to-b from-blue-500/40 via-blue-500/20 to-transparent" />
          </div>

          {/* ──── TEAM B ──── */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="text-center py-1">
              <span className="text-[10px] font-black text-blue-400/80 uppercase tracking-[0.25em] flex items-center justify-center gap-1.5">
                {teamBName} <Swords size={10} />
              </span>
            </div>
            <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-1.5 auto-rows-fr">
              {teamBParticipants.map((p) => {
                const isCurrentUser = p.userId === currentUserId;
                const isLocal = isCurrentUser && !!localTracks;
                const lkParticipant = isLocal ? undefined : findRemoteParticipant(p.userId);
                const videoTrack = isLocal ? localTracks?.[1] : getVideoTrack(lkParticipant);
                const audioTrack = isLocal ? localTracks?.[0] : getAudioTrack(lkParticipant);
                const hasVideo = isLocal ? !!localTracks?.[1] : hasVideoEnabled(lkParticipant);
                const hasAudio = isLocal ? !!localTracks?.[0] : hasAudioEnabled(lkParticipant);
                return (
                  <PremiumBattleSlot
                    key={p.userId}
                    participant={p}
                    videoTrack={videoTrack}
                    audioTrack={audioTrack}
                    hasVideo={hasVideo}
                    hasAudio={hasAudio}
                    isLocal={isLocal}
                    isCurrent={isCurrentUser}
                    teamColor="blue"
                  />
                );
              })}
              {Array.from({ length: Math.max(0, 6 - teamBParticipants.length) }).map((_, i) => (
                <EmptyBattleSlot key={`empty-b-${i}`} teamColor="blue" slotIndex={teamBParticipants.length + i} />
              ))}
            </div>
          </div>
        </div>

        {/* Battle Ability Visuals */}
        <BattleAbilityVisuals
          effects={allEffects}
          onEffectComplete={(id) => setAbilityEffects(prev => prev.filter(e => e.id !== id))}
        />

        {/* Abilities Bar - only shows earned abilities */}
        {(hasFreeze || hasReverse || hasDoubleXp) && (
          <div className="shrink-0 pb-2 flex justify-center pointer-events-auto">
            <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-2.5 shadow-2xl flex items-center gap-3">
              {hasFreeze && (
                <AbilityButton
                  icon={Snowflake}
                  label="Freeze"
                  color="cyan"
                  cooldown={freezeCooldownLeft}
                  maxCooldown={TEAM_FREEZE_COOLDOWN}
                  onClick={() => {
                    onUseAbility('team_freeze');
                    const effect: BattleAbilityEffect = {
                      id: `freeze-${Date.now()}`,
                      type: 'team_freeze',
                      team: state.participants.find(p => p.userId === currentUserId)?.team === 'A' ? 'B' : 'A',
                      username: currentUsername,
                      timestamp: Date.now(),
                    };
                    setAbilityEffects(prev => [...prev, effect]);
                    onBroadcastEffect?.(effect);
                  }}
                  description="Freeze opponents"
                />
              )}
              {hasFreeze && (hasReverse || hasDoubleXp) && <div className="w-px h-8 bg-white/10" />}
              {hasReverse && (
                <AbilityButton
                  icon={RotateCcw}
                  label="Reverse"
                  color="orange"
                  cooldown={reverseCooldownLeft}
                  maxCooldown={REVERSE_COOLDOWN}
                  onClick={() => {
                    onUseAbility('reverse');
                    const effect: BattleAbilityEffect = {
                      id: `reverse-${Date.now()}`,
                      type: 'reverse',
                      username: currentUsername,
                      timestamp: Date.now(),
                    };
                    setAbilityEffects(prev => [...prev, effect]);
                    onBroadcastEffect?.(effect);
                  }}
                  description="Reverse freeze"
                />
              )}
              {hasReverse && hasDoubleXp && <div className="w-px h-8 bg-white/10" />}
              {hasDoubleXp && (
                <AbilityButton
                  icon={Zap}
                  label="2x XP"
                  color="yellow"
                  cooldown={dxpCooldownLeft}
                  maxCooldown={DOUBLE_XP_COOLDOWN}
                  onClick={() => {
                    onUseAbility('double_xp');
                    const effect: BattleAbilityEffect = {
                      id: `dxp-${Date.now()}`,
                      type: 'double_xp',
                      team: state.participants.find(p => p.userId === currentUserId)?.team,
                      username: currentUsername,
                      timestamp: Date.now(),
                    };
                    setAbilityEffects(prev => [...prev, effect]);
                    onBroadcastEffect?.(effect);
                  }}
                  description="Double points"
                />
              )}
            </div>
          </div>
        )}

        {/* Score bar at bottom */}
        <div className="shrink-0 h-1.5 flex">
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
              <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">{teamAName}</div>
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
              <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">{teamBName}</div>
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

          {/* Rematch / Forfeit result */}
          <div className="space-y-2">
            {state.forfeitResult.forfeited ? (
              <>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl py-3 px-4 text-center">
                  <div className="text-sm font-bold text-amber-400 mb-1">Victory by Forfeit</div>
                  <div className="text-[10px] text-amber-300/60">The other team forfeited the match</div>
                </div>
                <div className="text-[10px] text-zinc-500 text-center">
                  Returning in {state.rematchCountdown}s
                </div>
              </>
            ) : (
              <>
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
                <button
                  onClick={() => {
                    if (onDismiss) {
                      onDismiss();
                    } else {
                      navigate('/');
                    }
                  }}
                  className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 border border-white/10"
                >
                  <Home size={16} />
                  {onDismiss ? 'Return to Broadcast' : 'Back to Home'}
                </button>
                <div className="text-[10px] text-zinc-500 text-center">
                  Auto-returns in {state.rematchCountdown}s
                </div>
              </>
            )}
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
