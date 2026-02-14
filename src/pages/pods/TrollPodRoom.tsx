import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Mic, MicOff, Users, MessageSquare, Hand, UserMinus, UserPlus, Settings, Coins, Map } from 'lucide-react';

import { toast } from 'sonner';
import { LiveKitRoom, useParticipants, useRoomContext, RoomAudioRenderer } from '@livekit/components-react';
import '@livekit/components-styles';
import { useLiveKitToken } from '../../hooks/useLiveKitToken';
import { useAuthStore } from '../../lib/store';
import { emitEvent as triggerEvent } from '../../lib/events';
import PodParticipantBox from './PodParticipantBox';
import PodChatBox from './PodChatBox';
import PodHostControlPanel from './PodHostControlPanel';
import TrollsTownControl from '../../components/TrollsTownControl';

interface Room {
  id: string;
  title: string;
  host_id: string;
  is_live: boolean;
  viewer_count: number;
  current_viewers?: number;
  started_at?: string;
  guest_price: number;
}

interface PodParticipant {
  id: string;
  room_id: string;
  user_id: string;
  role: 'host' | 'speaker' | 'listener' | 'officer';
  is_muted: boolean;
  is_hand_raised: boolean;
  user?: {
    username: string;
    avatar_url: string;
  };
}

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
  onCancelRequest,
  isStaff,
  canPublish,
  isGuest
}: { 
  room: Room, 
  currentUser: any, 
  isHost: boolean,
  participantsData: PodParticipant[],
  participantCount: number,
  onRequestSpeak: () => void,
  onApproveRequest: (userId: string) => void,
  onRemoveSpeaker: (userId: string) => void,
  onCancelRequest: () => void,
  isStaff: boolean,
  canPublish: boolean,
  isGuest?: boolean
}) => {
  const participants = useParticipants();
  const liveKitRoom = useRoomContext();
  const [showChat, setShowChat] = useState(true);
  const [showHostPanel, setShowHostPanel] = useState(false);
  const [trollsTownControlOpen, setTrollsTownControlOpen] = useState(false);
  const navigate = useNavigate();

  // Derived state
  const myRecord = participantsData.find(p => p.user_id === currentUser?.id);
  const isSpeaker = isHost || myRecord?.role === 'speaker' || myRecord?.role === 'officer';
  const isOfficer = myRecord?.role === 'officer';
  const isHandRaised = myRecord?.is_hand_raised;

  // Limits Check
  useEffect(() => {
    // 1. Duration Limit (1 hour)
    if (room.started_at) {
      const checkDuration = () => {
        const startedAt = new Date(room.started_at!).getTime();
        const duration = Date.now() - startedAt;
        if (duration > 3600000) { // 1 hour in ms
          toast.error("Pod time limit (1 hour) reached.");
          if (isHost) {
             // Optional: Force end?
          }
        }
      };
      checkDuration();
      const interval = setInterval(checkDuration, 60000);
      return () => clearInterval(interval);
    }
  }, [room.started_at, isHost]);

  // 2. Viewer Limit Check (10 viewers)
  useEffect(() => {
    // If I am a listener (not host/speaker) and count > 10, warn or kick
    // Note: participantCount includes host/speakers. 
    // If strict 10 viewers + host + guests, limit might be higher.
    // Assuming "10 viewers" means total people watching who are not speakers.
    
    if (!isSpeaker && !isHost && !isStaff) {
       // Check how many listeners there are
       // simple approximation: participantCount - speakers count
       const speakerCount = participantsData.filter(p => p.role === 'host' || p.role === 'speaker').length;
       const viewerCount = participantCount - speakerCount;
       
       if (viewerCount > 10) {
          toast.error("Viewer limit (10) reached. You cannot join this pod.");
          navigate('/pods');
       }
    }
  }, [participantCount, isSpeaker, isHost, isStaff, participantsData, navigate]);

  // Task Tracking: Listen to Pod
  useEffect(() => {
    if (!currentUser || !room.id) return;

    // Trigger "listened" event every 5 minutes
    const interval = setInterval(() => {
        triggerEvent('pod_listened', currentUser.id, { roomId: room.id, minutes: 5 });
    }, 300000); // 5 minutes

    return () => clearInterval(interval);
  }, [currentUser, room.id]);

  // Instant Mute / Permission Enforcement
  useEffect(() => {
    const p = liveKitRoom.localParticipant;
    if (!p) return;

    // 1. If I am not a speaker/host, I should NOT be publishing audio
    if (!canPublish && p.isMicrophoneEnabled) {
        console.log('[TrollPod] Enforcing listener mute');
        p.setMicrophoneEnabled(false);
    }

    // 2. If I am muted by host
    if (myRecord?.is_muted && p.isMicrophoneEnabled) {
       p.setMicrophoneEnabled(false);
       toast.error('You have been muted by the host.');
    }
  }, [myRecord?.is_muted, canPublish, liveKitRoom.localParticipant]);

  const handlePromoteOfficer = async (userId: string) => {
    if (!isHost) return;
    await supabase.from('pod_room_participants')
      .update({ role: 'officer', is_hand_raised: false })
      .eq('room_id', room.id)
      .eq('user_id', userId);
    toast.success('User promoted to Officer');
  };

  const handleDisableChat = async (userId: string) => {
    if (!isHost && !isOfficer) return;
    const { error } = await supabase.from('pod_chat_bans').insert({ room_id: room.id, user_id: userId });
    if (!error) toast.success('Chat disabled for user');
    else toast.error('Failed to disable chat');
  };

  const handleKick = async (userId: string) => {
    if (!isHost && !isOfficer) return;
    if (confirm('Are you sure you want to kick this user?')) {
        try {
        await supabase.from('pod_room_participants').delete().eq('room_id', room.id).eq('user_id', userId);
        toast.success('User kicked');
        } catch {
        toast.error('Failed to kick user');
        }
    }
  };
  
  const handleBan = async (userId: string) => {
      if (!isHost && !isOfficer) return;
      if (confirm('Kick and Ban user for 24 hours?')) {
          try {
            await supabase.from('pod_room_participants').delete().eq('room_id', room.id).eq('user_id', userId);
            // Calculate 24h from now
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            await supabase.from('pod_bans').insert({ 
                room_id: room.id, 
                user_id: userId,
                expires_at: expiresAt
            });
            toast.success('User banned for 24h');
          } catch {
            toast.error('Failed to ban user');
          }
      }
  };

  const handleMute = async (identity: string) => {
    if (!isHost && !isOfficer) return;
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
            try {
                const { error } = await supabase
                    .from('pod_rooms')
                    .update({ is_live: false, status: 'ended', ended_at: new Date().toISOString() })
                    .eq('id', room.id);

                if (error) throw error;
                
                liveKitRoom.disconnect();
                setTimeout(() => navigate('/pods'), 500);
            } catch (err) {
                console.error(err);
                toast.error('Failed to end pod');
            }
        }
    } else {
        // Regular user (or Staff) leaving
        try {
            await supabase.from('pod_room_participants')
                .delete()
                .eq('room_id', room.id)
                .eq('user_id', currentUser.id);
        } catch (e) { console.error(e); }
        
        liveKitRoom.disconnect();
    }
  };

  const handleForceEnd = async () => {
     if (!isStaff) return;
     if (confirm('FORCE END this pod (Staff Action)?')) {
        try {
            const { error } = await supabase
                .from('pod_rooms')
                .update({ is_live: false, status: 'ended', ended_at: new Date().toISOString() })
                .eq('id', room.id);

            if (error) throw error;
            
            liveKitRoom.disconnect();
            setTimeout(() => navigate('/pods'), 500);
            toast.success('Pod ended by Staff');
        } catch (err) {
            console.error(err);
            toast.error('Failed to end pod');
        }
     }
  };

  // Requests List (for Host)
  const requests = participantsData.filter(p => p.is_hand_raised && p.role === 'listener');

  // Direct notification listener for Host (bypasses state updates for speed/reliability)
  useEffect(() => {
    if (!isHost || !room?.id) return;

    const channel = supabase.channel(`pod_reqs_notify:${room.id}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'pod_room_participants',
            filter: `room_id=eq.${room.id}`
        }, async (payload: any) => {
            const newRec = payload.new;
            const oldRec = payload.old;
            
            // Check if hand raised changed from false to true
            if (newRec.is_hand_raised && !oldRec.is_hand_raised) {
                 const { data: userProfile } = await supabase
                    .from('user_profiles')
                    .select('username')
                    .eq('id', newRec.user_id)
                    .single();
                 
                 const name = userProfile?.username || 'A listener';
                 
                 toast.info(`${name} requested to speak`, {
                     duration: 5000,
                     action: {
                         label: 'View',
                         onClick: () => setShowHostPanel(true)
                     }
                 });
            }
        })
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'pod_room_participants',
            filter: `room_id=eq.${room.id}`
        }, async (payload: any) => {
             if (payload.new.is_hand_raised) {
                 const { data: userProfile } = await supabase
                    .from('user_profiles')
                    .select('username')
                    .eq('id', payload.new.user_id)
                    .single();
                 
                 const name = userProfile?.username || 'A listener';
                 
                 toast.info(`${name} requested to speak`, {
                     duration: 5000,
                     action: {
                         label: 'View',
                         onClick: () => setShowHostPanel(true)
                     }
                 });
             }
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [isHost, room?.id]);

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
            
            {isHost && (
                <button 
                    onClick={() => setShowHostPanel(true)}
                    className={`relative p-2 rounded-full transition-colors ${requests.length > 0 ? 'bg-red-500/20 text-red-500 animate-pulse border border-red-500' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    title="Host Control Panel"
                >
                    <Settings className="w-5 h-5" />
                    {requests.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full">
                            {requests.length}
                        </span>
                    )}
                </button>
            )}

            <button 
              onClick={() => setTrollsTownControlOpen(true)}
              className={`p-2 rounded-full transition-colors ${trollsTownControlOpen ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              title="GPS Tracker"
            >
              <Map className="w-5 h-5" />
            </button>

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
            
            {isStaff && !isHost && (
                 <button 
                   onClick={handleForceEnd}
                   className="ml-2 px-4 py-1.5 bg-red-900/90 hover:bg-red-800 rounded-lg text-sm font-bold transition-colors border border-red-500/50"
                 >
                   End (Staff)
                 </button>
            )}
          </div>
        </div>

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

               // Only render if they are host, approved speaker
               // Listeners should NOT be in the grid, even if they have audio tracks (unless they are speakers)
               if (!isParticipantHost && !isSpeakerRole) return null; 

               return (
                 <PodParticipantBox
                   key={p.identity}
                   participant={p}
                   isHost={isParticipantHost}
                   isOfficer={participantsData.find(pd => pd.user_id === p.identity)?.role === 'officer'}
                   isSelf={isSelf}
                   onKick={isHost || isOfficer ? handleKick : undefined}
                   onBan={isHost || isOfficer ? handleBan : undefined}
                   onMute={isHost || isOfficer ? handleMute : undefined}
                   onDemote={isHost || isOfficer ? onRemoveSpeaker : undefined}
                   onPromoteOfficer={isHost ? handlePromoteOfficer : undefined}
                   onDisableChat={isHost || isOfficer ? handleDisableChat : undefined}
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
                        className={`p-4 rounded-full transition-all duration-200 transform hover:scale-105 ${liveKitRoom.localParticipant.isMicrophoneEnabled ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'}`}
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
                    onClick={isGuest ? () => navigate('/auth') : (isHandRaised ? onCancelRequest : onRequestSpeak)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all transform hover:scale-105 ${
                        isHandRaised 
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                        : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/30'
                    }`}
                >
                    {isGuest ? (
                        <>
                            <UserPlus className="w-5 h-5" />
                            Sign in to Speak
                        </>
                    ) : isHandRaised ? (
                        <>
                            <Hand className="w-5 h-5" />
                            Cancel Request
                        </>
                    ) : (
                        room.guest_price > 0 ? (
                            <>
                                <Coins className="w-5 h-5 text-yellow-300" />
                                Join Stage ({room.guest_price})
                            </>
                        ) : (
                            <>
                                <Hand className="w-5 h-5 animate-bounce" />
                                Request to Speak
                            </>
                        )
                    )}
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
      
      {showHostPanel && (
        <PodHostControlPanel 
            roomId={room.id}
            requests={requests}
            onApproveRequest={(uid) => {
                onApproveRequest(uid);
                // Panel stays open or closes? Usually stays open for bulk actions.
            }}
            onDenyRequest={onRemoveSpeaker}
            onClose={() => setShowHostPanel(false)}
        />
      )}
      
      <TrollsTownControl isOpen={trollsTownControlOpen} onClose={() => setTrollsTownControlOpen(false)} />
    </div>
  );
};

export default function TrollPodRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const { user: currentUser, profile } = useAuthStore();
  const [participantsData, setParticipantsData] = useState<PodParticipant[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  
  // Fetch Room Info
  useEffect(() => {
    if (!roomId) {
      toast.error('Invalid pod ID');
      navigate('/pods');
      return;
    }

    const fetchRoom = async () => {
        const { data, error } = await supabase
          .from('pod_rooms')
          .select('*, current_viewers')
          .eq('id', roomId)
          .maybeSingle();

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
      const count = data.current_viewers || data.viewer_count || 0;
      setParticipantCount(count);
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
        const newCount = payload.new.current_viewers || payload.new.viewer_count;
        if (newCount !== undefined) setParticipantCount(newCount);
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
        // OPTIMIZATION: Fetch hosts, speakers, OFFICERS, AND any listeners who have raised their hand
        // We also need to make sure we get the current user's status if they are in the room
        const { data: activeParticipants } = await supabase
            .from('pod_room_participants')
            .select('*')
            .eq('room_id', roomId)
            .or(`role.in.(host,speaker,officer),is_hand_raised.eq.true${currentUser ? `,user_id.eq.${currentUser.id}` : ''}`);
        
        // Fetch count of all participants (cheap)
        const { count } = await supabase
            .from('pod_room_participants')
            .select('id', { count: 'exact', head: true })
            .eq('room_id', roomId);
        
        if (count !== null) setParticipantCount(count);

        if (activeParticipants) {
            // Fetch user profiles for active participants
            const userIds = [...new Set(activeParticipants.map(p => p.user_id))];
            const { data: profiles } = await supabase
                .from('user_profiles')
                .select('id, username, avatar_url')
                .in('id', userIds);

            const participantsWithUsers = activeParticipants.map(p => ({
                ...p,
                user: profiles?.find(profile => profile.id === p.user_id)
            }));
            
            setParticipantsData(participantsWithUsers as PodParticipant[]);
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
        }, async (payload: any) => {
            // OPTIMIZATION: Refetch if:
            // 1. Role is host/speaker (join/leave/change)
            // 2. Hand raised status changes (request/cancel/approve)
            // 3. It's the current user (so they see their own state updates)
            
            // const isRelevantUpdate = 
            //    (payload.new && (['host', 'speaker', 'officer'].includes(payload.new.role) || payload.new.is_hand_raised || payload.new.user_id === currentUser?.id)) ||
            //    (payload.old && (['host', 'speaker', 'officer'].includes(payload.old.role) || payload.old.is_hand_raised || payload.old.user_id === currentUser?.id));

            // ALWAYS refetch if there's any update to participants table for now to debug sync issues
            // In high scale, we'd revert to the optimization above
            fetchParticipants();

            if (payload.eventType === 'INSERT') setParticipantCount(prev => prev + 1);
            if (payload.eventType === 'DELETE') setParticipantCount(prev => Math.max(0, prev - 1));
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
            if (currentUser && payload.new.user_id === currentUser.id) {
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
        // Check ban first
        const { data: ban } = await supabase
            .from('pod_bans')
            .select('id')
            .eq('room_id', roomId)
            .eq('user_id', currentUser.id)
            .maybeSingle();
        
        if (ban) {
             toast.error('You are banned from this pod');
             navigate('/pods');
             return;
        }

        // Check whitelist
        const { data: whitelist } = await supabase
            .from('pod_whitelists')
            .select('id')
            .eq('room_id', roomId)
            .eq('user_id', currentUser.id)
            .maybeSingle();

        const initialRole = whitelist ? 'speaker' : 'listener';

        // Check if already in participants table
        const { data } = await supabase
            .from('pod_room_participants')
            .select('id, role')
            .eq('room_id', roomId)
            .eq('user_id', currentUser.id)
            .maybeSingle();
        
        if (!data) {
            // Not in table, insert
            await supabase.from('pod_room_participants').insert({
                room_id: roomId,
                user_id: currentUser.id,
                role: initialRole,
                is_hand_raised: false
            });
        } else if (whitelist && data.role === 'listener') {
            // Upgrade if whitelisted but currently listener
             await supabase.from('pod_room_participants')
                .update({ role: 'speaker' })
                .eq('id', data.id);
        }
    };

    joinAsListener();
  }, [roomId, currentUser, navigate]);


  // Actions
  const handleRequestSpeak = async () => {
    if (!currentUser || !roomId || !room) return;
    
    // 1. Paid Entry
    if (room.guest_price > 0) {
        if (confirm(`Join stage for ${room.guest_price} coins?`)) {
            const { data, error } = await supabase.rpc('join_pod_speaker_paid', { 
                p_room_id: roomId, 
                p_user_id: currentUser.id 
            });
    
            if (error) {
                console.error(error);
                toast.error('Transaction failed');
                return;
            }

            if (!data.success) {
                toast.error(data.error || 'Failed to join stage');
            } else {
                toast.success('Joined stage!');
            }
        }
        return;
    }

    // 2. Free Request
    // Try update first (most common case since user should be joined)
    const { error, count } = await supabase.from('pod_room_participants')
        .update({ is_hand_raised: true })
        .eq('room_id', roomId)
        .eq('user_id', currentUser.id)
        .select('id');

    if (error) {
        console.error('Error requesting to speak:', error);
        toast.error('Failed to request to speak');
        return;
    }

    if (count === 0) {
        // User not in DB (rare race condition), insert them
        const { error: insertError } = await supabase.from('pod_room_participants').insert({
            room_id: roomId,
            user_id: currentUser.id,
            role: 'listener',
            is_hand_raised: true
        });
        
        if (insertError) {
             console.error('Error joining with request:', insertError);
             toast.error('Failed to request to speak');
        } else {
             toast.success('Request sent to host');
        }
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
      // Check speaker limit (3 guests max)
      const currentSpeakers = participantsData.filter(p => p.role === 'speaker');
      if (currentSpeakers.length >= 3) {
        toast.error('Guest limit reached (3 guests max)');
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
  const isGuest = !currentUser;
  const myRole = participantsData.find(p => p.user_id === currentUser?.id)?.role;
  const canPublish = isHost || myRole === 'speaker';
  const isStaff = profile?.role === 'admin' || profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer' || profile?.is_admin || profile?.is_troll_officer || false;

  const { token, serverUrl, isLoading, error } = useLiveKitToken({
    streamId: roomId,
    roomName: roomId,
    userId: currentUser?.id,
    isHost: isHost,
    canPublish: canPublish,
    isGuest: isGuest,
    enabled: true // Always fetch token for everyone (LiveKit only)
  });

  if (!room) return <div className="flex items-center justify-center h-screen bg-black text-white">Loading room...</div>;
  
  if (isLoading) return <div className="flex items-center justify-center h-screen bg-black text-white">Connecting to Pod...</div>;
  if (error) return <div className="flex items-center justify-center h-screen bg-black text-white">Error: {error}</div>;
  if (!token || !serverUrl) return <div className="flex items-center justify-center h-screen bg-black text-white">Initializing connection...</div>;

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      video={false} // Pods are audio-only
      audio={canPublish} // Only publish audio if host/speaker
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
        isStaff={isStaff}
        canPublish={canPublish}
        isGuest={isGuest}
      />
    </LiveKitRoom>
  );
}
