import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { PreflightStore } from '@/lib/preflightStore';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { Video, VideoOff, Mic, MicOff, RefreshCw, Swords, Monitor, MonitorOff, Gamepad2, Camera } from 'lucide-react';
import { useScreenShare, StreamMode, canScreenShare } from '../../hooks/useScreenShare';
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
  const [showOBSPanel, setShowOBSPanel] = useState(false);
  
  // Pre-generate stream ID for token optimization
  const [streamId] = useState(() => generateUUID());

  // Track if we are navigating to broadcast to prevent cleanup
  const isStartingStream = useRef(false);


  // Get category config
  const categoryConfig = getCategoryConfig(category);
  const categoryRequiresReligion = requiresReligion(category);
  const shouldForceRearCamera = forceRearCamera(category);
  const canUseFrontCamera = allowFrontCamera(category);
  const categorySupportsBattles = supportsBattles(category);
  const categoryMatchingTerm = getMatchingTerminology(category);


  // Media state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [hasRearCamera, setHasRearCamera] = useState(false); // New state for rear camera detection
  const [followerCount, setFollowerCount] = useState<number>(0);

  // Stream mode for gaming category (camera vs screen share)
  const [streamMode, setStreamMode] = useState<StreamMode>('camera');
  const screenShare = useScreenShare();
  const [screenTrack, setScreenTrack] = useState<any>(null);

  // Permission state - track if camera/mic permissions need to be requested
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);



  // Get Agora RTMP URL and stream key for gaming category
  useEffect(() => {
    if (category === 'gaming') {
      // For gaming, we use Agora RTMP - show the OBS panel
      // The stream key will be the channel/room ID when they start streaming
      setShowOBSPanel(true);
      // Auto-set to screen mode for gaming if supported
      if (canScreenShare()) {
        setStreamMode('screen');
      }
    } else {
      setShowOBSPanel(false);
      // Reset to camera mode for other categories
      setStreamMode('camera');
    }
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
      // Admins can bypass camera/mic requirements
      if (profile?.role === 'admin') {
        setPermissionStatus('granted');
        setShowPermissionPrompt(false);
        return;
      }

      // Check if we have a stored permission flag
      const permissionFlag = localStorage.getItem('tc_camera_permissions_granted');
      
      // If no flag (localStorage cleared or first visit), show permission prompt
      if (!permissionFlag) {
        setShowPermissionPrompt(true);
        setPermissionStatus('prompt');
        return;
      }

      // Check actual browser permission status if supported
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const cameraPerm = await navigator.permissions.query({ name: 'camera' as PermissionName });
          const micPerm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          
          if (cameraPerm.state === 'granted' && micPerm.state === 'granted') {
            setPermissionStatus('granted');
            setShowPermissionPrompt(false);
          } else if (cameraPerm.state === 'denied' || micPerm.state === 'denied') {
            setPermissionStatus('denied');
            setShowPermissionPrompt(true);
          } else {
            setPermissionStatus('prompt');
            setShowPermissionPrompt(true);
          }
        } catch (e) {
          // permissions.query might not be supported for camera/mic in some browsers
          // Fall back to trying getUserMedia
          setShowPermissionPrompt(false);
        }
      } else {
        // Browser doesn't support permissions API, assume granted if flag exists
        setPermissionStatus('granted');
        setShowPermissionPrompt(false);
      }
    };

    checkPermissions();
  }, [profile?.role]);

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
      const constraints = {
        video: enableVideo ? { facingMode: videoFacingMode } : false,
        audio: true
      };
      console.log('[acquireMediaStream] Requesting media with constraints:', constraints);
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[acquireMediaStream] Successfully acquired media stream.');
      return mediaStream;
    } catch (err: any) {
      console.warn("[acquireMediaStream] Error accessing media devices, trying audio only.", err);

      if (err.name === 'NotAllowedError') {
           toast.error("Camera permission denied. Please allow access in browser settings.");
           return null;
      }

      try {
          console.log('[acquireMediaStream] Attempting to acquire audio only stream.');
          const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          setIsVideoEnabled(false);
          toast.warning("Camera not found. Audio only mode.");
          console.log('[acquireMediaStream] Successfully acquired audio only stream.');
          return audioStream;
      } catch (audioErr) {
          console.error("[acquireMediaStream] No media devices found.", audioErr);
          toast.error("Could not access microphone either.");
          return null;
      }
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

  useEffect(() => {
    // Only acquire media if permissions have been granted
    if (showPermissionPrompt) {
      console.log('[SetupPage] Waiting for user to grant permissions.');
      return;
    }

    console.log('[SetupPage] Media acquisition useEffect triggered. facingMode:', facingMode, 'isVideoEnabled:', isVideoEnabled);
    let currentLocalStream: MediaStream | null = null;
    const isMounted = { current: true };

    navigator.mediaDevices?.enumerateDevices().then(devices => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
    });

    async function getInitialMedia() {
      console.log('[SetupPage] getInitialMedia called. Existing stream state:', stream ? 'available' : 'not available');
      // Stop previous tracks if any
      if (stream) {
          console.log('[SetupPage] Stopping previous media tracks.');
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

      let videoAttached = false;
      const attachToVideo = () => {
        if (videoRef.current && !videoAttached) {
          videoRef.current.srcObject = mediaStream;
          videoAttached = true;
          console.log('[SetupPage] Media stream attached to video element.');
        }
      };
      attachToVideo();
      if (!videoAttached) {
        setTimeout(attachToVideo, 100);
      }
    }
    getInitialMedia();

    const isStartingStreamValue = isStartingStream.current;
    return () => {
      isMounted.current = false;
      if (currentLocalStream && !isStartingStreamValue) {
        console.log('[SetupPage] Cleanup: Cleaning up media stream.');
        currentLocalStream.getTracks().forEach(track => track.stop());
      } else if (isStartingStreamValue && currentLocalStream) {
        console.log('[SetupPage] Cleanup: Preserving media stream for broadcast.');
        PreflightStore.setStream(currentLocalStream);
      }
    };
  }, [facingMode, isVideoEnabled, showPermissionPrompt]);

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => track.enabled = !isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    }
  };



  const toggleAudio = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => track.enabled = !isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const flipCamera = () => {
    if (!canUseFrontCamera && facingMode === 'environment') {
      toast.error('Front camera is not available for this category');
      return;
    }
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Toggle screen sharing for gaming mode
  const toggleScreenShare = async () => {
    if (streamMode === 'screen') {
      // Switch back to camera mode
      screenShare.stopScreenShare();
      setScreenTrack(null);
      setStreamMode('camera');
      toast.info('Switched to camera mode');
    } else {
      // Switch to screen share mode
      const track = await screenShare.startScreenShare();
      if (track) {
        setScreenTrack(track);
        setStreamMode('screen');
        toast.success('Screen sharing started!');
        
        // Handle when user stops sharing via browser UI
        screenShare.onScreenShareEnded(() => {
          setScreenTrack(null);
          setStreamMode('camera');
          toast.info('Screen sharing ended');
        });
      } else {
        toast.error(screenShare.error || 'Failed to start screen sharing');
      }
    }
  };

  const handleStartStream = async () => {


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
      if (followerCount < 1 && profile?.role !== 'admin') {
        toast.error('Trollmers requires 1+ followers');
        return;
      }
      if (!isVideoEnabled && profile?.role !== 'admin') {
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
      
      // 3. Create Agora client
      const agoraClient = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8'
      });
      
      // 4. Join the channel
      const appIdFromToken = (tokenData as any)?.appId || (tokenData as any)?.app_id || null;
      const appIdEnv = import.meta.env.VITE_AGORA_APP_ID ? String(import.meta.env.VITE_AGORA_APP_ID).trim() : '';
      const effectiveAppId = (appIdFromToken || appIdEnv || '').trim();
      if (!effectiveAppId) {
        throw new Error('Agora App ID is missing or invalid');
      }
      console.log("RAW VITE_AGORA_APP_ID from env:", import.meta.env.VITE_AGORA_APP_ID);
      console.log("App ID from tokenData:", appIdFromToken);
      console.log("Effective App ID used for join:", effectiveAppId);
      console.log("SUPABASE URL:", import.meta.env.VITE_SUPABASE_URL);
      
      await agoraClient.join(
        effectiveAppId,
        streamId,
        tokenData.token,
        numericUid
      );
      
      console.log('[SetupPage] Joined Agora channel:', streamId, 'with UID:', numericUid);
      
      // 5. Create tracks from existing MediaStream (NOT new tracks)
      let localStream = PreflightStore.getStream();
      console.log('[handleStartStream] Stream from PreflightStore:', localStream ? 'available' : 'not available');

      let audioTrack: any = null;
      let videoTrack: any = null;

      // Check if we're in screen share mode for gaming
      if (category === 'gaming' && streamMode === 'screen' && screenTrack) {
        // Use screen share track
        videoTrack = screenTrack;
        
        // Still need audio from microphone
        if (!localStream) {
          localStream = await acquireMediaStream(facingMode, false); // Audio only
        }
        const baseAudio = localStream?.getAudioTracks()[0] || null;
        audioTrack = baseAudio
          ? await AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: baseAudio })
          : null;
          
        console.log('[handleStartStream] Using screen share track for gaming');
      } else {
        // Fallback: If no stream from PreflightStore, try to acquire it directly
        if (!localStream) {
          toast.info('Attempting to re-acquire media stream...');
          localStream = await acquireMediaStream(facingMode, isVideoEnabled);
          console.log('[handleStartStream] Stream after fallback acquisition:', localStream ? 'available' : 'not available');
        }

        if (!localStream) {
          throw new Error('Media stream not available. Please ensure camera and microphone permissions are granted.');
        }
        
        const baseAudio = localStream?.getAudioTracks()[0] || null;
        const baseVideo = isVideoEnabled ? (localStream?.getVideoTracks()[0] || null) : null;

        audioTrack = baseAudio
          ? await AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: baseAudio })
          : null;

        videoTrack = baseVideo
          ? await AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: baseVideo })
          : null;
      }



      // 6. Publish tracks
      const tracksToPublish: any[] = [];
      if (audioTrack) tracksToPublish.push(audioTrack);
      if (videoTrack) tracksToPublish.push(videoTrack);

      
      if (tracksToPublish.length === 0) {
        throw new Error('No media tracks available to publish. Please check your camera/microphone setup.');
      }
      
      await agoraClient.publish(tracksToPublish);
      console.log('[SetupPage] Published tracks to Agora');
      
      // 7. Store client and tracks in PreflightStore for BroadcastPage
      const localTracks: [any, any, null, null] = [audioTrack, videoTrack, null, null];
      PreflightStore.setAgoraClient(agoraClient, localTracks);
      
      // Update stream status after successful join/publish
      await supabase
        .from('streams')
        .update({
          status: 'starting',
          is_live: true,
          started_at: new Date().toISOString()
        })
        .eq('id', streamId);
      
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



  // Render OBS Panel for Gaming category - Agora RTMP
  const renderOBSPanel = () => {
    if (!showOBSPanel) return null;
    
    // For gaming, we use Agora RTMP - show the OBS panel
    // Note: Agora requires Cloud Recording to be enabled for RTMP ingest
    // Format: rtmp://[projectID].agora.io/live/[channel]
    const agoraRTMPUrl = 'rtmp://rtmp.agora.io/live';
    const agoraStreamKey = streamId; // The stream/room ID is used as the channel name
    
    // Mobile fallback - phones often cannot screen share
    if (!screenShare.isSupported) {
      return (
        <div className="bg-slate-950/80 border border-amber-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <Monitor size={18} />
            <span className="font-semibold">🎮 Gaming Mode</span>
          </div>
          
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <p className="text-xs text-amber-300">
              📱 Screen sharing is not supported on this device/browser.
              You can still stream using your camera.
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setStreamMode('camera')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${streamMode === 'camera' ? 'bg-amber-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              <Camera size={16} className="inline mr-2" />
              Camera
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="bg-slate-950/80 border border-purple-500/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-purple-400">
          <Monitor size={18} />
          <span className="font-semibold">🎮 Stream Your Game</span>
        </div>
        
        {/* Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setStreamMode('camera')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${streamMode === 'camera' ? 'bg-purple-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            <Camera size={16} className="inline mr-2" />
            Camera
          </button>
          <button
            onClick={() => {
              if (streamMode !== 'screen') {
                toggleScreenShare();
              } else {
                setStreamMode('camera');
                screenShare.stopScreenShare();
                setScreenTrack(null);
              }
            }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${streamMode === 'screen' ? 'bg-purple-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            <Gamepad2 size={16} className="inline mr-2" />
            Screen
          </button>
        </div>
        
        <div className="space-y-3 text-sm">
          {/* Quick Start - In Browser */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <span className="font-semibold">✅ Easiest: In-Browser</span>
            </div>
            <p className="text-xs text-gray-400">
              Click the 🎮 <Monitor size={12} className="inline" /> icon above your camera preview to share your screen directly!
            </p>
          </div>
          
          {/* OBS Option */}
          <div className="border-t border-white/10 pt-3">
            <p className="text-xs text-gray-400 mb-2">
              Or use OBS Studio for advanced streaming:
            </p>
            <div>
              <span className="text-gray-400">RTMP Ingest URL:</span>
              <code className="block bg-black/50 p-2 rounded text-blue-300 text-xs mt-1">
                {agoraRTMPUrl}
              </code>
            </div>
            
            <div className="mt-2">
              <span className="text-gray-400">Stream Key (Channel):</span>
              <div className="flex gap-2 mt-1">
                <code className="flex-1 bg-black/50 p-2 rounded text-green-400 text-xs break-all">
                  {agoraStreamKey}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(agoraStreamKey);
                    toast.success('Stream key copied!');
                  }}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white"
                >
                  Copy
                </button>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-2">
              Use these settings in OBS Studio → Settings → Stream
            </p>
          </div>
        </div>
      </div>
    );
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
            {profile?.role === 'admin' && (
              <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-2 mb-2">
                <p className="text-xs text-green-300 font-bold">🛡️ ADMIN MODE: Follower requirement bypassed for testing</p>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Followers:</span>
              <span className={`font-bold ${followerCount >= 1 || profile?.role === 'admin' ? 'text-green-400' : 'text-red-400'}`}>
                {followerCount} / 1 {profile?.role === 'admin' && '(Admin Bypass ✓)'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Camera Ready:</span>
              <span className={`font-bold ${isVideoEnabled ? 'text-green-400' : 'text-red-400'}`}>
                {isVideoEnabled ? '✓ Yes' : '✗ No'}
              </span>
            </div>
            {(followerCount < 1 && profile?.role !== 'admin') && !isVideoEnabled && (
              <p className="text-xs text-amber-300 mt-2">
                ⚠️ Trollmers requires 1+ followers and camera enabled
              </p>
            )}
            {(followerCount < 1 && profile?.role !== 'admin') && isVideoEnabled && (
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
            {showPermissionPrompt && profile?.role !== 'admin' ? (
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
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={requestPermissions}
                    className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-amber-600 text-black font-bold rounded-xl hover:from-yellow-300 hover:to-amber-500 transition-all transform active:scale-95"
                  >
                    Allow Camera & Microphone
                  </button>
                )}
              </div>
            ) : profile?.role === 'admin' && !stream ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-6 text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                  <Video size={32} className="text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Admin Mode</h3>
                <p className="text-sm text-gray-400 mb-4 max-w-xs">
                  You can start streaming without camera and microphone access.
                  Regular users must grant permissions to stream.
                </p>
                <button
                  onClick={() => {
                    // For admin, just set permissions as granted without actually requesting
                    localStorage.setItem('tc_camera_permissions_granted', 'true');
                    localStorage.setItem('tc_camera_permissions_timestamp', Date.now().toString());
                    setPermissionStatus('granted');
                    setShowPermissionPrompt(false);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-green-400 to-emerald-600 text-black font-bold rounded-xl hover:from-green-300 hover:to-emerald-500 transition-all transform active:scale-95"
                >
                  Continue Without Camera
                </button>
              </div>
            ) : (
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
              />
            )}
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/50 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">
              <button 
                onClick={toggleVideo}
                className={`p-3 rounded-full transition-colors ${isVideoEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-600/80'}`}

                disabled={false}

                title={categoryConfig.requiresCamera && !isVideoEnabled ? 'Camera required for this category' : 'Toggle camera'}
              >
                {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
              <button 
                onClick={toggleAudio}
                className={`p-3 rounded-full transition-colors ${isAudioEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-600/80'}`}
              >
                {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              
              {hasMultipleCameras && canUseFrontCamera && (
                  <button
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

            {/* OBS Panel for Gaming */}
            {renderOBSPanel()}

            {/* Religion Selector for Spiritual */}
            {renderReligionSelector()}

            {/* Battle/Match Info */}
            {renderBattleInfo()}

            {showPermissionPrompt && profile?.role !== 'admin' && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
                <p className="text-amber-300 text-sm">
                  ⚠️ Camera and microphone permissions are required to start streaming.
                </p>
              </div>
            )}

            {profile?.role === 'admin' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                <p className="text-green-300 text-sm">
                  🛡️ Admin Mode: You can start streaming without camera and microphone.
                </p>
              </div>
            )}

            <button
              onClick={handleStartStream}
              disabled={loading || !title.trim() || (categoryRequiresReligion && !selectedReligion) || (shouldForceRearCamera && !hasRearCamera && profile?.role !== 'admin') || (showPermissionPrompt && profile?.role !== 'admin')}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-600 text-black font-bold text-lg hover:from-yellow-300 hover:to-amber-500 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></span>
                  Creating your stream...
                </span>
              ) : (showPermissionPrompt && profile?.role !== 'admin') ? (
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
