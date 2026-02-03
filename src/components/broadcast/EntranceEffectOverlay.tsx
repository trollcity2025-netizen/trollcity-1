import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface EntranceEffectOverlayProps {
  effectId: string;
  username: string;
  avatarUrl?: string;
  onComplete: () => void;
}

export default function EntranceEffectOverlay({ effectId, username, avatarUrl, onComplete }: EntranceEffectOverlayProps) {
  const [effectData, setEffectData] = useState<any>(null);

  useEffect(() => {
    const fetchEffect = async () => {
      const { data } = await supabase
        .from('entrance_effects')
        .select('*')
        .eq('id', effectId)
        .single();
      
      if (data) {
        setEffectData(data);
        // Play sound if available
        if (data.sound_effect) {
          const audio = new Audio(data.sound_effect);
          audio.volume = 0.5;
          audio.play().catch(e => console.error("Audio play failed", e));
        }
      } else {
        // Fallback or error
        onComplete();
      }
    };
    fetchEffect();
  }, [effectId]);

  useEffect(() => {
    if (effectData) {
      const timer = setTimeout(() => {
        onComplete();
      }, (effectData.duration_seconds || 5) * 1000);
      return () => clearTimeout(timer);
    }
  }, [effectData, onComplete]);

  if (!effectData) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
      >
        {/* Effect Visuals */}
        <div className="relative flex flex-col items-center">
            {effectData.image_url && (
                <motion.img 
                    src={effectData.image_url} 
                    alt={effectData.name}
                    className="w-64 h-64 object-contain mb-4 drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]"
                    initial={{ y: 50 }}
                    animate={{ y: 0 }}
                />
            )}
            <motion.div 
                className="bg-black/80 backdrop-blur-md border border-purple-500/50 px-8 py-4 rounded-2xl text-center shadow-[0_0_50px_rgba(168,85,247,0.3)]"
                initial={{ y: 20 }}
                animate={{ y: 0 }}
            >
                <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
                    {username}
                </h2>
                <p className="text-purple-200 text-sm font-medium mt-1 tracking-wider uppercase">
                    Has Arrived!
                </p>
            </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
