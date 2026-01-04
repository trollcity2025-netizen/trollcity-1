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
import { useStreamEndListener } from '../hooks/useStreamEndListener';
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
import EntranceEffect from '../components/broadcast/EntranceEffect';
import { useOfficerBroadcastTracking } from '../hooks/useOfficerBroadcastTracking';
import { attachLiveKitDebug } from '../lib/livekit-debug';

// Constants
const _TEXT_ENCODER = new TextEncoder();
const SEAT_COUNT = 6;
const _LOCAL_VIEWER_ID_KEY = "trollcity_viewer_id_v1";
const STREAM_POLL_INTERVAL = 2000;

// ✅ NEW: LiveKit join retry strategy
const LIVEKIT_JOIN_RETRY_DELAY = 2000;
const LIVEKIT_JOIN_MAX_RETRIES = 2;

// Types
interface StreamRow {
  id: string;
  broadcaster_id: string;
  status: string;
  is_live: boolean;
  current_viewers?: number;
  total_gifts_coins?: number;
  total_likes?: number;
  start_time?: string;
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
  const needsSetup = query.get("setup") === "1";
  const needsSeatJoin = location.state?.needsSeatJoin === true;

  // Auth and user state
  const { user, profile } = useAuthStore();
  const displayName = useDisplayName(profile);

  // ✅ Stable identity everywhere
  const stableIdentity = useMemo(() => {
    const id = user?.id || profile?.id;
    if (!id) console.warn('[BroadcastPage] No stable identity found');
    return id;
  }, [user?.id, profile?.id]);
  
  // Stream state (defined early for useIsBroadcaster)
  const [stream, setStream] = useState<StreamRow | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState(true);

  // ✅ NEW: Persist stream state to sessionStorage to prevent remount resets
  useEffect(() => {
    if (stream) {
      try {
        sessionStorage.setItem("activeStream", JSON.stringify(stream));
      } catch (e) {
        console.warn('Failed to save stream to sessionStorage', e);
      }
    }
  }, [stream]);
  
  const isBroadcaster = useIsBroadcaster(profile, stream);
  const _isAdmin = useIsAdmin(profile);

  // LiveKit integration
  const liveKit = useLiveKit();
  const roomName = useMemo(() => String(streamId || ''), [streamId]);

  const hasValidStreamId = !!streamId && typeof streamId === 'string' && streamId.trim() !== '';
  const sessionReady = !!user && !!profile && hasValidStreamId;

  // ✅ Fix #2: Consistent identity - defined at top level to be available for all hooks
  const livekitIdentity = useMemo(() => {
    const id = stableIdentity;
    if (!id) console.warn('[BroadcastPage] No identity found for LiveKit');
    return id;
  }, [stableIdentity]);

  const {
    joinAndPublish,
    isConnected,
    isConnecting,
  } = useLiveKitSession({
    roomName: sessionReady && hasValidStreamId ? roomName : '',
    user: sessionReady && user
      ? { ...user, identity: livekitIdentity, role: profile?.role || 'broadcaster' }
      : null,
    role: isBroadcaster ? 'broadcaster' : 'viewer',
    allowPublish: isBroadcaster && sessionReady,
    autoPublish: true,
    maxParticipants: SEAT_COUNT,
  });

  const { participants, service: _service } = liveKit;
  
  // ✅ Track officer activity
  useOfficerBroadcastTracking({
    streamId,
    connected: isConnected,
  });

  // ✅ Debug LiveKit
  useEffect(() => {
    if (isConnected) {
      const room = liveKit.getRoom();
      attachLiveKitDebug(room);
    }
  }, [isConnected, liveKit]);

  // ✅ IMPORTANT: useSeatRoster uses roomName, must match EXACTLY livekitIdentity
  const { seats, seatsLoading, claimSeat, releaseSeat: _releaseSeat } = useSeatRoster(roomName);

  // Media state - useRef to prevent re-renders that cause cleanup loops
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const preflightStreamRef = useRef<MediaStream | null>(null);

  // ✅ NEW: Prevent double-join spam
  const joinLockRef = useRef(false);

