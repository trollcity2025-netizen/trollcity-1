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
        (payload) => setLastGift(payload.new)
      )
    channel.subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [streamId])

  return lastGift
}
