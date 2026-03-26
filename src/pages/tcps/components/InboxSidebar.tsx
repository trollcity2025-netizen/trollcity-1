import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, MessageCircle, Mail, MoreVertical, Ban, EyeOff, Eye, MessageSquare, Shield, Users } from 'lucide-react'
import { supabase, isOfficer, OFFICER_GROUP_CONVERSATION_ID, getBlockedUserIds } from '../../../lib/supabase'
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
  conversation_id?: string // Add conversation_id for proper tracking
  is_group?: boolean
  group_name?: string | null
  member_count?: number
}

interface InboxSidebarProps {
  activeConversation: string | null
  onSelectConversation: (userId: string, isGroup?: boolean, conversationId?: string, groupName?: string) => void
  onlineUsers: Record<string, boolean>
  activeTab: string
  setActiveTab: (tab: string) => void
  onOpenNewMessage: () => void
  onOpenCreateGroup: () => void
  onConversationsLoaded: (conversations: SidebarConversation[]) => void
  refreshKey?: number // When changed, triggers a fresh fetch
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
  onOpenCreateGroup,
  onConversationsLoaded,
  refreshKey
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
  const isFetchingRef = useRef(false)
  const lastFetchTimeRef = useRef(0)
  const activeConversationRef = useRef<string | null>(null)
  const isMountedRef = useRef(false)

  // Get hidden conversations mapping from localStorage
  const getHiddenConvMapping = useCallback(() => {
    try {
      const stored = localStorage.getItem('hidden_conversations')
      if (!stored) return {}
      const parsed = JSON.parse(stored)
      // Handle both old format (array) and new format (object)
      if (Array.isArray(parsed)) {
        // Convert old array format to object format
        const mapping: Record<string, string> = {}
        parsed.forEach((convId: string) => {
          mapping[convId] = '' // Unknown user for old entries
        })
        return mapping
      }
      return parsed || {}
    } catch {
      return {}
    }
  }, [])

