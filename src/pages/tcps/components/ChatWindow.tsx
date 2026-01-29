import { useEffect, useRef, useState, useCallback } from 'react'
import { MoreVertical, Phone, Video, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase, createConversation, getConversationMessages, markConversationRead } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import ClickableUsername from '../../../components/ClickableUsername'
import { toast } from 'sonner'
import MessageInput from './MessageInput'

interface ChatWindowProps {
  conversationId: string | null
  otherUserInfo: {
    id: string
    username: string
    avatar_url: string | null
    is_online?: boolean
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
  sender_username?: string
  sender_avatar_url?: string | null
  sender_rgb_expires_at?: string | null
}

export default function ChatWindow({ conversationId, otherUserInfo, isOnline, onBack }: ChatWindowProps) {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [oldestLoadedAt, setOldestLoadedAt] = useState<string | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [actualConversationId, setActualConversationId] = useState<string | null>(conversationId)

  // Initialize or fetch conversation
  useEffect(() => {
    const initChat = async () => {
      if (!user?.id || !otherUserInfo?.id) return

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
             // Create new conversation
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

      setActualConversationId(targetConvId)
    }

    initChat()
  }, [conversationId, otherUserInfo?.id, user?.id])

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [])

  // Load messages
  useEffect(() => {
    if (!actualConversationId || !profile?.id) return

    const loadMessages = async () => {
      setLoading(true)
      try {
        const messagesData = await getConversationMessages(actualConversationId, { limit: 50 })
        
        // Enhance with sender info
        const senderIds = [...new Set(messagesData.map(m => m.sender_id))]
        const senderMap: Record<string, any> = {}
        
        if (senderIds.length > 0) {
          const { data: usersData } = await supabase
            .from('user_profiles')
            .select('id,username,avatar_url,rgb_username_expires_at')
            .in('id', senderIds)
          
          usersData?.forEach(u => {
            senderMap[u.id] = u
          })
        }

        const mappedMessages = messagesData.map(m => ({
          id: m.id,
          conversation_id: m.conversation_id,
          sender_id: m.sender_id,
          content: m.body,
          created_at: m.created_at,
          sender_username: senderMap[m.sender_id]?.username,
          sender_avatar_url: senderMap[m.sender_id]?.avatar_url,
          sender_rgb_expires_at: senderMap[m.sender_id]?.rgb_username_expires_at
        })).reverse() // Show newest at bottom

        setMessages(mappedMessages)
        setOldestLoadedAt(mappedMessages[0]?.created_at || null)
        setHasMore(messagesData.length === 50)
        
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

    // Subscribe to new messages
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
          let senderInfo = {
             username: 'Unknown',
             avatar_url: null,
             rgb_username_expires_at: null
          }
          
          if (newMsgRaw.sender_id === user?.id) {
             senderInfo = {
               username: profile?.username || 'You',
               avatar_url: profile?.avatar_url || null,
               rgb_username_expires_at: profile?.rgb_username_expires_at || null
             }
          } else {
             const { data } = await supabase.from('user_profiles').select('username,avatar_url,rgb_username_expires_at').eq('id', newMsgRaw.sender_id).single()
             if (data) senderInfo = data as any
          }

          const newMsg: Message = {
            id: newMsgRaw.id,
            conversation_id: newMsgRaw.conversation_id,
            sender_id: newMsgRaw.sender_id,
            content: newMsgRaw.body,
            created_at: newMsgRaw.created_at,
            sender_username: senderInfo.username,
            sender_avatar_url: senderInfo.avatar_url,
            sender_rgb_expires_at: senderInfo.rgb_username_expires_at
          }

          setMessages(prev => [...prev, newMsg])
          if (newMsg.sender_id !== user?.id) {
            await markConversationRead(actualConversationId)
          }
          if (isAtBottom) {
            setTimeout(scrollToBottom, 100)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [actualConversationId, profile?.id, scrollToBottom, user?.id, isAtBottom])

  const handleScroll = () => {
    if (!messagesContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 100)
    
    // Load more logic could go here if scrollTop is 0
  }

  if (!otherUserInfo) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0A0A14] text-gray-500">
        Select a conversation to start chatting
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0A0A14]">
      {/* Header */}
      <div className="h-16 border-b border-purple-500/20 flex items-center justify-between px-4 bg-[#14141F]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden text-gray-400 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="relative">
            <img 
              src={otherUserInfo.avatar_url || `https://ui-avatars.com/api/?name=${otherUserInfo.username}&background=random`}
              alt={otherUserInfo.username}
              className="w-10 h-10 rounded-full border border-purple-500/30"
            />
            {isOnline && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#14141F]" />
            )}
          </div>
          
          <div>
            <h3 className="font-bold text-white leading-none">
              {otherUserInfo.username}
            </h3>
            <span className="text-xs text-gray-400">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors">
            <Phone className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors">
            <Video className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-purple-900/50 scrollbar-track-transparent"
        ref={messagesContainerRef}
        onScroll={handleScroll}
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
                       className="w-8 h-8 rounded-full border border-purple-500/20"
                       alt={msg.sender_username}
                     />
                   ) : <div className="w-8" />}
                </div>
              )}
              
              <div className={`max-w-[70%] space-y-1 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                {!isMe && showAvatar && (
                   <span className="text-xs text-gray-400 ml-1">{msg.sender_username}</span>
                )}
                <div 
                  className={`px-4 py-2 rounded-2xl break-words ${
                    isMe 
                      ? 'bg-purple-600 text-white rounded-tr-none' 
                      : 'bg-[#1F1F2E] text-gray-200 rounded-tl-none border border-purple-500/10'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-500 px-1">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )
        })}
        <div className="h-1" /> {/* Spacer */}
      </div>

      {/* Input */}
      <MessageInput 
        conversationId={actualConversationId} 
        otherUserId={otherUserInfo.id}
        onMessageSent={scrollToBottom}
      />
    </div>
  )
}
