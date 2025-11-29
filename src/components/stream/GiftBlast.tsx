import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface GiftBlastProps {
  streamId: string | undefined
  onGiftTrigger?: (amount: number) => void
}

interface GiftBlastData {
  username: string
  amount: number
}

export default function GiftBlast({ streamId, onGiftTrigger }: GiftBlastProps) {
  const [blast, setBlast] = useState<GiftBlastData | null>(null)

  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`gifts_${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gifts',
          filter: `stream_id=eq.${streamId}`,
        },
        async (payload) => {
          // Fetch username from user_profiles
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('username')
            .eq('id', payload.new.sender_id)
            .single()

          if (profile) {
            const amount = payload.new.coins_spent || 0
            setBlast({
              username: profile.username,
              amount: amount,
            })

            // Trigger particle animation with amount
            onGiftTrigger?.(amount)

            // Remove after 5s
            setTimeout(() => setBlast(null), 5000)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId, onGiftTrigger])

  if (!blast) return null

  return (
    <div className="absolute right-6 top-1/4 bg-purple-800/70 px-6 py-4 rounded-xl border border-purple-300 text-white shadow-xl animate-giftDrop z-30">
      🎁 <strong>{blast.username}</strong> sent{' '}
      <span className="text-cyan-300">{blast.amount} GEMs!</span>
    </div>
  )
}