  // Defensive auth check
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
  const [mySeatNumber, setMySeatNumber] = useState<number | null>(null);
  const [claimingSeat, setClaimingSeat] = useState<number | null>(null);
  const [permissionErrorSeat, setPermissionErrorSeat] = useState<number | null>(null);
  const [permissionErrorMessage, setPermissionErrorMessage] = useState<string>('');
  const [broadcasterHasJoined, setBroadcasterHasJoined] = useState<boolean>(false);
  
  // ✅ NEW: Centralized box management state
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [localTracks, setLocalTracks] = useState<{ video?: MediaStreamTrack; audio?: MediaStreamTrack } | null>(null);
  const [desiredPublish, setDesiredPublish] = useState(false);
  const [tracksReady, setTracksReady] = useState(false);
  
  // ✅ Entrance effects state
  const [entranceEffect, setEntranceEffect] = useState<{ username: string; role: 'admin' | 'lead_troll_officer' | 'troll_officer' } | null>(null);

  // Refs for state tracking
  const autoStartRef = useRef(false);
  const connectRequestedRef = useRef(false);
  const publishingRef = useRef(false);
  const joiningRef = useRef(false); // ✅ Fix: Explicit mutex for join attempts
  const prevAuthRef = useRef<boolean>(Boolean(user && profile));

  // Media access handlers
  const requestMediaAccess = useCallback(async (): Promise<MediaStream> => {
    if (preflightStreamRef.current && preflightStreamRef.current.active) {
      console.log('[BroadcastPage] Reusing existing preflight stream');
      return preflightStreamRef.current;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Media devices API not available');
    }

    if (!window.isSecureContext) {
      throw new Error('Camera/microphone access requires a secure context');
    }

    try {
      console.log('[BroadcastPage] Requesting camera & mic (first time)');
      const stream = await navigator.mediaDevices.getUserMedia(DEFAULT_MEDIA_CONFIG);
      
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      stream.getVideoTracks().forEach((track) => {
        track.enabled = true;
      });
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      preflightStreamRef.current = stream;
      console.log('[BroadcastPage] ✅ Preflight stream created and stored in ref');
      return stream;
    } catch (err: any) {
      console.error('[BroadcastPage] getUserMedia failed:', {
        name: err?.name,
        message: err?.message,
        constraint: err?.constraint,
        error: err
      });
      
      const error = new Error(err?.message || 'Failed to access camera/microphone');
      (error as any).name = err?.name || 'MediaAccessError';
      (error as any).originalError = err;
      throw error;
    }
  }, []);

