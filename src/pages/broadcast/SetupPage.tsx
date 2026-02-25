import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { PreflightStore } from '@/lib/preflightStore';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { Video, VideoOff, Mic, MicOff, AlertTriangle, RefreshCw, Radio, Youtube, Users, BookOpen, Dumbbell, Briefcase, Heart, Swords, Monitor, MonitorOff } from 'lucide-react';
import { toast } from 'sonner';
import { MobileErrorLogger } from '@/lib/MobileErrorLogger';
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

// Format time as HH:MM or MM:SS
function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Category icon component
function CategoryIcon({ categoryId }: { categoryId: string }) {
  const config = getCategoryConfig(categoryId);
  switch (categoryId) {
    case 'general': return <span className="text-2xl">💬</span>;
    case 'just_chatting': return <span className="text-2xl">☕</span>;
    case 'gaming': return <span className="text-2xl">🎮</span>;
    case 'music': return <span className="text-2xl">🎵</span>;
    case 'irl': return <span className="text-2xl">📍</span>;
    case 'debate': return <span className="text-2xl">⚖️</span>;
    case 'education': return <span className="text-2xl">📚</span>;
    case 'fitness': return <span className="text-2xl">💪</span>;
    case 'business': return <span className="text-2xl">💼</span>;
    case 'spiritual': return <span className="text-2xl">✝️</span>;
    case 'trollmers': return <span className="text-2xl">🏆</span>;
    case 'election': return <span className="text-2xl">🗳️</span>;
    default: return <span className="text-2xl">💬</span>;
  }
}

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
  const [selectedReligion, setSelectedReligion] = useState<string>('');
  const [streamKey, setStreamKey] = useState<string>('');
  const [showOBSPanel, setShowOBSPanel] = useState(false);
  
  // Pre-generate stream ID for token optimization
  const [streamId] = useState(() => generateUUID());

  // Track if we are navigating to broadcast to prevent cleanup
  const isStartingStream = useRef(false);
  const hasPrefetched = useRef<string | null>(null);

  // Get category config
  const categoryConfig = getCategoryConfig(category);
  const categorySupportsBattles = supportsBattles(category);
  const categoryMatchingTerm = getMatchingTerminology(category);
  const categoryRequiresReligion = requiresReligion(category);
  const shouldForceRearCamera = forceRearCamera(category);
  const canUseFrontCamera = allowFrontCamera(category);
  const maxBoxes = getMaxBoxCount(category);

  // Media state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  // Get Agora RTMP URL and stream key for gaming category
  useEffect(() => {
    if (category === 'gaming') {
      // For gaming, we use Agora RTMP - show the OBS panel
      // The stream key will be the channel/room ID when they start streaming
      setShowOBSPanel(true);
    } else {
      setShowOBSPanel(false);
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
  }, [category, shouldForceRearCamera, canUseFrontCamera]);

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

  useEffect(() => {
    let localStream: MediaStream | null = null;
    const isMounted = { current: true };

    // Check for multiple cameras
    navigator.mediaDevices?.enumerateDevices().then(devices => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
    });

    // Request camera access on mount
    async function getMedia() {
      // Check for getUserMedia support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMsg = 'getUserMedia not supported in this browser/context';
        console.error(`[SetupPage] ${errorMsg}`);
        const isSecure = window.isSecureContext;
        
        MobileErrorLogger.logError(new Error(errorMsg), 'SetupPage:getUserMediaCheck');

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
        return;
      }

      try {
        // Stop previous tracks if any
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode }, 
          audio: true 
        });
        
        if (!isMounted.current) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }
        
        localStream = mediaStream;
        setStream(mediaStream);
        
        // Track if we've already attached to prevent multiple flashes
        let videoAttached = false;
        
        // Attach to video element - try immediately and also set up observer
        const attachToVideo = () => {
          if (videoRef.current && !videoAttached) {
            videoRef.current.srcObject = mediaStream;
            videoAttached = true;
          }
        };
        
        // Try immediately
        attachToVideo();
        
        // Also try after a short delay in case element isn't mounted yet (only if not already attached)
        if (!videoAttached) {
          setTimeout(attachToVideo, 100);
        }
        
      } catch (err: any) {
        console.warn("Error accessing media devices, trying audio only.", err);
        MobileErrorLogger.logError(err, 'SetupPage:getUserMedia');

        if (err.name === 'NotAllowedError') {
             toast.error("Camera permission denied. Please allow access in browser settings.");
             return;
        }

        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            if (!isMounted.current) return;
            localStream = audioStream;
            setStream(audioStream);
            setIsVideoEnabled(false);
            toast.warning("Camera not found. Audio only mode.");
        } catch (audioErr) {
            console.error("No media devices found.", audioErr);
            toast.error("Could not access microphone either.");
        }
      }
    }
    getMedia();

    return () => {
      isMounted.current = false;
      // Cleanup stream only if NOT starting stream
      if (localStream && !isStartingStream.current) {
        console.log('[SetupPage] Cleaning up media stream');
        localStream.getTracks().forEach(track => track.stop());
      } else if (isStartingStream.current && localStream) {
        console.log('[SetupPage] Preserving media stream for broadcast');
        PreflightStore.setStream(localStream);
      }
    };
  }, [facingMode]); // Only re-run when facing mode changes

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => track.enabled = !isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing && screenStream) {
      // Stop screen sharing
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
      
      // Restore camera stream to video element
      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      toast.success('Screen sharing stopped');
    } else {
      // Start screen sharing
      try {
        // Check if getDisplayMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          toast.error('Screen sharing is not supported in this browser');
          return;
        }
        
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: true // Attempt to capture system audio
        });
        
        // Handle user stopping share via browser UI
        displayStream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
          setIsScreenSharing(false);
          if (stream && videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          toast.warning('Screen sharing ended');
        };
        
        setScreenStream(displayStream);
        setIsScreenSharing(true);
        
        // Show screen in video element
        if (videoRef.current) {
          videoRef.current.srcObject = displayStream;
        }
        
        toast.success('Screen sharing started! 🎮');
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          toast.error('Screen sharing was cancelled');
        } else {
          console.error('Screen share error:', err);
          toast.error('Failed to start screen sharing');
        }
      }
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

    // Check camera requirement for categories that need it
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
          status: 'starting',
          is_live: true,
          started_at: new Date().toISOString(),
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

      let muxStreamKey: string | null = null;

      // Create Mux stream and get RTMP credentials for all broadcast types
      try {
        const { data: muxData, error: muxError } = await supabase.functions.invoke('create-mux-stream', {
          body: {
            type: 'broadcast',
            room_id: streamId,
            room_name: title,
            title: title
          }
        });

        if (muxError) {
          console.warn('Failed to create Mux stream:', muxError);
        } else if (muxData?.success) {
          muxStreamKey = muxData.stream_key;
          // Update the stream with Mux credentials
          await supabase
            .from('streams')
            .update({
              mux_playback_id: muxData.playback_id,
              mux_stream_key: muxData.stream_key,
              mux_rtmp_url: muxData.rtmp_url
            })
            .eq('id', streamId);

          // For gaming category, show OBS panel with stream key
          if (category === 'gaming' && muxData.stream_key) {
            setStreamKey(muxData.stream_key);
            setShowOBSPanel(true);
          }
        }
      } catch (muxErr) {
        console.warn('Mux stream creation failed:', muxErr);
      }

      // Now start Agora and Mux WHIP streaming BEFORE navigating
      toast.success('Starting broadcast...');
      isStartingStream.current = true;

      try {
        // Get Agora token
        const numericUid = Math.floor(Math.random() * 100000);
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('agora-token', {
          body: { channel: streamId, uid: numericUid, role: 'publisher' }
        });

        if (tokenError || !tokenData?.token) {
          console.warn('Failed to get Agora token:', tokenError);
          // Continue anyway - viewers can still use Mux
        } else {
          // Create Agora client
          const agoraClient = AgoraRTC.createClient({
            mode: 'rtc',
            codec: 'vp8'
          });

          // Join Agora channel
          await agoraClient.join(
            import.meta.env.VITE_AGORA_APP_ID!,
            streamId,
            tokenData.token,
            numericUid
          );
          console.log('[SetupPage] Joined Agora channel');

  // Media source priority: screen share takes precedence over camera
  const mediaSource = isScreenSharing && screenStream ? screenStream : stream;
  
  console.log("[MEDIA SOURCE]", {
    screen: isScreenSharing,
    hasScreenStream: !!screenStream,
    hasCameraStream: !!stream,
    source: isScreenSharing ? 'screen' : 'camera',
    tracks: mediaSource?.getTracks().length || 0
  });
          
          // Check for either audio OR video tracks - screen streams often don't have audio
          const hasMedia = mediaSource && (mediaSource.getAudioTracks().length > 0 || mediaSource.getVideoTracks().length > 0);
          
          if (hasMedia) {
            // Get tracks from BOTH screen and camera streams when screen sharing
            // This ensures camera continues publishing when screen share ends
            const audioTrack = mediaSource?.getAudioTracks()[0];
            const videoTrack = mediaSource?.getVideoTracks()[0];
            
            // Also get camera stream tracks for overlay (if screen sharing)
            const cameraAudioTrack = stream?.getAudioTracks()[0];
            const cameraVideoTrack = stream?.getVideoTracks()[0];

            // Create custom Agora tracks from existing MediaStream tracks
            // This ensures we use the PRE-EXISTING tracks from SetupPage (including screen share)
            let agoraAudioTrack: any = null;
            let agoraVideoTrack: any = null;
            
            // For camera overlay tracks (used when screen sharing)
            let cameraAudioCustomTrack: any = null;
            let cameraVideoCustomTrack: any = null;
            
            try {
              // Create custom audio track from existing stream's audio track
              if (audioTrack) {
                agoraAudioTrack = AgoraRTC.createCustomAudioTrack({
                  mediaStreamTrack: audioTrack
                });
                console.log('[SetupPage] Created custom audio track from existing stream');
              }
            } catch (audioErr) {
              console.warn('[SetupPage] Could not create custom audio track:', audioErr);
            }
            
            try {
              // Create custom video track from existing stream's video track
              if (videoTrack) {
                agoraVideoTrack = AgoraRTC.createCustomVideoTrack({
                  mediaStreamTrack: videoTrack
                });
                console.log('[SetupPage] Created custom video track from existing stream:', isScreenSharing ? 'screen share' : 'camera');
              }
            } catch (videoErr) {
              console.warn('[SetupPage] Could not create custom video track:', videoErr);
            }

            // When screen sharing, also create camera tracks for overlay
            if (isScreenSharing && cameraAudioTrack && cameraVideoTrack) {
              try {
                cameraAudioCustomTrack = AgoraRTC.createCustomAudioTrack({
                  mediaStreamTrack: cameraAudioTrack
                });
                console.log('[SetupPage] Created camera audio track for overlay');
              } catch (err) {
                console.warn('[SetupPage] Could not create camera audio track:', err);
              }
              
              try {
                cameraVideoCustomTrack = AgoraRTC.createCustomVideoTrack({
                  mediaStreamTrack: cameraVideoTrack
                });
                console.log('[SetupPage] Created camera video track for overlay');
              } catch (err) {
                console.warn('[SetupPage] Could not create camera video track:', err);
              }
            }

            // Build tracks array for publishing
            // When screen sharing: publish BOTH screen tracks AND camera tracks
            // This allows seamless transition when stopping screen share
            const tracksToPublish: any[] = [];
            
            if (agoraAudioTrack) tracksToPublish.push(agoraAudioTrack);
            if (agoraVideoTrack) tracksToPublish.push(agoraVideoTrack);
            
            // Add camera overlay tracks when screen sharing
            if (isScreenSharing) {
              if (cameraAudioCustomTrack) tracksToPublish.push(cameraAudioCustomTrack);
              if (cameraVideoCustomTrack) tracksToPublish.push(cameraVideoCustomTrack);
            }
            
            if (tracksToPublish.length > 0) {
              await agoraClient.publish(tracksToPublish);
              console.log('[SetupPage] Published to Agora:', tracksToPublish.map(t => t.getType?.() || 'unknown'));
            } else {
              console.warn('[SetupPage] No tracks to publish');
            }

            // Wait briefly for Agora to establish media flow
            console.log('[SetupPage] Waiting for Agora media flow...');
            await new Promise(resolve => setTimeout(resolve, 500));

            // Using Agora only - no Mux needed
            console.log('[BroadcastPage] Broadcast is live via Agora!');
            toast.success(isScreenSharing ? 'Live with screen share! 🎮' : 'Live on Troll City! 🏙️');

            // Store Agora client and tracks in PreflightStore for BroadcastPage
            // IMPORTANT: Store as [audioTrack, videoTrack, cameraAudioTrack?, cameraVideoTrack?] for BroadcastPage compatibility
            // When screen sharing: [screenAudio, screenVideo, cameraAudio, cameraVideo]
            // When no screen share: [audio, video, null, null]
            const tracksTuple: [any, any, any, any] = [
              agoraAudioTrack, 
              agoraVideoTrack,
              isScreenSharing ? cameraAudioCustomTrack : null,
              isScreenSharing ? cameraVideoCustomTrack : null
            ];
            PreflightStore.setAgoraClient(agoraClient, tracksTuple);
            
            // Also store the media source stream for BroadcastPage to use
            PreflightStore.setStream(mediaSource);
            
            // Store camera stream for overlay when screen sharing
            if (isScreenSharing && stream) {
              PreflightStore.setCameraStream(stream);
            }
            
            console.log('[SetupPage] Stored Agora client and tracks in PreflightStore:', 
              tracksTuple.map(t => t ? t.getType?.() || 'track' : 'null'));
          }
        }
      } catch (agoraErr) {
        console.error('[SetupPage] Error with Agora:', agoraErr);
        // Continue anyway - stream will work without Agora, just viewers need to use Mux
      }

      // Navigate to broadcast page
      navigate(`/broadcast/${data.id}`);
    } catch (err: any) {
      console.error('Error creating stream:', err);
      toast.error(err.message || 'Failed to start stream');
    } finally {
      setLoading(false);
    }
  };

  const copyStreamKey = () => {
    navigator.clipboard.writeText(streamKey);
    toast.success('Stream key copied!');
  };

  // Render OBS Panel for Gaming category - Agora RTMP
  const renderOBSPanel = () => {
    if (!showOBSPanel) return null;
    
    // For gaming, we use Agora RTMP
    // Note: Agora requires Cloud Recording to be enabled for RTMP ingest
    // Format: rtmp://[projectID].agora.io/live/[channel]
    const agoraRTMPUrl = 'rtmp://rtmp.agora.io/live';
    const agoraStreamKey = streamId; // The stream/room ID is used as the channel name
    
    return (
      <div className="bg-slate-950/80 border border-purple-500/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-purple-400">
          <Monitor size={18} />
          <span className="font-semibold">🎮 Stream Your Game</span>
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
      case 'music':
        return (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 text-sm">
            <p className="text-purple-300">🎵 Add up to 4 guest boxes (YouTube player counts as one)</p>
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
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline 
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
            />
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/50 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">
              <button 
                onClick={toggleVideo}
                className={`p-3 rounded-full transition-colors ${isVideoEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-600/80'} ${isScreenSharing ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isScreenSharing}
                title={isScreenSharing ? 'Disable screen share to toggle camera' : (categoryConfig.requiresCamera && !isVideoEnabled ? 'Camera required for this category' : 'Toggle camera')}
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
              
              {/* Screen Share Button for Gaming */}
              {category === 'gaming' && (
                <button 
                  onClick={toggleScreenShare}
                  className={`p-3 rounded-full transition-colors ${isScreenSharing ? 'bg-green-500/80 hover:bg-green-600/80' : 'bg-purple-500/80 hover:bg-purple-600/80'}`}
                  title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen (Gaming)'}
                >
                  {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
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
                <option value="music">🎵 Music</option>
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

            <button
              onClick={handleStartStream}
              disabled={loading || !title.trim() || (categoryRequiresReligion && !selectedReligion)}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-600 text-black font-bold text-lg hover:from-yellow-300 hover:to-amber-500 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></span>
                  Creating your stream...
                </span>
              ) : (
                'Start Broadcast'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
