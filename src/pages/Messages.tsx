import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase, UserProfile } from '../lib/supabase'
import { Send } from 'lucide-react'

interface ChatMessage {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
  sender?: UserProfile
}

export default function Messages() {
  const { profile } = useAuthStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [composeText, setComposeText] = useState('')
  const [composeTo, setComposeTo] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMessages()
  }, [])

  const loadMessages = async () => {
    try {
      setLoading(true)
      if (!profile) return
      const { data } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, created_at')
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
        .order('created_at', { ascending: false })
        .limit(100)
      setMessages(data || [])
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!composeText.trim() || !composeTo.trim() || !profile) return
    const { data: toUser } = await supabase
      .from('user_profiles')
      .select('id, username')
      .eq('username', composeTo)
      .single()
    if (!toUser) return
    await supabase.from('messages').insert([{
      sender_id: profile.id,
      receiver_id: toUser.id,
      content: composeText,
      created_at: new Date().toISOString()
    }])
    try {
      await supabase.from('notifications').insert([
        { user_id: toUser.id, type: 'message', content: `New message from ${profile.username}`, created_at: new Date().toISOString() }
      ])
    } catch {}
    setComposeText('')
    await loadMessages()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-6">Messages</h1>

        <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C] mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              value={composeTo}
              onChange={(e) => setComposeTo(e.target.value)}
              placeholder="Send to username"
              className="px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg"
            />
            <input
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              placeholder="Type a message"
              className="px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg"
            />
            <button
              onClick={sendMessage}
              className="px-4 py-2 bg-gradient-to-r from-[#FFC93C] to-[#FFD700] text-black rounded-lg font-semibold hover:shadow-lg hover:shadow-[#FFC93C]/30"
            >
              <Send className="w-4 h-4 inline mr-2" />Send
            </button>
          </div>
        </div>

        <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-[#FFC93C]/20 rounded-full animate-pulse mx-auto mb-4"></div>
              <div className="text-[#FFC93C] font-bold text-xl">Loading messages...</div>
              <div className="text-gray-400 text-sm mt-2">Please wait while we fetch your messages</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-[#E2E2E2]/70">No messages yet</div>
          ) : (
            <div className="space-y-4">
              {messages.map((m) => (
                <div key={m.id} className="p-4 bg-[#121212] rounded-lg border border-[#2C2C2C]">
                  <div className="text-sm text-[#E2E2E2]/60 mb-1">{new Date(m.created_at).toLocaleString()}</div>
                  <div>
                    <span className="text-[#00D4FF] font-semibold">{m.sender_id === profile?.id ? 'You' : 'User'}</span>
                    <span className="mx-2">→</span>
                    <span className="text-[#FFC93C] font-semibold">{m.receiver_id === profile?.id ? 'You' : 'User'}</span>
                  </div>
                  <div className="mt-2">{m.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}