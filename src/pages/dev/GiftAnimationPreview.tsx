/**
 * Gift Animation Preview - Dev Page
 * 
 * Plays per-gift themed CSS animations with transparent backgrounds.
 * Each gift has its own unique animation based on name/icon/theme.
 * 
 * Route: /dev/gift-animations
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { GiftThemePlayer } from '../../components/broadcast/GiftThemePlayer';
import { preloadGiftSounds } from '../../lib/giftSoundMap';

interface GiftItem {
  id: string;
  name: string;
  icon: string;
  value: number;
  category?: string;
  gift_slug?: string;
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

function formatName(g: GiftItem): string {
  return g.name?.replace(/^gift_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Gift';
}

const TIERS = ['I', 'II', 'III', 'IV', 'V'] as const;

export default function GiftAnimationPreview() {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGift, setActiveGift] = useState<GiftItem | null>(null);
  const autoPlayRef = useRef(false);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [filter, setFilter] = useState('');
  const [tierFilter, setTierFilter] = useState<string | null>(null);

  useEffect(() => {
    preloadGiftSounds();
    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('gift_items')
          .select('id, name, icon, value, category, gift_slug')
          .order('value', { ascending: true });

        if (error) throw error;
        if (data && data.length > 0) {
          setGifts(data);
          console.log(`[GiftPreview] Loaded ${data.length} gifts from gift_items`);
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
            console.log(`[GiftPreview] Loaded ${fb.length} gifts from purchasable_items`);
          }
        }
      } catch (e) {
        console.error('[GiftPreview] Failed to fetch gifts:', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const playGift = useCallback((gift: GiftItem) => {
    setActiveGift(gift);
  }, []);

  const filteredGifts = gifts.filter(g => {
    if (filter && !g.name?.toLowerCase().includes(filter.toLowerCase()) && !g.icon?.includes(filter)) return false;
    if (tierFilter && getTier(g.value) !== tierFilter) return false;
    return true;
  });

  const playAll = useCallback(() => {
    const list = filteredGifts;
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
  }, [gifts, filter, tierFilter]);

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

  const giftsByTier = TIERS.reduce((acc, t) => {
    acc[t] = gifts.filter(g => getTier(g.value) === t);
    return acc;
  }, {} as Record<string, GiftItem[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🎁</div>
          <div className="text-gray-400">Loading gifts from database...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-white p-6 lg:p-8">
      {activeGift && (
        <GiftThemePlayer
          key={`${activeGift.id}-${Date.now()}`}
          giftName={activeGift.name}
          giftIcon={activeGift.icon}
          giftValue={activeGift.value}
          duration={getDuration(activeGift.value)}
          onComplete={() => setActiveGift(null)}
        />
      )}

      <header className="mb-8">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-cyan-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
          Gift Animations
        </h1>
        <p className="text-sm text-gray-400 mt-2">
          {gifts.length} gifts loaded • Each gift has a unique themed animation with transparent background
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
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setTierFilter(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!tierFilter ? 'bg-white/10 text-white' : 'bg-[#131c30] text-gray-400 hover:text-white'}`}
          >
            All ({gifts.length})
          </button>
          {TIERS.map(t => {
            const count = giftsByTier[t]?.length || 0;
            if (!count) return null;
            return (
              <button
                key={t}
                onClick={() => setTierFilter(tierFilter === t ? null : t)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:brightness-110"
                style={{
                  background: tierFilter === t ? `${getTierColor(t)}30` : getTierBg(t),
                  border: `1px solid ${getTierColor(t)}${tierFilter === t ? '80' : '40'}`,
                  color: getTierColor(t),
                }}
              >
                Tier {t} ({count})
              </button>
            );
          })}
          <button
            onClick={() => playTier(tierFilter || 'I')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600/20 text-green-400 border border-green-500/30 hover:brightness-110"
          >
            Play Tier
          </button>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-gray-400">All {gifts.length} gifts have unique themed animations</span>
        </div>
        <div className="text-gray-600">|</div>
        <span className="text-gray-500">&lt;500 = 3s &bull; 500-1499 = 6s &bull; 1500+ = 8s</span>
      </div>

      {filteredGifts.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🎁</div>
          <h2 className="text-xl font-bold text-gray-400">No gifts found</h2>
          <p className="text-sm text-gray-500 mt-2">Check your gift_items table in Supabase.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filteredGifts.map(gift => {
            const tier = getTier(gift.value);
            const color = getTierColor(tier);
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
                      {gift.value.toLocaleString()} coins &bull; {duration}s
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: `${color}20`, color }}>
                    Tier {tier}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400">
                    Themed
                  </span>
                </div>
                <button
                  onClick={() => playGift(gift)}
                  className="w-full py-2 rounded-lg text-xs font-bold transition hover:brightness-110"
                  style={{ background: `${color}20`, border: `1px solid ${color}40`, color }}
                >
                  Play
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
