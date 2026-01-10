import {
  Room,
  RoomEvent,
  LocalVideoTrack,
  LocalAudioTrack,
  createLocalVideoTrack,
  createLocalAudioTrack,
  Track,
} from 'livekit-client'
import { LIVEKIT_URL, defaultLiveKitOptions } from './LiveKitConfig'
import { toast } from 'sonner'

// Fix D: Audio toggle for debugging
const ENABLE_AUDIO_PUBLISH = true;

// Gold Standard: Cache LiveKit tokens per room/identity
const tokenCache = new Map<string, { token: string, expiresAt: number }>();

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
  url?: string // Custom LiveKit server URL
}

export class LiveKitService {
  private room: Room | null = null
  private config: LiveKitServiceConfig
  private participants: Map<string, LiveKitParticipant> = new Map()
  private localVideoTrack: LocalVideoTrack | null = null
  private localAudioTrack: LocalAudioTrack | null = null
  private preflightStream?: MediaStream
  private isConnecting = false
  private targetRoom: string | null = null
  private targetIdentity: string | null = null
  private lastConnectionError: string | null = null
  public publishingInProgress = false;

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

  public get roomName(): string {
    return this.config.roomName
  }

  public get identity(): string {
    return this.config.identity
  }

  private isPublishing(): boolean {
    if (!this.room?.localParticipant) return false
    return (
      this.room.localParticipant.videoTrackPublications.size > 0 ||
      this.room.localParticipant.audioTrackPublications.size > 0
    )
  }

  private isVideoPublishing(): boolean {
    if (!this.room?.localParticipant) return false
    return this.room.localParticipant.videoTrackPublications.size > 0
  }

  private hasLocalTracks(): boolean {
    return !!this.localVideoTrack || !!this.localAudioTrack
  }

  private canPublish(): boolean {
    return this.config.allowPublish === true
  }

  /* =========================
     Methods to Publish Tracks (Fix C)
  ========================= */
  
  async publishVideoTrack(mediaStreamTrack: MediaStreamTrack) {
     if (!this.room?.localParticipant) throw new Error('Room not connected');
     
     this.log('📹 Publishing video track directly', { label: mediaStreamTrack.label });
     
     // Modern Publishing: Let LiveKit manage the track
     await this.room.localParticipant.publishTrack(mediaStreamTrack, { name: 'camera', source: Track.Source.Camera });
     // await this.room.localParticipant.setCameraEnabled(true); // Redundant and causes LocalTrackUnpublished
     this.updateLocalParticipantState();
     this.log('✅ Video track published');
   }

  async publishAudioTrack(mediaStreamTrack: MediaStreamTrack) {
      if (!this.room?.localParticipant) throw new Error('Room not connected');
      
      // Audio Guard Logic
      if (!ENABLE_AUDIO_PUBLISH) {
         this.log('🚫 Audio publishing disabled by ENABLE_AUDIO_PUBLISH flag');
         console.warn('🚫 Audio publishing disabled by ENABLE_AUDIO_PUBLISH flag');
         return;
      }
 
      this.log('🎤 Publishing audio track directly', { label: mediaStreamTrack.label });
      
      // Modern Publishing: Let LiveKit manage the track
      await this.room.localParticipant.publishTrack(mediaStreamTrack, { name: 'microphone', source: Track.Source.Microphone });
      // await this.room.localParticipant.setMicrophoneEnabled(true); // Redundant and causes LocalTrackUnpublished
      this.updateLocalParticipantState();
      this.log('✅ Audio track published');
   }
 
   /* =========================
      Main connection method
   ========================= */

