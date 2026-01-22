import { useState, KeyboardEvent, useRef } from 'react'
import { Send, Smile } from 'lucide-react'
import { supabase, sendConversationMessage } from '../../../lib/supabase'
import { sendNotification } from '../../../lib/sendNotification'
import { useAuthStore } from '../../../lib/store'
import { canMessageAdmin } from '../../../lib/perkEffects'
import { toast } from 'sonner'

interface MessageInputProps {
  otherUserId: string | null
  conversationId: string | null
  onMessageSent: () => void
}

export default function MessageInput({ otherUserId, conversationId, onMessageSent }: MessageInputProps) {
  const { profile } = useAuthStore()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const sendMessage = async () => {
    if (!message.trim() || !otherUserId || !profile?.id || sending) return
    if (!conversationId) {
      toast.error('Conversation not ready')
      return
    }

    setSending(true)

    try {
      // Check if user needs to pay to message
      const { data: toUser } = await supabase
        .from('user_profiles')
        .select('id, username, profile_view_price, role, is_troll_officer, is_troller')
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

      if (!canMessageFree && toUser.profile_view_price && toUser.profile_view_price > 0) {
        const { data: paymentResult, error: paymentError } = await supabase.rpc('pay_for_profile_view', {
          p_viewer_id: profile.id,
          p_profile_owner_id: toUser.id
        })

        if (paymentError || !paymentResult?.success) {
          const errorMsg = paymentResult?.error || paymentError?.message || 'Payment required to message this user'
          toast.error(errorMsg)
          return
        }
      }

      // Send message
      const messageContent = message.trim();
      const sentMessage = await sendConversationMessage(conversationId, messageContent)

      console.log('✅ Message sent successfully:', sentMessage.id);

      try {
        await sendNotification(
          otherUserId,
          'message',
          'New message',
          `New message from ${profile.username}`,
          { sender_id: profile.id }
        )
      } catch (notifErr) {
        console.warn('Notification error (non-critical):', notifErr)
      }

      // Clear input immediately
      setMessage('')
      
      // Trigger callback - parent component can handle refresh if needed
      onMessageSent()
      
      // Broadcast message via Realtime channel for instant delivery (fallback if postgres_changes is slow)
      // Note: We're broadcasting the new conversation message structure
      try {
        const channel = supabase.channel(`conversation:${conversationId}`, {
          config: {
            broadcast: { self: true }
          }
        })
        channel.subscribe()
        await channel.send({
          type: 'broadcast',
          event: 'new_message',
          payload: {
            ...sentMessage,
            sender_username: profile.username,
            sender_avatar_url: profile.avatar_url
          }
        })
        supabase.removeChannel(channel)
      } catch (broadcastErr) {
        console.warn('Broadcast error (non-critical):', broadcastErr);
      }
    } catch (error: any) {
      console.error('Error sending message:', error)
      toast.error(error.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const sendTyping = () => {
    if (!otherUserId || !profile?.id) return

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Send typing indicator
    const channel = supabase.channel(`typing:${profile.id}:${otherUserId}`, {
      config: {
        broadcast: { self: true }
      }
    })
    channel.subscribe()
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { sender: profile.id }
    }).finally(() => {
      supabase.removeChannel(channel)
    })

    // Clear typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      // Typing indicator will auto-clear on receiver side
    }, 2000)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="sticky bottom-0 p-4 pb-[calc(16px+env(safe-area-inset-bottom))] border-t border-[#8a2be2]/30 bg-[rgba(10,0,30,0.85)] backdrop-blur">
      <div className="flex items-end gap-2">
        <button
          type="button"
          className="p-2 hover:bg-[rgba(155,50,255,0.1)] rounded-lg transition"
          title="Emoji"
        >
          <Smile className="w-5 h-5 text-[#8a2be2]" />
        </button>
        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              sendTyping()
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="w-full px-4 py-2 bg-[rgba(20,0,50,0.6)] border border-[#8a2be2]/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8a2be2] focus:border-[#8a2be2] resize-none max-h-32"
            style={{ minHeight: '44px' }}
          />
        </div>
        <button
          type="button"
          onClick={sendMessage}
          disabled={!message.trim() || sending}
          className="p-2 bg-gradient-to-r from-[#9b32ff] to-[#00ffcc] text-black rounded-xl hover:shadow-lg hover:shadow-[#9b32ff]/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

