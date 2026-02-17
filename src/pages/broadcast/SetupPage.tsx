import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { PreflightStore } from '@/lib/preflightStore';
import { Video, VideoOff, Mic, MicOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { LiveKitService } from '@/lib/LiveKitService';
import { MobileErrorLogger } from '@/lib/MobileErrorLogger';

import { generateUUID } from '../../lib/uuid';

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

export default function SetupPage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuthStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [gameStreamKey, setGameStreamKey] = useState('');
  const [isGeneratingStreamKey, setIsGeneratingStreamKey] = useState(false);
  const [rtmpUrl, setRtmpUrl] = useState('');
  const [ingressStatus, setIngressStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showObsChecklist, setShowObsChecklist] = useState(false);
  const [loading, setLoading] = useState(false);
  const [launchLimitMessage, setLaunchLimitMessage] = useState<string | null>(null);
  const [restrictionCheck, setRestrictionCheck] = useState<{ allowed: boolean; waitTime?: string; reason?: string; message?: string } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null); // Live timer in seconds

  const rtmpIngestUrl = (import.meta as any).env?.VITE_LIVEKIT_INGRESS_URL || (import.meta as any).env?.VITE_RTMP_INGRESS_URL || '';
  const displayRtmpUrl = rtmpUrl || profile?.ingress_url || rtmpIngestUrl;

  // Pre-generate stream ID for token optimization
  const [streamId] = useState(() => generateUUID());

  // Track if we are navigating to broadcast to prevent cleanup
  const isStartingStream = useRef(false);
  const hasPrefetched = useRef<string | null>(null);

  const provisionIngress = useCallback(async (rotate: boolean) => {
    if (!user?.id) return;
    setIsGeneratingStreamKey(true);
    setIngressStatus('idle');
    const { data, error } = await supabase.functions.invoke('livekit-ingress', {
      body: { broadcaster_id: user.id, rotate }
    });

    if (error) {
      console.error('[SetupPage] Ingress provisioning failed:', error);
      toast.error('Failed to generate stream key');
      setIngressStatus('error');
    } else {
      const streamKey = data?.stream_key || '';
      const ingressUrl = data?.rtmp_url || '';
      if (streamKey) {
        setGameStreamKey(streamKey);
        refreshProfile();
      }
      if (ingressUrl) {
        setRtmpUrl(ingressUrl);
      }
      setIngressStatus('success');
    }
    setIsGeneratingStreamKey(false);
  }, [refreshProfile, user?.id]);

  useEffect(() => {
    if (category !== 'trollmers' || !user?.id) return;
    if (isGeneratingStreamKey) return;
    provisionIngress(false);
  }, [category, isGeneratingStreamKey, provisionIngress, user?.id]);

  useEffect(() => {
    async function checkRestriction() {
      if (!user) return;
      
      console.log('[SetupPage] Checking restrictions for user:', user.id);

      // 1. Check Driver's License Status (Source: user_profiles)
      // We strictly enforce this for ALL users, including Admins.
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('created_at, bypass_broadcast_restriction, live_restricted_until')
        .eq('id', user.id)
        .single();
      
      if (profileError) console.error('[SetupPage] Profile fetch error:', profileError);





      // Check Bypass (Admins/VIPs) - Only bypasses account age, NOT license
      if (profile?.bypass_broadcast_restriction) {
        setRestrictionCheck({ allowed: true });
        return;
      }
        
      if (profile?.created_at) {
        const now = new Date();

        // Check manual restriction first
        if (profile.live_restricted_until) {
          const restrictedUntil = new Date(profile.live_restricted_until);
          if (restrictedUntil > now) {
            const remaining = restrictedUntil.getTime() - now.getTime();
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            setRestrictionCheck({ 
              allowed: false, 
              waitTime: `${hours}h ${minutes}m (Admin Restricted)` 
            });
            return;
          }
        }

        const created = new Date(profile.created_at);
        const diff = now.getTime() - created.getTime();
        const restrictionTime = 30 * 60 * 1000; // 30 minutes
        
        if (diff < restrictionTime) {
          const remaining = restrictionTime - diff;
          const secondsRemaining = Math.ceil(remaining / 1000);
          setTimeRemaining(secondsRemaining);
          setRestrictionCheck({ 
            allowed: false, 
            waitTime: formatTime(secondsRemaining) 
          });
        } else {
          setRestrictionCheck({ allowed: true });
        }
      } else {
         // Fallback if no profile or created_at (shouldn't happen usually)
         setRestrictionCheck({ allowed: true });
       }
    }
    
    checkRestriction();
  }, [user]);
  
  // Live timer to update countdown and auto-clear when time is up
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          // Time is up - re-fetch profile to check if restriction is lifted
          return 0;
        }
        // Update the displayed waitTime in real-time
        setRestrictionCheck(prevCheck => prevCheck ? {
          ...prevCheck,
          waitTime: formatTime(prev - 1)
        } : prevCheck);
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeRemaining]);
  
  // Re-check restriction when timer reaches 0
  useEffect(() => {
    if (timeRemaining === 0 && user?.id) {
      // Trigger re-check
      const checkEligible = async () => {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('created_at')
          .eq('id', user.id)
          .single();
        
        if (profile?.created_at) {
          const now = new Date();
          const created = new Date(profile.created_at);
          const diff = now.getTime() - created.getTime();
          const restrictionTime = 30 * 60 * 1000; // 30 minutes
          
          if (diff >= restrictionTime) {
            setRestrictionCheck({ allowed: true });
            toast.success('You can now start broadcasting!');
          }
        }
      };
      checkEligible();
    }
  }, [timeRemaining, user?.id]);
   
  // Optimize: Pre-fetch LiveKit token as soon as restrictions are passed
  useEffect(() => {
    if (user && restrictionCheck?.allowed && streamId) {
      // Fix C: Prevent double prefetch
      if (hasPrefetched.current === streamId) return;
      hasPrefetched.current = streamId;

      const safeRoom = streamId.replace(/-/g, "");
      console.log('[SetupPage] Pre-fetching LiveKit token for stream:', streamId, 'Room:', safeRoom);
      const service = new LiveKitService({
        roomName: safeRoom,
        identity: user.id,
        role: 'broadcaster',
        allowPublish: true,
      });
      
      service.prepareToken()
        .then(({ token, url }) => {
          console.log('[SetupPage] Token pre-fetched successfully');
          PreflightStore.setToken(token, safeRoom, url);
        })
        .catch(err => {
          console.error('[SetupPage] Token pre-fetch failed:', err);
          // We don't block UI here, but we'll retry on start
          hasPrefetched.current = null; // Allow retry
        });
    }
  }, [user, restrictionCheck, streamId]);

  // Media state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [followerCount, setFollowerCount] = useState<number>(0);

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

    // Check for multiple cameras
    navigator.mediaDevices?.enumerateDevices().then(devices => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
    });

    // Request camera access on mount
    async function getMedia() {
      // Check for getUserMedia support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Try to explain WHY it failed
        const errorMsg = 'getUserMedia not supported in this browser/context';
        console.error(`[SetupPage] ${errorMsg}`);
        
        const isSecure = window.isSecureContext;
        
        // Log to Admin Dashboard
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
        localStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
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
      // Cleanup stream only if NOT starting stream
      if (localStream && !isStartingStream.current) {
        console.log('[SetupPage] Cleaning up media stream');
        localStream.getTracks().forEach(track => track.stop());
      } else if (isStartingStream.current && localStream) {
        console.log('[SetupPage] Preserving media stream for broadcast');
        PreflightStore.setStream(localStream);
      }
    };
  }, [facingMode, stream]); // Re-run when facing mode changes

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
      setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const copyToClipboard = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch (err) {
      console.error('[SetupPage] Copy failed:', err);
      toast.error('Copy failed');
    }
  };

  const handleRotateKey = async () => {
    if (isGeneratingStreamKey) return;
    if (!confirm('Rotate stream key? This will invalidate the current key immediately.')) return;
    await provisionIngress(true);
  };

  const handleStartStream = async () => {
    if (!title.trim()) {
      toast.error('Please enter a stream title');
      return;
    }
    if (!user) return;

    // Validate Trollmers eligibility
    if (category === 'trollmers') {
      // Admin bypass for follower requirement (testing purposes)
      const isAdmin = profile?.role === 'admin';
      
      if (!isAdmin && followerCount < 100) {
        toast.error('Trollmers requires 100+ followers');
        return;
      }
      if (!isVideoEnabled) {
        toast.error('Trollmers requires camera enabled');
        return;
      }
      if (!gameStreamKey.trim()) {
        toast.error('Trollmers requires a game stream key');
        return;
      }
    }

    setLoading(true);
    setLaunchLimitMessage(null);
    try {
      // 0. Check global broadcast limit
      // Check for active event limits first
      const { data: eventData } = await supabase.rpc('get_active_event');
      const event = eventData?.[0];
      const maxBroadcasts = event ? event.max_broadcasts : 5;

      const launchStart = new Date();
      launchStart.setHours(0, 0, 0, 0);

      const { data: usageData, error: usageError } = await supabase
        .rpc('get_launch_usage_snapshot', { p_since: launchStart.toISOString() });

      if (!usageError) {
        const rawUsage = Array.isArray(usageData) ? usageData[0]?.minutes_used : usageData?.minutes_used ?? usageData;
        const minutesUsed = Number(rawUsage || 0);

        if (minutesUsed >= 4700) {
          const message = 'Launch phase complete — next upgrade unlocking soon.';
          setLaunchLimitMessage(message);
          toast.error(message);
          setLoading(false);
          return;
        }
      }

      const { count, error: countError } = await supabase
        .from('streams')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'live');

      if (countError) throw countError;

      if (count !== null && count >= maxBroadcasts) {
        toast.error(`System Limit: Maximum of ${maxBroadcasts} concurrent broadcasts allowed${event ? ' during this event' : ''}.`);
        setLoading(false);
        return;
      }

      const roomName = category === 'trollmers'
        ? `trollmers_${user.id.replace(/-/g, "")}`
        : streamId;
      // Ensure token is ready
      const safeRoom = roomName.replace(/-/g, "");
      const preflight = PreflightStore.getToken();
      
      if (!preflight.token || preflight.roomName !== safeRoom) {
        try {
          console.log('[SetupPage] Token missing/mismatch, fetching before start...');
          const service = new LiveKitService({
            roomName: safeRoom,
            identity: user.id,
            role: 'broadcaster',
            allowPublish: true,
          });
          const { token, url } = await service.prepareToken();
          PreflightStore.setToken(token, safeRoom, url);
        } catch (err: any) {
          console.error('[SetupPage] Critical: Failed to prepare token', err);
          toast.error(`Stream setup failed: ${err.message}`);
          setLoading(false);
          return;
        }
      }

      // Create stream record with HLS URL pre-populated
      // Note: We use the ID returned by insert, so we do this in two steps or use client-generated ID.
      // Since we rely on Supabase ID generation usually, we insert first then update, OR we assume a pattern.
      // But actually, we can't know the ID before insert unless we generate it. 
      // Supabase insert returns the data. So we can update immediately after.
      
      const { data, error } = await supabase
        .from('streams')
        .insert({
          id: streamId, // Use pre-generated ID
          user_id: user.id,
          title,
          category,
          stream_kind: category === 'trollmers' ? 'trollmers' : 'regular',
          game_stream_key: category === 'trollmers' ? gameStreamKey.trim() : null,
          room_name: roomName.replace(/-/g, ""),
          camera_ready: isVideoEnabled,
          status: 'starting', // Wait for LiveKit connection
          is_live: true,
          started_at: new Date().toISOString(),
          box_count: 1, // Default to just host
          layout_mode: 'grid'
        })
        .select()
        .single();

      if (error) throw error;

      // Removed HLS Path update logic as we are LiveKit-only

      toast.success('Stream created! Going live...');
      isStartingStream.current = true;
      // Navigate using username if available (for clean URL), otherwise ID
      navigate(`/watch/${data.id}`);
    } catch (err: any) {
      console.error('Error creating stream:', err);
      toast.error(err.message || 'Failed to start stream');
    } finally {
      setLoading(false);
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
              className="w-full h-full object-cover transform scale-x-[-1]" 
            />
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/50 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">
              <button 
                onClick={toggleVideo}
                className={`p-3 rounded-full transition-colors ${isVideoEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-600/80'}`}
              >
                {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
              <button 
                onClick={toggleAudio}
                className={`p-3 rounded-full transition-colors ${isAudioEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-600/80'}`}
              >
                {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              
              {hasMultipleCameras && (
                  <button 
                    onClick={flipCamera}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    title="Flip Camera"
                  >
                    <RefreshCw size={20} />
                  </button>
              )}
            </div>
          </div>
          <p className="text-center text-sm text-gray-400">
            Check your camera and microphone before going live
          </p>
        </div>

        {/* Form Section */}
        {restrictionCheck && !restrictionCheck.allowed ? (
            <div className="space-y-6 bg-slate-900/50 p-8 rounded-3xl border border-red-500/30 shadow-xl text-center flex flex-col justify-center">
            <AlertTriangle size={48} className="text-red-500 mx-auto" />
            <>
                <h2 className="text-2xl font-bold text-white mb-2">Broadcast Cooldown Active</h2>
                <p className="text-gray-400 mb-6">
                  You are on a temporary cooldown. Please wait {restrictionCheck.waitTime} before broadcasting again.
                </p>
                <p className="text-xs text-gray-500">This helps ensure fair usage and system stability.</p>
            </>
        </div>
    ) : (
        <div className="space-y-6 bg-slate-900/50 p-8 rounded-3xl border border-white/5 shadow-xl">
              {launchLimitMessage && (
                <div className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-semibold">{launchLimitMessage}</span>
                </div>
              )}
          <div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-amber-600 bg-clip-text text-transparent">Go Live</h1>
            <p className="text-gray-400">Set up your broadcast details</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Stream Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Late Night Chill & Trolling"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all placeholder:text-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all text-gray-300"
              >
                <option value="general">General Chat</option>
                <option value="gaming">Gaming</option>
                <option value="music">Music</option>
                <option value="podcast">Podcast</option>
                <option value="debate">Debate / Battle</option>
                <option value="trollmers">🏆 Trollmers Head-to-Head</option>
              </select>
            </div>

            {category === 'trollmers' && (
              <div className="bg-gradient-to-r from-amber-500/10 to-rose-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
                {profile?.role === 'admin' && (
                  <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-2 mb-2">
                    <p className="text-xs text-green-300 font-bold">🛡️ ADMIN MODE: Follower requirement bypassed for testing</p>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">Followers:</span>
                  <span className={`font-bold ${followerCount >= 100 || profile?.role === 'admin' ? 'text-green-400' : 'text-red-400'}`}>
                    {followerCount} / 100 {profile?.role === 'admin' && '(Admin Bypass ✓)'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">Camera Ready:</span>
                  <span className={`font-bold ${isVideoEnabled ? 'text-green-400' : 'text-red-400'}`}>
                    {isVideoEnabled ? '✓ Yes' : '✗ No'}
                  </span>
                </div>
                {(followerCount < 100 && profile?.role !== 'admin') && !isVideoEnabled && (
                  <p className="text-xs text-amber-300 mt-2">
                    ⚠️ Trollmers requires 100+ followers and camera enabled
                  </p>
                )}
                {(followerCount < 100 && profile?.role !== 'admin') && isVideoEnabled && (
                  <p className="text-xs text-amber-300 mt-2">
                    ⚠️ Trollmers requires 100+ followers
                  </p>
                )}
                {followerCount >= 100 && !isVideoEnabled && (
                  <p className="text-xs text-amber-300 mt-2">
                    ⚠️ Trollmers requires camera enabled
                  </p>
                )}
                <div className="pt-2 space-y-3">
                    <div>
                    <label className="block text-xs font-medium text-amber-200 mb-1">RTMP URL</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={displayRtmpUrl || (isGeneratingStreamKey ? 'Generating...' : 'RTMP URL will appear after ingress is created')}
                        readOnly
                        className="w-full bg-slate-950 border border-amber-500/30 rounded-lg px-3 py-2 text-sm text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-amber-300/40"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(displayRtmpUrl, 'RTMP URL')}
                        disabled={!displayRtmpUrl}
                        className="px-3 py-2 text-xs font-semibold rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/40 disabled:opacity-50"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-amber-200 mb-1">Stream Key</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={gameStreamKey || (isGeneratingStreamKey ? 'Generating...' : '')}
                        readOnly
                        className="w-full bg-slate-950 border border-amber-500/30 rounded-lg px-3 py-2 text-sm text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-amber-300/40"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(gameStreamKey, 'Stream key')}
                        disabled={!gameStreamKey}
                        className="px-3 py-2 text-xs font-semibold rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/40 disabled:opacity-50"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={handleRotateKey}
                        disabled={isGeneratingStreamKey}
                        className="px-3 py-2 text-xs font-semibold rounded-lg bg-rose-500/20 text-rose-200 border border-rose-500/40 disabled:opacity-50"
                      >
                        Rotate
                      </button>
                    </div>
                    <p className="text-xs text-amber-200/70 mt-1">
                      Use OBS/Streamlabs. Console players typically use a capture card or Remote Play into a PC.
                    </p>
                    <p className={`text-xs mt-1 ${ingressStatus === 'success' ? 'text-green-300' : ingressStatus === 'error' ? 'text-red-300' : 'text-amber-200/70'}`}>
                      {ingressStatus === 'success'
                        ? 'Ingress provisioned ✅'
                        : ingressStatus === 'error'
                        ? 'Ingress failed ❌'
                        : 'Ingress provisioning...'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowObsChecklist(true)}
                      className="mt-2 text-xs font-semibold text-amber-200 underline underline-offset-2"
                    >
                      Test OBS checklist
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showObsChecklist && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-amber-200">Test OBS</h3>
                    <button
                      type="button"
                      onClick={() => setShowObsChecklist(false)}
                      className="text-sm text-gray-400 hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                  <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
                    <li>Open OBS → Settings → Stream → Service: Custom.</li>
                    <li>Paste OBS Server from Go Live (RTMP URL).</li>
                    <li>Paste the Stream Key.</li>
                    <li>Click Start Streaming in OBS.</li>
                    <li>Confirm stream shows live in Troll City within ~10 seconds.</li>
                  </ol>
                </div>
              </div>
            )}

            <button
              onClick={handleStartStream}
              disabled={loading || !title.trim()}
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
        )}
      </div>
    </div>
  );
}