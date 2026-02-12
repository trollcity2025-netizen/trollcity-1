import React, { useState, useEffect, useRef } from 'react';
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
  const { user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [loading, setLoading] = useState(false);
  const [restrictionCheck, setRestrictionCheck] = useState<{ allowed: boolean; waitTime?: string; reason?: string; message?: string } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null); // Live timer in seconds

  // Pre-generate stream ID for token optimization
  const [streamId] = useState(() => generateUUID());

  // Track if we are navigating to broadcast to prevent cleanup
  const isStartingStream = useRef(false);
  const hasPrefetched = useRef<string | null>(null);

  useEffect(() => {
    async function checkRestriction() {
      if (!user) return;
      
      console.log('[SetupPage] Checking restrictions for user:', user.id);

      // 1. Check Driver's License Status (Source: user_profiles)
      // We strictly enforce this for ALL users, including Admins.
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('created_at, bypass_broadcast_restriction, drivers_license_status, live_restricted_until')
        .eq('id', user.id)
        .single();
      
      if (profileError) console.error('[SetupPage] Profile fetch error:', profileError);

      const profileStatus = profile?.drivers_license_status?.toLowerCase();
      
      console.log('[SetupPage] License Status:', profileStatus);

      const validStatuses = ['valid', 'active', 'approved'];
      const isLicenseValid = profileStatus && validStatuses.includes(profileStatus);

      if (!isLicenseValid) {
        setRestrictionCheck({
          allowed: false,
          reason: 'license',
          message: `You must have a valid Driver's License to broadcast (Admins included). Current Status: ${profileStatus || 'None'}`
        });
        return;
      }

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
        .then(token => {
          console.log('[SetupPage] Token pre-fetched successfully');
          PreflightStore.setToken(token, safeRoom);
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

  const handleStartStream = async () => {
    if (!title.trim()) {
      toast.error('Please enter a stream title');
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      // 0. Check global broadcast limit
      // Check for active event limits first
      const { data: eventData } = await supabase.rpc('get_active_event');
      const event = eventData?.[0];
      const maxBroadcasts = event ? event.max_broadcasts : 5;

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

      // Ensure token is ready
      const safeRoom = streamId.replace(/-/g, "");
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
          const token = await service.prepareToken();
          PreflightStore.setToken(token, safeRoom);
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
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                
                {restrictionCheck.reason === 'license' ? (
                  <>
                    <h2 className="text-2xl font-bold text-white mb-2">Driver&apos;s License Required</h2>
                    <p className="text-gray-400 mb-6">
                      {restrictionCheck.message || "You need a valid Driver&apos;s License to start a broadcast."}
                    </p>
                    <button 
                      onClick={() => navigate('/dmv')}
                      className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 transition-colors text-white font-bold"
                    >
                      Go to DMV
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-white mb-2">Account in Cooldown</h2>
                    <p className="text-gray-400 mb-6">
                      New accounts must wait 30 minutes before starting a broadcast to ensure community safety.
                    </p>
                    <div className="bg-slate-950 rounded-lg p-4 border border-white/5 inline-block mx-auto">
                      <div className="text-sm text-gray-500 uppercase tracking-wider mb-1">Time Remaining</div>
                      <div className="text-2xl font-mono text-red-400 font-bold">{restrictionCheck.waitTime}</div>
                    </div>
                  </>
                )}

                <button 
                  onClick={() => navigate('/')}
                  className="mt-4 w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors text-gray-300 hover:text-white"
                >
                  Return to Home
                </button>
            </div>
        ) : (
        <div className="space-y-6 bg-slate-900/50 p-8 rounded-3xl border border-white/5 shadow-xl">
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
              </select>
            </div>

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