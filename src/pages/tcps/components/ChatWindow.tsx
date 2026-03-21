import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, createConversation, getConversationMessages, markConversationRead, OFFICER_GROUP_CONVERSATION_ID } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import MessageInput from './MessageInput'

const MAX_MESSAGES = 500 // Increased to fetch more messages

type ChatMessage = {
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

interface ChatWindowProps {
  conversationId: string | null
  otherUserInfo: {
    id: string
    username: string
    avatar_url: string | null
    created_at?: string
    rgb_username_expires_at?: string | null
    glowing_username_color?: string | null
  } | null
  isOnline?: boolean
  onBack?: () => void
  onMessageSent?: () => void // Callback when a message is sent
}

const ChatWindow = ({ otherUserInfo, isOnline, onBack, onMessageSent }: ChatWindowProps) => {
  const { user, profile } = useAuthStore()
  const [actualConversationId, setActualConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const virtuosoRef = useRef<VirtuosoHandle>(null)

  const otherUserId = otherUserInfo?.id ?? null

  const mapConversationMessages = useCallback(async (conversationId: string) => {
    const rows = await getConversationMessages(conversationId, { limit: MAX_MESSAGES })
    if (!rows || rows.length === 0) return []

    const senderIds = Array.from(new Set(rows.map((m) => m.sender_id)))
    const { data: senders, error: sendersError } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url, rgb_username_expires_at, glowing_username_color, created_at')
      .in('id', senderIds)

    if (sendersError) {
      console.error('Error fetching message senders:', sendersError)
    }

    const senderMap: Record<string, any> = {}
    senders?.forEach((s) => {
      senderMap[s.id] = s
    })

    return rows
      .map((m) => ({
        id: m.id,
        conversation_id: m.conversation_id,
        sender_id: m.sender_id,
        content: m.body || m.content,
        created_at: m.created_at,
        read_at: (m as any).read_at ?? null,
        sender_username: senderMap[m.sender_id]?.username,
        sender_avatar_url: senderMap[m.sender_id]?.avatar_url,
        sender_rgb_expires_at: senderMap[m.sender_id]?.rgb_username_expires_at,
        sender_glowing_username_color: senderMap[m.sender_id]?.glowing_username_color,
        sender_created_at: senderMap[m.sender_id]?.created_at,
      }))
      .reverse()
  }, [])

  useEffect(() => {
    if (!user?.id || !otherUserId) {
      setActualConversationId(null)
      setMessages([])
      return
    }

    if (otherUserId === OFFICER_GROUP_CONVERSATION_ID) {
      setActualConversationId(OFFICER_GROUP_CONVERSATION_ID)
      setMessages([])
      return
    }

    let mounted = true
    const init = async () => {
      try {
        const { data: existingConvs, error: existingError } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', user.id)

        if (existingError) throw existingError

        const myConvIds = existingConvs?.map((c) => c.conversation_id) || []
        let targetConvId: string | null = null

        if (myConvIds.length > 0) {
          // Batch the lookup to avoid URL length limits
          const BATCH_SIZE = 50
          let foundConv: string | null = null
          
          for (let i = 0; i < myConvIds.length && !foundConv; i += BATCH_SIZE) {
            const batch = myConvIds.slice(i, i + BATCH_SIZE)
            const { data: shared, error: sharedError } = await supabase
              .from('conversation_members')
              .select('conversation_id')
              .in('conversation_id', batch)
              .eq('user_id', otherUserId)
              .limit(1)

            if (sharedError) {
              console.warn('Error in batch lookup:', sharedError)
              continue
            }
            
            const sharedFirst = Array.isArray(shared) ? shared[0] : null
            if (sharedFirst) {
              foundConv = sharedFirst.conversation_id
            }
          }
          
          targetConvId = foundConv
        }

        if (!targetConvId) {
          const newConv = await createConversation([otherUserId])
          targetConvId = newConv.id
        }

        if (mounted) {
          setActualConversationId(targetConvId)
        }
      } catch (e) {
        console.error('Error initializing conversation:', e)
        if (mounted) {
          setActualConversationId(null)
        }
      }
    }

    void init()
    return () => {
      mounted = false
    }
  }, [otherUserId, user?.id])

  useEffect(() => {
    if (!actualConversationId) return

    let mounted = true

    const load = async () => {
      try {
        const mapped = await mapConversationMessages(actualConversationId)
        if (mounted) setMessages(mapped)
        await markConversationRead(actualConversationId)
      } catch (e) {
        console.error('Error loading messages:', e)
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [actualConversationId, mapConversationMessages])

  useEffect(() => {
    if (!actualConversationId) return

    const channel = supabase.channel(`tcps:${actualConversationId}`)

    const handleNewMessage = async (payload: any) => {
      const newMsgRaw = payload.new || payload.payload
      if (!newMsgRaw) return

      const senderId = newMsgRaw.sender_id

      let senderInfo: any = null
      if (senderId === profile?.id && profile) {
        senderInfo = {
          id: profile.id,
          username: profile.username,
          avatar_url: profile.avatar_url,
          rgb_username_expires_at: profile.rgb_username_expires_at,
          glowing_username_color: profile.glowing_username_color,
          created_at: profile.created_at,
        }
      } else if (senderId === otherUserId && otherUserInfo) {
        senderInfo = {
          id: otherUserInfo.id,
          username: otherUserInfo.username,
          avatar_url: otherUserInfo.avatar_url,
          rgb_username_expires_at: otherUserInfo.rgb_username_expires_at,
          glowing_username_color: otherUserInfo.glowing_username_color,
          created_at: otherUserInfo.created_at,
        }
      } else {
        const { data } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url, rgb_username_expires_at, glowing_username_color, created_at')
          .eq('id', senderId)
          .maybeSingle()
        senderInfo = data
      }

      const newMsg: ChatMessage = {
        id: newMsgRaw.id,
        conversation_id: newMsgRaw.conversation_id,
        sender_id: newMsgRaw.sender_id,
        content: newMsgRaw.body ?? newMsgRaw.content,
        created_at: newMsgRaw.created_at,
        read_at: newMsgRaw.read_at ?? null,
        sender_username: senderInfo?.username,
        sender_avatar_url: senderInfo?.avatar_url,
        sender_rgb_expires_at: senderInfo?.rgb_username_expires_at,
        sender_glowing_username_color: senderInfo?.glowing_username_color,
        sender_created_at: senderInfo?.created_at,
      }

      setMessages((prev) => {
        const withoutPending = prev.filter((m) => {
          if (!m.isPending) return true
          return !(m.sender_id === newMsg.sender_id && m.content === newMsg.content)
        })

        if (withoutPending.some((m) => m.id === newMsg.id)) return withoutPending

        const updated = [...withoutPending, newMsg]
        if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES)
        return updated
      })

      if (newMsgRaw.sender_id !== profile?.id) {
        try {
          await markConversationRead(actualConversationId)
        } catch {
          // ignore
        }
      }
    }

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${actualConversationId}`,
        },
        handleNewMessage
      )
      .on('broadcast', { event: 'new-message' }, handleNewMessage)
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [actualConversationId, otherUserId, otherUserInfo, profile])

  useEffect(() => {
    if (virtuosoRef.current && messages.length > 0) {
      virtuosoRef.current.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' })
    }
  }, [messages])

  const handleNewMessageOptimistic = (msg: any) => {
    if (!actualConversationId || !profile?.id) return

    const pending: ChatMessage = {
      id: msg.id || `temp-${Date.now()}`,
      conversation_id: actualConversationId,
      sender_id: profile.id,
      content: msg.content || msg.body,
      created_at: msg.created_at || new Date().toISOString(),
      read_at: null,
      sender_username: profile.username,
      sender_avatar_url: profile.avatar_url,
      sender_rgb_expires_at: profile.rgb_username_expires_at,
      sender_glowing_username_color: profile.glowing_username_color,
      sender_created_at: profile.created_at,
      isPending: true,
    }

    setMessages((prev) => {
      if (prev.some((m) => m.id === pending.id)) return prev
      const updated = [...prev, pending]
      if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES)
      return updated
    })
  }

  if (!user?.id) return null

  if (!otherUserId) {
    return <div className="flex-1 flex items-center justify-center text-gray-500 h-full">Select a conversation</div>
  }

  if (!actualConversationId) {
    return (
      <div className="flex-1 flex flex-col h-full">
        {/* Header with user info */}
        {otherUserInfo && (
          <div className="flex items-center gap-3 p-4 bg-white/5 border-b border-white/10">
            <button
              onClick={() => window.history.back()}
              className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white"
            >
              ←
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold">
              {otherUserInfo.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="font-semibold text-white">{otherUserInfo.username || 'Loading...'}</div>
            </div>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading conversation...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0A0A14]">
      {/* Header with user info */}
      {otherUserInfo && (
        <div className="flex items-center gap-3 p-4 bg-white/5 border-b border-white/10 shrink-0">
          {/* Back button for mobile */}
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Go back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
          )}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold shrink-0">
            {otherUserInfo.username?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-white truncate">{otherUserInfo.username || 'Unknown User'}</div>
            {isOnline !== undefined && (
              <div className="text-xs flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className={isOnline ? 'text-green-400' : 'text-gray-500'}>{isOnline ? 'Online' : 'Offline'}</span>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex-grow overflow-auto">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">No messages yet</div>
        ) : (
          <div className="h-full overflow-auto">
            <Virtuoso
              ref={virtuosoRef}
              data={messages}
              initialTopMostItemIndex={messages.length - 1}
              followOutput="smooth"
              itemContent={(_index, msg) => {
                const isMe = msg.sender_id === user?.id
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-3 px-4`}>
                    <div 
                      className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                        isMe 
                          ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-br-md' 
                          : 'bg-white/10 text-gray-100 rounded-bl-md'
                      }`}
                    >
                      {!isMe && (
                        <div className="text-xs text-purple-300 mb-1 font-medium">
                          {msg.sender_username || 'Unknown'}
                        </div>
                      )}
                      <div className="text-sm break-words">{msg.content}</div>
                      <div className={`text-[10px] mt-1 ${isMe ? 'text-purple-200' : 'text-gray-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )
              }}
            />
          </div>
        )}
      </div>
      <MessageInput
        conversationId={actualConversationId}
        otherUserId={otherUserId}
        onMessageSent={() => {
          if (actualConversationId) {
            void markConversationRead(actualConversationId).catch(() => {})
          }
          // Notify parent to refresh sidebar
          if (onMessageSent) {
            onMessageSent()
          }
        }}
        onNewMessage={handleNewMessageOptimistic}
      />
    </div>
  )
}

export default ChatWindow
