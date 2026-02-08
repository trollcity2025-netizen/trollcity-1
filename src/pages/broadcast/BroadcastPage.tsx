import React, { useEffect, useState, useRef } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { LiveKitRoom, RoomAudioRenderer, StartAudio, useLocalParticipant, useParticipants, useRoomContext } from '@livekit/components-react';
import '@livekit/components-styles';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useLiveKitToken } from '../../hooks/useLiveKitToken';
import { useViewerTracking } from '../../hooks/useViewerTracking';
import { Stream, ChatMessage } from '../../types/broadcast';
import BroadcastGrid from '../../components/broadcast/BroadcastGrid';
import BroadcastChat from '../../components/broadcast/BroadcastChat';
import BroadcastControls from '../../components/broadcast/BroadcastControls';
import GiftTray from '../../components/broadcast/GiftTray';
import MobileBroadcastLayout from '../../components/broadcast/MobileBroadcastLayout';
import { useMobileBreakpoint } from '../../hooks/useMobileBreakpoint';
import { useStreamChat } from '../../hooks/useStreamChat';
import { Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useStreamSeats, SeatSession } from '../../hooks/useStreamSeats';
import { useStreamEndListener } from '../../hooks/useStreamEndListener';
import HLSPlayer from '../../components/broadcast/HLSPlayer';
import BattleView from '../../components/broadcast/BattleView';
import BattleControlsList from '../../components/broadcast/BattleControlsList';
import PreflightPublisher from '../../components/broadcast/PreflightPublisher';
import { PreflightStore } from '../../lib/preflightStore';
import { MobileErrorLogger } from '../../lib/MobileErrorLogger';

import BroadcastHeader from '../../components/broadcast/BroadcastHeader';
import BroadcastEffectsLayer from '../../components/broadcast/BroadcastEffectsLayer';
import ErrorBoundary from '../../components/ErrorBoundary';

