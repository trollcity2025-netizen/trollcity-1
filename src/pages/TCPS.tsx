import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../lib/store'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { trollCityTheme } from '../styles/trollCityTheme'
import InboxSidebar from './tcps/components/InboxSidebar'
import ChatWindow from './tcps/components/ChatWindow'
import NewMessageModal from './tcps/components/NewMessageModal'
import CreateGroupChatModal from './tcps/components/CreateGroupChatModal'
import GroupChatInfoModal from './tcps/components/GroupChatInfoModal'
import IncomingCallPopup from '../components/IncomingCallPopup'
import { supabase } from '../lib/supabase'
import { usePresenceStore } from '../lib/presenceStore'
import { useQueryClient } from '@tanstack/react-query'
import { useConversations, useMessages, useSendMessage, useMarkAsRead, usePrefetchMessages } from '../hooks/useOptimizedChat'

const MOBILE_BREAKPOINT_PX = 768

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
  const { onlineUserIds } = usePresenceStore()
  const safeOnlineUserIds = onlineUserIds ?? []
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Use React Query for instant cached loading
  const { data: conversations } = useConversations()
  const prefetchMessages = usePrefetchMessages()

  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [activeConversationType, setActiveConversationType] = useState<'dm' | 'group'>('dm')
  const [activeGroupInfo, setActiveGroupInfo] = useState<{ conversationId: string; name: string } | null>(null)

  const [activeTab, setActiveTab] = useState<string>('inbox')
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)
  const [showNewMessageModal, setShowNewMessageModal] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false)

  const [otherUserInfo, setOtherUserInfo] = useState<{
    id: string
    username: string
    avatar_url: string | null
    created_at?: string
    is_online?: boolean
    rgb_username_expires_at?: string | null
    glowing_username_color?: string | null
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

    if (!param || param === 'null' || param === 'undefined') return

    // Basic UUID v4/v5 shape guard to avoid hammering the DB with invalid IDs
    const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param)
    if (!looksLikeUuid) return

    // Avoid double-fetching: URL param should only set selection.
    // The activeConversation effect will hydrate full profile details.
    setActiveConversation(param)
    setOtherUserInfo({
      id: param,
      username: '',
      avatar_url: null,
    })
  }, [searchParams])

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

    // Already hydrated for this conversation
    if (otherUserInfo?.id === activeConversation && otherUserInfo.username) return

    supabase
      .from('user_profiles')
      .select('id, username, avatar_url, created_at, rgb_username_expires_at, glowing_username_color')
      .eq('id', activeConversation)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error loading other user info', error)
          return
        }
        if (!data) return
        setOtherUserInfo({
          id: data.id,
          username: data.username,
          avatar_url: data.avatar_url,
          created_at: data.created_at,
          rgb_username_expires_at: data.rgb_username_expires_at,
          glowing_username_color: data.glowing_username_color
        })
      })
  }, [activeConversation, otherUserInfo?.id, otherUserInfo?.username])

  const handleSelectConversation = (otherId: string, isGroup?: boolean, conversationId?: string, groupName?: string) => {
    setActiveConversation(otherId)
    setActiveConversationType(isGroup ? 'group' : 'dm')
    if (isGroup && conversationId) {
      setActiveGroupInfo({ conversationId, name: groupName || 'Group Chat' })
    } else {
      setActiveGroupInfo(null)
    }
    setOtherUserInfo({
      id: otherId,
      username: '',
      avatar_url: null,
    })
    navigate(`/tcps?user=${otherId}`, { replace: true })
  }

  const handleNewMessage = (userId: string) => {
    setActiveConversation(userId)
    setActiveConversationType('dm')
    setActiveGroupInfo(null)
    setOtherUserInfo({
      id: userId,
      username: '',
      avatar_url: null,
    })
    navigate(`/tcps?user=${userId}`, { replace: true })
    setShowNewMessageModal(false)
  }

  const handleGroupCreated = (conversationId: string) => {
    // Refresh sidebar to show the new group
    setSidebarRefreshKey(prev => prev + 1)
    // Select the new group conversation
    setActiveConversation(conversationId)
    setActiveConversationType('group')
    setActiveGroupInfo({ conversationId, name: '' }) // Name will be loaded
    navigate(`/tcps?user=${conversationId}`, { replace: true })
    setShowCreateGroupModal(false)
  }

  const handleLeftGroup = () => {
    setActiveConversation(null)
    setActiveConversationType('dm')
    setActiveGroupInfo(null)
    setOtherUserInfo(null)
    navigate('/tcps', { replace: true })
    setSidebarRefreshKey(prev => prev + 1)
  }

  const handleConversationsLoaded = useCallback((conversations: SidebarConversation[]) => {
    // Use React Query cached conversations if available
    if (conversations && conversations.length > 0) {
      // Only auto-select first conversation if no user is specified in URL
      const userParam = searchParams.get('user')
      const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= MOBILE_BREAKPOINT_PX : true
      if (isDesktop && !activeConversation && !userParam) {
        const first = conversations[0]
        setActiveConversation(first.other_user_id)
        navigate(`/tcps?user=${first.other_user_id}`, { replace: true })
      }
    }
  }, [activeConversation, navigate, searchParams])

  const { backgrounds } = trollCityTheme
  
  // Convert onlineUserIds array to Record<string, boolean> for InboxSidebar
  const onlineUsersRecord = safeOnlineUserIds.reduce((acc, id) => ({ ...acc, [id]: true }), {})
  const isOtherOnline = otherUserInfo ? safeOnlineUserIds.includes(otherUserInfo.id) : false

  return (
    <div className={`w-full h-[calc(100dvh-var(--bottom-nav-height,64px)-env(safe-area-inset-bottom,0px))] overflow-hidden ${backgrounds.primary} flex justify-center items-stretch px-3 py-4 md:py-8`}>
        <div className={`relative flex w-full max-w-6xl ${trollCityTheme.backgrounds.card} rounded-2xl md:rounded-3xl border border-white/10 overflow-hidden flex-col md:flex-row h-full`}>
          {/* Column 1: Sidebar with Conversations */}
          <div className={`flex-col border-r border-white/5 ${trollCityTheme.backgrounds.glass} w-full md:w-80 lg:w-96 h-full ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
            <InboxSidebar
              activeConversation={activeConversation}
              onSelectConversation={handleSelectConversation}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onlineUsers={onlineUsersRecord}
              onConversationsLoaded={handleConversationsLoaded}
              onOpenNewMessage={() => setShowNewMessageModal(true)}
              onOpenCreateGroup={() => setShowCreateGroupModal(true)}
              refreshKey={sidebarRefreshKey}
            />
          </div>

          {/* Column 2: Chat Window */}
          <div className={`flex-1 flex-col min-w-0 bg-transparent h-full ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
            <ChatWindow
              conversationId={null}
              otherUserInfo={activeConversationType === 'group' ? null : otherUserInfo}
              isOnline={activeConversationType === 'group' ? undefined : isOtherOnline}
              isGroup={activeConversationType === 'group'}
              groupConversationId={activeGroupInfo?.conversationId || null}
              groupName={activeGroupInfo?.name || null}
              onBack={() => {
                setActiveConversation(null)
                setActiveConversationType('dm')
                setActiveGroupInfo(null)
                navigate('/tcps')
              }}
              onMessageSent={() => {
                // Refresh sidebar when message is sent
                setSidebarRefreshKey(prev => prev + 1)
              }}
              onOpenGroupInfo={() => setShowGroupInfoModal(true)}
            />
          </div>
        </div>

        <NewMessageModal
          isOpen={showNewMessageModal}
          onClose={() => setShowNewMessageModal(false)}
          onSelectUser={handleNewMessage}
        />

        <CreateGroupChatModal
          isOpen={showCreateGroupModal}
          onClose={() => setShowCreateGroupModal(false)}
          onGroupCreated={handleGroupCreated}
        />

        {showGroupInfoModal && activeGroupInfo && (
          <GroupChatInfoModal
            isOpen={showGroupInfoModal}
            onClose={() => setShowGroupInfoModal(false)}
            conversationId={activeGroupInfo.conversationId}
            groupName={activeGroupInfo.name || 'Group Chat'}
            onLeftGroup={handleLeftGroup}
          />
        )}

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
