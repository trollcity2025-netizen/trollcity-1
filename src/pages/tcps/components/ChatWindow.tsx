import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { MoreVertical, Phone, Video, ArrowLeft, Ban, EyeOff, MessageCircle, Check, CheckCheck, Trash2, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase, createConversation, markConversationRead, OFFICER_GROUP_CONVERSATION_ID, sendOfficerMessage } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { useChatStore } from '../../../lib/chatStore'
import UserNameWithAge from '../../../components/UserNameWithAge'
import { toast } from 'sonner'
import MessageInput from './MessageInput'

interface ChatWindowProps {
  conversationId: string | null
  otherUserInfo: {
    id: string
    username: string
    avatar_url: string | null
    created_at?: string
    is_online?: boolean
    glowing_username_color?: string | null
  } | null
  isOnline?: boolean
  onBack: () => void
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  read_at?: string | null
  sender_username?: string
  sender_avatar_url?: string | null
  sender_rgb_expires_at?: string | null
  sender_glowing_username_color?: string | null
  sender_created_at?: string
  isPending?: boolean
}

export default function ChatWindow({ conversationId, otherUserInfo, isOnline, onBack }: ChatWindowProps) {
  const { user, profile } = useAuthStore()
  const { openChatBubble } = useChatStore()
  const navigate = useNavigate()
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [actualConversationId, setActualConversationId] = useState<string | null>(conversationId)
  const [showMenu, setShowMenu] = useState(false)
  const [isOpsConversation, setIsOpsConversation] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [hasMore, setHasMore] = useState(true)
  
  // Refs for scroll restoration
  const prevScrollHeightRef = useRef<number>(0)
  const prevScrollTopRef = useRef<number>(0)
  const isFetchingOlderRef = useRef(false)

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCall = (type: 'audio' | 'video') => {
    if (!actualConversationId || !otherUserInfo) return
    navigate(`/call/${actualConversationId}/${type}/${otherUserInfo.id}`)
  }

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return

    try {
      const { error } = await supabase
        .from('conversation_messages')
        .update({ is_deleted: true })
        .eq('id', messageId)

      if (error) throw error

      setMessages(prev => prev.filter(m => m.id !== messageId))
      toast.success('Message deleted')
    } catch (err) {
      console.error('Error deleting message:', err)
      toast.error('Failed to delete message')
    }
  }

  const handleBlock = async () => {
    if (!otherUserInfo?.id || !user?.id) return
    if (!confirm(`Are you sure you want to block ${otherUserInfo.username}?`)) return
    
    try {
      const { error } = await supabase
        .from('user_relationships')
        .insert({
          user_id: user.id,
          related_user_id: otherUserInfo.id,
          status: 'blocked'
        })
      
      if (error) throw error
      toast.success(`${otherUserInfo.username} blocked`)
      onBack()
    } catch (err) {
      console.error('Error blocking user:', err)
      toast.error('Failed to block user')
    }
    setShowMenu(false)
  }

  const handleHideChat = async () => {
    if (!actualConversationId) return
    if (!confirm('Hide this conversation? It will reappear if they message you.')) return

    // For now, we'll just navigate back since "hiding" usually implies soft delete or just removing from list
    // A real implementation might need a 'hidden_conversations' table or flag
    toast.success('Chat hidden')
    onBack()
    setShowMenu(false)
  }

  const handleOpenChatBubble = () => {
    if (!otherUserInfo) return
    openChatBubble(otherUserInfo.id, otherUserInfo.username, otherUserInfo.avatar_url)
    setShowMenu(false)
    toast.success('Chat bubble opened! You can now navigate anywhere.')
  }


  // Initialize or fetch conversation
  useEffect(() => {
    let mounted = true
    const currentOtherUserId = otherUserInfo?.id

    const initChat = async () => {
      if (!user?.id || !otherUserInfo?.id) return
      
      // Check if this is the OPS group conversation
      if (otherUserInfo.id === OFFICER_GROUP_CONVERSATION_ID) {
        setIsOpsConversation(true)
        setActualConversationId(OFFICER_GROUP_CONVERSATION_ID)
        return
      }

      // Reset conversation ID and messages when switching users
      if (actualConversationId !== null && conversationId === null) {
        setActualConversationId(null)
        setMessages([])
      }

      // If we have a direct conversationId, use it. 
      // Otherwise, try to find one or create one?
      // Actually, usually we pass conversationId if it exists. 
      // If it's null, we might need to find it by participants.
      
      let targetConvId = conversationId

      if (!targetConvId) {
        // Try to find existing conversation
        const { data: existingConvs } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', user.id)

        if (existingConvs) {
           const myConvIds = existingConvs.map(c => c.conversation_id)
           // Check if other user is in any of these
           const { data: shared } = await supabase
             .from('conversation_members')
             .select('conversation_id')
             .in('conversation_id', myConvIds)
             .eq('user_id', otherUserInfo.id)
             .maybeSingle()
           
           if (shared) {
             targetConvId = shared.conversation_id
           } else {
             // Create new conversation only if still for the same user
             if (currentOtherUserId !== otherUserInfo.id) return
             try {
                const newConv = await createConversation([otherUserInfo.id])
                targetConvId = newConv.id
             } catch (err) {
                console.error('Failed to create conversation', err)
                toast.error('Failed to start chat')
                return
             }
           }
        }
      }

      if (mounted) {
        setActualConversationId(targetConvId)
      }
    }

    initChat()
    
    return () => {
      mounted = false
    }
  }, [conversationId, otherUserInfo?.id, user?.id])

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [])

  // Fetch messages and sender info
  const fetchMessagesWithSenders = useCallback(async (convId: string, limit = 50, before?: string) => {
    // Handle OPS group conversation differently
    if (convId === OFFICER_GROUP_CONVERSATION_ID) {
      let query = supabase
        .from('officer_chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (before) {
        query = query.lt('created_at', before)
      }
      
      const { data: messagesData, error } = await query
      
      if (error || !messagesData) {
        console.error('Error fetching OPS messages:', error)
        return []
      }
      
      // Enhance with sender info
      const senderIds = [...new Set(messagesData.map(m => m.sender_id))]
      const senderMap: Record<string, any> = {}
      
      if (senderIds.length > 0) {
        const { data: usersData } = await supabase
          .from('user_profiles')
          .select('id,username,avatar_url,rgb_username_expires_at,glowing_username_color,created_at')
          .in('id', senderIds)
        
        usersData?.forEach(u => {
          senderMap[u.id] = u
        })
      }
      
      return messagesData.map(m => ({
        id: m.id,
        conversation_id: OFFICER_GROUP_CONVERSATION_ID,
        sender_id: m.sender_id,
        content: m.content,
        created_at: m.created_at,
        read_at: null,
        sender_username: senderMap[m.sender_id]?.username,
        sender_avatar_url: senderMap[m.sender_id]?.avatar_url,
        sender_rgb_expires_at: senderMap[m.sender_id]?.rgb_username_expires_at,
        sender_glowing_username_color: senderMap[m.sender_id]?.glowing_username_color,
        sender_created_at: senderMap[m.sender_id]?.created_at
      })).reverse()
    }
    
    // Regular DM conversation
    let query = supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', convId)
      .eq('is_deleted', false) // Filter out deleted messages
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }) // Tie-breaker
      .limit(limit)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data: messagesData, error } = await query
    
    if (error || !messagesData) {
      console.error('Error fetching messages:', error)
      return []
    }
    
    // Enhance with sender info
    const senderIds = [...new Set(messagesData.map(m => m.sender_id))]
    const senderMap: Record<string, any> = {}
    
    if (senderIds.length > 0) {
      const { data: usersData } = await supabase
        .from('user_profiles')
        .select('id,username,avatar_url,rgb_username_expires_at,glowing_username_color,created_at')
        .in('id', senderIds)
      
      usersData?.forEach(u => {
        senderMap[u.id] = u
      })
    }

    return messagesData.map(m => ({
      id: m.id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      content: m.body,
      created_at: m.created_at,
      read_at: m.read_at,
      sender_username: senderMap[m.sender_id]?.username,
      sender_avatar_url: senderMap[m.sender_id]?.avatar_url,
      sender_rgb_expires_at: senderMap[m.sender_id]?.rgb_username_expires_at,
      sender_glowing_username_color: senderMap[m.sender_id]?.glowing_username_color,
      sender_created_at: senderMap[m.sender_id]?.created_at
    })).reverse()
  }, [])

  // Use layout effect to adjust scroll position after messages update to prevent jumping
  useLayoutEffect(() => {
    if (isFetchingOlderRef.current && messagesContainerRef.current) {
      const scrollHeight = messagesContainerRef.current.scrollHeight
      const scrollDiff = scrollHeight - prevScrollHeightRef.current
      messagesContainerRef.current.scrollTop = prevScrollTopRef.current + scrollDiff
      isFetchingOlderRef.current = false
    }
  }, [messages])

  const loadMoreMessages = async () => {
    if (loading || !hasMore || !actualConversationId || messages.length === 0) return
    
    // Capture current scroll state BEFORE loading/spinner
    if (messagesContainerRef.current) {
        prevScrollHeightRef.current = messagesContainerRef.current.scrollHeight
        prevScrollTopRef.current = messagesContainerRef.current.scrollTop
        isFetchingOlderRef.current = true
    }
    
    const oldestMsg = messages[0]
    setLoading(true)
    console.log(`[ChatWindow] Loading more messages before ${oldestMsg.created_at}`)
    
    try {
      const olderMessages = await fetchMessagesWithSenders(actualConversationId, 50, oldestMsg.created_at)
      
      if (olderMessages.length < 50) {
        setHasMore(false)
      }

      if (olderMessages.length > 0) {
        setMessages(prev => {
            // Deduplicate just in case
            const prevIds = new Set(prev.map(m => m.id))
            const uniqueOlder = olderMessages.filter(m => !prevIds.has(m.id))
            return [...uniqueOlder, ...prev]
        })
        // Scroll adjustment is handled in useLayoutEffect/useEffect
      } else {
        isFetchingOlderRef.current = false // Reset if no messages found
      }
    } catch (err) {
      console.error('Failed to load older messages', err)
      toast.error('Failed to load older messages')
      isFetchingOlderRef.current = false
    } finally {
      setLoading(false)
    }
  }

  // Load messages
  useEffect(() => {
    if (!actualConversationId || !profile?.id) return

    const loadMessages = async () => {
      setLoading(true)
      console.log(`[ChatWindow] Initial load for ${actualConversationId}`)
      try {
        const mappedMessages = await fetchMessagesWithSenders(actualConversationId)
        setMessages(mappedMessages)
        
        // If we got fewer than 50 messages, there are no more
        if (mappedMessages.length < 50) {
            setHasMore(false)
        } else {
            setHasMore(true)
        }
        
        // Mark as read
        await markConversationRead(actualConversationId)
        
        setTimeout(scrollToBottom, 100)

      } catch (error) {
        console.error('Error loading messages:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMessages()
  }, [actualConversationId, profile?.id, scrollToBottom, fetchMessagesWithSenders])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!actualConversationId || !profile?.id) return

    // For OPS conversation, subscribe to officer_chat_messages
    if (actualConversationId === OFFICER_GROUP_CONVERSATION_ID) {
      const channel = supabase
        .channel(`officer-chat:${actualConversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'officer_chat_messages'
          },
          async (payload) => {
            const newMsgRaw = payload.new
            
            // Fetch sender info
            const { data: senderData } = await supabase
              .from('user_profiles')
              .select('id,username,avatar_url,rgb_username_expires_at,glowing_username_color,created_at')
              .eq('id', newMsgRaw.sender_id)
              .single()
            
            const newMsg: Message = {
              id: newMsgRaw.id,
              conversation_id: OFFICER_GROUP_CONVERSATION_ID,
              sender_id: newMsgRaw.sender_id,
              content: newMsgRaw.content,
              created_at: newMsgRaw.created_at,
              read_at: null,
              sender_username: senderData?.username,
              sender_avatar_url: senderData?.avatar_url,
              sender_rgb_expires_at: senderData?.rgb_username_expires_at,
              sender_glowing_username_color: senderData?.glowing_username_color,
              sender_created_at: senderData?.created_at
            }

            setMessages(prev => {
              const withoutPending = prev.filter(msg => {
                if (msg.isPending && msg.sender_id === user?.id && msg.content === newMsg.content) {
                  return false
                }
                return true
              })
              return [...withoutPending, newMsg]
            })
            
            setTimeout(scrollToBottom, 100)
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }

    // Regular DM conversation subscription
    const channel = supabase
      .channel(`chat:${actualConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${actualConversationId}`
        },
        async (payload) => {
          const newMsgRaw = payload.new
          // Fetch sender info
          let senderInfo: {
            username: string
            avatar_url: string | null
            rgb_username_expires_at: string | null
            glowing_username_color: string | null
            created_at?: string
          } = {
             username: 'Unknown',
             avatar_url: null,
             rgb_username_expires_at: null,
             glowing_username_color: null
          }
          
          if (newMsgRaw.sender_id === user?.id) {
             senderInfo = {
               username: profile?.username || 'You',
               avatar_url: profile?.avatar_url || null,
               rgb_username_expires_at: profile?.rgb_username_expires_at || null,
               glowing_username_color: profile?.glowing_username_color || null,
               created_at: profile?.created_at
             }
          } else {
             const { data } = await supabase.from('user_profiles').select('username,avatar_url,rgb_username_expires_at,glowing_username_color,created_at').eq('id', newMsgRaw.sender_id).maybeSingle()
             if (data) senderInfo = data as any
          }

          const newMsg: Message = {
            id: newMsgRaw.id,
            conversation_id: newMsgRaw.conversation_id,
            sender_id: newMsgRaw.sender_id,
            content: newMsgRaw.body,
            created_at: newMsgRaw.created_at,
            read_at: newMsgRaw.read_at,
            sender_username: senderInfo.username,
            sender_avatar_url: senderInfo.avatar_url,
            sender_rgb_expires_at: senderInfo.rgb_username_expires_at,
            sender_glowing_username_color: senderInfo.glowing_username_color,
            sender_created_at: senderInfo.created_at
          }

          setMessages(prev => {
            // Remove any pending message that matches
            const withoutPending = prev.filter(msg => {
              if (msg.isPending && msg.sender_id === user?.id && msg.content === newMsg.content) {
                return false
              }
              return true
            })
            return [...withoutPending, newMsg]
          })
          
          if (newMsg.sender_id !== user?.id) {
            await markConversationRead(actualConversationId)
          }
          if (isAtBottomRef.current) {
            setTimeout(scrollToBottom, 100)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${actualConversationId}`
        },
        (payload) => {
          const updatedMsg = payload.new
          setMessages(prev => prev.map(m => 
            m.id === updatedMsg.id ? { ...m, read_at: updatedMsg.read_at } : m
          ))
        }
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
         if (payload.payload.userId === otherUserInfo?.id) {
            setIsTyping(payload.payload.isTyping)
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
            
            if (payload.payload.isTyping) {
               // Auto clear after 3 seconds if no stop event received
               typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000)
            }
         }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [actualConversationId, profile, scrollToBottom, user?.id, otherUserInfo?.id])

  // Poll for new messages and read status updates every second
  useEffect(() => {
    if (!actualConversationId) return

    const pollMessages = async () => {
      try {
        const mappedMessages = await fetchMessagesWithSenders(actualConversationId, 50)
        
        setMessages(prev => {
          // If previous messages are empty, just return mapped
          if (prev.length === 0) return mappedMessages

          // We only want to append NEW messages at the bottom, or update read status
          // We DO NOT want to overwrite the whole list because we might have loaded older messages via scroll
          
          const prevIds = new Set(prev.map(m => m.id))
          const newMsgs = mappedMessages.filter(m => !prevIds.has(m.id))
          
          let hasChanges = false
          let nextState = [...prev]

          // Update read status for existing messages
          nextState = nextState.map(m => {
             const updated = mappedMessages.find(up => up.id === m.id)
             if (updated && updated.read_at !== m.read_at) {
                hasChanges = true
                return { ...m, read_at: updated.read_at }
             }
             return m
          })

          if (newMsgs.length > 0) {
             hasChanges = true
             // Only append if they are newer than the last message we have
             const lastMsgTime = new Date(prev[prev.length - 1].created_at).getTime()
             const trulyNew = newMsgs.filter(m => new Date(m.created_at).getTime() > lastMsgTime)
             nextState = [...nextState, ...trulyNew]
          }

          return hasChanges ? nextState : prev
        })
      } catch {
        // Silent fail for polling
      }
    }

    // Initial poll
    pollMessages()

    // Poll every second
    pollIntervalRef.current = setInterval(pollMessages, 1000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [actualConversationId, fetchMessagesWithSenders])

  const isAtBottomRef = useRef(true)

  const handleScroll = () => {
    if (!messagesContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 100
    isAtBottomRef.current = atBottom
    
    // Load more logic
    if (scrollTop < 50 && hasMore && !loading) {
       console.log('[ChatWindow] Triggering loadMoreMessages', { scrollTop, hasMore, loading })
       loadMoreMessages()
    }
  }

  if (!otherUserInfo) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0A0A14] text-gray-500">
        Select a conversation to start chatting
      </div>
    )
  }

  const handleLocalNewMessage = (newMsg: any) => {
    // Add message as pending with sender info
    const pendingMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: actualConversationId || '',
      sender_id: user?.id || '',
      content: newMsg.content || newMsg.body,
      created_at: new Date().toISOString(),
      sender_username: profile?.username,
      sender_avatar_url: profile?.avatar_url,
      sender_rgb_expires_at: profile?.rgb_username_expires_at,
      sender_glowing_username_color: profile?.glowing_username_color,
      sender_created_at: profile?.created_at,
      isPending: true
    }
    setMessages(prev => [...prev, pendingMsg])
    scrollToBottom()
  }

  const handleLocalTyping = (_isTyping: boolean) => {
    // Optional: handle local typing indication if needed
  }

  return (
    <div className="flex flex-col h-full bg-[#121212]">
      {/* Header */}
      <div className="h-16 border-b border-purple-500/20 flex items-center justify-between px-4 bg-[#14141F]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden text-gray-400 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="relative">
            {isOpsConversation ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
            ) : (
              <>
                <img 
                  src={otherUserInfo.avatar_url || `https://ui-avatars.com/api/?name=${otherUserInfo.username}&background=random`}
                  alt={otherUserInfo.username}
                  className="w-10 h-10 rounded-full border border-purple-500/30"
                />
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#14141F] ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              </>
            )}
          </div>
          
          <div>
            {isOpsConversation ? (
              <div className="font-bold text-white leading-none flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                Officer Operations
              </div>
            ) : (
              <UserNameWithAge 
                user={{
                  username: otherUserInfo.username,
                  id: otherUserInfo.id,
                  created_at: otherUserInfo.created_at,
                  glowing_username_color: otherUserInfo.glowing_username_color
                }}
                className="font-bold text-white leading-none hover:text-purple-400 transition-colors block"
              />
            )}
            <span className={`text-xs ${isOpsConversation ? 'text-blue-400' : isOnline ? 'text-green-400' : 'text-red-400'}`}>
              {isOpsConversation ? 'Officer Group Chat' : isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isOpsConversation && (
            <>
              <button 
            onClick={() => handleCall('audio')}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button 
            onClick={() => handleCall('video')}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
          >
            <Video className="w-5 h-5" />
          </button>
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className={`p-2 hover:text-white hover:bg-white/5 rounded-full transition-colors ${showMenu ? 'text-white bg-white/10' : 'text-gray-400'}`}
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#1F1F2E] border border-purple-500/20 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                <button
                  onClick={handleOpenChatBubble}
                  className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-purple-400" />
                  Open Chat Bubble
                </button>
                <button
                  onClick={handleHideChat}
                  className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors"
                >
                  <EyeOff className="w-4 h-4 text-gray-400" />
                  Hide Chat
                </button>
                <div className="h-px bg-white/5 mx-2" />
                <button
                  onClick={handleBlock}
                  className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors"
                >
                  <Ban className="w-4 h-4" />
                  Block User
                </button>
              </div>
            )}
          </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar"
        ref={messagesContainerRef}
        onScroll={handleScroll}
        style={{ overflowAnchor: 'none' }}
      >
        {loading && (
          <div className="flex justify-center">
             <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        
        {messages.map((msg, idx) => {
          const isMe = msg.sender_id === user?.id
          const showAvatar = !isMe && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id)
          
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && (
                <div className="w-8 flex-shrink-0 flex flex-col justify-end">
                   {showAvatar ? (
                     <img 
                       src={msg.sender_avatar_url || `https://ui-avatars.com/api/?name=${msg.sender_username}&background=random`}
                       className={`w-8 h-8 rounded-full border border-purple-500/20 ${msg.isPending ? 'opacity-50' : ''}`}
                       alt={msg.sender_username}
                     />
                   ) : <div className="w-8" />}
                </div>
              )}
              
              <div className={`max-w-[70%] space-y-1 ${isMe ? 'items-end' : 'items-start'} flex flex-col group`}>
                {!isMe && showAvatar && (
                   <UserNameWithAge 
                     user={{
                       username: msg.sender_username || '',
                       id: msg.sender_id,
                       rgb_username_expires_at: msg.sender_rgb_expires_at || undefined,
                       glowing_username_color: msg.sender_glowing_username_color || undefined,
                       created_at: msg.sender_created_at
                     }}
                     className="text-xs text-gray-400 ml-1 hover:text-purple-400"
                   />
                )}
                <div className="flex items-center gap-2">
                   {isMe && (
                     <button
                       onClick={() => handleDeleteMessage(msg.id)}
                       className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                       title="Delete message"
                     >
                       <Trash2 className="w-3 h-3" />
                     </button>
                   )}
                   <div 
                     className={`px-4 py-2 rounded-2xl break-words ${
                       isMe 
                         ? 'bg-purple-600 text-white rounded-tr-none' 
                         : 'bg-[#1F1F2E] text-gray-200 rounded-tl-none border border-purple-500/10'
                     } ${msg.isPending ? 'opacity-70' : ''}`}
                   >
                     {msg.content}
                   </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500 px-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  
                  {/* Read status for own messages */}
                  {isMe && (
                    <span>
                      {msg.read_at ? (
                        <CheckCheck className="w-3 h-3 text-purple-400" />
                      ) : (
                        <Check className={`w-3 h-3 ${msg.isPending ? 'text-gray-600' : 'text-gray-400'}`} />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex gap-3 justify-start animate-in fade-in slide-in-from-bottom-2 duration-200">
             <div className="w-8 flex-shrink-0 flex flex-col justify-end">
               <img 
                 src={otherUserInfo.avatar_url || `https://ui-avatars.com/api/?name=${otherUserInfo.username}&background=random`}
                 className="w-8 h-8 rounded-full border border-purple-500/20"
                 alt={otherUserInfo.username}
               />
             </div>
             <div className="flex flex-col items-start space-y-1">
                <span className="text-xs text-gray-400 ml-1">{otherUserInfo.username}</span>
                <div className="px-4 py-2 rounded-2xl rounded-tl-none bg-[#1F1F2E] text-gray-400 border border-purple-500/10 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" />
                </div>
             </div>
          </div>
        )}

        <div className="h-1" /> {/* Spacer */}
      </div>

      {/* Input */}
      <div className="p-4 bg-[#1A1A1A] border-t border-[#2C2C2C]" onFocusCapture={() => setShowMenu(false)}>
        {actualConversationId && otherUserInfo && (
          <MessageInput 
            conversationId={actualConversationId}
            otherUserId={otherUserInfo.id}
            onMessageSent={scrollToBottom}
            onNewMessage={handleLocalNewMessage}
            onTyping={handleLocalTyping}
          />
        )}
      </div>
    </div>
  )
}
