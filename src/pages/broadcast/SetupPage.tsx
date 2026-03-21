import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { PreflightStore } from '@/lib/preflightStore';
import { useStreamStore } from '@/lib/streamStore';
import { LocalAudioTrack, LocalVideoTrack, AudioPresets, VideoPresets, Room } from 'livekit-client';
import { Video, VideoOff, Mic, MicOff, RefreshCw, Swords, Gamepad2, Monitor, Lock, Eye, EyeOff } from 'lucide-react';
import { useScreenShare, StreamMode, canScreenShare } from '../../hooks/useScreenShare';
import { GamingSetup } from '../../components/broadcast/GamingSetup';
import { toast } from 'sonner';
import { useBroadcastLockdown } from '@/hooks/useBroadcastLockdown';
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
  const [broadcasterLimitInfo, setBroadcasterLimitInfo] = useState<{ current: number; max: number; canStart: boolean } | null>(null);

  // Broadcast lockdown check
  const { isLocked: isBroadcastLocked, canBroadcast, isAdmin: isUserAdmin } = useBroadcastLockdown();

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
  
  // Password protection state
  const [isProtected, setIsProtected] = useState(false);
  const [broadcastPassword, setBroadcastPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Check if user can create protected broadcast (admin/staff or level >= 50)
  const canCreateProtected = profile && (
    profile.role === 'admin' || 
    profile.is_admin || 
    profile.is_troll_officer || 
    profile.is_lead_officer || 
    profile.is_staff ||
    (profile.level !== undefined && profile.level >= 50)
  );
  
  // Pre-generate stream ID for token optimization
  const [streamId] = useState(() => generateUUID());
  // Pre-fetch LiveKit token in background once we have user
  const [prefetchedToken, setPrefetchedToken] = useState<string | null>(null);

  // Pre-fetch LiveKit token once user is available
  useEffect(() => {
    if (!user?.id || prefetchedToken) return;
    
    const prefetchToken = async () => {
      try {
        const roomName = streamId;
        const { data, error } = await supabase.functions.invoke('livekit-token', {
          body: { room: roomName, userId: user.id, role: 'publisher' },
        });
        if (error) {
          console.warn('[SetupPage] Token prefetch failed:', error);
          return;
        }
        if (data?.token) {
          console.log('[SetupPage] Token prefetched successfully');
          setPrefetchedToken(data.token);
          // Store in sessionStorage for BroadcastPage
          sessionStorage.setItem('tc_stream_token', data.token);
        }
      } catch (err) {
        console.warn('[SetupPage] Token prefetch error:', err);
      }
    };
    
    // Delay slightly to not block initial page load
    const timeout = setTimeout(prefetchToken, 1000);
    return () => clearTimeout(timeout);
  }, [user?.id, streamId]);

  // Track if we are navigating to broadcast to prevent cleanup
  const isStartingStream = useRef(false);
  // Track page visibility to prevent refresh on tab switch
  const isPageVisible = useRef(true);
  const isTabSwitching = useRef(false);

  // LiveKit room state - created in SetupPage and passed to BroadcastPage
  const [livekitRoom, setLivekitRoom] = useState<Room | null>(null);
  const livekitRoomRef = useRef<Room | null>(null);


  // Get category config
  const categoryConfig = getCategoryConfig(category);
  const categoryRequiresReligion = requiresReligion(category);
  const shouldForceRearCamera = forceRearCamera(category);
  const canUseFrontCamera = allowFrontCamera(category);
  const categorySupportsBattles = supportsBattles(category);
  const categoryMatchingTerm = getMatchingTerminology(category);


  // Media state - LiveKit tracks for preview
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [livekitTracks, setLivekitTracks] = useState<[LocalAudioTrack | null, LocalVideoTrack | null]>([null, null]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [hasRearCamera, setHasRearCamera] = useState(false);
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

  // Check monthly broadcaster limit
  useEffect(() => {
    async function checkBroadcasterLimit() {
      if (!user?.id) return;

      // Get start of current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Count unique broadcasters who have started a stream this month
      const { data, error } = await supabase
        .from('streams')
        .select('user_id')
        .gte('started_at', startOfMonth)
        .not('started_at', 'is', null);

      if (error) {
        console.error('Error checking broadcaster limit:', error);
        return;
      }

      // Get unique user_ids
      const uniqueBroadcasters = new Set(data?.map(s => s.user_id) || []);
      const currentCount = uniqueBroadcasters.size;
      
      // Max limit is fixed at 50 broadcasters per month
      const maxLimit = 50;

      // Check if current user has already broadcasted this month (they get a free pass)
      const hasUserBroadcasted = uniqueBroadcasters.has(user.id);

      setBroadcasterLimitInfo({
        current: currentCount,
        max: maxLimit,
        canStart: currentCount < maxLimit || hasUserBroadcasted
      });
    }
    checkBroadcasterLimit();
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

  // Helper to clear the video container - detaches any existing LiveKit elements
  const clearVideoContainer = () => {
    if (videoContainerRef.current) {
      // Find and detach any attached video elements from LiveKit
      const attachedElements = videoContainerRef.current.querySelectorAll('video');
      attachedElements.forEach(el => {
        el.remove();
      });
      videoContainerRef.current.innerHTML = '';
    }
  };

  // Attach video track to container using LiveKit's attach() method
  const attachVideoTrack = (videoTrack: LocalVideoTrack, facing: 'user' | 'environment') => {
    if (!videoContainerRef.current) return;
    
    // Clear previous preview first
    clearVideoContainer();
    
    // Use LiveKit's attach() to create and attach the video element
    const mediaElement = videoTrack.attach();
    mediaElement.style.width = '100%';
    mediaElement.style.height = '100%';
    mediaElement.style.objectFit = 'cover';
    // Mirror front camera only
    mediaElement.style.transform = facing === 'user' ? 'scaleX(-1)' : 'none';
    // Critical: Add autoplay and playsInline for proper video display
    mediaElement.autoplay = true;
    mediaElement.playsInline = true;
    
    videoContainerRef.current.appendChild(mediaElement);
  };

  // Detach video track from container using LiveKit's detach() method
  const detachVideoTrack = (videoTrack: LocalVideoTrack) => {
    if (!videoContainerRef.current) return;
    
    // Use LiveKit's detach to properly clean up the element
    const mediaElement = videoTrack.detach();
    if (mediaElement && videoContainerRef.current.contains(mediaElement)) {
      videoContainerRef.current.removeChild(mediaElement);
    }
  };

  // Acquire media stream using native browser API, then wrap in LiveKit tracks
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
      // First get native media stream using browser API
      console.log('[acquireMediaStream] Getting native media stream...');
      
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: enableVideo ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: videoFacingMode
        } : false
      };

      const nativeStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[acquireMediaStream] Native stream acquired');

       // Wrap audio track in LiveKit LocalAudioTrack
       let audioTrack: LocalAudioTrack | null = null;
       let videoTrack: LocalVideoTrack | null = null;

       const audioTracks = nativeStream.getAudioTracks();
       if (audioTracks.length > 0) {
         try {
           audioTrack = new LocalAudioTrack(audioTracks[0]);
           console.log('[acquireMediaStream] Audio track wrapped in LiveKit');
         } catch (audioErr) {
           console.warn('[acquireMediaStream] Failed to wrap audio track:', audioErr);
         }
       }

       const videoTracks = nativeStream.getVideoTracks();
       if (videoTracks.length > 0) {
         try {
           videoTrack = new LocalVideoTrack(videoTracks[0]);
           console.log('[acquireMediaStream] Video track wrapped in LiveKit');
         } catch (videoErr) {
           console.warn('[acquireMediaStream] Failed to wrap video track:', videoErr);
         }
       }

       // Store LiveKit tracks for reuse in BroadcastPage
       setLivekitTracks([audioTrack, videoTrack]);
       
       // Note: We no longer store tracks in PreflightStore to avoid reference issues
       // BroadcastPage will create fresh tracks using room.localParticipant.enableCameraAndMicrophone()
       console.log('[acquireMediaStream] LiveKit tracks stored locally (not in PreflightStore)');

      // Attach video track to container using LiveKit's attach() method
      if (videoTrack) {
        console.log('[acquireMediaStream] Attaching video track to container');
        attachVideoTrack(videoTrack, videoFacingMode);
      }
      
      console.log('[acquireMediaStream] MediaStream created:', {
        audioTracks: nativeStream.getAudioTracks().length,
        videoTracks: nativeStream.getVideoTracks().length
      });
      
      return nativeStream;
    } catch (err: any) {
      console.error('[acquireMediaStream] Error creating media stream:', err);
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

      // Note: Video is now played via LiveKit's attach() method in acquireMediaStream
      // No need to manually attach srcObject - LiveKit manages the video element
      console.log('[SetupPage] Video playback handled by LiveKit SDK via attach() method');
    }
    getInitialMedia();

    return () => {
      isMounted.current = false;
      // Clean up LiveKit video track when component unmounts or re-renders
      // This prevents duplicate video elements and memory leaks
      if (livekitTracks[1]) {
        console.log('[SetupPage] Cleanup: Detaching LiveKit video track');
        detachVideoTrack(livekitTracks[1]);
      }
      
      // Don't cleanup on tab switches - only on actual unmount or stream start
      // Use the current ref value, not a captured one, to get latest state
      // CRITICAL: Read isStartingStream.current AT THE START of cleanup to avoid race conditions
      const amStartingStream = isStartingStream.current;
      console.log('[SetupPage] Cleanup: isStartingStream =', amStartingStream);
      
        if (currentLocalStream) {
          // Check if this is a tab switch (isTabSwitching will be true for 500ms after visibility change)
          if (isTabSwitching.current || !isPageVisible.current) {
            console.log('[SetupPage] Cleanup: Tab switch detected - preserving media stream locally.');
            // Note: We don't store stream in PreflightStore anymore - tracks will be created fresh in BroadcastPage
          } else if (!amStartingStream) {
            // Only stop tracks if we're NOT starting the stream
            // When starting stream, BroadcastPage will create fresh tracks
            console.log('[SetupPage] Cleanup: Cleaning up media stream on unmount (not starting stream).');
            currentLocalStream.getTracks().forEach(track => track.stop());
          } else {
            console.log('[SetupPage] Cleanup: Starting stream - BroadcastPage will create fresh tracks.');
          }
        } else if (amStartingStream && livekitTracks[0] && livekitTracks[1]) {
          // Even if currentLocalStream is null, if we're starting stream, we no longer store tracks in PreflightStore
          // BroadcastPage will create fresh tracks using enableCameraAndMicrophone()
          console.log('[SetupPage] Cleanup: Starting stream - BroadcastPage will create fresh tracks.');
        } else if (!amStartingStream) {
          // Not starting stream and no local stream - just cleanup
          console.log('[SetupPage] Cleanup: Not starting stream, no local stream to clean up.');
        }
    };
  }, [facingMode, isVideoEnabled, showPermissionPrompt, streamMode, screenTrack]);

  // Toggle video - stop/start the track
  const toggleVideo = async () => {
    const newState = !isVideoEnabled;
    
    if (newState) {
      // Re-acquire video track
      const mediaStream = await acquireMediaStream(facingMode, true);
      if (mediaStream) {
        setStream(mediaStream);
      }
    } else {
      // Stop video track
      if (stream) {
        stream.getVideoTracks().forEach(track => track.stop());
      }
      // Clear video preview
      if (videoContainerRef.current) {
        videoContainerRef.current.innerHTML = '';
      }
    }
    setIsVideoEnabled(newState);
  };

  // Toggle audio - stop/start the track
  const toggleAudio = async () => {
    const newState = !isAudioEnabled;
    
    if (!newState && stream) {
      // Stop audio track
      stream.getAudioTracks().forEach(track => track.stop());
    } else if (newState && !isAudioEnabled) {
      // Re-acquire audio
      const mediaStream = await acquireMediaStream(facingMode, isVideoEnabled);
      if (mediaStream) {
        setStream(mediaStream);
      }
    }
    setIsAudioEnabled(newState);
  };

  // Flip camera - properly recreate video track with new facing mode
  const flipCamera = async () => {
    if (!canUseFrontCamera && facingMode === 'environment') {
      toast.error('Front camera is not available for this category');
      return;
    }
    
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    
    // Recreate video track with new facing mode
    if (livekitTracks[1]) {
      try {
        console.log('[SetupPage] Recreating video track with facing mode:', newFacingMode);
        
        // Detach and close current video track
        detachVideoTrack(livekitTracks[1]);
        livekitTracks[1].stop();
        livekitTracks[1].close();
        
        // Get new video track using native browser API
        const newNativeStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: newFacingMode
          }
        });
        
        const newVideoTracks = newNativeStream.getVideoTracks();
        if (newVideoTracks.length === 0) {
          throw new Error('No video track found');
        }
        
        // Wrap in LiveKit track
        const newVideoTrack = new LocalVideoTrack(newVideoTracks[0]);
        
        // Update state with new track
        setLivekitTracks([livekitTracks[0], newVideoTrack]);
        
        // Note: We no longer store tracks in PreflightStore - BroadcastPage will create fresh tracks
        // Update preview stream for state management
        const newStream = new MediaStream();
        if (livekitTracks[0]) {
          newStream.addTrack(livekitTracks[0].getMediaStreamTrack());
        }
        newStream.addTrack(newVideoTrack.getMediaStreamTrack());
        setStream(newStream);
        
        // Attach new track to preview using LiveKit's attach()
        attachVideoTrack(newVideoTrack, newFacingMode);
        
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
        // Video is now played via LiveKit's attach() method in acquireMediaStream
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

      // Detach camera preview
      if (livekitTracks[1]) {
        detachVideoTrack(livekitTracks[1]);
      }

      const track = await screenShare.startScreenShare();
      if (track) {
        setScreenTrack(track);
        setStreamMode('screen');

        // Attach screen share track to preview using LiveKit's attach()
        if (videoContainerRef.current) {
          clearVideoContainer();
          const mediaElement = track.attach();
          mediaElement.style.width = '100%';
          mediaElement.style.height = '100%';
          mediaElement.style.objectFit = 'contain'; // Use contain for screen share
          mediaElement.style.transform = 'none'; // Don't mirror screen share
          // Critical: Add autoplay and playsInline for proper video display
          mediaElement.autoplay = true;
          mediaElement.playsInline = true;
          videoContainerRef.current.appendChild(mediaElement);
          console.log('[SetupPage] Screen track attached for preview');
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
          // Stop screen track
          track.stop();
          // Clear container
          clearVideoContainer();
          // Re-acquire camera stream when screen share ends
          acquireMediaStream(facingMode, isVideoEnabled).then(mediaStream => {
            if (mediaStream) {
              setStream(mediaStream);
              // Video will be attached via LiveKit's attach() in acquireMediaStream
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
          // Video will be attached via LiveKit's attach() in acquireMediaStream
        }
      }
    }
  };

  // Helper functions to check category access
  const canAccessTCNN = () => {
    const isNewsCaster = profile?.is_news_caster || profile?.is_chief_news_caster;
    const isAdmin = profile?.role === 'admin' || profile?.is_admin || 
                    profile?.role === 'superadmin' || profile?.is_superadmin;
    // Check if they have restricted roles
    const isRestrictedRole = profile?.is_troll_officer || profile?.is_lead_troll_officer || 
                             profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer';
    return (isNewsCaster || isAdmin) && !isRestrictedRole;
  };

  const canAccessElections = () => {
    const allowedRoles = ['admin', 'secretary', 'lead_troll_officer', 'troll_officer'];
    return profile?.role && allowedRoles.includes(profile.role);
  };

  const handleStartStream = async () => {
    // Check if broadcasting is locked and user is not admin
    if (isBroadcastLocked && !canBroadcast()) {
      toast.error('Broadcasting is currently disabled by admin. No one can go live while lockdown is active.');
      return;
    }

    // Perform all validations first BEFORE setting isStartingStream
    if (!title.trim()) {
      toast.error('Please enter a stream title');
      return;
    }

     // Check religion requirement for spiritual category
     if (categoryRequiresReligion && !selectedReligion) {
       toast.error('Please select your religion');
       return;
     }
 
     // Check Gaming category requirements
 
     // Check Gaming category requirements - 100 followers required (admin/roles bypass)
     if (category === 'gaming') {
       const isAdminOrOfficer = profile?.role === 'admin' || profile?.role === 'superadmin' || 
         profile?.is_admin || profile?.is_superadmin || profile?.is_troll_officer || 
         profile?.is_lead_troll_officer || profile?.role === 'troll_officer' || 
         profile?.role === 'lead_troll_officer' || profile?.role === 'secretary';
       
       if (!isAdminOrOfficer && followerCount < 100) {
         toast.error('Gaming category requires 100 followers');
         return;
       }
     }
 
     // Check follower requirement for ALL broadcast categories (admins/officers bypass)
     const isAdminOrOfficer = profile?.role === 'admin' || profile?.role === 'superadmin' || 
       profile?.is_admin || profile?.is_superadmin || profile?.is_troll_officer || 
       profile?.is_lead_troll_officer || profile?.role === 'troll_officer' || 
       profile?.role === 'lead_troll_officer' || profile?.role === 'secretary';
     if (!isAdminOrOfficer && followerCount < 1) {
       toast.error('You need at least 1 follower to start a broadcast');
       return;
     }

    // Check President Elections requirements - only admin, secretary, lead_troll_officer, troll_officer
    if (category === 'election') {
      const allowedRoles = ['admin', 'secretary', 'lead_troll_officer', 'troll_officer'];
      if (!profile?.role || !allowedRoles.includes(profile.role)) {
        toast.error('President Elections category is only available to admins and officers');
        return;
      }
    }

    // Validate password if protected
    if (isProtected && broadcastPassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    // Check TCNN requirements - only News Casters, Chief News Casters, and Admins
    // Regular users, Troll Officers, and Lead Troll Officers CANNOT start TCNN broadcasts
    if (category === 'tcnn') {
      const isNewsCaster = profile?.is_news_caster || profile?.is_chief_news_caster;
      const isAdmin = profile?.role === 'admin' || profile?.is_admin || 
                      profile?.role === 'superadmin' || profile?.is_superadmin;
      
      // Explicitly check for roles that should NOT be allowed
      const isRestrictedRole = profile?.is_troll_officer || profile?.is_lead_troll_officer || 
                               profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer';
      
      if (!isNewsCaster && !isAdmin) {
        toast.error('TCNN category is only available to News Casters, Chief News Casters, and Admins');
        return;
      }
      
      // Extra safety check - if they have restricted roles, block them even if they have news caster flag
      if (isRestrictedRole && !isAdmin) {
        toast.error('Troll Officers cannot start TCNN broadcasts. Apply for News Caster role.');
        return;
      }
    }

    // Check camera requirement for categories that need it, unless screen sharing is active
    if (categoryConfig.requiresCamera && !isVideoEnabled) {
      toast.error(`Camera is required for ${categoryConfig.name}`);
      return;
    }

    if (!user) return;

    // Check monthly broadcaster limit before starting
    if (broadcasterLimitInfo && !broadcasterLimitInfo.canStart) {
      toast.error(`Monthly broadcaster limit reached (${broadcasterLimitInfo.current}/${broadcasterLimitInfo.max}). Please try again next month.`);
      return;
    }

    // All validations passed - now set isStartingStream and proceed
    isStartingStream.current = true;
    console.log('[SetupPage] Starting stream - isStartingStream set to true');

    // Clear session storage flags when starting stream
    sessionStorage.removeItem('tc_setup_initialized');
    sessionStorage.removeItem('tc_tab_switching');
    sessionStorage.removeItem('tc_screen_share_active');
    sessionStorage.removeItem('tc_stream_mode');

    setLoading(true);
    try {
      // LiveKit room name is the stream ID
      const roomName = streamId;
      
      console.log('[SetupPage] Stream config:', {
        roomName
      });
      
      // Build insert object with optional password protection
      const insertData: Record<string, unknown> = {
        id: streamId,
        user_id: user.id,
        broadcaster_id: user.id,
        streamer_id: user.id,
        owner_id: user.id,
        title,
        category,
        camera_ready: isVideoEnabled,
        status: 'pending',
        is_live: false,
        box_count: categoryConfig.defaultBoxCount,
        layout_mode: categoryConfig.layoutMode === 'debate' ? 'split' :
                     categoryConfig.layoutMode === 'classroom' ? 'grid' :
                     categoryConfig.layoutMode === 'spotlight' ? 'spotlight' : 'grid',
        // Store room name for LiveKit (database column still uses legacy name 'agora_channel')
        agora_channel: roomName,
        // Store category-specific data
        ...(category === 'spiritual' && { selected_religion: selectedReligion }),
      };

      // Add password protection if enabled
      if (isProtected && broadcastPassword.length >= 4) {
        insertData.is_protected = true;
        // Hash password using PostgreSQL crypt - the password will be sent as plaintext
        // and hashed server-side (we need to call an RPC to hash it)
        const { data: hashData, error: hashError } = await supabase.rpc('crypt_password', {
          p_password: broadcastPassword
        });
        
        // If RPC fails, the stream creation will fail (which is the expected behavior)
        // Otherwise use the hashed password
        insertData.password_hash = hashError ? null : hashData;
      } else {
        insertData.is_protected = false;
        insertData.password_hash = null;
      }

      const { data, error } = await supabase
        .from('streams')
        .insert(insertData)
        .select()
        .maybeSingle();

      if (error) throw error;

      // NOTE: Do NOT join LiveKit room in SetupPage - BroadcastPage will handle joining
      // This prevents connection conflicts when BroadcastPage creates its own fresh room
      // Token is also not fetched here - BroadcastPage handles all token fetching
      console.log('[SetupPage] Skipping LiveKit join - BroadcastPage will handle connection and token');

      // Store stream info in sessionStorage for BroadcastPage to use
      // NOTE: Token will be fetched by BroadcastPage, not stored here
      // Keep the prefetched token in sessionStorage for BroadcastPage to use
      sessionStorage.setItem('tc_stream_uid', user.id);

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

      // Update stream status to 'live' immediately so other broadcasters can see it
      // Don't await this - let it happen in background while we navigate
      console.log('[SetupPage] Updating stream to live in background, streamId:', streamId);
      supabase
        .from('streams')
        .update({
          status: 'live',
          is_live: true,
          started_at: new Date().toISOString()
        })
        .eq('id', streamId)
        .then(({ error: liveUpdateError }) => {
          if (liveUpdateError) {
            console.error('[SetupPage] Background: FAILED to update stream to live:', liveUpdateError);
          } else {
            console.log('[SetupPage] Background: Stream updated to live');
          }
        });

      // No delay - navigate immediately while DB update happens in background

      // Ensure video state reflects actual track state before storing
      const hasVideoTrack = livekitTracks[1] !== null;
      const videoTrackEnabled = livekitTracks[1]?.enabled ?? false;
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

      // CRITICAL: Ensure tracks exist before navigating to BroadcastPage
      // If tracks are null, we need to wait for them or create them
      if (!livekitTracks[0] || !livekitTracks[1]) {
        console.warn('[SetupPage] Tracks not ready yet, waiting...', { 
          audioTrack: !!livekitTracks[0], 
          videoTrack: !!livekitTracks[1] 
        });
        toast.error('Camera not ready. Please wait a moment and try again.');
        setLoading(false);
        isStartingStream.current = false;
        return;
      }

      console.log('[SetupPage] Tracks verified, storing for BroadcastPage:', {
        hasAudio: !!livekitTracks[0],
        hasVideo: !!livekitTracks[1]
      });

      // NOTE: Do NOT connect to LiveKit room in SetupPage - BroadcastPage will handle joining
      // This prevents connection conflicts when BroadcastPage creates its own fresh room
      // The tracks are stored in PreflightStore and will be used by BroadcastPage
      console.log('[SetupPage] Skipping LiveKit connection - BroadcastPage will handle it');

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
      isStartingStream.current = false;
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
          You'll only be matched with broadcasters of the same faith
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
        
        {/* Follower requirement indicator for ALL categories */}
        <div className="flex items-center justify-between text-sm border-t border-white/10 pt-2 mt-2">
          <span className="text-gray-300">Followers Required:</span>
          <span className={`font-bold ${followerCount >= 1 ? 'text-green-400' : 'text-red-400'}`}>
            {followerCount} / 1
          </span>
        </div>
        
        {followerCount < 1 && (
          <p className="text-xs text-amber-300 mt-2">
            ⚠️ You need at least 1 follower to start any broadcast
          </p>
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
      case 'tcnn':
        return (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm">
            <p className="text-red-300">📺 Official TCNN broadcast - News Caster role required</p>
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
              // Container div for LiveKit video preview
              // LiveKit SDK manages the video element inside this container via attach()
              <div
                ref={videoContainerRef}
                className="absolute inset-0 w-full h-full bg-black overflow-hidden"
                style={{
                  zIndex: 1,
                  // Mirror effect for front camera is handled in attachVideoTrack()
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
                💡 Chromebook/Chrome users: When screen sharing, select "Window" instead of "Chrome Tab" for best results
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
                <option value="gaming">🎮 Gaming</option>
                <option value="irl">📍 IRL / Lifestyle</option>
                <option value="debate">⚖️ Debate & Discussion</option>
                <option value="education">📚 Education</option>
                <option value="fitness">💪 Fitness & Sports</option>
                <option value="business">💼 Business & Finance</option>
                <option value="spiritual">✝️ Spiritual / Church</option>
                {canAccessElections() && (
                  <option value="election">🗳️ President Elections</option>
                )}
                {canAccessTCNN() && (
                  <option value="tcnn">📺 TCNN News</option>
                )}
              </select>
            </div>

            {/* Category-specific info */}
            {renderCategoryInfo()}

            {/* Gaming Follower Requirement */}
            {category === 'gaming' && (
              <div className={`rounded-xl p-4 border ${followerCount >= 100 || (profile?.role === 'admin' || profile?.role === 'superadmin' || profile?.is_admin || profile?.is_superadmin || profile?.is_troll_officer || profile?.is_lead_troll_officer || profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer' || profile?.role === 'secretary') ? 'bg-green-500/10 border-green-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">🎮 Gaming Follower Requirement</span>
                  <span className={`text-sm font-bold ${followerCount >= 100 || (profile?.role === 'admin' || profile?.role === 'superadmin' || profile?.is_admin || profile?.is_superadmin || profile?.is_troll_officer || profile?.is_lead_troll_officer || profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer' || profile?.role === 'secretary') ? 'text-green-400' : 'text-amber-400'}`}>
                    {followerCount} / 100
                  </span>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${followerCount >= 100 || (profile?.role === 'admin' || profile?.role === 'superadmin' || profile?.is_admin || profile?.is_superadmin || profile?.is_troll_officer || profile?.is_lead_troll_officer || profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer' || profile?.role === 'secretary') ? 'bg-green-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min((followerCount / 100) * 100, 100)}%` }}
                  />
                </div>
                <p className={`text-xs mt-2 ${followerCount >= 100 || (profile?.role === 'admin' || profile?.role === 'superadmin' || profile?.is_admin || profile?.is_superadmin || profile?.is_troll_officer || profile?.is_lead_troll_officer || profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer' || profile?.role === 'secretary') ? 'text-green-300' : 'text-amber-300'}`}>
                  {followerCount >= 100 || (profile?.role === 'admin' || profile?.role === 'superadmin' || profile?.is_admin || profile?.is_superadmin || profile?.is_troll_officer || profile?.is_lead_troll_officer || profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer' || profile?.role === 'secretary')
                    ? '✅ You can broadcast in Gaming category!'
                    : '⚠️ Gaming category requires 100 followers (admins & officers bypass)'
                  }
                </p>
              </div>
            )}

            {/* Gaming Setup Panel */}
            {category === 'gaming' && (
              <GamingSetup
                streamId={streamId}
                acquireMediaStream={acquireMediaStream}
                facingMode={facingMode}
                isVideoEnabled={isVideoEnabled}
                setStream={setStream}
                onScreenShareStarted={(track) => {
                  // Attach screen share track to preview
                  if (videoContainerRef.current) {
                    clearVideoContainer();
                    const mediaElement = track.attach();
                    mediaElement.style.width = '100%';
                    mediaElement.style.height = '100%';
                    mediaElement.style.objectFit = 'contain'; // Use contain for screen share
                    mediaElement.style.transform = 'none'; // Don't mirror screen share
                    mediaElement.autoplay = true;
                    mediaElement.playsInline = true;
                    videoContainerRef.current.appendChild(mediaElement);
                    console.log('[SetupPage] Screen share preview attached from GamingSetup');
                  }
                }}
                onScreenShareStopped={() => {
                  // Clear screen share preview
                  clearVideoContainer();
                  // Re-acquire camera stream
                  acquireMediaStream(facingMode, isVideoEnabled).then(mediaStream => {
                    if (mediaStream) {
                      setStream(mediaStream);
                    }
                  });
                }}
              />
            )}

            {/* Religion Selector for Spiritual */}
            {renderReligionSelector()}

            {/* Password Protection - Only for eligible users */}
            {canCreateProtected && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-purple-400" />
                    <span className="font-medium text-purple-300">Password Protection</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProtected(!isProtected);
                      if (!isProtected) {
                        setBroadcastPassword('');
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isProtected ? 'bg-purple-500' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isProtected ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                {isProtected && (
                  <div className="space-y-2">
                    <label className="block text-sm text-gray-300">
                      Enter Password (minimum 4 characters)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={broadcastPassword}
                        onChange={(e) => setBroadcastPassword(e.target.value)}
                        placeholder="Enter password..."
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder:text-gray-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    {broadcastPassword.length > 0 && broadcastPassword.length < 4 && (
                      <p className="text-xs text-red-400">Password must be at least 4 characters</p>
                    )}
                  </div>
                )}
                
                {!isProtected && (
                  <p className="text-xs text-gray-400">
                    Enable password protection to restrict who can join your broadcast
                  </p>
                )}
              </div>
            )}

            {/* Battle/Match Info */}
            {renderBattleInfo()}

            {showPermissionPrompt && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
                <p className="text-amber-300 text-sm">
                  ⚠️ Camera and microphone permissions are required to start streaming.
                </p>
              </div>
            )}

            {/* Monthly Broadcaster Limit Indicator */}
            {broadcasterLimitInfo && (
              <div className={`rounded-xl p-4 border ${broadcasterLimitInfo.canStart ? 'bg-blue-500/10 border-blue-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">Monthly Broadcaster Limit</span>
                  <span className={`text-sm font-bold ${broadcasterLimitInfo.canStart ? 'text-blue-400' : 'text-red-400'}`}>
                    {broadcasterLimitInfo.current} / {broadcasterLimitInfo.max}
                  </span>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${broadcasterLimitInfo.canStart ? 'bg-blue-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min((broadcasterLimitInfo.current / broadcasterLimitInfo.max) * 100, 100)}%` }}
                  />
                </div>
                <p className={`text-xs mt-2 ${broadcasterLimitInfo.canStart ? 'text-blue-300' : 'text-red-300'}`}>
                  {broadcasterLimitInfo.canStart
                    ? `${broadcasterLimitInfo.max - broadcasterLimitInfo.current} spots remaining this month`
                    : 'Monthly limit reached. Please try again next month.'}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleStartStream}
              disabled={loading || !title.trim() || (categoryRequiresReligion && !selectedReligion) || (shouldForceRearCamera && !hasRearCamera) || showPermissionPrompt || (broadcasterLimitInfo && !broadcasterLimitInfo.canStart)}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-600 text-black font-bold text-lg hover:from-yellow-300 hover:to-amber-500 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></span>
                  Creating your stream...
                </span>
              ) : showPermissionPrompt ? (
                'Grant Permissions to Start'
              ) : (broadcasterLimitInfo && !broadcasterLimitInfo.canStart) ? (
                'Monthly Limit Reached'
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
