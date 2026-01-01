import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export function useGiftEvents(streamId?: string | null) {
  const [lastGift, setLastGift] = useState<any>(null)

  useEffect(() => {
    if (!streamId) return

    console.log('🎁 Setting up gift events subscription for stream:', streamId)

    // Subscribe to both possible gift tables for compatibility
    const streamGiftsChannel = supabase
      .channel(`stream_gifts_events_${streamId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stream_gifts', filter: `stream_id=eq.${streamId}` },
        async (payload) => {
          console.log('🎁 New stream_gift received:', payload.new)
          await handleGiftPayload(payload.new, 'stream_gifts')
        }
      )
      .subscribe((status) => {
        console.log('📡 Stream gifts subscription status:', status)
      })

    const giftsChannel = supabase
      .channel(`gifts_events_${streamId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gifts', filter: `stream_id=eq.${streamId}` },
        async (payload) => {
          console.log('🎁 New gift received:', payload.new)
          await handleGiftPayload(payload.new, 'gifts')
        }
      )
      .subscribe((status) => {
        console.log('📡 Gifts subscription status:', status)
      })

    const handleGiftPayload = async (gift: any, tableType: string) => {
      try {
        // Fetch sender username for display
        let senderUsername = 'Anonymous'
        const senderId = tableType === 'stream_gifts' ? gift.from_user_id : gift.sender_id
        
        if (senderId) {
          try {
            const { data: senderProfile } = await supabase
              .from('user_profiles')
              .select('username')
              .eq('id', senderId)
              .single()
              
            if (senderProfile?.username) {
              senderUsername = senderProfile.username
            }
          } catch (e) {
            console.warn('Failed to fetch sender username:', e)
          }
        }
        
        // Transform gift data to match GiftEventOverlay expectations
        const transformedGift = {
          id: gift.gift_id || gift.id || 'unknown',
          coinCost: tableType === 'stream_gifts' 
            ? Number(gift.coins_amount || 0) 
            : Number(gift.coins_spent || 0),
          name: gift.message || gift.gift_type || 'Gift',
          sender_username: senderUsername,
          quantity: gift.quantity || 1,
          icon: getGiftIcon(gift.message || gift.gift_type || 'Gift'),
          ...gift
        }
        
        console.log('🎆 Transformed gift for display:', transformedGift)
        setLastGift(transformedGift)
        
        // Auto-clear after 5 seconds
        setTimeout(() => setLastGift(null), 5000)
      } catch (error) {
        console.error('Error handling gift payload:', error)
      }
    }

    const getGiftIcon = (giftType: string): string => {
      const iconMap: Record<string, string> = {
        'Heart': '❤️',
        'Troll Face': '🧌',
        'Gold Coin': '🪙',
        'Crown': '👑',
        'Diamond': '💎',
        'Rocket': '🚀',
        'paid': '🎁',
        'trollmond': '🧌',
      }
      return iconMap[giftType] || '🎁'
    }

    return () => {
      console.log('🧼 Cleaning up gift event subscriptions')
      supabase.removeChannel(streamGiftsChannel)
      supabase.removeChannel(giftsChannel)
    }
  }, [streamId])

  return lastGift
}
