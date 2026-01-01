import {
  Room,
  RoomEvent,
  LocalVideoTrack,
  LocalAudioTrack,
  createLocalVideoTrack,
  createLocalAudioTrack,
} from 'livekit-client'
import { LIVEKIT_URL, defaultLiveKitOptions } from './LiveKitConfig'
import { toast } from 'sonner'

export interface LiveKitParticipant {
  identity: string
  name?: string
  isLocal: boolean
  // IMPORTANT: your UI expects participant.videoTrack.track
  videoTrack?: { track: any } // LocalVideoTrack | RemoteVideoTrack
  audioTrack?: { track: any } // LocalAudioTrack | RemoteAudioTrack
  isCameraEnabled: boolean
  isMicrophoneEnabled: boolean
  isMuted: boolean
  metadata?: string
}

export interface LiveKitServiceConfig {
  roomName: string
  identity: string
  user?: any
  role?: string
  onConnected?: () => void
  onDisconnected?: () => void
  onParticipantJoined?: (participant: LiveKitParticipant) => void
  onParticipantLeft?: (participant: LiveKitParticipant) => void
  onTrackSubscribed?: (track: any, participant: LiveKitParticipant) => void
  onTrackUnsubscribed?: (track: any, participant: LiveKitParticipant) => void
  onError?: (error: string) => void
  allowPublish?: boolean // Whether to allow publishing camera/mic
  preflightStream?: MediaStream
  autoPublish?: boolean
  tokenOverride?: string // For testing or special cases
}

export class LiveKitService {
  private room: Room | null = null
  private config: LiveKitServiceConfig
  private participants: Map<string, LiveKitParticipant> = new Map()
  private localVideoTrack: LocalVideoTrack | null = null
  private localAudioTrack: LocalAudioTrack | null = null
  private preflightStream?: MediaStream
  private isConnecting = false
  private lastConnectionError: string | null = null

  constructor(config: LiveKitServiceConfig) {
    this.config = config
    this.preflightStream = config.preflightStream
    console.log('[LiveKitService created]', Date.now())
    this.log('LiveKitService initialized', {
      roomName: config.roomName,
      identity: config.identity,
      userId: config.user?.id,
      allowPublish: config.allowPublish,
      role: config.role || config.user?.role,
    })
  }

  /* =========================
     PUBLISH GUARDS
  ========================= */

  private isPublishing(): boolean {
    if (!this.room?.localParticipant) return false
    return (
      this.room.localParticipant.videoTrackPublications.size > 0 ||
      this.room.localParticipant.audioTrackPublications.size > 0
    )
  }

  private hasLocalTracks(): boolean {
    return !!this.localVideoTrack || !!this.localAudioTrack
  }

  private canPublish(): boolean {
    return this.config.allowPublish === true
  }

  /* =========================
     Main connection method
  ========================= */

