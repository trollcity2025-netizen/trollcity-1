import GiftOverlay from '../../components/broadcast/GiftOverlay';
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useViewerTracking } from '../../hooks/useViewerTracking';
import { Stream } from '../../types/broadcast';
import { useStreamEndListener } from '../../hooks/useStreamEndListener';

import BattleControlsList from '../../components/broadcast/BattleControlsList';
import BattleControls from '../../components/broadcast/BattleControls';
import { PreflightStore } from '../../lib/preflightStore';
import AgoraStage from '../../components/broadcast/AgoraStage';
import MuxViewer from '../../components/broadcast/MuxViewer';
import ChurchLayout from '../../components/church/ChurchLayout';
import BroadcastHeader from '../../components/broadcast/BroadcastHeader';
import BroadcastEffectsLayer from '../../components/broadcast/BroadcastEffectsLayer';
import ErrorBoundary from '../../components/ErrorBoundary';
import BroadcastChat from '../../components/broadcast/BroadcastChat';
import BroadcastControls from '../../components/broadcast/BroadcastControls';
import BroadcastGrid from '../../components/broadcast/BroadcastGrid';
import GiftTray from '../../components/broadcast/GiftTray';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStreamSeats } from '../../hooks/useStreamSeats';

const GOVERNMENT_CATEGORIES = ['government', 'courtroom', 'troll-court', 'senate', 'congress'];

function isGovernmentStream(stream: Stream | null): boolean {
  if (!stream) return false;
  const category = stream.category?.toLowerCase() || '';
  return GOVERNMENT_CATEGORIES.some((cat) => category.includes(cat));
}

function isStaffMember(profile: ReturnType<typeof useAuthStore.getState>['profile']): boolean {
  if (!profile) return false;
  return Boolean(
    (profile as any).is_admin ||
      (profile as any).is_lead_officer ||
      (profile as any).is_troll_officer ||
      (profile as any).role === 'admin' ||
      (profile as any).role === 'secretary' ||
      (profile as any).role === 'troll_officer' ||
      (profile as any).role === 'lead_troll_officer'
  );
}

/**
 * Stable numeric UID that is never 0.
 * This avoids collisions + avoids Agora token/client weirdness that happens with uid=0.
 */
function stableUidFromString(input: string): number {
  // FNV-1a 32-bit
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const uid = hash >>> 0;
  return uid === 0 ? 1 : uid;
}

