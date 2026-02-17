import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { LiveKitRoom, RoomAudioRenderer, StartAudio, useLocalParticipant, useParticipants, useRoomContext } from '@livekit/components-react';
import '@livekit/components-styles';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useLiveKitToken } from '../../hooks/useLiveKitToken';
import { useViewerTracking } from '../../hooks/useViewerTracking';
import { ListenerEntranceEffect } from '../../hooks/useListenerEntranceEffect';
import { PublishEntranceOnJoin } from '../../hooks/usePublishEntranceOnJoin';
import { ListenForEntrances } from '../../hooks/useListenForEntrances';
import { Stream } from '../../types/broadcast';
import BroadcastGrid from '../../components/broadcast/BroadcastGrid';
import BroadcastChat from '../../components/broadcast/BroadcastChat';
import BroadcastControls from '../../components/broadcast/BroadcastControls';
import GiftTray from '../../components/broadcast/GiftTray';
import StreamGiftStats from '../../components/broadcast/StreamGiftStats';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStreamSeats } from '../../hooks/useStreamSeats';
import { useStreamEndListener } from '../../hooks/useStreamEndListener';
import { coinOptimizer } from '../../lib/coinRotation';
import BattleView from '../../components/broadcast/BattleView';
import BattleControlsList from '../../components/broadcast/BattleControlsList';
import PreflightPublisher from '../../components/broadcast/PreflightPublisher';
import { PreflightStore } from '../../lib/preflightStore';

import BroadcastHeader from '../../components/broadcast/BroadcastHeader';
import BroadcastEffectsLayer from '../../components/broadcast/BroadcastEffectsLayer';
import ErrorBoundary from '../../components/ErrorBoundary';

// Helper component to sync Room state with Mode (force publish/unpublish)
const RoomStateSync = ({ mode, isHost, streamId }: { mode: 'stage' | 'viewer'; isHost: boolean; streamId: string }) => {
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    const lastModeRef = useRef(mode);
    
    // ✅ Fix D: Update status to 'live' after successful connection
    useEffect(() => {
        if (isHost && room.state === 'connected') {
            console.log('[RoomStateSync] Host connected, updating stream status to live...');
            supabase.from('streams')
                .update({ 
                    status: 'live', 
                    is_live: true,
                    // Ensure started_at is set if it wasn't
                })
                .eq('id', streamId)
                .then(({ error }) => {
                    if (error) console.error('[RoomStateSync] Failed to update stream status:', error);
                    else console.log('[RoomStateSync] Stream marked as live');
                });

            // TRAE FIX: Clear is_battle flag after a delay to ensure transition webhooks are ignored.
            // When returning from BattleView, we keep is_battle=true to prevent the webhook from ending the stream
            // due to the brief disconnection. We clear it here after the connection is stable.
            const timer = setTimeout(async () => {
                const { error } = await supabase.from('streams').update({ is_battle: false }).eq('id', streamId);
                if (!error) console.log('[RoomStateSync] Cleared battle mode flag');
            }, 15000); // 15 seconds safety window

            return () => clearTimeout(timer);
        }
    }, [isHost, room.state, streamId]);
    
    useEffect(() => {
        if (!localParticipant) return;

        const syncState = async () => {
            const isModeChange = lastModeRef.current !== mode;
            lastModeRef.current = mode;

            try {
                if (mode === 'stage') {
                    // Force enable media ONLY when joining stage (transitioning from viewer)
                    // This prevents re-enabling mic when user manually mutes (which triggers this effect)
                    if (isModeChange) {
                        // Ensure track is published if not already
                        for (const pub of localParticipant.trackPublications.values()) {
                            if (pub.kind === 'video' && pub.isMuted) {
                                await pub.unmute();
                            }
                            if (pub.kind === 'audio' && pub.isMuted) {
                                await pub.unmute();
                            }
                        }

                        // Enable camera with a small delay to ensure connection is ready
                        setTimeout(async () => {
                            if (!localParticipant.isCameraEnabled) {
                                console.log('[RoomStateSync] Joining stage: Enabling Camera');
                                try {
                                    await localParticipant.setCameraEnabled(true);
                                } catch (e) {
                                    console.warn('[RoomStateSync] Failed to enable camera (likely not connected yet):', e);
                                }
                            }
                        }, 500);

                        if (!localParticipant.isMicrophoneEnabled) {
                            console.log('[RoomStateSync] Joining stage: Enabling Mic');
                            try {
                                await localParticipant.setMicrophoneEnabled(true);
                            } catch (e) {
                                console.warn('[RoomStateSync] Failed to enable mic (likely not connected yet):', e);
                            }
                        }
                    }
                } else {
                    // We are a viewer. Force unpublish.
                    // STRICT RULE: Downgrade role and stop all streams
                    console.log('[RoomStateSync] Downgrading to viewer: Stopping all tracks');
                    
                    const tracks = localParticipant.trackPublications;
                    if (tracks) {
                        for (const pub of tracks.values()) {
                            if (pub.track) {
                                try {
                                    await localParticipant.unpublishTrack(pub.track);
                                } catch (e) {
                                    console.warn('[RoomStateSync] Error unpublishing track:', e);
                                }
                            }
                        }
                    }

                    if (localParticipant.isMicrophoneEnabled) {
                        await localParticipant.setMicrophoneEnabled(false);
                    }
                    if (localParticipant.isCameraEnabled) {
                        await localParticipant.setCameraEnabled(false);
                    }
                }
            } catch (error) {
                console.error('[RoomStateSync] Error syncing state:', error);
            }
        };

        syncState();
    }, [mode, localParticipant]);

    return null;
};

