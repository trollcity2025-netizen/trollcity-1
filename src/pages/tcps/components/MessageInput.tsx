import { useState, KeyboardEvent, useRef } from 'react'
import { Send, Smile } from 'lucide-react'
import { supabase, sendConversationMessage } from '../../../lib/supabase'
import { sendNotification } from '../../../lib/sendNotification'
import { useAuthStore } from '../../../lib/store'
import { canMessageAdmin } from '../../../lib/perkEffects'
import { toast } from 'sonner'

interface MessageInputProps {
  conversationId: string | null
  otherUserId: string | null
  onMessageSent: () => void
}

export default function MessageInput({ conversationId, otherUserId, onMessageSent }: MessageInputProps) {
  const { user, profile } = useAuthStore()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
          setSending(false)
          return
        }
      }

      await sendConversationMessage(conversationId, message)
      
      // Notify the user
      await sendNotification({
        userId: otherUserId,
        type: 'message',
        title: `New message from ${profile.username}`,
        message: message.length > 50 ? message.substring(0, 50) + '...' : message,
        metadata: {
          conversation_id: conversationId,
          sender_id: profile.id
        }
      })

      setMessage('')
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
            onChange={(e) => setMessage(e.target.value)}
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
