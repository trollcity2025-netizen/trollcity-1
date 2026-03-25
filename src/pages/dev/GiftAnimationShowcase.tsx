/**
 * Gift Animation & Display Design Showcase
 * 
 * This page showcases all gift animations for dev preview.
 * Access: /dev/gift-animation-showcase
 */

import React, { useMemo, useEffect, useState } from 'react';
import { useAnimationStore } from '../../lib/animationManager';
import { GiftAnimationData } from '../../lib/animationManager';
import { GiftAnimationsContainer } from '../../components/animations';
import { Sparkles, Zap, Crown, Star, Coffee, Pizza, Gift } from 'lucide-react';

type DevGiftType = 'rose' | 'heart' | 'diamond' | 'crown' | 'star' | 'trophy' | 'coffee' | 'pizza' | 'car' | 'house' | 'rocket' | 'dragon';

const ALL_GIFTS: Array<{ type: DevGiftType; emoji: string; label: string; cost: number; rarity: string }> = [
  { type: 'rose', emoji: '🌹', label: 'Rose', cost: 10, rarity: 'common' },
  { type: 'heart', emoji: '💖', label: 'Heart', cost: 25, rarity: 'uncommon' },
  { type: 'star', emoji: '⭐', label: 'Star', cost: 50, rarity: 'uncommon' },
  { type: 'crown', emoji: '👑', label: 'Crown', cost: 100, rarity: 'rare' },
  { type: 'diamond', emoji: '💎', label: 'Diamond', cost: 200, rarity: 'rare' },
  { type: 'trophy', emoji: '🏆', label: 'Trophy', cost: 500, rarity: 'epic' },
  { type: 'coffee', emoji: '☕', label: 'Coffee', cost: 15, rarity: 'common' },
  { type: 'pizza', emoji: '🍕', label: 'Pizza', cost: 30, rarity: 'uncommon' },
  { type: 'car', emoji: '🚗', label: 'Car', cost: 1000, rarity: 'epic' },
  { type: 'house', emoji: '🏠', label: 'House', cost: 2500, rarity: 'legendary' },
  { type: 'rocket', emoji: '🚀', label: 'Rocket', cost: 5000, rarity: 'legendary' },
  { type: 'dragon', emoji: '🐉', label: 'Dragon', cost: 10000, rarity: 'mythic' },
];

const makeAnimationData = (item: typeof ALL_GIFTS[number], index: number): Omit<GiftAnimationData, 'id' | 'timestamp'> => ({
  type: item.type,
  senderName: 'DevUser',
  receiverName: 'TestBroadcaster',
  amount: 1 + Math.floor(index / 4),
});

export default function GiftAnimationShowcase() {
  const playGiftAnimation = useAnimationStore((state) => state.playGiftAnimation);
  const playCoinExplosion = useAnimationStore((state) => state.playCoinExplosion);
  const playDiamondRain = useAnimationStore((state) => state.playDiamondRain);

  const fireworkMode = () => {
    playCoinExplosion({ amount: 500, position: { x: 50, y: 50 } });
    playDiamondRain({ amount: 75 });
  };

  const playAll = () => {
    ALL_GIFTS.forEach((gift, idx) => {
      window.setTimeout(() => {
        playGiftAnimation(makeAnimationData(gift, idx));
        if (gift.rarity === 'legendary' || gift.rarity === 'mythic') {
          fireworkMode();
        }
      }, idx * 220);
    });
  };

  useEffect(() => {
    // Auto-run once when page opens so devs immediately see full set
    playAll();
  }, []);

  const summary = useMemo(() => {
    const totalValue = ALL_GIFTS.reduce((sum, gift) => sum + gift.cost, 0);
    return `${ALL_GIFTS.length} gifts • total cost ${totalValue} coins`;
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 lg:p-10">
      <GiftAnimationsContainer />

      <header className="border-b border-white/15 pb-4 mb-5">
        <h1 className="text-3xl font-extrabold tracking-tight">Dev Gift Animation Preview</h1>
        <p className="text-sm text-white/70 mt-2">{summary}. Tap below to test render quality vs TikTok/BIGO style.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={playAll} className="rounded-lg bg-fuchsia-600 px-4 py-2 font-semibold text-white hover:bg-fuchsia-500">Play All Gifts</button>
          <button onClick={fireworkMode} className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-black hover:bg-amber-400">Fireworks Boost</button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ALL_GIFTS.map((gift, index) => (
          <article key={gift.type} className="group rounded-2xl border border-white/10 bg-black/40 p-4 transition hover:border-fuchsia-500/80 hover:bg-black/60">
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-label={gift.label}>{gift.emoji}</span>
              <div>
                <p className="font-extrabold text-lg">{gift.label}</p>
                <p className="text-xs text-white/70">{gift.rarity.toUpperCase()} • {gift.cost} coins</p>
              </div>
            </div>
            <button
              onClick={() => {
                playGiftAnimation(makeAnimationData(gift, index));
                if (gift.rarity === 'legendary' || gift.rarity === 'mythic') {
                  fireworkMode();
                }
              }}
              className="mt-4 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-indigo-500"
            >
              Preview animation
            </button>
          </article>
        ))}
      </section>

      <footer className="mt-8 text-sm text-white/70 flex items-center gap-2">
        <Sparkles className="w-4 h-4" />
        <span>Animations are powered by the central GiftAnimation engine and run in broadcast overlay mode.</span>
      </footer>
    </div>
  );
}
