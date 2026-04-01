/**
 * Gift Animation Preview - Dev Page
 * 
 * Each gift gets a unique themed animation based on its name/icon.
 * Fetches all gifts from gift_items database table.
 * 
 * Route: /dev/gift-animations
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { createPortal } from 'react-dom';
import { detectGiftTheme, getThemeParticleEmojis, getThemeColor, getThemeAnimationType, GiftTheme } from '../../lib/giftThemeEngine';
import './gift-animations.css';
import './gift-themed-animations.css';

interface GiftItem {
  id: string;
  name: string;
  icon: string;
  value: number;
  category?: string;
  gift_slug?: string;
  is_active?: boolean;
}

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

function formatGiftName(gift: GiftItem): string {
  return gift.name?.replace(/^gift_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Gift';
}

// ========== THEMED ANIMATION OVERLAY ==========

function ThemedGiftAnimation({
  gift,
  duration,
  onComplete,
}: {
  gift: GiftItem;
  duration: number;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<'enter' | 'active' | 'exit'>('enter');
  const tier = getTier(gift.value);
  const theme = detectGiftTheme(gift.name, gift.icon);
  const themeColor = getThemeColor(theme);
  const animType = getThemeAnimationType(theme);
  const particleEmojis = getThemeParticleEmojis(theme);
  const icon = gift.icon || '🎁';
  const displayName = formatGiftName(gift);
  const particleCount = gift.value >= 1500 ? 20 : gift.value >= 500 ? 14 : 8;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('active'), 100);
    const t2 = setTimeout(() => setPhase('exit'), (duration - 0.6) * 1000);
    const t3 = setTimeout(onComplete, duration * 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [duration, onComplete]);

  return createPortal(
    <div
      className={`ga-overlay ga-${phase} ga-theme-${animType}`}
      style={{ '--duration': `${duration}s`, '--theme-color': themeColor } as React.CSSProperties}
    >
      {/* Theme-specific background */}
      <div className={`ga-theme-bg ga-theme-bg-${animType}`}>
        {renderThemeBackground(animType, themeColor, duration)}
      </div>

      {/* Theme particles - floating emojis */}
      <div className="ga-theme-particles">
        {Array.from({ length: particleCount }).map((_, i) => {
          const emoji = particleEmojis[i % particleEmojis.length];
          const left = 10 + Math.random() * 80;
          const delay = (i / particleCount) * 0.5;
          const size = 24 + Math.random() * 24;
          return (
            <div
              key={i}
              className={`ga-theme-particle ga-tp-${animType}`}
              style={{
                left: `${left}%`,
                animationDelay: `${delay}s`,
                animationDuration: `${duration * 0.8}s`,
                fontSize: `${size}px`,
              } as React.CSSProperties}
            >
              {emoji}
            </div>
          );
        })}
      </div>

      {/* Center icon - always visible */}
      <div className={`ga-theme-center ga-tc-${animType}`}>
        <div className="ga-theme-icon" style={{ filter: `drop-shadow(0 0 30px ${themeColor})` }}>
          {icon}
        </div>
        <div className="ga-theme-name" style={{ textShadow: `0 0 20px ${themeColor}` }}>
          {displayName}
        </div>
        <div className="ga-theme-cost" style={{ color: themeColor }}>
          {gift.value.toLocaleString()} coins
        </div>
        <div className="ga-theme-meta">
          {animType} • {duration}s • Tier {tier}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="ga-tier-bar" style={{ background: themeColor }} />
    </div>,
    document.body
  );
}

