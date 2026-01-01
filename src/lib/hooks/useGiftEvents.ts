import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export function useGiftEvents(streamId?: string | null) {
  const [lastGift, setLastGift] = useState<any>(null)

  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`gift_events_${streamId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gifts', filter: `stream_id=eq.${streamId}` },
        async (payload) => {
          const gift = payload.new;
          
          // ✅ Fetch sender username for display
          let senderUsername = 'Anonymous';
          if (gift.sender_id) {
            try {
              const { data: senderProfile } = await supabase
                .from('user_profiles')
                .select('username')
                .eq('id', gift.sender_id)
                .single();
              
              if (senderProfile?.username) {
                senderUsername = senderProfile.username;
              }
            } catch (e) {
              console.warn('Failed to fetch sender username:', e);
            }
          }
          
          // ✅ Transform gift data to match GiftEventOverlay expectations
          const transformedGift = {
            id: gift.gift_id || gift.id || 'unknown',
            coinCost: Number(gift.coins_spent || 0),
            name: gift.message || gift.gift_type || 'Gift',
            sender_username: senderUsername,
            quantity: gift.quantity || 1,
            ...gift
          };
          
          setLastGift(transformedGift);
        }
      )
    channel.subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [streamId])

  return lastGift
}
