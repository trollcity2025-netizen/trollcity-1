import { useState, useEffect } from 'react'
import { Search, MessageCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import ClickableUsername from '../../../components/ClickableUsername'

interface Conversation {
  other_user_id: string
  other_username: string
  other_avatar_url: string | null
  last_message: string
  last_timestamp: string
  unread_count: number
  is_online?: boolean
}

interface InboxSidebarProps {
  activeConversation: string | null
  onSelectConversation: (userId: string) => void
  activeTab: string
  onTabChange: (tab: string) => void
  onlineUsers?: Record<string, boolean>
}

export default function InboxSidebar({
  activeConversation,
  onSelectConversation,
  activeTab,
  onTabChange,
  onlineUsers = {}
}: InboxSidebarProps) {
  const { profile } = useAuthStore()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

  const tabs = [
    { id: 'inbox', label: 'Inbox' },
    { id: 'requests', label: 'Requests' },
    { id: 'officer', label: 'Officer Messages' },
    { id: 'broadcast', label: 'Broadcasts' },
    { id: 'system', label: 'System Alerts' }
  ]

  // Load unread counts
  const loadUnread = async () => {
    if (!profile?.id) return

    try {
      const { data } = await supabase
        .from('messages')
        .select('id,sender_id,receiver_id,read_at')
        .eq('receiver_id', profile.id)
        .is('read_at', null)
        .eq('message_type', 'dm')

      const counts: Record<string, number> = {}
      data?.forEach((m) => {
        if (m.sender_id) {
          counts[m.sender_id] = (counts[m.sender_id] || 0) + 1
        }
      })

      setUnreadCounts(counts)
    } catch (error) {
      console.error('Error loading unread counts:', error)
    }
  }

  useEffect(() => {
    if (!profile?.id) return
    loadConversations()
    loadUnread()

    // Real-time subscription
    const channel = supabase
      .channel('inbox_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          loadConversations()
          loadUnread()
        }
      )
      .subscribe()

    // New messages channel for unread counts
    const newMessagesChannel = supabase
      .channel(`new-messages:${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', table: 'messages', schema: 'public' },
        () => {
          loadUnread()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(newMessagesChannel)
    }
  }, [profile?.id, activeTab])

  const loadConversations = async () => {
    if (!profile?.id) return

    try {
      setLoading(true)

      if (activeTab === 'inbox') {
        // Load DM conversations
        const { data: messagesData, error } = await supabase
          .from('messages')
        .select('id,sender_id,receiver_id,content,created_at,seen')
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
        .eq('message_type', 'dm')
        .order('created_at', { ascending: false })
        .limit(500)

        if (error) throw error

        // Group by conversation partner
        const conversationMap = new Map<string, Conversation>()

        messagesData?.forEach((msg) => {
          const otherUserId = msg.sender_id === profile.id ? msg.receiver_id : msg.sender_id
          if (!otherUserId) return

          const existing = conversationMap.get(otherUserId)
          const isUnread = msg.receiver_id === profile.id && (msg.seen === false || msg.seen === null)

          if (!existing || new Date(msg.created_at) > new Date(existing.last_timestamp)) {
            conversationMap.set(otherUserId, {
              other_user_id: otherUserId,
              other_username: '', // Will fetch below
              other_avatar_url: null,
              last_message: msg.content || '',
              last_timestamp: msg.created_at,
              unread_count: (existing?.unread_count || 0) + (isUnread ? 1 : 0)
            })
          } else if (isUnread) {
            existing.unread_count = (existing.unread_count || 0) + 1
          }
        })

        // Fetch user details for all conversation partners
        const userIds = Array.from(conversationMap.keys())
        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from('user_profiles')
            .select('id,username,avatar_url')
            .in('id', userIds)

          usersData?.forEach((user) => {
            const conv = conversationMap.get(user.id)
            if (conv) {
              conv.other_username = user.username
              conv.other_avatar_url = user.avatar_url
            }
          })
        }

        setConversations(Array.from(conversationMap.values()).sort((a, b) => 
          new Date(b.last_timestamp).getTime() - new Date(a.last_timestamp).getTime()
        ))
      } else {
        // For other tabs, show filtered messages
        setConversations([])
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMs = now.getTime() - time.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return time.toLocaleDateString()
  }

  const filteredConversations = conversations.filter(conv =>
    conv.other_username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="w-80 h-full flex flex-col bg-[#060011] border-r border-[#8a2be2]">
      {/* Tabs */}
      <div className="flex border-b border-[#8a2be2]/30 bg-[rgba(10,0,30,0.6)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`
              flex-1 px-3 py-2 text-xs font-semibold transition
              ${activeTab === tab.id
                ? 'bg-gradient-to-r from-[#9b32ff] to-[#00ffcc] text-black shadow-lg'
                : 'text-gray-300 hover:text-white hover:bg-[rgba(155,50,255,0.1)]'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-[#8a2be2]/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8a2be2]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-3 py-2 bg-[rgba(10,0,30,0.6)] border border-[#8a2be2]/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8a2be2] focus:border-[#8a2be2]"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-400">Loading...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[#8a2be2]/20">
            {filteredConversations.map((conv) => (
              <button
                key={conv.other_user_id}
                type="button"
                onClick={() => onSelectConversation(conv.other_user_id)}
                className={`
                  w-full p-3 flex items-center gap-3 hover:bg-[rgba(155,50,255,0.1)] transition
                  ${activeConversation === conv.other_user_id ? 'bg-[rgba(155,50,255,0.2)] border-l-2 border-[#8a2be2]' : ''}
                `}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <img
                    src={conv.other_avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${conv.other_username}`}
                    alt={conv.other_username}
                    className="w-12 h-12 rounded-full border-2 border-[#8a2be2] hover:border-[#00ffcc] transition"
                  />
                  {onlineUsers[conv.other_user_id] ? (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-[#060011]"></span>
                  ) : (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-gray-500 border-2 border-[#060011]"></span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white text-sm truncate">
                      @{conv.other_username}
                    </span>
                    <span className="text-xs text-[#74f7ff] ml-2 flex-shrink-0">
                      {formatTimeAgo(conv.last_timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400 truncate flex-1">
                      {conv.last_message || 'No messages yet'}
                    </p>
                    {(unreadCounts[conv.other_user_id] || 0) > 0 && (
                      <div className="ml-auto flex items-center justify-center w-5 h-5 bg-purple-600 rounded-full text-white text-xs font-bold flex-shrink-0">
                        {unreadCounts[conv.other_user_id]}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

