import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LiveKitRoom, RoomAudioRenderer, StartAudio } from '@livekit/components-react';
import '@livekit/components-styles';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useLiveKitToken } from '../../hooks/useLiveKitToken';
import { useViewerTracking } from '../../hooks/useViewerTracking';
import { Stream } from '../../types/broadcast';
import BroadcastGrid from '../../components/broadcast/BroadcastGrid';
import BroadcastChat from '../../components/broadcast/BroadcastChat';
import BroadcastControls from '../../components/broadcast/BroadcastControls';
import BattleView from '../../components/broadcast/BattleView';
import BattleControls from '../../components/broadcast/BattleControls';
import MuteHandler from '../../components/broadcast/MuteHandler';
import GiftAnimationOverlay from '../../components/broadcast/GiftAnimationOverlay';
import GiftTray from '../../components/broadcast/GiftTray';
import ActiveUserStrip from '../../components/broadcast/ActiveUserStrip';
import EntranceEffectOverlay from '../../components/broadcast/EntranceEffectOverlay';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function BroadcastPage() {
  const { id } = useParams<{ id: string }>();
  useViewerTracking(id || '');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);

  const [isModerator, setIsModerator] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  
  // Gift Tray State
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);
  const [giftAllMode, setGiftAllMode] = useState(false);
  
  // Get all participant IDs for "Gift All" functionality
  // We need to access this from BroadcastGrid potentially, or query here.
  // For simplicity, we'll pass a callback to BroadcastGrid to get IDs or just pass 'ALL' flag to GiftTray
  // and let GiftTray handle fetching or receiving IDs.
  // Actually, BroadcastGrid knows the participants.
  // Let's just store the IDs in state if needed, or pass them when opening.
  const [giftAllParticipants, setGiftAllParticipants] = useState<string[]>([]);

  const acceptBattle = async (battleId: string) => {
      try {
          const { error } = await supabase.rpc('accept_battle', { p_battle_id: battleId });
          if (error) throw error;
          toast.success("Battle accepted! Starting now...");
      } catch (e) {
          toast.error("Failed to accept battle");
          console.error(e);
      }
  };

  // Fetch stream data
  useEffect(() => {
    if (!id || !user) return;
    const fetchStream = async () => {
      // 1. Check if banned/kicked
      const { data: banData } = await supabase
        .from('stream_bans')
        .select('*')
        .eq('stream_id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (banData) {
          // If banned (expires_at is null or future)
          if (!banData.expires_at || new Date(banData.expires_at) > new Date()) {
              navigate(`/kick-fee/${id}`);
              return;
          }
      }

      const { data, error } = await supabase
        .from('streams')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error || !data) {
        console.error('Error fetching stream:', error);
        // navigate('/'); // Commented out for debugging
        setLoading(false);
        return;
      }
      setStream(data);
      setLoading(false);

      // Check if already ended
      if (data.status === 'ended') {
        navigate('/broadcast/summary', { 
             state: {
                 title: data.title,
                 viewers: data.current_viewers,
                 likes: data.total_likes,
                 gifts: 0, 
                 duration: "Ended"
             }
         });
      }
    };

    fetchStream();

    // Subscribe to stream updates (box count, layout, etc.)
    const channel = supabase
      .channel(`stream:${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'streams',
        filter: `id=eq.${id}`
      }, (payload) => {
        const newStream = payload.new as Stream;
        setStream(newStream);

        // Redirect if ended
        if (newStream.status === 'ended') {
             navigate('/broadcast/summary', { 
                 state: {
                     title: newStream.title,
                     viewers: newStream.current_viewers,
                     likes: newStream.total_likes,
                     gifts: 0, // Ideally we fetch this
                     duration: "Ended" 
                 }
             });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, navigate]);

  // Check moderator status & Listen for Bans
  useEffect(() => {
    if (!user || !stream) return;
    
    const checkMod = async () => {
        if (user.id === stream.user_id) {
            setIsModerator(true);
            return;
        }
        const { data } = await supabase.rpc('is_moderator', { 
            p_stream_id: stream.id, 
            p_user_id: user.id 
        });
        setIsModerator(!!data);
    };
    checkMod();

    // Check initial ban
    const checkBan = async () => {
        const { data } = await supabase.from('stream_bans').select('id').eq('stream_id', stream.id).eq('user_id', user.id).maybeSingle();
        if (data) {
             alert("You have been kicked from this stream.");
             navigate('/');
        }
    };
    checkBan();

    // Listen for new bans
    const banChannel = supabase.channel(`bans:${stream.id}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'stream_bans',
            filter: `stream_id=eq.${stream.id}`
        }, (payload) => {
            // @ts-ignore
            if (payload.new.user_id === user.id) {
                alert("You have been kicked from this stream.");
                navigate('/');
            }
        })
        .subscribe();
        
    return () => { supabase.removeChannel(banChannel); };
  }, [user, stream, navigate]);

  // Determine if user is host
  const isHost = user?.id === stream?.user_id;

  // Listen for Battle Challenges (Host Only)
  useEffect(() => {
    if (!id || !isHost) return;

    const channel = supabase.channel(`battle_challenges:${id}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'battles',
            filter: `opponent_stream_id=eq.${id}`
        }, (payload) => {
             // @ts-ignore
             if (payload.new.status === 'pending') {
                toast("You have been challenged to a battle!", {
                    action: {
                        label: 'Accept',
                        onClick: () => acceptBattle(payload.new.id)
                    },
                    duration: 10000, 
                });
            }
        })
        .subscribe();
        
    return () => { supabase.removeChannel(channel); };
  }, [id, isHost]);
  
  // Use LiveKit token hook
  const { token, serverUrl } = useLiveKitToken({
    streamId: id,
    isHost,
    userId: user?.id,
    roomName: id,
    canPublish: true // Allow everyone to try to publish, permissions handled by token server/LiveKit
  });

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-black text-white"><Loader2 className="animate-spin w-8 h-8" /></div>;
  }

  if (!stream) {
      return <div className="flex h-screen items-center justify-center bg-black text-white">Stream not found</div>;
  }

  if (!token || !serverUrl) {
    return (
        <div className="flex h-screen items-center justify-center bg-black text-white flex-col gap-4">
            <Loader2 className="animate-spin w-8 h-8" />
            <p>Connecting to broadcast server...</p>
        </div>
    );
  }

  // If in a battle, show the Battle View (Split Screen)
  if (stream.battle_id) {
      return <BattleView battleId={stream.battle_id} currentStreamId={id!} />;
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      video={true}
      audio={true}
      data-lk-theme="default"
      className="flex h-screen w-full bg-black overflow-hidden"
    >
      <MuteHandler streamId={id!} />
      {/* Full Screen Overlays */}
      {stream && <EntranceEffectOverlay streamId={stream.id} />}
      <GiftAnimationOverlay streamId={id!} />
      
      {giftRecipientId && (
        <GiftTray 
            recipientId={giftRecipientId} 
            streamId={stream.id} 
            onClose={() => {
                setGiftRecipientId(null);
                setGiftAllMode(false);
                setGiftAllParticipants([]);
            }} 
            allRecipients={giftAllMode ? giftAllParticipants : undefined}
        />
      )}

      <div className="flex-1 flex flex-col relative">
        {/* Active Users Strip */}
        {stream && (
            <ActiveUserStrip 
                streamId={stream.id} 
                isHost={isHost} 
                isModerator={isModerator} 
                onGift={(userId) => {
                    setGiftRecipientId(userId);
                    setGiftAllMode(false);
                }}
            />
        )}

        {/* Main Grid Area */}
        <div 
            className="flex-1 p-2 md:p-4 relative flex items-center justify-center bg-gradient-to-b from-zinc-900 to-black bg-cover bg-center transition-all duration-500"
            style={stream?.active_theme_url ? { backgroundImage: `url(${stream.active_theme_url})` } : undefined}
        >
            <BroadcastGrid 
                stream={stream} 
                isHost={isHost} 
                isModerator={isModerator}
                onGift={(userId) => {
                    setGiftRecipientId(userId);
                    setGiftAllMode(false);
                }}
                onGiftAll={(participantIds) => {
                    setGiftRecipientId("ALL_BROADCASTERS");
                    setGiftAllMode(true);
                    setGiftAllParticipants(participantIds);
                }}
            />
        </div>
        
        {/* Controls - Floating at bottom (Visible to all, internal logic handles host-only buttons) */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 w-full px-4 max-w-4xl">
           <BroadcastControls 
              stream={stream} 
              isHost={isHost}
              chatOpen={chatOpen}
              toggleChat={() => setChatOpen(prev => !prev)}
              onGiftHost={() => {
                  setGiftRecipientId(stream.user_id);
                  setGiftAllMode(false);
              }}
           />
        </div>
      </div>

      {/* Sidebar (Chat & Gifts) */}
      {chatOpen && (
        <div className="w-80 md:w-96 border-l border-white/10 bg-zinc-900/95 backdrop-blur flex flex-col transition-all duration-300 ease-in-out">
           <BroadcastChat streamId={id!} hostId={stream!.user_id} isModerator={isModerator} isHost={isHost} />
        </div>
      )}
      
      <RoomAudioRenderer />
      <StartAudio label="Click to allow audio" />
    </LiveKitRoom>
  );
}
