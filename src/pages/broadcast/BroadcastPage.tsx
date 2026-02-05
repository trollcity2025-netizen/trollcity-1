import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LiveKitRoom, RoomAudioRenderer, StartAudio, useLocalParticipant } from '@livekit/components-react';
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
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStreamSeats, SeatSession } from '../../hooks/useStreamSeats';
import { useStreamEndListener } from '../../hooks/useStreamEndListener';
import HLSPlayer from '../../components/broadcast/HLSPlayer';
import BattleControlsList from '../../components/broadcast/BattleControlsList';
import { PreflightStore } from '../../lib/preflightStore';
import PreflightPublisher from '../../components/broadcast/PreflightPublisher';

import BroadcastHeader from '../../components/broadcast/BroadcastHeader';

// Helper component to access LiveKit context for Mobile Stage
const MobileStageInner = ({ 
    stream, isHost, seats, messages, onSendMessage, onLeave, onJoinSeat, onStartBattle, children 
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
        >
            <BroadcastHeader stream={stream} isHost={isHost} onStartBattle={onStartBattle} />
            {children}
            <RoomAudioRenderer />
            <StartAudio label="Click to allow audio" />
        </MobileBroadcastLayout>
    );
};

export default function BroadcastPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [stream, setStream] = useState<Stream | null>(null);
  const [broadcasterProfile, setBroadcasterProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
  const { messages, sendMessage } = useStreamChat(id || '');

  // Stream End Listener
  useStreamEndListener({ 
      streamId: id || '',
      enabled: !!id,
      redirectToSummary: true
  });

  // Host Check
  const isHost = stream?.user_id === user?.id;
  
  // Seat System Hook
  const { seats, mySession, joinSeat, leaveSeat, kickParticipant } = useStreamSeats(id);

  // Mode Determination
  // 'stage' = Active Participant (Host or Guest on Seat) -> Publishes Audio/Video
  // 'viewer' = Passive Viewer -> Subscribes only (Low Latency WebRTC)
  const mode = (isHost || (mySession?.status === 'active')) ? 'stage' : 'viewer';

  const { token, serverUrl, error: tokenError, isLoading: tokenLoading } = useLiveKitToken({
    streamId: id,
    isHost,
    userId: user?.id,
    roomName: id,
    canPublish: true, // Force permission request to be explicit
    enabled: !!stream && !!user && mode === 'stage' // Only enable if stream and user are loaded AND user is on stage
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
  useViewerTracking(id || '', isHost);

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
      
      const price = stream?.seat_price || 0;
      
      if (price > 0) {
           // We could add a custom modal here, but confirm is fine for MVP
           if (confirm(`Join stage for ${price} Troll Coins?`)) {
               await joinSeat(seatIndex, price);
           }
      } else {
           await joinSeat(seatIndex, 0);
      }
  };

  if (loading) {
      return (
          <div className="h-screen w-full flex items-center justify-center bg-black text-white">
              <Loader2 className="animate-spin text-green-500" size={48} />
          </div>
      );
  }

  if (!stream) {
      return <div className="text-white text-center mt-20">Stream not found</div>;
  }

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

      if (mode === 'viewer') {
          return (
              <>
                <MobileBroadcastLayout
                    stream={stream}
                    isHost={false}
                    messages={messages}
                    seats={seats}
                    onSendMessage={sendMessage}
                    onToggleMic={() => {}}
                    onToggleCamera={() => {}}
                    onFlipCamera={() => {}}
                    onLeave={() => {}}
                    onJoinSeat={handleJoinRequest}
                >
                    <HLSPlayer 
                        src={stream.hls_path || stream.hls_url || stream.id}
                        className="w-full h-full object-cover"
                        autoPlay={true}
                    />
                    {/* Gradient Overlay for Controls Visibility */}
                </MobileBroadcastLayout>
                
                {/* Gift Tray Logic for Mobile Viewer */}
                {giftRecipientId && (
                    <div className="fixed inset-0 z-[60]">
                            <GiftTray 
                            recipientId={giftRecipientId}
                            streamId={stream.id}
                            onClose={() => setGiftRecipientId(null)}
                        />
                    </div>
                )}
              </>
          );
      }

      if (!token || !serverUrl) {
          if (tokenError) {
              return (
                  <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white p-4">
                      <div className="text-red-500 font-bold mb-2">Connection Error</div>
                      <div className="text-center text-zinc-400">{tokenError}</div>
                      <button 
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700"
                      >
                        Retry
                      </button>
                  </div>
              );
          }
          return (
              <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white gap-4">
                  <Loader2 className="animate-spin text-green-500" size={48} />
                  <div className="text-zinc-500 text-sm animate-pulse">
                        {!stream ? 'Loading stream info...' :
                        !user ? 'Identifying user...' :
                        !token ? 'Requesting LiveKit token...' :
                        !serverUrl ? 'Connecting to server...' :
                        'Initializing studio...'}
                  </div>
              </div>
          );
      }

      return (
        <>
            <LiveKitRoom
                token={token}
                serverUrl={serverUrl}
                connect={true}
                video={!preflightStream}
                audio={!preflightStream}
                className="h-full w-full"
            >
                {preflightStream && (
                    <PreflightPublisher 
                        stream={preflightStream} 
                        onPublished={() => PreflightStore.clear()} 
                    />
                )}
                <MobileStageInner
                    stream={stream}
                    isHost={isHost}
                    seats={seats}
                    messages={messages}
                    onSendMessage={sendMessage}
                    onLeave={isHost ? () => {} : leaveSeat}
                    onJoinSeat={handleJoinRequest}
                    onStartBattle={() => setShowBattleManager(true)}
                >
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
                </MobileStageInner>
            </LiveKitRoom>
            {/* Battle Manager Modal */}
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
            
            {/* Gift Tray Logic for Mobile */}
            {giftRecipientId && (
                <div className="fixed inset-0 z-[60]">
                     <GiftTray 
                        recipientId={giftRecipientId}
                        streamId={stream.id}
                        onClose={() => setGiftRecipientId(null)}
                    />
                </div>
            )}
        </>
      );
  }

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
        
        {/* Main Stage / Video Area */}
        <div className="flex-1 relative flex flex-col bg-zinc-900">
            
            {isStreamOffline ? (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-white z-0">
                        <div className="text-center">
                            <h3 className="text-xl font-bold mb-2">Stream Ended</h3>
                            <p className="text-zinc-400">This broadcast has finished.</p>
                        </div>
                    </div>
            ) : mode === 'viewer' ? (
                <div className="w-full h-full bg-black relative">
                    <BroadcastHeader stream={stream} isHost={isHost} onStartBattle={() => setShowBattleManager(true)} />
                    <HLSPlayer 
                        src={stream.hls_path || stream.hls_url || stream.id}
                        className="w-full h-full object-contain"
                    />
                    {/* Optional: Add Overlay for Seat Joining here if needed */}
                </div>
            ) : (token && serverUrl) ? (
                <LiveKitRoom
                    token={token}
                    serverUrl={serverUrl}
                    connect={true}
                    video={!preflightStream}
                    audio={!preflightStream}
                    className="flex-1 relative"
                >
                    {preflightStream && (
                        <PreflightPublisher 
                            stream={preflightStream} 
                            onPublished={() => PreflightStore.clear()} 
                        />
                    )}
                    <BroadcastHeader stream={stream} isHost={isHost} onStartBattle={() => setShowBattleManager(true)} />
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
                    
                    {/* Controls Overlay - Only for active participants */}
                    {mode === 'stage' && (
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center z-50 pointer-events-none">
                            <div className="pointer-events-auto">
                                <BroadcastControls 
                                    stream={stream}
                                    isHost={isHost}
                                    chatOpen={true}
                                    toggleChat={() => {}}
                                    onGiftHost={() => setGiftRecipientId(stream.user_id)}
                                    onLeave={isHost ? undefined : leaveSeat}
                                />
                            </div>
                        </div>
                    )}
                    
                    <RoomAudioRenderer />
                    <StartAudio label="Click to allow audio" />
                </LiveKitRoom>
            ) : (
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
        <div className="w-80 md:w-96 flex flex-col border-l border-white/10 bg-zinc-950/90 backdrop-blur-md z-40">
            <BroadcastChat 
                streamId={stream.id} 
                hostId={stream.user_id}
                isHost={isHost} 
                isModerator={false} // TODO: Add mod logic
            />
        </div>

    </div>
  );
}
