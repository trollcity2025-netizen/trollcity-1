/**
 * Gift Animation & Display Design Showcase
 * 
 * This page showcases different design concepts for displaying gifts
 * on Trollo Wall posts. Use this to evaluate and choose the best direction.
 * 
 * Access: /dev/gift-animation-showcase
 */

import React, { useState } from 'react'
import { Gift, Heart, Star, Crown, Diamond, Rocket, Flame, Sparkles, Zap, Award, Gem, Coffee, Pizza, PartyPopper } from 'lucide-react'

// Available gifts data
const GIFTS = [
  { type: 'rose', emoji: '🌹', name: 'Rose', cost: 10, color: '#ef4444' },
  { type: 'heart', emoji: '💖', name: 'Heart', cost: 25, color: '#ec4899' },
  { type: 'star', emoji: '⭐', name: 'Star', cost: 50, color: '#eab308' },
  { type: 'crown', emoji: '👑', name: 'Crown', cost: 100, color: '#a855f7' },
  { type: 'diamond', emoji: '💎', name: 'Diamond', cost: 200, color: '#06b6d4' },
  { type: 'trophy', emoji: '🏆', name: 'Trophy', cost: 500, color: '#f97316' },
  { type: 'coffee', emoji: '☕', name: 'Coffee', cost: 15, color: '#78350f' },
  { type: 'pizza', emoji: '🍕', name: 'Pizza', cost: 30, color: '#ea580c' },
  { type: 'rocket', emoji: '🚀', name: 'Rocket', cost: 1000, color: '#3b82f6' },
  { type: 'dragon', emoji: '🐉', name: 'Dragon', cost: 5000, color: '#10b981' },
]

// Mock post with gifts
const mockPost = {
  id: '1',
  username: 'TrollKing',
  content: 'Just hit level 50! Thanks for all the support everyone! 🎉',
  gifts: {
    heart: { count: 5, coins: 125 },
    star: { count: 3, coins: 150 },
    crown: { count: 1, coins: 100 },
    diamond: { count: 2, coins: 400 },
  }
}

// Design Concept 1: Minimal Badge (Current)
const MinimalGiftDisplay = ({ gifts }: { gifts: typeof mockPost.gifts }) => {
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(gifts).map(([type, data]) => {
        const gift = GIFTS.find(g => g.type === type)
        if (!gift) return null
        return (
          <span key={type} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-900/50 rounded-full text-xs">
            {gift.emoji} {data.count}
          </span>
        )
      })}
    </div>
  )
}

// Design Concept 2: Neon Glow Cards
const NeonGlowGifts = ({ gifts }: { gifts: typeof mockPost.gifts }) => {
  const totalCoins = Object.entries(gifts).reduce((sum, [type, data]) => {
    const gift = GIFTS.find(g => g.type === type)
    return sum + (gift ? gift.cost * data.count : 0)
  }, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-purple-400">
        <Gift size={12} />
        <span>{Object.keys(gifts).length} gifts • {totalCoins} coins</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(gifts).map(([type, data]) => {
          const gift = GIFTS.find(g => g.type === type)
          if (!gift) return null
          return (
            <div 
              key={type}
              className="relative px-3 py-1.5 rounded-lg bg-black/50 border"
              style={{ borderColor: `${gift.color}50`, boxShadow: `0 0 10px ${gift.color}30` }}
            >
              <span className="text-lg mr-1">{gift.emoji}</span>
              <span className="font-bold text-white">x{data.count}</span>
              <div 
                className="absolute inset-0 rounded-lg opacity-20"
                style={{ background: `linear-gradient(135deg, ${gift.color}40, transparent)` }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Design Concept 3: Floating Emojis
const FloatingEmojiGifts = ({ gifts }: { gifts: typeof mockPost.gifts }) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {Object.entries(gifts).map(([type, data]) => {
        const gift = GIFTS.find(g => g.type === type)
        if (!gift) return null
        return (
          <div key={type} className="relative group">
            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-900/60 to-pink-900/60 rounded-xl border border-white/10">
              <span className="text-2xl filter drop-shadow-lg">{gift.emoji}</span>
              <div className="flex flex-col">
                <span className="text-xs text-white/60">x{data.count}</span>
                <span className="text-xs font-bold text-purple-300">{gift.cost * data.count} coins</span>
              </div>
            </div>
            {/* Hover effect - show name */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-2 py-1 rounded text-xs whitespace-nowrap">
              {gift.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Design Concept 4: Animated Counter
const AnimatedCounterGifts = ({ gifts }: { gifts: typeof mockPost.gifts }) => {
  const totalValue = Object.entries(gifts).reduce((sum, [type, data]) => {
    const gift = GIFTS.find(g => g.type === type)
    return sum + (gift ? gift.cost * data.count : 0)
  }, 0)

  return (
    <div className="space-y-2">
      {/* Total value indicator */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-yellow-900/30 to-amber-900/30 rounded-lg border border-yellow-500/20 w-fit">
        <Zap className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-bold text-yellow-400">{totalValue.toLocaleString()}</span>
        <span className="text-xs text-yellow-600">coins</span>
      </div>
      
      {/* Gift stack */}
      <div className="flex items-end gap-1">
        {Object.entries(gifts)
          .sort((a, b) => {
            const giftA = GIFTS.find(g => g.type === a[0])
            const giftB = GIFTS.find(g => g.type === b[0])
            return (giftB?.cost || 0) - (giftA?.cost || 0)
          })
          .slice(0, 5)
          .map(([type, data], index) => {
            const gift = GIFTS.find(g => g.type === type)
            if (!gift) return null
            const height = 20 + (gift.cost / 100) * 15
            return (
              <div 
                key={type}
                className="relative flex flex-col items-center"
                style={{ height: `${height}px` }}
              >
                <div className="absolute bottom-0 w-8 rounded-t-md flex items-end justify-center pb-1"
                  style={{ 
                    height: `${height - 8}px`,
                    background: `linear-gradient(to top, ${gift.color}, ${gift.color}80)`
                  }}
                >
                  <span className="text-xs">{gift.emoji}</span>
                </div>
                <span className="text-[10px] text-white/50 mt-1">{data.count}</span>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

// Design Concept 5: Particle Burst
const ParticleBurstGifts = ({ gifts }: { gifts: typeof mockPost.gifts }) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
        <span className="text-xs text-purple-300">Gifts Received</span>
      </div>
