import React, { useEffect, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { GiftInstance, GiftCatalogItem, GiftTransaction } from '@/types/gifts';
import { useGiftStore } from '@/lib/stores/useGiftStore';
import GiftModel from './GiftModel';
import { supabase } from '@/lib/supabase';

interface GlobalGiftRendererProps {
  position?: 'center' | 'bottom-right' | 'top-center';
}

// Calculate random position based on gift index
const getGiftPosition = (index: number, total: number): { x: number; y: number; z: number } => {
  const spread = 2;
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;
  return {
    x: Math.sin(angle) * spread * (0.3 + Math.random() * 0.7),
    y: 1 + Math.random() * 2,
    z: -2 + Math.random(),
  };
};

// Loading fallback
const LoadingGift: React.FC = () => (
  <div className="flex items-center justify-center w-20 h-20">
    <div className="w-10 h-10 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
  </div>
);

// Individual gift display with sender info
const GiftDisplay: React.FC<{ gift: GiftInstance; index: number }> = ({ gift, index }) => {
  const position = getGiftPosition(index, 1);
  
  return (
    <group position={[position.x, position.y, position.z]}>
      <GiftModel gift={{ ...gift, position }} />
      
      {/* Sender name overlay */}
      <div 
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap"
        style={{ 
          textShadow: '0 0 10px rgba(0,0,0,0.8)',
        }}
      >
        <span className="text-xs font-bold text-white bg-black/50 px-2 py-1 rounded">
          🎁 {gift.senderName}
        </span>
      </div>
    </group>
  );
};

// Scene setup
const GiftScene: React.FC<{ gifts: GiftInstance[] }> = ({ gifts }) => {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[-5, 5, -5]} intensity={0.5} color="#ffd700" />
      
      {/* Environment for reflections */}
      <Environment preset="sunset" />
      
      {/* Render each gift */}
      {gifts.map((gift, index) => (
        <GiftDisplay key={gift.id} gift={gift} index={index} />
      ))}
    </>
  );
};

// Main Global Gift Renderer
export const GlobalGiftRenderer: React.FC<GlobalGiftRendererProps> = ({
  position = 'center'
}) => {
  const { activeGifts, triggerGift, setGiftCatalog } = useGiftStore();
  const [isClient, setIsClient] = useState(false);
  
  // Set client-side only
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Fetch gift catalog on mount
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const { data } = await supabase
          .from('gifts_catalog')
          .select('*')
          .eq('is_active', true)
          .order('price', { ascending: true });
        
        if (data) {
          setGiftCatalog(data as GiftCatalogItem[]);
        }
      } catch (err) {
        console.error('Error fetching gift catalog:', err);
      }
    };
    
    fetchCatalog();
  }, [setGiftCatalog]);
  
  // Subscribe to realtime gift events
  useEffect(() => {
    const channel = supabase
      .channel('gift-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gift_transactions',
        },
        async (payload) => {
          const transaction = payload.new as GiftTransaction;
          
          // Get gift details from catalog
          const catalog = useGiftStore.getState().giftCatalog;
          const giftItem = catalog.find(g => g.id === transaction.gift_id);
          
          if (!giftItem) {
            console.warn('Gift not found in catalog:', transaction.gift_id);
            return;
          }
          
          // Get sender info (we'd need to fetch this in production)
          // For now, use a placeholder
          const senderName = 'Someone';
          
          // Trigger the gift animation
          triggerGift({
            giftId: transaction.gift_id,
            gift: giftItem,
            senderId: transaction.sender_id,
            senderName,
            receiverId: transaction.receiver_id,
            sessionId: transaction.session_id || undefined,
            position: getGiftPosition(0, 1),
            animationType: giftItem.animation_type,
            duration: giftItem.duration,
            rarity: giftItem.rarity,
          });
          
          // Play sound effect (optional)
          // audioManager.playSound('/sounds/gift-received.mp3');
          
          // Haptic feedback on mobile
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [triggerGift]);
  
  // Position styles
  const positionStyles = {
    center: 'inset-0',
    'bottom-right': 'inset-0',
    'top-center': 'inset-0',
  };
  
  // Don't render on server
  if (!isClient) {
    return null;
  }
  
  if (activeGifts.length === 0) {
    return null;
  }
  
  return (
    <div 
      className={`fixed pointer-events-none z-[9999] ${positionStyles[position]}`}
      style={{ 
        perspective: '1000px',
      }}
    >
      {/* Gift name banner */}
      {activeGifts.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[10000]">
          <div className="bg-gradient-to-r from-yellow-600/80 via-amber-500/80 to-yellow-600/80 px-6 py-2 rounded-full animate-pulse">
            <span className="text-white font-bold text-sm">
              🎁 {activeGifts[0]?.gift?.name} received!
            </span>
          </div>
        </div>
      )}
      
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 2, 6], fov: 50 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <Suspense fallback={null}>
          <GiftScene gifts={activeGifts} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default GlobalGiftRenderer;
