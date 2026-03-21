import type { LocalVideoTrack, LocalAudioTrack, Room } from 'livekit-client';

interface PreflightState {
  token: string | null;
  roomName: string | null;
  url: string | null;
  // Track enabled states from setup page
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  // Battle mode flag - when true, TrollEngine should be hidden
  isInBattle: boolean;
  // Broadcast mode flag - when true, TrollEngine should be hidden (hosting or watching)
  isInBroadcast: boolean;
  // Global flag to disable battles - no users can start battles when true
  battlesDisabled: boolean;
  // LiveKit room and tracks from SetupPage
  livekitRoom: Room | null;
  livekitTracks: [LocalAudioTrack | null, LocalVideoTrack | null] | null;
}

const state: PreflightState = {
  token: null,
  roomName: null,
  url: null,
  isVideoEnabled: true,
  isAudioEnabled: true,
  isInBattle: false,
  isInBroadcast: false,
  battlesDisabled: true, // Default to disabled until further notice
  livekitRoom: null,
  livekitTracks: null,
};

export const PreflightStore = {
  setToken(token: string | null, roomName: string | null, url: string | null) {
    state.token = token;
    state.roomName = roomName;
    state.url = url;
  },

  getToken() {
    return { token: state.token, roomName: state.roomName, url: state.url };
  },

  // Track enabled states from setup page
  setTrackEnabledStates(isVideoEnabled: boolean, isAudioEnabled: boolean) {
    state.isVideoEnabled = isVideoEnabled;
    state.isAudioEnabled = isAudioEnabled;
  },

  getTrackEnabledStates() {
    return { isVideoEnabled: state.isVideoEnabled, isAudioEnabled: state.isAudioEnabled };
  },

  // Set battle mode - used to hide TrollEngine during battles
  setInBattle(inBattle: boolean) {
    state.isInBattle = inBattle;
    console.log('[PreflightStore] setInBattle:', inBattle);
  },

  // Get battle mode status
  getInBattle(): boolean {
    return state.isInBattle;
  },

  // Set broadcast mode - used to hide TrollEngine when broadcasting or watching
  setInBroadcast(inBroadcast: boolean) {
    state.isInBroadcast = inBroadcast;
    console.log('[PreflightStore] setInBroadcast:', inBroadcast);
  },

  // Get broadcast mode status
  getInBroadcast(): boolean {
    return state.isInBroadcast;
  },

  // Set battles disabled/enabled - globally blocks battle functionality when true
  setBattlesDisabled(disabled: boolean) {
    state.battlesDisabled = disabled;
    console.log('[PreflightStore] setBattlesDisabled:', disabled);
  },

  // Get battles disabled status
  getBattlesDisabled(): boolean {
    return state.battlesDisabled;
  },

  // Store LiveKit room from SetupPage
  setLivekitRoom(room: Room | null) {
    state.livekitRoom = room;
  },

  // Get LiveKit room for reuse in BroadcastPage
  getLivekitRoom(): Room | null {
    return state.livekitRoom;
  },

  // Store LiveKit tracks from SetupPage
  setLivekitTracks(tracks: [LocalAudioTrack | null, LocalVideoTrack | null] | null) {
    state.livekitTracks = tracks;
  },

  // Get LiveKit tracks for reuse in BroadcastPage
  getLivekitTracks(): [LocalAudioTrack | null, LocalVideoTrack | null] | null {
    return state.livekitTracks;
  },

  clear() {
    state.token = null;
    state.roomName = null;
    state.url = null;
    state.isVideoEnabled = true;
    state.isAudioEnabled = true;
    state.isInBattle = false;
    state.isInBroadcast = false;
    state.battlesDisabled = true; // Keep battles disabled on clear
    state.livekitRoom = null;
    state.livekitTracks = null;
  }
};
