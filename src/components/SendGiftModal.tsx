import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useGiftSystem } from '../lib/hooks/useGiftSystem'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { getActiveHolidayTheme } from '../lib/holidayThemes'

export interface StreamParticipant {
  userId: string
  role: string
  userProfile?: {
    username: string
    avatar_url?: string | null
  }
}

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
  { id: 'troll_clap', name: 'Troll Clap', coinCost: 5, type: 'paid' },
  { id: 'glow_heart', name: 'Glow Heart', coinCost: 10, type: 'paid' },
  { id: 'sticker_bomb', name: 'Sticker Bomb', coinCost: 15, type: 'paid' },
  { id: 'mini_crown', name: 'Mini Crown', coinCost: 20, type: 'paid' },
  { id: 'troll_soda', name: 'Troll Soda', coinCost: 25, type: 'paid' },
  { id: 'laughing_mask', name: 'Laughing Mask', coinCost: 30, type: 'paid' },
  { id: 'purple_rose', name: 'Purple Rose', coinCost: 40, type: 'paid' },
  { id: 'hype_horn', name: 'Hype Horn', coinCost: 50, type: 'paid' },
  { id: 'emoji_rain', name: 'Emoji Rain', coinCost: 60, type: 'paid' },
  { id: 'gold_spark', name: 'Gold Spark', coinCost: 75, type: 'paid' },
  { id: 'troll_mic_drop', name: 'Troll Mic Drop', coinCost: 100, type: 'paid' },
  { id: 'vip_wristband', name: 'VIP Wristband', coinCost: 120, type: 'paid' },
  { id: 'fire_trail', name: 'Fire Trail', coinCost: 150, type: 'paid' },
  { id: 'neon_wings', name: 'Neon Wings', coinCost: 180, type: 'paid' },
  { id: 'troll_taxi', name: 'Troll Taxi', coinCost: 200, type: 'paid' },
  { id: 'street_graffiti', name: 'Street Graffiti', coinCost: 250, type: 'paid' },
  { id: 'troll_boom_box', name: 'Troll Boom Box', coinCost: 300, type: 'paid' },
  { id: 'diamond_smile', name: 'Diamond Smile', coinCost: 350, type: 'paid' },
  { id: 'the_troll_drink', name: 'The Troll Drink', coinCost: 400, type: 'paid' },
  { id: 'gold_handshake', name: 'Gold Handshake', coinCost: 450, type: 'paid' },
  { id: 'troll_spotlight', name: 'Troll Spotlight', coinCost: 500, type: 'paid' },
  { id: 'neon_camera', name: 'Neon Camera', coinCost: 600, type: 'paid' },
  { id: 'streamer_shield', name: 'Streamer Shield', coinCost: 750, type: 'paid' },
  { id: 'troll_confetti', name: 'Troll Confetti', coinCost: 850, type: 'paid' },
  { id: 'bubble_throne', name: 'Bubble Throne', coinCost: 950, type: 'paid' },
  { id: 'crown_blast', name: 'Crown Blast', coinCost: 1200, type: 'paid' },
  { id: 'purple_lightning', name: 'Purple Lightning', coinCost: 1500, type: 'paid' },
  { id: 'troll_limo', name: 'Troll Limo', coinCost: 2000, type: 'paid' },
  { id: 'gold_vault', name: 'Gold Vault', coinCost: 2500, type: 'paid' },
  { id: 'district_flag', name: 'District Flag', coinCost: 3000, type: 'paid' },
  { id: 'troll_court_gavel', name: 'Troll Court Gavel', coinCost: 3500, type: 'paid' },
  { id: 'neon_dragon', name: 'Neon Dragon', coinCost: 4000, type: 'paid' },
  { id: 'hologram_crown', name: 'Hologram Crown', coinCost: 4500, type: 'paid' },
  { id: 'street_king', name: 'Street King', coinCost: 5000, type: 'paid' },
  { id: 'troll_jet', name: 'Troll Jet', coinCost: 6000, type: 'paid' },
  { id: 'diamond_storm', name: 'Diamond Storm', coinCost: 7000, type: 'paid' },
  { id: 'ghost_rider_troll', name: 'Ghost Rider Troll', coinCost: 8000, type: 'paid' },
  { id: 'luxury_yacht', name: 'Luxury Yacht', coinCost: 10000, type: 'paid' },
  { id: 'meteor_drop', name: 'Meteor Drop', coinCost: 12000, type: 'paid' },
  { id: 'the_big_crown', name: 'The Big Crown', coinCost: 15000, type: 'paid' },
  { id: 'golden_throne', name: 'Golden Throne', coinCost: 20000, type: 'paid' },
  { id: 'crown_of_kings', name: 'Crown of Kings', coinCost: 25000, type: 'paid' },
  { id: 'district_takeover', name: 'District Takeover', coinCost: 30000, type: 'paid' },
  { id: 'troll_city_skyline', name: 'Troll City Skyline', coinCost: 35000, type: 'paid' },
  { id: 'titan_crown_drop', name: 'Titan Crown Drop', coinCost: 40000, type: 'paid' },
  { id: 'diamond_crown_aura', name: 'Diamond Crown Aura', coinCost: 50000, type: 'paid' },
  { id: 'royal_parade', name: 'Royal Parade', coinCost: 60000, type: 'paid' },
  { id: 'neon_godzilla_troll', name: 'Neon Godzilla Troll', coinCost: 75000, type: 'paid' },
  { id: 'golden_city_explosion', name: 'Golden City Explosion', coinCost: 100000, type: 'paid' },
  { id: 'the_crowned_legend', name: 'The Crowned Legend', coinCost: 120000, type: 'paid' },
  { id: 'millionaire_crown', name: 'The Millionaire Crown', coinCost: 250000, type: 'paid' },
  { id: 'troll_city_bank_heist', name: 'Troll City Bank Heist', coinCost: 300000, type: 'paid' },
  { id: 'private_jet_champagne', name: 'Private Jet + Champagne', coinCost: 350000, type: 'paid' },
  { id: 'diamond_vault_explosion', name: 'Diamond Vault Explosion', coinCost: 400000, type: 'paid' },
  { id: 'golden_crown_storm', name: 'Golden Crown Storm', coinCost: 500000, type: 'paid' },
  { id: 'the_kingmaker', name: 'The Kingmaker', coinCost: 600000, type: 'paid' },
  { id: 'neon_dragon_dynasty', name: 'Neon Dragon Dynasty', coinCost: 750000, type: 'paid' },
  { id: 'troll_city_penthouse', name: 'Troll City Penthouse', coinCost: 900000, type: 'paid' },
  { id: 'the_billionaire_throne', name: 'The Billionaire Throne', coinCost: 1000000, type: 'paid' },
  { id: 'crowned_emperor', name: 'Crowned Emperor', coinCost: 1500000, type: 'paid' },
  { id: 'family_banner_drop', name: 'Family Banner Drop', coinCost: 2500, type: 'paid', category: 'Family' },
  { id: 'family_shield', name: 'Family Shield', coinCost: 5000, type: 'paid', category: 'Family' },
  { id: 'family_rally_horn', name: 'Family Rally Horn', coinCost: 7500, type: 'paid', category: 'Family' },
  { id: 'family_loot_chest', name: 'Family Loot Chest', coinCost: 12000, type: 'paid', category: 'Family' },
  { id: 'family_war_flag', name: 'Family War Flag', coinCost: 25000, type: 'paid', category: 'Family' },
  { id: 'family_armory_drop', name: 'Family Armory Drop', coinCost: 35000, type: 'paid', category: 'Family' },
  { id: 'family_firestorm', name: 'Family Firestorm', coinCost: 60000, type: 'paid', category: 'Family' },
  { id: 'family_crown_raid', name: 'Family Crown Raid', coinCost: 75000, type: 'paid', category: 'Family' },
  { id: 'family_dynasty_throne', name: 'Family Dynasty Throne', coinCost: 120000, type: 'paid', category: 'Family' },
  { id: 'family_war_titan', name: 'Family War Titan', coinCost: 250000, type: 'paid', category: 'Family' },
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
        <span>troll_coins: {profile?.troll_coins || 0}</span>
        <span>Free Coins: {profile?.troll_coins || 0}</span>
      </div>

      {loadingGifts ? (
        <div className="text-center py-8 text-gray-400">Loading gifts...</div>
      ) : (
        <div className={`grid grid-cols-2 gap-3 ${inline ? 'max-h-[calc(100vh-300px)]' : 'max-h-96'} overflow-y-auto`}>
          {displayGifts.map((gift) => {
          const paidBalance = profile?.troll_coins || 0
          const freeBalance = profile?.troll_coins || 0
          const totalBalance = paidBalance + freeBalance
          const canAfford = totalBalance >= gift.coinCost
          
          // Determine which coin type to use (prefer paid, fallback to free)
          const usePaid = paidBalance >= gift.coinCost
          const giftWithType = { ...gift, type: usePaid ? 'paid' : 'free' }
          
          const category = gift.category || 'Common'
          
          return (
            <button
              key={gift.id}
              disabled={isSending || !canAfford}
              onClick={() => handleGiftSend(giftWithType)}
              className={`gift-card p-3 rounded-lg text-sm flex flex-col items-center transition ${
                canAfford 
                  ? (gift as any).holidayTheme 
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
              title={(gift as any).animationTheme || (gift as any).specialEffect || (gift as any).effect || ''}
            >
              <span className="gift-icon text-2xl">{gift.name.split(' ')[0]}</span>
              <span className="gift-name text-xs text-center mt-1">{gift.name.replace(/^[^\s]+\s/, '')}</span>
              {(gift as any).holidayTheme && (
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
