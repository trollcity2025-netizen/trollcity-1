import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Gift, Zap } from 'lucide-react';
import { getGlowingTextStyle } from '../lib/perkEffects';
import { useAnimationStore, type GiftType } from '../lib/animationManager';

// Map gift names to gift types
const mapGiftNameToType = (giftName: string): GiftType => {
  const name = giftName.toLowerCase();
  if (name.includes('rose')) return 'rose';
  if (name.includes('heart')) return 'heart';
  if (name.includes('diamond')) return 'diamond';
  if (name.includes('crown')) return 'crown';
  if (name.includes('car')) return 'car';
  if (name.includes('house')) return 'house';
  if (name.includes('rocket')) return 'rocket';
  if (name.includes('dragon')) return 'dragon';
  return 'heart'; // Default
};

interface GiftEvent {
  id: string;
  senderId: string;
  receiverId: string;
  senderName?: string;
  senderGlowingColor?: string;
  receiverName?: string;
  receiverGlowingColor?: string;
  giftName: string;
  amount: number;
  timestamp: number;
}

const DISPLAY_DURATION = 8000;

export default function GlobalGiftBanner() {
  const [currentEvent, setCurrentEvent] = useState<GiftEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const playGiftAnimation = useAnimationStore((state) => state.playGiftAnimation);
  const playCoinExplosion = useAnimationStore((state) => state.playCoinExplosion);

  useEffect(() => {
    // Subscribe to global-gifts broadcast channel
    const channel = supabase
      .channel('global-gifts')
      .on(
        'broadcast',
        { event: 'huge_gift' },
        (payload) => {
          const eventData = payload.payload as GiftEvent;
          setCurrentEvent(eventData);
          setIsVisible(true);
          
          // Trigger the new animation system
          // Map gift name to gift type
          const giftType = mapGiftNameToType(eventData.giftName);
          playGiftAnimation({
            type: giftType,
            senderName: eventData.senderName || 'Someone',
            senderAvatar: undefined,
            receiverName: eventData.receiverName || 'Someone',
            amount: eventData.amount,
          });
          
          // Also trigger coin explosion for large gifts
          if (eventData.amount >= 1000) {
            playCoinExplosion({
              amount: eventData.amount,
              position: { x: 50, y: 50 },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, DISPLAY_DURATION);
      return () => clearTimeout(timer);
    }
  }, [isVisible, currentEvent]);

  if (!isVisible || !currentEvent) return null;

  return (
    <div className="fixed top-20 right-4 z-[100] animate-slide-in-right">
      <div className="bg-gradient-to-r from-purple-900/90 to-pink-900/90 border-2 border-yellow-400/50 rounded-xl p-4 shadow-[0_0_30px_rgba(168,85,247,0.5)] backdrop-blur-md max-w-md w-full relative overflow-hidden">
        {/* Animated background effect */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <div className="absolute -inset-full top-0 block h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 animate-shine" />

        <div className="relative z-10 flex items-center gap-4">
          <div className="bg-yellow-500/20 p-3 rounded-full animate-bounce">
            <Gift className="w-8 h-8 text-yellow-300" />
          </div>
          
          <div className="flex-1">
            <h4 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-300 text-lg uppercase italic tracking-wider">
              HUGE GIFT ALERT!
            </h4>
            <div className="text-white font-bold text-sm mt-1">
              <span 
                className={currentEvent.senderGlowingColor ? 'font-bold' : 'text-yellow-300'}
                style={getGlowingTextStyle(currentEvent.senderGlowingColor)}
              >
                {currentEvent.senderName}
              </span> sent 
              <span className="text-pink-300 mx-1">{currentEvent.giftName}</span>
              to <span 
                className={currentEvent.receiverGlowingColor ? 'font-bold' : 'text-yellow-300'}
                style={getGlowingTextStyle(currentEvent.receiverGlowingColor)}
              >
                {currentEvent.receiverName}
              </span>!
            </div>
            <div className="text-xs text-yellow-400/80 mt-1 font-mono flex items-center gap-1">
              <Zap size={12} />
              {currentEvent.amount} Coins
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
