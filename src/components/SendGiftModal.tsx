import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useGiftSystem } from '../lib/hooks/useGiftSystem'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { getActiveHolidayTheme } from '../lib/holidayThemes'
import { OFFICIAL_GIFTS } from '../lib/giftConstants'

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

const GIFT_ITEMS = OFFICIAL_GIFTS.map(g => ({
  id: g.id,
  name: g.name,
  coinCost: g.cost,
  type: 'paid',
  tier: g.tier,
  icon: g.icon
}));

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

  // Fetch gift items from database (holiday + regular) and merge with hardcoded defaults
  useEffect(() => {
    if (!isOpen) return

    const fetchGiftItems = async () => {
      setLoadingGifts(true)
      try {
        const query = supabase
          .from('gift_items')
          .select('*')
          .order('value', { ascending: true })

        let data: any[] | null = null
        if (activeHoliday) {
          const res = await query.or(`holiday_theme.eq.${activeHoliday.name},holiday_theme.is.null`)
          if (res.error) throw res.error
          data = res.data
        } else {
          const res = await query.is('holiday_theme', null)
          if (res.error) throw res.error
          data = res.data
        }

        const dbPayload = (data || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          icon: item.icon || '',
          value: item.value,
          category: item.category || 'Common',
          holiday_theme: item.holiday_theme || null,
          description: item.description || undefined,
          animation_type: item.animation_type || undefined,
        }))

        // Build defaults map from hardcoded GIFT_ITEMS
        const defaultMap: Record<string, any> = {}
        for (const g of GIFT_ITEMS) {
          defaultMap[g.id] = {
            id: g.id,
            name: g.name,
            icon: (g as any).icon || '',
            value: (g as any).coinCost || (g as any).value || 0,
            category: g.category || 'Common',
            holiday_theme: null,
          }
        }

        // Merge: start with defaults, then override/add DB items
        const mergedMap: Record<string, any> = { ...defaultMap }
        for (const d of dbPayload) mergedMap[d.id] = d

        const merged = Object.values(mergedMap).sort((a: any, b: any) => (a.value || 0) - (b.value || 0))

        console.debug('SendGiftModal: merged gifts count', merged.length)
        setGiftItems(merged)
      } catch (err) {
        console.error('Error fetching gift items:', err)
        // Fallback to hardcoded gifts
        const fallback = GIFT_ITEMS.map((g) => ({
          id: g.id,
          name: g.name,
          icon: (g as any).icon || '',
          value: (g as any).coinCost || (g as any).value || 0,
          category: g.category || 'Common',
          holiday_theme: null,
        }))
        setGiftItems(fallback)
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
    <div className={`${inline ? 'w-full h-full' : 'bg-gray-900 p-6 w-full max-w-sm rounded-xl shadow-lg max-h-[90vh] overflow-y-auto'} text-white relative`}>
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
