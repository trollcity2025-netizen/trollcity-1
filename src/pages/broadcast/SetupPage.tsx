import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { PreflightStore } from '@/lib/preflightStore';
import { useStreamStore } from '@/lib/streamStore';
import { LocalAudioTrack, LocalVideoTrack, AudioPresets, VideoPresets, Room } from 'livekit-client';
import { Video, VideoOff, Mic, MicOff, RefreshCw, Swords, Gamepad2, Monitor, Lock, Eye, EyeOff, Radio } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useScreenShare, StreamMode, canScreenShare } from '../../hooks/useScreenShare';
import { GamingSetup } from '../../components/broadcast/GamingSetup';
import { DraggableCameraOverlay } from '../../components/broadcast/DraggableCameraOverlay';
import DeckInstallPrompt from '../../components/deck/DeckInstallPrompt';
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
  // Battle enabled state
  const [battleEnabled, setBattleEnabled] = useState(false);
  
  // Check if user can create protected broadcast (admin/staff or level >= 50)
  const canCreateProtected = profile && (
    profile.role === 'admin' || 
    profile.is_admin || 
    profile.is_troll_officer || 
    profile.is_lead_officer || 
    profile.is_staff ||
    (profile.level !== undefined && profile.level >= 50)
  );

  // Determine if user is admin for quality settings (1080p admin, 720p regular)
  const isStreamAdmin = !!(profile && (
    profile.role === 'admin' || profile.is_admin ||
    profile.role === 'superadmin' || profile.is_superadmin ||
    profile.role === 'owner'
  ));
  
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
    
    // OPTIMIZED: Prefetch token immediately for faster broadcast start
    const timeout = setTimeout(prefetchToken, 100);
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
  const [cameraOverlayEnabled, setCameraOverlayEnabled] = useState(false);
  const cameraOverlayContainerRef = useRef<HTMLDivElement>(null);
  const [cameraOverlayStream, setCameraOverlayStream] = useState<MediaStream | null>(null);
  
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
    // Persist camera overlay enabled state
    if (cameraOverlayEnabled) {
      sessionStorage.setItem('tc_camera_overlay_enabled', 'true');
    } else {
      sessionStorage.removeItem('tc_camera_overlay_enabled');
    }
  }, [screenTrack, streamMode, cameraOverlayEnabled]);

  // Restore screen share state when returning to tab
  useEffect(() => {
    const wasScreenSharing = sessionStorage.getItem('tc_screen_share_active') === 'true';
    if (wasScreenSharing && streamMode === 'camera' && !screenTrack) {
      console.log('[SetupPage] Restoring screen share mode from session storage');
      setStreamMode('screen');
    }
    // Restore camera overlay state
    const wasCameraOverlay = sessionStorage.getItem('tc_camera_overlay_enabled') === 'true';
    if (wasCameraOverlay && !cameraOverlayEnabled) {
      console.log('[SetupPage] Restoring camera overlay enabled from session storage');
      setCameraOverlayEnabled(true);
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
      setCameraOverlayEnabled(false);
    }
    // Note: For gaming, we don't auto-switch - let user choose between camera/screen
  }, [category, setStreamMode]);

  // Manage camera overlay stream for gaming mode
  useEffect(() => {
    let overlayStream: MediaStream | null = null;

    const setupCameraOverlay = async () => {
      if (category === 'gaming' && streamMode === 'screen' && cameraOverlayEnabled) {
        try {
          overlayStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: facingMode,
            },
            audio: false,
          });

          setCameraOverlayStream(overlayStream);

          // Attach to overlay container
          if (cameraOverlayContainerRef.current) {
            cameraOverlayContainerRef.current.innerHTML = '';
            const videoEl = document.createElement('video');
            videoEl.srcObject = overlayStream;
            videoEl.autoplay = true;
            videoEl.playsInline = true;
            videoEl.muted = true;
            videoEl.style.width = '100%';
            videoEl.style.height = '100%';
            videoEl.style.objectFit = 'cover';
            videoEl.style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'none';
            cameraOverlayContainerRef.current.appendChild(videoEl);
          }

          console.log('[SetupPage] Camera overlay stream acquired');
        } catch (err: any) {
          console.error('[SetupPage] Failed to acquire camera overlay:', err);
          toast.error('Failed to access camera for overlay');
          setCameraOverlayEnabled(false);
        }
      }
    };

    const cleanupCameraOverlay = () => {
      if (cameraOverlayStream) {
        cameraOverlayStream.getTracks().forEach(t => t.stop());
        setCameraOverlayStream(null);
      }
      if (cameraOverlayContainerRef.current) {
        cameraOverlayContainerRef.current.innerHTML = '';
      }
    };

    if (category === 'gaming' && streamMode === 'screen' && cameraOverlayEnabled) {
      setupCameraOverlay();
    } else {
      cleanupCameraOverlay();
    }

    return () => {
      if (overlayStream) {
        overlayStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [category, streamMode, cameraOverlayEnabled, facingMode]);

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
    
    // LiveKit's detach() returns an array of HTMLVideoElements
    const mediaElements = videoTrack.detach();
    if (mediaElements && mediaElements.length > 0) {
      mediaElements.forEach(el => {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
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
          width: { ideal: isStreamAdmin ? 1920 : 1280 },
          height: { ideal: isStreamAdmin ? 1080 : 720 },
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
        sessionStorage.removeItem('tc_camera_overlay_enabled');
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
      
      // Only use store streamMode (authoritative) - sessionStorage can be stale from previous sessions
      if (streamMode === 'screen' && screenTrack) {
        console.log('[SetupPage] Screen share mode active with track - attaching to preview');
        if (videoContainerRef.current) {
          clearVideoContainer();
          const mediaElement = screenTrack.attach();
          mediaElement.style.width = '100%';
          mediaElement.style.height = '100%';
          mediaElement.style.objectFit = 'contain';
          mediaElement.style.transform = 'none';
          mediaElement.autoplay = true;
          mediaElement.playsInline = true;
          mediaElement.muted = true;
          videoContainerRef.current.appendChild(mediaElement);
          mediaElement.play().catch(() => {});
          console.log('[SetupPage] Screen track attached for preview');
        }
        return;
      }
      
      // For camera mode: Stop previous tracks if any
      if (stream && streamMode === 'camera') {
          console.log('[SetupPage] Stopping previous camera media tracks.');
          stream.getTracks().forEach(track => track.stop());
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
            width: { ideal: isStreamAdmin ? 1920 : 1280 },
            height: { ideal: isStreamAdmin ? 1080 : 720 },
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
      // Switch back to camera mode - stop the screen track directly
      if (screenTrack) {
        screenTrack.stop();
        screenTrack.detach().forEach(el => el.remove());
      }
      setScreenTrack(null);
      setScreenPreviewStream(null);
      setStreamMode('camera');
      // Re-acquire camera stream
      const mediaStream = await acquireMediaStream(facingMode, isVideoEnabled);
      if (mediaStream) {
        setStream(mediaStream);
      }
      toast.info('Switched to camera mode');
    } else {
      // Call getDisplayMedia FIRST while user gesture is still active
      // Browsers require getDisplayMedia to be called synchronously from a click handler
      let displayStream: MediaStream;
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 30, max: 60 },
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 }
          },
          audio: false
        });
      } catch (err: any) {
        // User cancelled the picker - not an error
        if (err.name !== 'NotAllowedError') {
          console.error('[toggleScreenShare] getDisplayMedia failed:', err);
          toast.error('Failed to start screen sharing');
        }
        return;
      }

      // User selected a screen - now stop camera and set up screen share
      if (stream) {
        console.log('[toggleScreenShare] Stopping camera stream before screen share');
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }

      if (livekitTracks[1]) {
        detachVideoTrack(livekitTracks[1]);
      }

      // Create LiveKit track from the display stream
      const videoTrack = new LocalVideoTrack(displayStream.getVideoTracks()[0], {
        name: 'screen-share'
      });

      setScreenTrack(videoTrack);
      setStreamMode('screen');

      // Attach screen share track to preview
      if (videoContainerRef.current) {
        clearVideoContainer();
        const mediaElement = videoTrack.attach();
        mediaElement.style.width = '100%';
        mediaElement.style.height = '100%';
        mediaElement.style.objectFit = 'contain';
        mediaElement.style.transform = 'none';
        mediaElement.autoplay = true;
        mediaElement.playsInline = true;
        mediaElement.muted = true;
        videoContainerRef.current.appendChild(mediaElement);
        // Ensure playback starts - some browsers require explicit play()
        mediaElement.play().catch(() => {
          // autoplay may still be blocked in some contexts, but muted should handle it
        });
        console.log('[SetupPage] Screen track attached for preview');
      }

      toast.success('Screen sharing started!');

      // Listen for user stopping share via browser UI
      displayStream.getVideoTracks()[0].onended = () => {
        console.log('[SetupPage] Screen share ended by user via browser UI');
        setScreenTrack(null);
        setScreenPreviewStream(null);
        setStreamMode('camera');
        videoTrack.stop();
        clearVideoContainer();
        acquireMediaStream(facingMode, isVideoEnabled).then(mediaStream => {
          if (mediaStream) {
            setStream(mediaStream);
          }
        });
        toast.info('Screen sharing ended');
      };
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

      // Add battle enabled setting
      insertData.battle_enabled = battleEnabled;

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
        // Store camera overlay state for gaming mode
        if (cameraOverlayEnabled) {
          sessionStorage.setItem('tc_camera_overlay_enabled', 'true');
        } else {
          sessionStorage.removeItem('tc_camera_overlay_enabled');
        }
        console.log('[handleStartStream] Screen share mode active - storing for BroadcastPage', {
          category,
          streamMode,
          hasScreenTrack: !!screenTrack,
          cameraOverlayEnabled,
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
        .then(async ({ error: liveUpdateError }) => {
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
      // For gaming screen share mode, we only need audio (screen track is separate)
      const isScreenShareMode = category === 'gaming' && streamMode === 'screen' && screenTrack;
      PreflightStore.setScreenShareMode(!!isScreenShareMode);
      if (isScreenShareMode && screenTrack) {
        PreflightStore.setScreenTrack(screenTrack);
      }
      if (isScreenShareMode) {
        // Screen share mode - only audio track required, screen track handled separately
        if (!livekitTracks[0]) {
          console.warn('[SetupPage] Audio track not ready for screen share mode');
          toast.error('Microphone not ready. Please wait a moment and try again.');
          setLoading(false);
          isStartingStream.current = false;
          return;
        }
      } else if (!livekitTracks[0] || !livekitTracks[1]) {
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
      case 'gaming':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Gaming</span>
            <p className="text-xs text-white">Screen share with optional draggable camera overlay</p>
          </div>
        );
      case 'debate':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Debate</span>
            <p className="text-xs text-white">Split-screen layout with exactly 2 participants</p>
          </div>
        );
      case 'education':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">Education</span>
            <p className="text-xs text-white">Classroom layout — You&apos;re the Teacher, guests are Students</p>
          </div>
        );
      case 'fitness':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">Fitness</span>
            <p className="text-xs text-white">One-way broadcast — You&apos;re the Trainer</p>
          </div>
        );
      case 'irl':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400">IRL</span>
            <p className="text-xs text-white">Rear camera only for first-person streaming</p>
          </div>
        );
      case 'business':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">Business</span>
            <p className="text-xs text-white">Professional broadcast for business discussions</p>
          </div>
        );
      case 'spiritual':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Spiritual</span>
            <p className="text-xs text-white">Faith-based broadcast — select your religion</p>
          </div>
        );
      case 'tcnn':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">TCNN</span>
            <p className="text-xs text-white">Official news broadcast — News Caster role required</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#08080f] text-white p-3 md:p-6 overflow-y-auto">
      <div className="max-w-5xl w-full mx-auto flex flex-col gap-3 py-4">

        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Radio size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Go Live</h1>
            </div>
          </div>
          {broadcasterLimitInfo && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border",
              broadcasterLimitInfo.canStart ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-red-500/10 border-red-500/20 text-red-400"
            )}>
              {broadcasterLimitInfo.current}/{broadcasterLimitInfo.max} broadcasters
            </div>
          )}
        </div>

        {/* Main Grid: Camera + Quick Cards */}
        <div className="flex gap-3 flex-1 min-h-0" style={{ minHeight: '320px' }}>

          {/* Camera Preview Card - Large */}
          <div className="flex-[2.5] relative rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl">
            {showPermissionPrompt ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-6 text-center">
                <div className="w-14 h-14 bg-yellow-500/20 rounded-full flex items-center justify-center mb-3">
                  <Video size={28} className="text-yellow-400" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">Camera & Microphone Access Required</h3>
                <p className="text-[10px] text-gray-400 mb-3 max-w-xs">
                  We need permission to access your camera and microphone for streaming.
                </p>
                {permissionStatus === 'denied' ? (
                  <div className="space-y-2">
                    <p className="text-[10px] text-red-400">
                      Permission denied. Enable access in browser settings.
                    </p>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={requestPermissions}
                    className="px-5 py-2.5 bg-gradient-to-r from-yellow-400 to-amber-600 text-black font-bold text-xs rounded-xl hover:from-yellow-300 hover:to-amber-500 transition-all transform active:scale-95"
                  >
                    Allow Camera & Microphone
                  </button>
                )}
              </div>
            ) : (
              <div
                ref={videoContainerRef}
                className="absolute inset-0 w-full h-full bg-black overflow-hidden"
                style={{ zIndex: 1 }}
              />
            )}

            {/* Preview badge */}
            <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur px-2.5 py-1 rounded-full text-[9px] text-white font-bold border border-white/10 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" /> PREVIEW
            </div>

            {/* Draggable Camera Overlay for Gaming + Screen Share */}
            {category === 'gaming' && streamMode === 'screen' && cameraOverlayEnabled && (
              <DraggableCameraOverlay
                videoRef={cameraOverlayContainerRef}
                isVideoEnabled={cameraOverlayStream !== null}
                isAudioEnabled={isAudioEnabled}
                onToggleVideo={() => {
                  if (cameraOverlayStream) {
                    cameraOverlayStream.getTracks().forEach(t => t.stop());
                    setCameraOverlayStream(null);
                    if (cameraOverlayContainerRef.current) {
                      cameraOverlayContainerRef.current.innerHTML = '';
                    }
                  } else {
                    setCameraOverlayEnabled(false);
                    setTimeout(() => setCameraOverlayEnabled(true), 50);
                  }
                }}
                onToggleAudio={toggleAudio}
                onFlipCamera={hasMultipleCameras ? () => {
                  const newMode = facingMode === 'user' ? 'environment' : 'user';
                  setFacingMode(newMode);
                } : undefined}
                hasMultipleCameras={hasMultipleCameras}
                onClose={() => {
                  if (cameraOverlayStream) {
                    cameraOverlayStream.getTracks().forEach(t => t.stop());
                    setCameraOverlayStream(null);
                  }
                  if (cameraOverlayContainerRef.current) {
                    cameraOverlayContainerRef.current.innerHTML = '';
                  }
                  setCameraOverlayEnabled(false);
                }}
              />
            )}

            {/* Media controls overlay */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-black/50 backdrop-blur-md px-5 py-2 rounded-full border border-white/10">
              <button
                type="button"
                onClick={toggleVideo}
                className={`p-2.5 rounded-full transition-colors ${isVideoEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-600/80'}`}
                title={categoryConfig.requiresCamera && !isVideoEnabled ? 'Camera required' : 'Toggle camera'}
              >
                {isVideoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
              </button>
              <button
                type="button"
                onClick={toggleAudio}
                className={`p-2.5 rounded-full transition-colors ${isAudioEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-600/80'}`}
              >
                {isAudioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
              </button>
              {hasMultipleCameras && canUseFrontCamera && (
                <button
                  type="button"
                  onClick={flipCamera}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  title="Flip Camera"
                >
                  <RefreshCw size={18} />
                </button>
              )}
              {category === 'gaming' && screenShare.isSupported && (
                <button
                  type="button"
                  onClick={toggleScreenShare}
                  className={`p-2.5 rounded-full transition-colors ${streamMode === 'screen' ? 'bg-purple-500/80 hover:bg-purple-600/80' : 'bg-white/10 hover:bg-white/20'}`}
                  title={streamMode === 'screen' ? 'Stop Screen Share' : 'Share Screen'}
                >
                  {streamMode === 'screen' ? <Monitor size={18} /> : <Gamepad2 size={18} />}
                </button>
              )}
              {shouldForceRearCamera && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-pink-500/80 px-2.5 py-0.5 rounded-full text-[9px] whitespace-nowrap">
                  Rear Camera Only
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Quick Setting Cards */}
          <div className="flex-1 flex flex-col gap-2.5 min-w-0" style={{ minWidth: '160px' }}>

            {/* Battle Toggle Card */}
            {categorySupportsBattles && (
              <div className="flex-1 bg-zinc-900/80 rounded-xl border border-white/10 p-3 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 mb-2">
                  <Swords size={13} className="text-orange-400" />
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Battle</span>
                </div>
                <p className="text-[9px] text-slate-500 mb-2">Allow {categoryMatchingTerm.toLowerCase()} during broadcast</p>
                <button
                  type="button"
                  onClick={() => setBattleEnabled(!battleEnabled)}
                  className={cn(
                    "w-full py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                    battleEnabled
                      ? "bg-orange-500/15 border-orange-500/30 text-orange-400"
                      : "bg-white/5 border-white/10 text-slate-500 hover:text-white hover:bg-white/10"
                  )}
                >
                  {battleEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
            )}

            {/* Password Protection Card */}
            {canCreateProtected && (
              <div className="flex-1 bg-zinc-900/80 rounded-xl border border-white/10 p-3 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 mb-2">
                  <Lock size={13} className="text-purple-400" />
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Lock</span>
                </div>
                <p className="text-[9px] text-slate-500 mb-2">Password-protect your stream</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsProtected(!isProtected);
                    if (!isProtected) setBroadcastPassword('');
                  }}
                  className={cn(
                    "w-full py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                    isProtected
                      ? "bg-purple-500/15 border-purple-500/30 text-purple-400"
                      : "bg-white/5 border-white/10 text-slate-500 hover:text-white hover:bg-white/10"
                  )}
                >
                  {isProtected ? 'ON' : 'OFF'}
                </button>
              </div>
            )}

            {/* Follower Count Card */}
            <div className="flex-1 bg-zinc-900/80 rounded-xl border border-white/10 p-3 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Followers</span>
              </div>
              <div className="flex items-end gap-1">
                <span className={cn(
                  "text-xl font-black",
                  followerCount >= 1 ? "text-emerald-400" : "text-red-400"
                )}>{followerCount}</span>
                <span className="text-[10px] text-slate-600 mb-1">/ 1 min</span>
              </div>
              <div className="w-full bg-gray-700/50 rounded-full h-1.5 mt-1">
                <div
                  className={cn("h-1.5 rounded-full transition-all", followerCount >= 1 ? "bg-emerald-500" : "bg-red-500")}
                  style={{ width: `${Math.min(followerCount * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Category Info Card */}
            {category !== 'general' && (
              <div className={cn(
                "flex-1 rounded-xl border p-3",
                category === 'gaming' ? "bg-amber-500/10 border-amber-500/25" :
                category === 'debate' ? "bg-blue-500/10 border-blue-500/25" :
                category === 'education' ? "bg-green-500/10 border-green-500/25" :
                category === 'fitness' ? "bg-orange-500/10 border-orange-500/25" :
                category === 'irl' ? "bg-pink-500/10 border-pink-500/25" :
                category === 'spiritual' ? "bg-purple-500/10 border-purple-500/25" :
                category === 'tcnn' ? "bg-red-500/10 border-red-500/25" :
                "bg-white/5 border-white/15"
              )}>
                {renderCategoryInfo()}
              </div>
            )}
          </div>
        </div>

        {/* Password Input (when protected) */}
        {isProtected && canCreateProtected && (
          <div className="bg-zinc-900/80 rounded-xl border border-purple-500/20 p-3">
            <label className="block text-[10px] font-medium text-purple-300 mb-1.5">Enter Password (min 4 characters)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={broadcastPassword}
                onChange={(e) => setBroadcastPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {broadcastPassword.length > 0 && broadcastPassword.length < 4 && (
              <p className="text-[10px] text-red-400 mt-1">Password must be at least 4 characters</p>
            )}
          </div>
        )}

        {/* Gaming Follower Requirement */}
        {category === 'gaming' && (
          <div className={cn(
            "rounded-xl p-3 border",
            followerCount >= 100 || (profile?.role === 'admin' || profile?.role === 'superadmin' || profile?.is_admin || profile?.is_superadmin || profile?.is_troll_officer || profile?.is_lead_troll_officer || profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer' || profile?.role === 'secretary')
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-amber-500/10 border-amber-500/30'
          )}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-300">Gaming Follower Requirement</span>
              <span className={cn(
                "text-xs font-bold",
                followerCount >= 100 || (profile?.role === 'admin' || profile?.role === 'superadmin' || profile?.is_admin || profile?.is_superadmin || profile?.is_troll_officer || profile?.is_lead_troll_officer || profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer' || profile?.role === 'secretary')
                  ? 'text-green-400' : 'text-amber-400'
              )}>
                {followerCount} / 100
              </span>
            </div>
            <div className="w-full bg-gray-700/50 rounded-full h-1.5">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  followerCount >= 100 || (profile?.role === 'admin' || profile?.role === 'superadmin' || profile?.is_admin || profile?.is_superadmin || profile?.is_troll_officer || profile?.is_lead_troll_officer || profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer' || profile?.role === 'secretary')
                    ? 'bg-green-500' : 'bg-amber-500'
                )}
                style={{ width: `${Math.min((followerCount / 100) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Gaming Setup Panel */}
        {category === 'gaming' && (
          <GamingSetup
            streamId={streamId}
            isScreenSharing={streamMode === 'screen' && !!screenTrack}
            cameraOverlayEnabled={cameraOverlayEnabled}
            onToggleScreenShare={toggleScreenShare}
            onToggleCameraOverlay={(enabled) => setCameraOverlayEnabled(enabled)}
          />
        )}

        {/* Religion Selector */}
        {renderReligionSelector()}

        {/* Battle/Match Info */}
        {renderBattleInfo()}

        {/* Permission Warning */}
        {showPermissionPrompt && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
            <p className="text-amber-300 text-xs">
              Camera and microphone permissions are required to start streaming.
            </p>
          </div>
        )}

        {/* Bottom Row: Title + Category + Go Live */}
        <div className="bg-zinc-900/80 rounded-2xl border border-white/10 p-4 flex flex-col md:flex-row items-stretch md:items-end gap-3">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-400 mb-1">Stream Title</label>
              <input
                type="text"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter stream title"
                className="w-full bg-zinc-900/80 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-400 mb-1">Category</label>
              <select
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as BroadcastCategoryId)}
                className="w-full bg-zinc-900/80 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
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
          </div>
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleStartStream}
              disabled={loading || !title.trim() || (categoryRequiresReligion && !selectedReligion) || (shouldForceRearCamera && !hasRearCamera) || showPermissionPrompt || (broadcasterLimitInfo && !broadcasterLimitInfo.canStart)}
              className="w-full md:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold text-sm hover:from-amber-300 hover:to-orange-400 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></span>
                  Starting...
                </span>
              ) : showPermissionPrompt ? (
                'Grant Permissions'
              ) : (broadcasterLimitInfo && !broadcasterLimitInfo.canStart) ? (
                'Limit Reached'
              ) : (
                <>
                  <Radio size={16} />
                  Start Broadcast
                </>
              )}
            </button>
          </div>
        </div>

        {shouldForceRearCamera && !hasRearCamera && (
          <p className="text-red-400 text-xs text-center">A rear camera is required for this category but none was detected.</p>
        )}

        {/* Troll Deck Install / Open Prompt */}
        <DeckInstallPrompt />
      </div>
    </div>
  );
}
