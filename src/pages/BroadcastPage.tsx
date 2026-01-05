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
import { useStreamEndListener } from '../hooks/useStreamEndListener';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import {
  Users,
  Heart,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Square
} from 'lucide-react';
import ChatBox from '../components/broadcast/ChatBox';
import GiftModal from '../components/broadcast/GiftModal';
import ProfileModal from '../components/broadcast/ProfileModal';
import CoinStoreModal from '../components/broadcast/CoinStoreModal';
import GiftEventOverlay from './GiftEventOverlay';
import { useGiftEvents } from '../lib/hooks/useGiftEvents';
// EntranceEffect removed (unused)
import { useOfficerBroadcastTracking } from '../hooks/useOfficerBroadcastTracking';
import { attachLiveKitDebug } from '../lib/livekit-debug';
import VideoFeed from '../components/stream/VideoFeed';

// Constants
const STREAM_POLL_INTERVAL = 2000;

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
  title?: string;
}

const useIsBroadcaster = (profile: any, stream: StreamRow | null) => {
  return useMemo(() => {
    return Boolean(profile?.id && stream?.broadcaster_id && profile.id === stream.broadcaster_id);
  }, [profile?.id, stream?.broadcaster_id]);
};

export default function BroadcastPage() {
  const { streamId } = useParams<{ streamId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session?.access_token);
    };
    checkSession();
  }, []);
  
  const shouldAutoStart = query.get("start") === "1" && hasSession;

  const { user, profile } = useAuthStore();
  // const displayName = useDisplayName(profile);

  const stableIdentity = useMemo(() => {
    const id = user?.id || profile?.id;
    if (!id) console.warn('[BroadcastPage] No stable identity found');
    return id;
  }, [user?.id, profile?.id]);
  
  const [stream, setStream] = useState<StreamRow | null>(() => {
    // Optimistic load from state or storage
    if (location.state?.streamData && location.state.streamData.id === streamId) {
        return location.state.streamData;
    }
    try {
        const stored = sessionStorage.getItem("activeStream");
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.id === streamId) return parsed;
        }
    } catch {}
    return null;
  });

  const [isLoadingStream, setIsLoadingStream] = useState(() => {
     return !stream; // If we found a stream synchronously, we are not loading
  });

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
  
  useEffect(() => {
    console.log('[BroadcastPage] isBroadcaster check:', { 
        profileId: profile?.id, 
        streamBroadcasterId: stream?.broadcaster_id, 
        isBroadcaster 
    });
  }, [profile?.id, stream?.broadcaster_id, isBroadcaster]);

  const liveKit = useLiveKit();
  const roomName = useMemo(() => String(streamId || ''), [streamId]);

  const hasValidStreamId = !!streamId && typeof streamId === 'string' && streamId.trim() !== '';
  const sessionReady = !!user && !!profile && hasValidStreamId;

  const livekitIdentity = useMemo(() => {
    const id = stableIdentity;
    if (!id) console.warn('[BroadcastPage] No identity found for LiveKit');
    return id;
  }, [stableIdentity]);

  const {
    isConnected,
    isConnecting,
    joinAndPublish,
  } = useLiveKitSession({
    roomName: sessionReady && hasValidStreamId ? roomName : '',
    user: sessionReady && user
      ? { ...user, identity: livekitIdentity, role: isBroadcaster ? 'broadcaster' : 'viewer' }
      : null,
    role: isBroadcaster ? 'broadcaster' : 'viewer',
    allowPublish: isBroadcaster && sessionReady,
    autoPublish: isBroadcaster,
  });

  // Ensure connection is established (handles refresh or direct navigation)
  useEffect(() => {
    if (sessionReady && !isConnected && !isConnecting && !isLoadingStream) {
      // Check if we already have a connected room in the context that matches
      const currentRoom = liveKit.getRoom();
      if (currentRoom && currentRoom.state === 'connected' && currentRoom.name === roomName) {
         console.log('[BroadcastPage] Already connected to correct room, skipping join');
         return;
      }
      
      console.log('[BroadcastPage] Not connected. Calling joinAndPublish...');
      joinAndPublish();
    }
  }, [sessionReady, isConnected, isConnecting, joinAndPublish, liveKit, roomName, isLoadingStream]);


  // const { participants } = liveKit;
  
  useOfficerBroadcastTracking({
    streamId,
    connected: isConnected,
  });

  useEffect(() => {
    if (isConnected) {
      const room = liveKit.getRoom();
      attachLiveKitDebug(room);
    }
  }, [isConnected, liveKit]);

  // Controls
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  const toggleCamera = useCallback(async () => {
    const ok = await liveKit.toggleCamera();
    setCameraOn(Boolean(ok));
  }, [liveKit]);

  const toggleMic = useCallback(async () => {
    const ok = await liveKit.toggleMicrophone();
    setMicOn(Boolean(ok));
  }, [liveKit]);

  const endStream = useCallback(async () => {
    try {
      if (streamId) {
        await supabase.from('streams').update({ status: 'ended', is_live: false }).eq('id', streamId);
      }
    } catch {}
    liveKit.disconnect();
    navigate('/stream-ended');
  }, [streamId, liveKit, navigate]);

  // Auth/Session checks (defensive)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error || !data?.session) {
          try { await supabase.auth.signOut(); } catch {}
          navigate('/auth');
        }
      } catch {
        if (mounted) navigate('/auth');
      }
    })();
    return () => { mounted = false };
  }, [navigate]);

  // UI State
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [giftRecipient, setGiftRecipient] = useState<any>(null);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [isCoinStoreOpen, setIsCoinStoreOpen] = useState(false);
  
  // const [entranceEffect, setEntranceEffect] = useState<{ username: string; role: 'admin' | 'lead_troll_officer' | 'troll_officer' } | null>(null);

  const handleGiftFromProfile = useCallback((targetProfile: any) => {
    setGiftRecipient(targetProfile);
    setSelectedProfile(null);
    setIsGiftModalOpen(true);
  }, []);

  // Load Stream Data
  const loadStreamData = useCallback(async () => {
    if (!streamId) {
      setIsLoadingStream(false);
      return;
    }

    const streamDataFromState = location.state?.streamData;
    if (streamDataFromState && streamDataFromState.id === streamId) {
      setStream(streamDataFromState as StreamRow);
      // setCoinCount(Number(streamDataFromState.total_gifts_coins || 0));
      setIsLoadingStream(false);
      return;
    }

    try {
      const storedStream = sessionStorage.getItem("activeStream");
      if (storedStream) {
        const parsedStream = JSON.parse(storedStream);
        if (parsedStream.id === streamId) {
          setStream(parsedStream);
          // setCoinCount(Number(parsedStream.total_gifts_coins || 0));
          setIsLoadingStream(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to parse stream from sessionStorage', e);
    }

    setIsLoadingStream(true);
    
    try {
        const { data: streamRow, error } = await supabase
          .from("streams")
          .select("id, broadcaster_id, title, category, status, start_time, end_time, current_viewers, total_gifts_coins, total_unique_gifters, is_live, thumbnail_url, created_at, updated_at")
          .eq("id", streamId)
          .maybeSingle();

        if (error || !streamRow) {
            toast.error("Stream not found.");
            setIsLoadingStream(false);
            return;
        }

        setStream(streamRow as StreamRow);
        // setCoinCount(Number(streamRow.total_gifts_coins || 0));
    } catch (err) {
        console.error("Failed to load stream:", err);
        toast.error("Failed to load stream information.");
    } finally {
        setIsLoadingStream(false);
    }
  }, [streamId, location.state]);

  useEffect(() => {
    loadStreamData();
  }, [loadStreamData]);

  // Auto-start
  const autoStartRef = useRef(false);
  useEffect(() => {
    if (!shouldAutoStart || !stream?.id || !profile?.id || !isBroadcaster || autoStartRef.current || !hasSession) {
      return;
    }
    autoStartRef.current = true;
    console.log(`🔥 AutoStart detected. Updating stream status...`);
    
    if (isBroadcaster && stream?.id) {
        supabase.from("streams").update({ 
          status: "live", 
          is_live: true, 
          start_time: new Date().toISOString(),
          current_viewers: 1
        }).eq("id", stream.id).then(() => console.log("✅ Stream status updated to live"));
    }
  }, [shouldAutoStart, isBroadcaster, stream?.id, hasSession, profile?.id]);

  // Stream polling
  useEffect(() => {
    if (!streamId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.from("streams").select("status,is_live,current_viewers,total_gifts_coins").eq("id", streamId).maybeSingle();
      if (data) {
        setStream(prev => prev ? { ...prev, ...data } : prev);
        // if (data.total_gifts_coins !== undefined) setCoinCount(Number(data.total_gifts_coins || 0));
      }
    }, STREAM_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [streamId]);

  useStreamEndListener({
    streamId: streamId || '',
    enabled: !!streamId,
    redirectToSummary: true,
  });

  // Gift subscription
  const lastGift = useGiftEvents(streamId);

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

    // setCoinCount(prev => prev + totalCoins);
    setIsGiftModalOpen(false);
    
    try {
      await supabase.from('gifts').insert({
        stream_id: streamId,
        sender_id: user?.id,
        receiver_id: giftRecipient?.id || null,
        coins_spent: totalCoins,
        gift_type: 'paid',
        message: giftName,
        gift_id: giftId,
        quantity: quantity,
      });
    } catch (e) {
      console.error('Failed to record manual gift event:', e);
    } finally {
      setGiftRecipient(null);
    }
  }, [streamId, user?.id, giftRecipient]);

  const handleCoinsPurchased = useCallback((_amount: number) => {
    // setCoinCount(prev => prev + amount);
    setIsCoinStoreOpen(false);
  }, []);

  // Layout
  if (!profile) {
    return (
        <div className="min-h-screen bg-[#03010c] via-[#05031a] to-[#110117] text-white flex items-center justify-center">
            <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full border-2 border-purple-500/60 animate-pulse" />
            <p className="text-sm text-gray-300">Loading profile...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#03010c] via-[#05031a] to-[#110117] text-white">
      {/* {entranceEffect && <EntranceEffect username={entranceEffect.username} role={entranceEffect.role} />} */}
      
      <div className="flex h-screen flex-col">
        <main className="flex-1 px-6 py-5">
          <section className="h-full rounded-[32px] border border-white/10 bg-gradient-to-b from-[#050113] to-[#0b091f] p-6 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="mb-5 flex items-center justify-between shrink-0">
               <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/50">Broadcast</p>
                  <p className="text-sm text-white/70">{stream?.title || 'Starting Broadcast...'}</p>
               </div>
               <div className="flex items-center gap-4">
                  <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10 flex items-center gap-2">
                    <Heart size={16} className="text-purple-400" /> <span className="font-bold">{stream?.total_likes || 0}</span>
                  </div>
                  <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10 flex items-center gap-2">
                    <Users size={16} className="text-green-400" /> <span className="font-bold">{(stream?.current_viewers || 0).toLocaleString()}</span>
                  </div>
                  {stream?.is_live && <div className="px-3 py-1 bg-red-600 rounded-full text-xs font-bold animate-pulse">LIVE</div>}
                  {isBroadcaster && (
                    <>
                      <button onClick={toggleMic} className={`p-2 rounded-lg border ${micOn ? 'bg-purple-600 border-purple-400' : 'bg-red-900/50 border-red-500'}`}>
                        {micOn ? <Mic size={18} /> : <MicOff size={18} />}
                      </button>
                      <button onClick={toggleCamera} className={`p-2 rounded-lg border ${cameraOn ? 'bg-purple-600 border-purple-400' : 'bg-red-900/50 border-red-500'}`}>
                        {cameraOn ? <Camera size={18} /> : <CameraOff size={18} />}
                      </button>
                      <button onClick={endStream} className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-bold flex items-center gap-2">
                        <Square size={16} fill="currentColor" /> End
                      </button>
                    </>
                  )}
               </div>
            </div>

            {/* Content Grid */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-6">
               {/* Main Video Area */}
               <div className="lg:col-span-3 relative rounded-2xl overflow-hidden bg-black border border-white/10 shadow-inner">
                  <VideoFeed room={liveKit.getRoom()} isHost={isBroadcaster} />
                  {lastGift && <GiftEventOverlay gift={lastGift} onProfileClick={setSelectedProfile} />}
               </div>

               {/* Right Panel */}
               <div className="lg:col-span-1 h-full flex flex-col gap-4 min-h-0">
                  <ChatBox 
                    streamId={streamId || ''}
                    onProfileClick={setSelectedProfile}
                    onCoinSend={(_uid, _amt) => {}}
                  />
                </div>
            </div>
          </section>
        </main>
      </div>

      {/* Modals */}
      {isGiftModalOpen && <GiftModal onClose={() => { setIsGiftModalOpen(false); setGiftRecipient(null); }} onSendGift={handleGiftSent} recipientName={giftRecipient?.username || 'Broadcaster'} />}
      {selectedProfile && <ProfileModal profile={selectedProfile} onClose={() => setSelectedProfile(null)} onSendCoins={(_amt: number) => {}} onGift={handleGiftFromProfile} currentUser={user} />}
      {isCoinStoreOpen && <CoinStoreModal onClose={() => setIsCoinStoreOpen(false)} onPurchase={handleCoinsPurchased} />}
    </div>
  );
}
