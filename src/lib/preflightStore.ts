import type { IAgoraRTCClient } from 'agora-rtc-sdk-ng';

interface PreflightState {
  stream: MediaStream | null;
  token: string | null;
  roomName: string | null;
  url: string | null;
  // Agora client and tracks for seamless handoff to BroadcastPage
  agoraClient: IAgoraRTCClient | null;
  localTracks: [any, any] | null; // [audioTrack, videoTrack]
}

const state: PreflightState = {
  stream: null,
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

  setToken(token: string | null, roomName: string | null, url: string | null) {
    state.token = token;
    state.roomName = roomName;
    state.url = url;
  },

  getToken() {
    return { token: state.token, roomName: state.roomName, url: state.url };
  },

  // Set Agora client and tracks for handoff to BroadcastPage
  setAgoraClient(client: IAgoraRTCClient | null, tracks: [any, any] | null) {
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
    state.stream = null;
    state.token = null;
    state.roomName = null;
    state.url = null;
    state.agoraClient = null;
    state.localTracks = null;
  }
};