export default function BroadcastPage() {
  const { id } = useParams<{ id: string }>();

  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  const _isGuest = !user;
  const [_fromExplore, _setFromExplore] = useState(location.state?.fromExplore);

  const [guestId] = useState(() => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `TC-${randomSuffix}`;
  });

  const effectiveUserId = user?.id || guestId;
  const guestUserObj = useMemo(() => (!user ? { id: guestId, username: guestId } : null), [user, guestId]);

  const seatPaidKey = id && effectiveUserId ? `seat_paid_${id}_${effectiveUserId}` : null;
  const [hasPaidSeat, setHasPaidSeat] = useState(false);
  const [muxPlaybackId, setMuxPlaybackId] = useState<string | null>(null);

  // B) On BroadcastPage — subscribe correctly + stop warning instantly when it arrives
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`stream-mux-id-check:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${id}` },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow?.mux_playback_id) {
            console.log('Got mux_playback_id from real-time update:', newRow.mux_playback_id);
            setMuxPlaybackId(newRow.mux_playback_id);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // C) Add a “hard fail” timer so it doesn’t wait forever
  useEffect(() => {
    if (muxPlaybackId) return;
    const t = setTimeout(() => {
      if (muxPlaybackId) return; // Re-check in case it arrived just in time
      console.error('Mux playback id still missing after 10s. Check mux-create + DB update/RLS.');
      // Optionally, you could show an error to the user here
      // toast.error("Could not load stream video. Please try again later.");
    }, 10000);
    return () => clearTimeout(t);
  }, [muxPlaybackId]);

  useEffect(() => {
    if (seatPaidKey) setHasPaidSeat(!!sessionStorage.getItem(seatPaidKey));
  }, [seatPaidKey]);

  const [_hostTimeLimit, setHostTimeLimit] = useState(3600000);

  const [stream, setStream] = useState<Stream | null>(null);
  const [broadcasterProfile, setBroadcasterProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showBattleManager, setShowBattleManager] = useState(false);
  const streamRef = useRef(stream);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const handleStartBattle = () => setShowBattleManager(true);

  const [_preflightStream, setPreflightStream] = useState<MediaStream | null>(null);
  const [agoraToken, setAgoraToken] = useState<string | null>(null);
  const [streamIntegrationLoading, setStreamIntegrationLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const rtcUid = useMemo(() => {
    if (!stream?.id || !effectiveUserId) return null;
    return stableUidFromString(`${stream.id}:${effectiveUserId}`);
  }, [stream?.id, effectiveUserId]);

  useEffect(() => {
    const s = PreflightStore.getStream();
    if (s) setPreflightStream(s);
  }, []);

  useStreamEndListener({
    streamId: id || '',
    enabled: !!id,
    redirectToSummary: true
  });

  const [isModerator, setIsModerator] = useState(false);
  const isHost = stream?.user_id === user?.id;

  useEffect(() => {
    const fetchMods = async () => {
      if (!stream?.user_id || !user?.id) return;

      if (isHost) {
        setIsModerator(true);
        return;
      }

      const { data } = await supabase
        .from('stream_moderators')
        .select('user_id')
        .eq('broadcaster_id', stream.user_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setIsModerator(true);
        return;
      }

      if (isStaffMember(profile)) {
        setIsModerator(true);
        return;
      }

      setIsModerator(false);
    };

    fetchMods();
  }, [stream?.user_id, user?.id, isHost, profile]);

  const { seats, mySession, joinSeat, leaveSeat, kickParticipant } = useStreamSeats(id, effectiveUserId, broadcasterProfile);

  const computedMode = (isHost || mySession?.status === 'active') ? 'stage' : 'viewer';

  /**
   * IMPORTANT: Seat status can briefly flicker during realtime updates.
   * This debounce prevents rapid mount/unmount of AgoraStage (which causes leave during join/publish).
   */
  const [mode, setMode] = useState<'stage' | 'viewer'>('viewer');
  useEffect(() => {
    if (computedMode === 'stage') {
      setMode('stage');
      return;
    }
    const t = setTimeout(() => setMode('viewer'), 800);
    return () => clearTimeout(t);
  }, [computedMode]);

  const canPublish = mode === 'stage';

  // ✅ Use env var so you don't ship "YOUR_AGORA_APP_ID"
  const appId: string = import.meta.env.VITE_AGORA_APP_ID || '';

  useEffect(() => {
    if (isHost && user) {
      supabase.rpc('get_stream_time_limit', { p_user_id: user.id }).then(({ data }) => {
        if (data) setHostTimeLimit(data);
      });
    }
  }, [isHost, user]);

  useEffect(() => {
    if (!stream?.started_at) return;

    const checkDuration = () => {
      const startedAt = new Date(stream.started_at!).getTime();
      const now = Date.now();
      const duration = now - startedAt;

      if (duration > _hostTimeLimit) {
        if (isHost) toast.error(`Broadcast time limit (${_hostTimeLimit / 3600000}h) reached.`);
      }
    };

    const interval = setInterval(checkDuration, 60000);
    checkDuration();

    return () => clearInterval(interval);
  }, [stream?.started_at, isHost, _hostTimeLimit]);

  const handleBoxCountUpdate = useCallback(
    async (newCount: number) => {
      const canEditBoxes = isHost || isStaffMember(profile);
      const currentStream = streamRef.current;
      if (!currentStream || !canEditBoxes) return;

      const maxTotalBoxes = 9;

      const requiredBoxes = Object.values(seats).filter((s: any) => s.status === 'active').length;

      if (newCount < requiredBoxes || newCount < 1 || newCount > maxTotalBoxes) {
        toast.warning(
          newCount < 1
            ? 'Cannot have less than 1 box.'
            : newCount > maxTotalBoxes
            ? `Maximum of ${maxTotalBoxes} boxes allowed.`
            : 'Cannot remove a box that is currently in use.'
        );
        return;
      }

      const oldStream = { ...currentStream };
      setStream(prev => (prev ? { ...prev, box_count: newCount } : null));

      const { error } = await supabase.rpc('set_stream_box_count', { p_stream_id: currentStream.id, p_new_box_count: newCount });

      if (error) {
        toast.error('Failed to update box count. Please try again.');
        setStream(oldStream);
        console.error('Failed to update box count:', error);
      }
    },
    [isHost, profile, seats, setStream]
  );

  /**
   * ✅ Stream integration: stable uid + stable mode dependency.
   * - uid never 0
   * - token regen only when stream.id/effectiveUserId/mode changes
   * - viewer mux playback id creation is persisted back to streams table
   */
  useEffect(() => {
    if (!stream?.id) return;

    let cancelled = false;

    const setupIntegration = async () => {
      setStreamIntegrationLoading(true);
      try {
        // Viewers only need Mux
        if (mode === 'viewer') {
          if (stream.mux_playback_id) {
            if (!cancelled) setMuxPlaybackId(stream.mux_playback_id);
          } else {
            // The mux_playback_id might not be available immediately.
            // The component is already subscribed to stream updates.
            // We'll just wait for it to appear. If it doesn't after a timeout, show an error.
            console.warn('Mux playback ID not found on initial load, waiting for real-time update...');
            const errorTimeout = setTimeout(() => {
              if (!cancelled) {
                toast.error('This stream is not configured for HLS playback. Timed out waiting for ID.');
                setMuxPlaybackId(null);
              }
            }, 15000); // 15 second timeout

            return () => clearTimeout(errorTimeout);
          }
          // Skip Agora for viewers
          if (!cancelled) setAgoraToken(null);
          return; 
        }

        // Broadcaster/speakers join Agora
        if (mode === 'stage') {
          const numericUid = stableUidFromString(`${stream.id}:${effectiveUserId}`);

          const res: any = await supabase.functions.invoke('agora-token', {
            body: { channel: stream.id, uid: numericUid, role: 'publisher' },
          });

          const tok = res?.data?.token || res?.token || null;
          if (!tok) throw new Error('Failed to get Agora token');
          if (!cancelled) setAgoraToken(tok);
        }

      } catch (e) {
        console.error('Failed to setup stream integration', e);
        toast.error(`Stream connection failed: ${e instanceof Error ? e.message : String(e)}`);
        if (!cancelled) {
          setAgoraToken(null);
          setMuxPlaybackId(null);
        }
      } finally {
        if (!cancelled) setStreamIntegrationLoading(false);
      }
    };

    setupIntegration();

    return () => {
      cancelled = true;
    };
  }, [stream?.id, mode, effectiveUserId]);

  const isStreamOffline = stream?.status === 'ended';
  const isStreamPending = stream?.status === 'pending';
  const { viewerCount } = useViewerTracking(id || '', isHost, guestUserObj);

  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchStream = async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 800));

      const { data, error } = await supabase
        .from('streams')
        .select('*, broadcaster:user_profiles!broadcaster_id(*)')
        .eq('id', id)
        .single();

      if (error || !data) {
        console.error('Error fetching stream:', error);
        toast.error('Stream not found');
        navigate('/');
        return;
      }

      if (isGovernmentStream(data)) {
        const userIsStaff = isStaffMember(profile);
        if (!userIsStaff) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
      }

      setStream(data);
      if ((data as any).broadcaster) setBroadcasterProfile((data as any).broadcaster);
      setLoading(false);

      if ((data as any).battle_id && (data as any).is_battle) {
        console.log('[BroadcastPage] Already in battle! Rendering BattleView in-place:', (data as any).battle_id);
      }
    };

    fetchStream();
  }, [id, navigate, profile]);

  useEffect(() => {
    if (!id) return;

    const streamChannel = supabase
      .channel(`stream-update-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${id}` }, (payload) => {
        const newStream = payload.new as Stream;
        setStream((prev) => (prev ? { ...prev, ...newStream } : newStream));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(streamChannel);
    };
  }, [id]);

  useEffect(() => {
    if (mySession?.status === 'kicked') {
      toast.error('You have been kicked from the stage.', {
        action: {
          label: 'File Lawsuit (2x Refund)',
          onClick: () => mySession?.id && fileLawsuit(mySession.id)
        },
        duration: 10000
      });
    }
  }, [mySession?.status, mySession?.id]);

  useEffect(() => {
    if (isHost || !id) return;

    if (mySession?.status === 'active') {
      const sessionKey = `seat_session_${id}`;
      const isExpected = sessionStorage.getItem(sessionKey);

      if (!isExpected) {
        leaveSeat();
      }
    }
  }, [mySession, isHost, id, leaveSeat]);

  const handleLeave = async () => {
    await leaveSeat();
    if (id) sessionStorage.removeItem(`seat_session_${id}`);
  };

  const fileLawsuit = async (sessionId: string) => {
    const { data, error } = await supabase.rpc('file_seat_lawsuit', { p_session_id: sessionId });
    if (error || !data?.success) {
      toast.error(data?.message || error?.message || 'Failed to file lawsuit');
    } else {
      toast.success('Lawsuit filed with Troll City Court!');
    }
  };

  const handleJoinRequest = async (seatIndex: number) => {
    if (!user) {
      navigate('/auth?mode=signup');
      return;
    }

    const maxGuests = 9; // Set a default max of 9 guests

    const occupiedSeats = Object.values(seats).filter((s: any) => s.status === 'active').length;
    if (occupiedSeats >= maxGuests) {
      toast.error(`Guest limit reached (Max ${maxGuests} guests).`);
      return;
    }

    let price = stream?.seat_price || 0;
    if (price > 0 && hasPaidSeat) price = 0;

    let success = false;

    if (price > 0) {
      if (confirm(`Join stage for ${price} Troll Coins?`)) {
        success = await joinSeat(seatIndex, price);
      }
    } else {
      success = await joinSeat(seatIndex, 0);
    }

    if (success && id) {
      sessionStorage.setItem(`seat_session_${id}`, 'true');

      if (seatPaidKey && (stream?.seat_price || 0) > 0) {
        sessionStorage.setItem(seatPaidKey, 'true');
        setHasPaidSeat(true);
      }
    }
  };

  // Show loader for initial fetch, or if the stream is preparing
  if (loading || isStreamPending) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white">
        <Loader2 className="animate-spin text-green-500" size={48} />
        {isStreamPending && <p className="mt-4 text-lg">Stream is preparing, please wait...</p>}
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-900 text-white p-4">
        <div className="text-red-500 text-6xl mb-4">🚫</div>
        <h2 className="text-2xl font-bold mb-2">Restricted Access</h2>
        <p className="text-zinc-400 text-center max-w-md">
          This is a government stream and is only accessible to staff members.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
        >
          Go Home
        </button>
      </div>
    );
  }

  if (!stream || isStreamOffline) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white">
        <h2 className="text-2xl font-bold mb-2">Stream Offline</h2>
        <p className="text-zinc-400">This broadcast has ended.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <GiftOverlay />
      <div className="h-screen w-full bg-black flex flex-col relative text-white font-sans">
        <BroadcastHeader
          stream={stream}
          liveViewerCount={viewerCount}
          broadcasterProfile={broadcasterProfile}
          isHost={isHost}
          onStartBattle={handleStartBattle}
          hideBattleButton={stream?.category === 'church'}
        />

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col h-full relative">
            <div className="w-full h-full relative">
              {streamIntegrationLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <Loader2 className="animate-spin text-green-500" size={32} />
                </div>
              ) : (
                <>
                  {stream?.category === 'church' ? (
                    mode === 'viewer' && muxPlaybackId ? (
                      <ChurchLayout isHost={false} broadcasterProfile={broadcasterProfile} stream={stream}>
                        <MuxViewer playbackId={muxPlaybackId} />
                      </ChurchLayout>
                    ) : (
                      appId && agoraToken && rtcUid && stream && (
                        <ChurchLayout isHost={isHost} broadcasterProfile={broadcasterProfile} stream={stream}>
                          <AgoraStage appId={appId} token={agoraToken} channel={stream.id} publish={canPublish} rtcUid={rtcUid} onPublishFail={handleLeave}>
                            <BroadcastGrid
                              stream={stream}
                              isHost={isHost}
                              isModerator={isModerator}
                              onGift={setGiftRecipientId}
                              onGiftAll={() => {}}
                              seats={seats}
                              onJoinSeat={handleJoinRequest}
                              onKick={kickParticipant}
                              broadcasterProfile={broadcasterProfile}
                              hideBroadcasterName={stream?.category === 'church'}
                              isChurch={stream?.category === 'church'}
                            />
                          </AgoraStage>
                        </ChurchLayout>
                      )
                    )
                  ) : (
                    mode === 'viewer' && muxPlaybackId ? (
                      <MuxViewer playbackId={muxPlaybackId} />
                    ) : (
                      appId && agoraToken && rtcUid && stream && (
                        <AgoraStage appId={appId} token={agoraToken} channel={stream.id} publish={canPublish} rtcUid={rtcUid}>
                          <BroadcastGrid
                            stream={stream}
                            isHost={isHost}
                            isModerator={isModerator}
                            onGift={setGiftRecipientId}
                            onGiftAll={() => {}}
                            seats={seats}
                            onJoinSeat={handleJoinRequest}
                            onKick={kickParticipant}
                            broadcasterProfile={broadcasterProfile}
                            hideBroadcasterName={stream?.category === 'church'}
                          />
                        </AgoraStage>
                      )
                    )
                  )}
                </>
              )}
            </div>

            <BroadcastEffectsLayer streamId={stream.id} />

            {stream.battle_id && stream.is_battle && (
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30">
                <BattleControlsList battleId={stream.battle_id} />
              </div>
            )}

            {showBattleManager && isHost && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col p-4 text-white">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Battle Manager</h2>
                  <button onClick={() => setShowBattleManager(false)} className="text-white">
                    X
                  </button>
                </div>
                <BattleControls currentStream={stream} />
              </div>
            )}
          </div>

          <BroadcastChat
            streamId={stream.id}
            hostId={stream.user_id}
            broadcasterId={stream.user_id}
            isHost={isHost}
            isModerator={isModerator}
            guestUser={guestUserObj}
          />
        </div>

        <BroadcastControls
          stream={stream}
          isHost={isHost}
          isModerator={isModerator}
          onShowBattleManager={() => setShowBattleManager(true)}
          mySession={mySession}
          onLeaveStage={handleLeave}
          isOnStage={mySession?.status === 'active'}
          chatOpen={chatOpen}
          toggleChat={() => setChatOpen(!chatOpen)}
          onGiftHost={() => setGiftRecipientId(stream.user_id)}
          onBoxCountUpdate={handleBoxCountUpdate}
        />

        {giftRecipientId && (
          <GiftTray
            streamId={stream.id}
            recipientId={giftRecipientId}
            onClose={() => setGiftRecipientId(null)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
