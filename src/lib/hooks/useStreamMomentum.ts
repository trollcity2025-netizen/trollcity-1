import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useStreamMomentum(streamId: string | null) {
  const [momentum, setMomentum] = useState<number | null>(null)

  useEffect(() => {
    let isMounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    const init = async () => {
      if (!streamId) {
        setMomentum(null)
        return
      }

      const { data, error } = await supabase
        .from('streams')
        .select('momentum')
        .eq('id', streamId)
        .single()

      if (!isMounted) return

      if (error) {
        console.error('Error fetching momentum:', error)
        setMomentum(0)
      } else {
        setMomentum(data?.momentum ?? 0)
      }

      channel = supabase
        .channel(`stream-momentum-${streamId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'streams',
            filter: `id=eq.${streamId}`,
          },
          (payload) => {
            if (isMounted) {
              setMomentum((payload.new as any)?.momentum ?? 0)
            }
          }
        )
        .subscribe()
    }

    void init()

    return () => {
      isMounted = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [streamId])

  return { momentum }
}
