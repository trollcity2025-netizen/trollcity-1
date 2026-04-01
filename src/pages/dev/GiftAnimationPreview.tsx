/**
 * Gift Animation Preview - Dev Page
 * 
 * Preview all gift animations with different animation styles.
 * Fetches all gifts from the gift_items database table.
 * 
 * Route: /dev/gift-animations
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { createPortal } from 'react-dom';
import './gift-animations.css';

interface GiftItem {
  id: string;
  name: string;
  icon: string;
  value: number;
  category?: string;
  gift_slug?: string;
  is_active?: boolean;
}

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

function getTier(cost: number): string {
  if (cost >= 50000) return 'V';
  if (cost >= 10000) return 'IV';
  if (cost >= 2500) return 'III';
  if (cost >= 500) return 'II';
  return 'I';
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

function getTierRange(tier: string): string {
  switch (tier) {
    case 'I': return '1 - 499';
    case 'II': return '500 - 2,499';
    case 'III': return '2,500 - 9,999';
    case 'IV': return '10,000 - 49,999';
    case 'V': return '50,000+';
    default: return '';
  }
}

function formatGiftName(gift: GiftItem): string {
  return gift.name?.replace(/^gift_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Gift';
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
  const tier = getTier(gift.value);
  const particleCount = gift.value >= 1500 ? 40 : gift.value >= 500 ? 25 : 15;

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

  const color = getTierColor(tier);
  const displayName = formatGiftName(gift);
  const icon = gift.icon || '🎁';

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
    const count = Math.min(gift.value >= 1500 ? 8 : gift.value >= 500 ? 5 : 3, 10);
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
            fontSize: gift.value >= 1500 ? '64px' : gift.value >= 500 ? '48px' : '36px',
          } as React.CSSProperties}
        >
          {icon}
        </div>
      );
    });
  };

  return createPortal(
    <div className={`ga-overlay ga-${phase}`} style={{ '--duration': `${duration}s`, '--color': color } as React.CSSProperties}>
      <div className={`ga-bg ga-bg-${style}`}>
        {style === 'spotlight' && <div className="ga-spotlight-beam" />}
        {style === 'rain' && Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="ga-raindrop" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 2}s`, animationDuration: `${0.5 + Math.random() * 1}s` }} />
        ))}
        {style === 'glitch' && <div className="ga-glitch-lines" />}
        {style === 'stomp' && <div className="ga-shockwave" />}
      </div>

      <div className="ga-particles">{renderParticles()}</div>
      <div className="ga-emojis">{renderEmojis()}</div>

      <div className={`ga-center ga-center-${style}`}>
        <div className="ga-gift-icon">{icon}</div>
        <div className="ga-gift-name">{displayName}</div>
        <div className="ga-gift-cost" style={{ color }}>
          {gift.value.toLocaleString()} coins
        </div>
        <div className="ga-gift-duration">
          {duration}s • Tier {tier}
        </div>
      </div>

      <div className="ga-tier-bar" style={{ background: color }} />
    </div>,
    document.body
  );
}

const TIERS = ['I', 'II', 'III', 'IV', 'V'] as const;

export default function GiftAnimationPreview() {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAnimation, setActiveAnimation] = useState<{
    gift: GiftItem;
    style: AnimationStyle;
  } | null>(null);
  const [selectedStyles, setSelectedStyles] = useState<Record<string, AnimationStyle>>({});
  const autoPlayRef = useRef(false);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [filter, setFilter] = useState('');

  // Fetch gifts from database
  useEffect(() => {
    const fetchGifts = async () => {
      try {
        const { data, error } = await supabase
          .from('gift_items')
          .select('*')
          .order('value', { ascending: true });

        if (error) throw error;
        if (data && data.length > 0) {
          setGifts(data);
        } else {
          // Fallback to purchasable_items
          const { data: fallback } = await supabase
            .from('purchasable_items')
            .select('*')
            .eq('category', 'gift')
            .eq('is_active', true)
            .order('coin_price', { ascending: true });

          if (fallback) {
            setGifts(fallback.map((g: any) => ({
              id: g.id,
              name: g.display_name || g.item_key,
              icon: g.metadata?.icon || '🎁',
              value: g.coin_price || 0,
              category: g.metadata?.subcategory,
            })));
          }
        }
      } catch (e) {
        console.error('Failed to fetch gifts:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchGifts();
  }, []);

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
    const filtered = filter
      ? gifts.filter(g => g.name?.toLowerCase().includes(filter.toLowerCase()) || g.icon?.includes(filter))
      : gifts;
    let idx = 0;
    const playNext = () => {
      if (idx >= filtered.length || !autoPlayRef.current) {
        setAutoPlaying(false);
        autoPlayRef.current = false;
        return;
      }
      const gift = filtered[idx];
      const style = getStyle(gift.id);
      setActiveAnimation({ gift, style });
      idx++;
      const duration = getDuration(gift.value);
      setTimeout(playNext, (duration + 0.3) * 1000);
    };
    autoPlayRef.current = true;
    setAutoPlaying(true);
    playNext();
  }, [gifts, getStyle, filter]);

  const stopAutoPlay = useCallback(() => {
    autoPlayRef.current = false;
    setAutoPlaying(false);
    setActiveAnimation(null);
  }, []);

  // Play all in a tier
  const playTier = useCallback((tier: string) => {
    const tierGifts = gifts.filter(g => getTier(g.value) === tier);
    let idx = 0;
    const playNext = () => {
      if (idx >= tierGifts.length) return;
      const gift = tierGifts[idx];
      const style = getStyle(gift.id);
      setActiveAnimation({ gift, style });
      idx++;
      setTimeout(playNext, (getDuration(gift.value) + 0.3) * 1000);
    };
    playNext();
  }, [gifts, getStyle]);

  // Filtered gifts
  const filteredGifts = filter
    ? gifts.filter(g => g.name?.toLowerCase().includes(filter.toLowerCase()) || g.icon?.includes(filter))
    : gifts;

  // Group by tier
  const giftsByTier = TIERS.reduce((acc, tier) => {
    acc[tier] = filteredGifts.filter(g => getTier(g.value) === tier);
    return acc;
  }, {} as Record<string, GiftItem[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🎁</div>
          <div className="text-gray-400">Loading gifts from database...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-white p-6 lg:p-8">
      {activeAnimation && (
        <GiftAnimationOverlay
          key={`${activeAnimation.gift.id}-${Date.now()}`}
          gift={activeAnimation.gift}
          style={activeAnimation.style}
          duration={getDuration(activeAnimation.gift.value)}
          onComplete={handleComplete}
        />
      )}

      <header className="mb-8">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-cyan-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
          Gift Animation Preview
        </h1>
        <p className="text-sm text-gray-400 mt-2">
          {gifts.length} gifts loaded from database. Pick an animation style for each gift.
        </p>

        {/* Search filter */}
        <div className="mt-4 max-w-md">
          <input
            type="text"
            placeholder="Filter gifts by name or icon..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-[#131c30] border border-[#1e2d4a] text-white text-sm placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {autoPlaying ? (
            <button onClick={stopAutoPlay} className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-500">
              Stop Auto-Play
            </button>
          ) : (
            <button onClick={playAll} className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold hover:brightness-110">
              Play All ({filteredGifts.length})
            </button>
          )}
          {TIERS.map(tier => {
            const count = giftsByTier[tier]?.length || 0;
            if (count === 0) return null;
            return (
              <button
                key={tier}
                onClick={() => playTier(tier)}
                className="px-3 py-2 rounded-lg text-sm font-semibold hover:brightness-110"
                style={{ background: getTierBg(tier), border: `1px solid ${getTierColor(tier)}40`, color: getTierColor(tier) }}
              >
                Tier {tier} ({count})
              </button>
            );
          })}
        </div>
      </header>

      {/* Duration legend */}
      <div className="mb-6 flex flex-wrap gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-cyan-400" /> &lt;500 coins = 3s</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400" /> 500-1499 = 6s</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" /> 1500+ = 8s</span>
      </div>

      {/* Animation style selector info */}
      <div className="mb-6 p-4 rounded-xl bg-[#0f1628] border border-[#1e2d4a]">
        <h2 className="text-sm font-bold text-gray-300 mb-3">10 Animation Styles</h2>
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
        const tierGifts = giftsByTier[tier];
        if (!tierGifts || tierGifts.length === 0) return null;
        const color = getTierColor(tier);
        return (
          <section key={tier} className="mb-8">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color }}>
              Tier {tier}
              <span className="text-xs font-normal text-gray-500">
                {getTierRange(tier)} coins • {getDuration(tierGifts[0]?.value)}s duration • {tierGifts.length} gifts
              </span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tierGifts.map(gift => {
                const currentStyle = getStyle(gift.id);
                const duration = getDuration(gift.value);
                const displayName = formatGiftName(gift);
                return (
                  <div
                    key={gift.id}
                    className="group rounded-xl border border-[#1e2d4a] bg-[#0f1628] p-4 hover:border-cyan-500/50 transition-all"
                    style={{ borderColor: activeAnimation?.gift.id === gift.id ? color : undefined }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-4xl">{gift.icon || '🎁'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{displayName}</div>
                        <div className="text-xs text-gray-500">
                          {gift.value.toLocaleString()} coins • {duration}s
                        </div>
                      </div>
                    </div>

                    {/* Style buttons - first row */}
                    <div className="flex flex-wrap gap-1 mb-1">
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
                    {/* Style buttons - second row */}
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

                    <button
                      onClick={() => playAnimation(gift, currentStyle)}
                      className="w-full py-2 rounded-lg text-xs font-bold transition hover:brightness-110"
                      style={{ background: `${color}20`, border: `1px solid ${color}40`, color }}
                    >
                      ▶ Preview {currentStyle}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Empty state */}
      {gifts.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🎁</div>
          <h2 className="text-xl font-bold text-gray-400">No gifts found</h2>
          <p className="text-sm text-gray-500 mt-2">Check your gift_items or purchasable_items table in the database.</p>
        </div>
      )}

      {/* Summary */}
      {gifts.length > 0 && (
        <footer className="mt-8 p-4 rounded-xl bg-[#0f1628] border border-[#1e2d4a]">
          <h3 className="font-bold text-sm mb-2 text-gray-300">Selection Summary ({gifts.length} total gifts)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
            {TIERS.map(t => {
              const tGifts = giftsByTier[t];
              if (!tGifts || tGifts.length === 0) return null;
              return (
                <div key={t} className="p-2 rounded-lg" style={{ background: getTierBg(t) }}>
                  <div className="font-bold" style={{ color: getTierColor(t) }}>Tier {t} ({tGifts.length})</div>
                  {tGifts.slice(0, 5).map(g => (
                    <div key={g.id} className="text-gray-400 mt-1 truncate">
                      {g.icon} {formatGiftName(g)}: <span className="text-white">{getStyle(g.id)}</span>
                    </div>
                  ))}
                  {tGifts.length > 5 && <div className="text-gray-500 mt-1">+{tGifts.length - 5} more</div>}
                </div>
              );
            })}
          </div>
        </footer>
      )}
    </div>
  );
}