  async connect(tokenOverride?: string): Promise<boolean> {
    // Rule: Never call disconnect() if you are currently connecting to the same room/identity.
    if (this.isConnecting && this.targetRoom === this.config.roomName && this.targetIdentity === this.config.identity) {
      this.log('🛡️ Ignoring connect: already connecting to this room/identity');
      return true;
    }

    // Idempotent Connection: Disconnect existing room to prevent ghosts
    if (this.room) {
       // Guard: Don't disconnect if publishing is in progress
       if (this.publishingInProgress) {
          this.log('🚫 connect called while publishing is in progress - ignoring');
          return true;
       }

       // Fix B: Don't disconnect if already connected to the same room/user
       if (this.room.state === 'connected' && this.room.name === this.config.roomName) {
           const localId = this.room.localParticipant?.identity;
           if (localId && localId === this.config.identity) {
               this.log('♻️ Already connected to this room - skipping disconnect/reconnect');
               this.isConnecting = false;
               return true;
           }
       }

       this.log('♻️ Disconnecting existing room before new connection...');
       try {
         // Only disconnect if we have a valid room object
         if (this.room.state !== 'disconnected') {
            await this.room.disconnect();
         }
       } catch (e) {
         this.log('⚠️ Error disconnecting existing room', e);
       }
       this.room = null;
    }

    this.isConnecting = true
    this.targetRoom = this.config.roomName
    this.targetIdentity = this.config.identity

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
          
          // ✅ REMOVED: Forced background refresh (User Request #1)
          
          // Use the cached session - set sessionData here
          sessionData = { data: { session: storeSession }, error: null }
        } else {
          this.log('⚠️ Cached session expired, refreshing from Supabase...')
          // Fall through to get from Supabase
        }
      }
      
      // If no valid cached session, get from Supabase
      if (!sessionData) {
        this.log('Getting session from Supabase...')
        
        try {
           const { data } = await supabase.auth.getSession()
           
           if (data.session?.access_token) {
             sessionData = { data, error: null }
           } else {
             this.log('⚠️ No active session found, attempting refresh...')
             
             const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
             
             // Strict Session Handling: Abort if refresh fails
             if (refreshError || !refreshData.session) {
               this.log('❌ Refresh failed', refreshError)
               const msg = 'Session expired. Please sign in again.';
               this.config.onError?.(msg);
               throw new Error(msg);
             } else {
               sessionData = { data: refreshData, error: null }
             }
           }
        } catch (err: any) {
           this.log('❌ Session check failed', err)
           throw err;
        }
      }
      
      // At this point, sessionData should be set (either from store or Supabase)
      if (!sessionData) {
        throw new Error('Failed to get session. Please try refreshing the page.')
      }
      
      const { data, error: getSessionError } = sessionData
      
      if (getSessionError) {
        this.log('❌ Get session error', { message: getSessionError.message })
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
            console.error('🚨 Token response missing token field', {
              tokenResponse,
              hasToken: !!tokenResponse?.token,
              tokenResponseKeys: tokenResponse ? Object.keys(tokenResponse) : 'no response',
              fullResponse: JSON.stringify(tokenResponse, null, 2)
            })
            throw new Error('Failed to get LiveKit token: token field missing in response')
          }
          
          // ✅ STRICT VALIDATION: Ensure tokenResponse.token is a string
          if (typeof tokenResponse.token !== 'string') {
            console.error('🚨 CRITICAL: tokenResponse.token is not a string!', {
              tokenResponse,
              tokenType: typeof tokenResponse.token,
              tokenValue: tokenResponse.token,
              fullResponse: JSON.stringify(tokenResponse, null, 2)
            })
            throw new Error(`Invalid token type in response: expected string, got ${typeof tokenResponse.token}. Response: ${JSON.stringify(tokenResponse, null, 2)}`)
          }
          
          token = tokenResponse.token
          this.log('✅ LiveKit token received', {
            tokenLength: token ? token.length : 0,
            tokenType: typeof token,
            tokenIsString: typeof token === 'string'
          })
        } catch (tokenError: any) {
          this.log('❌ Token request failed:', { message: tokenError?.message || tokenError })
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
        this.log('🔐 LiveKit token length', { length: token ? token.length : 0 })
        const parts = token.split('.')
        if (parts.length >= 2) {
          const payload = JSON.parse(decodeURIComponent(escape(atob(parts[1]))))
          
          this.log('🔐 LiveKit token payload', payload)
          
          // Specific grant checks
          const videoGrant = payload?.video ?? payload?.v;
          
          this.log('🔐 Token Grants (Video/Room)', {
            // Standard LiveKit grants are in 'video' field
            videoGrant: videoGrant,
            // Check specific permissions
            room: videoGrant?.room,
            canPublish: videoGrant?.canPublish,
            canPublishSources: videoGrant?.canPublishSources,
            // Check top-level (sometimes used in custom JWTs but LiveKit standard is inside video)
            topLevelRoom: payload?.room,
            topLevelCanPublish: payload?.canPublish,
          })

          if (!videoGrant?.room) {
             console.warn('⚠️ Token missing room grant in "video" field', { payloadKeys: Object.keys(payload) });
          }
        } else {
          this.log('🔐 LiveKit token (raw preview)', typeof token === 'string' ? token.substring(0, 60) + '...' : 'N/A')
        }
      } catch (e) {
        this.log('🔐 Failed to decode LiveKit token payload', { error: (e as any)?.message || String(e) })
      }

      // Step 2: Create room with configuration
      this.room = new Room({
        ...defaultLiveKitOptions,
      })

      // Step 3: Set up event listeners BEFORE connecting
      this.setupEventListeners()
      
      // ✅ Listen for connection state changes to capture close codes
      this.room.on('connectionStateChanged', (state) => {
        this.log('📡 Connection state changed:', state)
      });

      // Step 4: Connect to room
      const targetUrl = this.config.url || LIVEKIT_URL;
      this.log('Connecting to LiveKit room...', { url: targetUrl, roomName: this.config.roomName, identity: this.config.identity })

      // ✅ STRICT VALIDATION: Ensure token is a string before passing to room.connect()
      if (typeof token !== 'string') {
        console.error('🚨 CRITICAL: Token is not a string before room.connect()!', {
          token,
          tokenType: typeof token,
          tokenValue: token,
          tokenStringified: JSON.stringify(token),
          tokenPreview: String(token).substring(0, 50)
        })
        this.log('❌ Token validation failed before connect: token is not a string', {
          token,
          tokenType: typeof token,
          fullTokenValue: JSON.stringify(token, null, 2)
        })
        throw new Error(`Invalid token type before connect: expected string, got ${typeof token}. Token value: ${JSON.stringify(token)}`)
      }

      // ✅ 2) Before room.connect:
      console.log("[useLiveKitSession] about to connect", { 
        url: targetUrl, 
        roomName: this.config.roomName, 
        identity: this.config.identity, 
        tokenLen: token?.length,
        tokenType: typeof token,
        tokenIsString: typeof token === 'string',
        tokenPreview: typeof token === 'string' ? token.substring(0, 20) + '...' : 'NOT A STRING'
      })

      try {
        // ✅ Final check: ensure token is still a string (defensive)
        if (typeof token !== 'string') {
          throw new Error(`Token became non-string before connect: ${typeof token}`)
        }
        await this.room.connect(targetUrl, token)
        console.log("[useLiveKitSession] ✅ Connected successfully")
        
        // Ensure local participant exists in map as soon as we connect
        this.updateLocalParticipantState()

        // ✅ Hydrate participants already in the room
        this.hydrateExistingRemoteParticipants()

        // ✅ Handle publishing
        if (!this.canPublish()) {
          this.log('Viewer mode detected - publishing blocked')
        } else if (this.config.autoPublish) {
          try {
            if (this.preflightStream) {
              this.log('🚀 Auto-publishing preflight stream...')
              await this.publishMediaStream(this.preflightStream)
            } else {
              this.log('🚀 Auto-publishing via setCameraEnabled/setMicrophoneEnabled...')
              await Promise.all([
                this.room.localParticipant.setCameraEnabled(true),
                this.room.localParticipant.setMicrophoneEnabled(true)
              ])
            }
          } catch (pubErr) {
             console.error('[LiveKitService] Auto-publish failed', pubErr)
             // Don't fail the connection if publish fails
          }
        } else {
          this.log('✅ Connected. Waiting for manual publish.')
        }

        this.log('✅ Connection successful')
        this.config.onConnected?.()
        this.isConnecting = false
        return true
      } catch (err: any) {
        const errorMsg = err?.message || String(err) || 'Failed to connect to LiveKit room'
        
        // 🔍 Detailed Error Diagnostics for Auth Failures
        if (errorMsg.includes('Authentication failed') || errorMsg.includes('Could not fetch region settings') || errorMsg.includes('401')) {
           console.error('🚨 LiveKit Authentication Failed! This usually means LIVEKIT_API_KEY/SECRET in server .env do not match the LIVEKIT_URL project.');
           console.error('🚨 Make sure the backend .env has the correct API Key and Secret for:', targetUrl);
           toast.error('Connection refused: Server credentials do not match LiveKit project URL.');
        }

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
        this.log('❌ Connection failed with error:', { message: errorMsg })
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
      // Modern Publishing: Let LiveKit manage the track
      await this.room.localParticipant.publishTrack(videoTrack, { name: 'camera', source: Track.Source.Camera });
      // await this.room.localParticipant.setCameraEnabled(true) // ✅ Ensure camera is marked enabled
      this.log('✅ Video track published')
    } else {
      this.log('⚠️ No video track in preflight stream')
    }

    if (audioTrack) {
      if (ENABLE_AUDIO_PUBLISH) {
         this.log('🎤 Publishing audio track', {
            enabled: audioTrack.enabled,
            readyState: audioTrack.readyState,
            label: audioTrack.label,
            muted: audioTrack.muted,
            settings: audioTrack.getSettings()
         })
         // Modern Publishing: Let LiveKit manage the track
         await this.room.localParticipant.publishTrack(audioTrack, { name: 'microphone', source: Track.Source.Microphone });
         // await this.room.localParticipant.setMicrophoneEnabled(true) // ✅ Ensure mic is marked enabled
         this.log('✅ Audio track published')
      } else {
         this.log('🚫 Audio publishing disabled by ENABLE_AUDIO_PUBLISH flag')
      }
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

    this.room.on(RoomEvent.Reconnecting, () => {
      this.log('📡 Room Reconnecting...')
      toast.warning('Reconnecting to stream...', {
        description: 'Network connection interrupted. Please wait.'
      })
    })

    this.room.on(RoomEvent.Reconnected, () => {
      this.log('📡 Room Reconnected')
      toast.success('Reconnected to stream')
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

    // ✅ Gold Standard: Check cache first
    const cacheKey = `${this.config.roomName}:${this.config.identity}`;
    const cached = tokenCache.get(cacheKey);
    if (cached) {
      const now = Math.floor(Date.now() / 1000);
      if (cached.expiresAt > now + 60) { // 60s buffer
         this.log('💎 Reusing cached LiveKit token', { 
           expiresAt: new Date(cached.expiresAt * 1000).toISOString(),
           timeLeft: cached.expiresAt - now 
         });
         // Assume URL/allowPublish haven't changed or are standard
         return { token: cached.token, livekitUrl: LIVEKIT_URL, allowPublish: this.config.allowPublish };
      } else {
         this.log('💎 Cached token expired, fetching new one');
         tokenCache.delete(cacheKey);
      }
    }

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
      
      // ✅ Fix: Only refresh if session is missing or expired
      if (!session?.access_token) {
        this.log('🔑 No session in store, checking Supabase...')
        const { data } = await supabase.auth.getSession()
        
        if (data.session?.access_token) {
           session = data.session
        } else {
           this.log('⚠️ No active session found, refreshing...')
           const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
           
           if (refreshError || !refreshData.session?.access_token) {
             throw new Error('No valid Supabase session — cannot request token')
           }
           session = refreshData.session
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
          this.log('⚠️ Failed to refresh expiring session:', { error: e })
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

      // Call external token endpoint (Supabase Edge Function)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const tokenUrl = `${supabaseUrl}/functions/v1/livekit-token`;
      
      console.log("🔥 LiveKit tokenUrl selected:", tokenUrl);

      // ✅ CRITICAL: Ensure accessToken is a string, not an object
      // Handle both direct access and nested structure
      let accessToken: string | undefined = session?.access_token
      
      // If access_token is an object (shouldn't happen, but defensive check)
      if (accessToken && typeof accessToken === 'object') {
        this.log('⚠️ access_token is an object, attempting to extract string value', accessToken)
        // Try to get string value from object
        if (accessToken && 'token' in accessToken && typeof (accessToken as any).token === 'string') {
          accessToken = (accessToken as any).token
        } else if (accessToken && 'value' in accessToken && typeof (accessToken as any).value === 'string') {
          accessToken = (accessToken as any).value
        } else {
          this.log('❌ Cannot extract string from access_token object', accessToken)
          throw new Error('Invalid session token: access_token is an object and cannot be converted to string')
        }
      }
      
      // Validate accessToken is a string
      if (!accessToken || typeof accessToken !== 'string') {
        this.log('❌ Invalid access token type', { 
          type: typeof accessToken, 
          value: accessToken,
          isString: typeof accessToken === 'string',
          isObject: typeof accessToken === 'object',
          sessionKeys: session ? Object.keys(session) : 'no session',
          sessionAccessToken: session?.access_token,
          sessionAccessTokenType: typeof session?.access_token
        })
        throw new Error('Invalid session token: access_token must be a string')
      }
      
      // Ensure token starts with expected JWT format
      if (!accessToken.startsWith('eyJ')) {
        this.log('❌ Access token does not have JWT format', {
          tokenPreview: accessToken.substring(0, 50),
          tokenLength: accessToken.length,
          firstChars: accessToken.substring(0, 10)
        })
        throw new Error('Invalid session token format: expected JWT starting with eyJ')
      }

      this.log('🔑 Making fetch request to token endpoint...', { 
        tokenUrl,
        tokenLength: accessToken.length,
        tokenPreview: accessToken.substring(0, 20) + '...'
      })
      
      // ✅ Final validation: ensure Authorization header will be correct
      const authHeader = `Bearer ${accessToken}`
      if (authHeader.includes('[object Object]') || authHeader.includes('undefined') || authHeader.includes('null')) {
        this.log('❌ Authorization header contains invalid value', {
          authHeader,
          accessTokenType: typeof accessToken,
          accessTokenValue: accessToken
        })
        throw new Error('Invalid Authorization header: token is not a valid string')
      }

      // Add timeout to fetch request to prevent hanging
      const fetchWithTimeout = Promise.race([
        fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            room: this.config.roomName,
            roomName: this.config.roomName, // Support both formats
            identity: this.config.identity,
            user_id: this.config.user?.id,
            role: this.config.role || this.config.user?.role || 'viewer',
            level: this.config.user?.level || 1,
            allowPublish: this.config.allowPublish !== false,
          }),
        }),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('Token request timeout after 20s')), 20000)
        )
      ])

      const res = await fetchWithTimeout

      this.log('🔑 Token endpoint response received', { 
        status: res.status, 
        statusText: res.statusText,
        ok: res.ok 
      })

      // ✅ Parse JSON with error handling
      const json = await res.json().catch(() => null)
      
      // 🔥 TEMPORARY DEBUG: Log response to see what endpoint returns
      console.log("🔥 LiveKit token endpoint response JSON:", json);
      console.log("🔥 Token field type:", typeof json?.token);
      
      // ✅ Handle case where token is wrapped in data object (Supabase Edge Function format)
      // Some edge functions return { data: { token: ... }, error: null }
      let token = json?.token;
      
      if (!token && json?.data?.token) {
        console.log("🔥 Token found in nested data object");
        token = json.data.token;
      }
      
      // If still no token but we have a direct string response (unlikely but possible)
      if (!token && typeof json === 'string' && json.startsWith('eyJ')) {
        token = json;
      }

      if (!res.ok) {
        this.log('🔑 Token endpoint returned error', { status: res.status, body: json })
        const msg = json?.error || json?.message || `Token request failed: ${res.status}`
        throw new Error(msg)
      }

      // ✅ Strict token extraction - using the normalized token variable from above
      // const token = json?.token <-- REMOVED, using 'token' variable from above logic

      // ✅ STRICT VALIDATION: Token must be a string
      if (!token || typeof token !== 'string') {
        console.error('❌ Token response invalid:', json)
        this.log('❌ Token extraction failed: token is not a string', {
          token,
          tokenType: typeof token,
          jsonToken: json?.token,
          fullJsonResponse: json
        })
        throw new Error('Token endpoint returned invalid token type')
      }

      // ✅ STRICT VALIDATION: Token must be JWT format
      if (!token.startsWith('eyJ')) {
        console.error('❌ Token not JWT:', token.substring(0, 50))
        this.log('❌ Token does not have valid JWT format', {
          tokenPreview: token.substring(0, 50),
          tokenLength: token.length,
          firstChars: token.substring(0, 10)
        })
        throw new Error('Token endpoint returned non-JWT token')
      }

      // Trim whitespace
      const trimmedToken = token.trim()

      // ✅ Gold Standard: Cache the new token
      try {
         const parts = trimmedToken.split('.');
         if (parts.length >= 2) {
            const payload = JSON.parse(decodeURIComponent(escape(atob(parts[1]))));
            if (payload.exp) {
               tokenCache.set(cacheKey, { token: trimmedToken, expiresAt: payload.exp });
               this.log('💎 Token cached', { expiresAt: new Date(payload.exp * 1000).toISOString() });
            }
         }
      } catch (e) {
         console.warn('Failed to parse token for caching', e);
      }

      this.log('✅ Token received successfully:', {
        tokenLength: trimmedToken.length,
        tokenPreview: trimmedToken.substring(0, 20) + '...',
        livekitUrl: json.livekitUrl,
        allowPublish: json.allowPublish,
      })

      // ✅ Return ONLY the token string (not wrapped in data object)
      this.log('✅ Token decoded for verification:', {
        requestedRoom: this.config.roomName,
        tokenRoom: json.room || json.r, // LiveKit uses 'r' or 'room' in JWT claims
        tokenIdentity: json.identity || json.sub // 'sub' is standard JWT subject
      })
      
      return { token: trimmedToken, livekitUrl: json.livekitUrl, allowPublish: json.allowPublish }
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
 
      // Use isVideoPublishing() instead of isPublishing() to handle audio-only cases correctly
      if (enabled && !this.isVideoPublishing()) {
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
    } catch (error) {
      console.error('Failed to toggle camera:', error)
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
    } catch (error) {
      console.error('Failed to toggle microphone:', error)
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

  // ✅ NEW: Reconnect method to handle network interruptions gracefully
  async reconnect(): Promise<boolean> {
    if (!this.config.roomName || !this.config.identity) {
      this.log('❌ Cannot reconnect: missing roomName or identity')
      return false
    }

    if (this.isConnecting) {
      this.log('🛡️ Reconnect skipped: already connecting')
      return false
    }

    this.log('🔄 Attempting to reconnect to LiveKit room...')

    try {
      // Disconnect current session if any
      if (this.room && this.room.state !== 'disconnected') {
        try {
          this.log('🔌 Disconnecting current session before reconnect')
          this.room.disconnect()
        } catch (disconnectError) {
          this.log('⚠️ Error during disconnect before reconnect:', disconnectError)
        }
      }

      // Attempt to reconnect
      const success = await this.connect()
      if (success) {
        this.log('✅ Reconnect successful')
        return true
      } else {
        this.log('❌ Reconnect failed')
        return false
      }
    } catch (error: any) {
      this.log('❌ Reconnect error:', error?.message || error)
      return false
    }
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
    if (this.publishingInProgress) {
        console.warn("🚫 Prevented disconnect during publish (LiveKitService guard)");
        return;
    }

    // Rule: Never call disconnect() if you are currently connecting to the same room/identity.
    if (this.isConnecting && this.targetRoom === this.config.roomName && this.targetIdentity === this.config.identity) {
      this.log('🛡️ Ignoring disconnect: currently connecting to this room/identity');
      return;
    }

    this.log('🔌 Disconnecting from LiveKit room...', {
        room: this.room ? this.room.name : 'null',
        state: this.room ? this.room.state : 'null'
    })

    if (this.room && this.room.state !== 'disconnected') {
      try {
        this.room.disconnect()
      } catch (e) { 
        this.log('⚠️ Error disconnecting', e);
      }
    }
    this.room = null; // Ensure room is cleared
    
    // Clear participants
    this.participants.clear();
    this.isConnecting = false;
    this.targetRoom = null;
    this.targetIdentity = null;
    
    this.cleanup()
    this.config.onDisconnected?.();
  }

  private cleanup(): void {
    if (this.localVideoTrack) {
      try {
        this.localVideoTrack.stop()
        console.log('📹 Video track stopped and hardware light turned off')
      } catch (error) {
        console.error('Failed to stop video track:', error)
      }
      this.localVideoTrack = null
    }
 
    if (this.localAudioTrack) {
      try {
        this.localAudioTrack.stop()
        console.log('🎤 Audio track stopped')
      } catch (error) {
        console.error('Failed to stop audio track:', error)
      }
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
    this.log('💥 Destroying LiveKitService instance...');
    
    // Stop all local tracks explicitly to ensure hardware light turns off
    if (this.room?.localParticipant) {
      this.room.localParticipant.videoTrackPublications.forEach(pub => {
        try {
          pub.track?.stop();
          console.log('📹 Video publication track stopped')
        } catch (error) {
          console.error('Failed to stop video publication track:', error)
        }
      });
      this.room.localParticipant.audioTrackPublications.forEach(pub => {
        try {
          pub.track?.stop();
          console.log('🎤 Audio publication track stopped')
        } catch (error) {
          console.error('Failed to stop audio publication track:', error)
        }
      });
    }
 
    this.disconnect()
  }
}

export function createLiveKitService(config: LiveKitServiceConfig): LiveKitService {
  return new LiveKitService(config)
}
