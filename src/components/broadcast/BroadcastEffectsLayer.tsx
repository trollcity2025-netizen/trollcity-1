import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { EntranceEffectConfig } from '../../lib/entranceEffects';

interface BroadcastEffectsLayerProps {
  streamId: string;
}

interface ActiveEffect {
  id: string; // unique instance id
  username: string;
  effect: EntranceEffectConfig;
}

export default function BroadcastEffectsLayer({ streamId }: BroadcastEffectsLayerProps) {
  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);

  useEffect(() => {
    if (!streamId) return;

    const channel = supabase.channel(`room:${streamId}`);

    channel
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        // newPresences is an array of objects. Each object has a `user_id` and the data tracked.
        // The structure depends on how `track` was called.
        // In useViewerTracking: track({ user_id, username, ..., entrance_effect })
        
        newPresences.forEach((presence: any) => {
          if (presence.entrance_effect) {
             const effect = presence.entrance_effect as EntranceEffectConfig;
             const id = Math.random().toString(36).substring(7);
             
             setActiveEffects(prev => [...prev, {
                 id,
                 username: presence.username,
                 effect
             }]);

             // Remove after duration
             setTimeout(() => {
                 setActiveEffects(prev => prev.filter(e => e.id !== id));
             }, 5000); // 5 seconds duration
          }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[40]">
      <AnimatePresence>
        {activeEffects.map(({ id, username, effect }) => (
          <EffectRenderer key={id} username={username} effect={effect} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function EffectRenderer({ username, effect }: { username: string, effect: EntranceEffectConfig }) {
  // Render different animations based on effect.animation_type
  // For now, we'll implement a generic "Troll Entrance" style
  
  return (
    <motion.div
        initial={{ opacity: 0, scale: 0.5, y: 100 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1.5, filter: 'blur(10px)' }}
        transition={{ type: 'spring', damping: 15 }}
        className="absolute bottom-32 left-8 flex items-center gap-4 bg-black/60 border border-purple-500/50 p-4 rounded-xl backdrop-blur-md shadow-[0_0_30px_rgba(168,85,247,0.4)]"
    >
        {/* Icon/Image */}
        <div className="text-4xl animate-bounce">
            {effect.icon || '👋'}
        </div>
        
        <div className="flex flex-col">
            <motion.span 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="text-white font-bold text-lg"
            >
                {username}
            </motion.span>
            <span className="text-purple-300 text-sm font-medium uppercase tracking-wider">
                Has Entered
            </span>
        </div>
        
        {/* Particle effects could go here */}
        <div className="absolute inset-0 border-2 border-purple-500/30 rounded-xl animate-pulse" />
    </motion.div>
  );
}
