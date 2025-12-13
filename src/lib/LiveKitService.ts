import {
  Room,
  RoomEvent,
  LocalVideoTrack,
  LocalAudioTrack,
  createLocalVideoTrack,
  createLocalAudioTrack,
} from 'livekit-client'
import { LIVEKIT_URL, defaultLiveKitOptions } from './LiveKitConfig'
import api from './api'

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
  autoPublish?: boolean // Whether to immediately publish camera/mic
}

export class LiveKitService {
  private room: Room | null = null
  private config: LiveKitServiceConfig
  private participants: Map<string, LiveKitParticipant> = new Map()
  private localVideoTrack: LocalVideoTrack | null = null
  private localAudioTrack: LocalAudioTrack | null = null
  private isConnecting = false

  constructor(config: LiveKitServiceConfig) {
    this.config = config
    this.log('LiveKitService initialized', {
      roomName: config.roomName,
      identity: config.identity,
      userId: config.user?.id,
    })
  }

  // Constructor replaced with singleton pattern

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

  /* =========================
     Main connection method
  ========================= */

  async connect(): Promise<boolean> {
    // Hard guard: prevent multiple connections
    if (this.room || this.isConnecting) {
      this.log('Already connected or connecting')
      return true
    }

    // Connection lock to prevent death-loops
    this.isConnecting = true
    this.log('Starting connection process...')

    try {
      // Step 1: Get LiveKit token
      const tokenResponse = await this.getToken()
      if (!tokenResponse?.token) {
        throw new Error('Failed to get LiveKit token')
      }

      const token = tokenResponse.token

      // Runtime invariant: ensure token is valid string
      if (typeof token !== "string") {
        console.error("🚨 LiveKit token is NOT a string", token)
        throw new Error("Invalid LiveKit token type")
      }

      if (!token.startsWith("eyJ")) {
        console.error("🚨 LiveKit token is not JWT", token)
        throw new Error("Invalid LiveKit token format")
      }

      // Step 2: Create room with configuration
      // NOTE: Do NOT spread this.config into Room() because it contains non-Room keys (callbacks/user/etc).
      this.room = new Room({
        ...defaultLiveKitOptions,
      })

      // Step 3: Set up event listeners BEFORE connecting
      this.setupEventListeners()

      // Step 4: Connect to room
      this.log('Connecting to LiveKit room...')
      await this.room.connect(LIVEKIT_URL, token)

      // Ensure local participant exists in map as soon as we connect
      this.updateLocalParticipantState()

      // ✅ Hydrate participants already in the room (important when you join late)
      this.hydrateExistingRemoteParticipants()

      // If autoPublish requested, publish immediately
      if (this.config.autoPublish) {
        try {
          await this.startPublishing()
        } catch (e: any) {
          // startPublishing already logs + onError
          this.log('AutoPublish failed (continuing connected state):', e?.message)
        }
      }

      this.log('✅ Connection successful')
      this.config.onConnected?.()
      this.isConnecting = false
      return true
    } catch (error: any) {
      this.log('❌ Connection failed:', error.message)
      this.config.onError?.(error.message || 'Failed to connect to stream')
      this.isConnecting = false
      return false
    }
  }

private hydrateExistingRemoteParticipants(): void {
  if (!this.room) return

  // remoteParticipants is a Map<string, RemoteParticipant> in the livekit-client types
  this.room.remoteParticipants.forEach((participant: any) => {
    if (this.participants.has(participant.identity)) return

    const liveKitParticipant: LiveKitParticipant = {
      identity: participant.identity,
      name: participant.name || participant.identity,
      isLocal: false,
      isCameraEnabled: participant.isCameraEnabled,
      isMicrophoneEnabled: participant.isMicrophoneEnabled,
      isMuted: !participant.isMicrophoneEnabled,
    }

    this.participants.set(participant.identity, liveKitParticipant)
    this.config.onParticipantJoined?.(liveKitParticipant)
  })
}

  /* =========================
     IMMEDIATE media capture and publishing
     (kept as your original design)
  ========================= */

  private async immediateMediaCaptureAndPublish(): Promise<void> {
    if (!this.room || this.room.state !== 'connected') {
      throw new Error('Room not connected')
    }

    // ✅ Hard guard: never publish twice
    if (this.isPublishing()) {
      this.log('⛔ Already publishing - immediate capture skipped')
      return
    }

    this.log('🎥 Starting immediate media capture and publishing...')

    try {
      const [videoTrack, audioTrack] = await Promise.all([
        this.captureVideoTrack(),
        this.captureAudioTrack(),
      ])

      // Store references to prevent GC
      this.localVideoTrack = videoTrack
      this.localAudioTrack = audioTrack

      if (videoTrack) {
        await this.publishVideoTrack(videoTrack)
      }

      if (audioTrack) {
        await this.publishAudioTrack(audioTrack)
      }

      this.updateLocalParticipantState()

      this.log('✅ Media capture and publishing complete')
    } catch (error: any) {
      this.log('❌ Media capture/publishing failed:', error.message)
      this.config.onError?.(`Media access failed: ${error.message}`)

      if (this.localVideoTrack) {
        this.localVideoTrack.stop()
        this.localVideoTrack = null
      }
      if (this.localAudioTrack) {
        this.localAudioTrack.stop()
        this.localAudioTrack = null
      }

      throw error
    }
  }

