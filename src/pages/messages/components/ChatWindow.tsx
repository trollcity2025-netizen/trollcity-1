import { useEffect, useRef, useState, useCallback } from 'react'
import { MoreVertical, Phone, Video } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase, createConversation, getConversationMessages, markConversationRead } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import ClickableUsername from '../../../components/ClickableUsername'
import { toast } from 'sonner'
import MessageInput from './MessageInput'

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
}

interface ChatWindowProps {
  otherUserId: string | null
  otherUserUsername?: string
  otherUserAvatar?: string | null
  isOnline?: boolean
  isTyping?: boolean
}

export default function ChatWindow({
  otherUserId,
  otherUserUsername,
  otherUserAvatar,
  isOnline,
  isTyping
}: ChatWindowProps) {
  const { profile, user } = useAuthStore()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [oldestLoadedAt, setOldestLoadedAt] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const ensureConversationId = useCallback(async () => {
    if (!profile?.id || !otherUserId) return null
    if (conversationId) return conversationId

    try {
      const { data: myMemberships, error: myError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', profile.id)

      if (myError) {
        console.error('Error loading conversation memberships:', myError)
      } else {
        const conversationIds = (myMemberships || []).map((m: any) => m.conversation_id)
        if (conversationIds.length > 0) {
          const { data: otherMemberships, error: otherError } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', otherUserId)
            .in('conversation_id', conversationIds)

          if (otherError) {
            console.error('Error loading other member conversations:', otherError)
          } else if (otherMemberships && otherMemberships.length > 0) {
            const existingId = (otherMemberships[0] as any).conversation_id as string
            setConversationId(existingId)
            return existingId
          }
        }
      }

      const conversation = await createConversation([otherUserId])
      setConversationId(conversation.id)
      return conversation.id
    } catch (error) {
      console.error('Error ensuring conversation:', error)
      return null
    }
  }, [profile?.id, otherUserId, conversationId])

  useEffect(() => {
    if (otherUserId && profile?.id) {
      ensureConversationId()
    }
  }, [otherUserId, profile?.id, ensureConversationId])

  const loadMessages = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background ?? false
    if (!conversationId || !profile?.id) return

    try {
      if (!background) {
        setLoading(true)
      }

      const messagesData = await getConversationMessages(conversationId, { limit: 50 })

      const senderIds = [...new Set(messagesData.map((m) => m.sender_id).filter(Boolean))]
      const senderMap: Record<string, { username: string; avatar_url: string | null; rgb_username_expires_at?: string | null }> = {}

      if (senderIds.length > 0) {
        const { data: usersData } = await supabase
          .from('user_profiles')
          .select('id,username,avatar_url,rgb_username_expires_at')
          .in('id', senderIds)

        usersData?.forEach((user) => {
          senderMap[user.id] = {
            username: user.username,
            avatar_url: user.avatar_url,
            rgb_username_expires_at: user.rgb_username_expires_at
          }
        })
      }

      const mappedMessagesDesc = messagesData.map((msg) => ({
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id,
        content: msg.body,
        created_at: msg.created_at,
        sender_username: senderMap[msg.sender_id]?.username || 'Unknown',
        sender_avatar_url: senderMap[msg.sender_id]?.avatar_url || null,
        sender_rgb_expires_at: senderMap[msg.sender_id]?.rgb_username_expires_at
      }))
      const mappedMessages = mappedMessagesDesc.reverse()
      setMessages(mappedMessages)
      setOldestLoadedAt(mappedMessages[0]?.created_at || null)
      setHasMore(messagesData.length === 50)

      try {
        await markConversationRead(conversationId)
      } catch (err) {
        console.warn('Could not mark conversation read:', err)
      }

      if (!background || isAtBottom) {
        setTimeout(() => {
          scrollToBottom()
        }, 0)
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      if (!background) {
        setLoading(false)
      }
    }
  }, [conversationId, profile?.id, scrollToBottom, isAtBottom])

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || !profile?.id || !oldestLoadedAt || loadingMore || !hasMore) return
    setLoadingMore(true)
    const container = messagesContainerRef.current
    const prevScrollHeight = container?.scrollHeight || 0
    const prevScrollTop = container?.scrollTop || 0
    try {
      const olderData = await getConversationMessages(conversationId!, {
        limit: 50,
        before: oldestLoadedAt,
      })

      if (!olderData || olderData.length === 0) {
        setHasMore(false)
        return
      }

      const senderIds = [...new Set(olderData.map(m => m.sender_id).filter(Boolean))]
      const senderMap: Record<string, { username: string; avatar_url: string | null; rgb_username_expires_at?: string | null }> = {}
      if (senderIds.length > 0) {
        const { data: usersData } = await supabase
          .from('user_profiles')
          .select('id,username,avatar_url,rgb_username_expires_at')
          .in('id', senderIds)
        usersData?.forEach((user) => {
          senderMap[user.id] = {
            username: user.username,
            avatar_url: user.avatar_url,
            rgb_username_expires_at: user.rgb_username_expires_at
          }
        })
      }

      const mappedOlderDesc = olderData.map((msg) => ({
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id,
        content: msg.body,
        created_at: msg.created_at,
        sender_username: senderMap[msg.sender_id]?.username || 'Unknown',
        sender_avatar_url: senderMap[msg.sender_id]?.avatar_url || null,
        sender_rgb_expires_at: senderMap[msg.sender_id]?.rgb_username_expires_at
      }))
      const mappedOlder = mappedOlderDesc.reverse()

      setMessages((prev) => [...mappedOlder, ...prev])
      setOldestLoadedAt(mappedOlder[0]?.created_at || oldestLoadedAt)

      setTimeout(() => {
        const el = messagesContainerRef.current
        if (!el) return
        const newScrollHeight = el.scrollHeight
        el.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop
      }, 0)
    } catch (err) {
      console.error('Error loading older messages:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [conversationId, profile?.id, oldestLoadedAt, hasMore, loadingMore])
  const handleStartCall = async (callType: 'audio' | 'video') => {
    if (!otherUserId || !user?.id || !profile?.id) {
      toast.error('Unable to start call');
      return;
    }

    try {
      // Check minute balance
      const { data: balanceData, error: balanceError } = await supabase.rpc('get_call_balances', {
        p_user_id: user.id
      });

      if (balanceError) throw balanceError;

      const requiredMinutes = callType === 'audio' ? 1 : 2;
      const hasMinutes = callType === 'audio' 
        ? (balanceData?.audio_minutes || 0) >= requiredMinutes
        : (balanceData?.video_minutes || 0) >= requiredMinutes;

      if (!hasMinutes) {
        toast.error(`You don't have enough ${callType} minutes. Please purchase a package.`);
        navigate('/store');
        return;
      }

      // Create room ID (sorted to ensure consistency)
      const userIds = [user.id, otherUserId].sort();
      const roomId = `call_${userIds[0]}_${userIds[1]}`;

      // Send call notification to other user
      await supabase.from('notifications').insert({
        user_id: otherUserId,
        type: 'call',
        content: `${profile.username} is calling you`,
        metadata: {
          caller_id: user.id,
          caller_username: profile.username,
          caller_avatar: profile.avatar_url,
          call_type: callType,
          room_id: roomId
        }
      });

      // Navigate to call page
      navigate(`/call/${roomId}/${callType}/${otherUserId}`);
    } catch (err: any) {
      console.error('Error starting call:', err);
      toast.error('Failed to start call');
    }
  }

  useEffect(() => {
    if (!otherUserId || !profile?.id) {
      setConversationId(null)
      setMessages([])
      return
    }

    let cancelled = false

    const init = async () => {
      const id = await ensureConversationId()
      if (!cancelled && id) {
        setConversationId(id)
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [otherUserId, profile?.id, ensureConversationId])

  useEffect(() => {
    if (!conversationId || !profile?.id) {
      return
    }

    loadMessages()

    const channelName = `conversation:${conversationId}`
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: profile.id },
      },
    })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsgRaw = payload.new as any
          const senderId = newMsgRaw.sender_id as string

          let senderProfile:
            | {
                username: string
                avatar_url: string | null
                rgb_username_expires_at?: string | null
              }
            | null = null

          try {
            const { data } = await supabase
              .from('user_profiles')
              .select('id,username,avatar_url,rgb_username_expires_at')
              .eq('id', senderId)
              .single()
            if (data) {
              senderProfile = {
                username: data.username,
                avatar_url: data.avatar_url,
                rgb_username_expires_at: (data as any).rgb_username_expires_at,
              }
            }
          } catch (err) {
            console.warn('Could not load sender profile for new message:', err)
          }

          const newMsg: Message = {
            id: newMsgRaw.id,
            conversation_id: newMsgRaw.conversation_id,
            sender_id: newMsgRaw.sender_id,
            content: newMsgRaw.body,
            created_at: newMsgRaw.created_at,
            read_at: undefined,
            sender_username: senderProfile?.username || 'Unknown',
            sender_avatar_url: senderProfile?.avatar_url || null,
            sender_rgb_expires_at: senderProfile?.rgb_username_expires_at,
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) {
              return prev
            }
            return [...prev, newMsg]
          })

          const container = messagesContainerRef.current
          const nearBottom = container
            ? container.scrollHeight - (container.scrollTop + container.clientHeight) < 150
            : true

          if (nearBottom) {
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }, 100)
          }
        }
      )
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const newMsg = payload.payload as any
        if (newMsg.conversation_id !== conversationId) {
          return
        }

        const mapped: Message = {
          id: newMsg.id,
          conversation_id: newMsg.conversation_id,
          sender_id: newMsg.sender_id,
          content: newMsg.body,
          created_at: newMsg.created_at,
          read_at: newMsg.read_at,
          sender_username: newMsg.sender_username,
          sender_avatar_url: newMsg.sender_avatar_url,
          sender_rgb_expires_at: newMsg.sender_rgb_expires_at,
        }

        setMessages((prev) => {
          if (prev.some((m) => m.id === mapped.id)) {
            return prev
          }
          return [...prev, mapped]
        })

        const container = messagesContainerRef.current
        const nearBottom = container
          ? container.scrollHeight - (container.scrollTop + container.clientHeight) < 150
          : true

        if (nearBottom) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
          }, 100)
        }
      })
      .subscribe((status) => {
        console.log(`📡 Conversation channel status: ${status}`)
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setTimeout(() => {
            channel.subscribe()
          }, 2000)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, profile?.id, loadMessages])

  useEffect(() => {
    if (!conversationId || !profile?.id) return

    const interval = setInterval(() => {
      loadMessages({ background: true })
    }, 2000)

    return () => {
      clearInterval(interval)
    }
  }, [conversationId, profile?.id, loadMessages])

  const handleMessageSent = () => {
    // Message added via broadcast, no need to reload
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  if (!otherUserId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#04000d]">
        <div className="text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-[#9b32ff] to-[#00ffcc] rounded-full mx-auto mb-4 opacity-20"></div>
          <p className="text-gray-400 text-lg">Select a conversation to start messaging</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-[#04000d]">
      {/* Chat Header */}
      <div className="p-4 border-b border-[#8a2be2]/30 bg-[rgba(10,0,30,0.6)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={otherUserAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUserUsername}`}
            alt={otherUserUsername}
            className="w-10 h-10 rounded-full border-2 border-[#8a2be2]"
          />
          <div>
            <div className="flex items-center gap-2">
              <ClickableUsername userId={otherUserId} username={otherUserUsername || 'Unknown'} />
              {isOnline && (
                <span className="text-xs text-[#00ffcc] flex items-center gap-1">
                  <span className="w-2 h-2 bg-[#00ffcc] rounded-full animate-pulse"></span>
                  Online
                </span>
              )}
            </div>
            {isTyping && (
              <p className="text-xs text-[#74f7ff] animate-pulse">typing...</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleStartCall('audio')}
            className="p-2 hover:bg-[rgba(155,50,255,0.1)] rounded-lg transition"
            title="Voice call"
          >
            <Phone className="w-5 h-5 text-[#8a2be2]" />
          </button>
          <button
            type="button"
            onClick={() => handleStartCall('video')}
            className="p-2 hover:bg-[rgba(155,50,255,0.1)] rounded-lg transition"
            title="Video call"
          >
            <Video className="w-5 h-5 text-[#8a2be2]" />
          </button>
          <button
            type="button"
            className="p-2 hover:bg-[rgba(155,50,255,0.1)] rounded-lg transition"
            title="More options"
          >
            <MoreVertical className="w-5 h-5 text-[#8a2be2]" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={(e) => {
          const el = e.currentTarget
          const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight)
          setIsAtBottom(distanceFromBottom < 150)
          if (el.scrollTop < 80 && hasMore && !loadingMore) {
            loadOlderMessages()
          }
        }}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === profile?.id

            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
                  {!isOwn && (
                    <div className="flex items-center gap-2 mb-1 px-2">
                      <img
                        src={msg.sender_avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.sender_username}`}
                        alt={msg.sender_username}
                        className="w-6 h-6 rounded-full"
                      />
                      <ClickableUsername 
                        userId={msg.sender_id} 
                        username={msg.sender_username || 'Unknown'} 
                        profile={{ rgb_username_expires_at: msg.sender_rgb_expires_at ?? undefined }}
                        className="text-xs text-gray-400"
                      />
                    </div>
                  )}
                  <div
                    className={`
                      p-3 rounded-2xl shadow-lg
                      ${isOwn
                        ? 'bg-gradient-to-br from-[#7d3cff] to-[#00ffcc] text-black'
                        : 'bg-[rgba(20,0,50,0.6)] border-l-4 border-[#8a2be2] text-white'
                      }
                    `}
                    style={isOwn ? { boxShadow: '0 0 10px #7d3cff' } : {}}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <p className={`text-[10px] text-[#74f7ff] mt-1 px-2 ${isOwn ? 'text-right' : 'text-left'}`}>
                    {isOwn
                      ? `${formatTime(msg.created_at)} · ${msg.read_at ? 'Seen' : 'Delivered'}`
                      : formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <MessageInput otherUserId={otherUserId} conversationId={conversationId} onMessageSent={handleMessageSent} />
    </div>
  )
}