  // ✅ FIXED: Only cleanup on explicit leave actions
  const cleanupLocalStream = useCallback(() => {
    if (preflightStreamRef.current) {
      console.log('[BroadcastPage] Cleaning up preflight stream (explicit cleanup)');
      preflightStreamRef.current.getTracks().forEach((track) => {
        console.log(`[BroadcastPage] Stopping track: ${track.kind}`, {
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted
        });
        track.stop();
      });
      preflightStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, []);

  // Stream data loading
  const loadStreamData = useCallback(async () => {
    if (!streamId) {
      setIsLoadingStream(false);
      return;
    }

    const streamDataFromState = location.state?.streamData;
    if (streamDataFromState && streamDataFromState.id === streamId) {
      console.log('✅ Using stream data from navigation state (no DB query needed)');
      setStream(streamDataFromState as StreamRow);
      setCoinCount(Number(streamDataFromState.total_gifts_coins || 0));
      setIsLoadingStream(false);
      return;
    }

    // ✅ NEW: Check sessionStorage fallback
    try {
      const storedStream = sessionStorage.getItem("activeStream");
      if (storedStream) {
        const parsedStream = JSON.parse(storedStream);
        if (parsedStream.id === streamId) {
          console.log('✅ Using stream data from sessionStorage fallback');
          setStream(parsedStream);
          setCoinCount(Number(parsedStream.total_gifts_coins || 0));
          setIsLoadingStream(false);
          // Return early to skip DB fetch, background polling will update it
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to parse stream from sessionStorage', e);
    }

    setIsLoadingStream(true);
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt === 1) {
          console.log("⏳ Waiting 500ms for stream row replication...");
          await new Promise((r) => setTimeout(r, 500));
        }

        console.log(`📡 Loading stream info... (attempt ${attempt}/${maxRetries})`, streamId);

        const timeoutMs = 25000;
        
        const streamQuery = supabase
          .from("streams")
          .select("id, broadcaster_id, title, category, status, start_time, end_time, current_viewers, total_gifts_coins, total_unique_gifters, is_live, thumbnail_url, created_at, updated_at")
          .eq("id", streamId)
          .maybeSingle();

        const streamQueryWithTimeout = Promise.race([
          streamQuery,
          new Promise<{ data: null; error: { message: string } }>((_, reject) =>
            setTimeout(() => reject(new Error(`Stream query timeout after ${timeoutMs}ms`)), timeoutMs)
          )
        ]);

        const { data: streamRow, error: streamErr } = await streamQueryWithTimeout as any;

        if (streamErr) {
          if (streamErr.message?.includes('timeout') || streamErr.message?.includes('Timeout')) {
            lastError = streamErr;
            if (attempt < maxRetries) {
              console.log(`⚠️ Stream query timeout on attempt ${attempt}, retrying...`);
              await new Promise(resolve => setTimeout(resolve, 500 * attempt));
              continue;
            }
          }
          
          if (streamErr.code === 'PGRST116' || streamErr.message?.includes('not found')) {
            console.error("❌ Stream not found:", streamErr);
            toast.error("Stream not found.");
            setIsLoadingStream(false);
            return;
          }
          
          lastError = streamErr;
          if (attempt < maxRetries) {
            console.log(`⚠️ Stream query error on attempt ${attempt}, retrying...`, streamErr.message);
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
            continue;
          }
        }

        if (!streamRow) {
          if (attempt < maxRetries) {
            console.log(`⚠️ No stream data on attempt ${attempt}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
            continue;
          }
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

        console.log("✅ Stream loaded successfully:", streamRow.id);
        setStream(streamRow as StreamRow);
        setCoinCount(Number(streamRow.total_gifts_coins || 0));
        setIsLoadingStream(false);
        return;

      } catch (error: any) {
        lastError = error;
        
        if (error?.message?.includes('timeout') && attempt < maxRetries) {
          console.log(`⚠️ Stream query timeout on attempt ${attempt}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          continue;
        }
        
        if (attempt === maxRetries) {
          console.error('❌ Failed to load stream data after all retries:', error?.message || error);
          
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

    setIsLoadingStream(false);
    if (lastError?.message?.includes('timeout')) {
      toast.error('Stream loading timed out. Please check your connection and refresh the page.');
    } else {
      toast.error('Failed to load stream information. Please try refreshing the page.');
    }
  }, [streamId, profile, user, location.state]);

  // ✅ NEW: Centralized joinBox function
  const joinBox = useCallback(async (boxId: string) => {
    if (activeBoxId && activeBoxId !== boxId) {
      console.log('[BroadcastPage] User already in box:', activeBoxId, 'blocking join of:', boxId);
      toast.error('You are already in a box. Please leave first.');
      return false;
    }

    if (activeBoxId === boxId) {
      console.log('[BroadcastPage] Already in box:', boxId);
      return true;
    }

    console.log('[BroadcastPage] Joining box:', boxId);
    setActiveBoxId(boxId);
    setPermissionErrorSeat(null);
    setPermissionErrorMessage('');
    return true;
  }, [activeBoxId]);

  // ✅ NEW: Centralized leaveBox function
  const leaveBox = useCallback(async () => {
    if (publishingRef.current) {
      console.warn('[BroadcastPage] Cannot leave box while publishing/joining logic is active');
      toast.warning('Please wait, connection in progress...');
      return;
    }

    if (!activeBoxId) {
      console.log('[BroadcastPage] Not in any box, nothing to leave');
      return;
    }

    console.log('[BroadcastPage] Leaving box:', activeBoxId);
    
    try {
      if (localTracks) {
        console.log('[BroadcastPage] Stopping local tracks');
        if (localTracks.video) {
          localTracks.video.stop();
        }
        if (localTracks.audio) {
          localTracks.audio.stop();
        }
        setLocalTracks(null);
      }
      
      cleanupLocalStream();
      
      if (liveKit.service?.disconnect) {
        await liveKit.service.disconnect();
      }
      
      if (currentSeatIndex !== null && _releaseSeat) {
        await _releaseSeat(currentSeatIndex);
      }
      
      setActiveBoxId(null);
      setCurrentSeatIndex(null);
      setLocalTracks(null);
      setClaimingSeat(null);
      setDesiredPublish(false);
      setTracksReady(false);
      
      console.log('[BroadcastPage] ✅ Successfully left box');
      toast.success('Left box successfully');
      
    } catch (err: any) {
      console.error('[BroadcastPage] Error leaving box:', err);
      setActiveBoxId(null);
      setCurrentSeatIndex(null);
      setLocalTracks(null);
      setClaimingSeat(null);
      toast.error('Error leaving box');
    }
  }, [activeBoxId, localTracks, cleanupLocalStream, liveKit, currentSeatIndex, _releaseSeat]);

  // ✅ NEW: Single effect to handle connection based on state
  useEffect(() => {
    // Conditions:
    // 1. We want to publish (desiredPublish is true)
    // 2. We have a valid seat (currentSeatIndex !== null)
    // 3. We are not connected or connecting
    // 4. We have the media stream ready
    
    if (
      desiredPublish && 
      currentSeatIndex !== null && 
      !isConnected && 
      !isConnecting && 
      !connectRequestedRef.current &&
      preflightStreamRef.current &&
      tracksReady
    ) {
        const performJoin = async () => {
             // ✅ Fix: Hard mutex for join attempts
             if (joiningRef.current) {
                 console.warn('[BroadcastPage] Join already in progress - skipping');
                 return;
             }
             
             joiningRef.current = true;

             try {
                 console.log('[BroadcastPage] 🚀 Triggering join from effect', {
                    desiredPublish,
                    currentSeatIndex,
                    tracksReady
                 });
                 
                 connectRequestedRef.current = true;
                 publishingRef.current = true;
                 
                 // Pre-flight checks
                 if (!livekitIdentity) {
                     throw new Error('Missing identity');
                 }

                 preflightStreamRef.current?.getVideoTracks().forEach(track => track.enabled = true);
                 preflightStreamRef.current?.getAudioTracks().forEach(track => {
                    track.enabled = true;
                    console.log('[BroadcastPage] Audio Track Diagnostics:', {
                      readyState: track.readyState,
                      enabled: track.enabled,
                      muted: track.muted,
                      settings: track.getSettings()
                    });
                 });
                 
                 // ✅ Fix: Single robust join attempt
                 console.log(`[BroadcastPage] Attempting LiveKit join (single attempt)...`);
                 const joined = await joinAndPublish(preflightStreamRef.current!);
                 
                 if (!joined) {
                     toast.error("LiveKit connection failed — seat reserved. Click seat again to retry.");
                     connectRequestedRef.current = false;
                     return;
                 }
                 
                 // Post-join watchdog
                 setTimeout(async () => {
                    try {
                        const room = liveKit.getRoom();
                        const lp = room?.localParticipant;
                        if (!lp) return;

                        console.log('[BroadcastPage] 🔁 Track watchdog check');

                        if (!lp.isCameraEnabled) {
                            console.warn('[BroadcastPage] Camera not enabled — forcing enable');
                            await lp.setCameraEnabled(true);
                        }

                        if (!lp.isMicrophoneEnabled) {
                            console.warn('[BroadcastPage] Mic not enabled — forcing enable');
                            await lp.setMicrophoneEnabled(true);
                        }
                    } catch (e) {
                        console.warn('[BroadcastPage] Track watchdog failed', e);
                    }
                 }, 1200);

                 // Update stream status if broadcaster
                 if (isBroadcaster && stream?.id) {
                     const { error: updateErr } = await supabase
                        .from("streams")
                        .update({ 
                          status: "live", 
                          is_live: true,
                          start_time: new Date().toISOString(),
                          current_viewers: 1
                        })
                        .eq("id", stream.id);
                        
                     if (updateErr) console.warn("Stream status update failed:", updateErr);
                 }

             } catch (err: any) {
                 console.error("Failed to join via effect", err);
                 toast.error(`Failed to join: ${err?.message || 'Unknown error'}`);
                 connectRequestedRef.current = false;
             } finally {
                 publishingRef.current = false;
                 joiningRef.current = false; // Release mutex
             }
        };
        performJoin();
    }
  }, [desiredPublish, currentSeatIndex, isConnected, isConnecting, joinAndPublish, tracksReady, livekitIdentity, isBroadcaster, stream?.id, liveKit]);

  // ✅ Seat management handlers (FIXED)
  const handleSeatClaim = useCallback(
    async (index: number) => {
      console.log('[BroadcastPage] handleSeatClaim CALLED for index:', index);

      if (!livekitIdentity) {
        toast.error("No user identity found. Please refresh and try again.");
        return;
      }

      const boxId = `seat-${index}`;

      if (claimingSeat !== null || currentSeatIndex !== null || joinLockRef.current) {
        console.log('[BroadcastPage] Already claiming or in seat, ignoring click');
        return;
      }

      joinLockRef.current = true;
      console.log(`[BroadcastPage] Seat ${index + 1} clicked to join`);
      setClaimingSeat(index);
      setPermissionErrorSeat(null);
      setPermissionErrorMessage('');

      try {
        const stream = await requestMediaAccess();
        console.log('[BroadcastPage] Permissions granted');
        
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        if (videoTrack && audioTrack) {
          setLocalTracks({ video: videoTrack, audio: audioTrack });
          console.log('[BroadcastPage] ✅ Local tracks stored for cleanup:', {
            videoTrack: videoTrack.label,
            audioTrack: audioTrack.label
          });
        }

        // ✅ CRITICAL FIX: Claim seat with explicit stable identity
        const success = await claimSeat(index, {
          user_id: livekitIdentity,
          username: displayName,
          avatarUrl: profile?.avatar_url,
          role: profile?.role || 'broadcaster',
          metadata: { identity: livekitIdentity },
        });

        if (!success) {
          throw new Error('Seat claim failed');
        }

        console.log("CLAIMED SEAT", {
          seat_number: index,
          user_id: livekitIdentity
        });

        await joinBox(boxId);
        setCurrentSeatIndex(index);

        if (isBroadcaster) {
          setBroadcasterHasJoined(true);
        }

        // ✅ Signal that we are ready to join (triggers effect)
        console.log('[BroadcastPage] ✅ Seat claimed, signalling ready to join...');
        setTracksReady(true);
        setDesiredPublish(true);

        setClaimingSeat(null);
        toast.success(`Joined seat ${index + 1} successfully!`);

      } catch (err: any) {
        console.error('Failed to claim seat:', {
          error: err,
          name: err?.name,
          message: err?.message,
          originalError: err?.originalError
        });

        // ✅ DO NOT AUTO-LEAVE SEAT
        // ✅ Only disconnect LiveKit to allow retry
        try { 
          if (liveKit.service?.disconnect) await liveKit.service.disconnect(); 
        } catch {}

        const permissionDenied = ['NotAllowedError', 'NotFoundError', 'SecurityError', 'PermissionDeniedError', 'MediaAccessError'];
        const errorMsg = err?.message || '';
        const errorName = err?.name || err?.originalError?.name || '';
        
        const isPermissionError = permissionDenied.includes(errorName) || 
                                  errorMsg.toLowerCase().includes('permission') ||
                                  errorMsg.toLowerCase().includes('not allowed') ||
                                  errorMsg.toLowerCase().includes('denied');
        
        if (isPermissionError) {
          setPermissionErrorSeat(index);
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
          toast.error('Your session has expired. Please sign in again.');
          try {
            await supabase.auth.signOut();
          } catch (e) {
            console.warn('Sign out failed during session error handling', e);
          }
          navigate('/auth');
        } else {
          toast.error(`Failed to join: ${errorMsg || 'Unknown error'}`);
        }
      } finally {
        setClaimingSeat(null);
        joinLockRef.current = false;
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
      displayName,
      liveKit,
      joinBox,
      leaveBox,
      livekitIdentity
    ]
  );

  // ✅ NEW: Proper leaveSeat function to cleanly exit a seat
  const leaveSeat = useCallback(async () => {
    console.log('[BroadcastPage] leaveSeat called, delegating to leaveBox');
    await leaveBox();
  }, [leaveBox]);

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
    if (publishingRef.current) {
      console.warn('[BroadcastPage] Cannot end stream while publishing/joining logic is active');
      toast.warning('Please wait, connection in progress...');
      return;
    }

    if (!stream?.id) {
      toast.error('Stream ID not found');
      return;
    }

    try {
      console.log('[BroadcastPage] Ending stream...');
      const room = liveKit.getRoom();
      const { endStream } = await import('../lib/endStream');
      const success = await endStream(stream.id, room);
      
      if (!success) {
        toast.error('Failed to end stream properly');
        return;
      }
      
      navigate(`/stream-summary/${stream.id}`);
    } catch (err) {
      console.error('Failed to end stream', err);
      toast.error('Failed to end stream');
      navigate(`/stream-summary/${stream?.id}`);
    }
  }, [stream?.id, currentSeatIndex, leaveSeat, navigate, liveKit]);

  const handleGiftSent = useCallback(async (amountOrGift: any) => {
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

  // ✅ Reconnect logic for page refresh (FIXED)
  useEffect(() => {
    if (seatsLoading || !seats || !livekitIdentity || isConnected || isConnecting || connectRequestedRef.current) return;

    const mySeatIndex = seats.findIndex(s => s?.user_id === livekitIdentity);
    
    if (mySeatIndex !== -1) {
      console.log('[BroadcastPage] Found user in seat after refresh, attempting reconnect...', mySeatIndex);
      connectRequestedRef.current = true;

      setCurrentSeatIndex(mySeatIndex);
      joinBox(`seat-${mySeatIndex}`);

      const rejoin = async () => {
        try {
           const stream = await requestMediaAccess();

           stream.getVideoTracks().forEach(t => t.enabled = true);
           stream.getAudioTracks().forEach(t => t.enabled = true);

           await joinAndPublish(stream);

           const room = liveKit.getRoom();
           if (room?.localParticipant) {
             const lp = room.localParticipant;
             if (!lp.isCameraEnabled) await lp.setCameraEnabled(true);
             if (!lp.isMicrophoneEnabled) await lp.setMicrophoneEnabled(true);
           }

           toast.success('Restored connection to seat');
        } catch (err) {
           console.error('[BroadcastPage] Failed to restore connection:', err);
           toast.error('Failed to restore connection. Please click the seat to rejoin.');
           connectRequestedRef.current = false; 
        }
      };
      
      rejoin();
    }
  }, [seats, livekitIdentity, isConnected, isConnecting, seatsLoading, joinAndPublish, requestMediaAccess, joinBox, liveKit]);

  // Computed values
  const renderSeats = useMemo(() => {
    return seats.map((seat, index) => ({
      seat,
      participant: seat?.user_id ? participants.get(seat.user_id) : undefined,
      index,
    }));
  }, [seats, participants]);

  const lastGift = useGiftEvents(stream?.id);

  const shownParticipantsRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    if (!participants || !profile) return;

    (async () => {
      for (const participant of participants.values()) {
        if (participant.isLocal) continue;
        if (shownParticipantsRef.current.has(participant.identity)) continue;
        
        let participantRole: string | null = null;
        const seat = seats.find(s => s?.user_id === participant.identity);
        if (seat?.role) {
          participantRole = seat.role;
        } else {
          try {
            const metadata = (participant as any).metadata;
            if (typeof metadata === 'string') {
              const parsed = JSON.parse(metadata);
              participantRole = parsed?.role;
            } else if (metadata?.role) {
              participantRole = metadata.role;
            }
          } catch (e) {}
        }
        
        if (!participantRole && participant.identity) {
          if (participant.identity === stream?.broadcaster_id) {
            try {
              const { data } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', participant.identity)
                .single();
                
              if (data?.role && (data.role === 'admin' || data.role === 'lead_troll_officer' || data.role === 'troll_officer')) {
                if (!shownParticipantsRef.current.has(participant.identity)) {
                  shownParticipantsRef.current.add(participant.identity);
                  const username = participant.name || participant.identity || 'User';
                  setEntranceEffect({
                    username,
                    role: data.role as 'admin' | 'lead_troll_officer' | 'troll_officer'
                  });
                  setTimeout(() => setEntranceEffect(null), 5000);
                }
              }
            } catch (e) {
              console.warn('Failed to fetch broadcaster profile for entrance effect:', e);
            }
          }
        }
        
        if (participantRole === 'admin' || participantRole === 'lead_troll_officer' || participantRole === 'troll_officer') {
          const username = participant.name || participant.identity || 'User';
          shownParticipantsRef.current.add(participant.identity);
          
          setEntranceEffect({
            username,
            role: participantRole as 'admin' | 'lead_troll_officer' | 'troll_officer'
          });
          
          setTimeout(() => {
            setEntranceEffect(null);
          }, 5000);
        }
      }
    })();
  }, [participants, profile, seats, stream?.broadcaster_id]);

  useEffect(() => {
    loadStreamData();
  }, [loadStreamData]);

  // Auto-start broadcaster
  useEffect(() => {
    if (!shouldAutoStart || !stream?.id || !profile?.id || !isBroadcaster || autoStartRef.current || !hasSession) {
      return;
    }

    if (needsSetup && needsSeatJoin && !broadcasterHasJoined) {
      console.log("🔄 Setup mode: Waiting for broadcaster to join a seat before starting...");
      return;
    }

    autoStartRef.current = true;
    const mode = needsSetup ? "setup" : "normal";
    console.log(`🔥 AutoStart detected (?start=1, mode: ${mode}). Starting broadcast in box 1...`);
    
    handleSeatClaim(0).catch((err) => {
      console.error('Failed to auto-start broadcaster in box 1:', err);
      toast.error('Failed to start broadcast. Please try clicking box 1 manually.');
    });

    setTimeout(() => {
      const clean = location.pathname;
      window.history.replaceState({}, "", clean);
    }, 300);
  }, [shouldAutoStart, needsSetup, needsSeatJoin, broadcasterHasJoined, stream?.id, profile?.id, isBroadcaster, hasSession, handleSeatClaim, location.pathname]);

  // Auto-start when broadcaster joins a seat in setup mode
  useEffect(() => {
    if (needsSetup && needsSeatJoin && broadcasterHasJoined && shouldAutoStart && !autoStartRef.current) {
      autoStartRef.current = true;
      console.log("🔥 Broadcaster joined seat in setup mode. Starting stream...");
      
      if (isBroadcaster && stream?.id) {
        supabase
          .from("streams")
          .update({ 
            status: "live", 
            is_live: true,
            start_time: new Date().toISOString()
          })
          .eq("id", stream.id)
          .then(({ error }) => {
            if (error) {
              console.warn("Stream status update failed:", error);
            } else {
              console.log("✅ Stream status updated to live");
            }
          });
      }
      
      setTimeout(() => {
        const clean = location.pathname;
        window.history.replaceState({}, "", clean);
      }, 300);
    }
  }, [needsSetup, needsSeatJoin, broadcasterHasJoined, shouldAutoStart, isBroadcaster, stream?.id, location.pathname]);

  // Redirect on auth loss
  useEffect(() => {
    const hadAuth = Boolean(prevAuthRef.current);
    const hasAuth = Boolean(user && profile);
    
    if (hadAuth && !hasAuth) {
      console.warn("⚠️ Auth lost — redirecting to login and cleaning up broadcast state");
      preflightStreamRef.current = null;
      connectRequestedRef.current = false;
      autoStartRef.current = false;
      toast.error("Session expired — please sign in again.");
      navigate("/auth");
    }
    
    prevAuthRef.current = hasAuth;
  }, [user, profile, navigate]);

  // Stream status polling
  useEffect(() => {
    if (!streamId) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("streams")
        .select("status,is_live,current_viewers,total_gifts_coins")
        .eq("id", streamId)
        .maybeSingle();

      if (data) {
        setStream(prev =>
          prev
            ? {
                ...prev,
                status: data.status,
                is_live: data.is_live,
                current_viewers: data.current_viewers,
                total_gifts_coins: data.total_gifts_coins,
              }
            : prev
        );
        if (data.total_gifts_coins !== undefined) {
          setCoinCount(Number(data.total_gifts_coins || 0));
        }
      }
    }, STREAM_POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [streamId]);

  useStreamEndListener({
    streamId: streamId || '',
    enabled: !!streamId,
    redirectToSummary: true,
  });

  // Real-time subscription for gifts
  useEffect(() => {
    if (!stream?.id) return;

    const giftsChannel = supabase
      .channel(`stream_gifts_${stream.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gifts',
          filter: `stream_id=eq.${stream.id}`,
        },
        async (payload) => {
          const newGift = payload.new;
          const coinsSpent = Number(newGift.coins_spent || 0);
          
          setCoinCount(prev => prev + coinsSpent);
          
          try {
            const { data: streamData } = await supabase
              .from('streams')
              .select('total_gifts_coins')
              .eq('id', stream.id)
              .single();
            
            if (streamData?.total_gifts_coins !== undefined) {
              setCoinCount(Number(streamData.total_gifts_coins || 0));
            }
          } catch (e) {
            console.warn('Failed to sync gift coins from stream:', e);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(giftsChannel);
    };
  }, [stream?.id]);

  // Loading state
  if (isLoadingStream || !stream || !profile) {
    return (
      <div className="min-h-screen bg-[#03010c] via-[#05031a] to-[#110117] text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full border-2 border-purple-500/60 animate-pulse" />
          <div className="space-y-2">
            <p className="text-sm text-gray-300">
              {isLoadingStream ? 'Loading stream…' : !profile ? 'Loading profile…' : 'Loading stream…'}
            </p>
            {isLoadingStream && (
              <div className="text-xs text-gray-400 max-w-md">
                If this takes too long, try refreshing the page or check your internet connection.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#03010c] via-[#05031a] to-[#110117] text-white">
      {/* Entrance Effect Overlay */}
      {entranceEffect && (
        <EntranceEffect username={entranceEffect.username} role={entranceEffect.role} />
      )}

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
                  <div className="text-lg font-bold flex items-center gap-2"><Users size={16} /> {(stream.current_viewers || 0).toLocaleString()}</div>
                </div>
                {needsSetup && needsSeatJoin && !broadcasterHasJoined && !activeBoxId ? (
                  null
                ) : stream.is_live ? (
                  <div className="px-3 py-2 bg-red-600 text-white rounded-full text-sm font-semibold">🔴 LIVE</div>
                ) : (
                  null
                )}
                <button
                  onClick={handleEndStream}
                  className="px-4 py-2 bg-red-700 hover:bg-red-800 rounded text-sm font-semibold"
                >
                  End Stream
                </button>
                {currentSeatIndex !== null && (
                  <button
                    onClick={leaveSeat}
                    className="px-4 py-2 bg-red-700 hover:bg-red-800 rounded text-sm font-semibold"
                    title="Leave Box"
                  >
                    Leave Box {currentSeatIndex + 1}
                  </button>
                )}
              </div>
            </div>

            {/* Main Content */}
            <div className="h-full grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-3 h-full flex flex-col gap-1">
                <div className="relative flex-1 min-h-0">
                  {lastGift && <GiftEventOverlay gift={lastGift} />}
                  
                  {claimingSeat !== null && (
                    <div className="absolute top-4 right-4 z-20">
                      <div className="flex items-center gap-2 px-4 py-2 bg-blue-600/90 backdrop-blur-sm rounded-full border border-blue-500/30">
                        <div className="w-2 h-2 bg-blue-300 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-white">Connecting to stream... (up to 45s)</span>
                      </div>
                    </div>
                  )}
                  
                  <OfficerStreamGrid
                    roomName={roomName}
                    streamId={streamId}
                    activeBoxId={activeBoxId}
                    onSeatClick={(idx) => {
                      setTargetSeatIndex(idx);
                      handleSeatClaim(idx).catch(() => {});
                    }}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
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

                <div className="w-full">
                  <GiftBox
                    participants={renderSeats.filter(s => s.seat).map((s) => ({ name: s.seat?.username || 'Unknown' }))}
                    onSendGift={async (gift: any, recipient?: string | null) => {
                      const qty = Math.max(1, Number(gift?.quantity) || 1);
                      const per = Number(gift?.coins) || 0;
                      const total = per * qty;

                      setCoinCount(prev => prev + total);

                      try {
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

              {/* Right Column */}
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
