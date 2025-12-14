import { useEffect, useRef, useState } from 'react'
import { MoreVertical, Phone, Video } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import ClickableUsername from '../../../components/ClickableUsername'
import { toast } from 'sonner'

interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
  seen: boolean
  read_at?: string | null
  sender_username?: string
  sender_avatar_url?: string
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
  const [loading, setLoading] = useState(true)
  const [theirTyping, setTheirTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
      setMessages([])
      return
    }

    loadMessages()

    // Real-time subscription for new messages - use broadcast for instant updates
    const channelName = `messages:${profile.id}:${otherUserId}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: profile.id }
      }
    })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `message_type=eq.dm`
        },
        async (payload) => {
          console.log('📨 New message received via real-time:', payload.new);
          const newMsg = payload.new as any;
          // Only add if it's a new message in this conversation
          if (
            (newMsg.sender_id === otherUserId && newMsg.receiver_id === profile.id) ||
            (newMsg.sender_id === profile.id && newMsg.receiver_id === otherUserId)
          ) {
            // Fetch sender info immediately
            let senderUsername = 'Unknown';
            let senderAvatar = null;
            
            try {
              const { data: senderData } = await supabase
                .from('user_profiles')
                .select('id, username, avatar_url')
                .eq('id', newMsg.sender_id)
                .single();
              
              if (senderData) {
                senderUsername = senderData.username;
                senderAvatar = senderData.avatar_url;
              }
            } catch (err) {
              console.error('Error fetching sender info:', err);
            }
            
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === newMsg.id)) {
                console.log('⚠️ Duplicate message ignored:', newMsg.id);
                return prev
              }
              console.log('✅ Adding new message to UI:', newMsg.id);
              return [...prev, {
                ...newMsg,
                sender_username: senderUsername,
                sender_avatar_url: senderAvatar
              } as Message]
            })
            
            // Scroll to bottom when new message arrives
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `message_type=eq.dm`
        },
        (payload) => {
          const updatedMsg = payload.new as any;
          // Update read status if this message was marked as read
          if (
            (updatedMsg.sender_id === otherUserId && updatedMsg.receiver_id === profile.id) ||
            (updatedMsg.sender_id === profile.id && updatedMsg.receiver_id === otherUserId)
          ) {
            setMessages((prev) =>
              prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
            )
          }
        }
      )
      .on('broadcast', { event: 'new_message' }, (payload) => {
        console.log('📨 New message received via broadcast:', payload.payload);
        const newMsg = payload.payload as any;
        // Only add if it's a new message in this conversation
        if (
          (newMsg.sender_id === otherUserId && newMsg.receiver_id === profile.id) ||
          (newMsg.sender_id === profile.id && newMsg.receiver_id === otherUserId)
        ) {
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) {
              return prev
            }
            console.log('✅ Adding broadcast message to UI:', newMsg.id);
            return [...prev, newMsg as Message]
          })
          
          // Scroll to bottom
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      })
      .subscribe((status) => {
        console.log(`📡 Messages channel status: ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to messages channel');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel subscription error - will retry');
          // Retry subscription after a delay
          setTimeout(() => {
            channel.subscribe();
          }, 2000);
        } else if (status === 'TIMED_OUT') {
          console.warn('⏱️ Channel subscription timed out - retrying');
          setTimeout(() => {
            channel.subscribe();
          }, 2000);
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [otherUserId, profile?.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadMessages = async () => {
    if (!otherUserId || !profile?.id) return

    try {
      setLoading(true)

      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, created_at, seen, read_at, message_type')
        .or(
          `and(sender_id.eq.${profile.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${profile.id})`
        )
        .eq('message_type', 'dm')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error loading messages:', error);
        throw error;
      }

      // Mark messages as read when ChatWindow opens
      const unreadIds = messagesData
        ?.filter(m => m.receiver_id === profile.id && !m.read_at)
        .map(m => m.id) || []

      if (unreadIds.length > 0) {
        try {
          await supabase
            .from('messages')
            .update({ read_at: new Date().toISOString(), seen: true })
            .in('id', unreadIds)
        } catch (err) {
          console.warn('Could not update read status:', err)
        }
      }

      // Fetch sender usernames
      const senderIds = [...new Set(messagesData?.map(m => m.sender_id).filter(Boolean) || [])]
      const senderMap: Record<string, { username: string; avatar_url: string | null }> = {}

      if (senderIds.length > 0) {
        const { data: usersData } = await supabase
          .from('user_profiles')
          .select('id,username,avatar_url')
          .in('id', senderIds)

        usersData?.forEach((user) => {
          senderMap[user.id] = {
            username: user.username,
            avatar_url: user.avatar_url
          }
        })
      }

      const mappedMessages = messagesData?.map((msg) => ({
        ...msg,
        sender_username: senderMap[msg.sender_id]?.username || 'Unknown',
        sender_avatar_url: senderMap[msg.sender_id]?.avatar_url || null
      })) || []

      setMessages(mappedMessages)
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                      <span className="text-xs text-gray-400">@{msg.sender_username}</span>
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
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

