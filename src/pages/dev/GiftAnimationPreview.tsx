/**
 * Gift Animation Preview - Dev Page
 * 
 * Preview all gift animations with different animation styles.
 * Choose which animation type looks best for each gift.
 * 
 * Route: /dev/gift-animations
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { OFFICIAL_GIFTS, GiftItem } from '../../lib/giftConstants';
import { createPortal } from 'react-dom';
import './gift-animations.css';

type AnimationStyle = 'burst' | 'float' | 'spiral' | 'explosion' | 'rain' | 'spotlight' | 'shatter' | 'morph' | 'stomp' | 'glitch';

const ANIMATION_STYLES: { id: AnimationStyle; label: string; desc: string }[] = [
  { id: 'burst', label: 'Burst', desc: 'Explodes outward from center' },
  { id: 'float', label: 'Float Up', desc: 'Rises and floats with particles' },
  { id: 'spiral', label: 'Spiral', desc: 'Spins in a spiral pattern' },
  { id: 'explosion', label: 'Explosion', desc: 'Screen-shaking impact' },
  { id: 'rain', label: 'Rain', desc: 'Falls from above like rain' },
  { id: 'spotlight', label: 'Spotlight', desc: 'Beam of light with reveal' },
  { id: 'shatter', label: 'Shatter', desc: 'Glass shatter effect' },
  { id: 'morph', label: 'Morph', desc: 'Morphs and transforms' },
  { id: 'stomp', label: 'Stomp', desc: 'Heavy impact with shockwave' },
  { id: 'glitch', label: 'Glitch', desc: 'Digital glitch effect' },
];

function getDuration(cost: number): number {
  if (cost >= 1500) return 8;
  if (cost >= 500) return 6;
  return 3;
}

function getTierColor(tier: string): string {
  switch (tier) {
    case 'I': return '#00e5ff';
    case 'II': return '#a855f7';
    case 'III': return '#f59e0b';
    case 'IV': return '#ff3b5c';
    case 'V': return '#ffd700';
    default: return '#00e5ff';
  }
}

function getTierBg(tier: string): string {
  switch (tier) {
    case 'I': return 'rgba(0,229,255,0.08)';
    case 'II': return 'rgba(168,85,247,0.08)';
    case 'III': return 'rgba(245,158,11,0.08)';
    case 'IV': return 'rgba(255,59,92,0.08)';
    case 'V': return 'rgba(255,215,0,0.08)';
    default: return 'rgba(0,229,255,0.08)';
  }
}

// Animation overlay component
function GiftAnimationOverlay({
  gift,
  style,
  duration,
  onComplete,
}: {
  gift: GiftItem;
  style: AnimationStyle;
  duration: number;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<'enter' | 'active' | 'exit'>('enter');
  const particleCount = gift.cost >= 1500 ? 40 : gift.cost >= 500 ? 25 : 15;

  useEffect(() => {
    const enterTimer = setTimeout(() => setPhase('active'), 100);
    const exitTimer = setTimeout(() => setPhase('exit'), (duration - 0.5) * 1000);
    const completeTimer = setTimeout(onComplete, duration * 1000);
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  const color = getTierColor(gift.tier);

  const renderParticles = () => {
    return Array.from({ length: particleCount }).map((_, i) => {
      const angle = (360 / particleCount) * i;
      const delay = (i / particleCount) * 0.3;
      const size = 4 + Math.random() * 8;
      return (
        <div
          key={i}
          className={`ga-particle ga-particle-${style}`}
          style={{
            '--angle': `${angle}deg`,
            '--delay': `${delay}s`,
            '--size': `${size}px`,
            '--color': color,
            animationDuration: `${duration * 0.7}s`,
            animationDelay: `${delay}s`,
          } as React.CSSProperties}
        />
      );
    });
  };

  const renderEmojis = () => {
    const count = Math.min(gift.cost >= 1500 ? 8 : gift.cost >= 500 ? 5 : 3, 10);
    return Array.from({ length: count }).map((_, i) => {
      const delay = i * 0.15;
      const x = 20 + Math.random() * 60;
      const y = 20 + Math.random() * 60;
      return (
        <div
          key={`emoji-${i}`}
          className={`ga-emoji ga-emoji-${style}`}
          style={{
            '--x': `${x}%`,
            '--y': `${y}%`,
            '--delay': `${delay}s`,
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`,
            fontSize: gift.cost >= 1500 ? '64px' : gift.cost >= 500 ? '48px' : '36px',
          } as React.CSSProperties}
        >
          {gift.icon}
        </div>
      );
    });
  };

  return createPortal(
    <div className={`ga-overlay ga-${phase}`} style={{ '--duration': `${duration}s`, '--color': color } as React.CSSProperties}>
      {/* Background effect */}
      <div className={`ga-bg ga-bg-${style}`}>
        {style === 'spotlight' && <div className="ga-spotlight-beam" />}
        {style === 'rain' && Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="ga-raindrop" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 2}s`, animationDuration: `${0.5 + Math.random() * 1}s` }} />
        ))}
        {style === 'glitch' && <div className="ga-glitch-lines" />}
        {style === 'stomp' && <div className="ga-shockwave" />}
      </div>

      {/* Particles */}
      <div className="ga-particles">{renderParticles()}</div>

      {/* Gift emojis */}
      <div className="ga-emojis">{renderEmojis()}</div>

      {/* Center gift display */}
      <div className={`ga-center ga-center-${style}`}>
        <div className="ga-gift-icon">{gift.icon}</div>
        <div className="ga-gift-name">{gift.name}</div>
        <div className="ga-gift-cost" style={{ color }}>
          {gift.cost.toLocaleString()} coins
        </div>
        <div className="ga-gift-duration">
          {duration}s • Tier {gift.tier}
        </div>
      </div>

      {/* Tier indicator bar */}
      <div className="ga-tier-bar" style={{ background: color }} />
    </div>,
    document.body
  );
}

// Tier sections
const TIERS = ['I', 'II', 'III', 'IV', 'V'] as const;

export default function GiftAnimationPreview() {
  const [activeAnimation, setActiveAnimation] = useState<{
    gift: GiftItem;
    style: AnimationStyle;
  } | null>(null);
  const [selectedStyles, setSelectedStyles] = useState<Record<string, AnimationStyle>>({});
  const [autoPlay, setAutoPlay] = useState(false);
  const autoPlayRef = useRef(false);

  const playAnimation = useCallback((gift: GiftItem, style: AnimationStyle) => {
    setActiveAnimation({ gift, style });
  }, []);

  const handleComplete = useCallback(() => {
    setActiveAnimation(null);
  }, []);

  const getStyle = useCallback((giftId: string): AnimationStyle => {
    return selectedStyles[giftId] || 'burst';
  }, [selectedStyles]);

  const setStyle = useCallback((giftId: string, style: AnimationStyle) => {
    setSelectedStyles(prev => ({ ...prev, [giftId]: style }));
  }, []);

  // Auto-play all gifts
  const playAll = useCallback(() => {
    let idx = 0;
    const playNext = () => {
      if (idx >= OFFICIAL_GIFTS.length || !autoPlayRef.current) {
        setAutoPlay(false);
        autoPlayRef.current = false;
        return;
      }
      const gift = OFFICIAL_GIFTS[idx];
      const style = getStyle(gift.id);
      setActiveAnimation({ gift, style });
      idx++;
      const duration = getDuration(gift.cost);
      setTimeout(playNext, (duration + 0.3) * 1000);
    };
    autoPlayRef.current = true;
    setAutoPlay(true);
    playNext();
  }, [getStyle]);

  const stopAutoPlay = useCallback(() => {
    autoPlayRef.current = false;
    setAutoPlay(false);
    setActiveAnimation(null);
  }, []);

  // Play all in a tier
  const playTier = useCallback((tier: string) => {
    const tierGifts = OFFICIAL_GIFTS.filter(g => g.tier === tier);
    let idx = 0;
    const playNext = () => {
      if (idx >= tierGifts.length) return;
      const gift = tierGifts[idx];
      const style = getStyle(gift.id);
      setActiveAnimation({ gift, style });
      idx++;
      setTimeout(playNext, (getDuration(gift.cost) + 0.3) * 1000);
    };
    playNext();
  }, [getStyle]);

  return (
    <div className="min-h-screen bg-[#080c14] text-white p-6 lg:p-8">
      {/* Active animation */}
      {activeAnimation && (
        <GiftAnimationOverlay
          key={`${activeAnimation.gift.id}-${Date.now()}`}
          gift={activeAnimation.gift}
          style={activeAnimation.style}
          duration={getDuration(activeAnimation.gift.cost)}
          onComplete={handleComplete}
        />
      )}

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-cyan-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
          Gift Animation Preview
        </h1>
        <p className="text-sm text-gray-400 mt-2">
          {OFFICIAL_GIFTS.length} gifts across {TIERS.length} tiers. Click a style button to preview.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {autoPlay ? (
            <button onClick={stopAutoPlay} className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-500">
              Stop Auto-Play
            </button>
          ) : (
            <button onClick={playAll} className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold hover:brightness-110">
              Play All Gifts
            </button>
          )}
          {TIERS.map(tier => (
            <button
              key={tier}
              onClick={() => playTier(tier)}
              className="px-3 py-2 rounded-lg text-sm font-semibold hover:brightness-110"
              style={{ background: getTierBg(tier), border: `1px solid ${getTierColor(tier)}40`, color: getTierColor(tier) }}
            >
              Play Tier {tier}
            </button>
          ))}
        </div>
      </header>

      {/* Duration legend */}
      <div className="mb-6 flex flex-wrap gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-cyan-400" /> &lt;200 coins = 3s</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-400" /> 200-500 = 3s</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400" /> &gt;500 = 6s</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" /> &gt;1500 = 8s</span>
      </div>

      {/* Animation style selector */}
      <div className="mb-6 p-4 rounded-xl bg-[#0f1628] border border-[#1e2d4a]">
        <h2 className="text-sm font-bold text-gray-300 mb-3">Animation Styles (click to set for selected gift)</h2>
        <div className="flex flex-wrap gap-2">
          {ANIMATION_STYLES.map(s => (
            <div key={s.id} className="px-3 py-1.5 rounded-lg bg-[#131c30] border border-[#1e2d4a] text-xs">
              <span className="font-bold text-cyan-400">{s.label}</span>
              <span className="text-gray-500 ml-1">— {s.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gift tiers */}
      {TIERS.map(tier => {
        const tierGifts = OFFICIAL_GIFTS.filter(g => g.tier === tier);
        if (tierGifts.length === 0) return null;
        const color = getTierColor(tier);
        return (
          <section key={tier} className="mb-8">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color }}>
              Tier {tier}
              <span className="text-xs font-normal text-gray-500">
                {tierGifts[0]?.cost?.toLocaleString()} coins • {getDuration(tierGifts[0]?.cost)}s duration
              </span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tierGifts.map(gift => {
                const currentStyle = getStyle(gift.id);
                const duration = getDuration(gift.cost);
                return (
                  <div
                    key={gift.id}
                    className="group rounded-xl border border-[#1e2d4a] bg-[#0f1628] p-4 hover:border-cyan-500/50 transition-all"
                    style={{ borderColor: activeAnimation?.gift.id === gift.id ? color : undefined }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-4xl">{gift.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{gift.name}</div>
                        <div className="text-xs text-gray-500">
                          {gift.cost.toLocaleString()} coins • {duration}s • {currentStyle}
                        </div>
                      </div>
                    </div>

                    {/* Style buttons */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {ANIMATION_STYLES.slice(0, 5).map(s => (
                        <button
                          key={s.id}
                          onClick={() => setStyle(gift.id, s.id)}
                          className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
                            currentStyle === s.id
                              ? 'bg-cyan-500 text-black'
                              : 'bg-[#131c30] text-gray-400 hover:text-white hover:bg-[#1e2d4a]'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {ANIMATION_STYLES.slice(5).map(s => (
                        <button
                          key={s.id}
                          onClick={() => setStyle(gift.id, s.id)}
                          className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
                            currentStyle === s.id
                              ? 'bg-cyan-500 text-black'
                              : 'bg-[#131c30] text-gray-400 hover:text-white hover:bg-[#1e2d4a]'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>

                    {/* Play button */}
                    <button
                      onClick={() => playAnimation(gift, currentStyle)}
                      className="w-full py-2 rounded-lg text-xs font-bold transition hover:brightness-110"
                      style={{ background: `${color}20`, border: `1px solid ${color}40`, color }}
                    >
                      ▶ Preview {currentStyle} ({duration}s)
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Summary */}
      <footer className="mt-8 p-4 rounded-xl bg-[#0f1628] border border-[#1e2d4a]">
        <h3 className="font-bold text-sm mb-2 text-gray-300">Selection Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
          {TIERS.map(tier => {
            const tierGifts = OFFICIAL_GIFTS.filter(g => g.tier === tier);
            return (
              <div key={tier} className="p-2 rounded-lg" style={{ background: getTierBg(tier) }}>
                <div className="font-bold" style={{ color: getTierColor(tier) }}>Tier {tier}</div>
                {tierGifts.map(g => (
                  <div key={g.id} className="text-gray-400 mt-1">
                    {g.icon} {g.name}: <span className="text-white">{getStyle(g.id)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </footer>
    </div>
  );
}