// Government stream categories that require staff access
const GOVERNMENT_CATEGORIES = ['government', 'courtroom', 'troll-court', 'senate', 'congress'];

/**
 * Helper function to check if stream is government-restricted
 */
function isGovernmentStream(stream: Stream | null): boolean {
  if (!stream) return false;
  const category = stream.category?.toLowerCase() || '';
  return GOVERNMENT_CATEGORIES.some(cat => category.includes(cat));
}

/**
 * Helper function to check if user is staff
 */
function isStaffMember(profile: ReturnType<typeof useAuthStore.getState>['profile']): boolean {
  if (!profile) return false;
  return Boolean(
    profile.is_admin ||
    profile.is_lead_officer ||
    profile.is_troll_officer ||
    profile.role === 'admin' ||
    profile.role === 'secretary' ||
    profile.role === 'troll_officer' ||
    profile.role === 'lead_troll_officer'
  );
}

// Helper component to enforce viewer limits
const BroadcastLimitEnforcer = ({ isHost, mode }: { isHost: boolean, mode: string }) => {
    const participants = useParticipants();
    const navigate = useNavigate();

    useEffect(() => {
        // If I am a host or on stage, limit doesn't apply
        if (isHost || mode === 'stage') return;

        // Filter for viewers (those who cannot publish)
        const viewers = participants.filter(p => !p.permissions?.canPublish);
        
        // Sort by join time
        const sortedViewers = [...viewers].sort((a, b) => {
            return (a.joinedAt?.getTime() || 0) - (b.joinedAt?.getTime() || 0);
        });

        const myParticipant = participants.find(p => p.isLocal);
        if (!myParticipant) return; 

        // Double check if I somehow have publish permissions
        if (myParticipant.permissions?.canPublish) return; 

        const myIndex = sortedViewers.findIndex(p => p.sid === myParticipant.sid);
        
        // If I am the 11th viewer (index 10) or later, I must leave
        if (myIndex !== -1 && myIndex >= 10) {
            toast.error("Room is full — next event starts soon.");
            navigate('/');
        }
    }, [participants, isHost, mode, navigate]);

    return null;
};

