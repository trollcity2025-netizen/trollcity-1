import { useState } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'

interface ChatInputProps {
  streamId: string | undefined
}

export default function ChatInput({ streamId }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const { user, profile } = useAuthStore()

  async function sendMessage() {
    if (!message.trim() || !streamId || !user || !profile) return

    try {
      await supabase.from('messages').insert({
        stream_id: streamId,
        user_id: user.id,
        content: message.trim(),
        message_type: 'chat',
      })
      setMessage('')
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="absolute bottom-6 left-6 flex items-center gap-2 z-20">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        className="bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-xl border border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500 min-w-[300px]"
        placeholder="Say something..."
      />
      <button
        onClick={sendMessage}
        disabled={!message.trim()}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl text-white transition-colors flex items-center gap-2"
      >
        <Send size={16} />
        Send
      </button>
    </div>
  )
}

