import { useState, useEffect } from 'react'
import { useAuthStore } from '../lib/store'
import { useSearchParams, useNavigate } from 'react-router-dom'
import InboxSidebar from './tcps/components/InboxSidebar'
import ChatWindow from './tcps/components/ChatWindow'
import NewMessageModal from './tcps/components/NewMessageModal'
import IncomingCallPopup from '../components/IncomingCallPopup'
import { supabase } from '../lib/supabase'

interface SidebarConversation {
  other_user_id: string
  other_username: string
  other_avatar_url: string | null
  last_message: string
  last_timestamp: string
  unread_count: number
  is_online?: boolean
  rgb_username_expires_at?: string | null
}

export default function TCPS() {
  const { user } = useAuthStore()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [activeConversation, setActiveConversation] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<string>('inbox')
  const [showNewMessageModal, setShowNewMessageModal] = useState(false)

  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({})
  const [otherUserInfo, setOtherUserInfo] = useState<{
    id: string
    username: string
    avatar_url: string | null
    is_online?: boolean
  } | null>(null)
  
  // Incoming call state
  const [incomingCall, setIncomingCall] = useState<{
    callerId: string
    callerUsername: string
    callerAvatar: string | null
    callType: 'audio' | 'video'
    roomId: string
  } | null>(null)

  // Load conversation from URL
  useEffect(() => {
    const param = searchParams.get('user')

    if (!param) return

    // Here param is a UUID, not a username
    supabase
      .from('user_profiles')
      .select('id, username, avatar_url')
      .eq('id', param)
      .single()
      .then(({ data }) => {
        if (data) {
          setActiveConversation(data.id)
          setOtherUserInfo({
            id: data.id,
            username: data.username,
            avatar_url: data.avatar_url,
            is_online: onlineUsers[data.id] || false
          })
        }
      })
  }, [searchParams, onlineUsers])

  // Presence tracking
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase.channel('presence-channel', {
      config: { presence: { key: user.id } }
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const list: Record<string, boolean> = {}
        Object.keys(state).forEach((key) => (list[key] = true))
        setOnlineUsers(list)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online: true })
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id])

  // Listen for incoming calls
  useEffect(() => {
    if (!user?.id) return

    const callChannel = supabase
      .channel(`calls:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          const notification = payload.new as any
          if (notification.type === 'call' && notification.metadata) {
            const metadata = notification.metadata
            setIncomingCall({
              callerId: metadata.caller_id,
              callerUsername: metadata.caller_username || 'Unknown',
              callerAvatar: metadata.caller_avatar || null,
              callType: metadata.call_type || 'audio',
              roomId: metadata.room_id
            })
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(callChannel)
    }
  }, [user?.id])

  const handleAcceptCall = () => {
    if (!incomingCall) return
    navigate(`/call/${incomingCall.roomId}/${incomingCall.callType}/${incomingCall.callerId}`)
    setIncomingCall(null)
  }

  const handleDeclineCall = async () => {
    if (!incomingCall || !user?.id) return
    
    // Delete the notification
    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id)
      .eq('type', 'call')
      .contains('metadata', { room_id: incomingCall.roomId })
    // Log declined call with zero duration
    try {
      await supabase.from('call_history').insert({
        caller_id: incomingCall.callerId,
        receiver_id: user.id,
        room_id: incomingCall.roomId,
        type: incomingCall.callType,
        duration_minutes: 0,
        ended_at: new Date().toISOString()
      })
    } catch {
      // ignore logging errors
    }
    setIncomingCall(null)
  }

  // Load target user's info when conversation changes
  useEffect(() => {
    if (!activeConversation) return

    supabase
      .from('user_profiles')
      .select('id, username, avatar_url')
      .eq('id', activeConversation)
      .single()
      .then(({ data }) => {
        if (data) {
          setOtherUserInfo({
            id: data.id,
            username: data.username,
            avatar_url: data.avatar_url,
            is_online: onlineUsers[data.id] || false
          })
        }
      })
  }, [activeConversation, onlineUsers])

  const handleSelectConversation = (otherId: string) => {
    setActiveConversation(otherId)
    navigate(`/tcps?user=${otherId}`, { replace: true })
  }

  const handleNewMessage = (userId: string) => {
    setActiveConversation(userId)
    navigate(`/tcps?user=${userId}`, { replace: true })
    setShowNewMessageModal(false)
  }

  const handleConversationsLoaded = (conversations: SidebarConversation[]) => {
    if (!activeConversation && conversations.length > 0) {
      const first = conversations[0]
      setActiveConversation(first.other_user_id)
      navigate(`/tcps?user=${first.other_user_id}`, { replace: true })
    }
  }

  return (
    <div className="w-full min-h-[100dvh] bg-gradient-to-br from-[#0b0b12] via-[#0d0d1a] to-[#14061a] flex justify-center items-stretch px-3 py-4 md:py-8 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] md:pb-8">
      <div className="relative flex w-full max-w-6xl bg-[#0b0b12] rounded-2xl md:rounded-3xl border border-white/10 overflow-hidden flex-col md:flex-row">
        {/* Column 1: Sidebar with Conversations */}
        <div className={`flex-col border-r border-white/5 bg-[#0b0b12] w-full md:w-80 lg:w-96 ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
          <InboxSidebar
            activeConversation={activeConversation}
            onSelectConversation={handleSelectConversation}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onlineUsers={onlineUsers}
            onConversationsLoaded={handleConversationsLoaded}
            onOpenNewMessage={() => setShowNewMessageModal(true)}
          />
        </div>

        {/* Column 2: Chat Window */}
        <div className={`flex-1 flex-col min-w-0 bg-[#0d0d1a] ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
          <ChatWindow
            conversationId={null} // It will be derived from users or we can pass it if we have it
            otherUserInfo={otherUserInfo}
            isOnline={otherUserInfo?.is_online}
            onBack={() => {
              setActiveConversation(null)
              navigate('/tcps')
            }}
          />
        </div>
      </div>

      <NewMessageModal
        isOpen={showNewMessageModal}
        onClose={() => setShowNewMessageModal(false)}
        onSelectUser={handleNewMessage}
      />

      {incomingCall && (
        <IncomingCallPopup
          isOpen={!!incomingCall}
          callerId={incomingCall.callerId}
          callerUsername={incomingCall.callerUsername}
          callerAvatar={incomingCall.callerAvatar}
          callType={incomingCall.callType}
          roomId={incomingCall.roomId}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}
    </div>
  )
}
