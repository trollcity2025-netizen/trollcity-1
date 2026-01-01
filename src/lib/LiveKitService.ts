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
      // Step 1: Get LiveKit token (unless overridden)
      let token: string | undefined = undefined
      if (tokenOverride) {
        token = tokenOverride
      } else {
        const tokenResponse = await this.getToken()
        if (!tokenResponse?.token) {
          throw new Error('Failed to get LiveKit token')
        }
        token = tokenResponse.token
      }

      // Runtime invariant: ensure token is valid string
      if (typeof token !== 'string') {
        console.error('🚨 LiveKit token is NOT a string', token)
        throw new Error('Invalid LiveKit token type')
      }

      if (!token.startsWith('eyJ')) {
        console.error('🚨 LiveKit token is not JWT', token)
        throw new Error('Invalid LiveKit token format')
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
          this.log('🔐 LiveKit token (raw preview)', token.substring(0, 60) + '...')
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
        return true
      } catch (err) {
        console.error("[LiveKitService] connect failed", err)
        return false
      }

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
    } catch (error: any) {
      console.error('❌ LiveKitService.connect failed FULL error:', error)

      this.log('❌ Connection failed:', error?.message || String(error))

      this.config.onError?.(error?.message || 'Failed to connect')
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

    const videoTrack = stream.getVideoTracks()[0]
    const audioTrack = stream.getAudioTracks()[0]

    if (!videoTrack && !audioTrack) {
      throw new Error('No video or audio track available from preflight stream')
    }

    if (videoTrack) {
      this.localVideoTrack = new LocalVideoTrack(videoTrack)
      await this.room.localParticipant.publishTrack(this.localVideoTrack as any)
    }

    if (audioTrack) {
      this.localAudioTrack = new LocalAudioTrack(audioTrack)
      await this.room.localParticipant.publishTrack(this.localAudioTrack as any)
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

      // Import supabase client to check session
      const { supabase } = await import('./supabase')
      const session = await supabase.auth.getSession()

      if (!session.data.session?.access_token) {
        throw new Error('No valid user session found. Please sign in again.')
      }

      this.log('🔑 Session validated, making API request...', {
        hasToken: !!session.data.session.access_token,
        tokenLength: session.data.session.access_token.length,
        expiresAt: session.data.session.expires_at,
        now: Math.floor(Date.now() / 1000)
      })

      // Call external token endpoint (Vercel). Set `VITE_LIVEKIT_TOKEN_URL` during frontend build
      const tokenUrl = (import.meta as any).env?.VITE_LIVEKIT_TOKEN_URL || '/api/livekit-token'

      const resp = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`,
        },
        body: JSON.stringify({
          room: this.config.roomName,
          identity: this.config.identity,
          user_id: this.config.user?.id,
          role: this.config.role || this.config.user?.role || 'viewer',
          level: this.config.user?.level || 1,
          allowPublish: this.config.allowPublish !== false,
        }),
      })

      // ✅ 1) In your token fetch code:
      console.log("[useLiveKitSession] token response:", resp)

      let data: any = null
      try {
        data = await resp.json()
        console.log("[useLiveKitSession] token json:", data)
      } catch (e) {
        this.log('🔑 Failed to parse token endpoint response', e?.message || e)
        throw new Error('Invalid token response from server')
      }

      console.log('🟢 getToken() response:', data)

      if (!resp.ok) {
        this.log('🔑 Token endpoint returned error', { status: resp.status, body: data })
        const msg = data?.error || data?.message || `Token endpoint error ${resp.status}`
        throw new Error(msg)
      }

      if (!data?.token) {
        this.log('❌ No token in endpoint response', data)
        throw new Error('No token returned from token endpoint')
      }

      this.log('✅ Token received successfully:', {
        tokenLength: data.token.length,
        tokenPreview: data.token.substring(0, 20) + '...',
        livekitUrl: data.livekitUrl,
        allowPublish: data.allowPublish,
      })

      return data
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
  }

  getRoom(): Room | null {
    return this.room
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
