import React, { useEffect, useState, useCallback, useRef } from 'react';

import { BroadcastGift } from '../../hooks/useBroadcastRealtime';
import { OFFICIAL_GIFTS } from '../../lib/giftConstants';
import { Gift3DOverlay } from './Gift3DAnimations';
import { getGiftDuration } from '../../lib/giftAnimationRegistry';

interface GiftAnimationOverlayProps {
  gifts?: BroadcastGift[];
  onAnimationComplete?: (giftId: string) => void;
  userPositions?: Record<string, { top: number; left: number; width: number; height: number }>;
  getUserPositions?: () => Record<string, { top: number; left: number; width: number; height: number }>;
  participantNames?: Record<string, string>;
  participantCount?: number;
}

const MAX_VISIBLE_GIFTS = 3;

const getGiftDetails = (gift: BroadcastGift): { id: string; name: string; icon: string; cost: number } => {
  let officialGift = OFFICIAL_GIFTS.find(g => g.id === gift.gift_id);
  if (!officialGift && gift.gift_slug) {
    officialGift = OFFICIAL_GIFTS.find(g =>
      g.id === gift.gift_slug ||
      g.id.toLowerCase().replace(/_/g, '-') === gift.gift_slug.toLowerCase() ||
      g.name.toLowerCase().replace(/\s+/g, '-') === gift.gift_slug.toLowerCase()
    );
  }
  if (!officialGift && gift.gift_name) {
    officialGift = OFFICIAL_GIFTS.find(g => g.name.toLowerCase() === gift.gift_name.toLowerCase());
  }
  if (officialGift) {
    return { id: officialGift.id, name: officialGift.name, icon: officialGift.icon, cost: officialGift.cost };
  }
  return {
    id: gift.gift_id || gift.gift_slug || 'unknown',
    name: gift.gift_name || 'Gift',
    icon: gift.gift_icon || '🎁',
    cost: gift.amount || 0,
  };
};

export default function GiftAnimationOverlay({
  gifts = [],
  onAnimationComplete,
}: GiftAnimationOverlayProps) {
  const [visibleGifts, setVisibleGifts] = useState<BroadcastGift[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!gifts || gifts.length === 0) {
      setVisibleGifts([]);
      return;
    }

    setVisibleGifts(prev => {
      const existingIds = new Set(prev.map(g => g.id));
      const newGifts = gifts.filter(g => !existingIds.has(g.id));
      if (newGifts.length === 0) return gifts.slice(-MAX_VISIBLE_GIFTS);
      const combined = [...prev, ...newGifts];
      return combined.slice(-MAX_VISIBLE_GIFTS);
    });
  }, [gifts]);

  useEffect(() => {
    if (visibleGifts.length === 0) {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
      return;
    }

    visibleGifts.forEach(gift => {
      if (timersRef.current.has(gift.id)) return;
      const details = getGiftDetails(gift);
      const dur = getGiftDuration(details.cost, details.name);
      const timer = setTimeout(() => {
        timersRef.current.delete(gift.id);
        setVisibleGifts(prev => {
          const remaining = prev.filter(g => g.id !== gift.id);
          if (remaining.length !== prev.length) onAnimationComplete?.(gift.id);
          return remaining;
        });
      }, (dur + 1) * 1000);
      timersRef.current.set(gift.id, timer);
    });

    return () => {
      const currentIds = new Set(visibleGifts.map(g => g.id));
      timersRef.current.forEach((timer, giftId) => {
        if (!currentIds.has(giftId)) {
          clearTimeout(timer);
          timersRef.current.delete(giftId);
        }
      });
    };
  }, [visibleGifts, onAnimationComplete]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const dismissGift = useCallback((giftId: string) => {
    const timer = timersRef.current.get(giftId);
    if (timer) { clearTimeout(timer); timersRef.current.delete(giftId); }
    setVisibleGifts(prev => {
      const remaining = prev.filter(g => g.id !== giftId);
      if (remaining.length !== prev.length) onAnimationComplete?.(giftId);
      return remaining;
    });
  }, [onAnimationComplete]);

  if (visibleGifts.length === 0) return null;

  return (
    <>
      {visibleGifts.map(gift => {
        const details = getGiftDetails(gift);
        const dur = getGiftDuration(details.cost, details.name);

        return (
          <Gift3DOverlay
            key={gift.id}
            giftName={details.name}
            giftIcon={details.icon}
            giftValue={details.cost}
            duration={dur}
            onComplete={() => dismissGift(gift.id)}
          />
        );
      })}
    </>
  );
}
