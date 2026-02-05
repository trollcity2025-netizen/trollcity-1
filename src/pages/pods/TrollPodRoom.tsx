import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Mic, MicOff, Users, MessageSquare, Hand, UserPlus, UserMinus, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { LiveKitRoom, useParticipants, useRoomContext, RoomAudioRenderer } from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { useLiveKitToken } from '../../hooks/useLiveKitToken';
import { useAuthStore } from '../../lib/store';
import { emitEvent as triggerEvent } from '../../lib/events';
import PodParticipantBox from './PodParticipantBox';
import PodChatBox from './PodChatBox';
import HLSPlayer from '../../components/broadcast/HLSPlayer';

interface Room {
  id: string;
  title: string;
  host_id: string;
  is_live: boolean;
  viewer_count: number;
  hls_url?: string;
}

interface PodParticipant {
  id: string;
  room_id: string;
  user_id: string;
  role: 'host' | 'speaker' | 'listener';
  is_muted: boolean;
  is_hand_raised: boolean;
  user?: {
    username: string;
    avatar_url: string;
  };
}

// --- HLS / Listener View ---
const PodListenerView = ({
  room,
  currentUser,
  participantsData,
  onRequestSpeak,
  onCancelRequest
}: {
  room: Room,
  currentUser: any,
  participantsData: PodParticipant[],
  onRequestSpeak: () => void,
  onCancelRequest: () => void
}) => {
  const [showChat, setShowChat] = useState(true);
  const myRecord = participantsData.find(p => p.user_id === currentUser?.id);
  const isHandRaised = myRecord?.is_hand_raised;
  
  // Construct HLS URL based on room ID (assuming standard convention)
  const hlsUrl = room.hls_url || `https://cdn.maitrollcity.com/streams/${room.id}.m3u8`;

  // Get Speakers for display list
  const speakers = participantsData.filter(p => p.role === 'host' || p.role === 'speaker');

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      {/* Main Content (HLS Player) */}
      <div className={`flex-1 flex flex-col relative transition-all duration-300 ${showChat ? 'mr-80' : 'mr-0'}`}>
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 h-16 flex items-center justify-between px-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
             <h1 className="text-lg font-bold truncate text-white shadow-black drop-shadow-md">{room.title}</h1>
          </div>
          
          <div className="pointer-events-auto flex items-center gap-3">
             <button 
              onClick={() => setShowChat(!showChat)}
              className={`p-2 rounded-full transition-colors backdrop-blur-md ${showChat ? 'bg-purple-600 text-white' : 'bg-gray-800/50 text-gray-200 hover:bg-gray-700/50'}`}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <button 
              onClick={() => window.history.back()}
              className="px-4 py-1.5 bg-red-600/90 hover:bg-red-600 rounded-lg text-sm font-bold transition-colors"
            >
              Leave
            </button>
          </div>
        </div>

        {/* Video Area */}
        <div className="flex-1 bg-zinc-900 relative">
           <HLSPlayer 
             src={hlsUrl} 
             className="w-full h-full object-contain"
           />
           
           {/* Speakers Overlay (Bottom Left) */}
           <div className="absolute bottom-24 left-4 z-10 max-w-md">
              <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2">On Stage</h3>
              <div className="flex flex-wrap gap-2">
                 {speakers.map(s => (
                   <div key={s.user_id} className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full pr-3 pl-1 py-1 border border-white/10">
                      <img 
                        src={s.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.user_id}`} 
                        className="w-6 h-6 rounded-full bg-zinc-800"
                        alt={s.user?.username}
                      />
                      <span className="text-xs font-medium">{s.user?.username}</span>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Controls Bar */}
        <div className="h-20 bg-gray-900/90 backdrop-blur-md border-t border-gray-800 flex items-center justify-center z-20">
            <button 
                onClick={isHandRaised ? onCancelRequest : onRequestSpeak}
                className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all transform hover:scale-105 ${
                    isHandRaised 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/30'
                }`}
            >
                <Hand className={`w-5 h-5 ${isHandRaised ? '' : 'animate-bounce'}`} />
                {isHandRaised ? 'Cancel Request' : 'Request to Speak'}
            </button>
        </div>
      </div>

      {/* Chat Sidebar */}
      <div className={`fixed right-0 top-0 bottom-0 w-80 bg-gray-900 border-l border-gray-800 transform transition-transform duration-300 z-40 ${showChat ? 'translate-x-0' : 'translate-x-full'}`}>
         <PodChatBox 
           roomId={room.id} 
           currentUserId={currentUser?.id} 
           isHost={false} 
         />
      </div>
    </div>
  );
};

// --- Active Speaker / Host View (LiveKit) ---
const PodRoomContent = ({ 
  room, 
  currentUser, 
  isHost,
  participantsData,
  participantCount,
  onRequestSpeak,
  onApproveRequest,
  onRemoveSpeaker,
  onCancelRequest
}: { 
  room: Room, 
  currentUser: any, 
  isHost: boolean,
  participantsData: PodParticipant[],
  participantCount: number,
  onRequestSpeak: () => void,
  onApproveRequest: (userId: string) => void,
  onRemoveSpeaker: (userId: string) => void,
  onCancelRequest: () => void
}) => {
  const participants = useParticipants();
  const liveKitRoom = useRoomContext();
  const [showChat, setShowChat] = useState(true);
  const [showRequests, setShowRequests] = useState(false);

  // Derived state
  const myRecord = participantsData.find(p => p.user_id === currentUser?.id);
  const isSpeaker = isHost || myRecord?.role === 'speaker';
  const isHandRaised = myRecord?.is_hand_raised;

  // Task Tracking: Listen to Pod
  useEffect(() => {
    if (!currentUser || !room.id) return;

    // Trigger "listened" event every 5 minutes
    const interval = setInterval(() => {
        triggerEvent('pod_listened', currentUser.id, { roomId: room.id, minutes: 5 });
    }, 300000); // 5 minutes

    return () => clearInterval(interval);
  }, [currentUser, room.id]);

  // Instant Mute Enforcement
  useEffect(() => {
    if (myRecord?.is_muted && liveKitRoom.localParticipant.isMicrophoneEnabled) {
       liveKitRoom.localParticipant.setMicrophoneEnabled(false);
       toast.error('You have been muted by the host.');
    }
  }, [myRecord?.is_muted, liveKitRoom.localParticipant]);

  const handleKick = async (userId: string) => {
    if (!isHost) return;
    if (confirm('Are you sure you want to kick and ban this user?')) {
        try {
        await supabase.from('pod_room_participants').delete().eq('room_id', room.id).eq('user_id', userId);
        await supabase.from('pod_bans').insert({ room_id: room.id, user_id: userId });
        toast.success('User kicked');
        } catch {
        toast.error('Failed to kick user');
        }
    }
  };

  const handleMute = async (identity: string) => {
    if (!isHost) return;
    await supabase
      .from('pod_room_participants')
      .update({ is_muted: true })
      .eq('room_id', room.id)
      .eq('user_id', identity);
    toast.success('Mute command sent');
  };

  const handleLeave = async () => {
    if (!currentUser?.id || !room?.id) return;

    if (isHost) {
        // Host leaving ends the pod
        if (confirm('Ending the pod will disconnect all users. Continue?')) {
            await supabase
                .from('pod_rooms')
                .update({ is_live: false, ended_at: new Date().toISOString() })
                .eq('id', room.id);
            
            liveKitRoom.disconnect();
        }
    } else {
        // Regular user leaving
        await supabase.from('pod_room_participants')
            .delete()
            .eq('room_id', room.id)
            .eq('user_id', currentUser.id);
        
        liveKitRoom.disconnect();
    }
  };

  // Requests List (for Host)
  const requests = participantsData.filter(p => p.is_hand_raised && p.role === 'listener');

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      {/* Main Content (Participants) */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${showChat ? 'mr-80' : 'mr-0'}`}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 overflow-hidden">
             <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
             <h1 className="text-lg font-bold truncate">{room.title}</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-full border border-gray-700">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-mono">{participantCount}</span>
            </div>
            
            {isHost && requests.length > 0 && (
                <button 
                    onClick={() => setShowRequests(!showRequests)}
                    className="relative p-2 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-500 rounded-full transition-colors"
                >
                    <Hand className="w-5 h-5" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full">
                        {requests.length}
                    </span>
                </button>
            )}

            <button 
              onClick={() => setShowChat(!showChat)}
              className={`p-2 rounded-full transition-colors ${showChat ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            
            <button 
              onClick={handleLeave}
              className="px-4 py-1.5 bg-red-600/90 hover:bg-red-600 rounded-lg text-sm font-bold transition-colors"
            >
              {isHost ? 'End Pod' : 'Leave'}
            </button>
          </div>
        </div>

        {/* Requests Panel (Overlay) */}
        {showRequests && isHost && (
            <div className="absolute top-16 right-80 z-50 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4">
                <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Requests to Speak</h3>
                <div className="space-y-2">
                    {requests.map(req => (
                        <div key={req.user_id} className="flex items-center justify-between bg-black/40 p-2 rounded">
                            <span className="text-sm truncate max-w-[100px]">{req.user?.username || 'User'}</span>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => onApproveRequest(req.user_id)}
                                    className="p-1.5 bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white rounded"
                                    title="Approve"
                                >
                                    <UserPlus size={14} />
                                </button>
                                <button 
                                    onClick={() => onRemoveSpeaker(req.user_id)} // Technically just denies request (clears hand raise)
                                    className="p-1.5 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white rounded"
                                    title="Deny"
                                >
                                    <UserX size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {requests.length === 0 && <div className="text-xs text-gray-500 text-center py-2">No active requests</div>}
                </div>
            </div>
        )}

        {/* Participant Grid (Only Speakers/Host) */}
        {/* We filter LiveKit participants to only show those who are publishing or are host/speakers in DB */}
        <div className="flex-1 p-4 overflow-y-auto bg-gradient-to-b from-gray-900 to-black">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {participants.map((p) => {
               const isParticipantHost = p.identity === room.host_id;
               const isSelf = p.identity === currentUser?.id;
               
               // Check Supabase role
               const sbUser = participantsData.find(pd => pd.user_id === p.identity);
               const isSpeakerRole = sbUser?.role === 'speaker';

               // Only render if they are host, approved speaker, or have active tracks
               // We use getTrackPublication because videoTracks/audioTracks properties might not be directly exposed in this version's type def
               const hasVideo = p.getTrackPublication(Track.Source.Camera) !== undefined;
               const hasAudio = p.getTrackPublication(Track.Source.Microphone) !== undefined;
               
               if (!isParticipantHost && !isSpeakerRole && !hasVideo && !hasAudio) return null; 

               return (
                 <PodParticipantBox
                   key={p.identity}
                   participant={p}
                   isHost={isParticipantHost}
                   isSelf={isSelf}
                   onKick={isHost ? handleKick : undefined}
                   onMute={isHost ? handleMute : undefined}
                   onDemote={isHost ? onRemoveSpeaker : undefined}
                 />
               );
            })}
          </div>
        </div>
        
        {/* Controls Bar (Bottom) */}
        <div className="h-24 bg-gray-900/90 backdrop-blur-md border-t border-gray-800 flex items-center justify-center gap-8">
            {isSpeaker ? (
                <>
                    <button 
                        className={`p-4 rounded-full transition-all duration-200 transform hover:scale-105 ${liveKitRoom.localParticipant.isMicrophoneEnabled ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'}`}
                        onClick={() => liveKitRoom.localParticipant.setMicrophoneEnabled(!liveKitRoom.localParticipant.isMicrophoneEnabled)}
                    >
                        {liveKitRoom.localParticipant.isMicrophoneEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                    </button>
                    {!isHost && (
                         <button 
                            className="flex flex-col items-center gap-1 text-xs text-gray-400 hover:text-white"
                            onClick={() => onRemoveSpeaker(currentUser?.id)}
                         >
                            <UserMinus className="w-5 h-5" />
                            <span>Leave Stage</span>
                         </button>
                    )}
                </>
            ) : (
                // Listener Controls
                <button 
                    onClick={isHandRaised ? onCancelRequest : onRequestSpeak}
                    className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all transform hover:scale-105 ${
                        isHandRaised 
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                        : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/30'
                    }`}
                >
                    <Hand className={`w-5 h-5 ${isHandRaised ? '' : 'animate-bounce'}`} />
                    {isHandRaised ? 'Cancel Request' : 'Request to Speak'}
                </button>
            )}
        </div>
      </div>

      {/* Chat Sidebar */}
      <div className={`fixed right-0 top-0 bottom-0 w-80 bg-gray-900 border-l border-gray-800 transform transition-transform duration-300 z-40 ${showChat ? 'translate-x-0' : 'translate-x-full'}`}>
         <PodChatBox 
           roomId={room.id} 
           currentUserId={currentUser?.id} 
           isHost={isHost} 
         />
      </div>
      
      <RoomAudioRenderer />
    </div>
  );
};

export default function TrollPodRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const { user: currentUser } = useAuthStore();
  const [participantsData, setParticipantsData] = useState<PodParticipant[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  
  // Fetch Room Info
  useEffect(() => {
    if (!roomId) return;

    const fetchRoom = async () => {
      const { data, error } = await supabase
        .from('pod_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error || !data) {
        toast.error('Room not found or ended');
        navigate('/pods');
        return;
      }
      
      if (!data.is_live) {
        toast.info('This pod has ended');
        navigate('/pods');
        return;
      }

      setRoom(data);
    };

    fetchRoom();

    // Subscribe to room updates
    const roomChannel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'pod_rooms', 
        filter: `id=eq.${roomId}` 
      }, (payload) => {
        if (payload.new.is_live === false) {
          toast.info('The pod has ended');
          navigate('/pods');
        }
        setRoom(payload.new as Room);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [roomId, navigate]);

  // Fetch & Subscribe Participants
  useEffect(() => {
    if (!roomId) return;

    const fetchParticipants = async () => {
        // OPTIMIZATION: Only fetch hosts and speakers to avoid loading thousands of listeners
        const { data: speakers } = await supabase
            .from('pod_room_participants')
            .select('*')
            .eq('room_id', roomId)
            .in('role', ['host', 'speaker']);
        
        // Fetch count of all participants (cheap)
        const { count } = await supabase
            .from('pod_room_participants')
            .select('id', { count: 'exact', head: true })
            .eq('room_id', roomId);
        
        if (count !== null) setParticipantCount(count);

        if (speakers) {
            // Fetch user profiles for speakers only
            const userIds = [...new Set(speakers.map(p => p.user_id))];
            const { data: profiles } = await supabase
                .from('user_profiles')
                .select('id, username, avatar_url')
                .in('id', userIds);

            const participantsWithUsers = speakers.map(p => ({
                ...p,
                user: profiles?.find(profile => profile.id === p.user_id)
            }));
            
            // Add a "fake" participant entry for the count if needed, or just store count in state
            // For compatibility with existing UI, we'll store speakers. 
            // The UI uses participants.length for the count, so we need a separate state for count.
            setParticipantsData(participantsWithUsers as PodParticipant[]);
            // We might need to update the UI to use a separate count variable instead of participantsData.length
        }
    };

    fetchParticipants();

    const participantsChannel = supabase
        .channel(`participants:${roomId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'pod_room_participants',
            filter: `room_id=eq.${roomId}`
        }, (payload: any) => {
            // OPTIMIZATION: Only refetch if a host/speaker is involved
            // If a listener joins/leaves, we don't need to refetch the whole speaker list
            // We just need to update the count (which we might skip for perf or do lazily)
            
            const isSpeakerEvent = 
                (payload.new && ['host', 'speaker'].includes(payload.new.role)) ||
                (payload.old && ['host', 'speaker'].includes(payload.old.role));

            if (isSpeakerEvent) {
                fetchParticipants();
            } else {
                // Update count for listener events without refetching speakers
                if (payload.eventType === 'INSERT') setParticipantCount(prev => prev + 1);
                if (payload.eventType === 'DELETE') setParticipantCount(prev => Math.max(0, prev - 1));
            }
        })
        .subscribe();
    
    const bansChannel = supabase
        .channel(`bans:${roomId}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'pod_bans', 
            filter: `room_id=eq.${roomId}` 
        }, (payload) => {
            if (payload.new.user_id === currentUser.id) {
                toast.error('You have been kicked and banned.');
                navigate('/pods');
            }
        })
        .subscribe();

    return () => {
        supabase.removeChannel(participantsChannel);
        supabase.removeChannel(bansChannel);
    };
  }, [roomId, currentUser, navigate]);

  // Auto-join as listener to enable chat (RLS requirement)
  useEffect(() => {
    if (!roomId || !currentUser) return;

    const joinAsListener = async () => {
        // Check if already in participants table
        const { data } = await supabase
            .from('pod_room_participants')
            .select('id')
            .eq('room_id', roomId)
            .eq('user_id', currentUser.id)
            .single();
        
        if (!data) {
            // Not in table, insert as listener
            await supabase.from('pod_room_participants').insert({
                room_id: roomId,
                user_id: currentUser.id,
                role: 'listener',
                is_hand_raised: false
            });
        }
    };

    joinAsListener();
  }, [roomId, currentUser]);


  // Actions
  const handleRequestSpeak = async () => {
    if (!currentUser || !roomId) return;
    
    // Upsert to handle both "new joiner" and "existing participant" cases
    // This avoids race conditions with the auto-join effect
    const { error } = await supabase.from('pod_room_participants').upsert({
        room_id: roomId,
        user_id: currentUser.id,
        role: 'listener', // Only listeners request to speak
        is_hand_raised: true
    }, { onConflict: 'room_id, user_id', ignoreDuplicates: false });

    if (error) {
        toast.error('Failed to request to speak');
        console.error(error);
    } else {
        toast.success('Request sent to host');
    }
  };

  const handleCancelRequest = async () => {
      if (!currentUser || !roomId) return;
      await supabase.from('pod_room_participants')
        .update({ is_hand_raised: false })
        .eq('room_id', roomId)
        .eq('user_id', currentUser.id);
  };

  const handleApproveRequest = async (userId: string) => {
      // Check speaker limit (10 including host)
      const currentSpeakers = participantsData.filter(p => p.role === 'host' || p.role === 'speaker');
      if (currentSpeakers.length >= 10) {
        toast.error('Speaker limit reached (10 max including host)');
        return;
      }

      await supabase.from('pod_room_participants')
        .update({ role: 'speaker', is_hand_raised: false })
        .eq('room_id', roomId)
        .eq('user_id', userId);
      toast.success('Speaker approved');
  };

  const handleRemoveSpeaker = async (userId: string) => {
      // If it's a request denial (still listener), just clear hand raise
      // If it's a speaker removal, downgrade to listener
      // OR we can just delete the row if we want "Deduct Box" to mean "Go back to audience"
      
      const participant = participantsData.find(p => p.user_id === userId);
      if (!participant) return;

      if (participant.role === 'speaker') {
           await supabase.from('pod_room_participants')
            .update({ role: 'listener', is_hand_raised: false })
            .eq('room_id', roomId)
            .eq('user_id', userId);
           toast.success('Speaker removed from stage');
      } else {
          // Just deny request
           await supabase.from('pod_room_participants')
            .update({ is_hand_raised: false })
            .eq('room_id', roomId)
            .eq('user_id', userId);
           toast.info('Request denied');
      }
  };

  // LiveKit Token Logic
  const isHost = currentUser?.id === room?.host_id;
  const myRole = participantsData.find(p => p.user_id === currentUser?.id)?.role;
  const canPublish = isHost || myRole === 'speaker';

  const { token, serverUrl, isLoading, error } = useLiveKitToken({
    streamId: roomId,
    roomName: roomId,
    userId: currentUser?.id,
    isHost: isHost,
    canPublish: canPublish,
    enabled: canPublish // Only fetch token if we are going to publish (Host/Speaker)
  });

  if (!room) return <div className="flex items-center justify-center h-screen bg-black text-white">Loading room...</div>;
  
  // --- LISTENER MODE (HLS) ---
  if (!canPublish) {
     return (
        <PodListenerView 
            room={room}
            currentUser={currentUser}
            participantsData={participantsData}
            onRequestSpeak={handleRequestSpeak}
            onCancelRequest={handleCancelRequest}
        />
     );
  }

  // --- SPEAKER MODE (LiveKit) ---
  if (isLoading) return <div className="flex items-center justify-center h-screen bg-black text-white">Connecting to Pod...</div>;
  if (error) return <div className="flex items-center justify-center h-screen bg-black text-white">Error: {error}</div>;
  if (!token || !serverUrl) return <div className="flex items-center justify-center h-screen bg-black text-white">Initializing connection...</div>;

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      data-lk-theme="default"
      style={{ height: '100vh' }}
      onDisconnected={() => navigate('/pods')}
    >
      <PodRoomContent 
        room={room} 
        currentUser={currentUser} 
        isHost={isHost} 
        participantsData={participantsData}
        participantCount={participantCount}
        onRequestSpeak={handleRequestSpeak}
        onApproveRequest={handleApproveRequest}
        onRemoveSpeaker={handleRemoveSpeaker}
        onCancelRequest={handleCancelRequest}
      />
    </LiveKitRoom>
  );
}
