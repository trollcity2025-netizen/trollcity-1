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
  CameraOff
} from 'lucide-react';
import ChatBox from '../components/broadcast/ChatBox';
import GiftBox, { GiftItem, RecipientMode } from '../components/broadcast/GiftBox';
import TrollLikeButton from '../components/broadcast/TrollLikeButton';
import GiftModal from '../components/broadcast/GiftModal';
import ProfileModal from '../components/broadcast/ProfileModal';
import CoinStoreModal from '../components/broadcast/CoinStoreModal';
import EntranceEffect from '../components/broadcast/EntranceEffect';
import BroadcastLayout from '../components/broadcast/BroadcastLayout';
import GlobalGiftBanner from '../components/GlobalGiftBanner';
import GiftEventOverlay from './GiftEventOverlay';
import { getUserEntranceEffect, triggerUserEntranceEffect } from '../lib/entranceEffects';

import { useGiftEvents } from '../lib/hooks/useGiftEvents';
import { useOfficerBroadcastTracking } from '../hooks/useOfficerBroadcastTracking';
import { useSeatRoster } from '../hooks/useSeatRoster';
import { attachLiveKitDebug } from '../lib/livekit-debug';
import UserActionsMenu from '../components/broadcast/UserActionsMenu';

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
  is_private?: boolean;
}

interface ActiveViewer {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  role?: string | null;
  isBroadcaster?: boolean;
  fullName?: string | null;
  onboardingCompleted?: boolean;
  w9Status?: string;
}

interface GiftBalanceDelta {
  userId: string;
  delta: number;
  key: number;
}

const useIsBroadcaster = (profile: any, stream: StreamRow | null) => {
  return useMemo(() => {
    return Boolean(profile?.id && stream?.broadcaster_id && profile.id === stream.broadcaster_id);
  }, [profile?.id, stream?.broadcaster_id]);
};

function BroadcasterTimer({ startTime, onClick }: { startTime: string; onClick?: () => void }) {
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
    <button
      type="button"
      onClick={onClick}
      className="bg-red-600/90 text-white px-3 py-1 rounded-full text-xs font-bold font-mono animate-pulse flex items-center gap-2 shadow-[0_0_10px_rgba(220,38,38,0.5)] border border-red-400/30"
    >
      <div className="w-2 h-2 rounded-full bg-white animate-ping" />
      LIVE {elapsed}
    </button>
  );
}

