import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, MessageCircle, Mail, MoreVertical, Ban, EyeOff, MessageSquare, Shield } from 'lucide-react'
import { supabase, isOfficer, OFFICER_GROUP_CONVERSATION_ID } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { useChatStore } from '../../../lib/chatStore'
import UserNameWithAge from '../../../components/UserNameWithAge'
import { toast } from 'sonner'

interface SidebarConversation {
  other_user_id: string
  other_username: string
  other_avatar_url: string | null
  last_message: string
  last_timestamp: string
  unread_count: number
  is_online?: boolean
  rgb_username_expires_at?: string | null
  glowing_username_color?: string | null
  other_created_at?: string
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
  const { openChatBubble } = useChatStore()
  const [conversations, setConversations] = useState<SidebarConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [isUserOfficer, setIsUserOfficer] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    
    // Check if user is officer
    if (user?.id) {
      isOfficer(user.id).then(setIsUserOfficer)
    }
    
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [user?.id])

  const handleOpenBubble = (userId: string, username: string, avatarUrl: string | null) => {
    openChatBubble(userId, username, avatarUrl)
    setOpenMenuId(null)
  }

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return
    
    try {
      // 1. Fetch all conversations the user is a member of
      const { data: members, error: membersError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)
      
      if (membersError) throw membersError
      const convIds = members?.map(m => m.conversation_id) || []
      
      // Separate array to hold our processed conversations
      const processedConvs: SidebarConversation[] = []

      if (convIds.length > 0) {
        // 2. Fetch other members for these conversations to get their profiles
        const { data: otherMembers, error: othersError } = await supabase
          .from('conversation_members')
          .select('conversation_id, user_id, user_profiles!inner(username, avatar_url, rgb_username_expires_at, glowing_username_color, created_at)')
          .in('conversation_id', convIds)
          .neq('user_id', user.id)

        if (othersError) {
          console.warn('Error fetching other members, trying without !inner:', othersError)
          // Fallback if !inner fails (though it shouldn't if relations are correct)
          const { data: fallbackMembers } = await supabase
            .from('conversation_members')
            .select('conversation_id, user_id, user_profiles(username, avatar_url, rgb_username_expires_at, glowing_username_color, created_at)')
            .in('conversation_id', convIds)
            .neq('user_id', user.id)
          
          if (fallbackMembers) {
            // Manual filter for members that actually have profiles
            // const validMembers = fallbackMembers.filter(m => m.user_profiles)
            // ... continue with validMembers
          }
        }

        // 3. Fetch unread counts for each conversation
        const { data: unreadData } = await supabase
          .from('conversation_messages')
          .select('conversation_id')
          .in('conversation_id', convIds)
          .neq('sender_id', user.id)
          .is('read_at', null)
          .is('is_deleted', false)

        const unreadCounts: Record<string, number> = {}
        unreadData?.forEach(m => {
          unreadCounts[m.conversation_id] = (unreadCounts[m.conversation_id] || 0) + 1
        })

        // 2.5 Fetch blocked users to filter them out
        const { data: blockedData } = await supabase
          .from('user_relationships')
          .select('related_user_id')
          .eq('user_id', user.id)
          .eq('status', 'blocked')
        
        const blockedUserIds = new Set(blockedData?.map(b => b.related_user_id) || [])

        // 2.6 Get hidden conversations from localStorage
        const hiddenConvIds = new Set<string>(JSON.parse(localStorage.getItem('hidden_conversations') || '[]'))

        // 4. Fetch the last message for each conversation
        const convsWithDetails = await Promise.all(convIds.map(async (cid) => {
           const { data: msgs } = await supabase
             .from('conversation_messages')
             .select('body, created_at, sender_id')
             .eq('conversation_id', cid)
             .is('is_deleted', false)
             .order('created_at', { ascending: false })
             .limit(1)
             .maybeSingle()
           
           const lastMsg = msgs || { body: 'No messages yet', created_at: null, sender_id: '' }
           
           // 4.1 If conversation is hidden, only show it if there are unread messages
           const isHidden = hiddenConvIds.has(cid)
           const unreadCount = unreadCounts[cid] || 0
           if (isHidden && unreadCount === 0) return null

           // Find other member(s)
           const others = otherMembers?.filter(om => om.conversation_id === cid)
           if (!others || others.length === 0) return null
           
           // For now, handle as 1-on-1 but we could support groups
           const other = others[0]
           if (!other.user_profiles || blockedUserIds.has(other.user_id)) return null
           
           const profile = other.user_profiles as any
           
           return {
             other_user_id: other.user_id,
             other_username: profile.username,
             other_avatar_url: profile.avatar_url,
             rgb_username_expires_at: profile.rgb_username_expires_at,
             glowing_username_color: profile.glowing_username_color,
             other_created_at: profile.created_at,
             last_message: lastMsg.body,
             last_timestamp: lastMsg.created_at || '',
             unread_count: unreadCount
           }
        }))
        
        processedConvs.push(...(convsWithDetails.filter(Boolean) as SidebarConversation[]))
      }

      // 5. Deduplicate by other_user_id
      const uniqueConvsMap = new Map<string, SidebarConversation>()
      
      processedConvs.forEach(conv => {
        const existing = uniqueConvsMap.get(conv.other_user_id)
        // If no existing, or this one has a message and the existing doesn't, or this one is newer
        const hasTime = (t: string) => t && t !== ''
        if (!existing) {
          uniqueConvsMap.set(conv.other_user_id, conv)
        } else if (hasTime(conv.last_timestamp) && !hasTime(existing.last_timestamp)) {
          uniqueConvsMap.set(conv.other_user_id, conv)
        } else if (hasTime(conv.last_timestamp) && hasTime(existing.last_timestamp)) {
          if (new Date(conv.last_timestamp) > new Date(existing.last_timestamp)) {
            uniqueConvsMap.set(conv.other_user_id, conv)
          }
        }
      })
      
      const finalConvs = Array.from(uniqueConvsMap.values())
      
      // 6. Add Officer Operations if applicable
      if (isUserOfficer) {
        try {
          const { data: latestOpsMsg } = await supabase
            .from('officer_chat_messages')
            .select('content, created_at, sender_id')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          // Fetch OPS unread count
          // We'll use a simple approach: messages since last seen or just any messages?
          // For now, let's look at the officer_chat_messages table.
          // In a real app, you'd have an 'officer_chat_read_status' table.
          // As a workaround, we can use localStorage for 'last_seen_ops_timestamp'
          const lastSeenOps = localStorage.getItem('last_seen_ops_timestamp') || '1970-01-01T00:00:00Z'
          const { count: opsUnreadCount } = await supabase
            .from('officer_chat_messages')
            .select('*', { count: 'exact', head: true })
            .gt('created_at', lastSeenOps)
            .neq('sender_id', user.id)

          const opsConv: SidebarConversation = {
            other_user_id: OFFICER_GROUP_CONVERSATION_ID,
            other_username: '👮 Officer Operations',
            other_avatar_url: null,
            last_message: latestOpsMsg?.content || 'Officer group chat',
            last_timestamp: latestOpsMsg?.created_at || new Date().toISOString(),
            unread_count: opsUnreadCount || 0,
            is_online: true,
            other_created_at: new Date().toISOString()
          }
          
          finalConvs.unshift(opsConv)
        } catch (opsErr) {
          console.error('Error fetching OPS preview:', opsErr)
        }
      }
      
      // 7. Sort by timestamp
      finalConvs.sort((a, b) => {
        if (a.other_user_id === OFFICER_GROUP_CONVERSATION_ID) return -1
        if (b.other_user_id === OFFICER_GROUP_CONVERSATION_ID) return 1
        
        const timeA = a.last_timestamp ? new Date(a.last_timestamp).getTime() : 0
        const timeB = b.last_timestamp ? new Date(b.last_timestamp).getTime() : 0
        return timeB - timeA
      })
      
      setConversations(finalConvs)
      onConversationsLoaded(finalConvs)

    } catch (err) {
      console.error('Error fetching conversations:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id, isUserOfficer, onConversationsLoaded])

  const handleBlockUser = async (otherUserId: string) => {
    if (!user) return
    if (!confirm('Are you sure you want to block this user?')) return
    
    try {
      const { error } = await supabase
        .from('user_relationships')
        .insert({
          user_id: user.id,
          related_user_id: otherUserId,
          status: 'blocked'
        })
      
      if (error) throw error
      toast.success('User blocked')
      setOpenMenuId(null)
      fetchConversations() // Refresh sidebar
    } catch (err) {
      console.error('Error blocking user:', err)
      toast.error('Failed to block user')
    }
  }

  const handleHideChat = async (otherUserId: string) => {
    if (!user) return
    
    // We need the conversation ID for this user
    const conv = conversations.find(c => c.other_user_id === otherUserId)
    if (!conv) return

    // Find the actual conversation ID for this user
    const { data: memberData } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', user.id)
    
    if (memberData) {
      const myConvIds = memberData.map(m => m.conversation_id)
      const { data: shared } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .in('conversation_id', myConvIds)
        .eq('user_id', otherUserId)
        .maybeSingle()
      
      if (shared) {
        const hiddenChats = JSON.parse(localStorage.getItem('hidden_conversations') || '[]')
        if (!hiddenChats.includes(shared.conversation_id)) {
          hiddenChats.push(shared.conversation_id)
          localStorage.setItem('hidden_conversations', JSON.stringify(hiddenChats))
        }
        toast.success('Chat hidden')
        fetchConversations() // Refresh sidebar
      }
    }
    setOpenMenuId(null)
  }

  useEffect(() => {
    fetchConversations()
    
    // Subscribe to new messages to update sidebar ordering/preview
    const messagesChannel = supabase
      .channel('sidebar-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_messages' }, (_payload) => {
         // Check if the message belongs to one of our conversations
         fetchConversations()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_messages' }, (_payload) => {
         // Handle read receipts
         fetchConversations()
      })
      .on('broadcast', { event: 'new-message' }, () => {
         // Instant sidebar update on broadcast
         fetchConversations()
      })
      .subscribe()

    // Subscribe to OPS messages if user is officer
    let opsChannel: any = null
    if (isUserOfficer) {
      opsChannel = supabase
        .channel('sidebar-ops')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'officer_chat_messages' }, () => {
           fetchConversations()
        })
        .subscribe()
    }

    return () => {
      supabase.removeChannel(messagesChannel)
      if (opsChannel) supabase.removeChannel(opsChannel)
    }
  }, [fetchConversations, isUserOfficer])

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
                <div
                  key={conv.other_user_id}
                  className={`relative group w-full p-4 flex items-start gap-3 hover:bg-white/5 transition-colors text-left ${
                    isActive ? 'bg-white/5 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-purple-500' : ''
                  } ${
                    conv.other_user_id === OFFICER_GROUP_CONVERSATION_ID ? 'bg-blue-900/10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-blue-500' : ''
                  }`}
                >
                  <div 
                    className="absolute inset-0 cursor-pointer"
                    onClick={() => onSelectConversation(conv.other_user_id)}
                  />

                  <div className="relative flex-shrink-0 pointer-events-none">
                    {conv.other_user_id === OFFICER_GROUP_CONVERSATION_ID ? (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                    ) : (
                      <img 
                        src={conv.other_avatar_url || `https://ui-avatars.com/api/?name=${conv.other_username}&background=random`}
                        alt={conv.other_username}
                        className="w-12 h-12 rounded-full border border-purple-500/20"
                      />
                    )}
                    {(isOnline || conv.other_user_id === OFFICER_GROUP_CONVERSATION_ID) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0F0F1A]" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 pointer-events-none">
                    <div className="flex items-center justify-between mb-1 overflow-hidden">
                      <div className={`font-medium ${isActive ? 'text-purple-300' : 'text-gray-200'} whitespace-nowrap overflow-hidden text-ellipsis`}>
                        <UserNameWithAge 
                          user={{
                            username: conv.other_username,
                            id: conv.other_user_id,
                            created_at: conv.other_created_at,
                            glowing_username_color: conv.glowing_username_color
                          }}
                          className="pointer-events-none" // Parent is button
                        />
                      </div>
                      {conv.last_timestamp && (
                        <span className="text-[10px] text-gray-500 flex-shrink-0">
                          {new Date(conv.last_timestamp).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 truncate pr-8">
                      {conv.last_message || 'Start a conversation'}
                    </p>
                  </div>
                  
                  {/* Menu Button */}
                  <div className="relative z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenuId(openMenuId === conv.other_user_id ? null : conv.other_user_id)
                      }}
                      className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {openMenuId === conv.other_user_id && (
                      <div 
                        ref={menuRef}
                        className="absolute right-0 top-full mt-1 w-48 bg-[#1F1F2E] border border-purple-500/20 rounded-lg shadow-xl z-50 overflow-hidden"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenBubble(conv.other_user_id, conv.other_username, conv.other_avatar_url)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-2"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Open Chat Bubble
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleHideChat(conv.other_user_id)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-2"
                        >
                          <EyeOff className="w-4 h-4" />
                          Hide Chat
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleBlockUser(conv.other_user_id)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                        >
                          <Ban className="w-4 h-4" />
                          Block User
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {conv.unread_count > 0 && (
                    <div className="absolute right-10 top-1/2 -translate-y-1/2 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-purple-600/50 pointer-events-none">
                      {conv.unread_count}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
