// src/components/broadcast/TrollToeBoard.tsx
// Real-time 3x3 Troll Toe board with LiveKit video tiles

import React, { useRef, useEffect, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LocalVideoTrack, LocalAudioTrack, RemoteVideoTrack, RemoteAudioTrack } from 'livekit-client';
import { X, Circle, Cloud, Shield, Swords, Trophy } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TrollToeBox, TrollToeMatch, TrollToeTeam } from '../../types/trollToe';
import { WIN_PATTERNS } from '../../types/trollToe';

// ─── LIVEKIT VIDEO PLAYER ───

function LiveKitVideoPlayer({
  videoTrack,
  isLocal = false,
}: {
  videoTrack: LocalVideoTrack | RemoteVideoTrack | undefined;
  isLocal?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasPlayedRef = useRef(false);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoTrack || !containerRef.current) return;
    if (hasPlayedRef.current && videoElementRef.current && containerRef.current.contains(videoElementRef.current)) return;
    if (!videoElementRef.current || !containerRef.current.contains(videoElementRef.current)) hasPlayedRef.current = false;
    if (hasPlayedRef.current) return;

    try {
      const el = videoTrack.attach();
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.objectFit = 'cover';
      el.autoplay = true;
      el.playsInline = true;
      if (isLocal) { el.muted = true; containerRef.current!.style.transform = 'scaleX(-1)'; }
      containerRef.current!.appendChild(el);
      videoElementRef.current = el;
      hasPlayedRef.current = true;
    } catch (err) { console.error('[TrollToeBoard] Video attach error:', err); }

    return () => {
      if (videoTrack && videoElementRef.current && containerRef.current?.contains(videoElementRef.current)) {
        try { videoTrack.detach(); videoElementRef.current = null; hasPlayedRef.current = false; } catch {}
      }
    };
  }, [videoTrack, isLocal]);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full bg-black overflow-hidden" style={{ zIndex: 1 }} />;
}

// ─── AUDIO PLAYER ───

const LiveKitAudioPlayer = memo(({ audioTrack }: { audioTrack: LocalAudioTrack | RemoteAudioTrack }) => {
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!audioTrack) return;
    try { const el = audioTrack.attach(); audioElementRef.current = el; document.body.appendChild(el); } catch {}
    return () => { try { if (audioElementRef.current) { audioTrack.detach(); audioElementRef.current = null; } } catch {} };
  }, [audioTrack]);
  return null;
});
LiveKitAudioPlayer.displayName = 'LiveKitAudioPlayer';

// ─── BROKEN COUNTDOWN ───

function BrokenCountdown({ endTime }: { endTime: string }) {
  const [remaining, setRemaining] = React.useState(() =>
    Math.max(0, Math.ceil((new Date(endTime).getTime() - Date.now()) / 1000))
  );
  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((new Date(endTime).getTime() - Date.now()) / 1000)));
    }, 500);
    return () => clearInterval(interval);
  }, [endTime]);
  return <span className="text-[9px] text-orange-300 mt-0.5 font-mono">{remaining}s</span>;
}

// ─── GAME TILE ───

interface GameTileProps {
  box: TrollToeBox;
  index: number;
  getTrackForUser: (userId: string) => {
    videoTrack: LocalVideoTrack | RemoteVideoTrack | undefined;
    audioTrack: LocalAudioTrack | RemoteAudioTrack | undefined;
    isLocal: boolean;
    hasVideo: boolean;
    hasAudio: boolean;
  };
  isHost: boolean;
  onFogClick?: (boxIndex: number) => void;
  canFog?: boolean;
  winningLine?: boolean;
}

