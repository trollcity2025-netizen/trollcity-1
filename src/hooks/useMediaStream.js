import { useState, useRef, useCallback, useEffect } from 'react';

export function useMediaStream() {
  const [stream, setStream] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  const startStream = useCallback(async (options = {}) => {
    try {
      setError(null);

      // Check if camera is already in use
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      if (videoDevices.length === 0) {
        throw new Error('No camera found on this device');
      }

      // Request camera access with better constraints
      const constraints = {
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 60 }
        },
        audio: options.audio !== false ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      };

      console.log('Requesting media access with constraints:', constraints);

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Verify we got the tracks we requested
      const videoTracks = mediaStream.getVideoTracks();
      const audioTracks = mediaStream.getAudioTracks();

      if (videoTracks.length === 0) {
        throw new Error('Failed to access camera - no video track received');
      }

      console.log(`Media access granted: ${videoTracks.length} video, ${audioTracks.length} audio tracks`);

      setStream(mediaStream);
      setIsStreaming(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.muted = true; // Prevent feedback

        try {
          await videoRef.current.play();
        } catch (playErr) {
          if (playErr.name !== 'AbortError') {
            throw playErr;
          }
          // Ignore AbortError (interrupted by new load)
        }
      }

      return mediaStream;
    } catch (err) {
      console.error('Camera access error:', err);

      // Provide more specific error messages
      let errorMessage = err.message;
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera access denied. Please allow camera permissions and try again.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please connect a camera and try again.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Camera is already in use by another application.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Camera does not support the requested video quality.';
      } else if (err.name === 'SecurityError') {
        errorMessage = 'Camera access blocked due to security restrictions.';
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsStreaming(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  const attachToVideo = useCallback((videoElement) => {
    if (videoElement && stream) {
      videoElement.srcObject = stream;
      videoElement.muted = true;
      videoElement.play().catch(console.error);
    }
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    stream,
    isStreaming,
    error,
    videoRef,
    startStream,
    stopStream,
    attachToVideo
  };
}