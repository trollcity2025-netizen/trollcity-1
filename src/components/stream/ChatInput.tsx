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
    if (!message.trim() || !streamId || !user) return

    const { error } = await supabase.from('stream_messages').insert({
      stream_id: streamId,
      user_id: user.id,
      content: message.trim(),
      message_type: 'chat',
    })

    if (error) {
      console.error('Failed to send chat:', error)
    } else {
      setMessage('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-lg border border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
        placeholder="Type a message... (Press Enter to send)"
        disabled={!user}
      />
      <button
        onClick={sendMessage}
        disabled={!message.trim() || !user}
        className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white transition-colors flex items-center gap-1 text-sm"
      >
        <Send size={14} />
      </button>
    </div>
  )
}

