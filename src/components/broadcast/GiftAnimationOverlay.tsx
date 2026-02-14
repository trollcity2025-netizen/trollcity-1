import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Gift as GiftIcon, Star, Sparkles } from 'lucide-react';
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
  const animationBufferRef = useRef<GiftEvent[]>([]);
  const { refreshCoins } = useCoins();

  // Load gift definitions to map IDs to visuals
  const [giftDefs, setGiftDefs] = useState<Record<string, Gift>>({});

  useEffect(() => {
    const loadGifts = async () => {
      // TRAE: Updated to use centralized purchasable_items table
      const { data } = await supabase
        .from('purchasable_items')
        .select('*')
        .eq('category', 'gift');
        
      if (data) {
        const map: Record<string, Gift> = {};
        data.forEach((g) => {
             // Map purchasable_item to Gift interface
             map[g.item_key] = {
                 id: g.id,
                 name: g.display_name,
                 icon_url: g.metadata?.icon || '🎁',
                 coin_price: g.coin_price,
                 animation_type: g.metadata?.animationType || 'standard'
             } as any;
        });
        setGiftDefs(map);
      }
    };
    loadGifts();
  }, []);

  useEffect(() => {
    // High-Frequency Animation Buffer: Flush every 150ms
    const flushInterval = setInterval(() => {
      if (animationBufferRef.current.length === 0) return;
      
      const newAnims = [...animationBufferRef.current];
      animationBufferRef.current = [];
      
      setActiveAnimations(prev => {
        const next = [...prev, ...newAnims];
        // Limit to 5 simultaneous animations to prevent DOM overload
        return next.slice(-5);
      });

      // Schedule removal for these specific animations
      newAnims.forEach(anim => {
        setTimeout(() => {
          setActiveAnimations(prev => prev.filter(a => a.id !== anim.id));
        }, 4000);
      });
    }, 150);

    // Listen for Realtime Broadcast Events (Faster, matches useGiftSystem)
    const channel = supabase.channel(`stream_events_${streamId}`)
      .on(
        'broadcast',
        { event: 'gift_sent' },
        (payload) => {
          const event = payload.payload;
          
          const giftDef = giftDefs[event.gift_slug] || giftDefs[event.gift_id] || { 
            name: event.gift_name, 
            icon_url: null,
            coin_price: event.amount
          };

          // Play Sound (Throttle sounds too?)
          const playGiftSound = (name: string) => {
              const lower = name.toLowerCase();
              let src = '/sounds/entrance/coins.mp3';
              
              if (lower.includes('rose')) src = '/sounds/rose.mp3';
              else if (lower.includes('diamond')) src = '/sounds/diamond.mp3';
              else if (lower.includes('heart')) src = '/sounds/heart.mp3';
              else if (lower.includes('rocket')) src = '/sounds/rocket.mp3';
              else if (lower.includes('confetti')) src = '/sounds/confetti.mp3';
              else if (lower.includes('crown')) src = '/sounds/crown.mp3';
              else if (lower.includes('bear')) src = '/sounds/bear.mp3';
              
              const audio = new Audio(src);
              audio.volume = 0.5;
              audio.play().catch(e => console.warn('Sound play blocked', e));
          };
          
          playGiftSound(giftDef.name || 'Gift');

          const animationEvent: GiftEvent = {
            id: event.id || Math.random().toString(36).substring(7),
            gift_id: event.gift_id,
            sender_id: event.sender_id,
            recipient_id: event.receiver_id || streamId,
            gift_data: giftDef as any
          };

          animationBufferRef.current.push(animationEvent);
        }
      )
      .subscribe();

    return () => {
      clearInterval(flushInterval);
      supabase.removeChannel(channel);
    };
  }, [streamId, giftDefs, refreshCoins]);

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
          {event.gift_data?.icon_url && (event.gift_data.icon_url.startsWith('http') || event.gift_data.icon_url.startsWith('/')) ? (
            <img src={event.gift_data.icon_url} alt="Gift" className="w-24 h-24 object-contain drop-shadow-lg" />
          ) : event.gift_data?.icon_url ? (
            <span className="text-6xl drop-shadow-lg filter">{event.gift_data.icon_url}</span>
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
          transition={{ delay: 0.2 }}
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
