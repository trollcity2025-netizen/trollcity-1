interface PreflightState {
  stream: MediaStream | null;
  token: string | null;
  roomName: string | null;
}

const state: PreflightState = {
  stream: null,
  token: null,
  roomName: null,
};

export const PreflightStore = {
  setStream(stream: MediaStream | null) {
    state.stream = stream;
  },

  getStream() {
    return state.stream;
  },

  setToken(token: string | null, roomName: string | null) {
    state.token = token;
    state.roomName = roomName;
  },

  getToken() {
    return { token: state.token, roomName: state.roomName };
  },

  clear() {
    state.stream = null;
    state.token = null;
    state.roomName = null;
  }
};
