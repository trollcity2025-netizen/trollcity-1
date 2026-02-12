import { useState, KeyboardEvent, useRef, useEffect } from 'react'
import { Send, Smile } from 'lucide-react'
import { supabase, sendConversationMessage, OFFICER_GROUP_CONVERSATION_ID, sendOfficerMessage } from '../../../lib/supabase'
import { sendNotification } from '../../../lib/sendNotification'
import { useAuthStore } from '../../../lib/store'
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
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

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
    if (!conversationId) {
      toast.error('Conversation not ready')
      return
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      if (onTyping) onTyping(false)
    }

    setSending(true)

    try {
      // Handle OPS group message
      if (conversationId === OFFICER_GROUP_CONVERSATION_ID) {
        await sendOfficerMessage(message, 'normal')
        setMessage('')
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
      
      await sendConversationMessage(conversationId, message)
      
      // Notify the user
      await sendNotification(
        otherUserId,
        'message',
        `New message from ${profile.username}`,
        message.length > 50 ? message.substring(0, 50) + '...' : message,
        {
          conversation_id: conversationId,
          sender_id: profile.id
        }
      )

      setMessage('')
      if (onNewMessage) {
        // onNewMessage(newMsg) - disabled to prevent double rendering as subscription handles it
      }
      onMessageSent()
    } catch (error: any) {
      console.error('Error sending message:', error)
      toast.error(error.message || 'Failed to send message')
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
            message.trim() && !sending
              ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)]'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
