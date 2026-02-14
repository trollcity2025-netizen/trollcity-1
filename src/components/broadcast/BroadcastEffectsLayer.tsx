import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { EffectConfig } from '../../lib/entranceEffects';
import GiftAnimationOverlay from './GiftAnimationOverlay';

interface BroadcastEffectsLayerProps {
  streamId: string;
}

interface ActiveEffect {
  id: string; // unique instance id
  username: string;
  effect: EffectConfig;
}

export default function BroadcastEffectsLayer({ streamId }: BroadcastEffectsLayerProps) {
  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
  const effectBufferRef = useRef<ActiveEffect[]>([]);
  const shownUsersRef = useRef<Set<string>>(new Set());
  const previousUserIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!streamId) return;

    // High-Frequency Entrance Effect Buffer: Flush every 150ms
    const flushInterval = setInterval(() => {
      if (effectBufferRef.current.length === 0) return;

      const newEffects = [...effectBufferRef.current];
      effectBufferRef.current = [];

      setActiveEffects(prev => {
        const next = [...prev, ...newEffects];
        // Limit to 3 simultaneous entrance effects to prevent visual clutter/performance drop
        return next.slice(-3);
      });

      // Schedule removal
      newEffects.forEach(effect => {
        setTimeout(() => {
          setActiveEffects(prev => prev.filter(e => e.id !== effect.id));
        }, 5000);
      });
    }, 150);

    const channel = supabase.channel(`room:${streamId}`);

    channel
      .on('presence', { event: 'sync' }, () => {
        // Use 'sync' event to detect truly new users, not 're-tracks'
        const state = channel.presenceState();
        const currentUserIds = new Set<string>();
        
        // Collect all current user IDs from presence state
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.user_id) {
              currentUserIds.add(p.user_id);
            }
          });
        });
        
        // Find users who are in currentUserIds but NOT in previousUserIds
        // These are truly new joins
        currentUserIds.forEach(userId => {
          if (!previousUserIdsRef.current.has(userId) && !shownUsersRef.current.has(userId)) {
            // Find the presence data for this user
            Object.values(state).forEach((presences: any) => {
              presences.forEach((p: any) => {
                if (p.user_id === userId && p.entrance_effect) {
                  const effect = p.entrance_effect as EffectConfig;
                  const id = Math.random().toString(36).substring(7);
                  
                  // Mark this user as shown
                  shownUsersRef.current.add(userId);
                  
                  effectBufferRef.current.push({
                    id,
                    username: p.username,
                    effect
                  });
                }
              });
            });
          }
        });
        
        // Update previous user IDs for next sync
        previousUserIdsRef.current = currentUserIds;
      })
      .subscribe();

    const currentShownUsers = shownUsersRef.current;

    return () => {
      clearInterval(flushInterval);
      supabase.removeChannel(channel);
      // Clear tracked users when component unmounts
      currentShownUsers.clear();
    };
  }, [streamId]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[40]">
      <GiftAnimationOverlay streamId={streamId} />
      <AnimatePresence>
        {activeEffects.map(({ id, username, effect }) => (
          <EffectRenderer key={id} username={username} effect={effect} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function EffectRenderer({ username, effect }: { username: string, effect: EffectConfig }) {
  // Map rarity to colors
  const getRarityStyles = (rarity: string) => {
    switch (rarity) {
      case 'Common': return 'border-zinc-500/50 shadow-[0_0_30px_rgba(113,113,122,0.4)]';
      case 'Uncommon': return 'border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.4)]';
      case 'Rare': return 'border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.4)]';
      case 'Epic': return 'border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.4)]';
      case 'Legendary': return 'border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.4)]';
      default: return 'border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.4)]';
    }
  };

  const getRarityTextColor = (rarity: string) => {
    switch (rarity) {
      case 'Common': return 'text-zinc-300';
      case 'Uncommon': return 'text-green-300';
      case 'Rare': return 'text-blue-300';
      case 'Epic': return 'text-purple-300';
      case 'Legendary': return 'text-yellow-300';
      default: return 'text-purple-300';
    }
  };

  const rarityStyle = getRarityStyles(effect.rarity);
  const textColor = getRarityTextColor(effect.rarity);

  return (
    <motion.div
        initial={{ opacity: 0, scale: 0.5, y: 100 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1.5, filter: 'blur(10px)' }}
        transition={{ type: 'spring', damping: 15 }}
        className={`absolute bottom-32 left-8 flex items-center gap-4 bg-black/60 p-4 rounded-xl backdrop-blur-md border ${rarityStyle}`}
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
            <span className={`${textColor} text-sm font-medium uppercase tracking-wider`}>
                {effect.name}
            </span>
        </div>
        
        {/* Particle effects could go here */}
        <div className={`absolute inset-0 border-2 rounded-xl animate-pulse ${rarityStyle.split(' ')[0].replace('/50', '/30')}`} />
    </motion.div>
  );
}
