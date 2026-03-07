import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Mic, MicOff, Users, MessageSquare, Hand, UserMinus, UserPlus, Settings, Coins, Map, LogOut, XCircle } from 'lucide-react';

import { toast } from 'sonner';
import { useAuthStore } from '../../lib/store';
import { emitEvent as triggerEvent } from '../../lib/events';
import PodParticipantBox from './PodParticipantBox';
import PodChatBox from './PodChatBox';
import PodHostControlPanel from './PodHostControlPanel';
import AgoraRTC, {
  ILocalAudioTrack,
} from 'agora-rtc-sdk-ng';
import PodRoomContent from './PodRoomContent';
import { IAgoraRTCRemoteUser, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';


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
  is_hand_raised: boolean;
  user?: {
    username: string;
    avatar_url: string;
  };
}

export default function TrollPodRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const { user: currentUser, profile } = useAuthStore();
  const [participantsData, setParticipantsData] = useState<PodParticipant[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
    const [agoraClient, setAgoraClient] = useState<IAgoraRTCClient | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<ILocalAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);

  const isHost = room?.host_id === currentUser?.id;
  const myRecord = participantsData.find((p) => p.user_id === currentUser?.id);
  const canPublish = isHost || myRecord?.role === 'speaker' || myRecord?.role === 'officer';

  useEffect(() => {
    if (!roomId || !currentUser) return;

    const roomName = `pod-${roomId}`;
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    setAgoraClient(client);

    const joinChannel = async () => {
      if (canPublish) {
        // Convert user ID to numeric UID for Agora
        const stringToUid = (str: string): number => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
          }
          return Math.abs(hash);
        };
        const numericUid = stringToUid(currentUser.id);
        
        // Fetch Agora token using edge function
        const { data, error } = await supabase.functions.invoke('agora-token', {
          body: {
            channel: roomName,
            uid: numericUid
          }
        });
        
        if (error || !data?.token) {
          console.error('Error fetching token', error || 'No token returned');
          return;
        }
        
        await client.join(
          import.meta.env.VITE_AGORA_APP_ID!,
          roomName,
          data.token,
          currentUser.id
        );

        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        await client.publish([audioTrack]);
        setLocalAudioTrack(audioTrack);
      } else {
        // Listeners: use Agora to subscribe to the pod audio
        const stringToUid = (str: string): number => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
          }
          return Math.abs(hash);
        };
        const listenerUid = stringToUid(currentUser.id);
        
        try {
          // Get listener token
          const { data: tokenData, error: tokenError } = await supabase.functions.invoke('agora-token', {
            body: {
              channel: roomName,
              uid: listenerUid,
              role: 'subscriber'
            }
          });

          if (tokenError || !tokenData?.token) {
            console.error('Listener token error', tokenError);
            return;
          }

          const appId = import.meta.env.VITE_AGORA_APP_ID;
          
          if (!appId) {
            console.warn('VITE_AGORA_APP_ID not configured');
            return;
          }

          await client.join(
            appId,
            roomName,
            tokenData.token,
            listenerUid
          );
          
          console.log('[TrollPodRoom] Listener joined Agora successfully');
          
        } catch (listenerErr) {
          console.error('[TrollPodRoom] Listener join error:', listenerErr);
        }
      }
    };

    joinChannel();

    const handleUserPublished = async (
      user: IAgoraRTCRemoteUser,
      mediaType: 'audio' | 'video'
    ) => {
      await client.subscribe(user, mediaType);
      if (mediaType === 'audio') {
        setRemoteUsers((prevUsers) => [...prevUsers.filter(u => u.uid !== user.uid), user]);
        if (user.audioTrack) {
            user.audioTrack.play();
        }
      }
    };

    const handleUserUnpublished = (user: IAgoraRTCRemoteUser) => {
      setRemoteUsers((prevUsers) =>
        prevUsers.filter((remoteUser) => remoteUser.uid !== user.uid)
      );
    };

    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);

    return () => {
      client.off('user-published', handleUserPublished);
      client.off('user-unpublished', handleUserUnpublished);
      localAudioTrack?.close();
      client.leave();
    };
  }, [roomId, canPublish, currentUser]);
  
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

    // Heartbeat to keep connection alive
    const roomHeartbeat = setInterval(() => {
      roomChannel.send({
        type: 'broadcast',
        event: 'ping',
        payload: { timestamp: Date.now(), room_id: roomId }
      }).catch(() => {});
    }, 30000); // Every 30 seconds

    return () => {
      clearInterval(roomHeartbeat);
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

    // Heartbeat to keep connections alive
    const participantsHeartbeat = setInterval(() => {
      participantsChannel.send({
        type: 'broadcast',
        event: 'ping',
        payload: { timestamp: Date.now(), room_id: roomId, channel: 'participants' }
      }).catch(() => {});
    }, 30000); // Every 30 seconds

    const bansHeartbeat = setInterval(() => {
      bansChannel.send({
        type: 'broadcast',
        event: 'ping',
        payload: { timestamp: Date.now(), room_id: roomId, channel: 'bans' }
      }).catch(() => {});
    }, 30000); // Every 30 seconds

    return () => {
        clearInterval(participantsHeartbeat);
        clearInterval(bansHeartbeat);
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

  const isGuest = !currentUser && !profile;
  const isStaff = profile?.is_staff || false;

  // End pod - Host only
  const handleEndPod = async () => {
    if (!roomId || !isHost) return;
    
    if (!confirm('Are you sure you want to end this pod?')) return;
    
    try {
      const { error } = await supabase
        .from('pod_rooms')
        .update({ is_live: false, ended_at: new Date().toISOString() })
        .eq('id', roomId);
      
      if (error) throw error;
      
      toast.success('Pod ended');
      navigate('/pods');
    } catch (err) {
      console.error('Error ending pod:', err);
      toast.error('Failed to end pod');
    }
  };

  // Leave pod - For listeners
  const handleLeavePod = async () => {
    if (!roomId || !currentUser) return;
    
    if (!confirm('Leave this pod?')) return;
    
    try {
      // Remove from participants
      await supabase
        .from('pod_room_participants')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', currentUser.id);
      
      navigate('/pods');
    } catch (err) {
      console.error('Error leaving pod:', err);
      toast.error('Failed to leave pod');
    }
  };

  return (
    <PodRoomContent
      room={room!}
      currentUser={currentUser}
      isHost={isHost}
      participantsData={participantsData}
      participantCount={participantCount}
      onRequestSpeak={handleRequestSpeak}
      onApproveRequest={handleApproveRequest}
      onRemoveSpeaker={handleRemoveSpeaker}
      onCancelRequest={handleCancelRequest}
      onEndPod={handleEndPod}
      onLeavePod={handleLeavePod}
      isStaff={isStaff}
      canPublish={canPublish}
      isGuest={isGuest}
      remoteUsers={remoteUsers}
      localAudioTrack={localAudioTrack}
    />
  );
}
