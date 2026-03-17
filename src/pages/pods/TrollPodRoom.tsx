import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Mic, MicOff, Users, Hand, Settings, LogOut, XCircle } from 'lucide-react';

import { toast } from 'sonner';
import { useAuthStore } from '../../lib/store';
import PodParticipantBox from './PodParticipantBox';
import PodChatBox from './PodChatBox';
import PodHostControlPanel from './PodHostControlPanel';
import PodRoomContent from './PodRoomContent';
import { RemoteParticipant } from "livekit-client";
import useLiveKitRoom from '../../hooks/useLiveKitRoom';

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

  // Under construction - redirect to pods listing with message
  useEffect(() => {
    toast.info('Troll Pods are currently under construction. Please check back soon!');
    navigate('/pods');
  }, [navigate]);

  // Early return after redirect
  if (!roomId) {
    return null;
  }

  const isHost = room?.host_id === currentUser?.id;
  const myRecord = participantsData.find((p) => p.user_id === currentUser?.id);
  const canPublish = isHost || myRecord?.role === 'speaker' || myRecord?.role === 'officer';

  // Ref to prevent reconnect churn
  const hasJoinedLiveKitRef = useRef(false);

  // Use LiveKit hook for both host and listeners
  const {
    isConnected: isLiveKitConnected,
    isPublishing,
    remoteUsers,
    localAudioTrack,
    error: liveKitError,
    joinAsPublisher,
    joinAsAudience,
    leaveRoom,
    toggleMicrophone
  } = useLiveKitRoom({
    roomId: roomId || '',
    roomType: 'pod',
    audioOnly: true, // Pods are audio-only
    publish: canPublish,
    onUserJoined: (participant) => {
      console.log('[TrollPodRoom] LiveKit user joined:', participant.identity);
    },
    onUserLeft: (participant) => {
      console.log('[TrollPodRoom] LiveKit user left:', participant.identity);
    },
    onError: (err) => {
      console.error('[TrollPodRoom] LiveKit error:', err);
      // Ignore getUserMedia errors - these are usually from LiveKit's internal reconnection
      // and don't affect the actual connection
      if (err && err.message && err.message.includes('getUserMedia')) {
        console.warn('[TrollPodRoom] Ignoring getUserMedia error - connection may still work');
        return;
      }
      toast.error('Failed to connect to audio');
    }
  });

  // Refs for stable callback references (initialized after hook)
  const joinAsPublisherRef = useRef(joinAsPublisher);
  const joinAsAudienceRef = useRef(joinAsAudience);
  
  // Update refs when functions change
  useEffect(() => {
    joinAsPublisherRef.current = joinAsPublisher;
    joinAsAudienceRef.current = joinAsAudience;
  }, [joinAsPublisher, joinAsAudience]);

  // Join LiveKit room when ready (only once per session)
  useEffect(() => {
    if (!roomId || !currentUser || !room) return;
    // Already joined in this session
    if (hasJoinedLiveKitRef.current) return;

    const joinLiveKit = async () => {
      try {
        if (isHost || myRecord?.role === 'speaker' || myRecord?.role === 'officer') {
          await joinAsPublisherRef.current(currentUser.id);
          console.log('[TrollPodRoom] Joined as publisher (host/speaker)');
        } else {
          await joinAsAudienceRef.current(currentUser.id);
          console.log('[TrollPodRoom] Joined as audience (listener)');
        }

        hasJoinedLiveKitRef.current = true;
      } catch (err) {
        console.error('[TrollPodRoom] Failed to join LiveKit:', err);
      }
    };

    joinLiveKit();
  }, [roomId, currentUser?.id, room, isHost, myRecord?.role]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      hasJoinedLiveKitRef.current = false;
      leaveRoom();
    };
  }, [leaveRoom]);

  // Handle mic toggle
  const handleToggleMic = useCallback(async () => {
    if (!localAudioTrack) return;
    await toggleMicrophone();
  }, [localAudioTrack, toggleMicrophone]);
  
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
          navigate(`/pods/${roomId}/summary`);
        }
        setRoom(payload.new as Room);
        const newCount = payload.new.current_viewers || payload.new.viewer_count;
        if (newCount !== undefined) setParticipantCount(newCount);
      })
      .subscribe();

    // Heartbeat
    const roomHeartbeat = setInterval(() => {
      roomChannel.send({
        type: 'broadcast',
        event: 'ping',
        payload: { timestamp: Date.now(), room_id: roomId }
      }).catch(() => {});
    }, 30000);

    return () => {
      clearInterval(roomHeartbeat);
      supabase.removeChannel(roomChannel);
    };
  }, [roomId, navigate]);

  // Fetch & Subscribe Participants
  useEffect(() => {
    if (!roomId) return;

    const fetchParticipants = async () => {
      // Get hosts, speakers, officers, and raised hands
      const { data: activeParticipants } = await supabase
        .from('pod_room_participants')
        .select('*')
        .eq('room_id', roomId)
        .or(`role.in.(host,speaker,officer),is_hand_raised.eq.true${currentUser ? `,user_id.eq.${currentUser.id}` : ''}`);
      
      // Get count
      const { count } = await supabase
        .from('pod_room_participants')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomId);
      
      if (count !== null) setParticipantCount(count);

      if (activeParticipants) {
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
            // Check if someone raised their hand
            if (payload.new && payload.new.is_hand_raised === true && payload.new.role === 'listener') {
                // Get the requester's username
                const { data: requester } = await supabase
                    .from('user_profiles')
                    .select('username')
                    .eq('id', payload.new.user_id)
                    .single();
                
                if (requester) {
                    toast.info(`${requester.username} wants to speak!`);
                }
            }
            
            fetchParticipants();
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

    const participantsHeartbeat = setInterval(() => {
      participantsChannel.send({
        type: 'broadcast',
        event: 'ping',
        payload: { timestamp: Date.now(), room_id: roomId, channel: 'participants' }
      }).catch(() => {});
    }, 30000);

    const bansHeartbeat = setInterval(() => {
      bansChannel.send({
        type: 'broadcast',
        event: 'ping',
        payload: { timestamp: Date.now(), room_id: roomId, channel: 'bans' }
      }).catch(() => {});
    }, 30000);

    return () => {
        clearInterval(participantsHeartbeat);
        clearInterval(bansHeartbeat);
        supabase.removeChannel(participantsChannel);
        supabase.removeChannel(bansChannel);
    };
  }, [roomId, currentUser, navigate]);

  // Auto-join as listener (for chat/RLS)
  useEffect(() => {
    if (!roomId || !currentUser || !room) return;

    const joinAsListener = async () => {
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

      const { data: whitelist } = await supabase
        .from('pod_whitelists')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', currentUser.id)
        .maybeSingle();

      const initialRole: PodParticipant['role'] =
        room.host_id === currentUser.id
          ? 'host'
          : whitelist
            ? 'speaker'
            : 'listener';

      const { data } = await supabase
        .from('pod_room_participants')
        .select('id, role')
        .eq('room_id', roomId)
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (!data) {
        await supabase.from('pod_room_participants').insert({
          room_id: roomId,
          user_id: currentUser.id,
          role: initialRole,
          is_hand_raised: false
        });
      } else if (room.host_id === currentUser.id && data.role !== 'host') {
        await supabase
          .from('pod_room_participants')
          .update({ role: 'host', is_hand_raised: false })
          .eq('id', data.id);
      } else if (whitelist && data.role === 'listener') {
        await supabase
          .from('pod_room_participants')
          .update({ role: 'speaker' })
          .eq('id', data.id);
      }
    };

    joinAsListener();
  }, [roomId, currentUser, navigate, room]);

  // Actions
  const handleRequestSpeak = async () => {
    if (!currentUser || !roomId || !room) return;
    
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
      const participant = participantsData.find(p => p.user_id === userId);
      if (!participant) return;

      if (participant.role === 'speaker') {
           await supabase.from('pod_room_participants')
            .update({ role: 'listener', is_hand_raised: false })
            .eq('room_id', roomId)
            .eq('user_id', userId);
           toast.success('Speaker removed from stage');
      } else {
           await supabase.from('pod_room_participants')
            .update({ is_hand_raised: false })
            .eq('room_id', roomId)
            .eq('user_id', userId);
           toast.info('Request denied');
      }
  };

  const isGuest = !currentUser && !profile;
  const isStaff = profile?.is_staff || false;

  // End pod - Navigate to summary
  const handleEndPod = async () => {
    if (!roomId || !isHost) return;
    
    if (!confirm('Are you sure you want to end this pod?')) return;
    
    try {
      // Leave LiveKit first
      await leaveRoom();
      
      const { error } = await supabase
        .from('pod_rooms')
        .update({ is_live: false, ended_at: new Date().toISOString() })
        .eq('id', roomId);
      
      if (error) throw error;
      
      toast.success('Pod ended');
      navigate(`/pods/${roomId}/summary`);
    } catch (err) {
      console.error('Error ending pod:', err);
      toast.error('Failed to end pod');
    }
  };

  // Leave pod
  const handleLeavePod = async () => {
    if (!roomId || !currentUser) return;
    
    if (!confirm('Leave this pod?')) return;
    
    try {
      // Leave LiveKit first
      await leaveRoom();
      
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
      onToggleMic={handleToggleMic}
    />
  );
}