export default function BroadcastPage() {
  const { id } = useParams<{ id: string }>();
  
  // (Old ID Resolution removed - user wants to revert to direct ID)
  // const [resolvedId, setResolvedId] = useState<string | null>(null); 
  // ...

  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  
  const isGuest = !user;
  const [_fromExplore, _setFromExplore] = useState(location.state?.fromExplore);
  const [isPreviewExpired, setIsPreviewExpired] = useState(false);

  // Guest Preview Timer
  useEffect(() => {
    if (isGuest) {
      const timer = setTimeout(() => {
        setIsPreviewExpired(true);
        toast.info('Sign up to continue watching.');
      }, 60000); // 1 minute

      return () => clearTimeout(timer);
    }
  }, [isGuest]);

  // Guest Identity (Persistent for session)
  const [guestId] = useState(() => {
    // Generate TC-XXXX random username (not real names)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `TC-${randomSuffix}`;
  });
  const effectiveUserId = user?.id || guestId;
  const guestUserObj = useMemo(() => (!user ? { id: guestId, username: guestId } : null), [user, guestId]);

  const seatPaidKey = id && effectiveUserId ? `seat_paid_${id}_${effectiveUserId}` : null;
  const [hasPaidSeat, setHasPaidSeat] = useState(false);

  useEffect(() => {
    if (seatPaidKey) {
        setHasPaidSeat(!!sessionStorage.getItem(seatPaidKey));
    }
  }, [seatPaidKey]);

  const [_hostTimeLimit, setHostTimeLimit] = useState(3600000); // Default 1 hour

  const [stream, setStream] = useState<Stream | null>(null);
  const [broadcasterProfile, setBroadcasterProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showBattleManager, setShowBattleManager] = useState(false);
  const [_preflightStream, setPreflightStream] = useState<MediaStream | null>(null);
    const handleBoxCountUpdate = async (newCount: number) => {
    const canEditBoxes = isHost || isStaffMember(profile);
    if (!stream || !canEditBoxes) return;
        if (stream.stream_kind === 'trollmers' && newCount !== 1) {
            toast.error('Trollmers broadcasts are locked to 1 box');
            return;
        }

    const { data: eventData } = await supabase.rpc('get_active_event');
    const event = eventData?.[0];
    const maxTotalBoxes = event ? (event.max_guests_per_broadcast + 1) : 9;

    const requiredBoxes = Object.values(seats).filter(s => s.status === 'active').length;

    if (newCount < requiredBoxes || newCount < 1 || newCount > maxTotalBoxes) {
      toast.warning(
        newCount < 1
        ? "Cannot have less than 1 box."
        : newCount > maxTotalBoxes
        ? `Maximum of ${maxTotalBoxes} boxes allowed${event ? ' during this event' : ''}.`
        : "Cannot remove a box that is currently in use."
      );
      return;
    }

    // Optimistic UI update
    const oldStream = { ...stream };
    setStream({ ...stream, box_count: newCount });

    const { error } = await supabase.rpc('set_stream_box_count', { p_stream_id: stream.id, p_new_box_count: newCount });

    if (error) {
      toast.error("Failed to update box count. Please try again.");
      setStream(oldStream); // Rollback on failure
      console.error("Failed to update box count:", error);
    }
  };

  useEffect(() => {
      const stream = PreflightStore.getStream();
      if (stream) {
          console.log('[BroadcastPage] Found preflight stream');
          setPreflightStream(stream);
      }
  }, []);
  
  const [_isMobile, _setIsMobile] = useState(false);
  // Moved useStreamChat down to access mode
  
  // Stream End Listener
  useStreamEndListener({ 
      streamId: id || '',
      enabled: !!id,
      redirectToSummary: true
  });

  const [isModerator, setIsModerator] = useState(false);
  
  // Host Check
  const isHost = stream?.user_id === user?.id || stream?.broadcaster_id === user?.id;

  // Fetch Stream Mods
  useEffect(() => {
    const fetchMods = async () => {
        if (!stream?.user_id || !user?.id) return;
        
        // 1. Check if user is the host
        if (isHost) {
            setIsModerator(true);
            return;
        }

        // 2. Check per-stream moderators
        const { data, error: _error } = await supabase
          .from('stream_moderators')
          .select('user_id')
          .eq('broadcaster_id', stream.user_id)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (data) {
            setIsModerator(true);
            return;
        }

        // 3. Check global roles (Admin/Staff)
        if (isStaffMember(profile)) {
            setIsModerator(true);
            return;
        }

        setIsModerator(false);
    };
    
    fetchMods();
  }, [stream?.user_id, user?.id, isHost, profile]);
  
  // Seat System Hook
  const { seats, mySession, joinSeat, leaveSeat, kickParticipant } = useStreamSeats(id, effectiveUserId, broadcasterProfile);

  // Mode Determination
  // 'stage' = Active Participant (Host or Guest on Seat) -> Publishes Audio/Video
  // 'viewer' = Passive Viewer -> Subscribes only (Low Latency WebRTC)
  const mode = (isHost || (mySession?.status === 'active')) ? 'stage' : 'viewer';
  
  // Can publish only if on stage (Host or Active Seat)
  const canPublish = mode === 'stage';

    const [joinGateStatus, setJoinGateStatus] = useState<'idle' | 'checking' | 'allowed' | 'blocked'>('idle');
    const [joinBlockMessage, setJoinBlockMessage] = useState<string | null>(null);
    const joinGateStreamRef = useRef<string | null>(null);

    const EVENT_DURATION_MS = 90 * 60 * 1000;
    const [eventRemainingMs, setEventRemainingMs] = useState<number | null>(null);
    const [eventEnded, setEventEnded] = useState(false);
    const autoEndTriggeredRef = useRef(false);

    useEffect(() => {
        setEventEnded(false);
        setEventRemainingMs(null);
        autoEndTriggeredRef.current = false;
        setJoinGateStatus('idle');
        setJoinBlockMessage(null);
        joinGateStreamRef.current = null;
    }, [stream?.id]);

  // Guest Timer & Tracking - HANDLED ABOVE
  
  // Host Limit Check (Server-side Override)
  useEffect(() => {
      if (isHost && user) {
          supabase.rpc('get_stream_time_limit', { p_user_id: user.id })
              .then(({ data }) => {
                  if (data) setHostTimeLimit(data);
              });
      }
  }, [isHost, user]);

    useEffect(() => {
        if (!stream?.id) return;

        if (isHost || mode === 'stage') {
            setJoinGateStatus('allowed');
            setJoinBlockMessage(null);
            joinGateStreamRef.current = null;
            return;
        }

        const gateKey = `${stream.id}:${mode}`;
        if (joinGateStreamRef.current === gateKey) return;

        joinGateStreamRef.current = gateKey;
        setJoinGateStatus('checking');
        setJoinBlockMessage(null);

        supabase
            .rpc('reserve_stream_viewer_slot', { p_stream_id: stream.id })
            .then(({ data, error }) => {
                if (error || !data?.success) {
                    const reason = data?.reason || 'room_full';
                    if (reason === 'global_limit') {
                        setJoinBlockMessage('System is at capacity — try again shortly.');
                    } else if (reason === 'stream_ended') {
                        setJoinBlockMessage('Event ended');
                    } else {
                        setJoinBlockMessage('Room is full — next event starts soon.');
                    }
                    setJoinGateStatus('blocked');
                    return;
                }

                setJoinGateStatus('allowed');
                setJoinBlockMessage(null);
            });
    }, [stream?.id, isHost, mode]);

  // 1. Duration Limit Check (Dynamic)
  useEffect(() => {
    if (!stream?.started_at) return;

    const checkDuration = () => {
      const startedAt = new Date(stream.started_at!).getTime();
      const now = Date.now();
      const duration = now - startedAt;
      
      // Use hostTimeLimit instead of hardcoded 1 hour
      if (duration > _hostTimeLimit) {
        if (isHost) {
             toast.error(`Broadcast time limit (${_hostTimeLimit / 3600000}h) reached.`);
        }
      }
    };

    const interval = setInterval(checkDuration, 60000); // Check every minute
    checkDuration(); 

    return () => clearInterval(interval);
  }, [stream?.started_at, isHost, _hostTimeLimit]);

    useEffect(() => {
        if (!stream?.started_at) return;

        const startedAt = new Date(stream.started_at).getTime();
        const updateTimer = () => {
            const elapsed = Date.now() - startedAt;
            const remaining = Math.max(0, EVENT_DURATION_MS - elapsed);
            setEventRemainingMs(remaining);
            if (remaining <= 0) {
                setEventEnded(true);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [stream?.started_at, EVENT_DURATION_MS]);

    useEffect(() => {
        if (!eventEnded || !stream?.id || autoEndTriggeredRef.current) return;

        autoEndTriggeredRef.current = true;
        const endStream = async () => {
            try {
                const { error } = await supabase.rpc('end_stream', { p_stream_id: stream.id });
                if (error) throw error;
            } catch {
                const { error } = await supabase
                    .from('streams')
                    .update({
                        status: 'ended',
                        is_live: false,
                        ended_at: new Date().toISOString(),
                        is_force_ended: true
                    })
                    .eq('id', stream.id);

                if (error) {
                    console.error('[BroadcastPage] Failed to auto-end stream:', error);
                }
            }
        };

        endStream();
    }, [eventEnded, stream?.id]);

        const liveKitRoomName = stream?.room_name || id;
        const tokenEnabled = !!stream && !eventEnded && joinGateStatus === 'allowed';
        const { token, serverUrl, error: tokenError } = useLiveKitToken({
        streamId: id,
        isHost,
        userId: effectiveUserId,
                roomName: liveKitRoomName,
        // Only request publish permissions if on stage (Host or Active Seat)
        canPublish,
        enabled: tokenEnabled,
        isGuest
    });

  useEffect(() => {
    if (tokenError) {
        console.error('[BroadcastPage] Token Error:', tokenError);
        toast.error(`Connection Error: ${tokenError}`);
    }
  }, [tokenError]);

  useEffect(() => {
      if (stream && user) {
          console.log('[BroadcastPage] Host Check:', {
              isHost,
              streamUserId: stream.user_id,
              userId: user.id,
              mode,
              hasPreflight: !!_preflightStream
          });
      }
  }, [stream, user, isHost, mode, _preflightStream]);

    const isStreamOffline = stream?.status === 'ended' || stream?.is_force_ended || eventEnded;

  useEffect(() => {
      if (token) {
          try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              console.log('[BroadcastPage] Token Payload:', payload);
              if (payload.video) {
                  console.log('[BroadcastPage] Token has video permission:', payload.video);
              }
          } catch (e) {
              console.error('[BroadcastPage] Failed to decode token:', e);
          }
      }
  }, [token]);

    // Viewer Tracking
    const trackingEnabled = joinGateStatus === 'allowed' || isHost || mode === 'stage';
    const { viewerCount } = useViewerTracking(id || '', isHost, guestUserObj, trackingEnabled);

  // Gift Tray State
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);

  // Fetch Stream & Subscribe to Updates
  useEffect(() => {
    if (!id) return;
    
    let mounted = true;

    const fetchStream = async () => {
      // Thundering Herd Prevention: Jitter on fetch (0-800ms)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 800));
      
      const { data, error } = await supabase
        .from('streams')
        .select('*, broadcaster:user_profiles!broadcaster_id(*)')
        .eq('id', id)
        .single();
      
      if (!mounted) return;

      if (error || !data) {
        console.error('Error fetching stream:', error);
        toast.error('Stream not found');
        navigate('/');
        return;
      }

      // 🏛️ Check if this is a government stream and user is not staff
      if (isGovernmentStream(data)) {
        const userIsStaff = isStaffMember(profile);
        
        if (!userIsStaff) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
      }

      setStream(data);
      if (data.broadcaster) {
        setBroadcasterProfile(data.broadcaster);
      }
      setLoading(false);

      // 🚀 Initial Battle Check
      if (data.battle_id && data.is_battle) {
          console.log('[BroadcastPage] Already in battle! Rendering BattleView in-place:', data.battle_id);
      }
    };

    fetchStream();

    // 🚀 Consolidated Broadcast Channel (Scalability: 1 channel instead of 3+)
    const roomChannel = supabase.channel(`broadcast_room_${id}`)
        // 1. Stream Updates (Box Count, Settings, etc.)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'streams',
                filter: `id=eq.${id}`
            },
            (payload) => {
                const newStream = payload.new as Stream;
                setStream(prev => prev ? { ...prev, ...newStream } : newStream);
            }
        )
        // 2. Broadcaster Profile Updates (Coin Balance)
        .on(
            'postgres_changes', 
            { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'user_profiles', 
                filter: stream?.user_id ? `id=eq.${stream.user_id}` : undefined 
            }, 
            (payload) => {
                if (stream?.user_id) {
                    setBroadcasterProfile((prev: any) => prev ? { ...prev, ...payload.new } : payload.new);
                }
            }
        )
        // 3. Gift Events (Optimistic Balance)
        .on(
            'broadcast',
            { event: 'gift_sent' },
            (payload) => {
                if (!isHost || !user) return;
                const { receiver_id, gift_price } = payload.payload;
                if (receiver_id === user.id && gift_price) {
                    const currentProfile = useAuthStore.getState().profile;
                    if (currentProfile) {
                        coinOptimizer.updateOptimisticBalance(user.id, {
                            troll_coins: (currentProfile.troll_coins || 0) + gift_price
                        });
                    }
                }
            }
        )
        .subscribe();

    // Polling fallback to ensure viewers receive box count updates
    const pollInterval = setInterval(() => {
      fetchStream();
    }, 5000);

    return () => {
        mounted = false;
        supabase.removeChannel(roomChannel);
        clearInterval(pollInterval);
    };
  }, [id, navigate, profile, isHost, user, stream?.user_id]);

  // Remove the old broadcaster profile and host balance effects as they are now consolidated
  /* 
  useEffect(() => { ... broadcaster_update ... });
  useEffect(() => { ... stream_events ... host_balance ... });
  */

  // Handle Kick / Lawsuit
  useEffect(() => {
      if (mySession?.status === 'kicked') {
          toast.error("You have been kicked from the stage.", {
              action: {
                  label: "File Lawsuit (2x Refund)",
                  onClick: () => fileLawsuit(mySession.id)
              },
              duration: 10000 // Show for 10s (Grace Period is 10s too)
          });
      }
  }, [mySession?.status, mySession?.id]);

  // Cleanup Stale Sessions (If user closed tab and came back)
  useEffect(() => {
    if (isHost || !id) return;
    
    if (mySession?.status === 'active') {
        const sessionKey = `seat_session_${id}`;
        const isExpected = sessionStorage.getItem(sessionKey);
        
        if (!isExpected) {
            console.log('[BroadcastPage] Found stale session, leaving seat...');
            leaveSeat();
            // Don't show toast here to be less intrusive, or show a subtle one
        }
    }
  }, [mySession, isHost, id, leaveSeat]);

  const handleLeave = async () => {
      await leaveSeat();
      if (id) sessionStorage.removeItem(`seat_session_${id}`);
  };

  const fileLawsuit = async (sessionId: string) => {
      const { data, error } = await supabase.rpc('file_seat_lawsuit', { p_session_id: sessionId });
      if (error || !data.success) {
          toast.error(data?.message || error?.message || "Failed to file lawsuit");
      } else {
          toast.success("Lawsuit filed with Troll City Court!");
      }
  };

  const handleJoinRequest = async (seatIndex: number) => {
      // Block manual seat joining for Trollmers (head-to-head via matchmaking only)
      if (stream?.stream_kind === 'trollmers') {
          toast.error('Trollmers battles are head-to-head via matchmaking only. Use "Find Random Match" to challenge!');
          return;
      }
      
      if (!user) {
          navigate('/auth?mode=signup');
          return;
      }
      // Guest Limit Check (Max 2 Guests during event, else 3)
      const { data: eventData } = await supabase.rpc('get_active_event');
      const event = eventData?.[0];
      const maxGuests = event ? event.max_guests_per_broadcast : 3;

      const occupiedSeats = Object.values(seats).filter(s => s.status === 'active').length;
      if (occupiedSeats >= maxGuests) {
          toast.error(`Guest limit reached (Max ${maxGuests} guests).`);
          return;
      }
      
      let price = stream?.seat_price || 0;
      if (price > 0 && hasPaidSeat) {
          price = 0;
      }
      let success = false;

      if (price > 0) {
           // We could add a custom modal here, but confirm is fine for MVP
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

  if (loading) {
      return (
          <div className="h-screen w-full flex items-center justify-center bg-black text-white">
              <Loader2 className="animate-spin text-green-500" size={48} />
          </div>
      );
  }

  // 🏛️ Access Denied for Non-Staff on Government Streams
  if (accessDenied) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-900 text-white p-4">
              <div className="text-red-500 text-6xl mb-4">🔒</div>
              <h2 className="text-2xl font-bold mb-2">Restricted Access</h2>
              <p className="text-zinc-400 text-center max-w-md">
                  This is a government stream and is only accessible to staff members.
              </p>
              <button 
                  onClick={() => navigate('/')}
                  className="mt-6 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                  Return Home
              </button>
          </div>
      );
  }

  if (!stream) {
      const isUsername = !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white">
            <h2 className="text-2xl font-bold mb-2">
                {isUsername ? `${id} is offline` : 'Stream not found'}
            </h2>
            <button 
                onClick={() => navigate('/')}
                className="mt-4 px-6 py-2 bg-zinc-800 rounded hover:bg-zinc-700"
            >
                Back to Home
            </button>
          </div>
      );
  }

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        toast.success('Broadcast link copied!');
    }).catch(() => {
        toast.error('Failed to copy link');
    });
  };

  // 4. Battle Mode Transition
  // If the stream is in a battle, render the BattleView immediately.
  // This solves the "Battle system hangs" issue by ensuring we switch views when battle_id is present.
  if (stream.battle_id) {
      return <BattleView battleId={stream.battle_id} currentStreamId={id || ''} viewerId={effectiveUserId} />;
  }

  // Viewer Limit Check
  if (mode === 'viewer' && !isHost && (stream.viewer_count || 0) >= 10) {
      return (
          <div className="h-screen w-full flex items-center justify-center bg-zinc-900 text-white">
              <div className="text-center p-6 bg-zinc-800 rounded-xl border border-zinc-700">
                  <h3 className="text-xl font-bold mb-2 text-red-400">Broadcast Full</h3>
                  <p className="text-zinc-400 mb-4">This broadcast has reached the maximum number of viewers (10).</p>
                  <button 
                    onClick={() => navigate('/')} 
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold transition-colors"
                  >
                    Back to Home
                  </button>
              </div>
          </div>
      );
  }

  // Force desktop layout (responsive) for all users to ensure consistent experience
  // The "Mobile Version" was hiding too much context.
  /*
  if (_isMobile) {
      if (isStreamOffline) {
          return (
             <div className="h-screen w-full flex items-center justify-center bg-zinc-900 text-white">
                 <div className="text-center">
                     <h3 className="text-xl font-bold mb-2">Event ended</h3>
                     <p className="text-zinc-400">This broadcast has finished.</p>
                 </div>
             </div>
          );
      }
      // ... Mobile layout logic commented out to force unified responsive layout
  }
  */

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-black text-white overflow-hidden font-sans">
        
        {/* Main Stage / Video Area */}
        <div 
            className="flex-1 relative flex flex-col bg-zinc-900 bg-cover bg-center bg-no-repeat transition-all duration-500"
            style={{ 
                backgroundImage: stream?.active_theme_url ? `url(${stream.active_theme_url})` : undefined 
            }}
        >
            
            {isStreamOffline ? (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-white z-0">
                        <div className="text-center">
                            <h3 className="text-xl font-bold mb-2">Event ended</h3>
                            <p className="text-zinc-400">This broadcast has finished.</p>
                        </div>
                    </div>
            ) : (joinGateStatus === 'blocked' && joinBlockMessage) ? (
                <div className="flex-1 flex items-center justify-center flex-col gap-4 text-center">
                    <div className="text-red-400 font-bold text-lg">{joinBlockMessage}</div>
                    <div className="text-zinc-500 text-sm max-w-md">
                        Live attendance is capped for this launch event.
                    </div>
                </div>
            ) : (!token || !serverUrl) ? (
                <div className="flex-1 flex items-center justify-center flex-col gap-4">
                    {tokenError ? (
                        <>
                            <div className="text-red-500 font-bold">Connection Failed</div>
                            <div className="text-zinc-400 max-w-md text-center">{tokenError}</div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin text-green-500" size={48} />
                            <div className="text-zinc-500 text-sm animate-pulse">
                                {!stream ? 'Loading stream info...' :
                                 !user ? 'Identifying user...' :
                                 !token ? (joinGateStatus === 'checking' ? 'Checking room capacity...' : (mode === 'stage' && !isHost ? 'Joining seat...' : 'Requesting LiveKit token...')) :
                                 !serverUrl ? 'Connecting to server...' :
                                 'Initializing studio...'}
                            </div>
                            <div className="text-xs text-zinc-700 font-mono">
                                ID: {id} | U: {user?.id?.slice(0,6)} | T: {!!token}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <LiveKitRoom
                    token={token}
                    serverUrl={serverUrl}
                    connect={true}
                    video={mode === 'stage'}
                    audio={mode === 'stage'}
                className="flex-1 relative flex flex-col"
            >
                {isPreviewExpired && (
                  <div className="absolute inset-0 bg-black/75 z-50 flex items-center justify-center">
                    <div className="text-center text-white">
                      <h2 className="text-2xl font-bold">Preview Ended</h2>
                      <p className="text-lg">Sign up to continue watching.</p>
                      <button onClick={() => navigate('/auth')} className="mt-4 px-4 py-2 bg-green-500 rounded">
                        Sign Up
                      </button>
                    </div>
                  </div>
                )}
                <RoomStateSync mode={mode} isHost={isHost} streamId={id || ''} />
                <BroadcastLimitEnforcer 
                    isHost={isHost} 
                    mode={mode} 
                />
                <ListenerEntranceEffect
                    streamId={id || ''}
                    isHost={isHost}
                    isGuest={isGuest && !mySession}
                    canPublish={canPublish}
                    userId={effectiveUserId}
                    username={profile?.username}
                />
                
                {/* Broadcast-wide entrance effects - publish and listen */}
                <PublishEntranceOnJoin
                    streamId={id || ''}
                    userId={effectiveUserId}
                    username={profile?.username || effectiveUserId}
                />
                <ListenForEntrances
                    streamId={id || ''}
                    localUserId={effectiveUserId}
                />
                    
                    {_preflightStream && (
                        <PreflightPublisher 
                            stream={_preflightStream} 
                            onPublished={() => PreflightStore.clear()} 
                        />
                    )}
                    <div className="flex-shrink-0">
                        <BroadcastHeader 
                            stream={stream} 
                            isHost={isHost} 
                            onStartBattle={() => setShowBattleManager(true)} 
                            liveViewerCount={viewerCount}
                            eventRemainingMs={eventRemainingMs}
                            eventEnded={eventEnded}
                        />
                    </div>
                    {/* <VideoViewer />  -- Removed to fix layout duplication with BroadcastGrid */}
                    <BroadcastEffectsLayer streamId={stream.id} />
                    <ErrorBoundary>
                        <div className="flex-1 relative min-h-0">
                            <BroadcastGrid
                                stream={stream}
                                isHost={isHost}
                                mode="stage" // Always render as stage (WebRTC)
                                seats={seats}
                                onGift={(uid) => setGiftRecipientId(uid)}
                                onGiftAll={() => setGiftRecipientId('ALL')}
                                onJoinSeat={handleJoinRequest} 
                                onKick={kickParticipant}
                                broadcasterProfile={isHost ? profile : broadcasterProfile}
                                seatPriceOverride={hasPaidSeat ? 0 : stream.seat_price}
                            />
                        </div>
                    </ErrorBoundary>
                    
                    {/* Controls Overlay - Visible to everyone (with different options) */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center z-50 pointer-events-none">
                        <div className="pointer-events-auto">
                            <BroadcastControls 
                                stream={stream}
                                isHost={isHost}
                                isModerator={isModerator}
                                isOnStage={mode === 'stage'}
                                chatOpen={true}
                                toggleChat={() => {}}
                                onGiftHost={() => setGiftRecipientId(stream.user_id)}
                                onLeave={mode === 'stage' && !isHost ? handleLeave : undefined}
                                onShare={handleShare}
                                requiredBoxes={Object.values(seats).filter(s => s.status === 'active').length}
                                onBoxCountUpdate={handleBoxCountUpdate}
                                liveViewerCount={viewerCount}
                            />
                        </div>
                    </div>
                    
                    <RoomAudioRenderer />
                    <StartAudio label="Click to allow audio" />
                </LiveKitRoom>
            )}
            
            {/* Battle Manager Modal (Desktop) */}
            {showBattleManager && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 shadow-2xl w-full max-w-lg relative">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-white text-lg">Challenge Streamers</h3>
                            <button onClick={() => setShowBattleManager(false)} className="text-sm text-zinc-400 hover:text-white">Close</button>
                        </div>
                        <BattleControlsList currentStream={stream} />
                    </div>
                </div>
            )}
            
            {/* Gift Tray (Global) */}
            {giftRecipientId && (
                <div className="absolute bottom-0 left-0 right-0 z-50">
                    <GiftTray 
                        recipientId={giftRecipientId}
                        streamId={stream.id}
                        onClose={() => setGiftRecipientId(null)}
                    />
                </div>
            )}
        </div>

        {/* Sidebar: Chat & Leaderboard */}
        <div className="w-full md:w-96 h-[50vh] md:h-auto flex flex-col border-t md:border-t-0 md:border-l border-white/10 bg-zinc-950/90 backdrop-blur-md z-40">
            <StreamGiftStats streamId={stream.id} />
            <div className="flex-1 min-h-0">
                <ErrorBoundary fallback={
                    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                        <p className="text-red-400 font-bold mb-2">Chat Crashed</p>
                        <p className="text-xs text-zinc-400 mb-4">You can still end the stream.</p>
                        <button 
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700 text-xs transition-colors"
                        >
                            Reload Page
                        </button>
                    </div>
                }>
                    <BroadcastChat 
                        streamId={stream.id} 
                        hostId={stream.user_id}
                        isHost={isHost} 
                        isViewer={mode === 'viewer'}
                        isModerator={isModerator}
                        isGuest={!user}
                    />
                </ErrorBoundary>
            </div>
        </div>

    </div>
  );
}