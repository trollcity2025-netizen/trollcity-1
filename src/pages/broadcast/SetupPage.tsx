import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { PreflightStore } from '@/lib/preflightStore';
import { useStreamStore } from '@/lib/streamStore';
import AgoraRTC, { ILocalAudioTrack, ILocalVideoTrack } from 'agora-rtc-sdk-ng';
import { Video, VideoOff, Mic, MicOff, RefreshCw, Swords, Gamepad2, Camera, Monitor } from 'lucide-react';
import { useScreenShare, StreamMode, canScreenShare } from '../../hooks/useScreenShare';
import { GamingSetup } from '../../components/broadcast/GamingSetup';
import { toast } from 'sonner';
import { generateUUID } from '../../lib/uuid';
import {
  BROADCAST_CATEGORIES,
  getCategoryConfig,
  supportsBattles,
  getMatchingTerminology,
  requiresReligion,
  forceRearCamera,
  allowFrontCamera,
  getMaxBoxCount,
  AVAILABLE_RELIGIONS,
  BroadcastCategoryId
} from '../../config/broadcastCategories';



export default function SetupPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<BroadcastCategoryId>('general');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const fromQuery = params.get('category');
      if (fromQuery && (fromQuery in BROADCAST_CATEGORIES)) {
        setCategory(fromQuery as BroadcastCategoryId);
      }
    } catch {
      // ignore
    }
  }, [location.search]);

  useEffect(() => {
    if (!title.trim() && profile?.username) {
      setTitle(`${profile.username}'s Live`);
    }
  }, [profile?.username, title]);
  
  // Category-specific state
  const [selectedReligion, setSelectedReligion] = useState('');
  
  // Pre-generate stream ID for token optimization
  const [streamId] = useState(() => generateUUID());

  // Track if we are navigating to broadcast to prevent cleanup
  const isStartingStream = useRef(false);
  // Track page visibility to prevent refresh on tab switch
  const isPageVisible = useRef(true);
  const isTabSwitching = useRef(false);


  // Get category config
  const categoryConfig = getCategoryConfig(category);
  const categoryRequiresReligion = requiresReligion(category);
  const shouldForceRearCamera = forceRearCamera(category);
  const canUseFrontCamera = allowFrontCamera(category);
  const categorySupportsBattles = supportsBattles(category);
  const categoryMatchingTerm = getMatchingTerminology(category);


  // Media state
  // Changed from HTMLVideoElement to HTMLDivElement - Agora will create the video element
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [agoraTracks, setAgoraTracks] = useState<[ILocalAudioTrack | null, ILocalVideoTrack | null]>([null, null]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [hasRearCamera, setHasRearCamera] = useState(false); // New state for rear camera detection
  const [followerCount, setFollowerCount] = useState<number>(0);

  // Stream mode for gaming category (camera vs screen share)
  const screenShare = useScreenShare();
  
  // Use global stream store for persistence across navigation
  const {
    screenTrack,
    setScreenTrack,
    streamMode,
    setStreamMode,
    screenPreviewStream,
    setScreenPreviewStream,
    clearTracks,
  } = useStreamStore();

  // Persist screen share state in sessionStorage for tab switch restoration
  useEffect(() => {
    if (screenTrack) {
      console.log('[SetupPage] Screen track active - storing state');
      sessionStorage.setItem('tc_screen_share_active', 'true');
      sessionStorage.setItem('tc_stream_mode', 'screen');
    } else {
      sessionStorage.removeItem('tc_screen_share_active');
      sessionStorage.setItem('tc_stream_mode', streamMode);
    }
  }, [screenTrack, streamMode]);

  // Restore screen share state when returning to tab
  useEffect(() => {
    const wasScreenSharing = sessionStorage.getItem('tc_screen_share_active') === 'true';
    if (wasScreenSharing && streamMode === 'camera' && !screenTrack) {
      console.log('[SetupPage] Restoring screen share mode from session storage');
      setStreamMode('screen');
    }
  }, []);

  // Permission state - track if camera/mic permissions need to be requested
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);



  // Set stream mode based on category
  useEffect(() => {
    if (category !== 'gaming') {
      // Reset to camera mode for non-gaming categories
      setStreamMode('camera');
    }
    // Note: For gaming, we don't auto-switch - let user choose between camera/screen
  }, [category]);

  // Handle camera facing mode based on category
  useEffect(() => {
    if (shouldForceRearCamera) {
      setFacingMode('environment');
    } else if (!canUseFrontCamera) {
      // If front camera not allowed but we were on it, switch to rear
      if (facingMode === 'user') {
        setFacingMode('environment');
      }
    }
    }, [category, shouldForceRearCamera, canUseFrontCamera, facingMode]);

  // Effect to detect available cameras
  useEffect(() => {
    const enumerateCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
        setHasRearCamera(videoDevices.some(device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')));
      } catch (err) {
        console.error('Error enumerating devices:', err);
        setHasMultipleCameras(false);
        setHasRearCamera(false);
      }
    };
    enumerateCameras();
  }, []); // Run once on mount

  // Fetch follower count for Trollmers eligibility
  useEffect(() => {
    async function fetchFollowerCount() {
      if (!user?.id) return;
      const { count } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);
      setFollowerCount(count || 0);
    }
    fetchFollowerCount();
  }, [user?.id]);

  // Check camera/mic permissions when component mounts
  useEffect(() => {
    const checkPermissions = async () => {
      // Try to get media directly first - this is the most reliable way to check
      // and allows the browser's native permission flow to work
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // If successful, stop the test stream and proceed
        testStream.getTracks().forEach(track => track.stop());
        setPermissionStatus('granted');
        setShowPermissionPrompt(false);
        localStorage.setItem('tc_camera_permissions_granted', 'true');
        return;
      } catch (err: any) {
        // If permission denied, show our custom prompt
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionStatus('denied');
          setShowPermissionPrompt(true);
          return;
        }
        // For other errors (no devices, etc.), don't block - let the main flow handle it
        setShowPermissionPrompt(false);
      }
    };

    checkPermissions();
  }, []);

  // Request camera and microphone permissions
  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      
      // Stop the test stream immediately - we just wanted the permission
      stream.getTracks().forEach(track => track.stop());
      
      // Store permission granted flag
      localStorage.setItem('tc_camera_permissions_granted', 'true');
      localStorage.setItem('tc_camera_permissions_timestamp', Date.now().toString());
      
      setPermissionStatus('granted');
      setShowPermissionPrompt(false);
      
      toast.success('Camera and microphone permissions granted!');
      
      // Trigger the media acquisition effect
      // The existing useEffect will pick up the permission change
    } catch (err: any) {
      console.error('Permission request failed:', err);
      
      if (err.name === 'NotAllowedError') {
        setPermissionStatus('denied');
        toast.error('Camera permission denied. Please allow access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        toast.error('No camera or microphone found. Please check your devices.');
      } else {
        toast.error('Could not access camera or microphone: ' + err.message);
      }
    }
  };

  const acquireMediaStream = async (videoFacingMode: 'user' | 'environment', enableVideo: boolean): Promise<MediaStream | null> => {
    console.log('[acquireMediaStream] Attempting to acquire media stream...');

    // Check for getUserMedia support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errorMsg = 'getUserMedia not supported in this browser/context';
      console.error(`[acquireMediaStream] ${errorMsg}`);
      const isSecure = window.isSecureContext;

      if (!isSecure) {
         toast.error(
           <div className="flex flex-col gap-1">
             <span className="font-bold">Camera Blocked by Browser Security</span>
             <span className="text-xs">
               Browsers block camera access on HTTP (http://{window.location.host}).
               <br/><br/>
               <strong>FIX for Chrome/Edge:</strong>
               <br/>
               1. Go to <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>
               <br/>
               2. Add <code>http://{window.location.hostname}:5176</code>
               <br/>
               3. Enable & Relaunch
             </span>
           </div>,
           { duration: 10000 }
         );
      } else {
         toast.error('Camera access is not supported in this browser.');
      }
      return null;
    }

    try {
      // Create Agora tracks instead of raw MediaStream
      console.log('[acquireMediaStream] Creating Agora tracks...');
      
      let audioTrack: ILocalAudioTrack | null = null;
      let videoTrack: ILocalVideoTrack | null = null;

      // Create audio track
      try {
        audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        console.log('[acquireMediaStream] Audio track created:', audioTrack.getTrackId?.());
      } catch (audioErr) {
        console.warn('[acquireMediaStream] Failed to create audio track:', audioErr);
      }

      // Create video track if enabled
      if (enableVideo) {
        try {
          videoTrack = await AgoraRTC.createCameraVideoTrack({
            facingMode: videoFacingMode,
          });
          console.log('[acquireMediaStream] Video track created:', videoTrack.getTrackId?.());
        } catch (videoErr) {
          console.warn('[acquireMediaStream] Failed to create video track:', videoErr);
          toast.warning('Camera not found. Audio only mode.');
          setIsVideoEnabled(false);
        }
      }

      // Store Agora tracks for reuse in BroadcastPage
      setAgoraTracks([audioTrack, videoTrack]);
      
      // Also store in PreflightStore for handoff
      PreflightStore.setAgoraClient(null, [audioTrack, videoTrack, null, null]);
      console.log('[acquireMediaStream] Agora tracks stored in PreflightStore');

      // IMPORTANT: Use Agora's play() method instead of manually creating MediaStream
      // This ensures proper playback management by Agora SDK
      if (videoTrack && videoContainerRef.current) {
        console.log('[acquireMediaStream] Playing video track in container using Agora play()');
        videoTrack.play(videoContainerRef.current, {
          fit: 'cover',
          // Mirror local video for better user experience (self-view)
          mirror: videoFacingMode === 'user'
        });
      }

      // Create a MediaStream from Agora tracks for compatibility with existing code
      // This is used for state management but the actual playback is handled by Agora
      const mediaStream = new MediaStream();
      if (audioTrack) {
        mediaStream.addTrack(audioTrack.getMediaStreamTrack());
      }
      if (videoTrack) {
        mediaStream.addTrack(videoTrack.getMediaStreamTrack());
      }
      
      console.log('[acquireMediaStream] MediaStream created from Agora tracks:', {
        audioTracks: mediaStream.getAudioTracks().length,
        videoTracks: mediaStream.getVideoTracks().length
      });
      
      return mediaStream;
    } catch (err: any) {
      console.error('[acquireMediaStream] Error creating Agora tracks:', err);
      toast.error('Failed to access camera/microphone: ' + err.message);
      return null;
    }
  };

  // Prevent page refresh/close when on setup page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only prevent if not currently starting the stream
      if (!isStartingStream.current) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Cleanup session storage when component unmounts (user leaves setup page)
  useEffect(() => {
    return () => {
      // Only clear if not starting stream and not in a tab switch
      // Tab switches are handled by the visibilitychange listener
      if (!isStartingStream.current && !isTabSwitching.current) {
        console.log('[SetupPage] Cleanup: Clearing session storage flags (actual page leave)');
        sessionStorage.removeItem('tc_setup_initialized');
        sessionStorage.removeItem('tc_tab_switching');
        sessionStorage.removeItem('tc_screen_share_active');
        sessionStorage.removeItem('tc_stream_mode');
      } else {
        console.log('[SetupPage] Cleanup: Preserving session storage (tab switch or stream start)');
      }
    };
  }, []);

  // Track page visibility to prevent stream cleanup on tab switch
  useEffect(() => {
    const handleVisibilityChange = () => {
      const wasVisible = isPageVisible.current;
      isPageVisible.current = document.visibilityState === 'visible';
      
      console.log(`[SetupPage] Visibility changed: ${wasVisible ? 'visible' : 'hidden'} -> ${isPageVisible.current ? 'visible' : 'hidden'}`);
      
      // Track if this is a tab switch (was visible, now hidden, or vice versa)
      if (wasVisible !== isPageVisible.current) {
        isTabSwitching.current = true;
        // Store in sessionStorage to persist across the tab switch
        if (!isPageVisible.current) {
          sessionStorage.setItem('tc_tab_switching', 'true');
        }
        // Reset after a short delay
        setTimeout(() => {
          isTabSwitching.current = false;
        }, 500);
      }
      
      // When tab becomes visible again, don't re-acquire media if we already have it
      // This prevents screen share from being lost when switching tabs
      if (isPageVisible.current && wasVisible === false) {
        console.log('[SetupPage] Tab became visible - checking if stream needs restoration');
        
        // If we have a screen share track but lost the stream state, try to restore it
        if (streamMode === 'screen' && !stream && screenTrack) {
          console.log('[SetupPage] Screen share mode active but no stream - state may have been lost');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [streamMode, stream, screenTrack]);

  useEffect(() => {
    // Only acquire media if permissions have been granted
    if (showPermissionPrompt) {
      console.log('[SetupPage] Waiting for user to grant permissions.');
      return;
    }

    // Check sessionStorage for tab switch state (persists across tab visibility changes)
    const wasInitialized = sessionStorage.getItem('tc_setup_initialized') === 'true';
    const isReturningFromTabSwitch = sessionStorage.getItem('tc_tab_switching') === 'true';
    
    // Skip re-initialization if:
    // 1. We've already initialized (sessionStorage flag is set)
    // 2. We have an existing stream
    // 3. We're returning from a tab switch
    // This prevents the camera from refreshing when switching tabs
    if (wasInitialized && stream && isReturningFromTabSwitch) {
      console.log('[SetupPage] Returning from tab switch with existing stream, skipping re-acquisition');
      // Clear the tab switching flag
      sessionStorage.removeItem('tc_tab_switching');
      return;
    }

    // Mark as initialized immediately to prevent duplicate runs
    sessionStorage.setItem('tc_setup_initialized', 'true');
    
    console.log('[SetupPage] Media acquisition useEffect triggered. facingMode:', facingMode, 'isVideoEnabled:', isVideoEnabled, 'wasInitialized:', wasInitialized);
    let currentLocalStream: MediaStream | null = null;
    const isMounted = { current: true };

    navigator.mediaDevices?.enumerateDevices().then(devices => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
    });

    async function getInitialMedia() {
      console.log('[SetupPage] getInitialMedia called. Existing stream state:', stream ? 'available' : 'not available');
      
      // For camera mode: Stop previous tracks if any (but only if we're actually changing camera settings)
      // For screen mode: Don't stop - the screen share should persist
      if (stream && streamMode === 'camera') {
          console.log('[SetupPage] Stopping previous camera media tracks.');
          stream.getTracks().forEach(track => track.stop());
      }

      // If we're in screen share mode and already have a screen track, don't re-acquire camera
      if (streamMode === 'screen' && screenTrack) {
        console.log('[SetupPage] Screen share mode active with track - skipping camera acquisition');
        return;
      }

      const mediaStream = await acquireMediaStream(facingMode, isVideoEnabled);
      
      if (!isMounted.current) {
        console.log('[SetupPage] Component unmounted before media acquisition completed.');
        mediaStream?.getTracks().forEach(track => track.stop());
        return;
      }

      if (!mediaStream) {
        console.error('[SetupPage] getInitialMedia: Failed to acquire media stream.');
        return;
      }

      console.log('[SetupPage] getInitialMedia: Media stream successfully acquired, setting state.');
      currentLocalStream = mediaStream;
      setStream(mediaStream);

      // Note: Video is now played via Agora's play() method in acquireMediaStream
      // No need to manually attach srcObject - Agora manages the video element
      console.log('[SetupPage] Video playback handled by Agora SDK via play() method');
    }
    getInitialMedia();

    return () => {
      isMounted.current = false;
      // Stop Agora video track playback when component unmounts or re-renders
      // This prevents duplicate video elements and memory leaks
      if (agoraTracks[1]) {
        console.log('[SetupPage] Cleanup: Stopping Agora video track playback');
        agoraTracks[1].stop();
      }
      
      // Don't cleanup on tab switches - only on actual unmount or stream start
      // Use the current ref value, not a captured one, to get latest state
      if (currentLocalStream && !isStartingStream.current) {
        // Check if this is a tab switch (isTabSwitching will be true for 500ms after visibility change)
        if (isTabSwitching.current || !isPageVisible.current) {
          console.log('[SetupPage] Cleanup: Tab switch detected - preserving media stream.');
          PreflightStore.setStream(currentLocalStream);
        } else {
          console.log('[SetupPage] Cleanup: Cleaning up media stream on unmount.');
          currentLocalStream.getTracks().forEach(track => track.stop());
        }
      } else if (isStartingStream.current && currentLocalStream) {
        console.log('[SetupPage] Cleanup: Preserving media stream for broadcast (natural unmount).');
        PreflightStore.setStream(currentLocalStream);
      }
    };
  }, [facingMode, isVideoEnabled, showPermissionPrompt, streamMode, screenTrack]);

  const toggleVideo = async () => {
    const newState = !isVideoEnabled;
    if (agoraTracks[1]) {
      await agoraTracks[1].setEnabled(newState);
      console.log('[SetupPage] Video track enabled set to:', newState);
    }
    setIsVideoEnabled(newState);
  };

  const toggleAudio = async () => {
    const newState = !isAudioEnabled;
    if (agoraTracks[0]) {
      await agoraTracks[0].setEnabled(newState);
      console.log('[SetupPage] Audio track enabled set to:', newState);
    }
    setIsAudioEnabled(newState);
  };

  const flipCamera = async () => {
    if (!canUseFrontCamera && facingMode === 'environment') {
      toast.error('Front camera is not available for this category');
      return;
    }
    
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    
    // Recreate video track with new facing mode
    if (agoraTracks[1]) {
      try {
        console.log('[SetupPage] Recreating video track with facing mode:', newFacingMode);
        // Stop and close current video track
        agoraTracks[1].stop();
        agoraTracks[1].close();
        
        // Create new video track with new facing mode
        const newVideoTrack = await AgoraRTC.createCameraVideoTrack({
          facingMode: newFacingMode,
        });
        
        // Update state
        setAgoraTracks([agoraTracks[0], newVideoTrack]);
        PreflightStore.setAgoraClient(null, [agoraTracks[0], newVideoTrack, null, null]);
        
        // Update preview stream
        const newStream = new MediaStream();
        if (agoraTracks[0]) {
          newStream.addTrack(agoraTracks[0].getMediaStreamTrack());
        }
        newStream.addTrack(newVideoTrack.getMediaStreamTrack());
        setStream(newStream);
        
        // Use Agora's play() method instead of srcObject
        if (videoContainerRef.current) {
          // Stop any previous video track playback
          if (agoraTracks[1]) {
            agoraTracks[1].stop();
          }
          // Play new track in container
          newVideoTrack.play(videoContainerRef.current, {
            fit: 'cover',
            mirror: newFacingMode === 'user'
          });
          console.log('[SetupPage] New video track playing via Agora play()');
        }
        
        console.log('[SetupPage] Video track recreated successfully');
      } catch (err) {
        console.error('[SetupPage] Failed to recreate video track:', err);
        toast.error('Failed to switch camera');
      }
    }
  };

  // Toggle screen sharing for gaming mode
  const toggleScreenShare = async () => {
    if (streamMode === 'screen') {
      // Switch back to camera mode
      screenShare.stopScreenShare();
      setScreenTrack(null);
      setScreenPreviewStream(null);
      setStreamMode('camera');
      // Re-acquire camera stream
      const mediaStream = await acquireMediaStream(facingMode, isVideoEnabled);
      if (mediaStream) {
        setStream(mediaStream);
        // Video is now played via Agora's play() method in acquireMediaStream
      }
      toast.info('Switched to camera mode');
    } else {
      // Switch to screen share mode
      // First, stop camera stream to free up resources
      if (stream) {
        console.log('[toggleScreenShare] Stopping camera stream before screen share');
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }

      const track = await screenShare.startScreenShare();
      if (track) {
        setScreenTrack(track);
        setStreamMode('screen');

        // Use Agora's play() method for screen share preview
        if (videoContainerRef.current) {
          track.play(videoContainerRef.current, {
            fit: 'contain', // Use contain for screen share to show full screen
            mirror: false   // Don't mirror screen share
          });
          console.log('[SetupPage] Screen track playing via Agora play()');
        }

        // Create preview stream for state management
        const mediaStreamTrack = track.getMediaStreamTrack();
        if (mediaStreamTrack) {
          const previewStream = new MediaStream([mediaStreamTrack]);
          setScreenPreviewStream(previewStream);
        }

        toast.success('Screen sharing started!');

        // Handle when user stops sharing via browser UI
        screenShare.onScreenShareEnded(() => {
          setScreenTrack(null);
          setScreenPreviewStream(null);
          setStreamMode('camera');
          // Stop screen track playback
          track.stop();
          // Re-acquire camera stream when screen share ends
          acquireMediaStream(facingMode, isVideoEnabled).then(mediaStream => {
            if (mediaStream) {
              setStream(mediaStream);
              // Video will be played via Agora's play() in acquireMediaStream
            }
          });
          toast.info('Screen sharing ended');
        });
      } else {
        toast.error(screenShare.error || 'Failed to start screen sharing');
        // Re-acquire camera stream on failure
        const mediaStream = await acquireMediaStream(facingMode, isVideoEnabled);
        if (mediaStream) {
          setStream(mediaStream);
          // Video will be played via Agora's play() in acquireMediaStream
        }
      }
    }
  };

  const handleStartStream = async () => {
    // Mark that we're starting the stream to prevent cleanup from stopping tracks
    isStartingStream.current = true;
    console.log('[SetupPage] Starting stream - isStartingStream set to true');

    // Clear session storage flags when starting stream
    sessionStorage.removeItem('tc_setup_initialized');
    sessionStorage.removeItem('tc_tab_switching');
    sessionStorage.removeItem('tc_screen_share_active');
    sessionStorage.removeItem('tc_stream_mode');

    if (!title.trim()) {
      toast.error('Please enter a stream title');
      return;
    }

    // Check religion requirement for spiritual category
    if (categoryRequiresReligion && !selectedReligion) {
      toast.error('Please select your religion');
      return;
    }

    // Check Trollmers requirements
    if (category === 'trollmers') {
      if (followerCount < 1) {
        toast.error('Trollmers requires 1+ followers');
        return;
      }
      if (!isVideoEnabled) {
        toast.error('Trollmers requires camera enabled');
        return;
      }
    }

    // Check President Elections requirements - only admin, secretary, lead_troll_officer, troll_officer
    if (category === 'election') {
      const allowedRoles = ['admin', 'secretary', 'lead_troll_officer', 'troll_officer'];
      if (!profile?.role || !allowedRoles.includes(profile.role)) {
        toast.error('President Elections category is only available to admins and officers');
        return;
      }
    }

    // Check camera requirement for categories that need it, unless screen sharing is active
    if (categoryConfig.requiresCamera && !isVideoEnabled) {
      toast.error(`Camera is required for ${categoryConfig.name}`);
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('streams')
        .insert({
          id: streamId,
          user_id: user.id,
          title,
          category,
          stream_kind: category === 'trollmers' ? 'trollmers' : 'regular',
          camera_ready: isVideoEnabled,
          status: 'pending',
          is_live: false,
          box_count: categoryConfig.defaultBoxCount,
          layout_mode: categoryConfig.layoutMode === 'debate' ? 'split' :
                       categoryConfig.layoutMode === 'classroom' ? 'grid' :
                       categoryConfig.layoutMode === 'spotlight' ? 'spotlight' : 'grid',
          // Store category-specific data
          ...(category === 'spiritual' && { selected_religion: selectedReligion }),
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      // =====================================================
      // MANUAL AGORA SETUP - Production pattern
      // =====================================================
      
      // 1. Generate numeric UID for Agora (consistent hash)
      const stringToUid = (str: string): number => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = (hash << 5) - hash + str.charCodeAt(i);
          hash |= 0;
        }
        return Math.abs(hash);
      };
      const numericUid = stringToUid(user.id);
      
      // 2. Fetch token from supabase edge function
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('agora-token', {
        body: {
          channel: streamId,
          uid: numericUid,
          role: 'publisher'
        }
      });
      
      if (tokenError) {
        console.error('[SetupPage] Token fetch error:', tokenError);
        throw new Error('Failed to get streaming token');
      }
      
      if (!tokenData?.token) {
        throw new Error('No token available for streaming');
      }
      
      console.log("TOKEN APP ID:", tokenData?.appId);
      console.log("TOKEN LENGTH:", tokenData?.token?.length);

      // NOTE: Do NOT join Agora channel in SetupPage - BroadcastPage will handle joining
      // This prevents UID_CONFLICT errors when BroadcastPage creates its own fresh client
      console.log('[SetupPage] Skipping Agora join - BroadcastPage will handle connection');

      // Store stream info in sessionStorage for BroadcastPage to use
      sessionStorage.setItem('tc_stream_token', tokenData.token);
      sessionStorage.setItem('tc_stream_uid', numericUid.toString());

      // Store App ID if provided by token endpoint
      if (tokenData?.appId) {
        sessionStorage.setItem('tc_stream_app_id', tokenData.appId);
      }

      // Store screen share state in sessionStorage for BroadcastPage to read
      // Note: The actual screenTrack is stored in the global streamStore and will persist across navigation
      if (streamMode === 'screen' && screenTrack) {
        sessionStorage.setItem('tc_broadcast_screen_mode', 'true');
        console.log('[handleStartStream] Screen share mode active - storing for BroadcastPage', {
          category,
          streamMode,
          hasScreenTrack: !!screenTrack,
          trackId: screenTrack.getTrackId?.()
        });
      } else {
        sessionStorage.removeItem('tc_broadcast_screen_mode');
        console.log('[handleStartStream] Screen share mode NOT active', {
          category,
          streamMode,
          hasScreenTrack: !!screenTrack
        });
      }

      // Update stream status
      await supabase
        .from('streams')
        .update({
          status: 'starting',
          is_live: true,
          started_at: new Date().toISOString()
        })
        .eq('id', streamId);

      // Ensure video state reflects actual track state before storing
      const hasVideoTrack = agoraTracks[1] !== null;
      const videoTrackEnabled = agoraTracks[1]?.enabled ?? false;
      const actualVideoEnabled = isVideoEnabled && hasVideoTrack && videoTrackEnabled;
      
      console.log('[SetupPage] Storing track enabled states:', {
        isVideoEnabled,
        isAudioEnabled,
        hasVideoTrack,
        videoTrackEnabled,
        actualVideoEnabled
      });
      
      // Store the actual state, not just the toggle state
      PreflightStore.setTrackEnabledStates(actualVideoEnabled, isAudioEnabled);

      // Update Agora track enabled states to match UI
      if (agoraTracks[0]) {
        await agoraTracks[0].setEnabled(isAudioEnabled);
        console.log('[SetupPage] Audio track enabled set to:', isAudioEnabled);
      }
      if (agoraTracks[1]) {
        await agoraTracks[1].setEnabled(isVideoEnabled);
        console.log('[SetupPage] Video track enabled set to:', isVideoEnabled);
      }

      // Store Agora tracks in PreflightStore for BroadcastPage to use
      // IMPORTANT: We don't stop the tracks - they will be reused
      PreflightStore.setAgoraClient(null, [agoraTracks[0], agoraTracks[1], null, null]);
      console.log('[SetupPage] Agora tracks stored for BroadcastPage reuse:', {
        hasAudio: !!agoraTracks[0],
        hasVideo: !!agoraTracks[1],
        audioEnabled: agoraTracks[0]?.enabled,
        videoEnabled: agoraTracks[1]?.enabled
      });

      // DO NOT stop the tracks - they will be reused by BroadcastPage
      // The tracks are stored in PreflightStore and will persist across navigation

      // Navigate to broadcast page
      navigate(`/broadcast/${data.id}`);

      supabase.from('global_events').insert([
        { title: `${profile.username} just went live!`, icon: 'live', priority: 2 },
      ]).then();
    } catch (err: any) {
      console.error('Error creating stream:', err);
      toast.error(err.message || 'Failed to start stream');
    } finally {
      setLoading(false);
    }
  };





  // Render Religion Selector for Spiritual category
  const renderReligionSelector = () => {
    if (!categoryRequiresReligion) return null;
    
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Select Your Faith *
        </label>
        <select
          value={selectedReligion}
          onChange={(e) => setSelectedReligion(e.target.value)}
          className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-gray-300"
        >
          <option value="">Choose your religion...</option>
          {AVAILABLE_RELIGIONS.map(religion => (
            <option key={religion} value={religion}>{religion}</option>
          ))}
        </select>
        <p className="text-xs text-gray-500">
          You&apos;ll only be matched with broadcasters of the same faith
        </p>
      </div>
    );
  };

  // Render Battle/Match info for categories that support it
  const renderBattleInfo = () => {
    if (!categorySupportsBattles) return null;
    
    return (
      <div className="bg-gradient-to-r from-amber-500/10 to-rose-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-amber-400">
          <Swords size={18} />
          <span className="font-semibold">{categoryMatchingTerm} Available</span>
        </div>
        
        {category === 'trollmers' && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Followers:</span>
              <span className={`font-bold ${followerCount >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                {followerCount} / 1
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Camera Ready:</span>
              <span className={`font-bold ${isVideoEnabled ? 'text-green-400' : 'text-red-400'}`}>
                {isVideoEnabled ? '✓ Yes' : '✗ No'}
              </span>
            </div>
            {followerCount < 1 && !isVideoEnabled && (
              <p className="text-xs text-amber-300 mt-2">
                ⚠️ Trollmers requires 1+ followers and camera enabled
              </p>
            )}
            {followerCount < 1 && isVideoEnabled && (
              <p className="text-xs text-amber-300 mt-2">
                ⚠️ Trollmers requires 1+ followers
              </p>
            )}
            {followerCount >= 1 && !isVideoEnabled && (
              <p className="text-xs text-amber-300 mt-2">
                ⚠️ Trollmers requires camera enabled
              </p>
            )}
          </>
        )}
        
        {category === 'business' && (
          <p className="text-xs text-gray-400">
            Click the {categoryMatchingTerm} button during your broadcast to find other business broadcasters to connect with.
          </p>
        )}
        
        {category === 'spiritual' && (
          <p className="text-xs text-gray-400">
            Click the {categoryMatchingTerm} button during your broadcast to find other broadcasters of the same faith.
          </p>
        )}
      </div>
    );
  };

  // Render category-specific info
  const renderCategoryInfo = () => {
    switch (category) {
      case 'debate':
        return (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-sm">
            <p className="text-blue-300">⚖️ Split-screen debate layout with exactly 2 participants</p>
          </div>
        );
      case 'education':
        return (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-sm">
            <p className="text-green-300">📚 Classroom layout - You're the Teacher, guests are Students</p>
          </div>
        );
      case 'fitness':
        return (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 text-sm">
            <p className="text-orange-300">💪 One-way broadcast - You're the Trainer</p>
          </div>
        );
      case 'irl':
        return (
          <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-3 text-sm">
            <p className="text-pink-300">📍 Rear camera only for first-person streaming</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Preview Section */}
        <div className="space-y-4">
          <div className="aspect-video bg-black rounded-2xl overflow-hidden relative border border-white/10 shadow-2xl">
            {showPermissionPrompt ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-6 text-center">
                <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4">
                  <Video size={32} className="text-yellow-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Camera & Microphone Access Required</h3>
                <p className="text-sm text-gray-400 mb-4 max-w-xs">
                  We need permission to access your camera and microphone for streaming.
                  This is required to go live.
                </p>
                {permissionStatus === 'denied' ? (
                  <div className="space-y-2">
                    <p className="text-xs text-red-400">
                      Permission was denied. Please enable camera/microphone access in your browser settings.
                    </p>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={requestPermissions}
                    className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-amber-600 text-black font-bold rounded-xl hover:from-yellow-300 hover:to-amber-500 transition-all transform active:scale-95"
                  >
                    Allow Camera & Microphone
                  </button>
                )}
              </div>
            ) : (
              // Container div for Agora video playback
              // Agora SDK will create and manage the video element inside this container
              <div
                ref={videoContainerRef}
                className="absolute inset-0 w-full h-full bg-black overflow-hidden"
                style={{
                  zIndex: 1,
                  // Mirror effect for front camera is handled by Agora's play() method
                }}
              />
            )}
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/50 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">
              <button
                type="button"
                onClick={toggleVideo}
                className={`p-3 rounded-full transition-colors ${isVideoEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-600/80'}`}

                disabled={false}

                title={categoryConfig.requiresCamera && !isVideoEnabled ? 'Camera required for this category' : 'Toggle camera'}
              >
                {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
              <button
                type="button"
                onClick={toggleAudio}
                className={`p-3 rounded-full transition-colors ${isAudioEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-600/80'}`}
              >
                {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              
              {hasMultipleCameras && canUseFrontCamera && (
                  <button
                    type="button"
                    onClick={flipCamera}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    title="Flip Camera"
                  >
                    <RefreshCw size={20} />
                  </button>
              )}
              
              {/* Screen Share Button for Gaming Category */}
              {category === 'gaming' && screenShare.isSupported && (
                <button
                  type="button"
                  onClick={toggleScreenShare}
                  className={`p-3 rounded-full transition-colors ${streamMode === 'screen' ? 'bg-purple-500/80 hover:bg-purple-600/80' : 'bg-white/10 hover:bg-white/20'}`}
                  title={streamMode === 'screen' ? 'Stop Screen Share' : 'Share Screen'}
                >
                  {streamMode === 'screen' ? <Monitor size={20} /> : <Gamepad2 size={20} />}
                </button>
              )}
              
              {/* Show warning if front camera not allowed */}
              {shouldForceRearCamera && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-pink-500/80 px-3 py-1 rounded-full text-xs whitespace-nowrap">
                  📍 Rear Camera Only
                </div>
              )}
            </div>
          </div>
          <p className="text-center text-sm text-gray-400">
            Check your camera and microphone before going live
            {category === 'gaming' && (
              <span className="block text-xs text-amber-400 mt-1">
                💡 Chromebook/Chrome users: When screen sharing, select &quot;Window&quot; instead of &quot;Chrome Tab&quot; for best results
              </span>
            )}
          </p>
        </div>

        {/* Form Section */}
        
        <div className="space-y-6 bg-slate-900/50 p-8 rounded-3xl border border-white/5 shadow-xl overflow-y-auto max-h-[90vh]">
          <div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-amber-600 bg-clip-text text-transparent">Go Live</h1>
            <p className="text-gray-400">Set up your broadcast details</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Stream Title</label>
              <input
                type="text"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter stream title"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all placeholder:text-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
              <select
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as BroadcastCategoryId)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all text-gray-300"
              >
                <option value="general">💬 General Chat</option>
                <option value="just_chatting">☕ Just Chatting</option>
                <option value="gaming">🎮 Gaming</option>
                <option value="irl">📍 IRL / Lifestyle</option>
                <option value="debate">⚖️ Debate & Discussion</option>
                <option value="education">📚 Education</option>
                <option value="fitness">💪 Fitness & Sports</option>
                <option value="business">💼 Business & Finance</option>
                <option value="spiritual">✝️ Spiritual / Church</option>
                <option value="trollmers">🏆 Trollmers Head-to-Head</option>
                <option value="election">🗳️ President Elections</option>
              </select>
            </div>

            {/* Category-specific info */}
            {renderCategoryInfo()}

            {/* Gaming Setup Panel */}
            {category === 'gaming' && (
              <GamingSetup
                streamId={streamId}
                acquireMediaStream={acquireMediaStream}
                facingMode={facingMode}
                isVideoEnabled={isVideoEnabled}
                setStream={setStream}
              />
            )}

            {/* Religion Selector for Spiritual */}
            {renderReligionSelector()}

            {/* Battle/Match Info */}
            {renderBattleInfo()}

            {showPermissionPrompt && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
                <p className="text-amber-300 text-sm">
                  ⚠️ Camera and microphone permissions are required to start streaming.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleStartStream}
              disabled={loading || !title.trim() || (categoryRequiresReligion && !selectedReligion) || (shouldForceRearCamera && !hasRearCamera) || showPermissionPrompt}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-600 text-black font-bold text-lg hover:from-yellow-300 hover:to-amber-500 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></span>
                  Creating your stream...
                </span>
              ) : showPermissionPrompt ? (
                'Grant Permissions to Start'
              ) : (
                'Start Broadcast'
              )}
            </button>
            {shouldForceRearCamera && !hasRearCamera && (
              <p className="text-red-400 text-sm text-center mt-2">A rear camera is required for this category but none was detected.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
