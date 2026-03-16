import { create } from 'zustand';
import { StreamMode } from '../hooks/useScreenShare';

interface StreamState {
  // Screen sharing state
  screenTrack: any | null;
  cameraTrack: any | null;
  streamMode: StreamMode;
  screenPreviewStream: MediaStream | null;
  
  // Actions
  setScreenTrack: (track: any | null) => void;
  setCameraTrack: (track: any | null) => void;
  setStreamMode: (mode: StreamMode) => void;
  setScreenPreviewStream: (stream: MediaStream | null) => void;
  
  // Clear all tracks (call when stream ends)
  clearTracks: () => void;
  
  // Initialize from another stream (for navigation persistence)
  initializeTracks: (params: {
    screenTrack?: any | null;
    cameraTrack?: any | null;
    streamMode?: StreamMode;
    screenPreviewStream?: MediaStream | null;
  }) => void;
}

export const useStreamStore = create<StreamState>()((set, get) => ({
  // Initial state
  screenTrack: null,
  cameraTrack: null,
  streamMode: 'camera',
  screenPreviewStream: null,
  
  // Setters
  setScreenTrack: (track) => {
    console.log('[StreamStore] Setting screen track:', track ? 'available' : 'null');
    set({ screenTrack: track });
  },
  
  setCameraTrack: (track) => {
    console.log('[StreamStore] Setting camera track:', track ? 'available' : 'null');
    set({ cameraTrack: track });
  },
  
  setStreamMode: (mode) => {
    console.log('[StreamStore] Setting stream mode:', mode);
    set({ streamMode: mode });
  },
  
  setScreenPreviewStream: (stream) => {
    console.log('[StreamStore] Setting screen preview stream:', stream ? 'available' : 'null');
    set({ screenPreviewStream: stream });
  },
  
  // Clear all tracks
  clearTracks: () => {
    console.log('[StreamStore] Clearing all tracks');
    console.trace('clearTracks called from:');
    // Stop any existing tracks before clearing
    const { screenTrack, cameraTrack, screenPreviewStream } = get();
    
    if (screenTrack && typeof screenTrack.stop === 'function') {
      try {
        screenTrack.stop();
      } catch (e) {
        console.warn('[StreamStore] Error stopping screen track:', e);
      }
    }
    
    if (cameraTrack && typeof cameraTrack.stop === 'function') {
      try {
        cameraTrack.stop();
      } catch (e) {
        console.warn('[StreamStore] Error stopping camera track:', e);
      }
    }
    
    if (screenPreviewStream) {
      screenPreviewStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('[StreamStore] Error stopping preview track:', e);
        }
      });
    }
    
    set({
      screenTrack: null,
      cameraTrack: null,
      streamMode: 'camera',
      screenPreviewStream: null,
    });
  },
  
  // Initialize from params (for navigation persistence)
  initializeTracks: (params) => {
    console.log('[StreamStore] Initializing tracks from params');
    set({
      screenTrack: params.screenTrack ?? get().screenTrack,
      cameraTrack: params.cameraTrack ?? get().cameraTrack,
      streamMode: params.streamMode ?? get().streamMode,
      screenPreviewStream: params.screenPreviewStream ?? get().screenPreviewStream,
    });
  },
}));

export default useStreamStore;
