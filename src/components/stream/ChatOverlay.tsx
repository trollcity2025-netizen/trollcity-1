import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface ChatOverlayProps {
  streamId: string | undefined
}

interface ChatMessage {
  id: string
  user_id: string
  content: string
  message_type: string
  created_at: string
  user_profiles?: {
    username: string
  }
}

export default function ChatOverlay({ streamId }: ChatOverlayProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    if (!streamId) return

    // Load initial messages
    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select(`
          *,
          user_profiles:user_id ( username )
        `)
        .eq('stream_id', streamId)
        .eq('message_type', 'chat')
        .order('created_at', { ascending: false })
        .limit(5)

      if (data) {
        setMessages(data.reverse()) // Reverse to show oldest first
      }
    }

    loadMessages()

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat_${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `stream_id=eq.${streamId}`,
        },
        async (payload) => {
          // Fetch the new message with user profile
          const { data: newMsg } = await supabase
            .from('messages')
            .select(`
              *,
              user_profiles:user_id ( username )
            `)
            .eq('id', payload.new.id)
            .single()

          if (newMsg && newMsg.message_type === 'chat') {
            setMessages((prev) => {
              const updated = [...prev, newMsg]
              // Keep only last 5 messages
              return updated.slice(-5)
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId])

  return (
    <div className="absolute bottom-[18%] left-6 space-y-2 max-w-[40%] z-20">
      {messages.map((msg, idx) => {
        const username = msg.user_profiles?.username || 'Unknown'
        return (
          <div
            key={msg.id || idx}
            className={`px-4 py-2 rounded-xl shadow-lg backdrop-blur-md text-white animate-chatBubble ${
              msg.message_type === 'gift' ? 'bg-purple-600/70' : 'bg-black/50'
            }`}
          >
            <strong className="text-purple-300">{username}:</strong>{' '}
            <span>{msg.content}</span>
          </div>
        )
      })}
    </div>
  )
}

