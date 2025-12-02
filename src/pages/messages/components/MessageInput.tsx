import { useState, KeyboardEvent, useRef } from 'react'
import { Send, Smile } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'

interface MessageInputProps {
  otherUserId: string | null
  onMessageSent: () => void
}

export default function MessageInput({ otherUserId, onMessageSent }: MessageInputProps) {
  const { profile } = useAuthStore()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const sendMessage = async () => {
    if (!message.trim() || !otherUserId || !profile?.id || sending) return

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
      const canMessageFree = senderIsAdmin || senderIsOfficer || senderIsTroller

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
      const { error } = await supabase.from('messages').insert({
        sender_id: profile.id,
        receiver_id: otherUserId,
        content: message.trim(),
        message_type: 'dm',
        seen: false
      })

      if (error) throw error

      // Send notification
      try {
        await supabase.from('notifications').insert([{
          user_id: otherUserId,
          type: 'message',
          content: `New message from ${profile.username}`,
          created_at: new Date().toISOString()
        }])
      } catch {}

      setMessage('')
      onMessageSent()
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
    supabase.channel(`typing:${profile.id}:${otherUserId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { sender: profile.id }
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
    <div className="p-4 border-t border-[#8a2be2]/30 bg-[rgba(10,0,30,0.6)]">
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

