import { useState, useEffect, useRef } from 'react'
import ReactionBubble from './ReactionBubble'
import { supabase } from '../../lib/supabase'

interface ReactionBubblesProps {
  streamId?: string
}

interface Reaction {
  id: string
  type: string
  timestamp: number
}

export default function ReactionBubbles({ streamId }: ReactionBubblesProps) {
  const [reactions, setReactions] = useState<Reaction[]>([])
  const processedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`reaction-bubbles-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_reactions',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const { id, reaction_type } = payload.new

          // Prevent duplicates
          if (processedIdsRef.current.has(id)) return
          processedIdsRef.current.add(id)

          setReactions((prev) => [
            ...prev,
            {
              id: `${id}-${Date.now()}`,
              type: reaction_type,
              timestamp: Date.now(),
            },
          ])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId])

  const handleComplete = (id: string) => {
    setReactions((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <>
      {reactions.map((reaction) => (
        <ReactionBubble
          key={reaction.id}
          id={reaction.id}
          type={reaction.type}
          onComplete={() => handleComplete(reaction.id)}
        />
      ))}
    </>
  )
}

