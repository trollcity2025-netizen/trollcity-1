import { useState, useEffect, useCallback } from 'react'
import { Search, MessageCircle, Trash2, Mail, Users, Archive } from 'lucide-react'
import { supabase, UserRole } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import ClickableUsername from '../../../components/ClickableUsername'

interface SidebarConversation {
  other_user_id: string
  other_username: string
  other_avatar_url: string | null
  last_message: string
  last_timestamp: string
  unread_count: number
  is_online?: boolean
  rgb_username_expires_at?: string | null
}

interface InboxSidebarProps {
  activeConversation: string | null
  onSelectConversation: (userId: string) => void
  onlineUsers: Record<string, boolean>
  activeTab: string
  setActiveTab: (tab: string) => void
  onOpenNewMessage: () => void
  onConversationsLoaded: (conversations: SidebarConversation[]) => void
}

export default function InboxSidebar({
  activeConversation,
  onSelectConversation,
  onlineUsers,
  activeTab,
  setActiveTab,
  onOpenNewMessage,
  onConversationsLoaded
}: InboxSidebarProps) {
  const { user } = useAuthStore()
  const [conversations, setConversations] = useState<SidebarConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      // Use the listUserConversations helper or manual query
      // The snippet suggested listUserConversations might exist, but we can do it manually for more control over last message
      
      // We need last message and unread count.
      // This is often complex in Supabase without a dedicated view or RPC.
      // Let's assume we have an RPC or do a client-side join.
      
      // Let's try to fetch members and then last message for each.
      const { data: members, error } = await supabase
        .from('conversation_members')
        .select('conversation_id, conversations(created_at)')
        .eq('user_id', user.id)
      
      if (error) throw error

      const convIds = members.map(m => m.conversation_id)
      
      if (convIds.length === 0) {
        setConversations([])
        onConversationsLoaded([])
        setLoading(false)
        return
      }

      // Fetch other members for these conversations
      const { data: otherMembers } = await supabase
        .from('conversation_members')
        .select('conversation_id, user_id, user_profiles(username, avatar_url, rgb_username_expires_at)')
        .in('conversation_id', convIds)
        .neq('user_id', user.id)

      // Fetch last messages (latest per conversation)
      // This is hard to do in one query efficiently without lateral join.
      // We'll fetch latest messages for all these conversations.
      // Or we can just fetch all messages for these convs limit 1 per conv? No.
      
      // Let's fetch the most recent message for each conversation individually or use an RPC if available.
      // Assuming no RPC for "inbox", we'll do it naively:
      
      const convsWithDetails = await Promise.all(convIds.map(async (cid) => {
         const { data: msgs } = await supabase
           .from('conversation_messages')
           .select('body, created_at, sender_id')
           .eq('conversation_id', cid)
           .order('created_at', { ascending: false })
           .limit(1)
           .maybeSingle()
         
         const lastMsg = msgs || { body: 'No messages yet', created_at: '', sender_id: '' }
         
         // Find other member
         const other = otherMembers?.find(om => om.conversation_id === cid)
         if (!other || !other.user_profiles) return null
         
         // Unread count?
         // Assuming we have a read_status table or similar, but typically we check last read time.
         // Let's skip precise unread count for now or mock it.
         
         return {
           other_user_id: other.user_id,
           other_username: (other.user_profiles as any).username,
           other_avatar_url: (other.user_profiles as any).avatar_url,
           rgb_username_expires_at: (other.user_profiles as any).rgb_username_expires_at,
           last_message: lastMsg.body,
           last_timestamp: lastMsg.created_at,
           unread_count: 0 // TODO: Implement unread count
         }
      }))
      
      const validConvs = convsWithDetails.filter(Boolean) as SidebarConversation[]
      
      // Sort by timestamp
      validConvs.sort((a, b) => new Date(b.last_timestamp).getTime() - new Date(a.last_timestamp).getTime())
      
      setConversations(validConvs)
      onConversationsLoaded(validConvs)

    } catch (err) {
      console.error('Error fetching conversations:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id, onConversationsLoaded])

  useEffect(() => {
    fetchConversations()
    
    // Subscribe to new messages to update sidebar ordering/preview
    const channel = supabase
      .channel('sidebar-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_messages' }, () => {
         fetchConversations()
      })
      .subscribe()
      
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchConversations])

  const filteredConversations = conversations.filter(c => 
    c.other_username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full bg-[#0F0F1A] border-r border-purple-500/20">
      {/* Header */}
      <div className="p-4 border-b border-purple-500/20 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-purple-400" />
            TCPS Inbox
          </h1>
          <button 
            onClick={onOpenNewMessage}
            className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors shadow-lg shadow-purple-900/20"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search messages..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0A0A14] border border-purple-500/30 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        <div className="flex gap-2 p-1 bg-[#0A0A14] rounded-lg">
          <button 
            onClick={() => setActiveTab('inbox')}
            className={`flex-1 py-1.5 px-3 rounded text-xs font-medium transition-colors ${
              activeTab === 'inbox' ? 'bg-[#1F1F2E] text-white shadow-sm' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Inbox
          </button>
          <button 
             onClick={() => setActiveTab('requests')}
             className={`flex-1 py-1.5 px-3 rounded text-xs font-medium transition-colors ${
              activeTab === 'requests' ? 'bg-[#1F1F2E] text-white shadow-sm' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Requests
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            {searchQuery ? 'No conversations found' : 'No messages yet'}
          </div>
        ) : (
          <div className="divide-y divide-purple-500/10">
            {filteredConversations.map((conv) => {
              const isActive = activeConversation === conv.other_user_id
              const isOnline = onlineUsers[conv.other_user_id]
              
              return (
                <button
                  key={conv.other_user_id}
                  onClick={() => onSelectConversation(conv.other_user_id)}
                  className={`w-full p-4 flex items-start gap-3 hover:bg-white/5 transition-colors text-left relative ${
                    isActive ? 'bg-white/5 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-purple-500' : ''
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <img 
                      src={conv.other_avatar_url || `https://ui-avatars.com/api/?name=${conv.other_username}&background=random`}
                      alt={conv.other_username}
                      className="w-12 h-12 rounded-full border border-purple-500/20"
                    />
                    {isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0F0F1A]" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-medium truncate ${isActive ? 'text-purple-300' : 'text-gray-200'}`}>
                        {conv.other_username}
                      </span>
                      {conv.last_timestamp && (
                        <span className="text-[10px] text-gray-500 flex-shrink-0">
                          {new Date(conv.last_timestamp).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 truncate pr-2">
                      {conv.last_message || 'Start a conversation'}
                    </p>
                  </div>
                  
                  {conv.unread_count > 0 && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-purple-600/50">
                      {conv.unread_count}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