  async connect(tokenOverride?: string): Promise<boolean> {
    // Hard guard: prevent multiple connections
    if (this.room || this.isConnecting) {
      this.log('Already connected or connecting')
      return true
    }

    this.isConnecting = true
    this.log('Starting connection process...', {
      allowPublish: this.config.allowPublish,
      role: this.config.role || this.config.user?.role,
    })

    try {
      // ✅ Fix #1: Try to get session from store first (fast, no network call)
      this.log('Getting session...')
      const { supabase } = await import('./supabase')
      const { useAuthStore } = await import('./store')
      
      // First, try to use cached session from store (instant, no timeout)
      const storeSession = useAuthStore.getState().session as any
      let sessionData: any
      
      if (storeSession?.access_token) {
        // Check if token is still valid (not expired)
        const expiresAt = storeSession.expires_at
        const now = Math.floor(Date.now() / 1000)
        const isExpired = expiresAt && expiresAt < now + 60 // Expired or expiring in < 60s
        
        if (!isExpired) {
          this.log('✅ Using cached session from store', {
            hasToken: !!storeSession.access_token,
            tokenLength: storeSession.access_token?.length,
            expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : 'unknown'
          })
          
          // Start background refresh for next time
          supabase.auth.refreshSession().catch(() => {
            // Silent fail - we have a valid session
          })
          
          // Use the cached session - set sessionData here
          sessionData = { data: { session: storeSession }, error: null }
        } else {
          this.log('⚠️ Cached session expired, refreshing from Supabase...')
          // Fall through to get from Supabase
        }
      }
      
      // If no valid cached session, get from Supabase (with timeout)
      if (!sessionData) {
        // Start refresh in background (non-blocking)
        this.log('Starting session refresh (non-blocking)...')
        const refreshPromise = supabase.auth.refreshSession().catch((err: any) => {
          // Silently handle refresh errors - we'll use current session anyway
          this.log('⚠️ Background session refresh failed (non-fatal)', err?.message || err)
        })
        
        // Get current session with timeout to prevent hanging
        this.log('Getting session from Supabase...')
        const getSessionWithTimeout = Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: any; error: any }>((_, reject) => 
            setTimeout(() => reject(new Error('Get session timeout')), 5000)
          )
        ])
        
