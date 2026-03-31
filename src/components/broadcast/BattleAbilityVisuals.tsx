import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Snowflake, RotateCcw, Zap, Shield, Swords } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BattleAbilityEffect {
  id: string;
  type: 'team_freeze' | 'reverse' | 'double_xp' | 'mute_hammer' | 'truth_serum' | 'fake_system_alert' | 'gold_frame_broadcast' | 'coin_drop_event' | 'vip_chat_only' | 'raid_another_stream' | 'citywide_broadcast' | 'troll_foot';
  team?: 'A' | 'B';
  username: string;
  timestamp: number;
}

interface BattleAbilityVisualsProps {
  effects: BattleAbilityEffect[];
  onEffectComplete: (id: string) => void;
}

export default function BattleAbilityVisuals({ effects, onEffectComplete }: BattleAbilityVisualsProps) {
  return (
    <div className="absolute inset-0 z-[55] pointer-events-none overflow-hidden">
      <AnimatePresence>
        {effects.map(effect => (
          <BattleEffect key={effect.id} effect={effect} onComplete={() => onEffectComplete(effect.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function BattleEffect({ effect, onComplete }: { effect: BattleAbilityEffect; onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  switch (effect.type) {
    case 'team_freeze':
      return <FreezeEffect team={effect.team} username={effect.username} />;
    case 'reverse':
      return <ReverseEffect username={effect.username} />;
    case 'double_xp':
      return <DoubleXpEffect team={effect.team} username={effect.username} />;
    case 'mute_hammer':
      return <MuteHammerEffect username={effect.username} />;
    case 'gold_frame_broadcast':
      return <GoldFrameEffect username={effect.username} />;
    case 'coin_drop_event':
      return <CoinDropEffect username={effect.username} />;
    case 'citywide_broadcast':
      return <CitywideEffect username={effect.username} />;
    default:
      return <GenericAbilityEffect effect={effect} />;
  }
}

function FreezeEffect({ team, username }: { team?: string; username: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0"
    >
      {/* Full screen frost overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-gradient-to-b from-cyan-400/20 via-transparent to-cyan-400/20"
      />
      {/* Ice crystals falling */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ y: -20, x: `${Math.random() * 100}%`, opacity: 0, scale: 0 }}
          animate={{
            y: '110vh',
            opacity: [0, 1, 1, 0],
            scale: [0, 1, 1, 0.5],
            rotate: Math.random() * 360,
          }}
          transition={{ duration: 2.5, delay: Math.random() * 0.5, ease: 'easeIn' }}
          className="absolute text-cyan-300 text-2xl"
          style={{ left: `${Math.random() * 100}%` }}
        >
          ❄
        </motion.div>
      ))}
      {/* Center announcement */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: 'spring', damping: 10 }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
      >
        <div className="bg-cyan-500/30 backdrop-blur-xl border border-cyan-400/50 rounded-2xl px-6 py-4 shadow-2xl shadow-cyan-500/30">
          <Snowflake size={48} className="text-cyan-300 mx-auto mb-2 animate-spin" style={{ animationDuration: '3s' }} />
          <div className="text-2xl font-black text-cyan-200">TEAM FROZEN</div>
          <div className="text-xs text-cyan-300/80 mt-1">@{username} froze Team {team}!</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ReverseEffect({ username }: { username: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0, rotate: 0 }}
        animate={{ scale: [0, 1.5, 1], rotate: 720 }}
        exit={{ scale: 0 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        className="text-center"
      >
        <div className="bg-orange-500/30 backdrop-blur-xl border border-orange-400/50 rounded-2xl px-6 py-4 shadow-2xl shadow-orange-500/30">
          <RotateCcw size={48} className="text-orange-300 mx-auto mb-2" />
          <div className="text-2xl font-black text-orange-200">REVERSE!</div>
          <div className="text-xs text-orange-300/80 mt-1">@{username} reversed the freeze!</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DoubleXpEffect({ team, username }: { team?: string; username: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0"
    >
      {/* Gold particles */}
      {Array.from({ length: 15 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ y: '100vh', x: `${Math.random() * 100}%`, opacity: 0 }}
          animate={{
            y: '-10vh',
            opacity: [0, 1, 1, 0],
            scale: [0.5, 1.5, 1],
          }}
          transition={{ duration: 2, delay: Math.random() * 0.8, ease: 'easeOut' }}
          className="absolute text-yellow-400 text-xl"
          style={{ left: `${Math.random() * 100}%` }}
        >
          💰
        </motion.div>
      ))}
      {/* Center announcement */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: 'spring', damping: 10 }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
      >
        <div className="bg-yellow-500/30 backdrop-blur-xl border border-yellow-400/50 rounded-2xl px-6 py-4 shadow-2xl shadow-yellow-500/30">
          <Zap size={48} className="text-yellow-300 mx-auto mb-2" />
          <div className="text-2xl font-black text-yellow-200">2X XP!</div>
          <div className="text-xs text-yellow-300/80 mt-1">@{username} doubled Team {team}'s score!</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MuteHammerEffect({ username }: { username: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center"
    >
      <motion.div
        initial={{ y: -200, scale: 2 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: 'spring', damping: 8 }}
        className="text-center"
      >
        <div className="bg-red-500/30 backdrop-blur-xl border border-red-400/50 rounded-2xl px-6 py-4 shadow-2xl shadow-red-500/30">
          <div className="text-5xl mb-2">🔨</div>
          <div className="text-2xl font-black text-red-200">MUTE HAMMER!</div>
          <div className="text-xs text-red-300/80 mt-1">@{username} swung the hammer!</div>
        </div>
      </motion.div>
      {/* Screen shake effect */}
      <motion.div
        animate={{ x: [0, -5, 5, -3, 3, 0] }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0"
      />
    </motion.div>
  );
}

function GoldFrameEffect({ username }: { username: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0"
    >
      {/* Gold frame border */}
      <motion.div
        initial={{ borderWidth: 0 }}
        animate={{ borderWidth: 8 }}
        exit={{ borderWidth: 0 }}
        transition={{ duration: 0.8 }}
        className="absolute inset-0 border-yellow-400 rounded-xl"
        style={{ boxShadow: '0 0 40px rgba(234, 179, 8, 0.5), inset 0 0 40px rgba(234, 179, 8, 0.2)' }}
      />
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0 }}
        className="absolute top-4 left-1/2 -translate-x-1/2"
      >
        <div className="bg-yellow-500/30 backdrop-blur-xl border border-yellow-400/50 rounded-full px-4 py-2 shadow-2xl">
          <div className="text-sm font-black text-yellow-200 flex items-center gap-2">
            🖼️ @username activated Gold Frame!
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CoinDropEffect({ username }: { username: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0"
    >
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ y: -30, x: `${Math.random() * 100}%`, opacity: 0, rotate: 0 }}
          animate={{
            y: '110vh',
            opacity: [0, 1, 1, 0],
            rotate: 720,
          }}
          transition={{ duration: 1.5 + Math.random(), delay: Math.random() * 1, ease: 'easeIn' }}
          className="absolute text-2xl"
          style={{ left: `${Math.random() * 100}%` }}
        >
          {Math.random() > 0.3 ? '🪙' : '💀'}
        </motion.div>
      ))}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0 }}
        className="absolute top-1/4 left-1/2 -translate-x-1/2 text-center"
      >
        <div className="bg-blue-500/30 backdrop-blur-xl border border-blue-400/50 rounded-2xl px-6 py-3 shadow-2xl">
          <div className="text-2xl font-black text-blue-200">COIN DROP!</div>
          <div className="text-xs text-blue-300/80">@{username} dropped coins!</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CitywideEffect({ username }: { username: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0"
    >
      {/* Pulsing rings */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          initial={{ scale: 0, opacity: 0.8 }}
          animate={{ scale: 3, opacity: 0 }}
          transition={{ duration: 2, delay: i * 0.4, ease: 'easeOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-2 border-orange-400"
        />
      ))}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0 }}
        transition={{ type: 'spring', damping: 8 }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
      >
        <div className="bg-orange-500/40 backdrop-blur-xl border border-orange-400/60 rounded-2xl px-8 py-5 shadow-2xl shadow-orange-500/40">
          <div className="text-5xl mb-2">🏙️</div>
          <div className="text-3xl font-black text-orange-200">CITYWIDE!</div>
          <div className="text-sm text-orange-300/80 mt-1">@{username} is broadcasting to ALL!</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GenericAbilityEffect({ effect }: { effect: BattleAbilityEffect }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      className="absolute inset-0 flex items-center justify-center"
    >
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-6 py-4 text-center">
        <div className="text-2xl font-black text-white">{effect.type.replace(/_/g, ' ').toUpperCase()}</div>
        <div className="text-xs text-white/60 mt-1">@{effect.username}</div>
      </div>
    </motion.div>
  );
}