  /* =========================
     Capture tracks
  ========================= */

  private async captureVideoTrack(): Promise<LocalVideoTrack | null> {
    try {
      this.log('📹 Capturing video track...')
      const track = await createLocalVideoTrack({
        facingMode: 'user',
        resolution: { width: 1280, height: 720 },
        frameRate: { ideal: 30, max: 60 },
      } as any)
      this.log('✅ Video track captured')
      return track
    } catch (error: any) {
      this.log('❌ Video capture failed:', error.message)
      throw new Error(`Camera access failed: ${error.message}`)
    }
  }

  private async captureAudioTrack(): Promise<LocalAudioTrack | null> {
    try {
      this.log('🎤 Capturing audio track...')
      const track = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } as any)
      this.log('✅ Audio track captured')
      return track
    } catch (error: any) {
      this.log('❌ Audio capture failed:', error.message)
      throw new Error(`Microphone access failed: ${error.message}`)
    }
  }

  /* =========================
     Publish helpers
  ========================= */

  private async publishVideoTrack(track: LocalVideoTrack): Promise<void> {
    if (!this.room?.localParticipant) {
      throw new Error('No local participant available')
    }

    try {
      this.log('📤 Publishing video track...')
      await this.room.localParticipant.publishTrack(track as any)
      this.log('✅ Video track published')
    } catch (error: any) {
      this.log('❌ Video publishing failed:', error.message)
      track.stop()
      throw error
    }
  }

  private async publishAudioTrack(track: LocalAudioTrack): Promise<void> {
    if (!this.room?.localParticipant) {
      throw new Error('No local participant available')
    }

    try {
      this.log('📤 Publishing audio track...')
      await this.room.localParticipant.publishTrack(track as any)
      this.log('✅ Audio track published')
    } catch (error: any) {
      this.log('❌ Audio publishing failed:', error.message)
      track.stop()
      throw error
    }
  }

  /* =========================
     Local participant state sync
  ========================= */

  private updateLocalParticipantState(): void {
    if (!this.room?.localParticipant) return

    const p = this.room.localParticipant

    const localParticipant: LiveKitParticipant = {
      identity: p.identity,
      name: this.config.user?.username || this.config.user?.email || 'You',
      isLocal: true,
      videoTrack: this.localVideoTrack ? { track: this.localVideoTrack } : undefined,
      audioTrack: this.localAudioTrack ? { track: this.localAudioTrack } : undefined,
      isCameraEnabled: p.isCameraEnabled,
      isMicrophoneEnabled: p.isMicrophoneEnabled,
      isMuted: !p.isMicrophoneEnabled,
    }

    this.participants.set(localParticipant.identity, localParticipant)
  }

  /* =========================
     Event listeners
  ========================= */

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

    // ✅ store remote tracks as { track } to match UI expectations
    this.room.on(RoomEvent.TrackSubscribed, (track: any, publication: any, participant: any) => {
      this.log('📥 Track subscribed:', track.kind, participant.identity)
      const liveKitParticipant = this.participants.get(participant.identity)
      if (liveKitParticipant) {
        if (track.kind === 'video') {
          liveKitParticipant.videoTrack = { track }
        } else if (track.kind === 'audio') {
          liveKitParticipant.audioTrack = { track }
        }
        this.config.onTrackSubscribed?.(track, liveKitParticipant)
      }
    })

    this.room.on(RoomEvent.TrackUnsubscribed, (track: any, publication: any, participant: any) => {
      this.log('📤 Track unsubscribed:', track.kind, participant.identity)
      const liveKitParticipant = this.participants.get(participant.identity)
      if (liveKitParticipant) {
        if (track.kind === 'video' && liveKitParticipant.videoTrack?.track === track) {
          liveKitParticipant.videoTrack = undefined
        }
        if (track.kind === 'audio' && liveKitParticipant.audioTrack?.track === track) {
          liveKitParticipant.audioTrack = undefined
        }
        this.config.onTrackUnsubscribed?.(track, liveKitParticipant)
      }
    })

    // ✅ keep mute state accurate for UI
    this.room.on(RoomEvent.TrackMuted, (_pub: any, participant: any) => {
      const p = this.participants.get(participant.identity)
      if (p) p.isMuted = true
    })

    this.room.on(RoomEvent.TrackUnmuted, (_pub: any, participant: any) => {
      const p = this.participants.get(participant.identity)
      if (p) p.isMuted = false
    })

    this.room.on(RoomEvent.ConnectionQualityChanged, (quality: any, participant: any) => {
      this.log('📊 Connection quality changed:', quality, participant?.identity)
    })
  }

  /* =========================
     Token (identity fixed)
  ========================= */

  private async getToken(): Promise<any> {
    if (!this.config.identity) {
      throw new Error('Identity is required for LiveKit token')
    }

    try {
      const response = await api.post('/livekit-token', {
        room: this.config.roomName,
        identity: this.config.identity,
        user_id: this.config.user?.id,
        role:
          this.config.role ||
          this.config.user?.role ||
          this.config.user?.troll_role ||
          'viewer',
        level: this.config.user?.level || 1,
      })

      console.log('LiveKit token raw response:', response)

      const data = response?.data ?? response

      if (!data?.token) {
        console.error('LiveKit token API response data:', data)
        throw new Error('No token received from server')
      }

      return data
    } catch (error: any) {
      this.log('❌ Token fetch failed:', error.message)
      throw new Error(`Authentication failed: ${error.message}`)
    }
  }

  /* =========================
     Public control methods
  ========================= */

  async toggleCamera(): Promise<boolean> {
    if (!this.room?.localParticipant) return false

    try {
      const enabled = !this.room.localParticipant.isCameraEnabled

      // ✅ If not publishing yet and user turns on camera, publish once
      if (enabled && !this.isPublishing()) {
        // publish both camera+mic if you're going live; camera alone if that's your UI behavior
        const video = await this.captureVideoTrack()
        if (video) {
          this.localVideoTrack = video
          await this.publishVideoTrack(video)
        }
      }

      await this.room.localParticipant.setCameraEnabled(enabled)

      // If disabling, stop our stored track reference (LiveKit also manages internally)
      if (!enabled && this.localVideoTrack) {
        try {
          this.localVideoTrack.stop()
        } catch {}
        this.localVideoTrack = null
      }

      this.updateLocalParticipantState()
      this.log(`📹 Camera ${enabled ? 'enabled' : 'disabled'}`)
      return enabled
    } catch (error: any) {
      this.log('❌ Camera toggle failed:', error.message)
      return false
    }
  }

  async toggleMicrophone(): Promise<boolean> {
    if (!this.room?.localParticipant) return false

    try {
      const enabled = !this.room.localParticipant.isMicrophoneEnabled

      // ✅ If not publishing yet and user turns on mic, publish once
      if (enabled && !this.isPublishing()) {
        const audio = await this.captureAudioTrack()
        if (audio) {
          this.localAudioTrack = audio
          await this.publishAudioTrack(audio)
        }
      }

      await this.room.localParticipant.setMicrophoneEnabled(enabled)

      if (!enabled && this.localAudioTrack) {
        try {
          this.localAudioTrack.stop()
        } catch {}
        this.localAudioTrack = null
      }

      this.updateLocalParticipantState()
      this.log(`🎤 Microphone ${enabled ? 'enabled' : 'disabled'}`)
      return enabled
    } catch (error: any) {
      this.log('❌ Microphone toggle failed:', error.message)
      return false
    }
  }

  // Start publishing camera and microphone - user-triggered
  async startPublishing(): Promise<void> {
    if (!this.room || this.room.state !== 'connected') {
      throw new Error('Room not connected')
    }

    // ✅ HARD GUARD: never publish twice
    if (this.isPublishing()) {
      this.log('⛔ Already publishing - startPublishing skipped')
      return
    }

    this.log('🎥 Starting user-triggered media publishing...')

    try {
      const [videoTrack, audioTrack] = await Promise.all([
        this.captureVideoTrack(),
        this.captureAudioTrack(),
      ])

      this.localVideoTrack = videoTrack
      this.localAudioTrack = audioTrack

      if (videoTrack) await this.publishVideoTrack(videoTrack)
      if (audioTrack) await this.publishAudioTrack(audioTrack)

      await this.room.localParticipant.setCameraEnabled(true)
      await this.room.localParticipant.setMicrophoneEnabled(true)

      this.updateLocalParticipantState()
      this.log('✅ User-triggered publishing complete')
    } catch (error: any) {
      this.log('❌ Publishing failed:', error.message)
      this.config.onError?.(`Media publishing failed: ${error.message}`)

      if (this.localVideoTrack) {
        this.localVideoTrack.stop()
        this.localVideoTrack = null
      }
      if (this.localAudioTrack) {
        this.localAudioTrack.stop()
        this.localAudioTrack = null
      }

      this.updateLocalParticipantState()
      throw error
    }
  }

  /* =========================
     Get current state
  ========================= */

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

  /* =========================
     Cleanup and disconnect
  ========================= */

  disconnect(): void {
    this.log('🔌 Disconnecting from LiveKit room...')

    if (this.room) {
      try {
        this.room.disconnect()
      } catch (error: any) {
        this.log('❌ Disconnect error:', error.message)
      }
    }

    this.cleanup()
  }

  private cleanup(): void {
    if (this.localVideoTrack) {
      try {
        this.localVideoTrack.stop()
      } catch {}
      this.localVideoTrack = null
    }

    if (this.localAudioTrack) {
      try {
        this.localAudioTrack.stop()
      } catch {}
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
