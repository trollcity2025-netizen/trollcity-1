import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import ClickableUsername from '../ClickableUsername'
import { UserBadge } from '../UserBadge'
import { useAuthStore } from '../../lib/store'
import { translateMessage } from '../../lib/translation'

interface ChatOverlayProps {
  streamId: string | undefined
  compact?: boolean
}

interface ChatMessage {
  id: string
  user_id: string
  content: string
  message_type: string
  created_at: string
  user_profiles?: {
    username: string
    avatar_url?: string
    is_troll_officer?: boolean
    is_admin?: boolean
    is_troller?: boolean
    is_og_user?: boolean
    officer_level?: number
    troller_level?: number
    role?: string
  }
}

export default function ChatOverlay({ streamId, compact = false }: ChatOverlayProps) {
  const { profile } = useAuthStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({})
  const userLanguage = profile?.preferred_language || 'en'

  useEffect(() => {
    if (!streamId) return

    // Load initial messages
    const loadMessages = async () => {
      const { data } = await supabase
        .from('stream_messages')
        .select(`
          *,
          user_profiles:user_id ( username, avatar_url, is_troll_officer, is_admin, is_troller, is_og_user, officer_level, troller_level, role )
        `)
        .eq('stream_id', streamId)
        .eq('message_type', 'chat')
        .order('created_at', { ascending: false })
        .limit(50)

      if (data) {
        setMessages(data.reverse()) // Reverse to show oldest first
      }
    }

    loadMessages()

    // Subscribe to new messages
    const channel = supabase
      .channel(`stream-chat-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_messages',
          filter: `stream_id=eq.${streamId}`,
        },
        async (payload) => {
          // Fetch the new message with user profile
          const { data: newMsg } = await supabase
            .from('stream_messages')
            .select(`
              *,
              user_profiles:user_id ( username, avatar_url, is_troll_officer, is_admin, is_troller, is_og_user, officer_level, troller_level, role )
            `)
            .eq('id', payload.new.id)
            .single()

          if (newMsg && newMsg.message_type === 'chat') {
            setMessages((prev) => {
              const updated = [...prev, newMsg]
              // Keep only last 50 messages
              return updated.slice(-50)
            })

            // Translate message if user has a different language preference
            if (userLanguage && userLanguage !== 'en' && newMsg.content) {
              translateMessage(newMsg.content, userLanguage)
                .then(translated => {
                  if (translated && translated !== newMsg.content) {
                    setTranslatedMessages(prev => ({
                      ...prev,
                      [newMsg.id]: translated
                    }))
                  }
                })
                .catch(err => {
                  console.error('Chat translation error:', err)
                })
            }

            // Auto-remove after 45 seconds
            setTimeout(() => {
              setMessages((prev) => prev.filter((m) => m.id !== newMsg.id))
              setTranslatedMessages(prev => {
                const updated = { ...prev }
                delete updated[newMsg.id]
                return updated
              })
            }, 45000)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId])

  // Always render as message list for chat container
  return (
    <AnimatePresence mode="popLayout">
      {messages.map((msg) => {
        const username = msg.user_profiles?.username || 'Guest'
        const displayText = translatedMessages[msg.id] || msg.content
        
        return (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="message-item"
          >
            <strong>
              <ClickableUsername 
                username={username} 
                prefix=""
                profile={msg.user_profiles}
              />
              <UserBadge profile={msg.user_profiles} />
            </strong>
            <span className="ml-1">: {displayText}</span>
          </motion.div>
        )
      })}
    </AnimatePresence>
  )
}
