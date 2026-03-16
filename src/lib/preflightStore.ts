import type { LocalVideoTrack, LocalAudioTrack } from 'livekit-client';

interface PreflightState {
  stream: MediaStream | null;
  cameraStream: MediaStream | null; // Camera stream for overlay when screen sharing
  token: string | null;
  roomName: string | null;
  url: string | null;
  // LiveKit room for seamless handoff to BroadcastPage
  livekitRoom: any | null;
  localTracks: [LocalAudioTrack | null, LocalVideoTrack | null] | null; // [audioTrack, videoTrack]
  // Track enabled states from setup page
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
}

const state: PreflightState = {
  stream: null,
  cameraStream: null,
  token: null,
  roomName: null,
  url: null,
  livekitRoom: null,
  localTracks: null,
  isVideoEnabled: true,
  isAudioEnabled: true,
};

export const PreflightStore = {
  setStream(stream: MediaStream | null) {
    state.stream = stream;
  },

  getStream() {
    return state.stream;
  },

  // Store camera stream for overlay when screen sharing
  setCameraStream(stream: MediaStream | null) {
    state.cameraStream = stream;
  },

  getCameraStream() {
    return state.cameraStream;
  },

  setToken(token: string | null, roomName: string | null, url: string | null) {
    state.token = token;
    state.roomName = roomName;
    state.url = url;
  },

  getToken() {
    return { token: state.token, roomName: state.roomName, url: state.url };
  },

  // Set LiveKit tracks for handoff to BroadcastPage
  setLivekitTracks(audioTrack: LocalAudioTrack | null, videoTrack: LocalVideoTrack | null) {
    state.localTracks = [audioTrack, videoTrack];
  },

  // Get LiveKit tracks for BroadcastPage
  getLivekitTracks(): [LocalAudioTrack | null, LocalVideoTrack | null] | null {
    return state.localTracks;
  },

  // Legacy method - kept for compatibility
  setAgoraClient(client: any | null, tracks: [any, any, any, any] | null) {
    // Convert legacy format to LiveKit format
    if (tracks && tracks[0]) {
      state.localTracks = [tracks[0], tracks[1]];
    }
  },

  getLivekitRoom() {
    return state.livekitRoom;
  },

  setLivekitRoom(room: any | null) {
    state.livekitRoom = room;
  },

  getLocalTracks() {
    return state.localTracks;
  },

  // Track enabled states from setup page
  setTrackEnabledStates(isVideoEnabled: boolean, isAudioEnabled: boolean) {
    state.isVideoEnabled = isVideoEnabled;
    state.isAudioEnabled = isAudioEnabled;
  },

  getTrackEnabledStates() {
    return { isVideoEnabled: state.isVideoEnabled, isAudioEnabled: state.isAudioEnabled };
  },

  clear() {
    // Stop all tracks in the stored stream before clearing
    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
    }
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach(track => track.stop());
    }
    // Stop LiveKit tracks if any
    if (state.localTracks) {
      state.localTracks.forEach(track => {
        if (track && typeof track.stop === 'function') {
          try {
            track.stop();
          } catch (e) {
            console.warn('Error stopping track in PreflightStore.clear():', e);
          }
        }
      });
    }
    // Disconnect from LiveKit room if connected
    if (state.livekitRoom) {
      try {
        state.livekitRoom.disconnect();
      } catch (e) {
        console.warn('Error disconnecting from LiveKit room in PreflightStore.clear():', e);
      }
    }
    state.stream = null;
    state.cameraStream = null;
    state.token = null;
    state.roomName = null;
    state.url = null;
    state.livekitRoom = null;
    state.localTracks = null;
    state.isVideoEnabled = true;
    state.isAudioEnabled = true;
  }
};
