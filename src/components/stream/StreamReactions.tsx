import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

interface StreamReactionsProps {
  streamId: string | undefined
  onReaction?: (type: string, userId: string) => void
}

interface ReactionItem {
  id: string
  emoji: string
  left: number
  timestamp: number
}

const reactionEmojis: Record<string, string> = {
  heart: '❤️',
  troll: '🧌',
  gift: '🎁',
  fire: '🔥',
  diamond: '💎',
  crown: '👑',
}

export default function StreamReactions({ streamId, onReaction }: StreamReactionsProps) {
  const [reactions, setReactions] = useState<ReactionItem[]>([])
  const reactionIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`stream-reactions-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_reactions',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const { reaction_type, user_id, id } = payload.new

          // Prevent duplicate reactions (in case of re-renders)
          if (reactionIdsRef.current.has(id)) {
            return
          }
          reactionIdsRef.current.add(id)

          // Trigger animation
          const emoji = reactionEmojis[reaction_type] || '❤️'
          const newReaction: ReactionItem = {
            id: `${id}-${Date.now()}`,
            emoji,
            left: Math.random() * 80 + 10, // Random position 10-90%
            timestamp: Date.now(),
          }

          setReactions((prev) => [...prev, newReaction])

          // Callback for external handling
          onReaction?.(reaction_type, user_id)

          // Remove reaction after animation completes
          setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== newReaction.id))
            reactionIdsRef.current.delete(id)
          }, 4000) // Match animation duration
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId, onReaction])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
      {reactions.map((reaction) => (
        <div
          key={reaction.id}
          className="absolute animate-float-emoji text-4xl"
          style={{
            left: `${reaction.left}%`,
            bottom: '-5%',
          }}
        >
          {reaction.emoji}
        </div>
      ))}
    </div>
  )
}

