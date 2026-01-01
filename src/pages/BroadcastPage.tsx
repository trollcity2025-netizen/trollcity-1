import React, { 
  useCallback, 
  useEffect, 
  useMemo, 
  useRef, 
  useState 
} from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useLiveKit } from '../hooks/useLiveKit';
import { useLiveKitSession } from '../hooks/useLiveKitSession';
import { useSeatRoster } from '../hooks/useSeatRoster';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import {
  Users,
  Heart,
} from 'lucide-react';
import ChatBox from '../components/broadcast/ChatBox';
import GiftModal from '../components/broadcast/GiftModal';
import ProfileModal from '../components/broadcast/ProfileModal';
import GiftBox from '../components/broadcast/GiftBox';
import CoinStoreModal from '../components/broadcast/CoinStoreModal';
import { OfficerStreamGrid } from '../components/OfficerStreamGrid';
import GiftEventOverlay from './GiftEventOverlay';
import { useGiftEvents } from '../lib/hooks/useGiftEvents';

// Constants
const _TEXT_ENCODER = new TextEncoder();
const SEAT_COUNT = 6;
const _LOCAL_VIEWER_ID_KEY = "trollcity_viewer_id_v1";
const STREAM_POLL_INTERVAL = 2000;

// Types
interface StreamRow {
  id: string;
  broadcaster_id: string;
  status: string;
  is_live: boolean;
  viewer_count?: number;
  total_gifts_coins?: number;
  total_likes?: number;
  room_name?: string;
  start_time?: string;
  current_viewers?: number;
}



interface _ControlMessage {
  type: 'admin-action'
  action: 'mute-all' | 'remove'
  seatIndex?: number
  initiatorId?: string
}

interface MediaStreamConfig {
  video: MediaTrackConstraints;
  audio: MediaTrackConstraints;
}