function GameTile({ box, index, getTrackForUser, isHost, onFogClick, canFog, winningLine }: GameTileProps) {
  const isBroken = box.state === 'broken';
  const isOccupied = box.state === 'occupied' && box.player;
  const isEmpty = box.state === 'empty';
  const teamColor: Record<string, string> = {
    broadcaster: 'border-red-500/60 bg-red-500/10',
    challenger: 'border-blue-500/60 bg-blue-500/10',
  };
  const trackData = isOccupied ? getTrackForUser(box.player!.userId) : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'relative aspect-square rounded-xl border-2 overflow-hidden transition-all duration-300',
        isEmpty && 'border-white/15 bg-white/5',
        isOccupied && teamColor[box.player!.team],
        isBroken && 'border-orange-500/60 bg-orange-500/10',
        winningLine && 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-black animate-pulse',
        box.player?.spawnProtectedUntil && new Date(box.player.spawnProtectedUntil) > new Date() && 'ring-2 ring-green-400'
      )}
    >
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-black text-white/10">{index + 1}</span>
        </div>
      )}

      {isBroken && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="absolute inset-0 flex flex-col items-center justify-center bg-orange-900/40">
          <Cloud size={28} className="text-orange-400 mb-1" />
          <span className="text-[10px] font-bold text-orange-300 uppercase tracking-wider">FOGGED</span>
          {box.brokenCooldownEnds && <BrokenCountdown endTime={box.brokenCooldownEnds} />}
        </motion.div>
      )}

      {isOccupied && (
        <>
          {trackData?.hasVideo ? (
            <LiveKitVideoPlayer videoTrack={trackData.videoTrack} isLocal={trackData.isLocal} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
              <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                <span className="text-sm font-bold text-white/60">{box.player!.username.charAt(0).toUpperCase()}</span>
              </div>
            </div>
          )}

          {trackData?.audioTrack && !trackData.isLocal && <LiveKitAudioPlayer audioTrack={trackData.audioTrack} />}

          <div className="absolute top-1.5 left-1.5 z-10">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center font-black text-sm border',
              box.symbol === 'X' ? 'bg-red-600/90 border-red-400 text-white' : 'bg-blue-600/90 border-blue-400 text-white'
            )}>
              {box.symbol === 'X' ? <X size={14} /> : <Circle size={14} />}
            </div>
          </div>

          <div className="absolute bottom-1 left-1 right-1 z-10">
            <div className="bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-md truncate">
              <span className="text-[10px] font-bold text-white truncate block">{box.player!.username}</span>
            </div>
          </div>

          <div className="absolute top-1.5 right-1.5 z-10">
            <div className={cn(
              'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider',
              box.player!.team === 'broadcaster' ? 'bg-red-600/80 text-white' : 'bg-blue-600/80 text-white'
            )}>
              {box.player!.team === 'broadcaster' ? 'BC' : 'CH'}
            </div>
          </div>

          {canFog && onFogClick && (
            <button
              onClick={(e) => { e.stopPropagation(); onFogClick(index); }}
              className="absolute bottom-8 right-1 z-20 bg-orange-600/90 hover:bg-orange-500 text-white px-2 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-0.5 transition-colors shadow-lg"
              title="Use Fog to remove this player"
            >
              <Cloud size={10} /> FOG
            </button>
          )}

          {box.player?.spawnProtectedUntil && new Date(box.player.spawnProtectedUntil) > new Date() && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-15 pointer-events-none">
              <Shield size={16} className="text-green-400 animate-pulse" />
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

// ─── WIN LINE OVERLAY ───

function WinLineOverlay({ pattern }: { pattern: number[] }) {
  const getLineStyle = (): React.CSSProperties => {
    const [a, , c] = pattern;
    const rowA = Math.floor(a / 3), colA = a % 3;
    const rowC = Math.floor(c / 3), colC = c % 3;
    if (rowA === rowC) return { top: `${(rowA * 100) / 3 + 100 / 6}%`, left: '5%', right: '5%', height: '4px', transform: 'translateY(-50%)' };
    if (colA === colC) return { left: `${(colA * 100) / 3 + 100 / 6}%`, top: '5%', bottom: '5%', width: '4px', transform: 'translateX(-50%)' };
    if (a === 0 && c === 8) return { top: '5%', left: '5%', right: '5%', bottom: '5%', background: 'linear-gradient(45deg, transparent 47%, #facc15 47%, #facc15 53%, transparent 53%)' };
    return { top: '5%', left: '5%', right: '5%', bottom: '5%', background: 'linear-gradient(-45deg, transparent 47%, #facc15 47%, #facc15 53%, transparent 53%)' };
  };
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute z-30 rounded-full" style={getLineStyle()} />;
}

// ─── MAIN BOARD ───

interface TrollToeBoardProps {
  match: TrollToeMatch;
  getTrackForUser: (userId: string) => {
    videoTrack: LocalVideoTrack | RemoteVideoTrack | undefined;
    audioTrack: LocalAudioTrack | RemoteAudioTrack | undefined;
    isLocal: boolean;
    hasVideo: boolean;
    hasAudio: boolean;
  };
  isHost: boolean;
  currentUserId?: string;
  onFogClick?: (boxIndex: number) => void;
  canFog?: boolean;
  className?: string;
  compact?: boolean;
}

export default function TrollToeBoard({
  match, getTrackForUser, isHost, currentUserId, onFogClick, canFog, className, compact = false,
}: TrollToeBoardProps) {
  const winningPattern = useMemo(() => {
    if (match.phase !== 'ended') return null;
    for (const pattern of WIN_PATTERNS) {
      const [a, b, c] = pattern;
      if (match.boxes[a].player && match.boxes[b].player && match.boxes[c].player &&
        match.boxes[a].player!.team === match.boxes[b].player!.team &&
        match.boxes[b].player!.team === match.boxes[c].player!.team) return pattern;
    }
    return null;
  }, [match.boxes, match.phase]);

  return (
    <div className={cn('relative', className)}>
      {(match.phase === 'live' || match.phase === 'paused') && (
        <div className="mb-3 flex items-center justify-center">
          <div className={cn(
            'px-5 py-2 rounded-full font-black text-lg font-mono tracking-wider border-2',
            match.remainingSeconds <= 30 ? 'bg-red-600/90 border-red-400 text-white animate-pulse'
              : match.remainingSeconds <= 60 ? 'bg-yellow-600/90 border-yellow-400 text-white'
              : 'bg-zinc-900/90 border-white/20 text-white'
          )}>
            {Math.floor(match.remainingSeconds / 60)}:{(match.remainingSeconds % 60).toString().padStart(2, '0')}
          </div>
          {match.phase === 'paused' && <span className="ml-2 text-xs font-bold text-yellow-400 uppercase animate-pulse">PAUSED</span>}
        </div>
      )}

      <div className="flex items-center justify-between mb-3 px-2">
        <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 rounded-full px-3 py-1.5">
          <Shield size={14} className="text-red-400" />
          <span className="text-xs font-bold text-red-300">
            {match.broadcasterTeam.filter(p => match.boxes.some(b => b.player?.userId === p.userId)).length}
          </span>
          <span className="text-[9px] text-red-400/60 uppercase">BC</span>
        </div>
        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">VS</span>
        <div className="flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 rounded-full px-3 py-1.5">
          <span className="text-[9px] text-blue-400/60 uppercase">CH</span>
          <span className="text-xs font-bold text-blue-300">
            {match.challengerTeam.filter(p => match.boxes.some(b => b.player?.userId === p.userId)).length}
          </span>
          <Swords size={14} className="text-blue-400" />
        </div>
      </div>

      <div className={cn('grid grid-cols-3 gap-2', compact ? 'max-w-[280px] mx-auto' : 'max-w-[400px] mx-auto')}>
        <AnimatePresence mode="popLayout">
          {match.boxes.map((box, index) => (
            <GameTile key={index} box={box} index={index} getTrackForUser={getTrackForUser} isHost={isHost}
              onFogClick={onFogClick}
              canFog={canFog && box.state === 'occupied' && box.player?.userId !== currentUserId}
              winningLine={winningPattern?.includes(index)} />
          ))}
        </AnimatePresence>
      </div>

      {winningPattern && <WinLineOverlay pattern={winningPattern} />}

      {match.phase === 'ended' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-4 text-center">
          <div className={cn(
            'inline-block px-6 py-3 rounded-2xl font-black text-lg border-2',
            match.winnerTeam === 'broadcaster' ? 'bg-red-600/90 border-red-400 text-white'
              : match.winnerTeam === 'challenger' ? 'bg-blue-600/90 border-blue-400 text-white'
              : 'bg-zinc-800/90 border-zinc-500 text-white'
          )}>
            {match.winnerTeam ? (
              <><Trophy size={20} className="inline mr-2" />{match.winnerTeam === 'broadcaster' ? 'BROADCASTER' : 'CHALLENGER'} TEAM WINS!</>
            ) : "IT'S A DRAW!"}
          </div>
          {match.winnerTeam && (
            <div className="mt-2 text-sm text-yellow-400 font-bold">
              {match.rewardAmount} Troll Coins split among winning team!
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
