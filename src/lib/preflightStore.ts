import type { IAgoraRTCClient } from 'agora-rtc-sdk-ng';

interface PreflightState {
  stream: MediaStream | null;
  cameraStream: MediaStream | null; // Camera stream for overlay when screen sharing
  token: string | null;
  roomName: string | null;
  url: string | null;
  // Agora client and tracks for seamless handoff to BroadcastPage
  agoraClient: IAgoraRTCClient | null;
  localTracks: [any, any, any, any] | null; // [audioTrack, videoTrack, cameraAudioTrack?, cameraVideoTrack?]
}

const state: PreflightState = {
  stream: null,
  cameraStream: null,
  token: null,
  roomName: null,
  url: null,
  agoraClient: null,
  localTracks: null,
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

  // Set Agora client and tracks for handoff to BroadcastPage
  // tracks: [audioTrack, videoTrack, cameraAudioTrack?, cameraVideoTrack?]
  setAgoraClient(client: IAgoraRTCClient | null, tracks: [any, any, any, any] | null) {
    state.agoraClient = client;
    state.localTracks = tracks;
  },

  getAgoraClient() {
    return state.agoraClient;
  },

  getLocalTracks() {
    return state.localTracks;
  },

  clear() {
    // Stop all tracks in the stored stream before clearing
    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
    }
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach(track => track.stop());
    }
    // Stop Agora tracks if any
    if (state.localTracks) {
      state.localTracks.forEach(track => {
        if (track && typeof track.stop === 'function') {
          try {
            track.stop();
            if (typeof track.close === 'function') {
              track.close();
            }
          } catch (e) {
            console.warn('Error stopping track in PreflightStore.clear():', e);
          }
        }
      });
    }
    // Leave Agora client if connected
    if (state.agoraClient) {
      try {
        state.agoraClient.leave();
      } catch (e) {
        console.warn('Error leaving Agora client in PreflightStore.clear():', e);
      }
    }
    state.stream = null;
    state.cameraStream = null;
    state.token = null;
    state.roomName = null;
    state.url = null;
    state.agoraClient = null;
    state.localTracks = null;
  }
};