// Theme-specific background renders
function renderThemeBackground(animType: string, color: string, duration: number) {
  switch (animType) {
    case 'fire-rise':
    case 'erupt':
      return (
        <>
          <div className="ga-fire-floor" style={{ background: `linear-gradient(0deg, ${color}40, transparent)` }} />
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="ga-fire-particle" style={{
              left: `${10 + Math.random() * 80}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1 + Math.random()}s`,
            }} />
          ))}
        </>
      );
    case 'money-rain':
      return Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="ga-money-fall" style={{
          left: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 2}s`,
          animationDuration: `${1.5 + Math.random()}s`,
        }}>💵</div>
      ));
    case 'heartbeat':
      return <div className="ga-heart-bg" />;
    case 'petal-fall':
      return Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="ga-petal-fall" style={{
          left: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 3}s`,
          animationDuration: `${2 + Math.random() * 2}s`,
        }}>{Math.random() > 0.5 ? '🌹' : '🌸'}</div>
      ));
    case 'snow-fall':
      return Array.from({ length: 25 }).map((_, i) => (
        <div key={i} className="ga-snow-fall" style={{
          left: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 3}s`,
          animationDuration: `${2 + Math.random() * 2}s`,
          fontSize: `${12 + Math.random() * 16}px`,
        }}>{Math.random() > 0.5 ? '❄️' : '⛄'}</div>
      ));
    case 'siren-flash':
      return (
        <div className="ga-siren-overlay" style={{ animationDuration: `${duration}s` }}>
          <div className="ga-siren-red" />
          <div className="ga-siren-blue" />
        </div>
      );
    case 'smoke-puff':
    case 'smoke-rise':
      return Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="ga-smoke-cloud" style={{
          left: `${20 + Math.random() * 60}%`,
          animationDelay: `${i * 0.3}s`,
          animationDuration: `${duration}s`,
        }} />
      ));
    case 'rainbow-arc':
      return <div className="ga-rainbow-arc" />;
    case 'wave-crash':
      return Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="ga-wave" style={{
          animationDelay: `${i * 0.4}s`,
          animationDuration: `${duration}s`,
        }} />
      ));
    case 'flash-burst':
      return <div className="ga-flash-overlay" />;
    case 'spiral-up':
      return <div className="ga-tornado-bg" />;
    case 'bullet-burst':
    case 'explode':
      return (
        <>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="ga-explosion-ring" style={{
              animationDelay: `${i * 0.1}s`,
              borderColor: color,
            }} />
          ))}
        </>
      );
    case 'drive-across':
    case 'fly-across':
    case 'sail-across':
      return (
        <div className="ga-road-line" style={{ borderColor: `${color}30` }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ga-road-dash" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      );
    case 'wheel-spin':
      return <div className="ga-wheel-bg">🎡</div>;
    case 'slash':
      return (
        <>
          <div className="ga-slash-line" style={{ borderColor: color, animationDuration: `${duration}s` }} />
          <div className="ga-slash-line ga-slash-2" style={{ borderColor: color, animationDuration: `${duration}s` }} />
        </>
      );
    default:
      return <div className="ga-bg-pulse" style={{ background: `radial-gradient(circle, ${color}15, transparent)` }} />;
  }
}

// ========== MAIN PAGE ==========

const TIERS = ['I', 'II', 'III', 'IV', 'V'] as const;

export default function GiftAnimationPreview() {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAnim, setActiveAnim] = useState<{ gift: GiftItem } | null>(null);
  const autoPlayRef = useRef(false);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [filter, setFilter] = useState('');

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
          const { data: fb } = await supabase
            .from('purchasable_items')
            .select('*')
            .eq('category', 'gift')
            .eq('is_active', true)
            .order('coin_price', { ascending: true });
          if (fb) {
            setGifts(fb.map((g: any) => ({
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

  const playGift = useCallback((gift: GiftItem) => {
    setActiveAnim({ gift });
  }, []);

  const playAll = useCallback(() => {
    const list = filter
      ? gifts.filter(g => g.name?.toLowerCase().includes(filter.toLowerCase()) || g.icon?.includes(filter))
      : gifts;
    let idx = 0;
    const next = () => {
      if (idx >= list.length || !autoPlayRef.current) {
        setAutoPlaying(false);
        autoPlayRef.current = false;
        return;
      }
      setActiveAnim({ gift: list[idx] });
      idx++;
      setTimeout(next, (getDuration(list[idx - 1].value) + 0.4) * 1000);
    };
    autoPlayRef.current = true;
    setAutoPlaying(true);
    next();
  }, [gifts, filter]);

  const stopAutoPlay = useCallback(() => {
    autoPlayRef.current = false;
    setAutoPlaying(false);
    setActiveAnim(null);
  }, []);

  const playTier = useCallback((tier: string) => {
    const tierGifts = gifts.filter(g => getTier(g.value) === tier);
    let idx = 0;
    const next = () => {
      if (idx >= tierGifts.length) return;
      setActiveAnim({ gift: tierGifts[idx] });
      idx++;
      setTimeout(next, (getDuration(tierGifts[idx - 1].value) + 0.4) * 1000);
    };
    next();
  }, [gifts]);

  const filteredGifts = filter
    ? gifts.filter(g => g.name?.toLowerCase().includes(filter.toLowerCase()) || g.icon?.includes(filter))
    : gifts;

  const giftsByTier = TIERS.reduce((acc, t) => {
    acc[t] = filteredGifts.filter(g => getTier(g.value) === t);
    return acc;
  }, {} as Record<string, GiftItem[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🎁</div>
          <div className="text-gray-400">Loading {gifts.length || 'all'} gifts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-white p-6 lg:p-8">
      {activeAnim && (
        <ThemedGiftAnimation
          key={`${activeAnim.gift.id}-${Date.now()}`}
          gift={activeAnim.gift}
          duration={getDuration(activeAnim.gift.value)}
          onComplete={() => setActiveAnim(null)}
        />
      )}

      <header className="mb-8">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-cyan-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
          Gift Animation Preview
        </h1>
        <p className="text-sm text-gray-400 mt-2">
          {gifts.length} gifts • Each has a unique themed animation based on its name
        </p>
        <div className="mt-4 max-w-md">
          <input
            type="text"
            placeholder="Search gifts..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-[#131c30] border border-[#1e2d4a] text-white text-sm placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {autoPlaying ? (
            <button onClick={stopAutoPlay} className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-500">
              Stop
            </button>
          ) : (
            <button onClick={playAll} className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold hover:brightness-110">
              Play All ({filteredGifts.length})
            </button>
          )}
          {TIERS.map(t => {
            const count = giftsByTier[t]?.length || 0;
            if (!count) return null;
            return (
              <button
                key={t}
                onClick={() => playTier(t)}
                className="px-3 py-2 rounded-lg text-sm font-semibold hover:brightness-110"
                style={{ background: getTierBg(t), border: `1px solid ${getTierColor(t)}40`, color: getTierColor(t) }}
              >
                Tier {t} ({count})
              </button>
            );
          })}
        </div>
      </header>

      <div className="mb-6 text-xs text-gray-500 flex flex-wrap gap-3">
        <span>🔴 &lt;500 = 3s</span>
        <span>🟠 500-1499 = 6s</span>
        <span>🟡 1500+ = 8s</span>
        <span className="text-gray-600">|</span>
        <span>Each gift auto-detects its theme from name/icon</span>
      </div>

      {TIERS.map(tier => {
        const tGifts = giftsByTier[tier];
        if (!tGifts?.length) return null;
        const color = getTierColor(tier);
        return (
          <section key={tier} className="mb-8">
            <h2 className="text-lg font-bold mb-3" style={{ color }}>
              Tier {tier} <span className="text-xs font-normal text-gray-500">
                {tGifts.length} gifts
              </span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tGifts.map(gift => {
                const theme = detectGiftTheme(gift.name, gift.icon);
                const animType = getThemeAnimationType(theme);
                const themeColor = getThemeColor(theme);
                const duration = getDuration(gift.value);
                const displayName = formatGiftName(gift);
                return (
                  <div
                    key={gift.id}
                    className="rounded-xl border border-[#1e2d4a] bg-[#0f1628] p-4 hover:border-opacity-60 transition-all group"
                    style={{ borderColor: activeAnim?.gift.id === gift.id ? themeColor : undefined }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">{gift.icon || '🎁'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{displayName}</div>
                        <div className="text-xs text-gray-500">
                          {gift.value.toLocaleString()} coins • {duration}s
                        </div>
                      </div>
                    </div>
                    {/* Theme tag */}
                    <div className="mb-3 flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                        style={{ background: `${themeColor}20`, color: themeColor }}
                      >
                        {theme}
                      </span>
                      <span className="text-[10px] text-gray-600">
                        {animType}
                      </span>
                    </div>
                    <button
                      onClick={() => playGift(gift)}
                      className="w-full py-2 rounded-lg text-xs font-bold transition hover:brightness-110"
                      style={{ background: `${themeColor}20`, border: `1px solid ${themeColor}40`, color: themeColor }}
                    >
                      ▶ Preview
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {gifts.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🎁</div>
          <h2 className="text-xl font-bold text-gray-400">No gifts found</h2>
          <p className="text-sm text-gray-500 mt-2">Check your gift_items table in Supabase.</p>
        </div>
      )}
    </div>
  );
}
