import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface StreamEarningsState {
  totalCoins: number
  giftCount: number
  topGifterId: string | null
  topGifterCoins: number
}

export function useStreamEarnings(streamId?: string | null): StreamEarningsState {
  const [state, setState] = useState<StreamEarningsState>({ totalCoins: 0, giftCount: 0, topGifterId: null, topGifterCoins: 0 })

  useEffect(() => {
    if (!streamId) return

    const loadInitial = async () => {
      const { data, error } = await supabase
        .from('gifts')
        .select('sender_id, coins_spent')
        .eq('stream_id', streamId)

      if (error) return

      if (!data || data.length === 0) {
        setState({ totalCoins: 0, giftCount: 0, topGifterId: null, topGifterCoins: 0 })
        return
      }

      const totals: Record<string, number> = {}
      let totalCoins = 0
      for (const g of data as any[]) {
        const coins = g.coins_spent || 0
        totalCoins += coins
        if (!totals[g.sender_id]) totals[g.sender_id] = 0
        totals[g.sender_id] += coins
      }

      let topGifterId: string | null = null
      let topGifterCoins = 0
      for (const [senderId, coins] of Object.entries(totals)) {
        if (coins > topGifterCoins) { topGifterCoins = coins; topGifterId = senderId }
      }

      setState({ totalCoins, giftCount: data.length, topGifterId, topGifterCoins })
    }

    loadInitial()

    const channel = supabase
      .channel(`gift_earnings_${streamId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gifts', filter: `stream_id=eq.${streamId}` },
        (payload) => {
          const g: any = payload.new
          const coins = g.coins_spent || 0
          setState((prev) => {
            let topGifterId = prev.topGifterId
            let topGifterCoins = prev.topGifterCoins
            if (!topGifterId) { topGifterId = g.sender_id; topGifterCoins = coins }
            else if (g.sender_id === topGifterId) { topGifterCoins = prev.topGifterCoins + coins }
            else { if (coins > topGifterCoins) { topGifterId = g.sender_id; topGifterCoins = coins } }
            return { totalCoins: prev.totalCoins + coins, giftCount: prev.giftCount + 1, topGifterId, topGifterCoins }
          })
        }
      )
    channel.subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [streamId])

  return state
}
