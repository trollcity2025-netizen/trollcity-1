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
  const isPageVisible = useRef(true);
  const isUnmounting = useRef(false);

  /**
   * Start screen sharing using official Agora API
   */
  const startScreenShare = useCallback(async (): Promise<ILocalVideoTrack | null> => {
    try {
      setState(prev => ({ ...prev, error: null }));

      const screenTrack = await AgoraRTC.createScreenVideoTrack(
        {
          encoderConfig: "1080p_1",
          optimizationMode: "detail"
        },
        "auto"
      ) as ILocalVideoTrack;

      screenTrack.on("track-ended", () => {
        console.log("[useScreenShare] Screen share ended by user");
        setState(prev => ({ ...prev, isSharing: false }));
        if (onEndedCallbackRef.current) {
          onEndedCallbackRef.current();
        }
      });

      setState(prev => ({ ...prev, isSharing: true }));

      return screenTrack;
    } catch (err: any) {
      console.error("[useScreenShare] Error starting screen share:", err);

      setState(prev => ({
        ...prev,
        error: err.message || "Failed to start screen sharing",
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
   * Track page visibility to prevent cleanup on tab switch
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      const wasVisible = isPageVisible.current;
      isPageVisible.current = document.visibilityState === 'visible';
      
      console.log(`[useScreenShare] Visibility changed: ${wasVisible ? 'visible' : 'hidden'} -> ${isPageVisible.current ? 'visible' : 'hidden'}`);
      
      // If becoming visible again and we were sharing, check if stream still exists
      if (isPageVisible.current && state.isSharing && screenStreamRef.current) {
        const tracks = screenStreamRef.current.getTracks();
        const hasActiveTracks = tracks.some(track => track.readyState === 'live');
        
        if (!hasActiveTracks) {
          console.log('[useScreenShare] Screen share tracks ended while hidden');
          setState(prev => ({ ...prev, isSharing: false }));
          if (onEndedCallbackRef.current) {
            onEndedCallbackRef.current();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.isSharing]);

  /**
   * Cleanup on unmount - only if actually unmounting (not tab switch)
   */
  useEffect(() => {
    return () => {
      isUnmounting.current = true;
      // Small delay to check if this is a real unmount or just tab switch
      setTimeout(() => {
        if (isUnmounting.current && document.visibilityState !== 'hidden') {
          console.log('[useScreenShare] Real unmount - stopping screen share');
          stopScreenShare();
        } else {
          console.log('[useScreenShare] Tab switch detected - preserving screen share');
        }
      }, 100);
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