        try {
          sessionData = await getSessionWithTimeout
        } catch (getSessionErr: any) {
          // If getSession times out, try one more time after a brief wait for refresh
          this.log('⚠️ Get session timeout, waiting briefly for refresh...')
          await Promise.race([
            refreshPromise,
            new Promise(resolve => setTimeout(resolve, 1000))
          ])
          
          // Try getSession one more time with timeout
          const retryGetSession = Promise.race([
            supabase.auth.getSession(),
            new Promise<{ data: any; error: any }>((_, reject) => 
              setTimeout(() => reject(new Error('Get session retry timeout')), 3000)
            )
          ])
          
          try {
            sessionData = await retryGetSession
          } catch (retryErr: any) {
            this.log('❌ Get session failed after retry', retryErr?.message || retryErr)
            // Last resort: try store session even if expired
            if (storeSession?.access_token) {
              this.log('⚠️ Using expired store session as fallback')
              sessionData = { data: { session: storeSession }, error: null }
            } else {
              throw new Error('Failed to get session. Please try refreshing the page.')
            }
          }
        }
      }
      
      // At this point, sessionData should be set (either from store or Supabase)
      if (!sessionData) {
        throw new Error('Failed to get session. Please try refreshing the page.')
      }
      
      const { data, error: getSessionError } = sessionData
      
      if (getSessionError) {
        this.log('❌ Get session error', getSessionError.message)
        throw new Error(`Session error: ${getSessionError.message}`)
      }
      
      if (!data.session?.access_token) {
        this.log('❌ No session or access token')
        throw new Error('No active session. Please sign in again.')
      }
      
      this.log('✅ Session ready', { 
        hasToken: !!data.session.access_token,
        tokenLength: data.session.access_token?.length 
      })

      // Step 1: Get LiveKit token (unless overridden)
      let token: string | undefined = undefined
      if (tokenOverride) {
        this.log('Using token override')
        token = tokenOverride
      } else {
        this.log('Requesting LiveKit token...')
        try {
          const tokenResponse = await this.getToken()
          if (!tokenResponse?.token) {
            throw new Error('Failed to get LiveKit token')
          }
          token = tokenResponse.token
          this.log('✅ LiveKit token received', { tokenLength: token.length })
        } catch (tokenError: any) {
          this.log('❌ Token request failed:', tokenError?.message || tokenError)
          throw new Error(`Failed to get LiveKit token: ${tokenError?.message || 'Unknown error'}`)
        }
      }

      // Runtime invariant: ensure token is valid string
      if (typeof token !== 'string') {
        console.error('🚨 LiveKit token is NOT a string', token)
        throw new Error('Invalid LiveKit token type')
      }

      // Trim whitespace from token (in case of extra spaces)
      token = token.trim()

      // Validate token format (JWT should start with 'eyJ' which is base64 for '{"')
      if (!token || token.length === 0) {
        console.error('🚨 LiveKit token is empty', { tokenLength: token?.length })
        throw new Error('Invalid LiveKit token format: token is empty')
      }

      if (!token.startsWith('eyJ')) {
        console.error('🚨 LiveKit token is not JWT format', { 
          tokenPreview: token.substring(0, 50),
          tokenLength: token.length,
          firstChars: token.substring(0, 10),
          startsWithEyJ: token.startsWith('eyJ')
        })
        throw new Error(`Invalid LiveKit token format: expected JWT starting with 'eyJ', got '${token.substring(0, 20)}...'`)
      }

      // Debug: log token length and decoded payload for troubleshooting publish permissions
      try {
        this.log('🔐 LiveKit token length', { length: token.length })
        const parts = token.split('.')
        if (parts.length >= 2) {
          const payload = JSON.parse(decodeURIComponent(escape(atob(parts[1]))))
          this.log('🔐 LiveKit token payload', payload)
          // Helpful quick fields
          this.log('🔐 Token room/canPublish', {
            tokenRoom: payload?.room ?? payload?.r ?? null,
            canPublish: payload?.allowPublish ?? payload?.canPublish ?? null,
          })
        } else {
          this.log('🔐 LiveKit token (raw preview)', typeof token === 'string' ? token.substring(0, 60) + '...' : 'N/A')
        }
      } catch (e) {
        this.log('🔐 Failed to decode LiveKit token payload', e?.message || e)
      }

      // Step 2: Create room with configuration
      this.room = new Room({
        ...defaultLiveKitOptions,
      })

      // Step 3: Set up event listeners BEFORE connecting
      this.setupEventListeners()

      // Step 4: Connect to room
      this.log('Connecting to LiveKit room...', { LIVEKIT_URL, roomName: this.config.roomName, identity: this.config.identity })

      // ✅ 2) Before room.connect:
      console.log("[useLiveKitSession] about to connect", { url: LIVEKIT_URL, roomName: this.config.roomName, identity: this.config.identity, tokenLen: token?.length })

      // Fallback check: LIVEKIT_URL should be a secure websocket endpoint
      if (typeof LIVEKIT_URL === 'string' && !LIVEKIT_URL.startsWith('wss://')) {
        console.error('LIVEKIT_URL does not start with wss:// — blocking connect', LIVEKIT_URL)
        toast.error('LiveKit connection failed: check LIVEKIT_URL, token, or server availability')
        this.isConnecting = false
        return false
      }

      try {
        await this.room.connect(LIVEKIT_URL, token)
        console.log("[useLiveKitSession] ✅ Connected successfully")
        
        // Ensure local participant exists in map as soon as we connect
        this.updateLocalParticipantState()

        // ✅ Hydrate participants already in the room
        this.hydrateExistingRemoteParticipants()

        // Publishing is handled by the caller/session hook to avoid duplicate preflight publishes.
        if (!this.canPublish()) {
          this.log('Viewer mode detected - publishing blocked')
        } else {
          this.log('✅ Connected. Publishing handled by caller/session hook.')
        }

        this.log('✅ Connection successful')
        this.config.onConnected?.()
        this.isConnecting = false
        return true
      } catch (err: any) {
        const errorMsg = err?.message || String(err) || 'Failed to connect to LiveKit room'
        this.lastConnectionError = errorMsg
        
        console.error("[LiveKitService] connect failed", err)
        console.error("[LiveKitService] Connection error details:", {
          message: err?.message,
          name: err?.name,
          stack: err?.stack,
          code: err?.code,
          url: LIVEKIT_URL,
          roomName: this.config.roomName,
          identity: this.config.identity,
          tokenLength: token?.length,
          tokenPreview: token && typeof token === 'string' ? `${token.substring(0, 50)}...` : 'NO TOKEN'
        })
        this.log('❌ Connection failed with error:', errorMsg)
        this.config.onError?.(errorMsg)
        this.isConnecting = false
        return false
      }
    } catch (error: any) {
      const errorMsg = error?.message || String(error) || 'Failed to connect'
      this.lastConnectionError = errorMsg
      
      console.error('❌ LiveKitService.connect failed FULL error:', error)

      this.log('❌ Connection failed:', errorMsg)

      this.config.onError?.(errorMsg)
      this.isConnecting = false
      return false
    }
  }

  private hydrateExistingRemoteParticipants(): void {
    if (!this.room) return

    this.room.remoteParticipants.forEach((participant: any) => {
      if (this.participants.has(participant.identity)) return

      const liveKitParticipant: LiveKitParticipant = {
        identity: participant.identity,
        name: participant.name || participant.identity,
        isLocal: false,
        isCameraEnabled: participant.isCameraEnabled,
        isMicrophoneEnabled: participant.isMicrophoneEnabled,
        isMuted: !participant.isMicrophoneEnabled,
        metadata: participant.metadata,
      }

      this.participants.set(participant.identity, liveKitParticipant)
      this.config.onParticipantJoined?.(liveKitParticipant)
    })
  }

  private async publishMediaStream(stream: MediaStream): Promise<void> {
    if (!this.room?.localParticipant) throw new Error('Room not connected')
    if (!this.canPublish()) throw new Error('Publishing not allowed for this user')

    this.log('📹 Publishing preflight stream', {
      streamActive: stream.active,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    })

    const videoTrack = stream.getVideoTracks()[0]
    const audioTrack = stream.getAudioTracks()[0]

    if (!videoTrack && !audioTrack) {
      throw new Error('No video or audio track available from preflight stream')
    }

    if (videoTrack) {
      this.log('📹 Publishing video track', {
        enabled: videoTrack.enabled,
        readyState: videoTrack.readyState,
        label: videoTrack.label
      })
      this.localVideoTrack = new LocalVideoTrack(videoTrack)
      await this.room.localParticipant.publishTrack(this.localVideoTrack as any)
      this.log('✅ Video track published')
    } else {
      this.log('⚠️ No video track in preflight stream')
    }

    if (audioTrack) {
      this.log('🎤 Publishing audio track', {
        enabled: audioTrack.enabled,
        readyState: audioTrack.readyState,
        label: audioTrack.label
      })
      this.localAudioTrack = new LocalAudioTrack(audioTrack)
      await this.room.localParticipant.publishTrack(this.localAudioTrack as any)
      this.log('✅ Audio track published')
    } else {
      this.log('⚠️ No audio track in preflight stream')
    }

    this.updateLocalParticipantState()
    this.log('✅ Preflight stream published successfully')
  }

  private async captureVideoTrack(): Promise<LocalVideoTrack | null> {
    try {
      const track = await createLocalVideoTrack({
        resolution: { width: 1280, height: 720 },
        frameRate: { ideal: 30, max: 60 },
      } as any)
      return track
    } catch (error: any) {
      throw new Error(`Camera access failed: ${error.message}`)
    }
  }

  private async captureAudioTrack(): Promise<LocalAudioTrack | null> {
    try {
      const track = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } as any)
      return track
    } catch (error: any) {
      throw new Error(`Microphone access failed: ${error.message}`)
    }
  }

  private updateLocalParticipantState(): void {
    if (!this.room?.localParticipant) return

    const p = this.room.localParticipant
    const videoPub = Array.from(p.videoTrackPublications.values())[0]
    const audioPub = Array.from(p.audioTrackPublications.values())[0]

    const videoTrack = videoPub?.track || this.localVideoTrack
    const audioTrack = audioPub?.track || this.localAudioTrack

    const localParticipant: LiveKitParticipant = {
      identity: p.identity,
      name: this.config.user?.username || this.config.user?.email || 'You',
      isLocal: true,
      videoTrack: videoTrack ? { track: videoTrack } : undefined,
      audioTrack: audioTrack ? { track: audioTrack } : undefined,
      isCameraEnabled: p.isCameraEnabled,
      isMicrophoneEnabled: p.isMicrophoneEnabled,
      isMuted: !p.isMicrophoneEnabled,
      metadata: p.metadata,
    }

    this.participants.set(localParticipant.identity, localParticipant)
  }

  private setupEventListeners(): void {
    if (!this.room) return

    this.room.on(RoomEvent.Connected, () => {
      this.log('📡 Room connected')
      this.isConnecting = false
      this.updateLocalParticipantState()
      this.hydrateExistingRemoteParticipants()
    })

    this.room.on(RoomEvent.Disconnected, () => {
      this.log('📡 Room disconnected')
      this.cleanup()
      this.config.onDisconnected?.()
    })

    this.room.on(RoomEvent.ParticipantConnected, (participant: any) => {
      this.log('👤 Participant joined:', participant.identity)

      const liveKitParticipant: LiveKitParticipant = {
        identity: participant.identity,
        name: participant.name || participant.identity,
        isLocal: false,
        isCameraEnabled: participant.isCameraEnabled,
        isMicrophoneEnabled: participant.isMicrophoneEnabled,
        isMuted: !participant.isMicrophoneEnabled,
        metadata: participant.metadata,
      }

      this.participants.set(participant.identity, liveKitParticipant)
      this.config.onParticipantJoined?.(liveKitParticipant)
    })

    this.room.on(RoomEvent.ParticipantDisconnected, (participant: any) => {
      this.log('👤 Participant left:', participant.identity)
      const liveKitParticipant = this.participants.get(participant.identity)
      if (liveKitParticipant) {
        this.participants.delete(participant.identity)
        this.config.onParticipantLeft?.(liveKitParticipant)
      }
    })

    this.room.on(RoomEvent.TrackSubscribed, (track: any, publication: any, participant: any) => {
      this.log('📥 Track subscribed:', track.kind, participant.identity)
      const liveKitParticipant = this.participants.get(participant.identity)
      if (liveKitParticipant) {
        if (track.kind === 'video') liveKitParticipant.videoTrack = { track }
        if (track.kind === 'audio') liveKitParticipant.audioTrack = { track }
        liveKitParticipant.metadata = participant.metadata
        this.config.onTrackSubscribed?.(track, liveKitParticipant)
      }
    })

    this.room.on(RoomEvent.TrackUnsubscribed, (track: any, publication: any, participant: any) => {
      this.log('📤 Track unsubscribed:', track.kind, participant.identity)
      const liveKitParticipant = this.participants.get(participant.identity)
      if (liveKitParticipant) {
        if (track.kind === 'video') liveKitParticipant.videoTrack = undefined
        if (track.kind === 'audio') liveKitParticipant.audioTrack = undefined
        this.config.onTrackUnsubscribed?.(track, liveKitParticipant)
      }
    })
  }

  private async getToken(): Promise<any> {
    if ((this.config as any).token) {
      return { token: (this.config as any).token }
    }

    if (!this.config.identity) throw new Error('Identity is required for LiveKit token')

    try {
      // ✅ Only publish tokens when allowPublish === true (hard safety)
      const allowPublish = this.config.allowPublish === true

      // Normalize role: treat internal "admin" as "broadcaster" for LiveKit token requests
      let roleToSend = this.config.role || this.config.user?.role || 'viewer'
      if (roleToSend === 'admin') roleToSend = 'broadcaster'

      const requestBody = {
        room: this.config.roomName,
        identity: this.config.identity,
        user_id: this.config.user?.id,
        role: roleToSend,
        level: this.config.user?.level || 1,
        allowPublish,
      }

      this.log('🔑 Requesting LiveKit token...', {
        endpoint: '/livekit-token',
        body: requestBody,
        allowPublish,
        userId: this.config.user?.id,
        hasUser: !!this.config.user
      })

      // Developer debug: show exact function payload
      console.log('🟣 getToken() request payload:', {
        room: this.config.roomName,
        identity: this.config.identity,
        allowPublish: this.config.allowPublish,
      })

      // ✅ Fix #2: Always pass Authorization to the token endpoint
      // Get session from store first, then refresh to ensure it's valid
      const { useAuthStore } = await import('./store')
      const { supabase } = await import('./supabase')
      
      let session = useAuthStore.getState().session as any
      
      // Always refresh session before token request to ensure it's valid on server
      this.log('🔑 Refreshing session before token request...')
      try {
        // Refresh session with timeout
        const refreshPromise = supabase.auth.refreshSession()
        const refreshWithTimeout = Promise.race([
          refreshPromise,
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error('Session refresh timeout')), 5000)
          )
        ])
        
        const { data: refreshData, error: refreshError } = await refreshWithTimeout as any
        
        if (refreshError) {
          this.log('⚠️ Session refresh error (non-fatal):', refreshError.message)
          // Continue with existing session if refresh fails
        } else if (refreshData?.session) {
          session = refreshData.session
          this.log('✅ Session refreshed successfully')
        }
      } catch (refreshErr: any) {
        this.log('⚠️ Session refresh timeout/error (non-fatal):', refreshErr?.message)
        // Continue with existing session
      }
      
      // If still no session, try to get from Supabase
      if (!session?.access_token) {
        this.log('🔑 No session in store, getting from Supabase...')
        try {
          const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
          if (sessionErr || !sessionData.session) {
            throw new Error('No active session')
          }
          session = sessionData.session
        } catch (sessionErr: any) {
          this.log('❌ Failed to get session:', sessionErr?.message)
          throw new Error('No active session. Please sign in again.')
        }
      }
      
      // Check if session is expired
      const now = Math.floor(Date.now() / 1000)
      if (session.expires_at && session.expires_at < now + 60) {
        this.log('⚠️ Session expiring soon, attempting refresh...')
        try {
          const { data: refreshData } = await supabase.auth.refreshSession()
          if (refreshData?.session) {
            session = refreshData.session
            this.log('✅ Session refreshed')
          }
        } catch (e) {
          this.log('⚠️ Failed to refresh expiring session:', e)
        }
      }
      
      if (!session?.access_token) {
        throw new Error('No active session. Please sign in again.')
      }

      this.log('🔑 Session validated, making API request...', {
        hasToken: !!session.access_token,
        tokenLength: session.access_token.length,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'unknown',
        expiresIn: session.expires_at ? `${session.expires_at - now}s` : 'unknown'
      })

      // Call external token endpoint (Vercel API route)
      const vercelTokenUrl = import.meta.env.VITE_LIVEKIT_TOKEN_URL;
      const edgeBase = import.meta.env.VITE_EDGE_FUNCTIONS_URL; // supabase base
      const edgeTokenUrl = edgeBase ? `${edgeBase}/livekit-token` : null;

      const tokenUrl = vercelTokenUrl || edgeTokenUrl || "/api/livekit-token";
      console.log("🔥 LiveKit tokenUrl selected:", tokenUrl);

      const accessToken = session.access_token

      this.log('🔑 Making fetch request to token endpoint...', { tokenUrl })

      // Add timeout to fetch request to prevent hanging
      const fetchWithTimeout = Promise.race([
        fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            room: this.config.roomName,
            identity: this.config.identity,
            user_id: this.config.user?.id,
            role: this.config.role || this.config.user?.role || 'viewer',
            level: this.config.user?.level || 1,
            allowPublish: this.config.allowPublish !== false,
          }),
        }),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('Token request timeout after 10s')), 10000)
        )
      ])

      const resp = await fetchWithTimeout

      // ✅ 1) In your token fetch code:
      this.log('🔑 Token endpoint response received', { 
        status: resp.status, 
        statusText: resp.statusText,
        ok: resp.ok 
      })
      console.log("[useLiveKitSession] token response:", resp)

      const json = await resp.json()
      console.log("[useLiveKitSession] token json:", json)
      console.log("[useLiveKitSession] token json keys:", Object.keys(json || {}))
      console.log("[useLiveKitSession] json.token type:", typeof json?.token)
      console.log("[useLiveKitSession] json.token value:", json?.token)

      if (!resp.ok) {
        this.log('🔑 Token endpoint returned error', { status: resp.status, body: json })
        const msg = json?.error || json?.message || `Token endpoint error ${resp.status}`
        throw new Error(msg)
      }

      // Extract token from response (handle both { token: "..." } and { data: { token: "..." } } formats)
      let token = json.token || json.data?.token

      // Validate token exists
      if (!token) {
        this.log('❌ No token in endpoint response', { 
          json, 
          hasToken: !!json.token, 
          hasDataToken: !!json.data?.token,
          jsonKeys: Object.keys(json || {})
        })
        throw new Error('No token returned from token endpoint')
      }

      // Convert token to string if it's not already (handle edge cases)
      if (typeof token !== 'string') {
        // Try to convert to string
        const tokenStr = String(token)
        if (tokenStr && tokenStr !== 'undefined' && tokenStr !== 'null' && tokenStr.trim() !== '') {
          this.log('⚠️ Token was not a string, converted', { 
            originalType: typeof token,
            originalValue: token,
            convertedValue: typeof tokenStr === 'string' ? tokenStr.substring(0, 20) + '...' : 'N/A'
          })
          token = tokenStr
        } else {
          this.log('❌ Token is not a string and cannot be converted', { 
            token, 
            type: typeof token,
            tokenValue: String(token),
            jsonToken: json.token,
            jsonTokenType: typeof json.token,
            jsonData: json.data,
            fullJson: JSON.stringify(json, null, 2)
          })
          throw new Error(`Invalid token type: expected string, got ${typeof token}. Response: ${JSON.stringify(json)}`)
        }
      }

      // Trim whitespace from token
      token = token.trim()

      // Validate token format (should be a JWT starting with 'eyJ')
      if (!token.startsWith('eyJ')) {
        this.log('❌ Token does not have valid JWT format', {
          tokenPreview: token.substring(0, 50),
          tokenLength: token.length,
          firstChars: token.substring(0, 10)
        })
        throw new Error(`Invalid token format: expected JWT starting with 'eyJ', got '${token.substring(0, 20)}...'`)
      }

      this.log('✅ Token received successfully:', {
        tokenLength: token.length,
        tokenPreview: typeof token === 'string' ? token.substring(0, 20) + '...' : 'N/A',
        livekitUrl: json.livekitUrl,
        allowPublish: json.allowPublish,
      })

      return { token, livekitUrl: json.livekitUrl, allowPublish: json.allowPublish }
    } catch (error: any) {
      this.log('❌ Token fetch failed:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })

      // Provide user-friendly error messages
      if (error.message.includes('No valid user session') || error.message.includes('no active session')) {
        throw new Error('Please sign in to join the stream.')
      } else if (error.message.includes('Authentication failed') || error.message.includes('session expired')) {
        throw new Error('Your session has expired. Please sign in again.')
      } else if (error.message.includes('No token received from server')) {
        throw new Error('Server configuration error. Please try again later.')
      } else if (error.message.includes('Unable to verify user session')) {
        throw new Error('Session validation failed. Please sign in again.')
      } else if (error.message.includes('User profile not found')) {
        throw new Error('User profile not found. Please contact support.')
      }

      throw new Error(`Authentication failed: ${error.message}`)
    }
  }

  async toggleCamera(): Promise<boolean> {
    if (!this.room?.localParticipant) return false
    if (!this.canPublish()) return false

    try {
      const enabled = !this.room.localParticipant.isCameraEnabled

      if (enabled && !this.isPublishing()) {
        const video = await this.captureVideoTrack()
        if (video) {
          this.localVideoTrack = video
          await this.room.localParticipant.publishTrack(video as any)
        }
      }

      await this.room.localParticipant.setCameraEnabled(enabled)

      if (!enabled && this.localVideoTrack) {
        this.localVideoTrack.stop()
        this.localVideoTrack = null
      }

      this.updateLocalParticipantState()
      return enabled
    } catch {
      return false
    }
  }

  async toggleMicrophone(): Promise<boolean> {
    if (!this.room?.localParticipant) return false
    if (!this.canPublish()) return false

    try {
      const enabled = !this.room.localParticipant.isMicrophoneEnabled

      if (enabled && !this.isPublishing()) {
        const audio = await this.captureAudioTrack()
        if (audio) {
          this.localAudioTrack = audio
          await this.room.localParticipant.publishTrack(audio as any)
        }
      }

      await this.room.localParticipant.setMicrophoneEnabled(enabled)

      if (!enabled && this.localAudioTrack) {
        this.localAudioTrack.stop()
        this.localAudioTrack = null
      }

      this.updateLocalParticipantState()
      return enabled
    } catch {
      return false
    }
  }

  async startPublishing(): Promise<void> {
    if (!this.room || this.room.state !== 'connected') throw new Error('Room not connected')
    if (!this.canPublish()) throw new Error('Publishing not allowed for this user')
    if (this.isPublishing()) return

    // ✅ Priority 1: Use preflight stream if available (from GoLive/BroadcastPage)
    if (this.preflightStream && this.preflightStream.active) {
      this.log('📹 Using preflight stream for publishing')
      try {
        await this.publishMediaStream(this.preflightStream)
        this.log('✅ Preflight stream published successfully')
        return
      } catch (err: any) {
        this.log('⚠️ Preflight stream publish failed, falling back to capture:', err?.message)
        // Fall through to capture new tracks
      }
    }

    // ✅ Priority 2: Capture new tracks if no preflight stream
    this.log('📹 Capturing new video/audio tracks')
    const [videoTrack, audioTrack] = await Promise.all([
      this.captureVideoTrack(),
      this.captureAudioTrack(),
    ])

    this.localVideoTrack = videoTrack
    this.localAudioTrack = audioTrack

    if (videoTrack) await this.room.localParticipant.publishTrack(videoTrack as any)
    if (audioTrack) await this.room.localParticipant.publishTrack(audioTrack as any)

    await this.room.localParticipant.setCameraEnabled(!!videoTrack)
    await this.room.localParticipant.setMicrophoneEnabled(!!audioTrack)

    this.updateLocalParticipantState()
    this.log('✅ New tracks published successfully')
  }

  getRoom(): Room | null {
    return this.room
  }

  getLastConnectionError(): string | null {
    return this.lastConnectionError
  }

  getParticipants(): Map<string, LiveKitParticipant> {
    return this.participants
  }

  isConnected(): boolean {
    return this.room?.state === 'connected'
  }

  getLocalParticipant(): LiveKitParticipant | null {
    if (!this.room?.localParticipant) return null
    return this.participants.get(this.room.localParticipant.identity) || null
  }

  disconnect(): void {
    this.log('🔌 Disconnecting from LiveKit room...')
    if (this.room) {
      try {
        this.room.disconnect()
      } catch { }
    }
    this.cleanup()
  }

  private cleanup(): void {
    if (this.localVideoTrack) {
      try {
        this.localVideoTrack.stop()
      } catch { }
      this.localVideoTrack = null
    }

    if (this.localAudioTrack) {
      try {
        this.localAudioTrack.stop()
      } catch { }
      this.localAudioTrack = null
    }

    this.participants.clear()
    this.room = null
    this.isConnecting = false
  }

  private log(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString()
    const roomInfo = this.config.roomName ? `[${this.config.roomName}]` : ''
    console.log(`🔴 LiveKit ${timestamp} ${roomInfo} ${message}`, ...args)
  }

  destroy(): void {
    this.disconnect()
  }
}

export function createLiveKitService(config: LiveKitServiceConfig): LiveKitService {
  return new LiveKitService(config)
}
