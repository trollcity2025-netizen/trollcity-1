import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useGiftSystem } from '../lib/hooks/useGiftSystem'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { getActiveHolidayTheme } from '../lib/holidayThemes'

import { StreamParticipant } from './stream/VideoBox'

interface GiftModalProps {
  isOpen: boolean
  onClose: () => void
  streamerId: string
  streamId?: string | null
  inline?: boolean // If true, render inline instead of as overlay
  onBonusAwarded?: (bonus: { bonus_amount: number; total_gifts: number; message: string }) => void
  activeBattleId?: string | null // Battle ID if streamer is in an active battle
  participants?: StreamParticipant[] // Participants for targeting
  defaultTargetId?: string | null // Default target user ID
}

const GIFT_ITEMS = [
  // Basic Gifts (Casual Support — Frequent Senders)
  { id: 'troll_respect', name: '👍 Troll Respect', coinCost: 5, type: 'paid', animationTheme: 'Quick bounce, neon green flash' },
  { id: 'neon_heart', name: '💜 Neon Heart', coinCost: 10, type: 'paid', animationTheme: 'Glow pulse, slight pop' },
  { id: 'candy_troll_pop', name: '🍭 Candy Troll Pop', coinCost: 15, type: 'paid', animationTheme: 'Spin-in, confetti sprinkle' },
  { id: 'lightbulb_idea', name: '💡 Lightbulb Idea', coinCost: 25, type: 'paid', animationTheme: 'Flicker + glow trail' },
  { id: 'mic_support', name: '🎤 Mic Support', coinCost: 30, type: 'paid', animationTheme: 'Microphone echo pulse' },
  
  // Interactive Gifts (Audience Playtime)
  { id: 'mini_troll', name: '🧌 Mini Troll', coinCost: 40, type: 'paid', animationTheme: 'Walks across screen, waves' },
  { id: 'roast_wind', name: '💨 Roast Wind', coinCost: 50, type: 'paid', animationTheme: 'Blast swipe left-right' },
  { id: 'laugh_riot', name: '😂 Laugh Riot', coinCost: 60, type: 'paid', animationTheme: 'Shake screen, emoji flood' },
  { id: 'amplify_me', name: '🔊 Amplify Me', coinCost: 75, type: 'paid', animationTheme: 'Temporary voice boost (V2 feature)' },
  { id: 'pin_message', name: '💬 Pin My Message', coinCost: 100, type: 'paid', animationTheme: 'Pins chat message for 30 sec' },
  
  // Premium Gifts (Neon Flash Events)
  { id: 'troll_treasure_box', name: '🎁 Troll Treasure Box', coinCost: 200, type: 'paid', animationTheme: 'Box pops open → coin burst' },
  { id: 'diamond_troll', name: '💎 Diamond Troll', coinCost: 400, type: 'paid', animationTheme: 'Sparkle screen-wide burst' },
  { id: 'chaos_storm', name: '🌪 Chaos Storm', coinCost: 600, type: 'paid', animationTheme: 'Tornado effect + neon flashes' },
  { id: 'mega_spotlight', name: '📣 Mega Spotlight', coinCost: 800, type: 'paid', animationTheme: 'Host highlight, center stage banner' },
  { id: 'royal_crown_drop', name: '👑 Royal Crown Drop', coinCost: 1000, type: 'paid', animationTheme: 'Crown falls onto host frame' },
  
  // Elite Gifts (Stream-shaking Impact)
  { id: 'boost_stream', name: '🚀 Boost the Stream', coinCost: 2500, type: 'paid', specialEffect: 'Sends room-wide announcement' },
  { id: 'neon_fireworks', name: '🎆 Neon Fireworks', coinCost: 5000, type: 'paid', specialEffect: 'Full-screen fireworks animated' },
  { id: 'troll_dragon', name: '🐲 Troll Dragon', coinCost: 7500, type: 'paid', specialEffect: 'Dragon flies across stream breathing neon fire' },
  { id: 'troll_kingdom', name: '🏰 Troll Kingdom', coinCost: 10000, type: 'paid', specialEffect: 'Host receives temporary "KING/QUEEN" badge' },
  { id: 'make_it_rain', name: '💵 Make it Rain', coinCost: 12500, type: 'paid', specialEffect: 'Coin rain effect for all viewers' },
  
  // Special TrollCity Theme Gifts
  { id: 'troll_walk_in', name: '🧌 Troll Walk-In', coinCost: 300, type: 'paid', effect: 'Troll stomps across screen' },
  { id: 'troll_portal', name: '🔮 Troll Portal', coinCost: 750, type: 'paid', effect: 'Portal opens, troll appears and waves' },
  { id: 'royal_officer_arrival', name: '🦹 Royal Officer Arrival', coinCost: 1200, type: 'paid', effect: 'Siren flash, badge entrance' },
  { id: 'dna_troll_clone', name: '🧬 DNA Troll Clone', coinCost: 2000, type: 'paid', effect: 'Troll duplicates across screen' },
  { id: 'trollcity_skyline', name: '🌃 TrollCity Skyline', coinCost: 3500, type: 'paid', effect: 'Skyline lights up behind host' },
]

