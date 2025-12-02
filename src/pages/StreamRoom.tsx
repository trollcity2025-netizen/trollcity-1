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
import ChatWindow from '../components/stream/ChatWindow'
import VideoBox from '../components/stream/VideoBox'
import GiftBlast from '../components/stream/GiftBlast'
import GiftParticles from '../components/stream/GiftParticles'
import TrollSurprise from '../components/stream/TrollSurprise'
import GuestGrid from '../components/stream/GuestGrid'
import StreamReactions from '../components/stream/StreamReactions'
import GiftButton from '../components/stream/GiftButton'
import GiftPopup from '../components/stream/GiftPopup'
import GiftBurst from '../components/stream/GiftBurst'
import GiftBonusPopup from '../components/stream/GiftBonusPopup'
import AdminBroadcast from '../components/stream/AdminBroadcast'
import TrollWalking from '../components/stream/TrollWalking'
import TrollCatch from '../components/stream/TrollCatch'
import ReactionBubbles from '../components/stream/ReactionBubbles'
import GuestSlots from '../components/stream/GuestSlots'
import GuestSlot from '../components/stream/GuestSlot'
import HostVideoStream from '../components/stream/HostVideoStream'
import StreamControls from '../components/stream/StreamControls'
import EntranceEffect, { FullScreenEntrance } from '../components/stream/EntranceEffect'
import EntranceChatPanel from '../components/stream/EntranceChatPanel'
import TrollerEntrance from '../components/stream/TrollerEntrance'
import OfficerEntrance from '../components/stream/OfficerEntrance'
import AdminEntrance from '../components/stream/AdminEntrance'
import ModerationMenu from '../components/stream/ModerationMenu'
import GiftBoxButton from '../components/stream/GiftBoxButton'
import { LayoutSwitcher } from '../components/stream/ControlBar'
import { useRoom } from '../hooks/useRoom'
import { useStreamStats } from '../hooks/useStreamStats'
import { RoomEvent } from 'livekit-client'
import SendGiftModal from '../components/SendGiftModal'
import { useSetting } from '../lib/appSettingsStore'
import { useLiveSettings } from '../hooks/useLiveSettings'
import { useOfficerStreamTracking } from '../hooks/useOfficerStreamTracking'
import TrollBattleArena from '../components/TrollBattleArena'
import StartBattleModal from '../components/battle/StartBattleModal'
import BattleWinnerModal from '../components/battle/BattleWinnerModal'
import StreamLayout, { StreamParticipant } from '../components/stream/StreamLayout'
import BattleChatOverlay from '../components/stream/BattleChatOverlay'
import BattleScoreboard from '../components/stream/BattleScoreboard'
import TrollEventOverlay from '../components/stream/TrollEventOverlay'
import BirthdayOverlay from '../components/stream/BirthdayOverlay'
import { isBirthdayToday } from '../lib/birthdayUtils'

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
  const hostVideoRef = useRef<HTMLVideoElement>(null)
  const client = useRef<any>(null)
  const heartbeatIntervalRef = useRef<number | null>(null)

  const [stream, setStream] = useState<Stream | null>(null)
  const [broadcaster, setBroadcaster] = useState<UserProfile | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [joining, setJoining] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isTestingMode, setIsTestingMode] = useState(false)
  const [isEndingStream, setIsEndingStream] = useState(false)
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [giftTarget, setGiftTarget] = useState<string | null>(null)
  const [livekitUrlForFeed, setLivekitUrlForFeed] = useState<string | null>(null)
  const [livekitTokenForFeed, setLivekitTokenForFeed] = useState<string | null>(null)
  const [isCameraEnabled, setIsCameraEnabled] = useState(true)
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true)
  const [giftTrigger, setGiftTrigger] = useState<{ timestamp: number; amount: number } | null>(null)
  const [emojiRainTrigger, setEmojiRainTrigger] = useState<{ type: string; timestamp: number } | null>(null)
  const [layoutMode, setLayoutMode] = useState<'spotlight' | 'grid' | 'talkshow' | 'stacked'>('grid')
  const [activeReactions, setActiveReactions] = useState<Array<{ type: string; userId: string; timestamp: number }>>([])
  const [giftPopups, setGiftPopups] = useState<Array<{ id: string; sender: string; coins: number; giftType: string }>>([])
  const [activeGift, setActiveGift] = useState<{ sender: string; giftName: string; icon: string; amount: number } | null>(null)
  const [giftBurstTrigger, setGiftBurstTrigger] = useState(false)
  const [giftBonus, setGiftBonus] = useState<{ bonus_amount: number; total_gifts: number; message: string } | null>(null)
  const [giftBonusTrigger, setGiftBonusTrigger] = useState(false)
  const [adminMessage, setAdminMessage] = useState<string | null>(null)
  const [neonPulse, setNeonPulse] = useState(false)
  const [entranceEffects, setEntranceEffects] = useState<Array<{ id: string; username: string; effectType: string; role: 'viewer' | 'troller' | 'officer' | 'vip' | 'donor' }>>([])
  const [popularity, setPopularity] = useState<number>(0)
  const [lastInteractionTime, setLastInteractionTime] = useState<number>(Date.now())
  const [officerEvents, setOfficerEvents] = useState<Array<{ id: string; username: string; officerLevel?: string; timestamp: number }>>([])
  const [adminEvents, setAdminEvents] = useState<Array<{ id: string; username: string; timestamp: number }>>([])
  const [trollerEvents, setTrollerEvents] = useState<Array<{ id: string; username: string; trollerLevel?: number; timestamp: number }>>([])
  const [isOfficer, setIsOfficer] = useState<boolean>(false)
  const [modMenuTarget, setModMenuTarget] = useState<{ userId: string; username: string; x: number; y: number } | null>(null)
  
  // Battle state
  const [activeBattle, setActiveBattle] = useState<any | null>(null)
  const [showStartBattleModal, setShowStartBattleModal] = useState(false)
  const [showBattleWinnerModal, setShowBattleWinnerModal] = useState(false)
  const [battleWinner, setBattleWinner] = useState<{ winnerId: string | null; broadcaster1Coins: number; broadcaster2Coins: number; broadcaster1Name?: string; broadcaster2Name?: string } | null>(null)
  
  // Battle system: participants and mode
  const [streamParticipants, setStreamParticipants] = useState<StreamParticipant[]>([])
  const [battleMode, setBattleMode] = useState<'solo' | 'battle' | 'multi'>('solo')
  const [hostGiftTotal, setHostGiftTotal] = useState(0)
  const [opponentGiftTotal, setOpponentGiftTotal] = useState(0)
  const [battleTimeRemaining, setBattleTimeRemaining] = useState<number | undefined>(undefined)
  const [viewerCount, setViewerCount] = useState(0)
  const [userBalance, setUserBalance] = useState<{ paid: number; free: number }>({ paid: 0, free: 0 })
  const [userJoinedAt, setUserJoinedAt] = useState<Date | null>(null)

  // Track officer join/leave for admin dashboard
  useOfficerStreamTracking(streamId)

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
        
        // In testing mode, allow non-approved users to join as broadcasters
        const canJoinAsBroadcaster = isHost || (isTestingMode && profile && !profile.is_broadcaster)
        
        const tokenResp = await api.post('/livekit-token', {
          room: roomNameForToken,
          identity: user.email || user.id,
          isHost: canJoinAsBroadcaster,
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

      // 4. If host or in testing mode, publish local mic/camera tracks
      const canPublishTracks = isHost || (isTestingMode && profile && !profile.is_broadcaster)
      if (canPublishTracks) {
        try {
          const videoTrack = await createLocalVideoTrack()
          const audioTrack = await createLocalAudioTrack()

          await client.current.localParticipant.publishTrack(videoTrack)
          await client.current.localParticipant.publishTrack(audioTrack)

          // 🟢 Attach local video to main host video display
          if (hostVideoRef.current) {
            videoTrack.attach(hostVideoRef.current)
            hostVideoRef.current.muted = true
            hostVideoRef.current.play()
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
      
      // Removed toast notification - no need to show "Connected to stream" popup
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

  // Check for active battle
  useEffect(() => {
    if (!streamId || !user) return

    const checkActiveBattle = async () => {
      if (!streamId) return

      // Check for active battle for this stream
      const { data: battle } = await supabase
        .from('battles')
        .select('*')
        .eq('stream_id', streamId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (battle) {
        setActiveBattle(battle)
      }
    }

    checkActiveBattle()

    // Subscribe to battle updates for this stream
    const channel = supabase
      .channel(`stream-battles-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'battles',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload: any) => {
          if (payload.new && payload.new.status === 'active') {
            setActiveBattle(payload.new)
          } else if (payload.new && (payload.new.status === 'finished' || payload.new.status === 'cancelled')) {
            setActiveBattle(null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId, user?.id])

  // Load and subscribe to stream participants
  useEffect(() => {
    if (!streamId) return

    const loadParticipants = async () => {
      const { data, error } = await supabase
        .from('streams_participants')
        .select(`
          id,
          user_id,
          role,
          livekit_identity,
          user_profiles:user_id (
            id,
            username,
            avatar_url,
            is_troll_officer,
            is_og_user,
            role
          )
        `)
        .eq('stream_id', streamId)
        .eq('is_active', true)

      if (error) {
        console.error('Error loading participants:', error)
        return
      }

      // Map to StreamParticipant format
      const participants: StreamParticipant[] = (data || []).map((p: any) => {
        // Find LiveKit participant by identity or user_id
        let livekitParticipant = null
        if (client.current) {
          if (p.livekit_identity) {
            livekitParticipant = client.current.remoteParticipants.get(p.livekit_identity) || null
          }
          // Fallback: try to match by user_id
          if (!livekitParticipant && p.user_id) {
            for (const participant of client.current.remoteParticipants.values()) {
              if (participant.identity === p.user_id || participant.identity === p.user_profiles?.username) {
                livekitParticipant = participant
                break
              }
            }
          }
        }

        return {
          participant: livekitParticipant,
          userProfile: p.user_profiles || null,
          userId: p.user_id,
          role: p.role as 'host' | 'opponent' | 'guest',
        }
      })

      setStreamParticipants(participants)

      // Determine mode
      if (activeBattle) {
        setBattleMode('battle')
      } else if (participants.length > 1) {
        setBattleMode('multi')
      } else {
        setBattleMode('solo')
      }
    }

    loadParticipants()

    // Subscribe to participant changes
    const channel = supabase
      .channel(`stream-participants-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'streams_participants',
          filter: `stream_id=eq.${streamId}`,
        },
        () => {
          loadParticipants()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId, activeBattle, client.current])

  // Subscribe to battle gifts for totals
  useEffect(() => {
    if (!activeBattle?.id) {
      setHostGiftTotal(0)
      setOpponentGiftTotal(0)
      return
    }

      const loadBattleTotals = async () => {
        const { data: battle } = await supabase
          .from('battles')
          .select('host_gift_total, opponent_gift_total')
          .eq('id', activeBattle.id)
          .single()

        if (battle) {
          setHostGiftTotal(battle.host_gift_total || 0)
          setOpponentGiftTotal(battle.opponent_gift_total || 0)
        }
      }

      loadBattleTotals()

      // Subscribe to battle updates
      const channel = supabase
        .channel(`battle-totals-${activeBattle.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'battles',
            filter: `id=eq.${activeBattle.id}`,
          },
          (payload) => {
            const battle = payload.new
            setHostGiftTotal(battle.host_gift_total || 0)
            setOpponentGiftTotal(battle.opponent_gift_total || 0)
          }
        )
        .subscribe()

    // Calculate time remaining
    if (activeBattle.end_time) {
      const updateTimer = () => {
        const now = Date.now()
        const end = new Date(activeBattle.end_time).getTime()
        const remaining = Math.max(0, Math.floor((end - now) / 1000))
        setBattleTimeRemaining(remaining)
      }

      updateTimer()
      const timerInterval = setInterval(updateTimer, 1000)

      return () => {
        clearInterval(timerInterval)
        supabase.removeChannel(channel)
      }
    }

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeBattle?.id])

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

      // Check if stream is in testing mode
      setIsTestingMode(s.is_testing_mode || false)

      // Initialize popularity from stream (default to 0 if not set)
      setPopularity(Math.max(0, Math.min(1000000, (s.popularity || 0))))
      setLastInteractionTime(Date.now())

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
   ⚙️ Live App Settings - Auto-updates via Supabase realtime
   Demonstrates instant reactivity without page refresh
   ───────────────────────────────────────────────────*/
  // Option 1: Using useLiveSettings (recommended - handles initialization automatically)
  const trollFrequency = useLiveSettings('live_troll_frequency') || 10

  // Option 2: Using useSetting directly (requires settings to be loaded elsewhere)
  // const trollFrequency = useSetting('live_troll_frequency') || 10

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
      try {
        if (channel) {
          supabase.removeChannel(channel)
        }
      } catch (err) {
        console.warn('Error removing channel:', err)
      }
    }
  }, [streamId])

  const joinStream = async () => {
    try {
      setJoining(true)
      setUserJoinedAt(new Date())
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
  // Stream heartbeat (for host only)
  useEffect(() => {
    if (!isHost || !streamId || !user) return

    const sendHeartbeat = async () => {
      try {
        await supabase
          .from('streams')
          .update({ last_heartbeat_at: new Date().toISOString() })
          .eq('id', streamId)
          .eq('broadcaster_id', user.id)
      } catch (err) {
        console.error('Heartbeat error:', err)
      }
    }

    // Send heartbeat every 25 seconds
    heartbeatIntervalRef.current = window.setInterval(sendHeartbeat, 25000)
    sendHeartbeat() // Initial heartbeat

    return () => {
      if (heartbeatIntervalRef.current) {
        window.clearInterval(heartbeatIntervalRef.current)
      }
    }
  }, [isHost, streamId, user])

  // beforeunload handler for host
  useEffect(() => {
    if (!isHost || !streamId) return

    const handleBeforeUnload = async () => {
      // Fire and forget - call end stream function
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session.session?.access_token
        if (token) {
          fetch(
            `${import.meta.env.VITE_EDGE_FUNCTIONS_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'}/streams-maintenance`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                action: 'end_stream',
                stream_id: streamId,
              }),
              keepalive: true, // Keep request alive even after page unload
            }
          ).catch(() => {}) // Ignore errors
        }
      } catch (err) {
        // Ignore errors
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isHost, streamId])

  const endStreamAsBroadcaster = async () => {
    if (!stream || profile?.id !== stream.broadcaster_id) return

    try {
      setIsEndingStream(true)
      
      // Call edge function to properly end stream
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      
      if (token) {
        await fetch(
          `${import.meta.env.VITE_EDGE_FUNCTIONS_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'}/streams-maintenance`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: 'end_stream',
              stream_id: stream.id,
            }),
          }
        )
      } else {
        // Fallback to direct update
        await supabase
          .from('streams')
          .update({
            is_live: false,
            status: 'ended',
            end_time: new Date().toISOString()
          })
          .eq('id', stream.id)
      }

      toast.success('Stream ended')
      navigate('/live', { replace: true })
    } catch {
      toast.error('Failed to end stream')
    } finally {
      setIsEndingStream(false)
    }
  }

  /** ────────────────────────────────────────────────
   🚪 Stream Entrance Listener
  ───────────────────────────────────────────────────*/
  useEffect(() => {
    if (!streamId) return

    const determineUserRole = (profile: any): 'viewer' | 'troller' | 'officer' | 'vip' | 'donor' => {
      // Check role field
      if (profile.role === 'troll_officer' || profile.role === 'moderator' || profile.role === 'admin') {
        return 'officer'
      }
      if (profile.role === 'troller' || profile.role === 'troll_family') {
        return 'troller'
      }

      // Check VIP/Donor status (high coin spending or balance)
      const totalSpent = profile.total_spent_coins || 0
      const paidBalance = profile.paid_coin_balance || 0

      if (totalSpent > 100000 || paidBalance > 50000) {
        return 'donor'
      }
      if (totalSpent > 50000 || paidBalance > 20000) {
        return 'vip'
      }

      return 'viewer'
    }

    const handleEntranceEffect = async (entranceData: any) => {
      try {
        // Fetch user profile to get username and role info
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('username, role, total_spent_coins, paid_coin_balance')
          .eq('id', entranceData.user_id)
          .single()

        if (!profile) return

        const role = determineUserRole(profile)

        // Fetch user's active entrance effect
        let effectType = 'default'
        try {
          const { data: userEffect } = await supabase
            .from('user_entrance_effects')
            .select('effect_id')
            .eq('user_id', entranceData.user_id)
            .eq('is_active', true)
            .single()

          if (userEffect?.effect_id) {
            // Fetch the effect details
            const { data: effectData } = await supabase
              .from('entrance_effects')
              .select('animation_type')
              .eq('id', userEffect.effect_id)
              .single()

            if (effectData?.animation_type) {
              effectType = effectData.animation_type
            }
          }
        } catch (error) {
          // If no entrance effect found, use default
          console.log('No entrance effect found, using default')
        }

        // Add entrance effect to display
        const entranceId = `${entranceData.id}-${Date.now()}`
        setEntranceEffects((prev) => [
          ...prev,
          {
            id: entranceId,
            username: profile.username,
            effectType,
            role,
          },
        ])

        // Trigger emoji rain for entrance events (especially VIP/Donor/Troller)
        if (role === 'vip' || role === 'donor' || role === 'troller') {
          setEmojiRainTrigger({ type: 'entrance', timestamp: Date.now() })
        }

        // Send chat message about entrance
        await supabase.from('messages').insert({
          stream_id: streamId,
          user_id: entranceData.user_id,
          content: `${profile.username} has entered the stream! 🎉`,
          message_type: 'entrance',
        })
      } catch (error) {
        console.error('Error handling entrance effect:', error)
      }
    }

    const channel = supabase
      .channel(`stream-entrances-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_entrances',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => handleEntranceEffect(payload.new)
      )
      .subscribe()

    return () => {
      try {
        if (channel) {
          supabase.removeChannel(channel)
        }
      } catch (err) {
        console.warn('Error removing channel:', err)
      }
    }
  }, [streamId])

  /** ────────────────────────────────────────────────
   🎁 Gift Popup Listener & Broadcaster Balance Updates
  ───────────────────────────────────────────────────*/
  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`gift-popups-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gifts',
          filter: `stream_id=eq.${streamId}`,
        },
        async (payload) => {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('username')
            .eq('id', payload.new.sender_id)
            .single()

          if (profile) {
            const amount = payload.new.coins_spent || 0
            const giftId = `${payload.new.id}-${Date.now()}`
            
            // Fetch gift item details to get animation_type and icon
            // Try to match by gift_name (from gifts table) to gift_items table
            let giftItem = null
            if (payload.new.gift_name) {
              const { data: giftData } = await supabase
                .from('gift_items')
                .select('icon, animation_type, category, name')
                .ilike('name', `%${payload.new.gift_name}%`)
                .limit(1)
                .single()
              giftItem = giftData
            }
            
            const giftIcon = giftItem?.icon || payload.new.gift_type || '🎁'
            const giftName = giftItem?.name || payload.new.gift_name || 'Gift'
            
            // Trigger GiftBurst animation
            setActiveGift({
              sender: profile.username,
              giftName: giftName,
              icon: giftIcon,
              amount: amount,
            })
            setGiftBurstTrigger(true)
            setTimeout(() => {
              setGiftBurstTrigger(false)
              setActiveGift(null)
            }, 4500)
            
            setGiftPopups((prev) => [
              ...prev,
              {
                id: giftId,
                sender: profile.username,
                coins: amount,
                giftType: giftIcon,
              },
            ])

            // Trigger neon pulse
            setNeonPulse(true)
            setTimeout(() => setNeonPulse(false), 2000)

            // Trigger particle animation
            setGiftTrigger({ timestamp: Date.now(), amount })

            // Trigger specific animations based on animation_type
            const animationType = giftItem?.animation_type || 'standard'
            if (animationType === 'fireworks') {
              // Fireworks animation
              setEmojiRainTrigger({ type: 'fireworks', timestamp: Date.now() })
            } else if (animationType === 'fallingPetals' || animationType === 'float') {
              // Falling petals/float animation
              setEmojiRainTrigger({ type: 'petals', timestamp: Date.now() })
            } else {
              // Default gift animation
              setEmojiRainTrigger({ type: 'gift', timestamp: Date.now() })
            }

            // Update popularity: +coin amount per gift
            const newPopularity = Math.min(1000000, popularity + amount)
            setPopularity(newPopularity)
            setLastInteractionTime(Date.now())
            
            // Update stream popularity in database
            try {
              await supabase
                .from('streams')
                .update({ popularity: newPopularity })
                .eq('id', streamId)
            } catch (err) {
              console.error(err)
            }

            // Update broadcaster's balance if they're the receiver
            if (payload.new.receiver_id && stream?.broadcaster_id === payload.new.receiver_id) {
              // Always refresh broadcaster's profile to get updated balance
              // Add a small delay to ensure database has updated
              setTimeout(async () => {
                const { data: broadcasterProfile, error } = await supabase
                  .from('user_profiles')
                  .select('*')
                  .eq('id', stream.broadcaster_id)
                  .single()

                if (error) {
                  console.error('Error fetching broadcaster profile:', error)
                  return
                }

                if (broadcasterProfile) {
                  // If current user is the broadcaster, update their profile in store
                  if (user?.id === stream.broadcaster_id) {
                    console.log('Updating broadcaster balance in store:', {
                      old_balance: useAuthStore.getState().profile?.paid_coin_balance,
                      new_balance: broadcasterProfile.paid_coin_balance,
                      gift_amount: amount
                    })
                    useAuthStore.getState().setProfile(broadcasterProfile as any)
                  }
                }
              }, 500) // 500ms delay to ensure database update is complete
            }

            // Update guest balance if they're the receiver
            if (payload.new.receiver_id && payload.new.receiver_id !== stream?.broadcaster_id) {
              setTimeout(async () => {
                const { data: guestProfile } = await supabase
                  .from('user_profiles')
                  .select('*')
                  .eq('id', payload.new.receiver_id)
                  .single()

                if (guestProfile && user?.id === payload.new.receiver_id) {
                  // If current user is the guest receiver, update their profile
                  useAuthStore.getState().setProfile(guestProfile as any)
                }
              }, 500)
            }

            // Check if total gifts reach 2 million - trigger troll drops
            const { data: streamData } = await supabase
              .from('streams')
              .select('total_gifts_coins')
              .eq('id', streamId)
              .single()

            if (streamData && streamData.total_gifts_coins >= 2000000) {
              // Trigger troll drops
              setEmojiRainTrigger({ type: 'troll', timestamp: Date.now() })
              toast.success('🎉 2 Million Coins Milestone! Troll Drops Activated!')
            }
          }
        }
      )
      .subscribe()

    return () => {
      try {
        if (channel) {
          supabase.removeChannel(channel)
        }
      } catch (err) {
        console.warn('Error removing gift channel:', err)
      }
    }
  }, [streamId, isHost, stream?.broadcaster_id])

  /** ────────────────────────────────────────────────
   📢 Admin Broadcast Listener
  ───────────────────────────────────────────────────*/
  useEffect(() => {
    const channel = supabase
      .channel('admin_broadcast_listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_broadcasts',
        },
        (payload) => {
          triggerAdminAnnouncement(payload.new.message)
        }
      )
      .subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch (err) {
        console.warn('Error removing admin broadcast channel:', err)
      }
    }
  }, [])

  function triggerAdminAnnouncement(msg: string) {
    setAdminMessage(msg)
    setTimeout(() => {
      setAdminMessage(null)
    }, 8000) // disappear after 8s
  }

  // Get user's preferred language
  const userLanguage = profile?.preferred_language || 'en'

  /** ────────────────────────────────────────────────
   💰 Broadcaster Balance Real-Time Updates
   Updates broadcaster balance when:
   - They receive gifts
   - They catch trolls (TrollCatch, TrollSurprise)
   - They get troll drops
   ───────────────────────────────────────────────────*/
  useEffect(() => {
    // Listen for broadcaster's profile updates
    // Host/broadcaster are the same - update balance for broadcaster
    if (!stream?.broadcaster_id || !user?.id) return

    // Only update if current user is the broadcaster
    if (user.id !== stream.broadcaster_id) return

    console.log('Setting up broadcaster balance listener for:', stream.broadcaster_id)

    // Listen for broadcaster's profile updates (when they receive gifts, catch trolls, etc.)
    const channel = supabase
      .channel(`broadcaster-balance-${stream.broadcaster_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${stream.broadcaster_id}`,
        },
        async (payload) => {
          console.log('Broadcaster profile updated via real-time:', payload.new)
          // Update broadcaster's profile in store
          const updatedProfile = payload.new
          if (updatedProfile) {
            useAuthStore.getState().setProfile(updatedProfile as any)
            console.log('Broadcaster balance updated in store:', {
              paid: updatedProfile.paid_coin_balance,
              free: updatedProfile.free_coin_balance
            })
          }
        }
      )
      .subscribe()

    return () => {
      try {
        if (channel) {
          supabase.removeChannel(channel)
        }
      } catch (err) {
        console.warn('Error removing broadcaster balance channel:', err)
      }
    }
  }, [stream?.broadcaster_id, user?.id])

  /** ────────────────────────────────────────────────
   💰 Real-time Coin Balance Updates
  ───────────────────────────────────────────────────*/
  useEffect(() => {
    if (!user) return

    const fetchBalances = async () => {
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('paid_coin_balance, free_coin_balance')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setUserBalance({
          paid: profileData.paid_coin_balance || 0,
          free: profileData.free_coin_balance || 0
        })
        // Update auth store profile
        const currentProfile = useAuthStore.getState().profile
        if (currentProfile) {
          useAuthStore.getState().setProfile({
            ...currentProfile,
            paid_coin_balance: profileData.paid_coin_balance,
            free_coin_balance: profileData.free_coin_balance
          })
        }
      }
    }

    // Initial load
    fetchBalances()

    // Real-time listener for coin transactions
    const channel = supabase
      .channel('coin-updates')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'coin_transactions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Coin transaction detected:', payload)
          fetchBalances() // Refresh balances
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  /** ────────────────────────────────────────────────
   👥 Live Viewer Presence Tracking
   ───────────────────────────────────────────────────*/
  useEffect(() => {
    if (!streamId || !user || !profile) return

    const channel = supabase.channel(`presence_${streamId}`, {
      config: { presence: { key: user.id } },
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ 
          username: profile.username,
          user_id: user.id,
          is_officer: profile.is_troll_officer || profile.role === 'troll_officer',
          is_og: profile.is_og_user
        })
      }
    })

    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      newPresences.forEach((p: any) => {
        if (p.username && p.user_id !== user.id) {
          toast(`${p.username} joined 🎟️`)
        }
      })
      // Update viewer count
      const state = channel.presenceState()
      setViewerCount(Object.keys(state).length)
    })

    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      leftPresences.forEach((p: any) => {
        if (p.username && p.user_id !== user.id) {
          toast(`${p.username} left 🚪`)
        }
      })
      // Update viewer count
      const state = channel.presenceState()
      setViewerCount(Object.keys(state).length)
    })

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      setViewerCount(Object.keys(state).length)
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId, user, profile])

  /** ────────────────────────────────────────────────
   📉 Popularity Decay Timer - Decreases by 1 every 10 seconds if no interaction
   ───────────────────────────────────────────────────*/
  useEffect(() => {
    if (!streamId || popularity <= 0) return

    const decayInterval = setInterval(() => {
      const timeSinceLastInteraction = Date.now() - lastInteractionTime
      // If no interaction for 10 seconds, decrease popularity by 1
      if (timeSinceLastInteraction >= 10000) {
        const newPopularity = Math.max(0, popularity - 1)
        setPopularity(newPopularity)
        
        // Update stream popularity in database
        ;(async () => {
          try {
            await supabase
              .from('streams')
              .update({ popularity: newPopularity })
              .eq('id', streamId)
          } catch (err) {
            console.error(err)
          }
        })()
      }
    }, 10000) // Check every 10 seconds

    return () => clearInterval(decayInterval)
  }, [streamId, popularity, lastInteractionTime])

  // Get stream stats - MUST be called before early returns (Rules of Hooks)
  const { viewerCount: streamStatsViewerCount, duration } = useStreamStats(client.current, stream?.broadcaster_id || null)

  // Attach host video to ref - MUST be called before early returns (Rules of Hooks)
  useEffect(() => {
    if (!hostVideoRef.current || !client.current) {
      console.log('Video attachment: Missing ref or client', { 
        hasRef: !!hostVideoRef.current, 
        hasClient: !!client.current 
      })
      return
    }

    const attachBroadcasterVideo = () => {
      if (!hostVideoRef.current || !client.current) return

      let broadcasterParticipant = null

      if (isHost) {
        // If we're the host, use local participant
        broadcasterParticipant = client.current.localParticipant
        console.log('Host mode: Using local participant', broadcasterParticipant?.identity)
      } else {
        // If we're a viewer, find the broadcaster
        const broadcasterId = stream?.broadcaster_id
        console.log('Viewer mode: Looking for broadcaster', broadcasterId)
        
        if (broadcasterId) {
          // Try multiple ways to find the broadcaster
          // 1. Direct lookup by broadcaster_id
          broadcasterParticipant = client.current.remoteParticipants.get(broadcasterId) || null
          
          // 2. Try finding by matching any part of identity
          if (!broadcasterParticipant) {
            console.log('Trying to find broadcaster by identity match...')
            for (const participant of client.current.remoteParticipants.values()) {
              console.log('Checking participant:', participant.identity)
              // Check if identity matches broadcaster_id, user email, or user id
              if (participant.identity === broadcasterId || 
                  participant.identity === user?.email ||
                  participant.identity === user?.id ||
                  participant.identity?.includes(broadcasterId) ||
                  broadcasterId.includes(participant.identity)) {
                broadcasterParticipant = participant
                console.log('Found broadcaster by identity match:', participant.identity)
                break
              }
            }
          }
          
          // 3. If still not found and there's only one remote participant, use it
          if (!broadcasterParticipant && client.current.remoteParticipants.size === 1) {
            broadcasterParticipant = Array.from(client.current.remoteParticipants.values())[0]
            console.log('Using only remote participant as broadcaster:', broadcasterParticipant.identity)
          }
        }
      }

      if (!broadcasterParticipant) {
        console.log('Broadcaster participant not found yet', {
          isHost,
          broadcasterId: stream?.broadcaster_id,
          remoteParticipants: client.current.remoteParticipants.size,
          identities: Array.from(client.current.remoteParticipants.values()).map((p: any) => p.identity)
        })
        return
      }

      console.log('Found broadcaster participant:', broadcasterParticipant.identity)

      // Get video track - try both videoTrackPublications and videoTracks
      const videoTracks = Array.from(broadcasterParticipant.videoTrackPublications.values())
      console.log('Video track publications:', videoTracks.length)
      
      let videoPub = videoTracks.find((pub: any) => pub.kind === 'video') as any
      let videoTrack = videoPub?.track

      // If track is not available yet, try subscribing to it
      if (!videoTrack && videoPub && !videoPub.isSubscribed) {
        console.log('Video track not subscribed yet, subscribing...')
        broadcasterParticipant.setSubscribed(videoPub.trackSid, true)
      }

      // Also check if track becomes available via TrackSubscribed event
      if (videoTrack && hostVideoRef.current) {
        console.log('Attaching broadcaster video track to element')
        try {
          videoTrack.attach(hostVideoRef.current)
          if (hostVideoRef.current && hostVideoRef.current.readyState >= 2) {
            hostVideoRef.current.play().catch((err: any) => {
              // Ignore AbortError - video was interrupted by new load (expected behavior)
              if (err.name !== 'AbortError') {
                console.warn('Error playing video:', err)
              }
            })
          }
          console.log('Video track attached successfully')
        } catch (err) {
          console.error('Error attaching video track:', err)
        }
      } else {
        console.log('Video track not available yet', { 
          hasVideoPub: !!videoPub, 
          hasTrack: !!videoTrack,
          isSubscribed: videoPub?.isSubscribed 
        })
      }
    }

    // Initial attach attempt with delay to ensure room is ready
    const initialTimeout = setTimeout(() => {
      attachBroadcasterVideo()
    }, 1000)

    // Listen for participant connections
    const handleParticipantConnected = async (participant: any) => {
      console.log('Participant connected:', participant.identity, 'isLocal:', participant.isLocal)
      // Retry attaching video when a new participant connects
      setTimeout(attachBroadcasterVideo, 500)

      // Check if participant is an admin or officer
      if (!participant.isLocal && participant.identity) {
        try {
          // Try to get user ID from participant identity (could be email, user ID, etc.)
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('id, username, role, is_admin, is_troll_officer, is_troller, troller_level')
            .or(`id.eq.${participant.identity},email.eq.${participant.identity}`)
            .single()

          if (userProfile) {
            const isAdmin = userProfile.is_admin || userProfile.role === 'admin'
            const isOfficer = userProfile.is_troll_officer || userProfile.role === 'troll_officer'
            const isTroller = !isAdmin && !isOfficer && (userProfile.is_troller || userProfile.role === 'troller')

            // Trigger admin entrance (priority over officer and troller)
            if (isAdmin) {
              const adminEvent = {
                id: `${userProfile.id}-${Date.now()}`,
                username: userProfile.username,
                timestamp: Date.now()
              }
              setAdminEvents((prev) => [...prev, adminEvent])

              // Play admin entrance sound (optional)
              try {
                const audio = new Audio('/sounds/admin_enter.mp3')
                audio.volume = 0.5
                audio.play().catch(() => {
                  // Sound file might not exist, that's okay
                })
              } catch (err) {
                // Sound not available, continue
              }

              // Auto-remove event after 3.5 seconds
              setTimeout(() => {
                setAdminEvents((prev) => prev.filter(e => e.id !== adminEvent.id))
              }, 3500)
            } else if (isOfficer) {
              // Trigger officer entrance
              const officerEvent = {
                id: `${userProfile.id}-${Date.now()}`,
                username: userProfile.username,
                officerLevel: 'Officer',
                timestamp: Date.now()
              }
              setOfficerEvents((prev) => [...prev, officerEvent])
              
              // Log officer join in database
              try {
                await supabase
                  .from('officer_stream_logs')
                  .insert({
                    officer_id: userProfile.id,
                    stream_id: streamId,
                    joined_at: new Date().toISOString()
                  })
              } catch (err) {
                console.error(err)
              }

              // Auto-remove event after 4 seconds
              setTimeout(() => {
                setOfficerEvents((prev) => prev.filter(e => e.id !== officerEvent.id))
              }, 4000)
            } else if (isTroller) {
              // Trigger troller entrance (chaotic entrance)
              const trollerEvent = {
                id: `${userProfile.id}-${Date.now()}`,
                username: userProfile.username,
                trollerLevel: userProfile.troller_level || 1,
                timestamp: Date.now()
              }
              setTrollerEvents((prev) => [...prev, trollerEvent])

              // Auto-remove event after 3 seconds
              setTimeout(() => {
                setTrollerEvents((prev) => prev.filter(e => e.id !== trollerEvent.id))
              }, 3000)
            }
          }
        } catch (err) {
          console.error('Error checking admin/officer status:', err)
        }
      }
    }

    // Listen for track subscriptions (when track becomes available)
    const handleTrackSubscribed = (track: any, publication: any, participant: any) => {
      console.log('Track subscribed:', track.kind, 'from participant:', participant?.identity || 'unknown', 'isLocal:', participant?.isLocal)
      if (track.kind === 'video' && hostVideoRef.current) {
        const isBroadcaster = isHost 
          ? participant?.isLocal
          : (participant?.identity === stream?.broadcaster_id ||
             participant?.identity === user?.email ||
             participant?.identity === user?.id ||
             client.current?.remoteParticipants.size === 1)
        
        if (isBroadcaster) {
          console.log('Attaching broadcaster video from TrackSubscribed event')
          try {
            track.attach(hostVideoRef.current)
            hostVideoRef.current.play().catch((err: any) => {
              console.error('Error playing video:', err)
            })
          } catch (err) {
            console.error('Error attaching video from TrackSubscribed:', err)
          }
        }
      }
    }

    // Listen for track publications
    const handleTrackPublished = (publication: any, participant: any) => {
      console.log('Track published:', publication.kind, 'from participant:', participant?.identity)
      if (publication.kind === 'video' && hostVideoRef.current) {
        // Check if this is the broadcaster's track
        const isBroadcaster = isHost 
          ? participant?.isLocal || participant === client.current?.localParticipant
          : (participant?.identity === stream?.broadcaster_id ||
             participant?.identity === user?.email ||
             participant?.identity === user?.id ||
             client.current?.remoteParticipants.size === 1)
        
        if (isBroadcaster) {
          console.log('Broadcaster track published, subscribing...')
          // Subscribe to the track
          if (participant && !publication.isSubscribed) {
            participant.setSubscribed(publication.trackSid, true)
          }
          // Also try attaching if track is already available
          if (publication.track) {
            console.log('Attaching broadcaster video from TrackPublished event')
            try {
              publication.track.attach(hostVideoRef.current)
              hostVideoRef.current.play().catch((err: any) => {
                console.error('Error playing video:', err)
              })
            } catch (err) {
              console.error('Error attaching video from TrackPublished:', err)
            }
          }
        }
      }
    }

    const handleTrackUnpublished = (publication: any) => {
      if (publication.kind === 'video' && hostVideoRef.current) {
        publication.track?.detach(hostVideoRef.current)
      }
    }

    // Subscribe to room events
    client.current.on(RoomEvent.ParticipantConnected, handleParticipantConnected)
    client.current.on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
    client.current.on(RoomEvent.TrackPublished, handleTrackPublished)
    client.current.on(RoomEvent.TrackUnpublished, handleTrackUnpublished)

    // Also listen on local participant if host
    if (isHost && client.current.localParticipant) {
      const localParticipant = client.current.localParticipant
      localParticipant.on('trackPublished', (publication: any) => {
        if (publication.kind === 'video' && publication.track && hostVideoRef.current) {
          console.log('Local video track published, attaching...')
          try {
            publication.track.attach(hostVideoRef.current)
            if (hostVideoRef.current && hostVideoRef.current.readyState >= 2) {
              hostVideoRef.current.play().catch((err: any) => {
                if (err.name !== 'AbortError') {
                  console.warn('Error playing video:', err)
                }
              })
            }
          } catch (err) {
            console.error('Error attaching local video:', err)
          }
        }
      })
    }

    return () => {
      clearTimeout(initialTimeout)
      if (client.current) {
        try {
          client.current.off(RoomEvent.ParticipantConnected, handleParticipantConnected)
          client.current.off(RoomEvent.TrackSubscribed, handleTrackSubscribed)
          client.current.off(RoomEvent.TrackPublished, handleTrackPublished)
          client.current.off(RoomEvent.TrackUnpublished, handleTrackUnpublished)
        } catch (err) {
          console.warn('Error removing event listeners:', err)
        }
      }
      if (hostVideoRef.current) {
        hostVideoRef.current.srcObject = null
      }
    }
  }, [isHost, stream?.broadcaster_id, client.current, user?.id, user?.email])

  /** ────────────────────────────────────────────────
   💝 Send Reaction (Heart, Troll, Boo only)
  ───────────────────────────────────────────────────*/
  const sendReaction = async (type: string): Promise<void> => {
    if (!streamId || !user?.id) {
      toast.error('Cannot send reaction: missing stream or user')
      return
    }

    // Only allow specific reaction types (no random emojis)
    // Strict validation - only accept exact matches
    // Note: 'troll' type is mapped to 'boo' for sending boos
    if (type !== 'heart' && type !== 'troll' && type !== 'boo') {
      console.error('Invalid reaction type:', type)
      return
    }

    // Use the exact type - troll sends trolls, not boos
    const reactionType = type

    try {
      // If heart, send multiple hearts (3-5) for a better visual effect
      if (reactionType === 'heart') {
        const heartCount = Math.floor(Math.random() * 3) + 3 // 3-5 hearts
        const heartReactions = Array.from({ length: heartCount }, () => ({
          stream_id: streamId,
          user_id: user.id,
          reaction_type: 'heart',
        }))

        const { error } = await supabase.from('stream_reactions').insert(heartReactions)

        if (error) {
          console.error('Failed to send heart reactions:', error)
          toast.error('Failed to send hearts')
          return
        }

        // Update popularity: +1 per heart
        const newPopularity = Math.min(1000000, popularity + heartCount)
        setPopularity(newPopularity)
        setLastInteractionTime(Date.now())
        
        try {
          await supabase
            .from('streams')
            .update({ popularity: newPopularity })
            .eq('id', streamId)
        } catch (err) {
          console.error(err)
        }
      } else if (reactionType === 'troll') {
        // Send single troll reaction
        const { error } = await supabase.from('stream_reactions').insert([
          {
            stream_id: streamId,
            user_id: user.id,
            reaction_type: 'troll',
          },
        ])

        if (error) {
          console.error('Failed to send troll reaction:', error)
          toast.error('Failed to send troll')
          return
        }

        // Handle troll - reduce broadcaster popularity by 1 point immediately
        const newPopularity = Math.max(0, popularity - 1)
        setPopularity(newPopularity)
        setLastInteractionTime(Date.now())
        
        // Update stream popularity in database
        try {
          const { error } = await supabase
            .from('streams')
            .update({ popularity: newPopularity })
            .eq('id', streamId)
          if (!error && stream) {
            setStream({ ...(stream as any), popularity: newPopularity } as any)
          }
        } catch (err) {}
      } else if (reactionType === 'boo') {
        // Send single boo reaction (if still used)
        const { error } = await supabase.from('stream_reactions').insert([
          {
            stream_id: streamId,
            user_id: user.id,
            reaction_type: 'boo',
          },
        ])

        if (error) {
          console.error('Failed to send boo reaction:', error)
          toast.error('Failed to send boo')
          return
        }
      }

      // Trigger emoji rain for reaction events (only for troll, not heart)
      // Hearts are already shown via ReactionBubbles, so no need for emoji rain
      if (type === 'troll') {
        setEmojiRainTrigger({ type, timestamp: Date.now() })
      }
    } catch (err) {
      console.error('Error sending reaction:', err)
      toast.error('Failed to send reaction')
    }
  }

  /** ────────────────────────────────────────────────
   🎁 Send Gift to Participant or Viewer
  ───────────────────────────────────────────────────*/
  const sendGift = async (giftName: string, coinAmount: number) => {
    if (!streamId) {
      toast.error('No active stream')
      return
    }

    try {
      const token = await supabase.auth.getSession().then(r => r.data.session?.access_token)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTION_URL}/send-gift`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          stream_id: streamId, 
          gift_name: giftName, 
          coin_amount: coinAmount 
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to send gift' }))
        throw new Error(error.error || 'Failed to send gift')
      }

      // Trigger animation
      spawnGiftAnimation(giftName)
      
      toast.success(`Gift sent: ${giftName} 🎁`)
    } catch (err: any) {
      console.error('Failed to send gift:', err)
      toast.error(err.message || 'Gift sending failed')
    }
  }

  // Spawn gift animation
  const spawnGiftAnimation = (giftName: string) => {
    setActiveGift({
      sender: profile?.username || 'You',
      giftName: giftName,
      icon: '🎁',
      amount: 0, // Will be updated from the response
    })
    setGiftBurstTrigger(true)
    setTimeout(() => {
      setGiftBurstTrigger(false)
      setActiveGift(null)
    }, 3000)
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

  // Get host and guests from room (computed values, not hooks)
  const hostParticipant = isHost 
    ? client.current?.localParticipant || null
    : client.current?.remoteParticipants.get(stream?.broadcaster_id || '') || null

  // Get guest slots (remote participants excluding broadcaster, max 4)
  const guestSlots = client.current 
    ? Array.from(client.current.remoteParticipants.values())
        .filter((p: any) => {
          // Exclude broadcaster from guest slots
          const broadcasterId = stream?.broadcaster_id
          return p.identity !== broadcasterId && 
                 p.identity !== user?.email && 
                 p.identity !== user?.id
        })
        .slice(0, 4)
    : []

  return (
    <div className="min-h-screen bg-black text-white p-2">
      {/* Overlays - Keep all animations and effects on top */}
      <div className="fixed inset-0 pointer-events-none z-50">
        {/* Gift Effects */}
        <GiftParticles trigger={giftTrigger} />
        
        {/* GiftBurst - Enhanced gift animation */}
        {activeGift && (
          <GiftBurst
            sender={activeGift.sender}
            giftName={activeGift.giftName}
            icon={activeGift.icon}
            amount={activeGift.amount}
            trigger={giftBurstTrigger}
            onComplete={() => {
              setGiftBurstTrigger(false)
              setActiveGift(null)
            }}
          />
        )}
        
        {/* Gift Bonus Popup */}
        {giftBonus && (
          <GiftBonusPopup
            bonus={giftBonus}
            trigger={giftBonusTrigger}
            onComplete={() => {
              setGiftBonusTrigger(false)
              setGiftBonus(null)
            }}
          />
        )}
        
        {/* Admin Broadcast Announcement */}
        {adminMessage && (
          <AdminBroadcast
            message={adminMessage}
            userLanguage={userLanguage}
            onComplete={() => setAdminMessage(null)}
          />
        )}
        
        {/* Legacy GiftPopup - Keep for backward compatibility */}
        {giftPopups.map((popup) => (
          <GiftPopup
            key={popup.id}
            sender={popup.sender}
            coins={popup.coins}
            giftType={popup.giftType}
            onComplete={() => setGiftPopups((prev) => prev.filter((p) => p.id !== popup.id))}
          />
        ))}

        {/* Admin Entrance Animations */}
        {adminEvents.map((event) => (
          <AdminEntrance
            key={event.id}
            username={event.username}
            onComplete={() => setAdminEvents((prev) => prev.filter(e => e.id !== event.id))}
          />
        ))}

        {/* Officer Entrance Animations */}
        {officerEvents.map((event) => (
          <OfficerEntrance
            key={event.id}
            username={event.username}
            officerLevel={event.officerLevel}
            onComplete={() => setOfficerEvents((prev) => prev.filter(e => e.id !== event.id))}
          />
        ))}

        {/* Troller Entrance Animations */}
        {trollerEvents.map((event) => (
          <TrollerEntrance
            key={event.id}
            username={event.username}
            trollerLevel={event.trollerLevel}
            onComplete={() => setTrollerEvents((prev) => prev.filter(e => e.id !== event.id))}
          />
        ))}

        {/* Entrance Effects with Full Animations and Overlays */}
        {entranceEffects.filter((e) => e.role === 'officer' || e.role === 'vip' || e.role === 'donor').map((entrance) => (
          <FullScreenEntrance
            key={entrance.id}
            username={entrance.username}
            role={entrance.role}
            profile={broadcaster}
            onComplete={() => setEntranceEffects((prev) => prev.filter((e) => e.id !== entrance.id))}
          />
        ))}
        {entranceEffects.filter((e) => e.role === 'troller').map((entrance) => (
          <TrollerEntrance
            key={entrance.id}
            username={entrance.username}
            onComplete={() => setEntranceEffects((prev) => prev.filter((e) => e.id !== entrance.id))}
          />
        ))}
        {/* Regular entrance effects with animations */}
        {entranceEffects.filter((e) => e.role === 'viewer' && e.effectType && e.effectType !== 'default').map((entrance) => (
          <FullScreenEntrance
            key={entrance.id}
            username={entrance.username}
            role={entrance.role}
            profile={broadcaster}
            onComplete={() => setEntranceEffects((prev) => prev.filter((e) => e.id !== entrance.id))}
          />
        ))}

        {/* Troll Walking */}
        <TrollWalking
          streamId={streamId}
          userId={user?.id}
          onCaught={(coins) => toast.success(`Troll caught! +${coins} coins`)}
        />

        {/* Troll Catch */}
        <TrollCatch
          streamId={streamId}
          userId={user?.id}
          onCatch={(coins) => {
            setEmojiRainTrigger({ type: 'troll', timestamp: Date.now() })
            toast.success(`You caught the Troll! 🪙 +${coins} coins`)
          }}
        />

        {/* Emoji Rain */}
        <TrollRain trigger={emojiRainTrigger} />

        {/* Reaction & Gift Overlays */}
        <ReactionBubbles streamId={streamId} />
        <StreamReactions streamId={streamId} onReaction={(type, userId) => {
          setActiveReactions((prev) => [...prev.slice(-9), { type, userId, timestamp: Date.now() }])
        }} />
      </div>

      {/* Main Content Container */}
      <div className="flex flex-col w-full max-w-[1200px] mx-auto gap-2">
        {/* VIDEO AREA - Grid Layout */}
        <div className={`grid grid-cols-4 gap-2 ${neonPulse ? 'animate-neon-pulse' : ''}`}>
          {/* Host box: spans 2 rows, 2 cols */}
          <div className="col-span-2 row-span-2 h-[500px] bg-black rounded-xl overflow-hidden relative">
            {hostParticipant ? (
              <VideoBox 
                participant={hostParticipant} 
                size="full" 
                label="Host" 
                isHost={true}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-black">
                <video 
                  ref={hostVideoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                  muted={isHost}
                />
                {joining && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-30">
                    <Radio className="w-12 h-12 text-purple-400 animate-pulse" />
                    <p className="mt-2 text-sm">Connecting to live stream...</p>
                  </div>
                )}
              </div>
            )}
            
            {/* TopBar overlay on host video */}
            <div className="absolute top-0 left-0 right-0 z-10">
              <TopBar
                streamId={streamId}
                room={client.current} 
                streamerId={stream?.broadcaster_id || null} 
                popularity={popularity}
                trollFrequency={trollFrequency}
              />
            </div>

            {/* Viewer Count */}
            <div className="absolute top-2 right-4 bg-black/50 px-3 py-1 rounded text-white text-sm z-10">
              👁️ {viewerCount} watching
            </div>

            {/* Interaction Panel - Bottom Right */}
            <div className="absolute bottom-4 right-4 z-10 pointer-events-auto">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    e.nativeEvent.stopImmediatePropagation()
                    try {
                      await sendReaction('heart')
                    } catch (error) {
                      console.error('Heart reaction error:', error)
                    }
                    return false
                  }}
                  className="p-3 bg-black/50 hover:bg-black/70 rounded-full backdrop-blur-md border border-purple-500/30 transition-all hover:scale-110 active:scale-95"
                  title="Send Heart"
                >
                  <span className="text-2xl">❤️</span>
                </button>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    e.nativeEvent.stopImmediatePropagation()
                    try {
                      await sendReaction('troll')
                    } catch (error) {
                      console.error('Troll reaction error:', error)
                    }
                    return false
                  }}
                  className="p-3 bg-black/50 hover:bg-black/70 rounded-full backdrop-blur-md border border-purple-500/30 transition-all hover:scale-110 active:scale-95"
                  title="Send Troll (Reduces Popularity)"
                >
                  <span className="text-2xl">🧌</span>
                </button>
              </div>
            </div>
          </div>

          {/* Guest spots - Right side, up to 4 */}
          {guestSlots.slice(0, 4).map((guest, i) => {
            const participant = guest as any
            return (
              <div key={participant.identity || i} className="col-span-2 h-[240px] bg-black rounded-xl overflow-hidden">
                <VideoBox 
                  participant={participant} 
                  size="medium" 
                  label={`Guest ${i+1}`}
                />
              </div>
            )
          })}
          
          {/* Empty guest slots */}
          {[...Array(Math.max(0, 4 - guestSlots.length))].map((_, i) => (
            <div key={`empty-${i}`} className="col-span-2 h-[240px] bg-black/50 rounded-xl border border-gray-700 flex items-center justify-center">
              <button
                onClick={() => {
                  const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=true`
                  navigator.clipboard.writeText(inviteUrl).then(() => toast.success('Invite link copied!'))
                }}
                className="text-gray-400 hover:text-white text-sm"
              >
                + Invite Guest
              </button>
            </div>
          ))}
        </div>

        {/* CHAT + GIFT BAR BELOW VIDEOS */}
        <div className="flex flex-row gap-2">
          {/* Chat area */}
          <div className="flex-1 bg-zinc-900 rounded-xl h-[300px] p-2 overflow-hidden flex flex-col">
            <ChatWindow streamId={streamId} />
          </div>

          {/* Gift bar vertical */}
          <div className="w-[160px] flex flex-col gap-2">
            {stream?.broadcaster_id && streamId && (
              <SendGiftModal
                isOpen={showGiftModal}
                onClose={() => {
                  setShowGiftModal(false)
                  setGiftTarget(null)
                }}
                streamerId={stream.broadcaster_id}
                streamId={streamId}
                inline={true}
                activeBattleId={activeBattle?.id || null}
                onBonusAwarded={(bonus) => {
                  setGiftBonus(bonus)
                  setGiftBonusTrigger(true)
                  setTimeout(() => {
                    setGiftBonusTrigger(false)
                    setGiftBonus(null)
                  }, 4000)
                }}
              />
            )}
            {!showGiftModal && stream?.broadcaster_id && (
              <button
                type="button"
                onClick={() => {
                  setGiftTarget(stream.broadcaster_id)
                  setShowGiftModal(true)
                }}
                className="w-full h-full min-h-[300px] bg-purple-600 hover:bg-purple-700 rounded-xl flex items-center justify-center text-white font-semibold transition-colors"
              >
                <div className="text-center">
                  <span className="text-4xl mb-2 block">🎁</span>
                  <span>Send Gift</span>
                </div>
              </button>
            )}
          </div>
        </div>

      {/* Loading state */}
      {joining && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-30">
          <Radio className="w-12 h-12 text-purple-400 animate-pulse" />
          <p className="mt-2 text-sm">Connecting to live stream...</p>
        </div>
      )}

      {/* Right: Guest Panel (26% width) - Legacy layout */}
        <div className="guest-sidebar guest-panel">
          {guestSlots.map((guest, i) => {
            const participant = guest as any
            return (
              <GuestSlot key={participant.identity || i} participant={participant} index={i + 1} isHost={isHost} />
            )
          })}
          {[...Array(4 - guestSlots.length)].map((_, i) => (
            <GuestSlot key={`empty-${i}`} index={guestSlots.length + i + 1} onInvite={() => {
              const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=true`
              navigator.clipboard.writeText(inviteUrl).then(() => toast.success('Invite link copied!'))
            }} />
          ))}

          {/* Gift Box - Show for both broadcaster and viewer (broadcaster can see gifts being sent) */}
          {stream?.broadcaster_id && (
            <div className="gift-box-container">
              <GiftBoxButton
                onClick={() => {
                  if (!isHost) {
                    setGiftTarget(stream.broadcaster_id)
                    setShowGiftModal(true)
                  }
                }}
              />
            </div>
          )}

          {/* Gift Modal - Renders inline in the black area below gift box */}
          {!isHost && stream?.broadcaster_id && showGiftModal && giftTarget && streamId && (
            <div className="gift-modal-inline bg-gray-900/95 rounded-xl border-2 border-purple-400/50 p-4 overflow-y-auto max-h-[calc(100vh-500px)]">
              <SendGiftModal
                isOpen={showGiftModal}
                onClose={() => {
                  setShowGiftModal(false)
                  setGiftTarget(null)
                }}
                streamerId={giftTarget}
                streamId={streamId}
                inline={true}
                activeBattleId={activeBattle?.id || null}
                onBonusAwarded={(bonus) => {
                  setGiftBonus(bonus)
                  setGiftBonusTrigger(true)
                  setTimeout(() => {
                    setGiftBonusTrigger(false)
                    setGiftBonus(null)
                  }, 4000)
                }}
              />
            </div>
          )}

          {/* Chat Box - Entrance Events Only (No duplicate input) - Only show when gift modal is closed */}
          {(!showGiftModal || isHost) && (
            <div className="chat-box">
              <div className="chat-messages">
                <EntranceChatPanel streamId={streamId} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Controls */}
      {client.current && (
        <StreamControls
          isCameraEnabled={isCameraEnabled}
          isMicrophoneEnabled={isMicrophoneEnabled}
          isHost={isHost}
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
          onInviteGuest={() => {
            const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=true`
            navigator.clipboard.writeText(inviteUrl).then(() => toast.success('Invite link copied!'))
          }}
          onEndStream={endStreamAsBroadcaster}
          onGiftClick={!isHost && stream?.broadcaster_id ? () => {
            setGiftTarget(stream.broadcaster_id)
            setShowGiftModal(true)
          } : undefined}
          onStartBattle={isHost && stream?.id ? () => setShowStartBattleModal(true) : undefined}
        />
      )}

      {/* Battle Chat Overlay */}
      {streamId && (
        <BattleChatOverlay
          streamId={streamId}
          battleId={activeBattle?.id || null}
        />
      )}

      {/* Red/Green Troll Event Overlay */}
      {streamId && user && (
        <TrollEventOverlay
          streamId={streamId}
          userJoinedAt={userJoinedAt}
        />
      )}

      {/* Birthday Overlay - Show when broadcaster's birthday is today */}
      {broadcaster && (broadcaster as any)?.date_of_birth && isBirthdayToday((broadcaster as any).date_of_birth) && (
        <BirthdayOverlay username={broadcaster.username || 'Streamer'} />
      )}

      {/* Battle Scoreboard */}
      {activeBattle && (
        <BattleScoreboard
          hostTotal={hostGiftTotal}
          opponentTotal={opponentGiftTotal}
          hostUsername={streamParticipants.find(p => p.role === 'host')?.userProfile?.username || 'Host'}
          opponentUsername={streamParticipants.find(p => p.role === 'opponent')?.userProfile?.username || 'Opponent'}
          timeRemaining={battleTimeRemaining}
        />
      )}

      {/* Legacy Battle Arena - Keep for backward compatibility */}
      {activeBattle && streamId && user && false && (
        <div className="fixed inset-0 z-50 bg-black">
          <TrollBattleArena
            battleId={activeBattle.id}
            hostUsername={broadcaster?.username || 'Host'}
            challengerUsername={activeBattle.challenger_id === user.id ? profile?.username || 'Challenger' : 'Challenger'}
            isHost={activeBattle.host_id === user.id}
          />
        </div>
      )}

      {/* Start Battle Modal */}
      {isHost && streamId && (
        <StartBattleModal
          isOpen={showStartBattleModal}
          onClose={() => setShowStartBattleModal(false)}
          onBattleStarted={(battleId) => {
            setShowStartBattleModal(false)
            // Battle will be picked up by the useEffect subscription
          }}
          currentStreamId={streamId}
        />
      )}

      {/* Battle Winner Modal */}
      {battleWinner && (
        <BattleWinnerModal
          isOpen={showBattleWinnerModal}
          onClose={() => {
            setShowBattleWinnerModal(false)
            setBattleWinner(null)
          }}
          winnerId={battleWinner.winnerId}
          broadcaster1Id={activeBattle?.broadcaster_1_id || ''}
          broadcaster2Id={activeBattle?.broadcaster_2_id || ''}
          broadcaster1Coins={battleWinner.broadcaster1Coins}
          broadcaster2Coins={battleWinner.broadcaster2Coins}
          broadcaster1Name={battleWinner.broadcaster1Name}
          broadcaster2Name={battleWinner.broadcaster2Name}
        />
      )}

      {/* Gift Modal - Updated with participant targeting */}
      {showGiftModal && giftTarget && streamId && (
        <SendGiftModal
          isOpen={showGiftModal}
          onClose={() => {
            setShowGiftModal(false)
            setGiftTarget(null)
          }}
          streamerId={giftTarget}
          streamId={streamId}
          inline={false}
          activeBattleId={activeBattle?.id || null}
          participants={streamParticipants}
          defaultTargetId={giftTarget}
          onBonusAwarded={(bonus) => {
            setGiftBonus(bonus)
            setGiftBonusTrigger(true)
            setTimeout(() => {
              setGiftBonusTrigger(false)
              setGiftBonus(null)
            }, 4000)
          }}
        />
      )}

      {/* Moderation Menu - Only visible to officers */}
      {isOfficer && modMenuTarget && (
        <ModerationMenu
          target={modMenuTarget}
          streamId={streamId}
          onClose={() => setModMenuTarget(null)}
          onActionComplete={() => {
            // Refresh data after action
            loadStreamData()
          }}
        />
      )}
    </div>
  )
}

export default StreamRoom