  // Load from cache immediately on mount - show cached data even if slightly stale
  useEffect(() => {
    // Always try to load from cache first, regardless of user ID state
    const cachedKey = localStorage.getItem('tcps_current_user_id')
    const cached = localStorage.getItem(`${CACHE_KEY}_${cachedKey}`)
    
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached)
        // Allow stale cache up to 2 hours for instant load
        const isValid = Date.now() - timestamp < 2 * 60 * 60 * 1000
        
        if (isValid && Array.isArray(data) && data.length > 0) {
          // Get hidden conversations from localStorage
          const hiddenMapping = getHiddenConvMapping()
          const hiddenConvIds = new Set(Object.keys(hiddenMapping))
          
          // Separate visible and hidden conversations
          const visibleConvs = data.filter((c: SidebarConversation) => !hiddenConvIds.has(c.conversation_id || ''))
          const hiddenConvs = data.filter((c: SidebarConversation) => hiddenConvIds.has(c.conversation_id || ''))
          
          setConversations(visibleConvs)
          setHiddenConversations(hiddenConvs)
          onConversationsLoaded(visibleConvs)
          hasLoadedFromCache.current = true
          setIsInitialLoad(false)
        }
      } catch (e) {
        console.error('Error loading from cache:', e)
      }
    }
  }, [getHiddenConvMapping, onConversationsLoaded])

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
    
    // Debounce: Don't fetch if we just fetched within 1 second
    const now = Date.now()
    if (lastFetchTimeRef.current && now - lastFetchTimeRef.current < 1000) {
      return
    }
    
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      return
    }
    isFetchingRef.current = true
    lastFetchTimeRef.current = now
    
    // Only show loading state if not background refresh and we don't have cached data
    if (!isBackground && conversations.length === 0) {
      setLoading(true)
    }
    
    try {
      // Single RPC call replaces 10+ batched queries
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_user_conversations_optimized', { p_user_id: user.id })

      if (rpcError) throw rpcError

      const allConvs: SidebarConversation[] = (rpcData || []).map((c: any) => ({
        other_user_id: c.other_user_id,
        other_username: c.other_username,
        other_avatar_url: c.other_avatar_url,
        rgb_username_expires_at: c.rgb_username_expires_at,
        glowing_username_color: c.glowing_username_color,
        other_created_at: c.other_created_at,
        last_message: c.last_message,
        last_timestamp: c.last_timestamp || '',
        unread_count: c.unread_count || 0,
        conversation_id: c.conversation_id,
      }))

      // Filter out blocked users (both directions)
      const blockedIds = await getBlockedUserIds()
      const blockedSet = new Set(blockedIds)
      const filteredByBlock = allConvs.filter(c => !blockedSet.has(c.other_user_id))

      // Get hidden conversations mapping from localStorage
      const hiddenConvMapping = getHiddenConvMapping()
      const hiddenConvIds = new Set(Object.keys(hiddenConvMapping))

      // Separate visible and hidden
      const visibleConvs = filteredByBlock.filter(c => !hiddenConvIds.has(c.conversation_id || ''))
      const hiddenConvs = filteredByBlock.filter(c => hiddenConvIds.has(c.conversation_id || ''))

      setHiddenConversations(hiddenConvs)

      // Deduplicate by other_user_id
      const uniqueConvsMap = new Map<string, SidebarConversation>()
      visibleConvs.forEach(conv => {
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
      
      // Add Officer Operations if applicable
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
      
      // Sort by timestamp
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
      isFetchingRef.current = false
    }
  }, [user?.id, isUserOfficer, onConversationsLoaded, saveToCache, getHiddenConvMapping])

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

      // Use conversation_id from the already-loaded conversation data (no DB query needed)
      let targetConvId: string | null = conv.conversation_id || null

      // Fallback: if conversation_id wasn't stored, use RPC
      if (!targetConvId) {
        const { data: rpcConvId } = await supabase
          .rpc('find_shared_conversation', { p_user_id: user.id, p_other_user_id: otherUserId })
        targetConvId = rpcConvId || null
      }

      if (targetConvId) {
        // Store in localStorage with both conversation_id and user mapping
        let hiddenChats: Record<string, string> = {}
        try {
          const stored = localStorage.getItem('hidden_conversations')
          if (stored) {
            hiddenChats = JSON.parse(stored)
            if (typeof hiddenChats !== 'object' || hiddenChats === null) {
              hiddenChats = {}
            }
          }
        } catch (e) {
          console.warn('Hide chat: invalid localStorage data, resetting', e)
          hiddenChats = {}
        }

        // Store mapping: conversation_id -> other_user_id
        hiddenChats[targetConvId] = otherUserId
        localStorage.setItem('hidden_conversations', JSON.stringify(hiddenChats))
      }

      // Now update state AFTER storing the mapping
      // Add conversation_id to the hidden conversation object
      const convWithConvId = { ...conv, conversation_id: targetConvId }
      
      // Immediately remove from local state for instant feedback
      setConversations(prev => prev.filter(c => c.other_user_id !== otherUserId))
      
      // Add to hidden conversations for the hidden tab (with conversation_id)
      setHiddenConversations(prev => [...prev, convWithConvId])
      
      toast.success('Chat hidden')
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
      // Find the conversation with this user to get its conversation_id
      const hiddenConv = hiddenConversations.find(c => c.other_user_id === otherUserId)
      const targetConvId = hiddenConv?.conversation_id
      
      // Remove from hidden conversations in local state
      setHiddenConversations(prev => prev.filter(c => c.other_user_id !== otherUserId))
      toast.success('Chat unhidden')

      // Remove from localStorage using the conversation_id
      if (targetConvId) {
        let hiddenChats: Record<string, string> = {}
        try {
          const stored = localStorage.getItem('hidden_conversations')
          if (stored) {
            hiddenChats = JSON.parse(stored)
            if (typeof hiddenChats !== 'object' || hiddenChats === null) {
              hiddenChats = {}
            }
          }
        } catch (e) {
          console.warn('Unhide chat: invalid localStorage data, resetting', e)
          hiddenChats = {}
        }
        
        // Remove this conversation_id from hidden list
        delete hiddenChats[targetConvId]
        localStorage.setItem('hidden_conversations', JSON.stringify(hiddenChats))
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
    activeConversationRef.current = activeConversation
    if (activeConversation) {
      setNewMessagesMap({})
    }
  }, [activeConversation])

  // Force refresh when refreshKey changes
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      // Skip cache and fetch fresh data
      hasLoadedFromCache.current = true // Prevent cache from overriding
      fetchConversations(false)
    }
  }, [refreshKey])

  // Main effect for fetching and realtime - runs when user.id or fetchConversations changes
  useEffect(() => {
    if (!user?.id) return
    
    // Prevent multiple initial fetches - only run once on mount
    if (isMountedRef.current) return
    isMountedRef.current = true
    
    // Save user ID for cache key
    localStorage.setItem('tcps_current_user_id', user.id)
    
    // Only do full fetch if we didn't load from cache
    if (!hasLoadedFromCache.current) {
      fetchConversations(false)
    } else {
      // Already have cache, do background refresh
      fetchConversations(true)
    }
    
    // Debounce fetch for real-time updates
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (user?.id) {
          fetchConversations(true) // Background refresh
        }
      }, 500)
    }
    
    // Subscribe to new messages to update sidebar ordering/preview
    // Only listen for messages in this user's conversations - with proper filtering
    // Note: We can't filter by many conversation_ids, so we use a minimal filter and validate in callback
    const messagesChannel = supabase
      .channel('sidebar-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_messages', filter: `sender_id=eq.${user?.id}` }, (_payload) => {
        // Only trigger on our own messages (to update the list after sending)
        fetchConversations(true)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_messages' }, (payload) => {
         const newMsg = payload.new
         if (newMsg && user?.id && newMsg.sender_id !== user.id) {
           // Use in-memory conversations state instead of DB query
           const isOurConversation = conversations.some(c => c.conversation_id === newMsg.conversation_id)
           if (isOurConversation) {
             fetchConversations(true)
             if (activeConversation !== newMsg.conversation_id) {
               setNewMessagesMap(prev => ({ ...prev, [newMsg.conversation_id]: true }))
             }
           }
         }
      })
      // Only listen for message updates in our own conversations - filter by sender_id not being us
      // This reduces unnecessary triggers significantly
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_messages', filter: `sender_id=neq.${user?.id}` }, (_payload) => {
         // Only fetch when someone else's message is updated (e.g., read status)
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
           if (user?.id) {
             fetchConversations(true)
           }
        })
        .subscribe()
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(messagesChannel)
      if (opsChannel) supabase.removeChannel(opsChannel)
    }
  }, [user?.id, isUserOfficer]) // Note: fetchConversations and activeConversation ref used to avoid infinite loops

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
          <div className="flex items-center gap-1.5">
            <button 
              onClick={onOpenCreateGroup}
              className="p-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 rounded-lg transition-colors border border-purple-500/20"
              title="Create Group Chat"
            >
              <Users className="w-4 h-4" />
            </button>
            <button 
              onClick={onOpenNewMessage}
              className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors shadow-lg shadow-purple-900/20"
              title="New Message"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>
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
              const isGroup = conv.is_group
              
              return (
                <div
                  key={conv.other_user_id}
                  className={`relative group w-full p-4 flex items-start gap-3 hover:bg-white/5 transition-colors text-left ${
                    isActive ? 'bg-white/5 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-purple-500' : ''
                  } ${
                    conv.other_user_id === OFFICER_GROUP_CONVERSATION_ID ? 'bg-blue-900/10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-blue-500' : ''
                  } ${
                    isGroup ? 'bg-purple-900/10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-purple-400' : ''
                  }`}
                >
                  <div 
                    className="absolute inset-0 cursor-pointer"
                    onClick={() => onSelectConversation(conv.other_user_id, isGroup, conv.conversation_id, conv.group_name || undefined)}
                  />

                  <div className="relative flex-shrink-0 pointer-events-none">
                    {conv.other_user_id === OFFICER_GROUP_CONVERSATION_ID ? (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                    ) : isGroup ? (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
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
                    {(!isGroup && (isOnline || conv.other_user_id === OFFICER_GROUP_CONVERSATION_ID)) && (
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
                        {isGroup ? (
                          <span className="flex items-center gap-1.5">
                            {conv.group_name || 'Group Chat'}
                            {conv.member_count && conv.member_count > 0 && (
                              <span className="text-[10px] text-purple-400 font-normal">({conv.member_count})</span>
                            )}
                          </span>
                        ) : (
                          <UserNameWithAge 
                            username={conv.other_username} 
                            createdAt={conv.other_created_at}
                            rgbUsernameExpiresAt={conv.rgb_username_expires_at}
                            glowingUsernameColor={conv.glowing_username_color}
                          />
                        )}
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
