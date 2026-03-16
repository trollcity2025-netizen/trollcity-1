import { useState, useCallback, useRef, useEffect } from 'react';
import { LocalVideoTrack } from 'livekit-client';

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
 * Create a screen share video track using LiveKit
 * LiveKit uses browser's getDisplayMedia and wraps it in a LocalVideoTrack
 */
export async function createScreenTrack(): Promise<LocalVideoTrack> {
  // Use browser's getDisplayMedia
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: { ideal: 60, max: 60 },
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 }
    },
    audio: true
  });

  // Create LiveKit LocalVideoTrack from the stream
  const videoTrack = new LocalVideoTrack(stream.getVideoTracks()[0], {
    name: 'screen-share'
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
  
  const screenTrackRef = useRef<LocalVideoTrack | null>(null);
  const onEndedCallbackRef = useRef<(() => void) | null>(null);
  const isPageVisible = useRef(true);
  const isUnmounting = useRef(false);

  /**
   * Start screen sharing
   */
  const startScreenShare = useCallback(async (): Promise<LocalVideoTrack | null> => {
    try {
      setState(prev => ({ ...prev, error: null }));

      // Get screen share stream from browser
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 }
        },
        audio: false // Audio handled separately if needed
      });

      // Create LiveKit LocalVideoTrack from the stream
      const videoTrack = new LocalVideoTrack(stream.getVideoTracks()[0], {
        name: 'screen-share'
      });

      screenTrackRef.current = videoTrack;

      // Listen for track ended event (user clicks "Stop sharing" in browser UI)
      stream.getVideoTracks()[0].onended = () => {
        console.log("[useScreenShare] Screen share ended by user");
        setState(prev => ({ ...prev, isSharing: false }));
        screenTrackRef.current = null;
        if (onEndedCallbackRef.current) {
          onEndedCallbackRef.current();
        }
      };

      setState(prev => ({ ...prev, isSharing: true }));

      return videoTrack;
    } catch (err: any) {
      console.error("[useScreenShare] Error starting screen share:", err);

      // User cancelled is not an error
      if (err.name === 'NotAllowedError') {
        setState(prev => ({
          ...prev,
          error: null,
          isSharing: false
        }));
        return null;
      }

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
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
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
      if (isPageVisible.current && state.isSharing && screenTrackRef.current) {
        // Track may have been stopped while hidden
        console.log('[useScreenShare] Checking screen share state after visibility change');
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
