import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, createConversation, getConversationMessages, markConversationRead, OFFICER_GROUP_CONVERSATION_ID } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import MessageInput from './MessageInput'

const MAX_MESSAGES = 100

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
}

const ChatWindow = ({ otherUserInfo }: ChatWindowProps) => {
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
          const { data: shared, error: sharedError } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .in('conversation_id', myConvIds)
            .eq('user_id', otherUserId)
            .limit(1)

          if (sharedError) throw sharedError
          const sharedFirst = Array.isArray(shared) ? shared[0] : null
          if (sharedFirst) targetConvId = sharedFirst.conversation_id
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
    return <div className="flex-1 flex items-center justify-center text-gray-500">Select a conversation</div>
  }

  if (!actualConversationId) {
    return <div className="flex-1 flex items-center justify-center text-gray-500">Loading conversation...</div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with user info */}
      {otherUserInfo && (
        <div className="flex items-center gap-3 p-4 bg-white/5 border-b border-white/10">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold">
            {otherUserInfo.username?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <div className="font-semibold text-white">{otherUserInfo.username || 'Unknown User'}</div>
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
              itemContent={(_index, msg) => (
                <div key={msg.id} className="p-4 border-b border-white/5">
                  <strong>{msg.sender_username || 'Unknown'}: </strong>
                  <span className="text-gray-300">{msg.content}</span>
                </div>
              )}
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
        }}
        onNewMessage={handleNewMessageOptimistic}
      />
    </div>
  )
}

export default ChatWindow