// Helper component to sync Room state with Mode (force publish/unpublish)
const RoomStateSync = ({ mode, isHost, streamId }: { mode: 'stage' | 'viewer'; isHost: boolean; streamId: string }) => {
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    
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
        }
    }, [isHost, room.state, streamId]);
    
    useEffect(() => {
        if (!localParticipant) return;

        const syncState = async () => {
            try {
                if (mode === 'stage') {
                    // Force enable media when joining stage to ensure visibility
                    // This fixes the "invisible guest" issue where tracks might not start automatically
                    
                    // Ensure track is published if not already
                    const tracks = localParticipant.tracks;
                    if (tracks) {
                        for (const pub of tracks.values()) {
                            if (pub.track?.kind === 'video' && pub.isMuted) {
                                await pub.track.unmute();
                            }
                            if (pub.track?.kind === 'audio' && pub.isMuted) {
                                await pub.track.unmute();
                            }
                        }
                    }

                    if (!localParticipant.isCameraEnabled) {
                        console.log('[RoomStateSync] Joining stage: Enabling Camera');
                        try {
                            await localParticipant.setCameraEnabled(true);
                        } catch (e) {
                            console.warn('[RoomStateSync] Failed to enable camera (likely not connected yet):', e);
                        }
                    }
                    if (!localParticipant.isMicrophoneEnabled) {
                        console.log('[RoomStateSync] Joining stage: Enabling Mic');
                        try {
                            await localParticipant.setMicrophoneEnabled(true);
                        } catch (e) {
                            console.warn('[RoomStateSync] Failed to enable mic (likely not connected yet):', e);
                        }
                    }
                } else {
                    // We are a viewer. Force unpublish.
                    // STRICT RULE: Downgrade role and stop all streams
                    console.log('[RoomStateSync] Downgrading to viewer: Stopping all tracks');
                    
                    const tracks = localParticipant.tracks;
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

// Guest Limit Overlay Component
const GuestLimitOverlay = () => (
    <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center flex-col p-6 text-center animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <Loader2 className="w-8 h-8 text-red-500 animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Preview Ended</h2>
        <p className="text-zinc-400 mb-6 max-w-md">
            Your 1-minute free preview has expired. Sign up or log in to continue watching and join the chat!
        </p>
        <div className="flex gap-4">
            <Link 
                to="/login" 
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
            >
                Log In
            </Link>
            <Link 
                to="/signup" 
                className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors border border-white/10"
            >
                Sign Up
            </Link>
        </div>
    </div>
);

// Guest Preview Banner
const GuestPreviewBanner = ({ timeLeft }: { timeLeft: number }) => {
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[50] bg-red-600/90 backdrop-blur text-white px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2 animate-in slide-in-from-top-4">
            <Clock className="w-4 h-4 animate-pulse" />
            <span>Guest Preview: {formatTime(timeLeft)} — Sign up to keep watching</span>
        </div>
    );
};

// Government stream categories that require staff access
const GOVERNMENT_CATEGORIES = ['government', 'courtroom', 'troll-court', 'senate', 'congress'];

// Helper function to check if stream is government-restricted
export function isGovernmentStream(stream: Stream | null): boolean {
  if (!stream) return false;
  const category = stream.category?.toLowerCase() || '';
  return GOVERNMENT_CATEGORIES.some(cat => category.includes(cat));
}

// Helper function to check if user is staff
export function isStaffMember(profile: ReturnType<typeof useAuthStore.getState>['profile']): boolean {
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

// Helper component to access LiveKit context for Mobile Stage
const MobileStageInner = ({ 
    stream, isHost, seats, messages, onSendMessage, onLeave, onJoinSeat, onStartBattle, children, hostGlowingColor, liveViewerCount
}: {
    stream: Stream;
    isHost: boolean;
    seats: Record<number, SeatSession>;
    messages: ChatMessage[];
    onSendMessage: (t: string) => void;
    onLeave: () => void;
    onJoinSeat: (i: number) => void;
    onStartBattle: () => void;
    children: React.ReactNode;
    hostGlowingColor?: string;
    liveViewerCount?: number;
}) => {
    const { localParticipant } = useLocalParticipant();
    
    return (
        <MobileBroadcastLayout
            stream={stream}
            isHost={isHost}
            messages={messages}
            seats={seats}
            onSendMessage={onSendMessage}
            onToggleMic={() => localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled)}
            onToggleCamera={() => localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled)}
            onFlipCamera={() => {}} // Not easily supported in web yet without custom track manipulation
            onLeave={onLeave}
            onJoinSeat={onJoinSeat}
            hostGlowingColor={hostGlowingColor}
        >
            <BroadcastHeader stream={stream} isHost={isHost} onStartBattle={onStartBattle} liveViewerCount={liveViewerCount} />
            {children}
            <RoomAudioRenderer />
            <StartAudio label="Click to allow audio" />
        </MobileBroadcastLayout>
    );
};

// Helper component to enforce viewer limits
const BroadcastLimitEnforcer = ({ isHost, mode, isStaff }: { isHost: boolean, mode: string, isStaff: boolean }) => {
    const participants = useParticipants();
    const navigate = useNavigate();

    useEffect(() => {
        // If I am a host, on stage, OR STAFF, limit doesn't apply
        if (isHost || mode === 'stage' || isStaff) return;

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
            toast.error("Viewer limit (10) reached.");
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
  const fromExplore = location.state?.fromExplore;

  // Guest Identity (Persistent for session)
  const [guestId] = useState(() => {
    // Generate TC-XXXX random username (not real names)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `TC-${randomSuffix}`;
  });
  const effectiveUserId = user?.id || guestId;
  const guestUserObj = React.useMemo(() => (!user ? { id: guestId, username: guestId } : null), [user, guestId]);

  const [guestTimeLeft, setGuestTimeLeft] = useState<number | null>(null);
  const [hostTimeLimit, setHostTimeLimit] = useState(3600000); // Default 1 hour

  // Guest Entry Protection & Timer
  useEffect(() => {
    if (isGuest && id) {
        const key = `guest_preview_${id}`;
        const startStr = localStorage.getItem(key);
        const sessionActive = sessionStorage.getItem(`guest_session_${id}`);
        
        // 1. Strict Entry Check
        // Allow if: From Explore OR Already in active session (refresh) OR Already used preview (will show expired)
        // RELAXED: Allow direct entry for guests (deep linking support)
        /* 
        if (!fromExplore && !sessionActive && !startStr) {
             toast.error("Please discover streams via the Explore Feed");
             navigate('/explore');
             return;
        }
        */

        // Mark session active
        sessionStorage.setItem(`guest_session_${id}`, 'true');

        // 2. Timer Logic
        const now = Date.now();
        let remaining = 60;

        if (startStr) {
            const elapsed = (now - parseInt(startStr, 10)) / 1000;
            remaining = Math.max(0, 60 - elapsed);
        } else {
            // New preview
            localStorage.setItem(key, now.toString());
            // Track Guest
            // supabase.functions.invoke('track-guest', { ... }); 
            // (Note: Tracking is now done in api/livekit-guest-token)
        }
        
        setGuestTimeLeft(remaining);

        if (remaining > 0) {
            const timer = setInterval(() => {
                setGuestTimeLeft(prev => {
                    if (prev === null) return 60;
                    const next = prev - 1;
                    
                    // Warning at 10s
                    if (next === 10) {
                        toast.warning("Create an account to keep watching", { duration: 5000 });
                    }

                    // Expired
                    if (next <= 0) {
                        clearInterval(timer);
                        // Redirect Logic removed - Show Overlay instead
                        // navigate(`/?signup=true&next=/watch/${id}`);
                        return 0;
                    }
                    return next;
                });
            }, 1000);
            return () => clearInterval(timer);
        } else {
             // Already expired on load
             // navigate(`/?signup=true&next=/watch/${id}`);
        }
    }
  }, [isGuest, id, fromExplore, navigate]);

  const [stream, setStream] = useState<Stream | null>(null);
  const [broadcasterProfile, setBroadcasterProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showBattleManager, setShowBattleManager] = useState(false);
  const [preflightStream, setPreflightStream] = useState<MediaStream | null>(null);

  useEffect(() => {
      const stream = PreflightStore.getStream();
      if (stream) {
          console.log('[BroadcastPage] Found preflight stream');
          setPreflightStream(stream);
      }
  }, []);
  
  const { isMobile } = useMobileBreakpoint();
  // Moved useStreamChat down to access mode
  
  // Stream End Listener
  useStreamEndListener({ 
      streamId: id || '',
      enabled: !!id,
      redirectToSummary: true
  });

  // Host Check
  const isHost = stream?.user_id === user?.id;
  
  // Seat System Hook
  const { seats, mySession, joinSeat, leaveSeat, kickParticipant } = useStreamSeats(id, effectiveUserId, broadcasterProfile);

  // Mode Determination
  // 'stage' = Active Participant (Host or Guest on Seat) -> Publishes Audio/Video
  // 'viewer' = Passive Viewer -> Subscribes only (Low Latency WebRTC)
  const mode = (isHost || (mySession?.status === 'active')) ? 'stage' : 'viewer';
  
  const { messages, sendMessage } = useStreamChat(id || '', mode === 'viewer');

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

  // 1. Duration Limit Check (Dynamic)
  useEffect(() => {
    if (!stream?.started_at) return;

    const checkDuration = () => {
      const startedAt = new Date(stream.started_at!).getTime();
      const now = Date.now();
      const duration = now - startedAt;
      
      // Use hostTimeLimit instead of hardcoded 1 hour
      if (duration > hostTimeLimit) {
        if (isHost) {
             toast.error(`Broadcast time limit (${hostTimeLimit / 3600000}h) reached.`);
        }
      }
    };

    const interval = setInterval(checkDuration, 60000); // Check every minute
    checkDuration(); 

    return () => clearInterval(interval);
  }, [stream?.started_at, isHost, hostTimeLimit]);

  const { token, serverUrl, error: tokenError, isLoading: tokenLoading } = useLiveKitToken({
    streamId: id,
    isHost,
    userId: effectiveUserId,
    roomName: id,
    // Only request publish permissions if on stage (Host or Active Seat)
    canPublish: mode === 'stage',
    enabled: !!stream,
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
              hasPreflight: !!preflightStream
          });
      }
  }, [stream, user, isHost, mode, preflightStream]);

  const isStreamOffline = stream?.status === 'ended';

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
  const { viewerCount } = useViewerTracking(id || '', isHost, guestUserObj);

  // Gift Tray State
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);

  // Fetch Stream
  useEffect(() => {
    if (!id) return;
    const fetchStream = async () => {
      const { data, error } = await supabase
        .from('streams')
        .select('*, broadcaster:user_profiles!broadcaster_id(*)')
        .eq('id', id)
        .single();
      
      if (error || !data) {
        console.error('Error fetching stream:', error);
        setLoading(false);
        return;
      }
      
      // 🏛️ Check if this is a government stream and user is not staff
      if (isGovernmentStream(data)) {
        const userIsStaff = isStaffMember(profile);
        console.log(`[BroadcastPage] Government stream check: category=${data.category} isStaff=${userIsStaff}`);
        
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
    };
    fetchStream();

    // Subscribe to Stream Updates (Box Count, Settings, etc.)
    const channel = supabase.channel(`broadcast_page_${id}`)
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
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [id]);

  // Host Balance Updater (Realtime)
  useEffect(() => {
    if (!id || !isHost || !user) return;

    const channel = supabase.channel(`stream_events_${id}_host_balance`)
        .on(
            'broadcast',
            { event: 'gift_sent' },
            (payload) => {
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

    return () => {
        supabase.removeChannel(channel);
    };
  }, [id, isHost, user]);

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
      if (!user) {
          toast.error("Login required to join stage");
          return;
      }

      // Guest Limit Check (Max 3 Guests)
      const occupiedSeats = Object.values(seats).filter(s => s.status === 'active').length;
      if (occupiedSeats >= 3) {
          toast.error("Guest limit reached (Max 3 guests).");
          return;
      }
      
      const price = stream?.seat_price || 0;
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
      const isUsername = !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paramId || '');
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white">
            <h2 className="text-2xl font-bold mb-2">
                {isUsername ? `${paramId} is offline` : 'Stream not found'}
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
      return <BattleView battleId={stream.battle_id} currentStreamId={id || ''} />;
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
  if (isMobile) {
      if (isStreamOffline) {
          return (
             <div className="h-screen w-full flex items-center justify-center bg-zinc-900 text-white">
                 <div className="text-center">
                     <h3 className="text-xl font-bold mb-2">Stream Ended</h3>
                     <p className="text-zinc-400">This broadcast has finished.</p>
                 </div>
             </div>
          );
      }
      // ... Mobile layout logic commented out to force unified responsive layout
  }
  */

  return (
    <div className="flex flex-col md:flex-row h-screen bg-black text-white overflow-hidden font-sans">
        
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
                            <h3 className="text-xl font-bold mb-2">Stream Ended</h3>
                            <p className="text-zinc-400">This broadcast has finished.</p>
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
                                 !token ? 'Requesting LiveKit token...' :
                                 !serverUrl ? 'Connecting to server...' :
                                 'Initializing studio...'}
                            </div>
                            <div className="text-xs text-zinc-700 font-mono">
                                ID: {id} | U: {user?.id?.slice(0,6)} | T: {!!token}
                            </div>
                        </div>
                    )}
                </div>
            ) : (guestTimeLeft === 0 && !user) ? (
                <div className="flex-1 relative flex flex-col bg-zinc-900 items-center justify-center">
                    <GuestLimitOverlay />
                </div>
            ) : (
                <LiveKitRoom
                    token={token}
                    serverUrl={serverUrl}
                    connect={true}
                    video={mode === 'stage'}
                    audio={mode === 'stage'}
                className="flex-1 relative"
            >
                <RoomStateSync mode={mode} isHost={isHost} streamId={id || ''} />
                <BroadcastLimitEnforcer 
                    isHost={isHost} 
                    mode={mode} 
                    isStaff={isStaffMember(profile)} 
                    profileLoading={!!user && !profile}
                />
                    
                    {/* Guest Preview Timer UI */}
                    {guestTimeLeft !== null && guestTimeLeft > 0 && !user && (
                        <div className="absolute top-24 right-4 z-[60] bg-red-900/80 backdrop-blur text-white px-4 py-2 rounded-full font-bold animate-pulse border border-red-500 shadow-lg pointer-events-none">
                            Preview: {guestTimeLeft}s
                        </div>
                    )}

                    {preflightStream && (
                        <PreflightPublisher 
                            stream={preflightStream} 
                            onPublished={() => PreflightStore.clear()} 
                        />
                    )}
                    <BroadcastHeader 
                        stream={stream} 
                        isHost={isHost} 
                        onStartBattle={() => setShowBattleManager(true)} 
                        liveViewerCount={viewerCount}
                    />
                    <BroadcastEffectsLayer streamId={stream.id} />
                    <ErrorBoundary>
                        <BroadcastGrid
                            stream={stream}
                            isHost={isHost}
                            mode="stage" // Always render as stage (WebRTC)
                            seats={seats}
                            onGift={(uid) => setGiftRecipientId(uid)}
                            onGiftAll={() => setGiftRecipientId('ALL')}
                            onJoinSeat={handleJoinRequest} 
                            onKick={kickParticipant}
                            broadcasterProfile={broadcasterProfile}
                        />
                    </ErrorBoundary>
                    
                    {/* Controls Overlay - Visible to everyone (with different options) */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center z-50 pointer-events-none">
                        <div className="pointer-events-auto">
                            <BroadcastControls 
                                stream={stream}
                                isHost={isHost}
                                isOnStage={mode === 'stage'}
                                chatOpen={true}
                                toggleChat={() => {}}
                                onGiftHost={() => setGiftRecipientId(stream.user_id)}
                                onLeave={isHost ? undefined : handleLeave}
                                onShare={handleShare}
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
                    isModerator={false} // TODO: Add mod logic
                    isGuest={!user}
                />
            </ErrorBoundary>
        </div>

    </div>
  );
}