// Media configuration
const DEFAULT_MEDIA_CONFIG: MediaStreamConfig = {
  video: {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    facingMode: 'user',
    frameRate: { ideal: 30, max: 60 }
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};

// Custom hooks for state management

const useDisplayName = (profile: any) => {
  return useMemo(() => {
    return profile?.username || profile?.email || "Anonymous";
  }, [profile?.username, profile?.email]);
};

const useIsBroadcaster = (profile: any, stream: StreamRow | null) => {
  return useMemo(() => {
    return Boolean(profile?.id && stream?.broadcaster_id && profile.id === stream.broadcaster_id);
  }, [profile?.id, stream?.broadcaster_id]);
};

const useIsAdmin = (profile: any) => {
  return useMemo(
    () => Boolean(profile?.role === 'admin' || profile?.is_admin || profile?.is_lead_officer),
    [profile]
  );
};

// Main component
export default function BroadcastPage() {
  // Router and navigation
  const { streamId } = useParams<{ streamId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  
  // ✅ Fix #4: Only autostart if URL has ?start=1 AND user has session
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session?.access_token);
    };
    checkSession();
  }, []);
  
  const shouldAutoStart = query.get("start") === "1" && hasSession;

  // Auth and user state
  const { user, profile } = useAuthStore();
  const displayName = useDisplayName(profile);
  
  // Stream state (defined early for useIsBroadcaster)
  const [stream, setStream] = useState<StreamRow | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState(true);
  
  const isBroadcaster = useIsBroadcaster(profile, stream);
  const _isAdmin = useIsAdmin(profile);

  // LiveKit integration
  // ✅ 3) Ensure the hook is only mounted on BroadcastPage (not globally)
  // Only initialize LiveKit when we have a valid stream and user
  const liveKit = useLiveKit();
  const roomName = useMemo(() => String(streamId || ''), [streamId]);
  
  // ✅ Only call useLiveKitSession when we have a valid streamId (prevents hook from running on home page)
  // Don't initialize LiveKit at all if we don't have a streamId
  const hasValidStreamId = !!streamId && typeof streamId === 'string' && streamId.trim() !== '';
  const sessionReady = !!user && !!profile && hasValidStreamId;
  
  const {
    joinAndPublish,
  } = useLiveKitSession({
    roomName: sessionReady && hasValidStreamId ? roomName : '', // Empty roomName prevents connection attempts
    user: sessionReady && user
      ? { ...user, identity: (user as any).identity || (user as any).id || profile?.id, role: profile?.role || 'broadcaster' }
      : null,
    role: isBroadcaster ? 'broadcaster' : 'viewer',
    allowPublish: isBroadcaster && sessionReady,
    maxParticipants: SEAT_COUNT,
  });

  const { participants, service: _service } = liveKit;
  const { seats, claimSeat, releaseSeat: _releaseSeat } = useSeatRoster(roomName);

  // Media state
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [localMediaStream, setLocalMediaStream] = useState<MediaStream | null>(null);

  // Defensive auth check: if Supabase reports no active session or refresh fails,
  // sign the user out and redirect to auth to avoid unhandled errors during LiveKit actions.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error || !data?.session) {
          console.warn('[BroadcastPage] No active session or session refresh failed, signing out.');
          try {
            await supabase.auth.signOut();
          } catch (e) {
            console.warn('Sign out failed during defensive auth handling', e);
          }
          navigate('/auth');
        }
      } catch (e: any) {
        console.warn('[BroadcastPage] Auth session check threw:', e?.message || e);
        try {
          await supabase.auth.signOut();
        } catch {}
        if (mounted) navigate('/auth');
      }
    })();
    return () => { mounted = false };
  }, [navigate]);



  // UI state
  const [trollLikeCount, setTrollLikeCount] = useState(0);
  const [coinCount, setCoinCount] = useState(0);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [isCoinStoreOpen, setIsCoinStoreOpen] = useState(false);
  const [_targetSeatIndex, setTargetSeatIndex] = useState<number | null>(null);

  // Seat management state
  const [currentSeatIndex, setCurrentSeatIndex] = useState<number | null>(null);
  const [claimingSeat, setClaimingSeat] = useState<number | null>(null);
  const [permissionErrorSeat, setPermissionErrorSeat] = useState<number | null>(null);
  const [permissionErrorMessage, setPermissionErrorMessage] = useState<string>('');

  // Refs for state tracking
  const autoStartRef = useRef(false);
  const connectRequestedRef = useRef(false);
  const prevAuthRef = useRef<boolean>(Boolean(user && profile));

  // Media access handlers
  const requestMediaAccess = useCallback(async (): Promise<MediaStream> => {
    if (localMediaStream && localMediaStream.active) {
      return localMediaStream;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Media devices API not available');
    }

    if (!window.isSecureContext) {
      throw new Error('Camera/microphone access requires a secure context');
    }

    try {
      console.log('[BroadcastPage] Requesting camera & mic');
      const stream = await navigator.mediaDevices.getUserMedia(DEFAULT_MEDIA_CONFIG);
      
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setLocalMediaStream(stream);
      return stream;
    } catch (err: any) {
      console.error('[BroadcastPage] getUserMedia failed:', {
        name: err?.name,
        message: err?.message,
        constraint: err?.constraint,
        error: err
      });
      
      // Preserve error name and message for better error handling upstream
      const error = new Error(err?.message || 'Failed to access camera/microphone');
      (error as any).name = err?.name || 'MediaAccessError';
      (error as any).originalError = err;
      throw error;
    }
  }, [localMediaStream]);

  const cleanupLocalStream = useCallback(() => {
    if (localMediaStream) {
      localMediaStream.getTracks().forEach((track) => track.stop());
      setLocalMediaStream(null);
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, [localMediaStream]);

  // Stream data loading with retry logic and fallback
  const loadStreamData = useCallback(async () => {
    if (!streamId) {
      setIsLoadingStream(false);
      return;
    }

    setIsLoadingStream(true);
    
    // ✅ Optimized: Skip connectivity test and go straight to stream query for faster loading
    // The stream was just created, so it should be available immediately
    const maxRetries = 3; // Increased retries for newly created streams
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // ✅ Give Supabase a moment to replicate the row after insert (only on attempt 1)
        if (attempt === 1) {
          console.log("⏳ Waiting 500ms for stream row replication...");
          await new Promise((r) => setTimeout(r, 500));
        }

        console.log(`📡 Loading stream info... (attempt ${attempt}/${maxRetries})`, streamId);

        // Use maybeSingle() instead of single() - more lenient, won't error if not found
        // Select only essential fields to reduce payload size
        // ✅ Increased timeout to 15000ms for all attempts to handle slow queries and replication delay
        const timeoutMs = 15000;
        
        const streamQuery = supabase
          .from("streams")
          .select("id, broadcaster_id, title, category, status, start_time, end_time, current_viewers, total_gifts_coins, total_unique_gifters, is_live, thumbnail_url, created_at, updated_at")
          .eq("id", streamId)
          .maybeSingle(); // Use maybeSingle() - returns null if not found instead of error

        const streamQueryWithTimeout = Promise.race([
          streamQuery,
          new Promise<{ data: null; error: { message: string } }>((_, reject) =>
            setTimeout(() => reject(new Error(`Stream query timeout after ${timeoutMs}ms`)), timeoutMs)
          )
        ]);

        const { data: streamRow, error: streamErr } = await streamQueryWithTimeout as any;

        if (streamErr) {
          // If it's a timeout error, retry
          if (streamErr.message?.includes('timeout') || streamErr.message?.includes('Timeout')) {
            lastError = streamErr;
            if (attempt < maxRetries) {
              console.log(`⚠️ Stream query timeout on attempt ${attempt}, retrying...`);
              // ✅ Exponential backoff: 500ms * attempt
              await new Promise(resolve => setTimeout(resolve, 500 * attempt));
              continue;
            }
          }
          
          // For other errors, check if it's a "not found" error
          if (streamErr.code === 'PGRST116' || streamErr.message?.includes('not found')) {
            console.error("❌ Stream not found:", streamErr);
            toast.error("Stream not found.");
            setIsLoadingStream(false);
            return;
          }
          
          // For other errors, retry if we have attempts left
          lastError = streamErr;
          if (attempt < maxRetries) {
            console.log(`⚠️ Stream query error on attempt ${attempt}, retrying...`, streamErr.message);
            // ✅ Exponential backoff: 500ms * attempt
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
            continue;
          }
        }

        if (!streamRow) {
          if (attempt < maxRetries) {
            console.log(`⚠️ No stream data on attempt ${attempt}, retrying...`);
            // ✅ Exponential backoff: 500ms * attempt
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
            continue;
          }
          // Last attempt failed - use fallback if we have user/profile
          console.warn("⚠️ Stream load failed: No data returned after all retries");
          if (profile && user && streamId) {
            console.warn('⚠️ Using fallback stream data - some features may be limited');
            const fallbackStream: StreamRow = {
              id: streamId,
              broadcaster_id: profile.id,
              title: 'Stream',
              status: 'live',
              is_live: true,
              start_time: new Date().toISOString(),
              total_gifts_coins: 0,
              current_viewers: 0,
            } as StreamRow;
            
            setStream(fallbackStream);
            setCoinCount(0);
            setIsLoadingStream(false);
            return;
          }
          console.error("❌ Stream load failed: No data returned and no fallback available");
          toast.error("Stream not found.");
          setIsLoadingStream(false);
          return;
        }

        // Success!
        console.log("✅ Stream loaded successfully:", streamRow.id);
        setStream(streamRow as StreamRow);
        setCoinCount(Number(streamRow.total_gifts_coins || 0));
        setIsLoadingStream(false);
        return;

      } catch (error: any) {
        lastError = error;
        
        // If it's a timeout, retry if we have attempts left
        if (error?.message?.includes('timeout') && attempt < maxRetries) {
          console.log(`⚠️ Stream query timeout on attempt ${attempt}, retrying...`);
          // ✅ Exponential backoff: 500ms * attempt
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          continue;
        }
        
        // If it's the last attempt, try fallback
        if (attempt === maxRetries) {
          console.error('❌ Failed to load stream data after all retries:', error?.message || error);
          
          // Fallback: Create minimal stream object from streamId and profile
          // This allows the page to continue functioning even if we can't load full stream data
          if (profile && user && streamId) {
            console.warn('⚠️ Using fallback stream data - some features may be limited');
            const fallbackStream: StreamRow = {
              id: streamId,
              broadcaster_id: profile.id,
              title: 'Stream',
              status: 'live',
              is_live: true,
              start_time: new Date().toISOString(),
              total_gifts_coins: 0,
              current_viewers: 0,
            } as StreamRow;
            
            setStream(fallbackStream);
            setCoinCount(0);
            setIsLoadingStream(false);
            toast.warning('Stream data loaded with limited information. Some features may not be available.');
            return;
          }
          
          setIsLoadingStream(false);
          if (error?.message?.includes('timeout')) {
            toast.error('Stream loading timed out. Please check your connection and refresh the page.');
          } else {
            toast.error('Failed to load stream information. Please try refreshing the page.');
          }
          return;
        }
      }
    }

    // If we get here, all retries failed
    setIsLoadingStream(false);
    if (lastError?.message?.includes('timeout')) {
      toast.error('Stream loading timed out. Please check your connection and refresh the page.');
    } else {
      toast.error('Failed to load stream information. Please try refreshing the page.');
    }
  }, [streamId, profile, user]);

  // Seat management handlers
  const handleSeatClaim = useCallback(
    async (index: number) => {
      if (claimingSeat !== null || currentSeatIndex !== null) return;
      
      console.log(`[BroadcastPage] Seat ${index + 1} clicked to join`);
      setClaimingSeat(index);
      setPermissionErrorSeat(null);
      setPermissionErrorMessage('');

      try {
        const stream = await requestMediaAccess();
        console.log('[BroadcastPage] Permissions granted');

        const success = await claimSeat(index, {
          username: displayName,
          avatarUrl: profile?.avatar_url,
          role: profile?.role || 'broadcaster',
          metadata: {},
        });

        if (!success) {
          throw new Error('Seat claim failed');
        }

        setCurrentSeatIndex(index);

        try {
          // ✅ 2) Only trigger joinAndPublish when ALL are true
          const { data: sessionData } = await supabase.auth.getSession()
          if (!sessionData.session) {
            console.log("[BroadcastPage] No session yet — skipping joinAndPublish")
            throw new Error('No active session. Please sign in again.')
          }
          
          if (!roomName || !user?.id || !profile?.id) {
            console.log("[BroadcastPage] Missing requirements — skipping joinAndPublish", {
              roomName,
              hasUser: !!user,
              hasProfile: !!profile
            })
            throw new Error('Missing required information to join stream')
          }

          console.log('[BroadcastPage] Calling joinAndPublish with stream', {
            streamActive: stream?.active,
            videoTracks: stream?.getVideoTracks().length || 0,
            audioTracks: stream?.getAudioTracks().length || 0,
            videoTrackEnabled: stream?.getVideoTracks()[0]?.enabled,
            audioTrackEnabled: stream?.getAudioTracks()[0]?.enabled
          });
          await joinAndPublish(stream);
        } catch (liveKitErr: any) {
          // Extract the real error message from LiveKit join attempt
          const actualError = liveKitErr?.message || 'LiveKit join failed';
          console.error('LiveKit join error details:', actualError);
          throw new Error(actualError);
        }

        // Update stream status if broadcaster
        if (isBroadcaster) {
          const { error: updateErr } = await supabase
            .from("streams")
            .update({ 
              status: "live", 
              is_live: true,
              start_time: new Date().toISOString(),
              current_viewers: 1,
              room_name: roomName
            })
            .eq("id", stream?.id);
            
          if (updateErr) console.warn("Stream status update failed:", updateErr);
        }
      } catch (err: any) {
        console.error('Failed to claim seat:', {
          error: err,
          name: err?.name,
          message: err?.message,
          originalError: err?.originalError
        });
        
        const permissionDenied = ['NotAllowedError', 'NotFoundError', 'SecurityError', 'PermissionDeniedError', 'MediaAccessError'];
        const errorMsg = err?.message || '';
        const errorName = err?.name || err?.originalError?.name || '';
        
        // Check both the error name and message for permission issues
        const isPermissionError = permissionDenied.includes(errorName) || 
                                  errorMsg.toLowerCase().includes('permission') ||
                                  errorMsg.toLowerCase().includes('not allowed') ||
                                  errorMsg.toLowerCase().includes('denied');
        
        if (isPermissionError) {
          setPermissionErrorSeat(index);
          // Provide helpful guidance based on error type
          let userMessage = 'Camera/Microphone access blocked. Please enable permissions and try again.';
          if (errorName === 'NotAllowedError' || errorMsg.includes('permission denied')) {
            userMessage = 'Camera/Microphone access was denied. Click the camera/mic icon in your browser\'s address bar to allow access, then click Retry.';
            setPermissionErrorMessage(userMessage);
            toast.error(userMessage, {
              duration: 6000
            });
          } else if (errorName === 'NotFoundError') {
            userMessage = 'No camera or microphone found. Please connect a device and try again.';
            setPermissionErrorMessage(userMessage);
            toast.error(userMessage, {
              duration: 5000
            });
          } else {
            userMessage = 'Camera/Microphone access blocked. Please check your browser settings and allow access, then try again.';
            setPermissionErrorMessage(userMessage);
            toast.error(userMessage, {
              duration: 5000
            });
          }
        } else if (errorMsg.includes('No active session') || errorMsg.includes('session')) {
          // Session expired during join attempt—redirect to auth
          toast.error('Your session has expired. Please sign in again.');
          try {
            await supabase.auth.signOut();
          } catch (e) {
            console.warn('Sign out failed during session error handling', e);
          }
          navigate('/auth');
        } else {
          // Show the actual error from LiveKit or other sources
          toast.error(`Failed to join: ${errorMsg || 'Unknown error'}`);
        }
      } finally {
        setClaimingSeat(null);
      }
    },
    [
      claimingSeat, 
      currentSeatIndex, 
      claimSeat, 
      joinAndPublish, 
      profile, 
      requestMediaAccess, 
      isBroadcaster, 
      stream?.id, 
      roomName, 
      displayName
    ]
  );



  // Admin control handlers



  // Permission retry handler
  const handlePermissionRetry = useCallback(async () => {
    if (permissionErrorSeat === null) return;
    const seatToRetry = permissionErrorSeat;
    setPermissionErrorSeat(null);
    setPermissionErrorMessage('');
    await handleSeatClaim(seatToRetry);
  }, [permissionErrorSeat, handleSeatClaim]);

  // Stream management handlers
  const handleEndStream = useCallback(async () => {
    try {
      await supabase.from('streams').update({ 
        is_live: false, 
        status: 'offline' 
      }).eq('id', stream?.id);
      
      cleanupLocalStream();
      navigate('/');
    } catch (err) {
      console.warn('Failed to end stream', err);
      toast.error('Failed to end stream');
    }
  }, [stream?.id, cleanupLocalStream, navigate]);



  const handleGiftSent = useCallback(async (amountOrGift: any) => {
    // Support old numeric API and new object API from GiftBox/GiftModal
    let totalCoins = 0;
    let quantity = 1;
    let giftName = 'Manual Gift';
    let giftId: number | string | undefined;

    if (typeof amountOrGift === 'number') {
      totalCoins = amountOrGift;
    } else if (amountOrGift && typeof amountOrGift === 'object') {
      const g = amountOrGift;
      quantity = Math.max(1, Number(g.quantity) || 1);
      const per = Number(g.coins) || 0;
      totalCoins = per * quantity;
      giftName = g.name || giftName;
      giftId = g.id;
    }

    setCoinCount(prev => prev + totalCoins);
    setIsGiftModalOpen(false);
    try {
      await supabase.from('gifts').insert({
        stream_id: stream?.id,
        sender_id: user?.id,
        receiver_id: null,
        coins_spent: totalCoins,
        gift_type: 'paid',
        message: giftName,
        gift_id: giftId,
        quantity: quantity,
      });
    } catch (e) {
      console.error('Failed to record manual gift event:', e);
    }
  }, [stream?.id, user?.id]);

  const handleCoinsPurchased = useCallback((amount: number) => {
    setCoinCount(prev => prev + amount);
    setIsCoinStoreOpen(false);
  }, []);

  // Computed values
  const renderSeats = useMemo(() => {
    return seats.map((seat, index) => ({
      seat,
      participant: seat?.user_id ? participants.get(seat.user_id) : undefined,
      index,
    }));
  }, [seats, participants]);

  const lastGift = useGiftEvents(stream?.id);

  

  // Effects
  useEffect(() => {
    return () => {
      cleanupLocalStream();
    };
  }, [cleanupLocalStream]);

  useEffect(() => {
    loadStreamData();
  }, [loadStreamData]);

  // Auto-start broadcaster when redirected from setup with ?start=1
  // ✅ Fix #4: Only runs if URL has ?start=1 AND user has session
  useEffect(() => {
    if (!shouldAutoStart || !stream?.id || !profile?.id || !isBroadcaster || autoStartRef.current || !hasSession) {
      return;
    }

    autoStartRef.current = true;
    console.log("🔥 AutoStart detected (?start=1). Starting broadcast...");
    handleSeatClaim(0);

    // Clean URL
    setTimeout(() => {
      const clean = location.pathname;
      window.history.replaceState({}, "", clean);
    }, 300);
  }, [shouldAutoStart, stream?.id, profile?.id, isBroadcaster, hasSession, handleSeatClaim, location.pathname]);

  // Redirect on auth loss
  useEffect(() => {
    const hadAuth = Boolean(prevAuthRef.current);
    const hasAuth = Boolean(user && profile);
    
    if (hadAuth && !hasAuth) {
      console.warn("⚠️ Auth lost — redirecting to login and cleaning up broadcast state");
      cleanupLocalStream();
      connectRequestedRef.current = false;
      autoStartRef.current = false;
      toast.error("Session expired — please sign in again.");
      navigate("/auth");
    }
    
    prevAuthRef.current = hasAuth;
  }, [user, profile, navigate, cleanupLocalStream]);

  // Stream status polling
  useEffect(() => {
    if (!streamId) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("streams")
        .select("status,is_live,viewer_count,total_gifts_coins")
        .eq("id", streamId)
        .maybeSingle();

      if (data) {
        setStream(prev =>
          prev
            ? {
                ...prev,
                status: data.status,
                is_live: data.is_live,
                viewer_count: data.viewer_count,
                total_gifts_coins: data.total_gifts_coins,
              }
            : prev
        );
      }
    }, STREAM_POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [streamId]);

  // Loading state
  if (isLoadingStream || !stream || !profile) {
    return (
      <div className="min-h-screen bg-[#03010c] via-[#05031a] to-[#110117] text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full border-2 border-purple-500/60 animate-pulse" />
          <p className="text-sm text-gray-300">
            {isLoadingStream ? 'Loading stream…' : !profile ? 'Loading profile…' : 'Loading stream…'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#03010c] via-[#05031a] to-[#110117] text-white">
      {/* Permission Error Banner */}
      {permissionErrorSeat !== null && (
        <div className="fixed top-4 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 px-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-red-500/60 bg-red-500/90 px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-lg shadow-red-500/50">
            <span className="flex-1 min-w-0 text-left text-[10px]">
              {permissionErrorMessage || 'Camera/Microphone blocked. Please enable permissions and try again.'}
            </span>
            <button
              onClick={handlePermissionRetry}
              className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white transition hover:bg-white/20"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="flex h-screen flex-col">
        <main className="flex-1 px-6 py-5">
          <section className="h-full rounded-[32px] border border-white/10 bg-gradient-to-b from-[#050113] to-[#0b091f] p-6 shadow-[0_30px_70px_rgba(0,0,0,0.55)]">
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">Broadcast stream</p>
                <p className="text-sm text-white/70">Six seats · {participants.size} active</p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="px-4 py-3 bg-gradient-to-r from-[#2a2540] to-[#161018] rounded-lg border border-purple-700/40">
                  <div className="text-xs text-gray-300">Likes</div>
                  <div className="text-lg font-bold flex items-center gap-2"><Heart size={16} /> {trollLikeCount}</div>
                </div>
                <div className="px-4 py-3 bg-gradient-to-r from-[#2a2540] to-[#161018] rounded-lg border border-yellow-700/30">
                  <div className="text-xs text-gray-300">Coins</div>
                  <div className="text-lg font-bold">{coinCount}</div>
                </div>
                <div className="px-4 py-3 bg-gradient-to-r from-[#2a2540] to-[#161018] rounded-lg border border-green-700/30">
                  <div className="text-xs text-gray-300">Viewers</div>
                  <div className="text-lg font-bold flex items-center gap-2"><Users size={16} /> {(stream.viewer_count || 0).toLocaleString()}</div>
                </div>
                {stream.is_live && (
                  <div className="px-3 py-2 bg-red-600 text-white rounded-full text-sm font-semibold">LIVE</div>
                )}
                <button
                  onClick={handleEndStream}
                  className="px-4 py-2 bg-red-700 hover:bg-red-800 rounded text-sm font-semibold"
                >
                  End Stream
                </button>
              </div>
            </div>

            {/* Main Content */}
            <div className="h-full grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Left Column: Broadcast Grid + Like Button + Gifts (stacked) */}
              <div className="lg:col-span-3 h-full flex flex-col gap-1">
                {/* Broadcast Grid */}
                <div className="relative flex-1 min-h-0">
                  {lastGift && <GiftEventOverlay gift={lastGift} />}
                  <OfficerStreamGrid
                    roomName={roomName}
                    onSeatClick={(idx) => {
                      setTargetSeatIndex(idx);
                      // Attempt to claim via existing handler for consistency
                      handleSeatClaim(idx).catch(() => {});
                    }}
                  />
                </div>

                {/* Like Button Row - aligned right */}
                <div className="flex justify-end">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      // optimistic
                      setTrollLikeCount((c) => c + 1);
                      try {
                        await supabase
                          .from('streams')
                          .update({ total_likes: (stream?.total_likes || 0) + 1 })
                          .eq('id', stream?.id);
                      } catch (err) {
                        console.warn('Failed to persist like:', err);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-green-700 hover:bg-green-600 rounded-xl text-sm font-semibold"
                    title="Troll Like"
                  >
                    🧟 Like
                  </button>
                </div>

                {/* Quick Gifts Panel */}
                <div className="w-full">
                  <GiftBox
                    participants={renderSeats.filter(s => s.seat).map((s) => ({ name: s.seat?.username || 'Unknown' }))}
                    onSendGift={async (gift: any, recipient?: string | null) => {
                      const qty = Math.max(1, Number(gift?.quantity) || 1);
                      const per = Number(gift?.coins) || 0;
                      const total = per * qty;

                      // optimistic UI
                      setCoinCount(prev => prev + total);

                      try {
                        // Insert into legacy gifts table to trigger real-time overlay
                        await supabase.from('gifts').insert({
                          stream_id: stream?.id,
                          sender_id: user?.id,
                          receiver_id: null,
                          coins_spent: total,
                          gift_type: 'paid',
                          message: gift?.name,
                          gift_id: gift?.id,
                          quantity: qty,
                        });
                      } catch (e) {
                        console.error('Failed to record gift event:', e);
                      }

                      if (recipient) {
                        toast.success(`Sent ${qty}× ${gift?.name} to ${recipient}`);
                      } else {
                        toast.success(`Sent ${qty}× ${gift?.name} to all viewers`);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Right Column: Chat */}
              <div className="lg:col-span-1 h-full flex flex-col gap-4">
                <div className="flex-1 min-h-0">
                  <ChatBox
                    onProfileClick={setSelectedProfile}
                    onCoinSend={(_userId, amount) => {
                      setCoinCount(prev => prev + amount);
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        </main>

        
      </div>

      {/* Hidden video element for local stream */}
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />

      {/* Modals */}
      {isGiftModalOpen && (
        <GiftModal 
          onClose={() => setIsGiftModalOpen(false)} 
          onSendGift={handleGiftSent} 
        />
      )}

      {selectedProfile && (
        <ProfileModal
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
          onSendCoins={(amount: number) => {
            setCoinCount(prev => prev + amount);
            setSelectedProfile(null);
          }}
        />
      )}

      {isCoinStoreOpen && (
        <CoinStoreModal 
          onClose={() => setIsCoinStoreOpen(false)} 
          onPurchase={handleCoinsPurchased} 
        />
      )}
    </div>
  );
}


