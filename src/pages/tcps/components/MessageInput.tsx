import { useState, KeyboardEvent, useRef, useEffect } from 'react'
import { Send, Smile } from 'lucide-react'
import { supabase, sendConversationMessage, OFFICER_GROUP_CONVERSATION_ID, sendOfficerMessage } from '../../../lib/supabase'
import { sendNotification } from '../../../lib/sendNotification'
import { useAuthStore } from '../../../lib/store'
import { useJailMode } from '../../../hooks/useJailMode'
import { canMessageAdmin } from '../../../lib/perkEffects'
import { chargeMessageCost } from '../../../lib/profileViewPayment'
import { toast } from 'sonner'

interface MessageInputProps {
  conversationId: string | null
  otherUserId: string | null
  onMessageSent: () => void
  onNewMessage?: (msg: any) => void
  onTyping?: (isTyping: boolean) => void
}

export default function MessageInput({ conversationId, otherUserId, onMessageSent, onNewMessage, onTyping }: MessageInputProps) {
  const { user: _user, profile } = useAuthStore()
  const { isJailed } = useJailMode(profile?.id)
  const [isOtherUserAdmin, setIsOtherUserAdmin] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!otherUserId) return
    
    const checkOtherUser = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('role, is_admin')
        .eq('id', otherUserId)
        .single()
      
      if (data) {
        setIsOtherUserAdmin(data.role === 'admin' || data.is_admin === true)
      }
    }
    
    checkOtherUser()
  }, [otherUserId])

  useEffect(() => {
    if (!conversationId) return
    const channel = supabase.channel(`chat:${conversationId}`)
    channel.subscribe()
    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  const handleTyping = () => {
    if (channelRef.current && profile?.id) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: profile.id, isTyping: true }
      })
    }

    if (onTyping) {
      onTyping(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false)
        if (channelRef.current && profile?.id) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId: profile.id, isTyping: false }
            })
        }
      }, 3000)
    }
  }

  const sendMessage = async () => {
    if (!message.trim() || !otherUserId || !profile?.id || sending) return

    // Jail restriction: Inmates can only message admins
    if (isJailed && !isOtherUserAdmin) {
      toast.error('As an inmate, you can only message administrators.')
      return
    }

    if (!conversationId) {
      toast.error('Conversation not ready')
      return
    }

    const currentMessage = message.trim()
    setMessage('')
    setSending(true)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      if (onTyping) onTyping(false)
    }

    // Proactively notify receiver via broadcast for instant UI update
    if (channelRef.current) {
        channelRef.current.send({
            type: 'broadcast',
            event: 'new-message',
            payload: {
                id: `temp-${Date.now()}`,
                sender_id: profile.id,
                content: currentMessage,
                created_at: new Date().toISOString(),
                sender_username: profile.username,
                sender_avatar_url: profile.avatar_url,
                sender_rgb_expires_at: profile.rgb_username_expires_at,
                sender_glowing_username_color: profile.glowing_username_color
            }
        })
    }

    try {
      // Handle OPS group message
      if (conversationId === OFFICER_GROUP_CONVERSATION_ID) {
        await sendOfficerMessage(currentMessage, 'normal')
        onMessageSent()
        setSending(false)
        inputRef.current?.focus()
        return
      }
      
      // Regular DM message
      // Check if user needs to pay to message
      const { data: toUser } = await supabase
        .from('user_profiles')
        .select('id, username, message_cost, role, is_troll_officer, is_troller')
        .eq('id', otherUserId)
        .single()

      if (!toUser) {
        toast.error('User not found')
        setSending(false)
        return
      }

      const senderRole = profile.role
      const senderIsOfficer = profile.is_troll_officer || profile.is_officer
      const senderIsTroller = profile.is_troller
      const senderIsAdmin = senderRole === 'admin' || profile.is_admin
      const hasMessagePerk = await canMessageAdmin(profile.id)
      const canMessageFree = senderIsAdmin || senderIsOfficer || senderIsTroller || hasMessagePerk

      if (!canMessageFree && toUser.message_cost && toUser.message_cost > 0) {
        const { success, error: paymentError } = await chargeMessageCost(
          profile.id,
          toUser.id,
          toUser.message_cost
        )

        if (!success) {
          toast.error(paymentError || 'Payment required to message this user')
          setSending(false)
          return
        }
      }
      
      await sendConversationMessage(conversationId, currentMessage)
      
      // Notify the user via push/system notification
      await sendNotification(
        otherUserId,
        'message',
        `New message from ${profile.username}`,
        currentMessage.length > 50 ? currentMessage.substring(0, 50) + '...' : currentMessage,
        {
          conversation_id: conversationId,
          sender_id: profile.id
        }
      )

      if (onNewMessage) {
        // onNewMessage(newMsg) - disabled to prevent double rendering as subscription handles it
      }
      onMessageSent()
    } catch (error: any) {
      console.error('Error sending message:', error)
      toast.error(error.message || 'Failed to send message')
      // If failed, we might want to let the user know their proactive message didn't save
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="p-4 bg-[#14141F] border-t border-purple-500/20">
      {isJailed && !isOtherUserAdmin ? (
        <div className="flex items-center justify-center p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <span>Communication restricted: You can only message admins while in jail.</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button 
            className="p-2 text-gray-400 hover:text-purple-400 transition-colors"
            title="Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value)
                handleTyping()
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="w-full bg-[#0A0A14] border border-purple-500/30 rounded-full px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
              disabled={sending}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!message.trim() || sending}
            className={`p-2 rounded-full transition-all ${
              !message.trim() || sending
                ? 'text-gray-600 bg-gray-800/50 cursor-not-allowed'
                : 'text-white bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-500/20'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}