interface GiftItem {
  id: string
  name: string
  icon: string
  value: number
  category: string
  holiday_theme: string | null
  description?: string
  animation_type?: string
}

export default function SendGiftModal({ 
  isOpen, 
  onClose, 
  streamerId, 
  streamId = null, 
  inline = false, 
  onBonusAwarded,
  activeBattleId = null,
  participants = [],
  defaultTargetId = null
}: GiftModalProps) {
  const { profile } = useAuthStore()
  const [giftTargetUserId, setGiftTargetUserId] = useState<string | null>(defaultTargetId || streamerId)
  const { sendGift, isSending } = useGiftSystem(streamerId, streamId, activeBattleId, giftTargetUserId)
  const [giftItems, setGiftItems] = useState<GiftItem[]>([])
  const [loadingGifts, setLoadingGifts] = useState(true)
  const activeHoliday = getActiveHolidayTheme()

  // Update target when default changes
  React.useEffect(() => {
    if (defaultTargetId) {
      setGiftTargetUserId(defaultTargetId)
    } else if (participants.length > 0) {
      // Default to host if available
      const host = participants.find(p => p.role === 'host')
      setGiftTargetUserId(host?.userId || streamerId)
    } else {
      setGiftTargetUserId(streamerId)
    }
  }, [defaultTargetId, participants, streamerId])

  // Fetch gift items from database (holiday + regular)
  useEffect(() => {
    if (!isOpen) return

    const fetchGiftItems = async () => {
      setLoadingGifts(true)
      try {
        // Fetch gifts matching active holiday theme OR regular gifts (holiday_theme IS NULL)
        const query = supabase
          .from('gift_items')
          .select('*')
          .order('value', { ascending: true })

        if (activeHoliday) {
          // Show holiday gifts + regular gifts
          const { data, error } = await query.or(`holiday_theme.eq.${activeHoliday.name},holiday_theme.is.null`)
          if (error) throw error
          setGiftItems(data || [])
        } else {
          // Show only regular gifts
          const { data, error } = await query.is('holiday_theme', null)
          if (error) throw error
          setGiftItems(data || [])
        }
      } catch (err) {
        console.error('Error fetching gift items:', err)
        // Fallback to hardcoded gifts if database fails
        setGiftItems([])
      } finally {
        setLoadingGifts(false)
      }
    }

    fetchGiftItems()
  }, [isOpen, activeHoliday])

  if (!isOpen) return null

  const handleGiftSend = async (gift: any) => {
    const result = await sendGift(gift)
    if (result && (result === true || (typeof result === 'object' && result.success))) {
      toast.success(`🎁 You sent ${gift.name}`)
      
      // Check if bonus was awarded
      if (result && typeof result === 'object' && result.bonus) {
        // Notify parent component about bonus
        if (onBonusAwarded) {
          onBonusAwarded({
            bonus_amount: result.bonus.bonus_amount,
            total_gifts: result.bonus.total_gifts,
            message: result.bonus.message,
          })
        } else {
          // Fallback: show toast if no callback provided
          toast.success(`🎉 Bonus! +${result.bonus.bonus_amount} Free Coins!`)
        }
      }
      
      onClose()
    }
  }

  // Use database gifts if available, otherwise fallback to hardcoded GIFT_ITEMS
  const displayGifts = giftItems.length > 0 
    ? giftItems.map(item => ({
        id: item.id,
        name: `${item.icon} ${item.name}`,
        coinCost: item.value,
        type: 'paid' as const,
        category: item.category || 'Common',
        animationTheme: item.description || item.animation_type || '',
        holidayTheme: item.holiday_theme,
        icon: item.icon,
        specialEffect: item.description,
        effect: item.description
      }))
    : GIFT_ITEMS.map(gift => ({ ...gift, category: 'Common' }))

  const modalContent = (
    <div className={`${inline ? 'w-full' : 'bg-gray-900 p-6 w-96 rounded-xl shadow-lg'} text-white relative ${inline ? 'h-full' : ''}`}>
      <button onClick={onClose} className="absolute top-3 right-3 z-10">
        <X size={20} />
      </button>

      <h2 className="text-center text-lg font-bold mb-4">
        {activeHoliday ? (
          <span>Send a Gift {activeHoliday.icon} {activeHoliday.name}</span>
        ) : (
          <span>Send a Gift 🎁</span>
        )}
      </h2>

      {/* Participant Target Selection (for battles) */}
      {participants.length > 1 && (
        <div className="mb-4">
          <div className="text-xs text-gray-400 mb-2">Send to:</div>
          <div className="flex gap-2 flex-wrap">
            {participants.map((p) => {
              const isSelected = giftTargetUserId === p.userId
              const displayName = p.userProfile?.username || p.role || 'Unknown'
              return (
                <button
                  key={p.userId}
                  onClick={() => setGiftTargetUserId(p.userId)}
                  className={`px-3 py-1 rounded-lg text-xs transition ${
                    isSelected
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {p.role === 'host' && '👑 '}
                  {p.role === 'opponent' && '⚔️ '}
                  {displayName}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {activeHoliday && (
        <div className="text-xs text-center mb-2 text-purple-300">
          {activeHoliday.name} Special Gifts Available!
        </div>
      )}

      <div className="text-sm mb-3 flex justify-between bg-gray-800 p-2 rounded-lg">
        <span>Paid Coins: {profile?.paid_coin_balance || 0}</span>
        <span>Free Coins: {profile?.free_coin_balance || 0}</span>
      </div>

      {loadingGifts ? (
        <div className="text-center py-8 text-gray-400">Loading gifts...</div>
      ) : (
        <div className={`grid grid-cols-2 gap-3 ${inline ? 'max-h-[calc(100vh-300px)]' : 'max-h-96'} overflow-y-auto`}>
          {displayGifts.map((gift) => {
          const paidBalance = profile?.paid_coin_balance || 0
          const freeBalance = profile?.free_coin_balance || 0
          const totalBalance = paidBalance + freeBalance
          const canAfford = totalBalance >= gift.coinCost
          
          // Determine which coin type to use (prefer paid, fallback to free)
          const usePaid = paidBalance >= gift.coinCost
          const useFree = !usePaid && freeBalance >= gift.coinCost
          const giftWithType = { ...gift, type: usePaid ? 'paid' : 'free' }
          
          const category = gift.category || 'Common'
          
          return (
            <button
              key={gift.id}
              disabled={isSending || !canAfford}
              onClick={() => handleGiftSend(giftWithType)}
              className={`gift-card p-3 rounded-lg text-sm flex flex-col items-center transition ${
                canAfford 
                  ? gift.holidayTheme 
                    ? 'bg-red-700/30 hover:bg-red-700/40 border-2 border-red-400' 
                    : category.toLowerCase() === 'common'
                    ? 'bg-purple-700/30 hover:bg-purple-700/40'
                    : category.toLowerCase() === 'premium'
                    ? 'bg-yellow-700/30 hover:bg-yellow-700/40'
                    : category.toLowerCase() === 'legendary'
                    ? 'bg-orange-700/30 hover:bg-orange-700/40'
                    : category.toLowerCase() === 'limited'
                    ? 'bg-red-700/30 hover:bg-red-700/40'
                    : category.toLowerCase() === 'seasonal'
                    ? 'bg-green-700/30 hover:bg-green-700/40'
                    : category.toLowerCase() === 'mystery'
                    ? 'bg-purple-700/30 hover:bg-purple-700/40'
                    : 'bg-purple-700/30 hover:bg-purple-700/40'
                  : 'bg-gray-700 opacity-50 cursor-not-allowed'
              } ${canAfford ? category.toLowerCase() : ''}`}
              title={gift.animationTheme || gift.specialEffect || gift.effect || ''}
            >
              <span className="gift-icon text-2xl">{gift.name.split(' ')[0]}</span>
              <span className="gift-name text-xs text-center mt-1">{gift.name.replace(/^[^\s]+\s/, '')}</span>
              {gift.holidayTheme && (
                <span className="text-[9px] text-yellow-300 mt-0.5">🎁 Holiday</span>
              )}
              <span className="gift-cost text-xs text-gray-300 mt-1">
                {gift.coinCost.toLocaleString()} 🪙
              </span>
              {canAfford && (
                <span className="text-[10px] text-purple-300 mt-0.5">
                  {usePaid ? 'Paid' : 'Free'}
                </span>
              )}
            </button>
          )
        })}
        </div>
      )}

      <button
        onClick={onClose}
        className="mt-4 bg-gray-700 w-full py-2 rounded-lg hover:bg-gray-600 transition"
      >
        Cancel
      </button>
    </div>
  )

  if (inline) {
    return modalContent
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      {modalContent}
    </div>
  )
}
