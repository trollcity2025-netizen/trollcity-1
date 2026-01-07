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
import { addCoins } from '../lib/coinTransactions';
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

// Lazy load components to avoid circular dependencies
const ChatBox = React.lazy(() => import('../components/broadcast/ChatBox'));
const GiftBox = React.lazy(() => import('../components/broadcast/GiftBox'));
const TrollLikeButton = React.lazy(() => import('../components/broadcast/TrollLikeButton'));
const GiftModal = React.lazy(() => import('../components/broadcast/GiftModal'));
const ProfileModal = React.lazy(() => import('../components/broadcast/ProfileModal'));
const CoinStoreModal = React.lazy(() => import('../components/broadcast/CoinStoreModal'));
const GiftEventOverlay = React.lazy(() => import('./GiftEventOverlay'));
const EntranceEffect = React.lazy(() => import('../components/broadcast/EntranceEffect'));
const BroadcastLayout = React.lazy(() => import('../components/broadcast/BroadcastLayout'));
const GlobalGiftBanner = React.lazy(() => import('../components/GlobalGiftBanner'));

import { useGiftEvents } from '../lib/hooks/useGiftEvents';
import { useOfficerBroadcastTracking } from '../hooks/useOfficerBroadcastTracking';
import { attachLiveKitDebug } from '../lib/livekit-debug';

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
  category?: string;
}

const useIsBroadcaster = (profile: any, stream: StreamRow | null) => {
  return useMemo(() => {
    return Boolean(profile?.id && stream?.broadcaster_id && profile.id === stream.broadcaster_id);
  }, [profile?.id, stream?.broadcaster_id]);
};

function BroadcasterTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    if (!startTime) return;
    const start = new Date(startTime).getTime();
    
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = now - start;
      if (diff < 0) {
        setElapsed('00:00:00');
        return;
      }
      
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      
      setElapsed(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="bg-red-600/90 text-white px-3 py-1 rounded-full text-xs font-bold font-mono animate-pulse flex items-center gap-2 shadow-[0_0_10px_rgba(220,38,38,0.5)] border border-red-400/30">
      <div className="w-2 h-2 rounded-full bg-white animate-ping" />
      LIVE {elapsed}
    </div>
  );
}