function BroadcasterControlPanel({ streamId, onAlertOfficers }: { streamId: string; onAlertOfficers: (targetUserId?: string) => Promise<void> }) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 1024;
  });
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
  
  const { user, profile, refreshProfile } = useAuthStore();

  const [joinPrice, setJoinPrice] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [showLivePanels, setShowLivePanels] = useState(true);
  const [broadcastThemeStyle, setBroadcastThemeStyle] = useState<React.CSSProperties | undefined>(undefined);
  const [broadcastTheme, setBroadcastTheme] = useState<any>(null);
  const [reactiveEvent, setReactiveEvent] = useState<{ key: number; style: string; intensity: number } | null>(null);

  const stableIdentity = useMemo(() => {
    const id = user?.id || profile?.id;
    if (!id) console.warn('[LivePage] No stable identity found');
    return id;
  }, [user?.id, profile?.id]);
  
  const [stream, setStream] = useState<StreamRow | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [activeViewers, setActiveViewers] = useState<ActiveViewer[]>([]);
  const [isViewerDropdownOpen, setIsViewerDropdownOpen] = useState(false);
  const viewerDropdownRef = useRef<HTMLDivElement | null>(null);
  const viewerButtonRef = useRef<HTMLButtonElement | null>(null);
  const notifiedMissingFormsRef = useRef<Set<string>>(new Set());
  const notifyMissingForms = useCallback(async (userId: string, missing: string[]) => {
    if (!missing.length) return;
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'system_alert',
        title: 'Complete your User Forms & Compliance',
        message: `Please finish the following sections: ${missing.join(', ')}. Visit your Profile Settings to complete them.`,
        is_read: false,
      });
      notifiedMissingFormsRef.current.add(userId);
    } catch (err) {
      console.error('Failed to notify user about compliance:', err);
    }
  }, []);
  const [isLoadingStream, setIsLoadingStream] = useState(true);
  const [privateAccessGranted, setPrivateAccessGranted] = useState(false);
  const [privatePasswordInput, setPrivatePasswordInput] = useState('');
  const [privateAuthError, setPrivateAuthError] = useState('');
  const privateAccessStorageKey = streamId ? `private-stream-access:${streamId}` : null;

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

  useEffect(() => {
    if (!isViewerDropdownOpen || typeof window === 'undefined') return;
    const handleClickOutside = (event: MouseEvent) => {
      if (viewerDropdownRef.current?.contains(event.target as Node)) return;
      if (viewerButtonRef.current?.contains(event.target as Node)) return;
      setIsViewerDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isViewerDropdownOpen]);
  
  const seatRoomName = stream?.room_name || stream?.agora_channel || streamId || 'officer-stream';
  const isBroadcaster = useIsBroadcaster(profile, stream);
  const { seats, claimSeat, releaseSeat } = useSeatRoster(seatRoomName);
  const isGuestSeat = !isBroadcaster && seats.some(seat => seat?.user_id === user?.id);
  const canPublish = isBroadcaster || isGuestSeat;
  const liveKit = useLiveKit();

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
        setLastThemeId(null);
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
        setLastThemeId(null);
        return;
      }

      if (theme.background_css) {
        setBroadcastThemeStyle({ background: theme.background_css });
        setBroadcastTheme(theme);
        setLastThemeId(theme.id || null);
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
        setLastThemeId(theme.id || null);
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
        setLastThemeId(theme.id || null);
        return;
      }
      setBroadcastThemeStyle(undefined);
      setBroadcastTheme(theme);
      setLastThemeId(theme.id || null);
    };

    loadTheme();
    return () => {
      isActive = false;
    };
  }, [stream?.broadcaster_id]);

  // Sync UI state with broadcaster role (auto-publish)
  useEffect(() => {
    if (isBroadcaster) {
      setCameraOn(true);
      setMicOn(true);
    }
  }, [isBroadcaster]);

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


  const officerRoleNames = ['admin', 'lead_troll_officer', 'troll_officer'];
  const isOfficerUser = Boolean(
    profile &&
      (officerRoleNames.includes(profile.role || '') ||
        profile.is_admin ||
        profile.is_lead_officer ||
        profile.is_troll_officer)
  );

  const [seatActionTarget, setSeatActionTarget] = useState<{
    userId: string
    username?: string
    role?: string
    seatIndex: number
  } | null>(null);

  useEffect(() => {
    setSeatActionTarget(null);
  }, [streamId]);

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
    isHost: canPublish,
    userId: user?.id,
    roomName: roomName,
  });

  useEffect(() => {
    if (tokenError) {
      console.error('[LivePage] Token fetch error:', tokenError);
    }
  }, [tokenError]);

  const needsPrivateGate = Boolean(stream?.is_private && stream?.broadcaster_id && stream?.broadcaster_id !== user?.id);
  const streamLoaded = Boolean(stream?.id);
  const canAccessPrivate = !needsPrivateGate || privateAccessGranted;
  const canConnect = tokenReady && !!token && !!serverUrl && !!user?.id && !!roomName && streamLoaded && canAccessPrivate;

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
    resetJoinGuard,
  } = useLiveKitSession({
    roomName: tokenRoomName || (sessionReady ? roomName : ''),
    user: sessionReady && user
      ? { ...user, identity: tokenIdentity || livekitIdentity, role: isBroadcaster ? 'broadcaster' : (canPublish ? 'guest' : 'viewer') }
      : null,
    role: isBroadcaster ? 'broadcaster' : (canPublish ? 'guest' : 'viewer'),
    allowPublish: canPublish && sessionReady,
    autoPublish: canPublish, // Enable autoPublish for guests too when allowed
    token: token || undefined,
    serverUrl: serverUrl || undefined,
    connect: canConnect,
    identity: tokenIdentity || livekitIdentity
  });

  const publishUpgradeRef = useRef(false);

  const handleLeaveSession = useCallback(async () => {
    const seatIndex = seats.findIndex(seat => seat?.user_id === user?.id);
    if (seatIndex >= 0) {
      await releaseSeat(seatIndex);
    }
    
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
  }, [liveKit, cameraOn, micOn, releaseSeat, seats, user?.id]);

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

  const handleAlertOfficers = useCallback(async (targetUserId?: string) => {
    if (!streamId) return;
    try {
      const { data: officers } = await supabase
        .from('user_profiles')
        .select('id, username, role, is_officer')
        .in('role', ['troll_officer','lead_troll_officer','admin']);
      const list = (officers || []).map((o) => ({
        user_id: o.id,
        type: 'officer_update',
        title: 'dYs" Stream Moderation Alert',
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
  }, [streamId]);

  const handleJoinRequest = async (seatIndex: number) => {
    if (canPublish) {
        if (!cameraOn) {
          liveKit.toggleCamera().then((ok) => {
            if (ok) setCameraOn(true);
          });
        }
        if (!micOn) {
          liveKit.toggleMicrophone().then((ok) => {
            if (ok) setMicOn(true);
          });
        }
        return;
    }

    if (!user?.id || !stream?.broadcaster_id || !streamId) {
      toast.error('Unable to join right now.');
      return;
    }

    let joinPriceForClaim = joinPrice;
    if (joinPrice > 0) {
      const confirmed = confirm(`Join the stream for ${joinPrice} coins?`);
      if (!confirmed) return;

      try {
        const { data: spendResult, error: spendError } = await supabase.rpc('spend_coins', {
          p_sender_id: user?.id,
          p_receiver_id: stream?.broadcaster_id,
          p_coin_amount: joinPrice,
          p_source: 'seat_join',
          p_item: 'Join Fee',
        });

        if (spendError) throw spendError;
        const giftId = (spendResult as any)?.gift_id;
        if (giftId) {
          await supabase
            .from('gifts')
            .update({
              stream_id: streamId,
              gift_slug: 'join_fee',
              message: 'Join Fee',
            })
            .eq('id', giftId)
            .limit(1);
        }

        joinPriceForClaim = 0;
        toast.success('Paid join fee!');
      } catch (err) {
        console.error('Join fee failed:', err);
        toast.error('Transaction failed');
        return;
      }
    }

    try {
      await claimSeat(seatIndex, { joinPrice: joinPriceForClaim });
    } catch (err: any) {
      console.error('Failed to claim seat:', err);
      toast.error(err?.message || 'Failed to join seat');
    }
  };

  const handleSeatAction = (seatIndex: number, seat: any) => {
    if (!isOfficerUser || !seat?.user_id) return;
    setSeatActionTarget({
      userId: seat.user_id,
      username: seat.username,
      role: seat.role,
      seatIndex,
    });
  };

  const closeSeatActionMenu = () => {
    setSeatActionTarget(null);
  };

  const handleSeatGift = (amount: number) => {
    if (!seatActionTarget) return;
    setGiftReceiver({ id: seatActionTarget.userId, username: seatActionTarget.username || '' });
    setIsGiftModalOpen(true);
    closeSeatActionMenu();
  };

  const handleSeatKick = async () => {
    if (!seatActionTarget) return;
    await releaseSeat(seatActionTarget.seatIndex, seatActionTarget.userId, { force: true });
    toast.success('Guest removed from seat');
    closeSeatActionMenu();
  };

  const handleSeatReport = () => {
    if (!seatActionTarget) return;
    handleAlertOfficers(seatActionTarget.userId);
    toast.info('Officers alerted');
    closeSeatActionMenu();
  };

  const handleSeatFollow = () => {
    if (!seatActionTarget) return;
    toast.success(`Follow request sent to ${seatActionTarget.username || 'user'}`);
    closeSeatActionMenu();
  };

  const handleSeatSummon = () => {
    if (!seatActionTarget) return;
    handleAlertOfficers(seatActionTarget.userId);
    toast.success('Summon request sent');
    closeSeatActionMenu();
  };

  useEffect(() => {
    if (!canPublish) {
      publishUpgradeRef.current = false;
      return;
    }
    if (isBroadcaster || !tokenReady || !serverUrl || !isConnected) return;
    if (publishUpgradeRef.current) return;
    publishUpgradeRef.current = true;
    resetJoinGuard();
    liveKit.disconnect();
  }, [canPublish, isBroadcaster, tokenReady, serverUrl, isConnected, resetJoinGuard, liveKit]);


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
    liveKit.markClientDisconnectIntent();
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
  const [giftBalanceDelta, setGiftBalanceDelta] = useState<GiftBalanceDelta | null>(null);
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  const [chatOverlayOpen, setChatOverlayOpen] = useState(false);
  const [entranceEffectKey, setEntranceEffectKey] = useState(0);
  const [lastThemeId, setLastThemeId] = useState<string | null>(null);
  const entranceTimeoutRef = useRef<number | null>(null);
  
  // Entrance effect logic
  useEffect(() => {
    const triggerEntrance = async () => {
      if (!user || !streamId || isBroadcaster) return;

      const { effectKey, config } = await getUserEntranceEffect(user.id);
      if (!effectKey) return;

      await supabase.from('messages').insert({
        stream_id: streamId,
        user_id: user.id,
        message_type: 'entrance',
        content: JSON.stringify({
          username: profile?.username || user.email,
          role: profile?.role || 'user',
          effectKey,
          effect: config
        })
      });
    };

    if (isConnected) {
      void triggerEntrance();
    }
  }, [isConnected, user, streamId, profile, isBroadcaster]);

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
              setEntranceEffectKey((prev) => prev + 1);

              if (entranceTimeoutRef.current) {
                window.clearTimeout(entranceTimeoutRef.current);
              }
              entranceTimeoutRef.current = window.setTimeout(() => {
                setEntranceEffect(null);
                entranceTimeoutRef.current = null;
              }, 5000);

              const payloadUserId =
                data.user_id || data.sender_id || msg.user_id || msg.sender_id;
              if (payloadUserId) {
                void triggerUserEntranceEffect(payloadUserId);
              }
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
      if (entranceTimeoutRef.current) {
        window.clearTimeout(entranceTimeoutRef.current);
        entranceTimeoutRef.current = null;
      }
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
      setViewerCount((streamDataFromState as StreamRow).current_viewers ?? 0);
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
          setViewerCount(parsedStream.current_viewers ?? 0);
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
        .select("id, broadcaster_id, title, category, status, start_time, end_time, current_viewers, total_gifts_coins, total_unique_gifters, is_live, is_private, thumbnail_url, room_name, created_at, updated_at")
          .eq("id", streamId)
          .maybeSingle();

        if (error || !streamRow) {
            toast.error("Stream not found.");
            setIsLoadingStream(false);
            return;
        }
        setViewerCount(streamRow.current_viewers ?? 0);
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

  useEffect(() => {
    if (!streamId || !stream) {
      setPrivateAccessGranted(false);
      setPrivatePasswordInput('');
      setPrivateAuthError('');
      return;
    }

    if (!privateAccessStorageKey) {
      setPrivateAccessGranted(true);
      return;
    }

    if (stream.is_private && stream.broadcaster_id !== user?.id) {
      const stored = localStorage.getItem(privateAccessStorageKey);
      setPrivateAccessGranted(Boolean(stored));
    } else {
      setPrivateAccessGranted(true);
      if (privateAccessStorageKey) {
        localStorage.removeItem(privateAccessStorageKey);
      }
    }
  }, [streamId, stream?.is_private, stream?.broadcaster_id, user?.id, privateAccessStorageKey, stream]);

  const handlePrivatePasswordSubmit = async () => {
    setPrivateAuthError('');
    if (!streamId) {
      setPrivateAuthError('Stream unavailable');
      return;
    }
    if (!user) {
      setPrivateAuthError('Please sign in to enter the password');
      return;
    }
    if (!privatePasswordInput.trim()) {
      setPrivateAuthError('Enter the stream password');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('verify_stream_password', {
        p_stream_id: streamId,
        p_password: privatePasswordInput.trim(),
      });

      if (error) throw error;

      if (data?.success) {
        setPrivateAccessGranted(true);
        if (privateAccessStorageKey) {
          localStorage.setItem(privateAccessStorageKey, '1');
        }
        setPrivateAuthError('');
        toast.success('Private access granted');
      } else {
        setPrivateAuthError('Incorrect password');
      }
    } catch (err: any) {
      console.error('Private password verification failed:', err);
      setPrivateAuthError('Unable to verify password right now');
    }
  };

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

  const refreshViewerSnapshot = useCallback(async () => {
    if (!streamId) {
      setActiveViewers([]);
      setViewerCount(0);
      return;
    }

    try {
      const { data: viewerRows, error: viewerError } = await supabase
        .from('stream_viewers')
        .select('user_id')
        .eq('stream_id', streamId);

      if (viewerError) {
        console.error('Failed to load active viewers:', viewerError);
        return;
      }

      const viewerIds = (viewerRows || []).map((row: any) => row.user_id).filter(Boolean);
      const fallbackViewers = viewerIds.map((id: string) => ({
        userId: id,
        username: `Viewer ${id.substring(0, 6)}`,
      }));
      let mappedViewers = fallbackViewers;

      if (viewerIds.length > 0) {
        const [profileResult, taxResult] = await Promise.all([
          supabase
            .from('user_profiles')
            .select('id, username, avatar_url, role, troll_role, is_broadcaster, full_name, onboarding_completed')
            .in('id', viewerIds),
          supabase
            .from('user_tax_info')
            .select('user_id, w9_status')
            .in('user_id', viewerIds)
        ]);

        const profileRows = profileResult.data;
        const profileError = profileResult.error;
        const taxRows = taxResult.data || [];

        if (!profileError && Array.isArray(profileRows) && profileRows.length > 0) {
          const profileMap = new Map(profileRows.map((p: any) => [p.id, p]));
          const taxMap = new Map(taxRows.map((t: any) => [t.user_id, t]));

          mappedViewers = viewerIds.map((id: string) => {
            const profile = profileMap.get(id);
            const taxInfo = taxMap.get(id);
            const w9Status = taxInfo?.w9_status || 'pending';

            return {
              userId: id,
              username: profile?.username || `Viewer ${id.substring(0, 6)}`,
              avatarUrl: profile?.avatar_url,
              role: profile?.role || profile?.troll_role || null,
              isBroadcaster: Boolean(profile?.is_broadcaster),
              fullName: profile?.full_name || null,
              onboardingCompleted: Boolean(profile?.onboarding_completed),
              w9Status,
            };
          });
        }
      }

      setActiveViewers(mappedViewers);
      setViewerCount(viewerIds.length);
      setStream((prev) => (prev ? { ...prev, current_viewers: viewerIds.length } : prev));
    } catch (err) {
      console.error('Failed to refresh viewer snapshot:', err);
    }
  }, [streamId]);

  useEffect(() => {
    if (!streamId) return;
    refreshViewerSnapshot();
    const channel = supabase
      .channel(`stream-viewers-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stream_viewers',
          filter: `stream_id=eq.${streamId}`,
        },
        () => {
          refreshViewerSnapshot();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, refreshViewerSnapshot]);

  useEffect(() => {
    activeViewers.forEach((viewer) => {
      if (!viewer.userId) return;
      if (viewer.isBroadcaster) {
        notifiedMissingFormsRef.current.delete(viewer.userId);
        return;
      }

      const missing: string[] = [];
      if (!viewer.fullName) missing.push('Profile Info');
      if (!viewer.onboardingCompleted) missing.push('Onboarding');
      if (!['submitted', 'verified'].includes(viewer.w9Status || 'pending')) {
        missing.push('Tax / W9');
      }

      if (missing.length === 0) {
        notifiedMissingFormsRef.current.delete(viewer.userId);
        return;
      }

      if (notifiedMissingFormsRef.current.has(viewer.userId)) return;
      void notifyMissingForms(viewer.userId, missing);
    });
  }, [activeViewers, notifyMissingForms]);

  // Gift subscription
  const lastGift = useGiftEvents(streamId);

  // Update coin count instantly when a gift is received
  useEffect(() => {
    if (!lastGift) return;
    const amount = Number(lastGift.coinCost || 0);
    if (amount <= 0) return;

    setStream(prev => {
      if (!prev) return prev;
      const updatedCoins = (prev.total_gifts_coins || 0) + amount;
      if (updatedCoins === prev.total_gifts_coins) return prev;
      return { ...prev, total_gifts_coins: updatedCoins };
    });
  }, [lastGift]);

  const toGiftSlug = (value?: string) => {
    if (!value) return 'gift';
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'gift';
  };

  const handleGiftSent = useCallback(
    async (gift: GiftItem, targetMode: RecipientMode) => {
      const totalCoins = gift.value || 0;
      if (totalCoins <= 0) return;

      const receiverId =
        targetMode === "broadcaster"
          ? stream?.broadcaster_id
          : giftReceiver?.id || stream?.broadcaster_id;
      setGiftReceiver(null);

      const senderId = user?.id;
      const streamIdValue = stream?.id;
      const broadcasterId = stream?.broadcaster_id;
      const canonicalGiftName = gift?.name || "Gift";
      const canonicalGiftSlug = gift?.slug || toGiftSlug(canonicalGiftName);

      if (!senderId || !streamIdValue || !receiverId) {
        toast.error("Unable to send gift right now.");
        return;
      }

      try {
        const { error: spendError } = await supabase.rpc("spend_coins", {
          p_sender_id: senderId,
          p_receiver_id: receiverId,
          p_coin_amount: totalCoins,
          p_source: "gift",
          p_item: canonicalGiftName,
        });

        if (spendError) {
          throw spendError;
        }

        setGiftBalanceDelta({
          userId: receiverId,
          delta: totalCoins,
          key: Date.now(),
        });

        if (typeof refreshProfile === 'function') {
          refreshProfile().catch((err) => {
            console.warn('Failed to refresh profile after sending gift:', err);
          });
        }

        setStream((prev) =>
          prev
            ? {
                ...prev,
                total_gifts_coins: (prev.total_gifts_coins || 0) + totalCoins,
              }
            : prev
        );

        if (streamIdValue && broadcasterId) {
          const eventType = totalCoins >= 1000 ? "super_gift" : "gift";
          const themeIdToUse = lastThemeId || broadcastTheme?.id;
          if (!themeIdToUse) {
            console.warn("[LivePage] Skipping broadcast_theme_events insert because no theme is active");
          } else {
            await supabase.from("broadcast_theme_events").insert({
              room_id: streamIdValue,
              broadcaster_id: broadcasterId,
              user_id: senderId,
              theme_id: themeIdToUse,
              event_type: eventType,
              payload: {
                gift_slug: canonicalGiftSlug,
                coins: totalCoins,
                sender_id: senderId,
              },
            });
          }
        }
      } catch (err) {
        console.error("Failed to send gift:", err);
        toast.error("Failed to send gift. Please try again.");
      }
    },
    [stream?.id, user?.id, giftReceiver, stream?.broadcaster_id, broadcastTheme?.id, lastThemeId, refreshProfile]
  );
  useEffect(() => {
    if (!streamId) return;
    const channel = supabase
      .channel(`broadcast-theme-events-${streamId}`)
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
      <GlobalGiftBanner />
      {needsPrivateGate && !privateAccessGranted && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/90 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0a16] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-2">Private stream</h3>
            <p className="text-sm text-gray-300 mb-4">
              This broadcast requires a password provided by the broadcaster. Enter it below to join.
            </p>
            <input
              type="password"
              value={privatePasswordInput}
              onChange={(e) => setPrivatePasswordInput(e.target.value)}
              placeholder="Enter stream password"
              className="w-full bg-[#05060f] border border-purple-500/40 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-300 focus:outline-none mb-2"
            />
            {privateAuthError && (
              <p className="text-xs text-red-400 mb-2">{privateAuthError}</p>
            )}
            <button
              className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-500 font-semibold text-sm"
              onClick={handlePrivatePasswordSubmit}
            >
              Submit password
            </button>
            {!user && (
              <p className="mt-3 text-xs text-gray-400">
                You must be signed in to enter the password.
              </p>
            )}
          </div>
        </div>
      )}
      {/* Entrance effect for all users */}
      {entranceEffect && (
        <div key={entranceEffectKey} className="fixed inset-0 z-[100] pointer-events-none">
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
            <div className="relative">
              <button
                ref={viewerButtonRef}
                type="button"
                onClick={() => setIsViewerDropdownOpen((prev) => !prev)}
                className="px-3 py-2 bg-white/5 rounded-lg border border-white/10 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-400 transition"
                aria-expanded={isViewerDropdownOpen}
              >
                <Users size={16} className="text-green-400" /> <span className="font-bold">{viewerCount.toLocaleString()}</span>
              </button>
              {isViewerDropdownOpen && (
                <div
                  ref={viewerDropdownRef}
                  className="absolute right-0 mt-2 w-64 max-h-72 overflow-hidden rounded-2xl border border-white/10 bg-black/90 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl z-20"
                >
                  <div className="px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-white/50">
                    Active viewers
                  </div>
                  <div className="divide-y divide-white/5 max-h-60 overflow-y-auto">
                    {activeViewers.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-white/60 text-center">No active viewers</div>
                    ) : (
                      activeViewers.map((viewer) => (
                        <div key={viewer.userId} className="flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition">
                          <div className="h-8 w-8 rounded-full bg-white/10 text-xs font-semibold uppercase text-white flex items-center justify-center overflow-hidden">
                            {viewer.avatarUrl ? (
                              <img src={viewer.avatarUrl} alt={viewer.username} className="h-full w-full object-cover" />
                            ) : (
                              viewer.username?.charAt(0) ?? '?'
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{viewer.username}</p>
                            {viewer.role && (
                              <p className="text-[11px] text-white/60 capitalize">{viewer.role}</p>
                            )}
                          </div>
                          {viewer.isBroadcaster && (
                            <span className="self-start whitespace-nowrap rounded-full border border-emerald-400/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                              Host
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {isBroadcaster && (
              <button
                onClick={() => setControlPanelOpen(true)}
                className="px-3 py-2 rounded-lg border border-white/20 text-xs font-bold uppercase tracking-[0.2em] bg-white/5 text-white hover:bg-white/10 transition"
              >
                Control Panel
              </button>
            )}
            {stream.is_live && (
              isBroadcaster && stream.start_time ? (
                <BroadcasterTimer startTime={stream.start_time} onClick={endStream} />
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
              </>
            )}
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 p-2 lg:p-4 pt-0 overflow-y-auto lg:overflow-hidden">
        {/* Broadcast Layout (Streamer + Guests) */}
        <div
          className="lg:w-3/4 h-[48svh] lg:h-full lg:flex-1 min-h-0 flex flex-col relative z-0"
          onClick={() => {
            if (!showLivePanels) setShowLivePanels(true);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (!showLivePanels) setShowLivePanels(true);
            }
          }}
        >
            <BroadcastLayout 
              room={liveKit.getRoom()} 
              broadcasterId={stream.broadcaster_id}
              isHost={isBroadcaster}
              seats={seats}
              joinPrice={joinPrice}
              lastGift={lastGift}
              backgroundStyle={broadcastThemeStyle}
              backgroundTheme={broadcastTheme}
              reactiveEvent={reactiveEvent}
              onSetPrice={handleSetPrice}
              onJoinRequest={handleJoinRequest}
              onLeaveSession={handleLeaveSession}
              onDisableGuestMedia={liveKit.disableGuestMediaByClick}
              onSeatAction={handleSeatAction}
              giftBalanceDelta={giftBalanceDelta}
            >
               <GiftEventOverlay gift={lastGift} onProfileClick={(p) => setSelectedProfile(p)} />
            </BroadcastLayout>
         </div>

         {/* Mobile Tab Bar */}
         {showLivePanels && (
         <div className="flex lg:hidden bg-[#0b091f]/90 backdrop-blur rounded-lg p-1 shrink-0 gap-2 sticky bottom-0 z-20 border border-white/10">
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
         )}
         {showLivePanels && (
         <div className="flex lg:hidden justify-center px-4 pb-2 pt-1">
            <button
              onClick={() => setChatOverlayOpen(true)}
              className="w-full rounded-full border border-white/20 bg-gradient-to-r from-purple-500 to-pink-500 text-xs font-bold uppercase tracking-[0.3em] text-white py-2 shadow-lg shadow-purple-500/40"
            >
              Raise Live Chat
            </button>
         </div>
         )}

         {/* Right Panel (Chat/Gifts) */}
         {showLivePanels && (
         <div className="lg:w-1/4 flex-1 lg:h-full min-h-0 flex flex-col gap-4 overflow-hidden relative z-0 pb-[calc(4rem+env(safe-area-inset-bottom))]">
            {/* GiftBox - Hidden on mobile if chat tab active; make scrollable and height-safe */}
            <div className={`${activeMobileTab === 'gifts' ? 'flex' : 'hidden'} lg:flex flex-col flex-1 min-h-0 overflow-hidden`}>
              <div className="flex-1 min-h-0 overflow-y-auto pr-2 pb-[env(safe-area-inset-bottom)]">
                <GiftBox onSendGift={handleGiftSent} participants={[]} />
              </div>
            </div>
            
            {/* ChatBox - Hidden on mobile if gifts tab active; ensure input is pinned and chat scrolls */}
            <div className={`${activeMobileTab === 'chat' ? 'flex' : 'hidden'} lg:flex flex-col flex-1 min-h-0`}>
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
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
         )}
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
      {seatActionTarget && (
        <UserActionsMenu
          user={{
            name: seatActionTarget.username || 'Seat occupant',
            role: seatActionTarget.role as any,
          }}
          userRole={profile?.role}
          onClose={closeSeatActionMenu}
          onGift={handleSeatGift}
          onKick={handleSeatKick}
          onReport={handleSeatReport}
          onFollow={handleSeatFollow}
          onSummon={handleSeatSummon}
        />
      )}
      {isCoinStoreOpen && <CoinStoreModal onClose={() => setIsCoinStoreOpen(false)} onPurchase={handleCoinsPurchased} />}
      {chatOverlayOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#05010a]/95 p-4 md:hidden">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-white/60">Live Chat</h3>
            <button
              onClick={() => setChatOverlayOpen(false)}
              className="text-white/60 hover:text-white text-sm"
            >
              Close
            </button>
          </div>
          <div className="flex-1 min-h-0 mt-3">
            <ChatBox
              streamId={streamId || ''}
              onProfileClick={setSelectedProfile}
              onCoinSend={handleSendCoinsToUser}
              room={liveKit.getRoom()}
              isBroadcaster={isBroadcaster}
            />
          </div>
        </div>
      )}
      {isBroadcaster && controlPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-4xl">
            <button
              onClick={() => setControlPanelOpen(false)}
              className="absolute right-3 top-3 text-white/60 hover:text-white"
            >
              Close
            </button>
            <div className="bg-[#05010a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
              <BroadcasterControlPanel
                streamId={streamId || ''}
                onAlertOfficers={handleAlertOfficers}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
