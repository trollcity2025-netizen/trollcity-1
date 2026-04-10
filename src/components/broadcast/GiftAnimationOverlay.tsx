import React, { useEffect, useState, useCallback, useRef } from 'react';

import { BroadcastGift } from '../../hooks/useBroadcastRealtime';
import { OFFICIAL_GIFTS } from '../../lib/giftConstants';

interface GiftAnimationOverlayProps {
  gifts?: BroadcastGift[];
  onAnimationComplete?: (giftId: string) => void;
  participantNames?: Record<string, string>;
}

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
  participantNames = {},
}: GiftAnimationOverlayProps) {
  const [visibleGift, setVisibleGift] = useState<BroadcastGift | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!gifts || gifts.length === 0) {
      setVisibleGift(null);
      return;
    }

    const latestGift = gifts[gifts.length - 1];
    setVisibleGift(latestGift);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisibleGift(null);
      onAnimationComplete?.(latestGift.id);
    }, 2500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [gifts, onAnimationComplete]);

  if (!visibleGift) return null;

  const senderName = participantNames[visibleGift.sender_id] || 'Someone';
  const giftDetails = getGiftDetails(visibleGift);
  const formattedCost = giftDetails.cost.toLocaleString();

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-down duration-300">
      <div className="bg-gradient-to-r from-amber-500/90 to-yellow-400/90 text-black px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
        <span className="text-xl">{giftDetails.icon}</span>
        <span className="font-bold text-sm">
          {senderName}
        </span>
        <span className="text-xs">sent</span>
        <span className="font-bold text-sm">
          {giftDetails.name}
        </span>
        <span className="text-xs bg-black/20 px-1.5 py-0.5 rounded">
          {formattedCost}
        </span>
      </div>
    </div>
  );
}