function BroadcasterControlPanel({ streamId, onAlertOfficers }: { streamId: string; onAlertOfficers: (targetUserId?: string) => Promise<void> }) {
  const [open, setOpen] = useState(true);
  const [participants, setParticipants] = useState<Array<{ user_id: string; username: string; avatar_url?: string; is_moderator?: boolean; can_chat?: boolean; chat_mute_until?: string; is_active?: boolean }>>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [muting, setMuting] = useState<string | null>(null);
  const [kicking, setKicking] = useState<string | null>(null);
  const [updatingMod, setUpdatingMod] = useState<string | null>(null);

  const loadParticipants = useCallback(async () => {
    if (!streamId) return;
    setLoading(true);
    try {
      const { data: sp } = await supabase
        .from('streams_participants')
        .select('user_id,is_active,is_moderator,can_chat,chat_mute_until')
        .eq('stream_id', streamId);

      const rows = sp || [];
      const ids = rows.map(r => r.user_id);
      const profiles: Record<string, { username: string; avatar_url?: string }> = {};
      if (ids.length > 0) {
        const { data: ups } = await supabase
          .from('user_profiles')
          .select('id,username,avatar_url')
          .in('id', ids);
        (ups || []).forEach((p: any) => { profiles[p.id] = { username: p.username, avatar_url: p.avatar_url }; });
      }
      setParticipants(rows.map(r => ({
        user_id: r.user_id,
        username: profiles[r.user_id]?.username || 'Unknown',
        avatar_url: profiles[r.user_id]?.avatar_url,
        is_moderator: r.is_moderator,
        can_chat: r.can_chat,
        chat_mute_until: r.chat_mute_until,
        is_active: r.is_active
      })));
    } catch (err) {
      console.error('Failed to load participants', err);
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  useEffect(() => { loadParticipants(); }, [loadParticipants]);

  const assignModerator = async (userId: string) => {
    setUpdatingMod(userId);
    try {
      await supabase
        .from('streams_participants')
        .update({ is_moderator: true })
        .eq('stream_id', streamId)
        .eq('user_id', userId);
      toast.success('Moderator assigned');
      loadParticipants();
    } catch (err) {
      console.error('Failed to assign moderator', err);
      toast.error('Failed to assign moderator');
    } finally {
      setUpdatingMod(null);
    }
  };

  const removeModerator = async (userId: string) => {
    setUpdatingMod(userId);
    try {
      await supabase
        .from('streams_participants')
        .update({ is_moderator: false })
        .eq('stream_id', streamId)
        .eq('user_id', userId);
      toast.success('Moderator removed');
      loadParticipants();
    } catch (err) {
      console.error('Failed to remove moderator', err);
      toast.error('Failed to remove moderator');
    } finally {
      setUpdatingMod(null);
    }
  };

  const kickUser = async (userId: string) => {
    setKicking(userId);
    try {
      await supabase
        .from('streams_participants')
        .update({ is_active: false, left_at: new Date().toISOString() })
        .eq('stream_id', streamId)
        .eq('user_id', userId);
      toast.success('User kicked from stream');
      loadParticipants();
    } catch (err) {
      console.error('Failed to kick user', err);
      toast.error('Failed to kick user');
    } finally {
      setKicking(null);
    }
  };

  const muteUser = async (userId: string, minutes: number) => {
    setMuting(userId);
    try {
      const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      await supabase
        .from('streams_participants')
        .update({ can_chat: false, chat_mute_until: until })
        .eq('stream_id', streamId)
        .eq('user_id', userId);
      toast.success(`Muted for ${minutes} minutes`);
      loadParticipants();
    } catch (err) {
      console.error('Failed to mute user', err);
      toast.error('Failed to mute user');
    } finally {
      setMuting(null);
    }
  };

  const reportUser = async (userId: string) => {
    const reason = window.prompt('Reason for report:', 'Violation of rules');
    if (reason === null) return;
    try {
      await supabase
        .from('moderation_reports')
        .insert({
          reporter_id: (await supabase.auth.getUser()).data.user?.id,
          target_user_id: userId,
          stream_id: streamId,
          reason,
          description: ''
        });
      toast.success('Report submitted');
    } catch (err) {
      console.error('Failed to submit report', err);
      toast.error('Failed to submit report');
    }
  };

  const filtered = participants.filter(p => p.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="bg-white/5 rounded-lg border border-white/10 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Broadcaster Control Panel</h3>
        <button onClick={() => setOpen(v => !v)} className="text-xs text-white/60 hover:text-white">
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.3em] text-white/60">Moderators</span>
              <button
                onClick={() => onAlertOfficers()}
                className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-500 font-bold"
              >
                Alert Troll Officers
              </button>
            </div>
            <div className="mt-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search participants..."
                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs"
              />
            </div>
            <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
              {loading ? (
                <div className="text-xs text-white/60">Loading participants...</div>
              ) : filtered.length === 0 ? (
                <div className="text-xs text-white/60">No participants</div>
              ) : (
                filtered.map((p) => (
                  <div key={p.user_id} className="flex items-center justify-between bg-black/30 rounded px-2 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/10" />
                      <div>
                        <div className="text-xs font-semibold">{p.username}</div>
                        <div className="text-[10px] text-white/50">
                          {p.is_active ? 'active' : 'inactive'} • {p.is_moderator ? 'moderator' : 'viewer'}
                          {p.can_chat === false ? ' • muted' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.is_moderator ? (
                        <button
                          disabled={updatingMod === p.user_id}
                          onClick={() => removeModerator(p.user_id)}
                          className="text-[10px] px-2 py-1 rounded bg-yellow-600/30 border border-yellow-500/40 hover:bg-yellow-600/50"
                        >
                          Remove Mod
                        </button>
                      ) : (
                        <button
                          disabled={updatingMod === p.user_id}
                          onClick={() => assignModerator(p.user_id)}
                          className="text-[10px] px-2 py-1 rounded bg-green-600/30 border border-green-500/40 hover:bg-green-600/50"
                        >
                          Make Mod
                        </button>
                      )}
                      <button
                        disabled={kicking === p.user_id}
                        onClick={() => kickUser(p.user_id)}
                        className="text-[10px] px-2 py-1 rounded bg-red-600/40 border border-red-500/50 hover:bg-red-600/60"
                      >
                        Kick
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={muting === p.user_id}
                          onClick={() => muteUser(p.user_id, 5)}
                          className="text-[10px] px-2 py-1 rounded bg-purple-600/30 border border-purple-500/40 hover:bg-purple-600/50"
                        >
                          Mute 5m
                        </button>
                        <button
                          disabled={muting === p.user_id}
                          onClick={() => muteUser(p.user_id, 10)}
                          className="text-[10px] px-2 py-1 rounded bg-purple-600/30 border border-purple-500/40 hover:bg-purple-600/50"
                        >
                          10m
                        </button>
                        <button
                          disabled={muting === p.user_id}
                          onClick={() => muteUser(p.user_id, 30)}
                          className="text-[10px] px-2 py-1 rounded bg-purple-600/30 border border-purple-500/40 hover:bg-purple-600/50"
                        >
                          30m
                        </button>
                      </div>
                      <button
                        onClick={() => reportUser(p.user_id)}
                        className="text-[10px] px-2 py-1 rounded bg-blue-600/30 border border-blue-500/40 hover:bg-blue-600/50"
                      >
                        Report
                      </button>
                      <button
                        onClick={() => onAlertOfficers(p.user_id)}
                        className="text-[10px] px-2 py-1 rounded bg-red-700/40 border border-red-600/50 hover:bg-red-700/60"
                      >
                        Alert
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default function LivePage() {
  const { streamId } = useParams<{ streamId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  const { user, profile } = useAuthStore();

  const [joinPrice, setJoinPrice] = useState(0);
  const [canPublish, setCanPublish] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);

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

  // Sync UI state with broadcaster role (auto-publish)
  useEffect(() => {
    if (isBroadcaster) {
      setCameraOn(true);
      setMicOn(true);
    }
  }, [isBroadcaster]);


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
  } = useLiveKitSession({
    roomName: tokenRoomName || (sessionReady ? roomName : ''),
    user: sessionReady && user
      ? { ...user, identity: tokenIdentity || livekitIdentity, role: isBroadcaster ? 'broadcaster' : 'viewer' }
      : null,
    role: isBroadcaster ? 'broadcaster' : 'viewer',
    allowPublish: (isBroadcaster || canPublish) && sessionReady,
    autoPublish: isBroadcaster, // Only broadcaster auto-publishes. Viewers must request.
    token: token || undefined,
    serverUrl: serverUrl || undefined,
    connect: canConnect,
    identity: tokenIdentity || livekitIdentity
  });

  // Join Request Logic
  // const [joinPrice, setJoinPrice] = useState(0); // Moved up
  // const [canPublish, setCanPublish] = useState(false); // Moved up

  const handleLeaveSession = useCallback(async () => {
    setCanPublish(false);
    
    // Disable media
    if (cameraOn) {
       await liveKit.toggleCamera();
       setCameraOn(false);
    }
    if (micOn) {
       await liveKit.toggleMicrophone();
       setMicOn(false);
    }
    
    toast.info("You have left the guest box");
  }, [liveKit, cameraOn, micOn]);

  const handleSetPrice = async (price: number) => {
    setJoinPrice(price);
    // Broadcast price to viewers via system message
    await supabase.from('messages').insert({
      stream_id: streamId,
      user_id: user?.id,
      message_type: 'system',
      content: `PRICE_UPDATE:${price}`
    });
    toast.success(`Join price set to ${price} coins`);
  };

  const handleJoinRequest = async () => {
    if (canPublish) {
        toast.info("You are already enabled to join!");
        return;
    }
    
    if (joinPrice > 0) {
      const confirmed = confirm(`Join the stream for ${joinPrice} coins?`);
      if (!confirmed) return;
      
      try {
          // 1. Check balance
          const { data: p } = await supabase.from('user_profiles').select('troll_coins').eq('id', user?.id).maybeSingle();
          if ((p?.troll_coins || 0) < joinPrice) {
              toast.error("Not enough coins!");
              return;
          }
          
          // 2. Send coins logic (using gifts table to trigger balance updates)
          const { error } = await supabase.from('gifts').insert({
              stream_id: streamId,
              sender_id: user?.id,
              receiver_id: stream?.broadcaster_id,
              coins_spent: joinPrice,
              gift_type: 'paid',
              message: 'Join Fee',
              quantity: 1
          });

          if (error) throw error;
          
          toast.success("Paid join fee!");
      } catch (e) {
          console.error(e);
          toast.error("Transaction failed");
          return;
      }
    }
    
    setCanPublish(true);
    // Allow React state to update before triggering publish
    setTimeout(() => {
        liveKit.toggleCamera().then((ok) => {
             if (ok) setCameraOn(true);
        });
        liveKit.toggleMicrophone().then((ok) => {
             if (ok) setMicOn(true);
        });
    }, 500);
  };


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
        .maybeSingle();

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
          } else if (msg.message_type === 'system' && msg.content?.startsWith('PRICE_UPDATE:')) {
             const price = parseInt(msg.content.split(':')[1]);
             if (!isNaN(price)) setJoinPrice(price);
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
  }, [streamId, location]);

  useEffect(() => {
    loadStreamData();
  }, [loadStreamData]);

  // XP Tracking for Watchers (Anti-Farm: 5 XP every 10 mins)
  const watchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const minutesWatchedRef = useRef(0);

  useEffect(() => {
    // Only track if user is logged in, stream is live, and NOT the broadcaster
    if (!user?.id || !stream?.is_live || isBroadcaster) return;

    // Clear existing timer
    if (watchTimerRef.current) clearInterval(watchTimerRef.current);

    watchTimerRef.current = setInterval(async () => {
      minutesWatchedRef.current += 1;
      
      // Award 5 XP every 10 minutes
      if (minutesWatchedRef.current % 10 === 0) {
        try {
           // Call add_xp with 'watch' source
           await supabase.rpc('add_xp', { 
             p_user_id: user.id, 
             p_amount: 5, 
             p_source: 'watch' 
           });
           console.log('[XP] Awarded 5 watch XP');
        } catch (e) {
           console.error('[XP] Failed to award watch XP', e);
        }
      }
    }, 60000); // Check every minute

    return () => {
      if (watchTimerRef.current) clearInterval(watchTimerRef.current);
    };
  }, [user?.id, stream?.is_live, isBroadcaster]);

  // Access Control for Officer Streams
  useEffect(() => {
    if (!stream) return;
    
    if (stream.category === 'Officer Stream') {
      const isOfficer = profile && (
        ['admin', 'troll_officer', 'lead_troll_officer'].includes(profile.role || '') || 
        (profile as any).is_lead_officer || 
        (profile as any).is_admin
      );
      
      if (!isOfficer) {
        toast.error("This stream is restricted to officers only.");
        navigate('/');
      }
    }
  }, [stream, profile, navigate]);

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
    }, STREAM_POLL_INTERVAL); // Polling every 2 seconds
    return () => clearInterval(interval);
  }, [streamId]);

  useStreamEndListener({
    streamId: streamId || '',
    enabled: !!streamId, // Redirect all users including broadcaster if they are on this page
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
  }, [lastGift, stream]);

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

      // Lucky Gift Logic (5% chance)
      if (Math.random() < 0.05 && user?.id) {
          const multiplier = Math.floor(Math.random() * 1000) + 1; // 1x to 1000x
          const winAmount = totalCoins * multiplier;
          
          if (winAmount > 0) {
              try {
                  await addCoins({
                      userId: user.id,
                      amount: winAmount,
                      type: 'lucky_gift_win',
                      description: `LUCKY GIFT WIN! (${multiplier}x Multiplier)`,
                      supabaseClient: supabase
                  });
                  toast.success(`🎰 LUCKY GIFT! You won ${winAmount} coins! (${multiplier}x)`);
                  
                  // Announce in chat
                  await supabase.from('messages').insert({
                      stream_id: stream?.id,
                      user_id: user.id, 
                      message_type: 'system',
                      content: `🎰 LUCKY GIFT! I just won ${winAmount} coins back from a lucky gift! (${multiplier}x)`
                  });
              } catch (err) {
                  console.error("Failed to process lucky gift", err);
              }
          }
      }

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
    <React.Suspense fallback={<div className="h-full w-full flex items-center justify-center bg-[#05010a] text-white">Loading interface...</div>}>
    <div className="h-full w-full flex flex-col bg-[#05010a] text-white overflow-hidden">
      <GlobalGiftBanner />
      {/* Entrance effect for all users */}
      {entranceEffect && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          <EntranceEffect username={entranceEffect.username} role={entranceEffect.role} profile={entranceEffect.profile} />
        </div>
      )}
      
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
            <div className="px-3 py-2 bg-white/5 rounded-lg border border-yellow-500/30 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold text-[10px]">C</div>
              <span className="font-bold text-yellow-400">{(stream.total_gifts_coins || 0).toLocaleString()}</span>
            </div>
            <div className="hidden lg:flex px-4 py-2 bg-white/5 rounded-lg border border-white/10 items-center gap-2">
              <Heart size={16} className="text-purple-400" /> <span className="font-bold">{stream?.total_likes || 0}</span>
            </div>
            <div className="px-3 py-2 bg-white/5 rounded-lg border border-white/10 flex items-center gap-2">
              <Users size={16} className="text-green-400" /> <span className="font-bold">{(stream.current_viewers || 0).toLocaleString()}</span>
            </div>
            {stream.is_live && (
              isBroadcaster && stream.start_time ? (
                <BroadcasterTimer startTime={stream.start_time} />
              ) : (
                <div className="px-3 py-1 bg-red-600 rounded-full text-xs font-bold animate-pulse">LIVE</div>
              )
            )}
            
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
              joinPrice={joinPrice}
              onSetPrice={handleSetPrice}
              onJoinRequest={handleJoinRequest}
              onLeaveSession={handleLeaveSession}
            >
               <GiftEventOverlay gift={lastGift} onProfileClick={(p) => setSelectedProfile(p)} />
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
            {isBroadcaster && (
              <BroadcasterControlPanel
                streamId={streamId || ''}
                onAlertOfficers={async (targetUserId?: string) => {
                  try {
                    const { data: officers } = await supabase
                      .from('user_profiles')
                      .select('id, username, role, is_officer')
                      .in('role', ['troll_officer','lead_troll_officer','admin']);
                    const list = (officers || []).map((o) => ({
                      user_id: o.id,
                      type: 'officer_update',
                      title: '🚨 Stream Moderation Alert',
                      message: `Alert in stream ${streamId}${targetUserId ? ` involving user ${targetUserId}` : ''}`,
                      metadata: { stream_id: streamId, target_user_id: targetUserId }
                    }));
                    if (list.length > 0) {
                      await supabase.from('notifications').insert(list);
                      toast.success('Alert sent to troll officers');
                    } else {
                      toast.info('No officers found to notify');
                    }
                  } catch (err) {
                    console.error('Failed to alert officers', err);
                    toast.error('Failed to alert officers');
                  }
                }}
              />
            )}
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
                  room={liveKit.getRoom()}
                  isBroadcaster={isBroadcaster}
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
          profile={profile}
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
    </React.Suspense>
  );
}
