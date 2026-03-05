import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Minus, CheckCheck, Shield, Clock, Phone, Video } from 'lucide-react'
import { supabase, createConversation, getConversationMessages, markConversationRead, OFFICER_GROUP_CONVERSATION_ID } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { useChatStore } from '../lib/chatStore'
import { usePresenceStore } from '../lib/presenceStore'
import UserNameWithAge from './UserNameWithAge'
import MessageInput from '../pages/tcps/components/MessageInput'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

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

export default function ChatBubble() {
  const { user, profile } = useAuthStore()
  const { isOpen, isMinimized, activeUserId, activeUsername, activeUserAvatar, closeChatBubble, toggleMinimize } = useChatStore()
  const { onlineUserIds } = usePresenceStore()
  const navigate = useNavigate()

  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [actualConversationId, setActualConversationId] = useState<string | null>(null)
  const [isTyping, _setIsTyping] = useState(false)
  const [isOpsConversation, setIsOpsConversation] = useState(false)
  const [activeUserCreatedAt, setActiveUserCreatedAt] = useState<string | undefined>(undefined)
  const [activeUserGlowingColor, setActiveUserGlowingColor] = useState<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [callMinutes, setCallMinutes] = useState({ audio: 0, video: 0 })
  const [isInitiatingCall, setIsInitiatingCall] = useState(false)

  // Audio ref for message sounds
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Load call minutes when chat opens
  useEffect(() => {
    if (!isOpen || !user?.id) return

    const loadMinutes = async () => {
      try {
        const { data, error } = await supabase.rpc('get_call_balances', { p_user_id: user.id })
        if (error) throw error
        setCallMinutes({
          audio: data?.audio_minutes || 0,
          video: data?.video_minutes || 0
        })
      } catch (err) {
        console.error('Error loading call minutes:', err)
      }
    }

    loadMinutes()
  }, [isOpen, user?.id])

  // Initiate call function
  const initiateCall = async (callType: 'audio' | 'video') => {
    if (!user?.id || !activeUserId || isInitiatingCall) return

    const requiredMinutes = callType === 'audio' ? 1 : 2
    const hasMinutes = callType === 'audio' ? callMinutes.audio >= requiredMinutes : callMinutes.video >= requiredMinutes

    if (!hasMinutes) {
      toast.error(`You don't have enough ${callType} minutes. Please purchase a package.`)
      return
    }

    setIsInitiatingCall(true)

    try {
      // Create a call room
      const roomId = crypto.randomUUID()
      const { error: roomError } = await supabase.from('call_rooms').insert({
        id: roomId,
        caller_id: user.id,
        receiver_id: activeUserId,
        type: callType,
        status: 'pending'
      })

      if (roomError) throw roomError

      // Send call notification to the other user
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: activeUserId,
        type: 'call',
        title: 'Incoming Call',
        message: `${profile?.username || 'Someone'} is calling you`,
        metadata: {
          caller_id: user.id,
          caller_username: profile?.username,
          caller_avatar: profile?.avatar_url,
          call_type: callType,
          room_id: roomId
        }
      })

      if (notifError) throw notifError

      // Navigate to call page
      navigate(`/call/${roomId}/${callType}/${activeUserId}`)
      closeChatBubble()

    } catch (err: any) {
      console.error('Error initiating call:', err)
      toast.error('Failed to start call. Please try again.')
    } finally {
      setIsInitiatingCall(false)
    }
  }

  // Reset state when bubble closes
  useEffect(() => {
    if (!isOpen) {
      // Clear state when closed
      setMessages([])
      setLoading(false)
      setActualConversationId(null)
      setIsOpsConversation(false)
    }
  }, [isOpen])

  const handleLocalTyping = (_typing: boolean) => {
    // TODO: Implement typing status broadcast
    // For now this is just a stub to satisfy the interface
  }

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [])

  const fetchMessagesWithSenders = useCallback(async (conversationId: string) => {
    const messagesData = await getConversationMessages(conversationId)
    if (!messagesData || messagesData.length === 0) return []

    // Batch fetch sender profiles
    const senderIds = Array.from(new Set(messagesData.map(m => m.sender_id)))
    const { data: senders } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url, rgb_username_expires_at, glowing_username_color, created_at')
      .in('id', senderIds)

    const senderMap: Record<string, any> = {}
    senders?.forEach(s => {
      senderMap[s.id] = s
    })

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

  // Initialize conversation and load messages
  useEffect(() => {
    if (!isOpen || !user?.id || !activeUserId) return

    let mounted = true

    const initChat = async () => {
      // Check if this is the OPS group conversation
      if (activeUserId === OFFICER_GROUP_CONVERSATION_ID) {
        setIsOpsConversation(true)
        setActualConversationId(OFFICER_GROUP_CONVERSATION_ID)
        return
      }

      // For regular conversations
      setIsOpsConversation(false)
      
      // Fetch active user's info
      const { data: userData } = await supabase
        .from('user_profiles')
        .select('created_at, glowing_username_color')
        .eq('id', activeUserId)
        .maybeSingle()
        
      if (mounted && userData) {
        setActiveUserCreatedAt(userData.created_at)
        setActiveUserGlowingColor(userData.glowing_username_color)
      }

      // Try to find existing conversation
      const { data: existingConvs } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)

      let targetConvId: string | null = null

      if (existingConvs && existingConvs.length > 0) {
        const myConvIds = existingConvs.map(c => c.conversation_id)
        
        // Batch lookup to avoid URL length limits
        const BATCH_SIZE = 50
        let foundConv: string | null = null
        
        for (let i = 0; i < myConvIds.length && !foundConv; i += BATCH_SIZE) {
          const batch = myConvIds.slice(i, i + BATCH_SIZE)
          const { data: shared, error } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .in('conversation_id', batch)
            .eq('user_id', activeUserId)
            .limit(1)
          
          if (!error && shared && shared.length > 0) {
            foundConv = shared[0].conversation_id
          }
        }
        
        if (foundConv) {
          targetConvId = foundConv
        } else {
          // Create new conversation
          try {
            const newConv = await createConversation([activeUserId])
            targetConvId = newConv.id
          } catch (err) {
            console.error('Failed to create conversation', err)
            toast.error('Failed to start chat')
            return
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
  }, [isOpen, activeUserId, user?.id])

  // Load messages when conversation ID is set - same approach as ChatWindow
  useEffect(() => {
    if (!actualConversationId || !isOpen) return

    let mounted = true

    const loadMessages = async () => {
      setLoading(true)
      try {
        const rows = await getConversationMessages(actualConversationId, { limit: 100 })
        if (!mounted) return

        if (!rows || rows.length === 0) {
          setMessages([])
          return
        }

        const senderIds = Array.from(new Set(rows.map((m) => m.sender_id)))
        const { data: senders } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url, rgb_username_expires_at, glowing_username_color, created_at')
          .in('id', senderIds)

        const senderMap: Record<string, any> = {}
        senders?.forEach((s) => {
          senderMap[s.id] = s
        })

        const mapped = rows
          .map((m) => ({
            id: m.id,
            conversation_id: m.conversation_id,
            sender_id: m.sender_id,
            content: m.body,
            created_at: m.created_at,
            read_at: (m as any).read_at ?? null,
            sender_username: senderMap[m.sender_id]?.username,
            sender_avatar_url: senderMap[m.sender_id]?.avatar_url,
            sender_rgb_expires_at: senderMap[m.sender_id]?.rgb_username_expires_at,
            sender_glowing_username_color: senderMap[m.sender_id]?.glowing_username_color,
            sender_created_at: senderMap[m.sender_id]?.created_at,
          }))
          .reverse()

        setMessages(mapped)
        await markConversationRead(actualConversationId)
        setTimeout(scrollToBottom, 100)
      } catch (error) {
        console.error('Error loading messages:', error)
        setMessages([])
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadMessages()

    return () => {
      mounted = false
    }
  }, [actualConversationId, isOpen, scrollToBottom])

  // Subscribe to new messages
  useEffect(() => {
    if (!actualConversationId || !profile?.id || !isOpen) return

    const channel = supabase
      .channel(`chat-bubble:${actualConversationId}`)
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
          let senderInfo = {
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
                glowing_username_color: profile?.glowing_username_color || null
              }
           } else if (newMsgRaw.sender_id === activeUserId) {
              // Optimization: Use active chat store data if available
              senderInfo = {
                username: activeUsername || 'Unknown',
                avatar_url: activeUserAvatar || null,
                rgb_username_expires_at: null, // Store might not have this, but it's better than a fetch
                glowing_username_color: activeUserGlowingColor || null
              }
              
              // Optional: Background refresh if we really need updated data (e.g. RGB)
              // But for chat bubble speed, this is sufficient.
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
            sender_glowing_username_color: (senderInfo as any).glowing_username_color
          }

          setMessages(prev => {
            // Remove any pending message that matches (by comparing content and sender)
            const withoutPending = prev.filter(msg => {
              if (!msg.isPending) return true
              return !(msg.content === newMsg.content && msg.sender_id === newMsg.sender_id)
            })
            return [...withoutPending, newMsg]
          })
          
          if (newMsgRaw.sender_id !== user?.id) {
            // Play sound
            if (audioRef.current) {
              audioRef.current.src = '/sounds/pop.mp3'
              audioRef.current.play().catch(e => console.log('Audio play blocked:', e))
            }
            // Mark as read immediately if chat is open
            markConversationRead(actualConversationId)
          }

          setTimeout(scrollToBottom, 100)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [actualConversationId, profile?.id, profile?.username, profile?.avatar_url, profile?.rgb_username_expires_at, profile?.glowing_username_color, isOpen, user?.id, activeUserId, activeUsername, activeUserAvatar, activeUserGlowingColor, scrollToBottom])

  // Poll for new messages and read status updates every second
  useEffect(() => {
    if (!actualConversationId || !isOpen) return

    const pollMessages = async () => {
      try {
        const mappedMessages = await fetchMessagesWithSenders(actualConversationId)

        setMessages(prev => {
          const prevMap = new Map(prev.map(m => [m.id, m]))

          // Check if there are new messages
          const hasNewMessages = mappedMessages.some(m => !prevMap.has(m.id))
          if (hasNewMessages) {
            return mappedMessages
          }

          // Check for read status updates on existing messages
          const hasReadUpdate = mappedMessages.some(m => {
            const prevMsg = prevMap.get(m.id)
            return prevMsg && prevMsg.read_at !== m.read_at
          })
          if (hasReadUpdate) {
            return mappedMessages
          }

          return prev
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
  }, [actualConversationId, isOpen, fetchMessagesWithSenders])

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
      isPending: true
    }
    setMessages(prev => [...prev, pendingMsg])
    scrollToBottom()
  }

  if (!isOpen) return null

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={toggleMinimize}
          className="bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-full shadow-lg shadow-purple-900/50 flex items-center justify-center transition-all hover:scale-105"
        >
          <div className="relative">
            <img 
              src={activeUserAvatar || `https://ui-avatars.com/api/?name=${activeUsername}&background=random`}
              alt={activeUsername || ''}
              className="w-10 h-10 rounded-full border-2 border-white/20"
            />
            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-purple-600 ${activeUserId && onlineUserIds.includes(activeUserId) ? 'bg-green-500' : 'bg-gray-500'}`} />
          </div>
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 right-4 w-80 h-[500px] bg-[#14141F] border border-purple-500/20 rounded-t-xl shadow-2xl flex flex-col z-50 animate-in slide-in-from-bottom-10 duration-200">
      <audio ref={audioRef} className="hidden" />
      
      {/* Header */}
      <div className="bg-[#1F1F2E] p-3 flex items-center justify-between border-b border-purple-500/20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            {isOpsConversation ? (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
            ) : (
              <>
                <img 
                  src={activeUserAvatar || `https://ui-avatars.com/api/?name=${activeUsername}&background=random`}
                  alt={activeUsername || ''}
                  className="w-8 h-8 rounded-full border border-purple-500/20"
                />
                <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#1F1F2E] ${activeUserId && onlineUserIds.includes(activeUserId) ? 'bg-green-500' : 'bg-gray-500'}`} />
              </>
            )}
          </div>
          <div>
            {isOpsConversation ? (
              <>
                <div className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  Officer Operations
                </div>
                <div className="text-[10px] text-blue-400">Officer Group Chat</div>
              </>
            ) : (
              <>
                {activeUsername && (
                  <UserNameWithAge
                    user={{
                      username: activeUsername,
                      created_at: activeUserCreatedAt
                    }}
                    className="font-bold text-white hover:text-purple-400 transition-colors text-sm"
                  />
                )}
                <div className="text-[10px] flex items-center gap-1">
                  {activeUserId && onlineUserIds.includes(activeUserId) ? (
                    <>
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-green-400">Online</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                      <span className="text-gray-500">Offline</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Audio/Video Call Buttons - Only for non-OPS conversations */}
          {!isOpsConversation && activeUserId && (
            <>
              <button
                onClick={() => initiateCall('audio')}
                disabled={isInitiatingCall}
                className="p-1.5 hover:bg-green-500/20 rounded-lg text-gray-400 hover:text-green-400 transition-colors disabled:opacity-50"
                title={`Audio call (${callMinutes.audio} min available)`}
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                onClick={() => initiateCall('video')}
                disabled={isInitiatingCall}
                className="p-1.5 hover:bg-blue-500/20 rounded-lg text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-50"
                title={`Video call (${callMinutes.video} min available)`}
              >
                <Video className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={toggleMinimize}
            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={closeChatBubble}
            className="p-1.5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0F0F1A] no-scrollbar"
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm mt-8">
            Start a conversation with {activeUsername}
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id
            return (
              <div
                key={msg.id}
                className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar - show for both sender and receiver */}
                  <img
                    src={isMe
                      ? (profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.username}&background=random`)
                      : (msg.sender_avatar_url || `https://ui-avatars.com/api/?name=${msg.sender_username}&background=random`)
                    }
                    alt={isMe ? 'You' : msg.sender_username}
                    className={`w-8 h-8 rounded-full border border-purple-500/20 flex-shrink-0 ${msg.isPending ? 'opacity-50' : ''}`}
                  />

                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* Username and time */}
                    <div className="flex items-center gap-2 mb-1">
                      {!isMe && msg.sender_username && (
                        <UserNameWithAge
                          user={{
                            username: msg.sender_username,
                            id: msg.sender_id,
                            rgb_username_expires_at: msg.sender_rgb_expires_at || undefined,
                            glowing_username_color: (msg as any).sender_glowing_username_color || undefined,
                            created_at: msg.sender_created_at
                          }}
                          className="text-xs font-bold text-gray-400 hover:text-purple-400"
                        />
                      )}
                      {isMe && (
                        <span className="text-xs font-bold text-purple-400">You</span>
                      )}
                      <span className="text-[10px] text-gray-600">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Message bubble */}
                    <div className={`p-3 rounded-2xl text-sm break-words ${
                      isMe
                        ? 'bg-purple-600 text-white rounded-tr-none'
                        : 'bg-[#1F1F2E] text-gray-200 rounded-tl-none border border-purple-500/10'
                    } ${msg.isPending ? 'opacity-70' : ''}`}>
                      {msg.content}
                    </div>

                    {/* Message status indicators for own messages */}
                    {isMe && (
                      <div className="flex items-center gap-1 mt-1">
                        {msg.isPending ? (
                          // Sending - Clock icon
                          <div className="flex items-center gap-1" title="Sending...">
                            <Clock className="w-3 h-3 text-gray-500 animate-pulse" />
                            <span className="text-[10px] text-gray-500">sending</span>
                          </div>
                        ) : msg.read_at ? (
                          // Read - Double blue check
                          <div className="flex items-center gap-0.5" title={`Read at ${new Date(msg.read_at).toLocaleTimeString()}`}>
                            <CheckCheck className="w-3 h-3 text-blue-400" />
                          </div>
                        ) : (
                          // Delivered - Double gray check
                          <div className="flex items-center gap-0.5" title="Delivered">
                            <CheckCheck className="w-3 h-3 text-gray-500" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        
        {isTyping && (
          <div className="flex items-center gap-2 p-2 text-gray-400 text-xs">
            <div className="flex gap-1">
              <span className="animate-bounce delay-0">.</span>
              <span className="animate-bounce delay-100">.</span>
              <span className="animate-bounce delay-200">.</span>
            </div>
            <span>{activeUsername} is typing</span>
          </div>
        )}
      </div>

      {/* Input */}
        <div className="p-3 border-t border-[#2C2C2C] bg-[#1A1A1A]">
          {actualConversationId && activeUserId && (
            <MessageInput 
              conversationId={actualConversationId}
              otherUserId={activeUserId}
              onMessageSent={scrollToBottom}
              onNewMessage={handleLocalNewMessage}
              onTyping={handleLocalTyping}
            />
          )}
        </div>
    </div>
  )
}
