import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  Radio, Users, Eye, Gift, Send, Skull, ShieldOff, Crown, Star,
  MessageSquare
} from 'lucide-react'
import { supabase, Stream, UserProfile } from '../lib/supabase'
import api from '../lib/api'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import ClickableUsername from '../components/ClickableUsername'
import TrollEvent from '../components/TrollEvent'
import TrollRain from '../components/stream/TrollRain'
import GiftPanel from '../components/stream/GiftPanel'
import VideoFeed from '../components/stream/VideoFeed'
import ControlBar from '../components/stream/ControlBar'
import TopBar from '../components/stream/TopBar'
import ChatInput from '../components/stream/ChatInput'
import ChatOverlay from '../components/stream/ChatOverlay'
import GiftBlast from '../components/stream/GiftBlast'
import GiftParticles from '../components/stream/GiftParticles'
import TrollSurprise from '../components/stream/TrollSurprise'
import GuestGrid from '../components/stream/GuestGrid'
import { LayoutSwitcher } from '../components/stream/ControlBar'
import { useRoom } from '../hooks/useRoom'

const StreamRoom = () => {
  const { streamId } = useParams<{ streamId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuthStore()

  const roomNameFromState = location.state?.roomName
  const livekitUrlFromState = location.state?.serverUrl
  const livekitTokenFromState = location.state?.token
  const isHost = location.state?.isHost || false

  const remoteVideoRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const client = useRef<any>(null)

  const [stream, setStream] = useState<Stream | null>(null)
  const [broadcaster, setBroadcaster] = useState<UserProfile | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [joining, setJoining] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isEndingStream, setIsEndingStream] = useState(false)
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [giftTarget, setGiftTarget] = useState<string | null>(null)
  const [livekitUrlForFeed, setLivekitUrlForFeed] = useState<string | null>(null)
  const [livekitTokenForFeed, setLivekitTokenForFeed] = useState<string | null>(null)
  const [isCameraEnabled, setIsCameraEnabled] = useState(true)
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true)
  const [giftTrigger, setGiftTrigger] = useState<{ timestamp: number; amount: number } | null>(null)
  const [layoutMode, setLayoutMode] = useState<'spotlight' | 'grid' | 'talkshow' | 'stacked'>('grid')

  /** ────────────────────────────────────────────────
   🔄 Convert HTTP URL to WebSocket URL
  ───────────────────────────────────────────────────*/
  const convertToWebSocketUrl = (url: string): string => {
    if (!url) return url
    // If already a WebSocket URL, return as is
    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      return url
    }
    // Convert HTTP/HTTPS to WebSocket
    if (url.startsWith('http://')) {
      return url.replace('http://', 'ws://')
    }
    if (url.startsWith('https://')) {
      return url.replace('https://', 'wss://')
    }
    // If no protocol, assume HTTPS and convert to WSS
    return `wss://${url}`
  }

  /** ────────────────────────────────────────────────
   📡 Initialize LiveKit - Handles BOTH host & viewer
  ───────────────────────────────────────────────────*/
  const initializeLiveKit = async () => {
    if (!user) {
      console.warn('User not authenticated')
      return
    }

    let livekitUrl = livekitUrlFromState
    let livekitToken = livekitTokenFromState
    let roomName = roomNameFromState

    // Ensure token is a string, not an object
    if (livekitToken) {
      if (typeof livekitToken !== 'string') {
        console.warn('Token from state is not a string, extracting:', { type: typeof livekitToken, value: livekitToken })
        // Try to extract from nested object
        if (typeof livekitToken === 'object' && livekitToken !== null) {
          livekitToken = livekitToken.token || livekitToken.value || String(livekitToken)
        } else {
          livekitToken = String(livekitToken)
        }
      }
      // Validate it's not an empty string or invalid
      if (livekitToken === 'undefined' || livekitToken === 'null' || livekitToken === '[object Object]' || livekitToken.trim().length === 0) {
        console.warn('Token from state is invalid, will fetch new one:', livekitToken)
        livekitToken = null // Force fetching a new token
      }
    }

    // If credentials are missing (e.g., page refresh), fetch them
    if (!livekitUrl || !livekitToken) {
      try {
        // Always use streamId as room name for consistency
        // This matches what GoLive.tsx uses when creating the stream
        const roomNameForToken = streamId || roomName || 'default-room'
        
        console.log('Fetching LiveKit token for room:', roomNameForToken)
        
        const tokenResp = await api.post('/livekit-token', {
          room: roomNameForToken,
          identity: user.email || user.id,
          isHost: isHost,
        })

        // Check if the API call failed
        if (!tokenResp) {
          throw new Error('No response from LiveKit token API')
        }

        // Check for API errors (error property takes precedence)
        if (tokenResp.error) {
          console.error('API returned error:', tokenResp.error)
          throw new Error(tokenResp.error)
        }

        // Check if success flag explicitly indicates failure
        // Note: success might be undefined, which is OK if there's no error
        if (tokenResp.success === false) {
          throw new Error(tokenResp.error || 'Token API returned failure status')
        }

        // Log the full response for debugging
        console.log('🔍 Token response structure:', {
          success: tokenResp?.success,
          hasToken: !!tokenResp?.token,
          tokenType: typeof tokenResp?.token,
          tokenValue: tokenResp?.token,
          tokenPreview: tokenResp?.token && typeof tokenResp?.token === 'string' 
            ? tokenResp.token.substring(0, 50) + '...' 
            : (tokenResp?.token ? JSON.stringify(tokenResp.token).substring(0, 100) : 'missing'),
          hasLivekitUrl: !!tokenResp?.livekitUrl,
          hasServerUrl: !!tokenResp?.serverUrl,
          allKeys: Object.keys(tokenResp || {}),
          fullResponse: JSON.stringify(tokenResp, null, 2)
        })
        
        // Extract URL first
        livekitUrl = tokenResp?.livekitUrl || tokenResp?.serverUrl || tokenResp?.url
        
        // Extract token - simplified since we know the new function returns it directly
        let extractedToken: string | null = null
        
        // Method 1: Direct token property (should work with new manual JWT function)
        if (tokenResp?.token) {
          if (typeof tokenResp.token === 'string') {
            const trimmed = tokenResp.token.trim()
            if (trimmed.length > 0 && trimmed !== 'undefined' && trimmed !== 'null' && trimmed !== '[object Object]') {
              extractedToken = trimmed
              console.log('✅ Token found in tokenResp.token (direct)')
            }
          } else if (typeof tokenResp.token === 'object' && tokenResp.token !== null) {
            // If it's still an object (shouldn't happen with new function, but handle it)
            console.warn('⚠️ Token is an object, attempting extraction:', tokenResp.token)
            const objToken = tokenResp.token as any
            if (objToken.token && typeof objToken.token === 'string') {
              extractedToken = objToken.token.trim()
              console.log('✅ Token extracted from nested object')
            } else if (objToken.value && typeof objToken.value === 'string') {
              extractedToken = objToken.value.trim()
              console.log('✅ Token extracted from value property')
            }
          }
        }
        
        // Method 2: Check data.token (if response is wrapped)
        if (!extractedToken && tokenResp?.data?.token) {
          if (typeof tokenResp.data.token === 'string') {
            const trimmed = tokenResp.data.token.trim()
            if (trimmed.length > 0) {
              extractedToken = trimmed
              console.log('✅ Token found in tokenResp.data.token')
            }
          }
        }

        // Method 3: Last resort - scan all string properties for JWT-like values
        if (!extractedToken) {
          const allKeys = Object.keys(tokenResp || {})
          console.log('🔍 Scanning all keys for JWT-like values:', allKeys)
          for (const key of allKeys) {
            const value = (tokenResp as any)[key]
            if (typeof value === 'string' && value.length > 50) {
              // Check if it looks like a JWT (has at least 2 dots)
              const dotCount = (value.match(/\./g) || []).length
              if (dotCount >= 2) {
                extractedToken = value.trim()
                console.log(`✅ Found JWT-like token in key: ${key} (${dotCount} dots, ${value.length} chars)`)
                break
              }
            }
          }
        }

        // Validate extracted token
        if (!extractedToken) {
          console.error('❌ Token extraction failed - no valid token found')
          console.error('📋 Full response:', JSON.stringify(tokenResp, null, 2))
          console.error('🔑 Available keys:', Object.keys(tokenResp || {}))
          throw new Error('Failed to extract valid token from response. Check console for details.')
        }
        
        if (extractedToken === 'undefined' || extractedToken === 'null' || extractedToken === '[object Object]') {
          console.error('❌ Token has invalid value:', extractedToken)
          throw new Error('Token has invalid value. Check console for details.')
        }
        
        if (extractedToken.trim().length === 0) {
          console.error('❌ Token is empty string')
          throw new Error('Token is empty. Check console for details.')
        }
        
        // Validate it looks like a JWT
        const dotCount = (extractedToken.match(/\./g) || []).length
        if (dotCount < 2) {
          console.error('❌ Token does not look like a JWT (expected 2+ dots, found', dotCount, ')')
          console.error('Token preview:', extractedToken.substring(0, 100))
          throw new Error('Token does not appear to be a valid JWT format.')
        }
        
        console.log('✅ Token extracted successfully:', {
          length: extractedToken.length,
          dots: dotCount,
          preview: extractedToken.substring(0, 30) + '...'
        })

        livekitToken = extractedToken

        if (!livekitUrl || !livekitToken) {
          console.error('Token response missing data:', { livekitUrl, hasToken: !!livekitToken, tokenResp })
          throw new Error('Failed to get LiveKit credentials - missing URL or token')
        }

        // Final validation - ensure token is a non-empty string
        if (typeof livekitToken !== 'string' || livekitToken.trim().length === 0) {
          console.error('Token validation failed:', { type: typeof livekitToken, length: livekitToken?.length, preview: String(livekitToken).substring(0, 50) })
          throw new Error('Invalid token format - token must be a non-empty string')
        }
        
        console.log('Token extracted successfully:', { length: livekitToken.length, preview: livekitToken.substring(0, 30) + '...' })
      } catch (err: any) {
        console.error('Failed to fetch LiveKit token:', err)
        toast.error(err.message || 'Failed to get LiveKit credentials')
        return
      }
    }

    // Final validation - ensure token is a string before connecting
    if (typeof livekitToken !== 'string' || livekitToken.trim().length === 0) {
      console.error('Token validation failed:', { 
        type: typeof livekitToken, 
        value: livekitToken,
        length: livekitToken?.length,
        isEmpty: livekitToken?.trim().length === 0
      })
      toast.error('Invalid token format - please try again')
      return
    }
    
    // Additional check for common invalid values
    if (livekitToken === 'undefined' || livekitToken === 'null' || livekitToken === '[object Object]') {
      console.error('Token contains invalid value:', livekitToken)
      toast.error('Invalid token - please refresh and try again')
      return
    }

    // Convert URL to WebSocket format if needed
    const wsUrl = convertToWebSocketUrl(livekitUrl)
    console.log('Connecting to LiveKit:', { wsUrl, roomName, isHost })

    try {
      const { Room, RoomEvent, createLocalVideoTrack, createLocalAudioTrack } = await import('livekit-client')

      // 1. Create Room client
      client.current = new Room({
        adaptiveStream: true,
        dynacast: true,
      })

      // 2. Set track subscription handlers BEFORE connecting
      client.current.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
        if (track.kind === 'video') {
          if (participant.isLocal) {
            // Local preview
            const videoElem = videoRef.current
            if (videoElem) {
              track.attach(videoElem)
              videoElem.muted = true
              videoElem.play()
            }
          } else {
            // Remote viewers
            const el = track.attach()
            if (remoteVideoRef.current) {
              remoteVideoRef.current.innerHTML = ''
              remoteVideoRef.current.appendChild(el)
            }
          }
        } else if (track.kind === 'audio') {
          track.attach()
        }
      })

      client.current.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach()
      })

      client.current.on(RoomEvent.Disconnected, () => {
        console.log('LiveKit disconnected')
      })

      client.current.on(RoomEvent.Connected, () => {
        console.log('LiveKit connected successfully')
        // Update camera/mic state
        if (client.current?.localParticipant) {
          setIsCameraEnabled(client.current.localParticipant.isCameraEnabled)
          setIsMicrophoneEnabled(client.current.localParticipant.isMicrophoneEnabled)
        }
      })

      // 3. Connect viewer or host
      // Final check - ensure token is definitely a string at this point
      if (!livekitToken) {
        console.error('Token is null/undefined at connection time')
        throw new Error('Token is missing - please try refreshing the page')
      }
      
      // Convert to string and validate
      let tokenString: string
      if (typeof livekitToken === 'string') {
        tokenString = livekitToken.trim()
      } else if (typeof livekitToken === 'object' && livekitToken !== null) {
        // Try to extract from object
        tokenString = (livekitToken as any).token || (livekitToken as any).value || JSON.stringify(livekitToken)
        tokenString = String(tokenString).trim()
      } else {
        tokenString = String(livekitToken).trim()
      }
      
      // Validate the token string
      if (!tokenString || 
          tokenString.length === 0 || 
          tokenString === 'undefined' || 
          tokenString === 'null' || 
          tokenString === '[object Object]' ||
          tokenString.startsWith('{') || // JSON object stringified
          tokenString.startsWith('[')) { // Array stringified
        console.error('Invalid token string:', { 
          original: livekitToken, 
          converted: tokenString,
          type: typeof livekitToken,
          length: tokenString.length
        })
        throw new Error('Invalid token format - token must be a valid JWT string')
      }

      console.log('Attempting to connect with:', { 
        url: wsUrl, 
        hasToken: !!tokenString, 
        tokenLength: tokenString.length,
        tokenPreview: tokenString.substring(0, 20) + '...',
        roomName: roomName || streamId,
        isHost 
      })
      
      await client.current.connect(wsUrl, tokenString)

      // 4. If host, publish local mic/camera tracks
      if (isHost) {
        try {
          const videoTrack = await createLocalVideoTrack()
          const audioTrack = await createLocalAudioTrack()

          await client.current.localParticipant.publishTrack(videoTrack)
          await client.current.localParticipant.publishTrack(audioTrack)

          // 🟢 Attach local video to preview screen
          const videoElem = videoRef.current
          if (videoElem) {
            videoTrack.attach(videoElem)
            videoElem.muted = true
            videoElem.play()
          }

          console.log('Published local tracks as host')
        } catch (trackErr: any) {
          console.error('Failed to publish tracks:', trackErr)
          // Don't fail the connection if track publishing fails
        }
      }

      console.log('LiveKit connected', isHost ? 'as Host' : 'as Viewer')
      
      // Store credentials for VideoFeed component
      setLivekitUrlForFeed(wsUrl)
      setLivekitTokenForFeed(tokenString)
      
      toast.success('Connected to stream')
    } catch (err: any) {
      console.error('LiveKit init failed:', err)
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack,
        wsUrl,
        hasToken: !!livekitToken,
        roomName: roomName || streamId
      })
      toast.error(err.message || 'Failed to connect to LiveKit')
    }
  }

  /** ────────────────────────────────────────────────
   🌐 Load Stream Data
  ───────────────────────────────────────────────────*/
  useEffect(() => {
    loadStreamData()
  }, [streamId])

  const loadStreamData = async () => {
    try {
      const { data: s } = await supabase
        .from('streams')
        .select('*')
        .eq('id', streamId)
        .single()

      if (!s) {
        toast.error('Stream not found')
        return navigate('/')
      }

      setStream(s)

      const { data: bc } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', s.broadcaster_id)
        .single()

      setBroadcaster(bc || null)

      // Load messages with user profiles
      const { data: msgs } = await supabase
        .from('messages')
        .select(`
          *,
          user_profiles:user_id ( username, avatar_url )
        `)
        .eq('stream_id', streamId)
        .order('created_at', { ascending: true })

      setMessages(msgs || [])
      setLoading(false)
    } catch {
      toast.error('Failed to load stream')
      setLoading(false)
    }
  }

  /** ────────────────────────────────────────────────
   🚪 Join LiveKit when stream & user ready
  ───────────────────────────────────────────────────*/
  useEffect(() => {
    if (stream && user && !loading) {
      joinStream()
      initializeLiveKit()
    }

    return () => {
      try { 
        if (client.current) {
          client.current.disconnect()
          client.current = null
        }
      } catch (err) {
        console.error('Error disconnecting LiveKit:', err)
      }
    }
  }, [stream, user, loading])

  /** ────────────────────────────────────────────────
   💬 Subscribe to chat messages
  ───────────────────────────────────────────────────*/
  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`chat_${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `stream_id=eq.${streamId}`,
        },
        async (payload) => {
          // Fetch the new message with user profile
          const { data: newMsg } = await supabase
            .from('messages')
            .select(`
              *,
              user_profiles:user_id ( username, avatar_url )
            `)
            .eq('id', payload.new.id)
            .single()
          
          if (newMsg) {
            setMessages((prev) => [...prev, newMsg])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId])

  const joinStream = async () => {
    try {
      setJoining(true)
      await supabase
        .from('streams')
        .update({ current_viewers: (stream?.current_viewers || 0) + 1 })
        .eq('id', streamId)
    } catch {}
    finally {
      setJoining(false)
    }
  }

  /** ────────────────────────────────────────────────
   🛑 End Stream (Broadcaster)
  ───────────────────────────────────────────────────*/
  const endStreamAsBroadcaster = async () => {
    if (!stream || profile?.id !== stream.broadcaster_id) return

    try {
      setIsEndingStream(true)
      await supabase
        .from('streams')
        .update({
          is_live: false,
          status: 'ended',
          end_time: new Date().toISOString()
        })
        .eq('id', stream.id)

      toast.success('Stream ended')
      navigate('/stream-ended')
    } catch {
      toast.error('Failed to end stream')
    } finally {
      setIsEndingStream(false)
    }
  }

  /** ────────────────────────────────────────────────
   🎁 Send Gift to Participant or Viewer
  ───────────────────────────────────────────────────*/
  const sendGift = async (targetUserId: string, giftType: string) => {
    try {
      await api.post('/send-gift', {
        streamId,
        senderId: user?.id,
        receiverId: targetUserId,
        giftType,
      })

      // Broadcast event to all participants via LiveKit DataTracks
      client.current?.localParticipant?.publishData(
        JSON.stringify({
          type: 'GIFT',
          senderId: user?.id,
          receiverId: targetUserId,
          giftType,
        }),
        { reliable: true }
      )

      toast.success(`Gift sent to ${targetUserId}`)
      setShowGiftModal(false)
      setGiftTarget(null)
    } catch (err) {
      console.error('Failed to send gift:', err)
      toast.error('Gift sending failed')
    }
  }

  /** ────────────────────────────────────────────────
   📸 UI Rendering
  ───────────────────────────────────────────────────*/
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading stream...
      </div>
    )
  }

  if (!stream || !broadcaster) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400">
        Stream not found
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto p-4">

        {/* Video Streaming Area */}
        <div className="bg-gray-900 rounded-xl overflow-hidden border border-purple-500 shadow-lg">
          <div className="relative aspect-video">
            {/* TopBar with Stream Stats */}
            <TopBar room={client.current} streamerId={stream?.broadcaster_id || null} />

            {/* Guest Grid - Shows Host + Guests */}
            <GuestGrid room={client.current} layoutMode={layoutMode} />

            {/* Layout Switcher - Only for Host */}
            {isHost && (
              <div className="absolute top-4 right-4 z-30">
                <LayoutSwitcher layoutMode={layoutMode} onLayoutChange={setLayoutMode} />
              </div>
            )}

            {/* VideoFeed Component - Only show when using grid layout and no room yet */}
            {livekitUrlForFeed && livekitTokenForFeed && layoutMode === 'grid' && !client.current && (
              <VideoFeed
                livekitUrl={livekitUrlForFeed}
                token={livekitTokenForFeed}
                isHost={isHost}
                onRoomReady={(room) => {
                  // Store room reference if needed
                  client.current = room
                }}
              />
            )}

            {/* Fallback: Local video preview (for host) - Only when no room and grid mode */}
            {isHost && !livekitUrlForFeed && layoutMode === 'grid' && !client.current && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full rounded-xl object-cover"
              ></video>
            )}
            
            {/* Fallback: Remote video (for viewers) - Only when no room and grid mode */}
            {!isHost && !livekitUrlForFeed && layoutMode === 'grid' && !client.current && (
              <div className="relative w-full h-full">
                <div ref={remoteVideoRef} className="w-full h-full bg-black"></div>
                
                {/* Gift button for co-hosts */}
                {stream?.broadcaster_id && (
                  <button
                    className="absolute top-2 right-2 bg-black/50 p-2 rounded-full hover:bg-black/70 z-10"
                    onClick={() => {
                      setGiftTarget(stream.broadcaster_id)
                      setShowGiftModal(true)
                    }}
                  >
                    <Gift size={20} className="text-yellow-400" />
                  </button>
                )}
              </div>
            )}

            {/* Floating Emoji Reactions */}
            <TrollRain />

            {/* Gift Alert Panel */}
            <GiftPanel streamId={streamId} />

            {/* Gift Blast - Large Gift Notification */}
            <GiftBlast
              streamId={streamId}
              onGiftTrigger={(amount) => setGiftTrigger({ timestamp: Date.now(), amount })}
            />

            {/* Gift Particles - Floating Emoji Animation */}
            <GiftParticles trigger={giftTrigger} />

            {/* Chat Overlay - Floating Messages */}
            <ChatOverlay streamId={streamId} />

            {/* Chat Input - Bottom Left */}
            <ChatInput streamId={streamId} />

            {/* Troll Surprise - Random Troll Walking Across Screen */}
            <TrollSurprise streamId={streamId} />

            {/* Control Bar for Host */}
            {isHost && client.current && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
                <ControlBar
                  room={client.current}
                  isCameraEnabled={isCameraEnabled}
                  isMicrophoneEnabled={isMicrophoneEnabled}
                  streamId={streamId}
                  isHost={isHost}
                  layoutMode={layoutMode}
                  onLayoutChange={setLayoutMode}
                  onToggleCamera={async () => {
                    if (client.current?.localParticipant) {
                      const enabled = !client.current.localParticipant.isCameraEnabled
                      await client.current.localParticipant.setCameraEnabled(enabled)
                      setIsCameraEnabled(enabled)
                    }
                  }}
                  onToggleMicrophone={async () => {
                    if (client.current?.localParticipant) {
                      const enabled = !client.current.localParticipant.isMicrophoneEnabled
                      await client.current.localParticipant.setMicrophoneEnabled(enabled)
                      setIsMicrophoneEnabled(enabled)
                    }
                  }}
                />
              </div>
            )}

            {joining && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-30">
                <Radio className="w-12 h-12 text-purple-400 animate-pulse" />
                <p className="mt-2 text-sm">Connecting to live stream...</p>
              </div>
            )}
          </div>
        </div>

        {/* Stream Info + Controls */}
        <div className="mt-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">{stream.title}</h2>

          {isHost && (
            <button
              onClick={endStreamAsBroadcaster}
              className="px-4 py-2 bg-red-600 text-white rounded-lg"
              disabled={isEndingStream}
            >
              {isEndingStream ? 'Ending...' : 'End Stream'}
            </button>
          )}
        </div>

        {/* Chat Section */}
        {messages.length > 0 && (
          <div className="mt-4 bg-gray-900 rounded-xl p-4 border border-purple-500">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Chat
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {messages.map((msg: any, i: number) => {
                const username = msg.user_profiles?.username || 'Unknown'
                return (
                  <div key={msg.id || i} className="text-sm">
                    <div className="flex items-center gap-2">
                      <ClickableUsername username={username} />
                      
                      {/* Gift button for broadcaster to gift chat users */}
                      {isHost && msg.user_id && (
                        <button
                          className="text-green-400 hover:text-green-500 transition-colors"
                          onClick={() => {
                            setGiftTarget(msg.user_id)
                            setShowGiftModal(true)
                          }}
                          title="Send gift"
                        >
                          <Gift size={16} />
                        </button>
                      )}
                    </div>
                    <span className="text-gray-300">{msg.content || msg.message}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Gift Modal */}
        {showGiftModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-xl text-center max-w-md w-full mx-4">
              <h3 className="text-lg mb-4 font-semibold">Send Gift</h3>
              <p className="text-gray-400 mb-6">Choose a gift to send</p>
              <div className="flex gap-3 justify-center">
                <button
                  className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                  onClick={() => giftTarget && sendGift(giftTarget, 'coin')}
                >
                  🎁 Send 100 Coins
                </button>
                <button
                  className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
                  onClick={() => {
                    setShowGiftModal(false)
                    setGiftTarget(null)
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StreamRoom
