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
import { useLiveKitToken } from '../hooks/useLiveKitToken';
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
import GiftBox from '../components/broadcast/GiftBox';
import TrollLikeButton from '../components/broadcast/TrollLikeButton';
import GiftModal from '../components/broadcast/GiftModal';
import ProfileModal from '../components/broadcast/ProfileModal';
import CoinStoreModal from '../components/broadcast/CoinStoreModal';
import GiftEventOverlay from './GiftEventOverlay';
import { useGiftEvents } from '../lib/hooks/useGiftEvents';
import EntranceEffect from '../components/broadcast/EntranceEffect';
import { useOfficerBroadcastTracking } from '../hooks/useOfficerBroadcastTracking';
import { attachLiveKitDebug } from '../lib/livekit-debug';
import VideoFeed from '../components/stream/VideoFeed';
import BroadcastLayout from '../components/broadcast/BroadcastLayout';

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
  room_name?: string;
  agora_channel?: string;
}

const useIsBroadcaster = (profile: any, stream: StreamRow | null) => {
  return useMemo(() => {
    return Boolean(profile?.id && stream?.broadcaster_id && profile.id === stream.broadcaster_id);
  }, [profile?.id, stream?.broadcaster_id]);
};

export default function LivePage() {
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

  const stableIdentity = useMemo(() => {
    const id = user?.id || profile?.id;
    if (!id) console.warn('[LivePage] No stable identity found');
    return id;
  }, [user?.id, profile?.id]);
  
  const [stream, setStream] = useState<StreamRow | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState(true);

  // Save stream to session storage for persistence
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

  const liveKit = useLiveKit();
  
  // 1. Room name derivation: prefer agora_channel (set by GoLive), then room_name, fallback to stream_{id}
  const roomName = useMemo(() => {
    if (stream?.agora_channel) return stream.agora_channel;
    if (stream?.room_name) return stream.room_name;
    // GoLive sets agora_channel to streamId. BroadcastPage uses streamId.
    // If neither is present, falling back to streamId is safer than stream_{id} to match BroadcastPage.
    return streamId || ''; 
  }, [stream?.agora_channel, stream?.room_name, streamId]);

  const hasValidStreamId = !!streamId && typeof streamId === 'string' && streamId.trim() !== '';
  const sessionReady = !!user && !!profile && hasValidStreamId && !!roomName;

  const livekitIdentity = useMemo(() => {
    const id = stableIdentity;
    if (!id) console.warn('[LivePage] No identity found for LiveKit');
    return id;
  }, [stableIdentity]);

  // Token Management
  const { 
    token, 
    serverUrl, 
    identity: tokenIdentity, 
    roomName: tokenRoomName, 
    ready: tokenReady,
    error: tokenError
  } = useLiveKitToken({
    streamId,
    isHost: isBroadcaster,
    userId: user?.id,
    roomName: roomName,
  });

  useEffect(() => {
    if (tokenError) {
      console.error('[LivePage] Token fetch error:', tokenError);
    }
  }, [tokenError]);

  const canConnect = tokenReady && !!token && !!serverUrl && !!user?.id && !!roomName;

  // Logging for verification
  useEffect(() => {
    if (canConnect) {
      console.log('[LivePage] Joining session:', {
        streamId,
        broadcaster_id: stream?.broadcaster_id,
        isBroadcaster,
        roomName: tokenRoomName || roomName,
        auth_uid: user?.id,
        identity: tokenIdentity || livekitIdentity,
        token: !!token
      });
    }
  }, [canConnect, streamId, stream?.broadcaster_id, isBroadcaster, roomName, tokenRoomName, user?.id, livekitIdentity, tokenIdentity, token]);

  console.log("[LivePage] LiveKit requirements:", { 
    token: token?.slice(0, 15), 
    serverUrl, 
    identity: tokenIdentity || livekitIdentity, 
    roomName: tokenRoomName || roomName 
  });

  const {
    isConnected,
    isConnecting,
    error: liveKitError,
    joinAndPublish
  } = useLiveKitSession({
    roomName: tokenRoomName || (sessionReady ? roomName : ''),
    user: sessionReady && user
      ? { ...user, identity: tokenIdentity || livekitIdentity, role: isBroadcaster ? 'broadcaster' : 'viewer' }
      : null,
    role: isBroadcaster ? 'broadcaster' : 'viewer',
    allowPublish: isBroadcaster && sessionReady,
    autoPublish: isBroadcaster, // Broadcaster auto-publishes (handled safely in hook)
    token: token || undefined,
    serverUrl: serverUrl || undefined,
    connect: canConnect,
    identity: tokenIdentity || livekitIdentity
  });

  // Officer tracking for broadcasters
  useOfficerBroadcastTracking({
    streamId: isBroadcaster ? streamId : undefined,
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
    if (!confirm("Are you sure you want to end this stream?")) return;
    
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
  const [giftReceiver, setGiftReceiver] = useState<any>(null);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [isCoinStoreOpen, setIsCoinStoreOpen] = useState(false);
  const [entranceEffect, setEntranceEffect] = useState<any>(null);
  
  // Entrance effect logic
  useEffect(() => {
    const triggerEntrance = async () => {
      if (!user || !streamId) return;
      
      // Check for active entrance effect
      const { data: effects } = await supabase
        .from('user_entrance_effects')
        .select('*, entrance_effects(*)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (effects?.entrance_effects) {
        // Send entrance message
        await supabase.from('messages').insert({
          stream_id: streamId,
          user_id: user.id,
          message_type: 'entrance',
          content: JSON.stringify({
            username: profile?.username || user.email,
            role: profile?.role || 'user',
            effect: effects.entrance_effects
          })
        });
      }
    };

    if (isConnected) {
      triggerEntrance();
    }
  }, [isConnected, user, streamId, profile]);

  // Real-time listeners for Entrance and Likes
  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`live-updates-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const msg = payload.new;
          if (msg.message_type === 'entrance') {
            try {
              const data = JSON.parse(msg.content);
              setEntranceEffect(data);
              setTimeout(() => setEntranceEffect(null), 5000);
            } catch (e) {
              console.error('Failed to parse entrance effect', e);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);


  // Load Stream Data
  const loadStreamData = useCallback(async () => {
    if (!streamId) {
      setIsLoadingStream(false);
      return;
    }

    // Try location state first
    const streamDataFromState = location.state?.streamData;
    if (streamDataFromState && streamDataFromState.id === streamId) {
      setStream(streamDataFromState as StreamRow);
      setIsLoadingStream(false);
      return;
    }

    // Try session storage second
    try {
      const storedStream = sessionStorage.getItem("activeStream");
      if (storedStream) {
        const parsedStream = JSON.parse(storedStream);
        if (parsedStream.id === streamId) {
          setStream(parsedStream);
          setIsLoadingStream(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to parse stream from sessionStorage', e);
    }

    setIsLoadingStream(true);
    
    try {
        // Fetch by Stream ID ONLY
        const { data: streamRow, error } = await supabase
          .from("streams")
          .select("id, broadcaster_id, title, category, status, start_time, end_time, current_viewers, total_gifts_coins, total_unique_gifters, is_live, thumbnail_url, room_name, created_at, updated_at")
          .eq("id", streamId)
          .maybeSingle();

        if (error || !streamRow) {
            toast.error("Stream not found.");
            setIsLoadingStream(false);
            return;
        }

        setStream(streamRow as StreamRow);
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

  // Update stream status to LIVE once Broadcaster is fully connected
  const hasSetLiveRef = useRef(false);
  
  useEffect(() => {
    // Only proceed if:
    // 1. User is the broadcaster
    // 2. We have a valid stream ID
    // 3. LiveKit is fully connected
    // 4. We haven't already set it to live in this session
    if (!isBroadcaster || !streamId || !isConnected || hasSetLiveRef.current) {
      return;
    }

    // Prevent redundant updates if we know it's already live
    if (stream?.status === 'live' && stream?.is_live) {
       hasSetLiveRef.current = true;
       return;
    }

    console.log('[LivePage] Broadcaster connected. Updating stream status to LIVE...');
    hasSetLiveRef.current = true;

    supabase.from("streams").update({ 
      status: "live", 
      is_live: true, 
      start_time: new Date().toISOString(),
      room_name: roomName 
    }).eq("id", streamId).then(() => {
      console.log("[LivePage] ✅ Stream status updated to LIVE");
      toast.success("You are now LIVE!");
    });

  }, [isBroadcaster, streamId, isConnected, roomName, stream?.status, stream?.is_live]);

  const [activeMobileTab, setActiveMobileTab] = useState<'chat' | 'gifts'>('chat');

  // Stream polling
  useEffect(() => {
    if (!streamId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.from("streams").select("status,is_live,current_viewers,total_gifts_coins,total_likes").eq("id", streamId).maybeSingle();
      if (data) {
        setStream(prev => {
          if (!prev) return prev;
          // Force update if values changed
          if (
            prev.current_viewers !== data.current_viewers ||
            prev.total_likes !== data.total_likes ||
            prev.total_gifts_coins !== data.total_gifts_coins
          ) {
            return { ...prev, ...data };
          }
          return prev;
        });
      }
    }, 2000); // Polling every 2 seconds
    return () => clearInterval(interval);
  }, [streamId]);

  useStreamEndListener({
    streamId: streamId || '',
    enabled: !!streamId && !isBroadcaster, // Only redirect viewers
    redirectToSummary: true,
  });

  // Gift subscription
  const lastGift = useGiftEvents(streamId);

  // Update coin count instantly when a gift is received
  useEffect(() => {
    if (lastGift && stream) {
      const amount = Number(lastGift.coinCost || 0);
      if (amount > 0) {
         setStream(prev => prev ? { 
           ...prev, 
           total_gifts_coins: (prev.total_gifts_coins || 0) + amount 
         } : prev);
      }
    }
  }, [lastGift]);

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

    setIsGiftModalOpen(false);
    const targetReceiverId = giftReceiver?.id || stream?.broadcaster_id;
    setGiftReceiver(null);

    try {
      await supabase.from('gifts').insert({
        stream_id: stream?.id,
        sender_id: user?.id,
        receiver_id: targetReceiverId,
        coins_spent: totalCoins,
        gift_type: 'paid',
        message: giftName,
        gift_id: giftId,
        quantity: quantity,
      });
    } catch (e) {
      console.error('Failed to record manual gift event:', e);
    }
  }, [stream?.id, user?.id, giftReceiver, stream?.broadcaster_id]);

  const handleCoinsPurchased = useCallback((_amount: number) => {
    setIsCoinStoreOpen(false);
  }, []);
  
  const handleSendCoins = useCallback((amount: number) => {
    console.log('Sending coins:', amount);
  }, []);

  const handleSendCoinsToUser = useCallback((_user: string, amount: number) => {
    console.log('Sending coins:', amount);
    toast.info(`Sent ${amount} coins`);
  }, []);

  // Layout
  if (isLoadingStream || !stream || !profile) {
    return (
        <div className="min-h-screen bg-[#03010c] via-[#05031a] to-[#110117] text-white flex items-center justify-center">
            <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full border-2 border-purple-500/60 animate-pulse" />
            <p className="text-sm text-gray-300">Loading broadcast...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#05010a] text-white overflow-hidden">
      {/* Entrance effect for all users */}
      {entranceEffect && <EntranceEffect username={entranceEffect.username} role={entranceEffect.role} profile={entranceEffect.profile} />}
      
      {/* Header Area */}
      <div className="shrink-0 p-4 pb-2 flex justify-between items-center z-10">
         <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">{isBroadcaster ? 'Broadcast' : 'Watching'}</p>
            <p className="text-sm text-white/70">{stream.title || 'Live Stream'}</p>
         </div>
         <div className="flex items-center gap-4">
            <TrollLikeButton 
              streamId={streamId || ''} 
              currentLikes={stream?.total_likes || 0}
            />
            <div className="hidden lg:flex px-4 py-2 bg-white/5 rounded-lg border border-white/10 items-center gap-2">
              <Heart size={16} className="text-purple-400" /> <span className="font-bold">{stream?.total_likes || 0}</span>
            </div>
            <div className="px-3 py-2 bg-white/5 rounded-lg border border-white/10 flex items-center gap-2">
              <Users size={16} className="text-green-400" /> <span className="font-bold">{(stream.current_viewers || 0).toLocaleString()}</span>
            </div>
            {stream.is_live && <div className="px-3 py-1 bg-red-600 rounded-full text-xs font-bold animate-pulse">LIVE</div>}
            
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

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 p-2 lg:p-4 pt-0 overflow-hidden">
         {/* Broadcast Layout (Streamer + Guests) */}
         <div className="lg:w-3/4 h-[55%] lg:h-full min-h-0 flex flex-col relative z-0">
            <BroadcastLayout 
              room={liveKit.getRoom()} 
              broadcasterId={stream.broadcaster_id}
              isHost={isBroadcaster}
              totalCoins={stream.total_gifts_coins || 0}
            >
               {lastGift && <div className="absolute bottom-4 left-4 z-50 pointer-events-none"><GiftEventOverlay gift={lastGift} /></div>}
            </BroadcastLayout>
         </div>

         {/* Mobile Tab Bar */}
         <div className="flex lg:hidden bg-white/5 rounded-lg p-1 shrink-0 gap-2">
            <button 
              onClick={() => setActiveMobileTab('chat')}
              className={`flex-1 py-2 rounded-md font-bold text-sm transition-all ${activeMobileTab === 'chat' ? 'bg-purple-600 text-white shadow-lg' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              Chat
            </button>
            <button 
              onClick={() => setActiveMobileTab('gifts')}
              className={`flex-1 py-2 rounded-md font-bold text-sm transition-all ${activeMobileTab === 'gifts' ? 'bg-purple-600 text-white shadow-lg' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              Gifts
            </button>
         </div>

         {/* Right Panel (Chat/Gifts) */}
         <div className="lg:w-1/4 flex-1 lg:h-full min-h-0 flex flex-col gap-4 overflow-hidden relative z-0">
            {/* GiftBox - Hidden on mobile if chat tab active */}
            <div className={`${activeMobileTab === 'gifts' ? 'flex' : 'hidden'} lg:flex flex-col shrink-0 lg:shrink`}>
               <GiftBox onSendGift={handleGiftSent} />
            </div>
            
            {/* ChatBox - Hidden on mobile if gifts tab active */}
            <div className={`${activeMobileTab === 'chat' ? 'flex' : 'hidden'} lg:flex flex-col flex-1 min-h-0`}>
               <ChatBox 
                 streamId={streamId || ''}
                 onProfileClick={setSelectedProfile}
                 onCoinSend={handleSendCoinsToUser}
               />
            </div>
         </div>
      </div>

      {/* Modals */}
      {isGiftModalOpen && (
        <GiftModal 
          onClose={() => { setIsGiftModalOpen(false); setGiftReceiver(null); }} 
          onSendGift={handleGiftSent} 
          recipientName={giftReceiver?.username || giftReceiver?.name} 
        />
      )}
      {selectedProfile && (
        <ProfileModal 
          profile={selectedProfile} 
          currentUser={user}
          onClose={() => setSelectedProfile(null)} 
          onSendCoins={handleSendCoins} 
          onGift={(profile) => {
            setGiftReceiver(profile);
            setIsGiftModalOpen(true);
            setSelectedProfile(null);
          }}
        />
      )}
      {isCoinStoreOpen && <CoinStoreModal onClose={() => setIsCoinStoreOpen(false)} onPurchase={handleCoinsPurchased} />}
    </div>
  );
}
