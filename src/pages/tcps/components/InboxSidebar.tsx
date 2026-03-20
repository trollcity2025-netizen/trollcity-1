import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, MessageCircle, Mail, MoreVertical, Ban, EyeOff, Eye, MessageSquare, Shield } from 'lucide-react'
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

const CACHE_KEY = 'tcps_conversations_cache'
const CACHE_DURATION_MS = 30 * 60 * 1000 // 30 minutes

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
  const [hiddenConversations, setHiddenConversations] = useState<SidebarConversation[]>([])
  const [loading, setLoading] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [isUserOfficer, setIsUserOfficer] = useState(false)
  const [newMessagesMap, setNewMessagesMap] = useState<Record<string, boolean>>({})
  const menuRef = useRef<HTMLDivElement>(null)
  const hasLoadedFromCache = useRef(false)

  // Get hidden conversations from localStorage on mount
  const getHiddenConvIds = useCallback(() => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem('hidden_conversations') || '[]'))
    } catch {
      return new Set<string>()
    }
  }, [])

  // Load from cache immediately on mount - show cached data even if slightly stale
  useEffect(() => {
    if (!user?.id || hasLoadedFromCache.current) return
    
    try {
      const cached = localStorage.getItem(`${CACHE_KEY}_${user.id}`)
      if (cached) {
        const { data, timestamp } = JSON.parse(cached)
        // Allow stale cache up to 1 hour - show immediately while fetching fresh data
        const isValid = Date.now() - timestamp < 60 * 60 * 1000
        
        if (isValid && Array.isArray(data) && data.length > 0) {
          setConversations(data)
          onConversationsLoaded(data)
          hasLoadedFromCache.current = true
          setIsInitialLoad(false)
        }
      }
    } catch (e) {
      console.error('Error loading from cache:', e)
    }
  }, [user?.id, onConversationsLoaded])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    
    // Check if user is officer - do this in background
    if (user?.id) {
      isOfficer(user.id).then(setIsUserOfficer)
    }
    
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [user?.id])

  const handleOpenBubble = (userId: string, username: string, avatarUrl: string | null) => {
    openChatBubble(userId, username, avatarUrl)
    setOpenMenuId(null)
  }

  const saveToCache = useCallback((data: SidebarConversation[]) => {
    if (!user?.id) return
    try {
      localStorage.setItem(`${CACHE_KEY}_${user.id}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }))
    } catch (e) {
      console.error('Error saving to cache:', e)
    }
  }, [user?.id])

  const fetchConversations = useCallback(async (isBackground = false) => {
    if (!user?.id) return
    
    // Only show loading state if not background refresh and we don't have cached data
    if (!isBackground && conversations.length === 0) {
      setLoading(true)
    }
    
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
        // Helper function to batch array into chunks
        const BATCH_SIZE = 50
        const chunkArray = (arr: string[], size: number) => {
          const chunks: string[][] = []
          for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size))
          }
          return chunks
        }

        const batches = chunkArray(convIds, BATCH_SIZE)

        // Fetch all data in parallel across batches for better performance
        const [membersResults, unreadResults, messagesResults] = await Promise.all([
          // 2. Fetch other members for all batches in parallel
          Promise.all(batches.map(batch =>
            supabase
              .from('conversation_members')
              .select('conversation_id, user_id, user_profiles!inner(username, avatar_url, rgb_username_expires_at, glowing_username_color, created_at)')
              .in('conversation_id', batch)
              .neq('user_id', user.id)
          )),
          
          // 3. Fetch unread counts for all batches in parallel
          Promise.all(batches.map(batch =>
            supabase
              .from('conversation_messages')
              .select('conversation_id')
              .in('conversation_id', batch)
              .neq('sender_id', user.id)
              .is('read_at', null)
              .is('is_deleted', false)
          )),
          
          // 4. Fetch recent messages for all batches in parallel
          Promise.all(batches.map(batch =>
            supabase
              .from('conversation_messages')
              .select('conversation_id, body, created_at, sender_id')
              .in('conversation_id', batch)
              .is('is_deleted', false)
              .order('created_at', { ascending: false })
              .limit(100)
          ))
        ])

        // Combine results from all batches
        const allOtherMembers = membersResults.flatMap(r => r.data || [])
        const otherMembers = allOtherMembers

        const unreadCounts: Record<string, number> = {}
        unreadResults.forEach(({ data }) => {
          data?.forEach(m => {
            unreadCounts[m.conversation_id] = (unreadCounts[m.conversation_id] || 0) + 1
          })
        })

        const lastMessageByConversationId: Record<string, { body: string; created_at: string | null; sender_id: string }> = {}
        messagesResults.forEach(({ data: recentMessages }) => {
          ;(recentMessages || []).forEach((m: any) => {
            if (!m?.conversation_id) return
            if (!lastMessageByConversationId[m.conversation_id]) {
              lastMessageByConversationId[m.conversation_id] = {
                body: m.body,
                created_at: m.created_at ?? null,
                sender_id: m.sender_id ?? ''
              }
            }
          })
        })

        // 2.5 Fetch blocked users to filter them out
        const { data: blockedData } = await supabase
          .from('user_relationships')
          .select('related_user_id')
          .eq('user_id', user.id)
          .eq('status', 'blocked')
          
        const blockedUserIds = new Set(blockedData?.map(b => b.related_user_id) || [])

        // 2.6 Get hidden conversations from localStorage
        const hiddenConvIds = getHiddenConvIds()

        // Array to collect hidden conversations
        const hiddenConvsArray: SidebarConversation[] = []

        // 4. Build conversation previews (use batched last message map)
        const convsWithDetails = convIds.map((cid) => {
          const lastMsg = lastMessageByConversationId[cid] || { body: 'No messages yet', created_at: null, sender_id: '' }

          // 4.1 Check if conversation is hidden
          const isHidden = hiddenConvIds.has(cid)
          const unreadCount = unreadCounts[cid] || 0

          // Find other member(s)
          const others = otherMembers?.filter(om => om.conversation_id === cid)
          if (!others || others.length === 0) return null

          // For now, handle as 1-on-1 but we could support groups
          const other = others[0]
          if (!other.user_profiles || blockedUserIds.has(other.user_id)) return null

          const profile = other.user_profiles as any

          // If hidden, don't add to processedConvs - it's stored separately
          if (isHidden) {
            return null
          }

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
        })
        
        // Filter only visible conversations
        const visibleConvs = convsWithDetails.filter(Boolean) as SidebarConversation[]
        processedConvs.push(...visibleConvs)
        
        // Store hidden conversations - rebuild from convIds using the already-fetched data
        const finalHiddenConvs: SidebarConversation[] = []
        for (const cid of convIds) {
          if (hiddenConvIds.has(cid)) {
            const lastMsg = lastMessageByConversationId[cid] || { body: 'No messages yet', created_at: null, sender_id: '' }
            const others = otherMembers?.filter(om => om.conversation_id === cid)
            if (others && others.length > 0) {
              const other = others[0]
              if (other.user_profiles && !blockedUserIds.has(other.user_id)) {
                const profile = other.user_profiles as any
                finalHiddenConvs.push({
                  other_user_id: other.user_id,
                  other_username: profile.username,
                  other_avatar_url: profile.avatar_url,
                  rgb_username_expires_at: profile.rgb_username_expires_at,
                  glowing_username_color: profile.glowing_username_color,
                  other_created_at: profile.created_at,
                  last_message: lastMsg.body,
                  last_timestamp: lastMsg.created_at || '',
                  unread_count: unreadCounts[cid] || 0
                })
              }
            }
          }
        }
        setHiddenConversations(finalHiddenConvs)
      } else {
        // No convIds - still need to set hidden conversations to empty
        setHiddenConversations([])
      }

      // 5. Deduplicate by other_user_id
      const uniqueConvsMap = new Map<string, SidebarConversation>()
      
      processedConvs.forEach(conv => {
        const existing = uniqueConvsMap.get(conv.other_user_id)
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
      saveToCache(finalConvs)

    } catch (err) {
      console.error('Error fetching conversations:', err)
    } finally {
      setLoading(false)
      setIsInitialLoad(false)
    }
  }, [user?.id, isUserOfficer, onConversationsLoaded, saveToCache, conversations.length])

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
    
    // Close menu immediately for better UX
    setOpenMenuId(null)
    
    try {
      const conv = conversations.find(c => c.other_user_id === otherUserId)
      if (!conv) {
        console.warn('Hide chat: conversation not found for user', otherUserId)
        return
      }

      // Immediately remove from local state for instant feedback
      setConversations(prev => prev.filter(c => c.other_user_id !== otherUserId))
      
      // Add to hidden conversations for the hidden tab
      if (conv) {
        setHiddenConversations(prev => [...prev, conv])
      }
      
      toast.success('Chat hidden')

      // Find and store the conversation_id in localStorage
      const { data: memberData, error: memberError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)
      
      if (memberError) {
        console.error('Hide chat: member query error', memberError)
        return
      }
      
      if (memberData && memberData.length > 0) {
        const myConvIds = memberData.map(m => m.conversation_id)
        const { data: shared, error: sharedError } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .in('conversation_id', myConvIds)
          .eq('user_id', otherUserId)
          .maybeSingle()
        
        if (sharedError) {
          console.error('Hide chat: shared query error', sharedError)
          return
        }
        
        if (shared?.conversation_id) {
          // Safely get hidden conversations from localStorage
          let hiddenChats: string[] = []
          try {
            const stored = localStorage.getItem('hidden_conversations')
            if (stored) {
              hiddenChats = JSON.parse(stored)
              if (!Array.isArray(hiddenChats)) {
                hiddenChats = []
              }
            }
          } catch (e) {
            console.warn('Hide chat: invalid localStorage data, resetting', e)
            hiddenChats = []
          }
          
          if (!hiddenChats.includes(shared.conversation_id)) {
            hiddenChats.push(shared.conversation_id)
            localStorage.setItem('hidden_conversations', JSON.stringify(hiddenChats))
          }
        }
      }
    } catch (err) {
      console.error('Hide chat: unexpected error', err)
      // Silently fail - chat is already hidden in UI
    }
  }

  const handleUnhideChat = async (otherUserId: string) => {
    if (!user) return
    
    // Close menu immediately for better UX
    setOpenMenuId(null)
    
    try {
      // Remove from hidden conversations in local state
      setHiddenConversations(prev => prev.filter(c => c.other_user_id !== otherUserId))
      toast.success('Chat unhidden')

      // Find and remove the conversation_id from localStorage
      const { data: memberData, error: memberError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)
      
      if (memberError) {
        console.error('Unhide chat: member query error', memberError)
        return
      }
      
      if (memberData && memberData.length > 0) {
        const myConvIds = memberData.map(m => m.conversation_id)
        const { data: shared, error: sharedError } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .in('conversation_id', myConvIds)
          .eq('user_id', otherUserId)
          .maybeSingle()
        
        if (sharedError) {
          console.error('Unhide chat: shared query error', sharedError)
          return
        }
        
        if (shared?.conversation_id) {
          // Safely get hidden conversations from localStorage
          let hiddenChats: string[] = []
          try {
            const stored = localStorage.getItem('hidden_conversations')
            if (stored) {
              hiddenChats = JSON.parse(stored)
              if (!Array.isArray(hiddenChats)) {
                hiddenChats = []
              }
            }
          } catch (e) {
            console.warn('Unhide chat: invalid localStorage data, resetting', e)
            hiddenChats = []
          }
          
          // Remove this conversation from hidden list
          const newHiddenChats = hiddenChats.filter((id: string) => id !== shared.conversation_id)
          localStorage.setItem('hidden_conversations', JSON.stringify(newHiddenChats))
        }
      }
      
      // Refresh to show the conversation in inbox
      fetchConversations()
    } catch (err) {
      console.error('Unhide chat: unexpected error', err)
      // Silently fail
    }
  }

  // Clear new message notification when user selects a conversation
  useEffect(() => {
    if (activeConversation) {
      setNewMessagesMap({})
    }
  }, [activeConversation])

  useEffect(() => {
    // Initial fetch - will use cache first, then refresh
    fetchConversations()
    
    // Debounce fetch for real-time updates
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        fetchConversations(true) // Background refresh
      }, 500)
    }
    
    // Subscribe to new messages to update sidebar ordering/preview
    const messagesChannel = supabase
      .channel('sidebar-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_messages' }, (payload) => {
         const newMsg = payload.new
         if (newMsg && user?.id) {
           if (newMsg.sender_id !== user.id) {
             supabase
               .from('conversation_members')
               .select('conversation_id')
               .eq('user_id', user.id)
               .eq('conversation_id', newMsg.conversation_id)
               .then(({ data }) => {
                 if (data && data.length > 0 && activeConversation !== newMsg.conversation_id) {
                   setNewMessagesMap(prev => ({ ...prev, [newMsg.conversation_id]: true }))
                 }
               })
           }
         }
         debouncedFetch()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_messages' }, (_payload) => {
         debouncedFetch()
      })
      .on('broadcast', { event: 'new-message' }, () => {
         debouncedFetch()
      })
      .subscribe()

    // Subscribe to OPS messages if user is officer
    let opsChannel: any = null
    if (isUserOfficer) {
      opsChannel = supabase
        .channel('sidebar-ops')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'officer_chat_messages' }, () => {
           debouncedFetch()
        })
        .subscribe()
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(messagesChannel)
      if (opsChannel) supabase.removeChannel(opsChannel)
    }
  }, [fetchConversations, isUserOfficer, activeConversation, user?.id])

  // Determine which conversations to show based on active tab
  const displayedConversations = activeTab === 'hidden' 
    ? hiddenConversations.filter(c => c.other_username.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations.filter(c => c.other_username.toLowerCase().includes(searchQuery.toLowerCase()))

  // Skeleton loader for better perceived performance
  const renderSkeleton = () => (
    <div className="divide-y divide-purple-500/10">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-4 flex items-start gap-3 animate-pulse">
          <div className="w-12 h-12 rounded-full bg-gray-800 flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 bg-gray-800 rounded w-24" />
              <div className="h-3 bg-gray-800 rounded w-10" />
            </div>
            <div className="h-3 bg-gray-800 rounded w-full" />
          </div>
        </div>
      ))}
    </div>
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
          <button 
             onClick={() => setActiveTab('hidden')}
             className={`flex-1 py-1.5 px-3 rounded text-xs font-medium transition-colors ${
              activeTab === 'hidden' ? 'bg-[#1F1F2E] text-white shadow-sm' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Hidden
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isInitialLoad ? (
          renderSkeleton()
        ) : loading && conversations.length === 0 ? (
          <div className="flex justify-center p-8">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayedConversations.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            {searchQuery ? 'No conversations found' : activeTab === 'hidden' ? 'No hidden conversations' : 'No messages yet'}
          </div>
        ) : (
          <div className="divide-y divide-purple-500/10">
            {displayedConversations.map((conv) => {
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
                      <div className={`relative w-12 h-12 rounded-full ${conv.unread_count > 0 ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-[#0F0F1A] animate-pulse' : ''}`}>
                        <img 
                          src={conv.other_avatar_url || `https://ui-avatars.com/api/?name=${conv.other_username}&background=random`}
                          alt={conv.other_username}
                          className="w-12 h-12 rounded-full border border-purple-500/20"
                        />
                      </div>
                    )}
                    {(isOnline || conv.other_user_id === OFFICER_GROUP_CONVERSATION_ID) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0F0F1A]" />
                    )}
                    {conv.unread_count > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-600 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-[#0F0F1A]">
                        {conv.unread_count > 9 ? '9+' : conv.unread_count}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pointer-events-none">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white truncate">
                        <UserNameWithAge 
                          username={conv.other_username} 
                          createdAt={conv.other_created_at}
                          rgbUsernameExpiresAt={conv.rgb_username_expires_at}
                          glowingUsernameColor={conv.glowing_username_color}
                        />
                      </div>
                      <time className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {conv.last_timestamp ? new Date(conv.last_timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                      </time>
                    </div>
                    <p className={`text-sm text-gray-400 truncate mt-1 ${conv.unread_count > 0 ? 'font-bold text-white' : ''}`}>
                      {conv.last_message}
                    </p>
                  </div>

                  <div className="absolute z-10 top-2 right-2">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation()
                        setOpenMenuId(openMenuId === conv.other_user_id ? null : conv.other_user_id)
                      }}
                      className="p-1 rounded-full hover:bg-white/10 text-gray-400"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openMenuId === conv.other_user_id && (
                      <div ref={menuRef} className="absolute right-0 mt-2 w-48 bg-[#1F1F2E] border border-purple-500/30 rounded-lg shadow-xl z-20">
                        <button onClick={() => handleOpenBubble(conv.other_user_id, conv.other_username, conv.other_avatar_url)} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-white/5">
                          <MessageSquare className="w-4 h-4" />
                          Open in Bubble
                        </button>
                        {activeTab === 'hidden' ? (
                          <button onClick={() => handleUnhideChat(conv.other_user_id)} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-white/5">
                            <Eye className="w-4 h-4" />
                            Unhide Chat
                          </button>
                        ) : (
                          <button onClick={() => handleHideChat(conv.other_user_id)} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-white/5">
                            <EyeOff className="w-4 h-4" />
                            Hide Chat
                          </button>
                        )}
                        <button onClick={() => handleBlockUser(conv.other_user_id)} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10">
                          <Ban className="w-4 h-4" />
                          Block User
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
