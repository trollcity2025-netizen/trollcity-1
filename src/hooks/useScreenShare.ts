import { useState, useCallback, useRef, useEffect } from 'react';
import AgoraRTC, { ILocalVideoTrack } from 'agora-rtc-sdk-ng';

export type StreamMode = 'camera' | 'screen';

export interface ScreenShareState {
  isSupported: boolean;
  isSharing: boolean;
  error: string | null;
}

/**
 * Check if screen sharing is supported in the current browser
 */
export function canScreenShare(): boolean {
  return typeof navigator !== 'undefined' && 
    !!navigator.mediaDevices && 
    'getDisplayMedia' in navigator.mediaDevices;
}

/**
 * Create a screen share video track using Agora
 */
export async function createScreenTrack(): Promise<ILocalVideoTrack> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: { ideal: 60, max: 60 },
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 }
    },
    audio: true
  });

  const videoTrack = await AgoraRTC.createCustomVideoTrack({
    mediaStreamTrack: stream.getVideoTracks()[0]
  });

  return videoTrack;
}

/**
 * Hook for managing screen sharing
 */
export function useScreenShare() {
  const [state, setState] = useState<ScreenShareState>({
    isSupported: canScreenShare(),
    isSharing: false,
    error: null
  });
  
  const screenStreamRef = useRef<MediaStream | null>(null);
  const onEndedCallbackRef = useRef<(() => void) | null>(null);

  /**
   * Start screen sharing
   */
  const startScreenShare = useCallback(async (): Promise<ILocalVideoTrack | null> => {
    if (!canScreenShare()) {
      setState(prev => ({ ...prev, error: 'Screen sharing not supported in this browser' }));
      return null;
    }

    try {
      setState(prev => ({ ...prev, error: null }));
      
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 }
        },
        audio: true
      });

      screenStreamRef.current = stream;
      
      // Handle user clicking "Stop sharing" in browser
      stream.getVideoTracks()[0].onended = () => {
        console.log('[useScreenShare] Screen share ended by user');
        setState(prev => ({ ...prev, isSharing: false }));
        if (onEndedCallbackRef.current) {
          onEndedCallbackRef.current();
        }
      };

      const videoTrack = await AgoraRTC.createCustomVideoTrack({
        mediaStreamTrack: stream.getVideoTracks()[0]
      });

      setState(prev => ({ ...prev, isSharing: true }));
      return videoTrack;
    } catch (err: any) {
      console.error('[useScreenShare] Error starting screen share:', err);
      setState(prev => ({ 
        ...prev, 
        error: err.message || 'Failed to start screen sharing',
        isSharing: false 
      }));
      return null;
    }
  }, []);

  /**
   * Stop screen sharing
   */
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setState(prev => ({ ...prev, isSharing: false }));
  }, []);

  /**
   * Set callback for when screen sharing ends
   */
  const onScreenShareEnded = useCallback((callback: () => void) => {
    onEndedCallbackRef.current = callback;
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopScreenShare();
    };
  }, [stopScreenShare]);

  return {
    ...state,
    startScreenShare,
    stopScreenShare,
    onScreenShareEnded
  };
}

export default useScreenShare;
