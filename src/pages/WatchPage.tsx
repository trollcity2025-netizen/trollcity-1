import React, { 
  useCallback, 
  useEffect, 
  useMemo, 
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
  Heart
} from 'lucide-react';
import ChatBox from '../components/broadcast/ChatBox';
import GiftModal from '../components/broadcast/GiftModal';
import ProfileModal from '../components/broadcast/ProfileModal';
import CoinStoreModal from '../components/broadcast/CoinStoreModal';
import GiftEventOverlay from './GiftEventOverlay';
import { useGiftEvents } from '../lib/hooks/useGiftEvents';
import EntranceEffect from '../components/broadcast/EntranceEffect';
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

export default function WatchPage() {
  const { streamId } = useParams<{ streamId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  const { user, profile } = useAuthStore();
  
  const stableIdentity = useMemo(() => {
    const id = user?.id || profile?.id;
    if (!id) console.warn('[WatchPage] No stable identity found');
    return id;
  }, [user?.id, profile?.id]);
  
  const [stream, setStream] = useState<StreamRow | null>(null);
  const [, setIsLoadingStream] = useState(true);
  const [broadcastTheme, setBroadcastTheme] = useState<any>(null);
  const [broadcastThemeStyle, setBroadcastThemeStyle] = useState<React.CSSProperties | undefined>(undefined);
  const [reactiveEvent, setReactiveEvent] = useState<{ key: number; style: string; intensity: number } | null>(null);

  const liveKit = useLiveKit();
  const roomName = useMemo(() => String(streamId || ''), [streamId]);

  const hasValidStreamId = !!streamId && typeof streamId === 'string' && streamId.trim() !== '';
  const sessionReady = !!user && !!profile && hasValidStreamId;

  const livekitIdentity = useMemo(() => {
    const id = stableIdentity;
    if (!id) console.warn('[WatchPage] No identity found for LiveKit');
    return id;
  }, [stableIdentity]);

  // Always viewer
  const {
    isConnected,
  } = useLiveKitSession({
    roomName: sessionReady && hasValidStreamId ? roomName : '',
    user: sessionReady && user
      ? { ...user, identity: livekitIdentity, role: 'viewer' }
      : null,
    role: 'viewer',
    allowPublish: false,
    autoPublish: false,
  });

  useEffect(() => {
    if (isConnected) {
      const room = liveKit.getRoom();
      attachLiveKitDebug(room);
    }
  }, [isConnected, liveKit]);

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
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [isCoinStoreOpen, setIsCoinStoreOpen] = useState(false);
  const [giftRecipient, setGiftRecipient] = useState<any>(null);
  const [entranceEffect] = useState<any>(null);

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

  useEffect(() => {
    const broadcasterId = stream?.broadcaster_id;
    if (!broadcasterId) return;
    let isActive = true;

    const loadTheme = async () => {
      const { data: state } = await supabase
        .from('user_broadcast_theme_state')
        .select('active_theme_id')
        .eq('user_id', broadcasterId)
        .maybeSingle();

      if (!isActive) return;
      if (!state?.active_theme_id) {
        setBroadcastThemeStyle(undefined);
        setBroadcastTheme(null);
        return;
      }

      const { data: theme } = await supabase
        .from('broadcast_background_themes')
        .select('id, asset_type, video_webm_url, video_mp4_url, image_url, background_css, background_asset_url, reactive_enabled, reactive_style, reactive_intensity')
        .eq('id', state.active_theme_id)
        .maybeSingle();

      if (!isActive) return;
      if (!theme) {
        setBroadcastThemeStyle(undefined);
        setBroadcastTheme(null);
        return;
      }

      if (theme.background_css) {
        setBroadcastThemeStyle({ background: theme.background_css });
        setBroadcastTheme(theme);
        return;
      }
      if (theme.background_asset_url) {
        setBroadcastThemeStyle({
          backgroundImage: `url(${theme.background_asset_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        });
        setBroadcastTheme(theme);
        return;
      }
      if (theme.image_url) {
        setBroadcastThemeStyle({
          backgroundImage: `url(${theme.image_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        });
        setBroadcastTheme(theme);
        return;
      }
      setBroadcastThemeStyle(undefined);
      setBroadcastTheme(theme);
    };

    loadTheme();
    return () => {
      isActive = false;
    };
  }, [stream?.broadcaster_id]);

  useEffect(() => {
    if (!streamId) return;
    const channel = supabase
      .channel(`broadcast-theme-events-watch-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'broadcast_theme_events',
          filter: `room_id=eq.${streamId}`,
        },
        (payload) => {
          if (!broadcastTheme?.reactive_enabled) return;
          const eventType = payload.new?.event_type || 'gift';
          const baseIntensity = Number(broadcastTheme?.reactive_intensity || 2);
          const intensityBoost = eventType === 'super_gift' ? 2 : eventType === 'gift' ? 1 : 0;
          const intensity = Math.max(1, Math.min(5, baseIntensity + intensityBoost));
          const style = String(broadcastTheme?.reactive_style || 'pulse');
          setReactiveEvent({ key: Date.now(), style, intensity });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, broadcastTheme?.reactive_enabled, broadcastTheme?.reactive_intensity, broadcastTheme?.reactive_style]);

  useEffect(() => {
    if (!reactiveEvent?.key) return;
    const timer = window.setTimeout(() => setReactiveEvent(null), 900);
    return () => window.clearTimeout(timer);
  }, [reactiveEvent?.key]);

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

  // Join Stream (Participant Tracking)
  useEffect(() => {
    if (!streamId || !user?.id) return;

    const joinStream = async () => {
      // Check existing participant record
      const { data: existing } = await supabase
        .from('streams_participants')
        .select('is_active, can_chat')
        .eq('stream_id', streamId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        if (!existing.is_active) {
          toast.error("You have been kicked from this stream.");
          navigate('/'); 
          return;
        }
      } else {
        // Create new record
        await supabase.from('streams_participants').insert({
          stream_id: streamId,
          user_id: user.id,
          is_active: true,
          can_chat: true,
          role: 'viewer'
        });
      }
    };
    
    joinStream();
  }, [streamId, user?.id, navigate]);

  const handleGiftFromProfile = useCallback((profile: any) => {
      setGiftRecipient(profile);
      setIsGiftModalOpen(true);
      setSelectedProfile(null);
  }, []);

  const toGiftSlug = (value?: string) => {
    if (!value) return 'gift';
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'gift';
  };

  const handleGiftSent = useCallback(async (amountOrGift: any) => {
    let totalCoins = 0;
    let quantity = 1;
    let giftName = 'Manual Gift';
    let giftSlug: string | undefined;

    if (typeof amountOrGift === 'number') {
      totalCoins = amountOrGift;
    } else if (amountOrGift && typeof amountOrGift === 'object') {
      const g = amountOrGift;
      quantity = Math.max(1, Number(g.quantity) || 1);
      const per = Number(g.coins) || 0;
      totalCoins = per * quantity;
      giftName = g.name || giftName;
      giftSlug = g.slug || toGiftSlug(g.name || giftName);
    }

    // setCoinCount(prev => prev + totalCoins);
    setIsGiftModalOpen(false);
    
    const receiverId = giftRecipient?.id || null;
    setGiftRecipient(null);

    try {
      if (!user?.id || !stream?.id) {
        toast.error('Unable to send gift right now.');
        return;
      }
      const { error } = await supabase.from('gifts').insert({
        stream_id: stream?.id,
        sender_id: user?.id,
        receiver_id: receiverId,
        coins_spent: totalCoins,
        gift_type: 'paid',
        message: giftName,
        gift_slug: giftSlug || toGiftSlug(giftName),
        quantity: quantity,
      });
      if (error) {
        throw error;
      }
      if (stream?.id && stream?.broadcaster_id) {
        const eventType = totalCoins >= 1000 ? 'super_gift' : 'gift';
        await supabase.from('broadcast_theme_events').insert({
          room_id: stream.id,
          broadcaster_id: stream.broadcaster_id,
          theme_id: broadcastTheme?.id || null,
          event_type: eventType,
          payload: {
            gift_slug: giftSlug || toGiftSlug(giftName),
            coins: totalCoins,
            sender_id: user?.id
          }
        });
      }
    } catch (e) {
      console.error('Failed to record manual gift event:', e);
    }
  }, [stream?.id, user?.id, giftRecipient?.id, broadcastTheme?.id]);

  const handleCoinsPurchased = useCallback(() => {
    setIsCoinStoreOpen(false);
  }, []);

  const handleSendCoins = useCallback((amount: number) => {
    // TODO: Implement direct coin transfer
    console.log('Sending coins:', amount);
    toast.info(`Sent ${amount} coins!`);
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
      {entranceEffect && <EntranceEffect username={entranceEffect.username} role={entranceEffect.role} profile={entranceEffect.profile} />}
      
      <div className="flex h-screen flex-col">
        <main className="flex-1 px-6 py-5">
          <section className="h-full rounded-[32px] border border-white/10 bg-gradient-to-b from-[#050113] to-[#0b091f] p-6 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="mb-5 flex items-center justify-between shrink-0">
               <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/50">Live Stream</p>
                  <p className="text-sm text-white/70">{stream?.title || 'Loading Stream...'}</p>
               </div>
               <div className="flex items-center gap-4">
                  <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10 flex items-center gap-2">
                    <Heart size={16} className="text-purple-400" /> <span className="font-bold">{stream?.total_likes || 0}</span>
                  </div>
                  <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10 flex items-center gap-2">
                    <Users size={16} className="text-green-400" /> <span className="font-bold">{(stream?.current_viewers || 0).toLocaleString()}</span>
                  </div>
                  {stream?.is_live && <div className="px-3 py-1 bg-red-600 rounded-full text-xs font-bold animate-pulse">LIVE</div>}
               </div>
            </div>

            {/* Content Grid */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-6">
               {/* Main Video Area */}
               <div className="lg:col-span-3 relative rounded-2xl overflow-hidden bg-black border border-white/10 shadow-inner">
                  {broadcastTheme?.asset_type === 'video' && (broadcastTheme?.video_webm_url || broadcastTheme?.video_mp4_url) ? (
                    <video className="absolute inset-0 w-full h-full object-cover" muted loop autoPlay playsInline>
                      {broadcastTheme?.video_webm_url && (
                        <source src={broadcastTheme.video_webm_url} type="video/webm" />
                      )}
                      {broadcastTheme?.video_mp4_url && (
                        <source src={broadcastTheme.video_mp4_url} type="video/mp4" />
                      )}
                    </video>
                  ) : (
                    <div className="absolute inset-0" style={broadcastThemeStyle} />
                  )}
                  <div className="absolute inset-0 bg-black/35" />
                  <div
                    className={`absolute inset-0 pointer-events-none ${
                      reactiveEvent ? `theme-reactive-${reactiveEvent.style} theme-reactive-intensity-${reactiveEvent.intensity}` : ''
                    }`}
                  />
                  <VideoFeed room={liveKit.getRoom()} isHost={false} />
          {lastGift && <GiftEventOverlay gift={lastGift} onProfileClick={setSelectedProfile} />}
        </div>

               {/* Right Panel */}
               <div className="lg:col-span-1 h-full flex flex-col gap-4 min-h-0">
                  {hasValidStreamId && (
                    <ChatBox 
                      streamId={streamId!}
                      onProfileClick={setSelectedProfile}
                    />
                  )}
               </div>
            </div>
          </section>
        </main>
      </div>

      {/* Modals */}
      {isGiftModalOpen && (
        <GiftModal 
          onClose={() => setIsGiftModalOpen(false)} 
          onSendGift={handleGiftSent} 
          recipientName={giftRecipient?.username || giftRecipient?.name || 'Broadcaster'}
          profile={profile}
        />
      )}
      {selectedProfile && (
        <ProfileModal 
          profile={selectedProfile} 
          onClose={() => setSelectedProfile(null)} 
          onSendCoins={handleSendCoins} 
          currentUser={user}
          onGift={handleGiftFromProfile}
        />
      )}
      {isCoinStoreOpen && <CoinStoreModal onClose={() => setIsCoinStoreOpen(false)} onPurchase={handleCoinsPurchased} />}
    </div>
  );
}
