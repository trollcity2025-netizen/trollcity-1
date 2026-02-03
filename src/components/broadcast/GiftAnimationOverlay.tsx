import React, { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Gift as GiftIcon, Coins, Star, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Gift } from '../../types/broadcast';
import { useCoins } from '../../lib/hooks/useCoins';

interface GiftAnimationOverlayProps {
  streamId: string;
}

interface GiftEvent {
  id: string;
  gift_id: string;
  sender_id: string;
  recipient_id: string;
  gift_data?: Gift; // Enriched data
}

export default function GiftAnimationOverlay({ streamId }: GiftAnimationOverlayProps) {
  const [activeAnimations, setActiveAnimations] = useState<GiftEvent[]>([]);
  const { refreshBalance } = useCoins();

  // Load gift definitions to map IDs to visuals
  const [giftDefs, setGiftDefs] = useState<Record<string, Gift>>({});

  useEffect(() => {
    const loadGifts = async () => {
      const { data } = await supabase.from('gifts').select('*');
      if (data) {
        const map: Record<string, Gift> = {};
        data.forEach((g) => (map[g.id] = g));
        setGiftDefs(map);
      }
    };
    loadGifts();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`stream-gifts-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_gifts',
          filter: `stream_id=eq.${streamId}`,
        },
        async (payload) => {
          const newGift = payload.new as any;
          
          // Refresh coin balance if we are the sender or recipient
          refreshBalance();

          // Add to animation queue
          const giftDef = giftDefs[newGift.gift_id];
          const animationEvent: GiftEvent = {
            id: Math.random().toString(36).substring(7),
            gift_id: newGift.gift_id,
            sender_id: newGift.sender_id,
            recipient_id: newGift.recipient_id,
            gift_data: giftDef
          };

          setActiveAnimations((prev) => [...prev, animationEvent]);

          // Auto remove after 4 seconds
          setTimeout(() => {
            setActiveAnimations((prev) => prev.filter((a) => a.id !== animationEvent.id));
          }, 4000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, giftDefs, refreshBalance]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      <AnimatePresence>
        {activeAnimations.map((anim, index) => (
          <GiftAnimationItem key={anim.id} event={anim} index={index} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function GiftAnimationItem({ event, index }: { event: GiftEvent; index: number }) {
  // Randomize start position slightly
  const randomX = Math.random() * 20 - 10; // -10% to 10%

  return (
    <motion.div
      initial={{ opacity: 0, y: 100, scale: 0.5 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -200, scale: 1.5 }}
      transition={{ duration: 0.8, type: 'spring' }}
      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center"
      style={{ 
        marginLeft: `${randomX}%`, 
        marginTop: `${index * -20}px` // Stack slightly if multiple
      }}
    >
      <div className="relative">
        {/* Glowing background effect */}
        <div className="absolute inset-0 bg-amber-500/30 blur-3xl rounded-full animate-pulse" />
        
        {/* Main Gift Visual */}
        <div className="relative bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-600 p-6 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.6)] border-4 border-yellow-200/50 flex flex-col items-center">
          {event.gift_data?.icon_url ? (
            <img src={event.gift_data.icon_url} alt="Gift" className="w-24 h-24 object-contain drop-shadow-lg" />
          ) : (
            <GiftIcon size={64} className="text-white drop-shadow-md" />
          )}
          
          <div className="absolute -top-4 -right-4 bg-red-500 text-white font-black text-xl px-3 py-1 rounded-full shadow-lg border-2 border-white transform rotate-12">
            GIFT!
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          delay={0.2}
          className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-xl"
        >
          <div className="text-yellow-400 font-bold text-lg flex items-center gap-2 justify-center">
            <Star size={18} className="fill-yellow-400" />
            {event.gift_data?.name || 'Mystery Gift'}
          </div>
          <div className="text-white/80 text-sm mt-1">
            Sent by <span className="font-semibold text-white">User {event.sender_id.substring(0, 5)}...</span>
          </div>
        </motion.div>
      </div>
      
      {/* Particles */}
      <ParticleEffect />
    </motion.div>
  );
}

function ParticleEffect() {
  return (
    <div className="absolute inset-0 pointer-events-none">
       {[...Array(8)].map((_, i) => (
         <motion.div
            key={i}
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={{ 
              opacity: [0, 1, 0],
              x: (Math.random() - 0.5) * 200,
              y: (Math.random() - 0.5) * 200,
              scale: Math.random() * 0.5 + 0.5
            }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 text-yellow-300"
         >
           <Sparkles size={Math.random() * 20 + 10} />
         </motion.div>
       ))}
    </div>
  );
}
