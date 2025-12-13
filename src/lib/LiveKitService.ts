import { Room, RoomEvent, LocalVideoTrack, LocalAudioTrack, createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';
import { LIVEKIT_URL, defaultLiveKitOptions } from './LiveKitConfig';
import api from './api';

export interface LiveKitParticipant {
  identity: string;
  name?: string;
  isLocal: boolean;
  videoTrack?: any; // LocalVideoTrack or RemoteTrack
  audioTrack?: any; // LocalAudioTrack or RemoteTrack
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  isMuted: boolean;
}

export interface LiveKitServiceConfig {
  roomName: string;
  identity: string;
  user?: any;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onParticipantJoined?: (participant: LiveKitParticipant) => void;
  onParticipantLeft?: (participant: LiveKitParticipant) => void;
  onTrackSubscribed?: (track: any, participant: LiveKitParticipant) => void;
  onTrackUnsubscribed?: (track: any, participant: LiveKitParticipant) => void;
  onError?: (error: string) => void;
  autoPublish?: boolean; // Whether to immediately publish camera/mic
}

export class LiveKitService {
  private room: Room | null = null;
  private config: LiveKitServiceConfig;
  private participants: Map<string, LiveKitParticipant> = new Map();
  private localVideoTrack: LocalVideoTrack | null = null;
  private localAudioTrack: LocalAudioTrack | null = null;
  private isConnecting = false;

  constructor(config: LiveKitServiceConfig) {
    this.config = {
      autoPublish: false,
      ...config
    };

    this.log('LiveKitService initialized', { roomName: config.roomName, userId: config.user?.id });
  }

  // Main connection method - IMMEDIATE media capture and publishing
  async connect(): Promise<boolean> {
    if (this.isConnecting || this.room?.state === 'connected') {
      this.log('Already connecting or connected');
      return true;
    }

    this.isConnecting = true;
    this.log('Starting connection process...');

    try {
      // Step 1: Get LiveKit token
      const tokenResponse = await this.getToken();
      if (!tokenResponse?.token) {
        throw new Error('Failed to get LiveKit token');
      }

      // Step 2: Create room with configuration
      this.room = new Room({
        ...defaultLiveKitOptions,
        ...this.config
      });

      // Step 3: Set up event listeners BEFORE connecting
      this.setupEventListeners();

      // Step 4: Connect to room
      this.log('Connecting to LiveKit room...');
      await this.room.connect(LIVEKIT_URL, tokenResponse.token);

      // Media publishing will be triggered by user action, not auto-published

      this.log('✅ Connection successful');
      this.config.onConnected?.();
      return true;

    } catch (error: any) {
      this.log('❌ Connection failed:', error.message);
      this.config.onError?.(error.message || 'Failed to connect to stream');
      this.isConnecting = false;

      return false;
    }
  }

  // IMMEDIATE media capture and publishing - no previews, no delays
  private async immediateMediaCaptureAndPublish(): Promise<void> {
    if (!this.room || this.room.state !== 'connected') {
      throw new Error('Room not connected');
    }

    this.log('🎥 Starting immediate media capture and publishing...');

    try {
      // Capture camera and microphone simultaneously
      const [videoTrack, audioTrack] = await Promise.all([
        this.captureVideoTrack(),
        this.captureAudioTrack()
      ]);

      // Store references to prevent garbage collection
      this.localVideoTrack = videoTrack;
      this.localAudioTrack = audioTrack;

      // Publish tracks immediately
      if (videoTrack) {
        await this.publishVideoTrack(videoTrack);
      }

      if (audioTrack) {
        await this.publishAudioTrack(audioTrack);
      }

      // Update local participant state
      this.updateLocalParticipantState();

      this.log('✅ Media capture and publishing complete');

    } catch (error: any) {
      this.log('❌ Media capture/publishing failed:', error.message);
      this.config.onError?.(`Media access failed: ${error.message}`);

      // Clean up any tracks that were created
      if (this.localVideoTrack) {
        this.localVideoTrack.stop();
        this.localVideoTrack = null;
      }
      if (this.localAudioTrack) {
        this.localAudioTrack.stop();
        this.localAudioTrack = null;
      }

      throw error;
    }
  }

  // Capture video track with immediate constraints
  private async captureVideoTrack(): Promise<LocalVideoTrack | null> {
    try {
      this.log('📹 Capturing video track...');
      const track = await createLocalVideoTrack({
        facingMode: 'user',
        resolution: { width: 1280, height: 720 },
        frameRate: { ideal: 30, max: 60 }
      });
      this.log('✅ Video track captured');
      return track;
    } catch (error: any) {
      this.log('❌ Video capture failed:', error.message);
      throw new Error(`Camera access failed: ${error.message}`);
    }
  }

  // Capture audio track with immediate constraints
  private async captureAudioTrack(): Promise<LocalAudioTrack | null> {
    try {
      this.log('🎤 Capturing audio track...');
      const track = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      });
      this.log('✅ Audio track captured');
      return track;
    } catch (error: any) {
      this.log('❌ Audio capture failed:', error.message);
      throw new Error(`Microphone access failed: ${error.message}`);
    }
  }

  // Publish video track
  private async publishVideoTrack(track: LocalVideoTrack): Promise<void> {
    if (!this.room?.localParticipant) {
      throw new Error('No local participant available');
    }

    try {
      this.log('📤 Publishing video track...');
      await this.room.localParticipant.publishTrack(track);
      this.log('✅ Video track published');
    } catch (error: any) {
      this.log('❌ Video publishing failed:', error.message);
      track.stop();
      throw error;
    }
  }

  // Publish audio track
  private async publishAudioTrack(track: LocalAudioTrack): Promise<void> {
    if (!this.room?.localParticipant) {
      throw new Error('No local participant available');
    }

    try {
      this.log('📤 Publishing audio track...');
      await this.room.localParticipant.publishTrack(track);
      this.log('✅ Audio track published');
    } catch (error: any) {
      this.log('❌ Audio publishing failed:', error.message);
      track.stop();
      throw error;
    }
  }

  // Update local participant state
  private updateLocalParticipantState(): void {
    if (!this.room?.localParticipant) return;

    const localParticipant: LiveKitParticipant = {
      identity: this.room.localParticipant.identity,
      name: this.config.user?.username || this.config.user?.email || 'You',
      isLocal: true,
      videoTrack: this.localVideoTrack || undefined,
      audioTrack: this.localAudioTrack || undefined,
      isCameraEnabled: this.room.localParticipant.isCameraEnabled,
      isMicrophoneEnabled: this.room.localParticipant.isMicrophoneEnabled,
      isMuted: !this.room.localParticipant.isMicrophoneEnabled
    };

    this.participants.set(localParticipant.identity, localParticipant);
  }

  // Set up all event listeners
  private setupEventListeners(): void {
    if (!this.room) return;

    this.room.on(RoomEvent.Connected, () => {
      this.log('📡 Room connected');
      this.isConnecting = false;
    });

    this.room.on(RoomEvent.Disconnected, () => {
      this.log('📡 Room disconnected');
      this.cleanup();
      this.config.onDisconnected?.();
    });

    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      this.log('👤 Participant joined:', participant.identity);
      const liveKitParticipant: LiveKitParticipant = {
        identity: participant.identity,
        name: participant.name || participant.identity,
        isLocal: false,
        isCameraEnabled: participant.isCameraEnabled,
        isMicrophoneEnabled: participant.isMicrophoneEnabled,
        isMuted: !participant.isMicrophoneEnabled
      };

      this.participants.set(participant.identity, liveKitParticipant);
      this.config.onParticipantJoined?.(liveKitParticipant);
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      this.log('👤 Participant left:', participant.identity);
      const liveKitParticipant = this.participants.get(participant.identity);
      if (liveKitParticipant) {
        this.participants.delete(participant.identity);
        this.config.onParticipantLeft?.(liveKitParticipant);
      }
    });

    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      this.log('📥 Track subscribed:', track.kind, participant.identity);
      const liveKitParticipant = this.participants.get(participant.identity);
      if (liveKitParticipant) {
        if (track.kind === 'video') {
          liveKitParticipant.videoTrack = track;
        } else if (track.kind === 'audio') {
          liveKitParticipant.audioTrack = track;
        }
        this.config.onTrackSubscribed?.(track, liveKitParticipant);
      }
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      this.log('📤 Track unsubscribed:', track.kind, participant.identity);
      const liveKitParticipant = this.participants.get(participant.identity);
      if (liveKitParticipant) {
        this.config.onTrackUnsubscribed?.(track, liveKitParticipant);
      }
    });

    // Connection quality monitoring
    this.room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      this.log('📊 Connection quality changed:', quality, participant?.identity);
    });

  }

  // Get LiveKit token from API
  private async getToken(): Promise<any> {
    try {
      const response = await api.post('/livekit-token', {
        room: this.config.roomName,
        identity: this.config.user?.email || this.config.user?.id || 'anonymous',
        user_id: this.config.user?.id,
        role: this.config.user?.role || this.config.user?.troll_role || 'viewer',
        level: this.config.user?.level || 1,
      });

      if (!response.token) {
        throw new Error('No token received from server');
      }

      return response;
    } catch (error: any) {
      this.log('❌ Token fetch failed:', error.message);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }


  // Public control methods
  async toggleCamera(): Promise<boolean> {
    if (!this.room?.localParticipant) return false;

    try {
      const enabled = !this.room.localParticipant.isCameraEnabled;
      await this.room.localParticipant.setCameraEnabled(enabled);
      this.log(`📹 Camera ${enabled ? 'enabled' : 'disabled'}`);
      return enabled;
    } catch (error: any) {
      this.log('❌ Camera toggle failed:', error.message);
      return false;
    }
  }

  async toggleMicrophone(): Promise<boolean> {
    if (!this.room?.localParticipant) return false;

    try {
      const enabled = !this.room.localParticipant.isMicrophoneEnabled;
      await this.room.localParticipant.setMicrophoneEnabled(enabled);
      this.log(`🎤 Microphone ${enabled ? 'enabled' : 'disabled'}`);
      return enabled;
    } catch (error: any) {
      this.log('❌ Microphone toggle failed:', error.message);
      return false;
    }
  }

  // Start publishing camera and microphone - user-triggered
  async startPublishing(): Promise<void> {
    if (!this.room || this.room.state !== 'connected') {
      throw new Error('Room not connected');
    }

    this.log('🎥 Starting user-triggered media publishing...');

    try {
      // Capture camera and microphone simultaneously
      const [videoTrack, audioTrack] = await Promise.all([
        this.captureVideoTrack(),
        this.captureAudioTrack()
      ]);

      // Store references
      this.localVideoTrack = videoTrack;
      this.localAudioTrack = audioTrack;

      // Publish tracks
      if (videoTrack) {
        await this.publishVideoTrack(videoTrack);
      }

      if (audioTrack) {
        await this.publishAudioTrack(audioTrack);
      }

      // Update local participant state
      this.updateLocalParticipantState();

      this.log('✅ User-triggered publishing complete');

    } catch (error: any) {
      this.log('❌ Publishing failed:', error.message);
      this.config.onError?.(`Media publishing failed: ${error.message}`);

      // Clean up tracks
      if (this.localVideoTrack) {
        this.localVideoTrack.stop();
        this.localVideoTrack = null;
      }
      if (this.localAudioTrack) {
        this.localAudioTrack.stop();
        this.localAudioTrack = null;
      }

      throw error;
    }
  }

  // Get current state
  getRoom(): Room | null {
    return this.room;
  }

  getParticipants(): Map<string, LiveKitParticipant> {
    return this.participants;
  }

  isConnected(): boolean {
    return this.room?.state === 'connected';
  }

  getLocalParticipant(): LiveKitParticipant | null {
    if (!this.room?.localParticipant) return null;
    return this.participants.get(this.room.localParticipant.identity) || null;
  }

  // Cleanup and disconnect
  disconnect(): void {
    this.log('🔌 Disconnecting from LiveKit room...');

    if (this.room) {
      try {
        this.room.disconnect();
      } catch (error: any) {
        this.log('❌ Disconnect error:', error.message);
      }
    }

    this.cleanup();
  }

  private cleanup(): void {
    // Clean up tracks
    if (this.localVideoTrack) {
      this.localVideoTrack.stop();
      this.localVideoTrack = null;
    }

    if (this.localAudioTrack) {
      this.localAudioTrack.stop();
      this.localAudioTrack = null;
    }

    // Clear participants
    this.participants.clear();

    // Reset state
    this.room = null;
    this.isConnecting = false;
  }

  // Logging utility
  private log(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const roomInfo = this.config.roomName ? `[${this.config.roomName}]` : '';
    console.log(`🔴 LiveKit ${timestamp} ${roomInfo} ${message}`, ...args);
  }


  // Cleanup on destroy
  destroy(): void {
    this.disconnect();
  }
}

// Factory function for easy service creation
export function createLiveKitService(config: LiveKitServiceConfig): LiveKitService {
  return new LiveKitService(config);
}