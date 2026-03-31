// BroadcastAbilityEffects - Visual overlay for active broadcast abilities
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BroadcastActiveEffect, getAbilityById, getRarityColor } from '../../types/broadcastAbilities';

interface BroadcastAbilityEffectsProps {
  activeEffects: BroadcastActiveEffect[];
}

export default function BroadcastAbilityEffects({ activeEffects }: BroadcastAbilityEffectsProps) {
  const now = Date.now();

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[45]">
      <AnimatePresence>
        {activeEffects.map(effect => {
          const def = getAbilityById(effect.ability_id);
          if (!def) return null;

          const expiresAt = new Date(effect.expires_at).getTime();
          if (expiresAt <= now) return null;

          const remaining = Math.ceil((expiresAt - now) / 1000);

          return (
            <motion.div
              key={effect.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
            >
              {effect.ability_id === 'gold_frame_broadcast' && <GoldFrameEffect remaining={remaining} />}
              {effect.ability_id === 'mute_hammer' && <MuteHammerEffect effect={effect} />}
              {effect.ability_id === 'truth_serum' && <TruthSerumEffect effect={effect} remaining={remaining} />}
              {effect.ability_id === 'fake_system_alert' && <FakeAlertEffect effect={effect} remaining={remaining} />}
              {effect.ability_id === 'vip_chat_only' && <VIPChatEffect remaining={remaining} />}
              {effect.ability_id === 'citywide_broadcast' && <CitywideEffect effect={effect} remaining={remaining} />}
              {effect.ability_id === 'troll_foot' && <TrollFootEffect remaining={remaining} />}
              {effect.ability_id === 'coin_drop_event' && <CoinDropEffect effect={effect} remaining={remaining} />}
              {effect.ability_id === 'raid_another_stream' && <RaidEffect effect={effect} remaining={remaining} />}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* System Banner - always shows for active effects */}
      <AnimatePresence>
        {activeEffects.filter(e => new Date(e.expires_at).getTime() > now).map(effect => {
          const def = getAbilityById(effect.ability_id);
          if (!def) return null;
          return (
            <SystemBanner key={`banner-${effect.id}`} effect={effect} def={def} />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// Gold Frame - animated gold border around the stream
function GoldFrameEffect({ remaining }: { remaining: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <motion.div
        className="absolute inset-0 rounded-lg"
        style={{
          border: '4px solid #eab308',
          boxShadow: '0 0 30px rgba(234, 179, 8, 0.5), inset 0 0 30px rgba(234, 179, 8, 0.1)',
        }}
        animate={{
          boxShadow: [
            '0 0 30px rgba(234, 179, 8, 0.5), inset 0 0 30px rgba(234, 179, 8, 0.1)',
            '0 0 50px rgba(234, 179, 8, 0.8), inset 0 0 50px rgba(234, 179, 8, 0.2)',
            '0 0 30px rgba(234, 179, 8, 0.5), inset 0 0 30px rgba(234, 179, 8, 0.1)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      {/* Sparkle corners */}
      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => (
        <motion.div
          key={pos}
          className="absolute text-yellow-400 text-xl"
          style={{
            [pos.includes('top') ? 'top' : 'bottom']: '8px',
            [pos.includes('left') ? 'left' : 'right']: '8px',
          }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: Math.random() }}
        >
          ✨
        </motion.div>
      ))}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-yellow-500/90 text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
        🖼️ Elite Broadcast ({remaining}s)
      </div>
    </div>
  );
}

// Mute Hammer - slam effect
function MuteHammerEffect({ effect }: { effect: BroadcastActiveEffect }) {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 2, delay: 1 }}
    >
      <motion.div
        initial={{ scale: 3, rotate: -30, opacity: 1 }}
        animate={{ scale: 1, rotate: 0, opacity: 0 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        className="text-8xl"
      >
        🔨
      </motion.div>
      <motion.div
        className="absolute inset-0 bg-red-500/30"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      />
    </motion.div>
  );
}

// Truth Serum - neon pulse with timer
function TruthSerumEffect({ effect, remaining }: { effect: BroadcastActiveEffect; remaining: number }) {
  return (
    <div className="absolute inset-0">
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.2) 0%, transparent 70%)',
        }}
        animate={{
          background: [
            'radial-gradient(circle at center, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
            'radial-gradient(circle at center, rgba(34, 197, 94, 0.3) 0%, transparent 70%)',
            'radial-gradient(circle at center, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <motion.div
          className="text-6xl"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          🧪
        </motion.div>
        <div className="bg-green-500/90 text-black text-sm font-black px-4 py-1 rounded-full mt-2">
          TRUTH SERUM - {remaining}s
        </div>
        {effect.target_username && (
          <p className="text-green-300 text-xs mt-1 font-bold">Target: @{effect.target_username}</p>
        )}
      </div>
    </div>
  );
}

// Fake System Alert - red siren flash
function FakeAlertEffect({ effect, remaining }: { effect: BroadcastActiveEffect; remaining: number }) {
  return (
    <div className="absolute inset-0">
      <motion.div
        className="absolute inset-0 bg-red-500/10"
        animate={{ opacity: [0.05, 0.2, 0.05] }}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
      <div className="absolute top-3 left-1/2 -translate-x-1/2">
        <motion.div
          className="bg-red-600/95 text-white text-sm font-black px-4 py-2 rounded-xl border border-red-400 flex items-center gap-2"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          style={{ boxShadow: '0 0 20px rgba(239, 68, 68, 0.5)' }}
        >
          🚨 UNDER INVESTIGATION
          {effect.target_username && <span className="text-red-200">@{effect.target_username}</span>}
          <span className="text-red-200 text-xs">({remaining}s)</span>
        </motion.div>
      </div>
    </div>
  );
}

// VIP Chat Only - lock effect
function VIPChatEffect({ remaining }: { remaining: number }) {
  return (
    <div className="absolute inset-0">
      <div className="absolute top-3 right-3">
        <motion.div
          className="bg-purple-600/95 text-white text-xs font-black px-3 py-1.5 rounded-full flex items-center gap-1.5"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{ boxShadow: '0 0 15px rgba(139, 92, 246, 0.5)' }}
        >
          🔒 VIP CHAT ONLY ({remaining}s)
        </motion.div>
      </div>
    </div>
  );
}

// Citywide Broadcast - giant alert
function CitywideEffect({ effect, remaining }: { effect: BroadcastActiveEffect; remaining: number }) {
  return (
    <div className="absolute inset-0">
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, rgba(249, 115, 22, 0.15) 0%, transparent 70%)',
        }}
        animate={{
          background: [
            'radial-gradient(circle at center, rgba(249, 115, 22, 0.1) 0%, transparent 70%)',
            'radial-gradient(circle at center, rgba(249, 115, 22, 0.25) 0%, transparent 70%)',
            'radial-gradient(circle at center, rgba(249, 115, 22, 0.1) 0%, transparent 70%)',
          ],
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <div className="absolute top-3 left-1/2 -translate-x-1/2">
        <motion.div
          className="bg-orange-600/95 text-white text-sm font-black px-5 py-2 rounded-xl flex items-center gap-2"
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          style={{ boxShadow: '0 0 30px rgba(249, 115, 22, 0.6)' }}
        >
          🏙️ CITYWIDE BROADCAST
          <span className="text-orange-200 text-xs">({remaining}s)</span>
        </motion.div>
      </div>
    </div>
  );
}

// Troll Foot - stomping foot with cashback
function TrollFootEffect({ remaining }: { remaining: number }) {
  return (
    <div className="absolute inset-0">
      <motion.div
        className="absolute inset-0 bg-green-500/5"
        animate={{ opacity: [0, 0.1, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <div className="absolute top-3 left-3">
        <motion.div
          className="bg-green-600/95 text-white text-xs font-black px-3 py-1.5 rounded-full flex items-center gap-1.5"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{ boxShadow: '0 0 15px rgba(16, 185, 129, 0.5)' }}
        >
          🦶 TROLL FOOT - Cashback! ({remaining}s)
        </motion.div>
      </div>
    </div>
  );
}

// Coin Drop - raining coins
function CoinDropEffect({ effect, remaining }: { effect: BroadcastActiveEffect; remaining: number }) {
  const isGreen = effect.data?.dropType !== 'red';
  const color = isGreen ? '#22c55e' : '#ef4444';
  return (
    <div className="absolute inset-0">
      <div className="absolute top-3 left-1/2 -translate-x-1/2">
        <motion.div
          className="text-white text-sm font-black px-4 py-2 rounded-xl flex items-center gap-2"
          style={{ background: `${color}dd`, boxShadow: `0 0 20px ${color}80` }}
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          🪙 COIN DROP ({remaining}s)
        </motion.div>
      </div>
      {/* Raining coins */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-xl"
          style={{ left: `${10 + Math.random() * 80}%`, top: -20 }}
          animate={{ y: [0, 400], opacity: [1, 0] }}
          transition={{ duration: 2 + Math.random(), repeat: Infinity, delay: i * 0.3 }}
        >
          {isGreen ? '🪙' : '💀'}
        </motion.div>
      ))}
    </div>
  );
}

// Raid Effect - portal animation
function RaidEffect({ effect, remaining }: { effect: BroadcastActiveEffect; remaining: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        className="text-center"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <motion.div
          className="text-6xl"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          ⚔️
        </motion.div>
        <div className="bg-pink-600/95 text-white text-sm font-black px-4 py-2 rounded-xl mt-2">
          RAID INCOMING ({remaining}s)
        </div>
      </motion.div>
    </div>
  );
}

// System Banner - shows who used what on whom
function SystemBanner({ effect, def }: { effect: BroadcastActiveEffect; def: any }) {
  const rarityColor = getRarityColor(def.rarity);
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: -20, x: '-50%' }}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white text-xs font-bold px-4 py-2 rounded-full border flex items-center gap-2 pointer-events-none whitespace-nowrap"
      style={{ borderColor: `${rarityColor}60` }}
    >
      <span>{def.icon}</span>
      <span>@{effect.activator_username}</span>
      <span className="text-gray-400">used</span>
      <span style={{ color: rarityColor }}>{def.name}</span>
      {effect.target_username && (
        <>
          <span className="text-gray-400">on</span>
          <span>@{effect.target_username}</span>
        </>
      )}
    </motion.div>
  );
}
