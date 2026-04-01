/**
 * Gift Animation Preview - Dev Page
 * 
 * 3D realistic gift animations with per-gift sounds.
 * Each gift gets a unique Three.js scene with proper materials and lighting.
 * 
 * Route: /dev/gift-animations
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Gift3DOverlay } from '../../components/broadcast/Gift3DAnimations';
import { preloadGiftSounds } from '../../lib/giftSoundMap';
import './gift-3d.css';

interface GiftItem {
  id: string;
  name: string;
  icon: string;
  value: number;
  category?: string;
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

function formatName(gift: GiftItem): string {
  return gift.name?.replace(/^gift_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Gift';
}

function detectSceneType(name: string, icon: string): string {
  const s = `${name} ${icon}`.toLowerCase().replace(/[_-]/g, ' ');
  if (s.includes('rose') || s.includes('flower') || s.includes('bouquet') || s.includes('🌹')) return 'rose';
  if (s.includes('heart') || s.includes('love') || s.includes('pulse') || s.includes('❤') || s.includes('💖')) return 'heart';
  if (s.includes('crown') || s.includes('king') || s.includes('queen') || s.includes('👑')) return 'crown';
  if (s.includes('diamond') || s.includes('gem') || s.includes('💎')) return 'diamond';
  if (s.includes('fire') || s.includes('flame') || s.includes('blaze') || s.includes('🔥')) return 'fire';
  if (s.includes('car') || s.includes('auto') || s.includes('drift') || s.includes('🏎')) return 'car';
  if (s.includes('rocket') || s.includes('launch') || s.includes('🚀')) return 'rocket';
  if (s.includes('money') || s.includes('cash') || s.includes('dollar') || s.includes('💵')) return 'money';
  if (s.includes('coin') || s.includes('flip') || s.includes('🪙')) return 'coin';
  if (s.includes('bomb') || s.includes('explode') || s.includes('💣') || s.includes('tnt')) return 'bomb';
  if (s.includes('trophy') || s.includes('award') || s.includes('🏆')) return 'trophy';
  if (s.includes('star') || s.includes('⭐')) return 'star';
  if (s.includes('police') || s.includes('siren') || s.includes('🚨')) return 'police';
  if (s.includes('snow') || s.includes('❄') || s.includes('ice')) return 'snow';
  if (s.includes('dragon') || s.includes('🐉')) return 'dragon';
  if (s.includes('champagne') || s.includes('🍾')) return 'champagne';
  if (s.includes('music') || s.includes('🎵') || s.includes('mic') || s.includes('🎤')) return 'music';
  if (s.includes('camera') || s.includes('📸') || s.includes('flash')) return 'camera';
  if (s.includes('rainbow') || s.includes('🌈')) return 'rainbow';
  if (s.includes('ghost') || s.includes('👻')) return 'ghost';
  if (s.includes('skull') || s.includes('💀')) return 'skull';
  if (s.includes('pizza') || s.includes('🍕')) return 'pizza';
  if (s.includes('coffee') || s.includes('☕')) return 'coffee';
  if (s.includes('beer') || s.includes('🍺')) return 'beer';
  if (s.includes('wine') || s.includes('🍷')) return 'wine';
  if (s.includes('balloon') || s.includes('🎈')) return 'balloon';
  if (s.includes('gift') || s.includes('present') || s.includes('🎁')) return 'gift-box';
  if (s.includes('ring') || s.includes('💍')) return 'ring';
  if (s.includes('like') || s.includes('👍')) return 'like';
  if (s.includes('clap') || s.includes('applause') || s.includes('👏')) return 'clap';
  if (s.includes('hammer') || s.includes('🔨')) return 'hammer';
  if (s.includes('sword') || s.includes('🗡')) return 'sword';
  if (s.includes('house') || s.includes('🏠') || s.includes('castle') || s.includes('🏰')) return 'house';
  if (s.includes('helicopter') || s.includes('🚁')) return 'helicopter';
  if (s.includes('candle') || s.includes('🕯')) return 'candle';
  if (s.includes('smoke') || s.includes('blunt') || s.includes('🚬')) return 'smoke';
  if (s.includes('wave') || s.includes('🌊') || s.includes('ocean')) return 'wave';
  if (s.includes('tornado') || s.includes('🌪')) return 'tornado';
  if (s.includes('volcano') || s.includes('🌋')) return 'volcano';
  if (s.includes('spark') || s.includes('⚡') || s.includes('zap')) return 'spark';
  if (s.includes('sun') || s.includes('☀')) return 'sun';
  if (s.includes('moon') || s.includes('🌙')) return 'moon';
  if (s.includes('earth') || s.includes('🌍')) return 'earth';
  if (s.includes('hug') || s.includes('🤗')) return 'hug';
  if (s.includes('kiss') || s.includes('💋')) return 'kiss';
  if (s.includes('laugh') || s.includes('😂')) return 'laugh';
  if (s.includes('cry') || s.includes('😢')) return 'cry';
  if (s.includes('angry') || s.includes('😤')) return 'angry';
  if (s.includes('cool') || s.includes('😎')) return 'cool';
  if (s.includes('game') || s.includes('🎮')) return 'game';
  return 'default';
}

const TIERS = ['I', 'II', 'III', 'IV', 'V'] as const;

export default function GiftAnimationPreview() {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGift, setActiveGift] = useState<GiftItem | null>(null);
  const autoPlayRef = useRef(false);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [filter, setFilter] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    preloadGiftSounds();
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
              id: g.id, name: g.display_name || g.item_key,
              icon: g.metadata?.icon || '🎁', value: g.coin_price || 0,
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
    setActiveGift(gift);
  }, []);

  const playAll = useCallback(() => {
    const list = filter
      ? gifts.filter(g => g.name?.toLowerCase().includes(filter.toLowerCase()))
      : gifts;
    let idx = 0;
    const next = () => {
      if (idx >= list.length || !autoPlayRef.current) {
        setAutoPlaying(false);
        autoPlayRef.current = false;
        return;
      }
      setActiveGift(list[idx]);
      idx++;
      setTimeout(next, (getDuration(list[idx - 1].value) + 0.5) * 1000);
    };
    autoPlayRef.current = true;
    setAutoPlaying(true);
    next();
  }, [gifts, filter]);

  const stopAutoPlay = useCallback(() => {
    autoPlayRef.current = false;
    setAutoPlaying(false);
    setActiveGift(null);
  }, []);

  const playTier = useCallback((tier: string) => {
    const tierGifts = gifts.filter(g => getTier(g.value) === tier);
    let idx = 0;
    const next = () => {
      if (idx >= tierGifts.length) return;
      setActiveGift(tierGifts[idx]);
      idx++;
      setTimeout(next, (getDuration(tierGifts[idx - 1].value) + 0.5) * 1000);
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
          <div className="text-gray-400">Loading gifts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-white p-6 lg:p-8">
      {activeGift && (
        <Gift3DOverlay
          key={`${activeGift.id}-${Date.now()}`}
          giftName={activeGift.name}
          giftIcon={activeGift.icon}
          giftValue={activeGift.value}
          duration={getDuration(activeGift.value)}
          onComplete={() => setActiveGift(null)}
        />
      )}

      <header className="mb-8">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-cyan-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
            3D Gift Animations
          </h1>
          <span className="text-xs px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            Three.js + Sound
          </span>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          {gifts.length} gifts • Realistic 3D scenes with per-gift sounds
        </p>

        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search gifts..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="px-4 py-2 rounded-lg bg-[#131c30] border border-[#1e2d4a] text-white text-sm placeholder-gray-500 focus:border-cyan-500 focus:outline-none w-64"
          />

          {autoPlaying ? (
            <button onClick={stopAutoPlay} className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-500 text-sm">
              Stop
            </button>
          ) : (
            <button onClick={playAll} className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold hover:brightness-110 text-sm">
              Play All ({filteredGifts.length})
            </button>
          )}

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-2 rounded-lg text-sm font-semibold ${soundEnabled ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-gray-700/20 text-gray-400 border border-gray-600/30'}`}
          >
            {soundEnabled ? '🔊 Sound On' : '🔇 Sound Off'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {TIERS.map(t => {
            const count = giftsByTier[t]?.length || 0;
            if (!count) return null;
            return (
              <button
                key={t}
                onClick={() => playTier(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:brightness-110"
                style={{ background: getTierBg(t), border: `1px solid ${getTierColor(t)}40`, color: getTierColor(t) }}
              >
                Tier {t} ({count})
              </button>
            );
          })}
        </div>
      </header>

      {/* 3D scene type legend */}
      <div className="mb-6 p-3 rounded-lg bg-[#0f1628] border border-[#1e2d4a]">
        <div className="text-xs text-gray-400 mb-2">3D Scene Types Available:</div>
        <div className="flex flex-wrap gap-1.5">
          {['rose', 'heart', 'crown', 'diamond', 'fire', 'car', 'money', 'coin', 'rocket', 'bomb', 'trophy', 'police', 'snow', 'star'].map(s => (
            <span key={s} className="px-2 py-0.5 rounded text-[10px] bg-[#131c30] text-cyan-400 border border-[#1e2d4a]">{s}</span>
          ))}
          <span className="px-2 py-0.5 rounded text-[10px] bg-[#131c30] text-gray-500 border border-[#1e2d4a]">+default for others</span>
        </div>
      </div>

      {/* Gift grid by tier */}
      {TIERS.map(tier => {
        const tGifts = giftsByTier[tier];
        if (!tGifts?.length) return null;
        const color = getTierColor(tier);
        return (
          <section key={tier} className="mb-8">
            <h2 className="text-lg font-bold mb-3" style={{ color }}>
              Tier {tier} <span className="text-xs font-normal text-gray-500">{tGifts.length} gifts</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tGifts.map(gift => {
                const sceneType = detectSceneType(gift.name, gift.icon);
                const duration = getDuration(gift.value);
                const displayName = formatName(gift);
                return (
                  <div
                    key={gift.id}
                    className="rounded-xl border border-[#1e2d4a] bg-[#0f1628] p-4 hover:border-cyan-500/40 transition-all"
                    style={{ borderColor: activeGift?.id === gift.id ? color : undefined }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">{gift.icon || '🎁'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{displayName}</div>
                        <div className="text-xs text-gray-500">
                          {gift.value.toLocaleString()} coins • {duration}s
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: `${color}20`, color }}>
                        {sceneType}
                      </span>
                      <span className="text-[10px] text-gray-600">3D scene + sound</span>
                    </div>
                    <button
                      onClick={() => playGift(gift)}
                      className="w-full py-2 rounded-lg text-xs font-bold transition hover:brightness-110"
                      style={{ background: `${color}20`, border: `1px solid ${color}40`, color }}
                    >
                      ▶ Preview 3D
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
          <p className="text-sm text-gray-500 mt-2">Check your gift_items table.</p>
        </div>
      )}
    </div>
  );
}
