import { useState, useEffect } from 'react'
import { useAuthStore } from '../lib/store'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { MessageSquarePlus } from 'lucide-react'
import InboxSidebar from './messages/components/InboxSidebar'
import ChatWindow from './messages/components/ChatWindow'
import MessageInput from './messages/components/MessageInput'
import NewMessageModal from './messages/components/NewMessageModal'
import IncomingCallPopup from '../components/IncomingCallPopup'
import { supabase } from '../lib/supabase'

export default function Messages() {
  const { profile, user } = useAuthStore()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [activeConversation, setActiveConversation] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState('inbox')
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
    navigate(`/messages?user=${otherId}`, { replace: true })
  }

  const handleNewMessage = (userId: string) => {
    setActiveConversation(userId)
    navigate(`/messages?user=${userId}`, { replace: true })
    setShowNewMessageModal(false)
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#04000d] flex items-center justify-center">
        <p className="text-gray-400">Please log in to view messages</p>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-[#04000d] overflow-hidden">

      {/* Sidebar */}
      <InboxSidebar
        activeConversation={activeConversation}
        onSelectConversation={handleSelectConversation}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onlineUsers={onlineUsers}
      />

      {/* Chat */}
      <div className="flex-1 flex flex-col">

        {activeConversation ? (
          <>
            <ChatWindow
              otherUserId={activeConversation}
              otherUserUsername={otherUserInfo?.username}
              otherUserAvatar={otherUserInfo?.avatar_url}
              isOnline={otherUserInfo?.is_online}
            />

            <MessageInput
              otherUserId={activeConversation}
              onMessageSent={() => {}}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-500">
            Select a conversation to start messaging
          </div>
        )}

      </div>

      {/* New Message - Only show when no active conversation */}
      {!activeConversation && (
        <button
          type="button"
          onClick={() => setShowNewMessageModal(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-[#9b32ff] to-[#00ffcc] rounded-full text-black flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-50"
        >
          <MessageSquarePlus className="w-6 h-6" />
        </button>
      )}

      <NewMessageModal
        isOpen={showNewMessageModal}
        onClose={() => setShowNewMessageModal(false)}
        onSelectUser={handleNewMessage}
      />

      {/* Incoming Call Popup */}
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
