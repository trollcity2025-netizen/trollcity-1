// BattleChatOverlay: Shared chat with auto-fade messages
import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { UserBadge } from '../UserBadge'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatMessage {
  id: string
  sender_id: string
  message: string
  created_at: string
  user_profiles?: {
    username: string
    avatar_url?: string
    is_troll_officer?: boolean
    is_og_user?: boolean
    role?: string
  }
}

interface BattleChatOverlayProps {
  streamId: string
  battleId?: string | null
}

const MESSAGE_LIFETIME = 7000 // 7 seconds

export default function BattleChatOverlay({ streamId, battleId }: BattleChatOverlayProps) {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const messagesRef = useRef<ChatMessage[]>([])

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      let query = supabase
        .from('chat_messages')
        .select(`
          id,
          sender_id,
          message,
          created_at,
          user_profiles:user_id (
            username,
            avatar_url,
            is_troll_officer,
            is_og_user,
            role
          )
        `)
        .eq('stream_id', streamId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (battleId) {
        query = query.eq('battle_id', battleId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error loading chat messages:', error)
        return
      }

      const loadedMessages = (data || []).reverse() // Reverse to show oldest first
      setMessages(loadedMessages)
      messagesRef.current = loadedMessages
    }

    loadMessages()
  }, [streamId, battleId])

  // Subscribe to new messages
  useEffect(() => {
    const channel = supabase
      .channel(`chat_${streamId}_${battleId || 'none'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: battleId
            ? `stream_id=eq.${streamId} AND battle_id=eq.${battleId}`
            : `stream_id=eq.${streamId}`,
        },
        async (payload) => {
          // Fetch user profile for new message
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('username, avatar_url, is_troll_officer, is_og_user, role')
            .eq('id', payload.new.sender_id)
            .single()

          const newMessage: ChatMessage = {
            id: payload.new.id,
            sender_id: payload.new.sender_id,
            message: payload.new.message,
            created_at: payload.new.created_at,
            user_profiles: profile || undefined,
          }

          setMessages((prev) => {
            const updated = [...prev, newMessage]
            messagesRef.current = updated
            // Keep only last 50 messages
            return updated.slice(-50)
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId, battleId])

  return (
    <div className="fixed bottom-4 left-4 z-40 max-w-md pointer-events-none">
      <div className="flex flex-col gap-2">
        <AnimatePresence>
          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} message={msg} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
    }, MESSAGE_LIFETIME)

    return () => clearTimeout(timer)
  }, [])

  if (!isVisible) return null

  const username = message.user_profiles?.username || 'Anonymous'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 text-sm text-white pointer-events-auto"
    >
      <div className="flex items-center gap-2">
        <span className="font-semibold text-purple-300">{username}</span>
        {message.user_profiles && <UserBadge profile={message.user_profiles} />}
        <span className="text-gray-300">:</span>
        <span className="flex-1">{message.message}</span>
      </div>
    </motion.div>
  )
}

