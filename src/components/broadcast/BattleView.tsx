import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import AgoraRTC, { IAgoraRTCClient, IRemoteUser, IRemoteVideoTrack, IRemoteAudioTrack, ILocalVideoTrack, ILocalAudioTrack, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";

import { supabase } from '../../lib/supabase';
import { Stream } from '../../types/broadcast';
import { useAuthStore } from '../../lib/store';
import { Loader2, Coins, User, MicOff, VideoOff, Plus, Minus } from 'lucide-react';
import BroadcastChat from './BroadcastChat';
import MuteHandler from './MuteHandler';
import GiftAnimationOverlay from './GiftAnimationOverlay';
import GiftTray from './GiftTray';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

// --- Sub-components for the new architecture ---

const AgoraVideoPlayer = ({ videoTrack, isLocal }: { videoTrack?: ILocalVideoTrack | IRemoteVideoTrack; isLocal: boolean }) => {
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoTrack && videoRef.current) {
      videoTrack.play(videoRef.current);
      if (isLocal) {
        // Apply mirror effect for local video
        videoRef.current.style.transform = 'scaleX(-1)';
      } else {
        videoRef.current.style.transform = '';
      }
    }

    return () => {
      if (videoTrack) {
        videoTrack.stop();
      }
    };
  }, [videoTrack, isLocal]);

  return <div ref={videoRef} className="w-full h-full object-cover"></div>;
};

interface AgoraBattleParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
  videoTrack?: ILocalVideoTrack | IRemoteVideoTrack;
  audioTrack?: ILocalAudioTrack | IRemoteAudioTrack;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  metadata: any;
  role?: 'host' | 'stage' | 'viewer';
  team?: 'challenger' | 'opponent';
  sourceStreamId?: string;
  seatIndex?: number;
}
const BattleParticipantTile = ({
  identity,
  name,
  isLocal,
  videoTrack,
  audioTrack,
  isMicrophoneEnabled,
  isCameraEnabled,
  metadata,
  side
}: AgoraBattleParticipant & { side: 'challenger' | 'opponent' }) => {
  const isHost = metadata.role === 'host';
  const isMicMuted = !isMicrophoneEnabled;
  const isVideoOn = isCameraEnabled && !!videoTrack;

  console.log(`[BattleParticipantTile] Rendering ${identity}:`, {
    hasVideoTrack: !!videoTrack,
    isCameraEnabled,
    metadata
  });

  return (
    <div className={cn(
      "relative bg-zinc-900/50 rounded-xl overflow-hidden border transition-all duration-300",
      isHost ? "h-64 border-amber-500/30" : "h-40 border-white/10",
      side === 'challenger' ? "hover:border-purple-500/50" : "hover:border-emerald-500/50"
    )}>
      {isVideoOn ? (
        <AgoraVideoPlayer
          videoTrack={videoTrack}
          isLocal={isLocal}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
           <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center border-2 border-white/10 mb-2">
              <User className="text-zinc-500" size={32} />
           </div>
           <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <VideoOff size={14} />
                <span>Camera Off</span>
           </div>
        </div>
      )}

      {/* Overlay Info */}
      <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-10">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
          <span className={cn(
            "text-xs font-bold",
            isHost ? "text-amber-400" : "text-white"
          )}>
            {name || 'Anonymous'}
          </span>
          {isHost && (
            <span className="text-[8px] bg-red-600 px-1 rounded text-white font-bold uppercase">HOST</span>
          )}
        </div>
        
        {isMicMuted && (
          <div className="bg-red-500 p-1 rounded-full">
            <MicOff size={12} className="text-white" />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * The main split arena component
 */
interface BattleArenaProps {
  onGift: (uid: string, sourceStreamId: string) => void;
  battleId: string;
  localAudioTrack: ILocalAudioTrack | null;
  localVideoTrack: ILocalVideoTrack | null;
  remoteUsers: IRemoteUser[];
  challengerStreamId: string;
  opponentStreamId: string;
  challengerHostId: string;
  opponentHostId: string;
}

const BattleArena = ({
  onGift,
  battleId,
  localAudioTrack,
  localVideoTrack,
  remoteUsers,
  challengerStreamId,
  opponentStreamId,
  challengerHostId,
  opponentHostId
}: BattleArenaProps) => {
  const { user } = useAuthStore();
  const [allBattleParticipants, setAllBattleParticipants] = useState<AgoraBattleParticipant[]>([]);
  
  useEffect(() => {
    const fetchParticipantData = async () => {
      // Helper to fetch participant details from Supabase
      const getSupabaseParticipant = async (userId: string) => {
        const { data, error } = await supabase
          .from('battle_participants')
          .select('*')
          .eq('battle_id', battleId)
          .eq('user_id', userId)
          .maybeSingle();
        if (error) console.error(`Failed to fetch battle_participant for user ${userId}:`, error);
        return data;
      };

      const participantsData: AgoraBattleParticipant[] = [];

      // Local participant
      if (user) {
        const localSupabaseParticipant = await getSupabaseParticipant(user.id);
        let localMetadata = {};
        if (localSupabaseParticipant?.metadata) {
            try {
                localMetadata = JSON.parse(localSupabaseParticipant.metadata);
            } catch (e) {
                console.error("Failed to parse metadata for local user:", user.id, e);
            }
        }
        participantsData.push({
          identity: user.id,
          name: localSupabaseParticipant?.username || user.username || 'You',
          isLocal: true,
          videoTrack: localVideoTrack,
          audioTrack: localAudioTrack,
          isMicrophoneEnabled: localAudioTrack?.enabled,
          isCameraEnabled: localVideoTrack?.enabled,
          metadata: localMetadata,
          role: localSupabaseParticipant?.role,
          team: localSupabaseParticipant?.team,
          sourceStreamId: localMetadata.sourceStreamId,
          seatIndex: localMetadata.seatIndex,
        });
      }

      // Remote participants
      for (const remoteUser of remoteUsers) {
        const remoteSupabaseParticipant = await getSupabaseParticipant(remoteUser.uid.toString());
        let remoteMetadata = {};
        if (remoteSupabaseParticipant?.metadata) {
            try {
                remoteMetadata = JSON.parse(remoteSupabaseParticipant.metadata);
            } catch (e) {
                console.error("Failed to parse metadata for remote user:", remoteUser.uid, e);
            }
        }
        participantsData.push({
          identity: remoteUser.uid.toString(),
          name: remoteSupabaseParticipant?.username || `User ${remoteUser.uid}`,
          isLocal: false,
          videoTrack: remoteUser.videoTrack,
          audioTrack: remoteUser.audioTrack,
          isMicrophoneEnabled: remoteUser.audioTrack?.enabled,
          isCameraEnabled: remoteUser.videoTrack?.enabled,
          metadata: remoteMetadata,
          role: remoteSupabaseParticipant?.role,
          team: remoteSupabaseParticipant?.team,
          sourceStreamId: remoteMetadata.sourceStreamId,
          seatIndex: remoteMetadata.seatIndex,
        });
      }
      setAllBattleParticipants(participantsData);
    };

    fetchParticipantData();
  }, [remoteUsers, user, localAudioTrack, localVideoTrack, battleId]);

  const categorized = useMemo(() => {
    const teams = {
      challenger: { host: null as AgoraBattleParticipant | null, guests: [] as AgoraBattleParticipant[] },
      opponent: { host: null as AgoraBattleParticipant | null, guests: [] as AgoraBattleParticipant[] }
    };

    allBattleParticipants.forEach(p => {
      if (p.team === 'challenger' || p.team === 'opponent') {
        if (p.role === 'host') {
          teams[p.team].host = p;
        } else if (p.role === 'stage') {
          teams[p.team].guests.push(p);
        }
      }
    });

    const sortBySeat = (a: AgoraBattleParticipant, b: AgoraBattleParticipant) => {
      return (a.seatIndex || 0) - (b.seatIndex || 0);
    };
    
    teams.challenger.guests.sort(sortBySeat);
    teams.opponent.guests.sort(sortBySeat);

    return teams;
  }, [allBattleParticipants]);

  const handleGiftClick = (p: AgoraBattleParticipant) => {
    const resolvedStreamId =
      p.sourceStreamId ||
      (p.team === 'challenger' ? challengerStreamId : p.team === 'opponent' ? opponentStreamId : '');

    if (!resolvedStreamId || !p.identity) return;
    onGift(p.identity, resolvedStreamId);
  };

  const handleSideGiftClick = (team: 'challenger' | 'opponent') => {
    const streamId = team === 'challenger' ? challengerStreamId : opponentStreamId;
    const hostId = team === 'challenger' ? challengerHostId : opponentHostId;
    if (!streamId || !hostId) return;
    onGift(hostId, streamId);
  };

  return (
    <div className="flex-1 flex overflow-hidden p-4 gap-4 bg-black/40">
      {/* Challenger Side */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-hide">
        <button
          onClick={() => handleSideGiftClick('challenger')}
          className="self-start px-3 py-1 text-xs font-bold rounded-full bg-purple-600/80 hover:bg-purple-500 text-white border border-purple-400/30"
        >
          Gift Side A
        </button>
        {categorized.challenger.host && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleGiftClick(categorized.challenger.host!);
            }}
            className="cursor-pointer"
          >
            <BattleParticipantTile {...categorized.challenger.host} side="challenger" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          {categorized.challenger.guests.map(p => (
            <div
              key={p.identity}
              onClick={(e) => {
                e.stopPropagation();
                handleGiftClick(p);
              }}
              className="cursor-pointer"
            >
              <BattleParticipantTile {...p} side="challenger" />
            </div>
          ))}
        </div>
      </div>

      {/* VS Divider (Visual Only) */}
      <div className="w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      {/* Opponent Side */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pl-2 scrollbar-hide">
        <button
          onClick={() => handleSideGiftClick('opponent')}
          className="self-start px-3 py-1 text-xs font-bold rounded-full bg-emerald-600/80 hover:bg-emerald-500 text-white border border-emerald-400/30"
        >
          Gift Side B
        </button>
        {categorized.opponent.host && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleGiftClick(categorized.opponent.host!);
            }}
            className="cursor-pointer"
          >
            <BattleParticipantTile {...categorized.opponent.host} side="opponent" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          {categorized.opponent.guests.map(p => (
            <div
              key={p.identity}
              onClick={(e) => {
                e.stopPropagation();
                handleGiftClick(p);
              }}
              className="cursor-pointer"
            >
              <BattleParticipantTile {...p} side="opponent" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MemoBattleArena = React.memo(BattleArena);

// --- Main Component ---

interface BattleViewProps {
  battleId: string;
  currentStreamId: string; // The stream ID the user originally navigated to
  viewerId?: string;
  localTracks?: [IMicrophoneAudioTrack, ICameraVideoTrack] | null;
}

export default function BattleView({ battleId, currentStreamId, viewerId, localTracks: passedLocalTracks }: BattleViewProps) {
  const [battle, setBattle] = useState<any>(null);
  const [challengerStream, setChallengerStream] = useState<Stream | null>(null);
  const [opponentStream, setOpponentStream] = useState<Stream | null>(null);
  const [participantInfo, setParticipantInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [agoraClient, setAgoraClient] = useState<IAgoraRTCClient | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<ILocalAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ILocalVideoTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IRemoteUser[]>([]);
  const [participantSnapshots, setParticipantSnapshots] = useState<Array<{ user_id: string; role: 'host' | 'stage' | 'viewer' }>>([]);
  const [arenaReadyAtMs, setArenaReadyAtMs] = useState<number | null>(null);
  const [arenaReady, setArenaReady] = useState(false);
  const publishedArenaReadyRef = useRef(false);
  
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const effectiveUserId = viewerId || user?.id;

  // isBroadcaster needs to be defined before the useEffect that uses it
  const isBroadcaster = participantInfo?.role === 'host' || participantInfo?.role === 'stage';

  // 🔍 DIAGNOSTIC LOGGING for battle stream tracking
  useEffect(() => {
    console.log('🎮 [BattleView] Component State:', {
      battleId,
      currentStreamId,
      roomName: `battle-${battleId}`,
      effectiveUserId,
      participantRole: participantInfo?.role,
      participantTeam: participantInfo?.team,
      challengerStreamId: challengerStream?.id,
      opponentStreamId: opponentStream?.id,
      timestamp: new Date().toISOString()
    });
  }, [battleId, currentStreamId, effectiveUserId, participantInfo, challengerStream?.id, opponentStream?.id]);

  useEffect(() => {
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    setAgoraClient(client);
    let mounted = true;
    let createdAudioTrack: ILocalAudioTrack | null = null;
    let createdVideoTrack: ILocalVideoTrack | null = null;

    const joinBattle = async () => {
      if (!battle || !effectiveUserId) return;

      const roomName = `battle-${battle.id}`;

      if (isBroadcaster) {
        try {
          const { data, error } = await supabase.functions.invoke('get-agora-token', {
            body: { channelName: roomName, userId: effectiveUserId },
          });
          if (error) throw error;

          await client.join(import.meta.env.VITE_AGORA_APP_ID!, roomName, data.token, effectiveUserId);

          // Use passed tracks from BroadcastPage if available, otherwise create new ones
          if (passedLocalTracks && passedLocalTracks[0] && passedLocalTracks[1]) {
            console.log('[BattleView] Using passed local tracks from BroadcastPage');
            if (!mounted) return;
            setLocalAudioTrack(passedLocalTracks[0]);
            setLocalVideoTrack(passedLocalTracks[1]);
            await client.publish([passedLocalTracks[0], passedLocalTracks[1]]);
          } else {
            console.log('[BattleView] Creating new local tracks');
            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
              AEC: true,  // Acoustic Echo Cancellation
              AGC: true,  // Automatic Gain Control
              ANS: true   // Automatic Noise Suppression
            });
            const videoTrack = await AgoraRTC.createCameraVideoTrack();

            createdAudioTrack = audioTrack;
            createdVideoTrack = videoTrack;
            if (!mounted) return;
            setLocalAudioTrack(audioTrack);
            setLocalVideoTrack(videoTrack);

            await client.publish([audioTrack, videoTrack]);
          }
        } catch (error) {
          console.error("Failed to join battle as publisher:", error);
          toast.error("Couldn't connect to the battle.");
        }
      } else {
        // For now, viewers will also join Agora to see the battle.
        // This can be changed to Mux if a single stream is preferred for viewers.
        await client.join(import.meta.env.VITE_AGORA_APP_ID!, roomName, null, effectiveUserId);
      }
    };

    const handleUserPublished = async (user: IRemoteUser, mediaType: 'audio' | 'video') => {
      await client.subscribe(user, mediaType);
      setRemoteUsers((prev) => {
        const filtered = prev.filter((u) => u.uid !== user.uid);
        return [...filtered, user];
      });
    };

    const handleUserUnpublished = (user: IRemoteUser) => {
      setRemoteUsers((prev) => {
        const target = prev.find((u) => u.uid === user.uid);
        if (!target) return prev;
        if (!target.audioTrack && !target.videoTrack) {
          return prev.filter((u) => u.uid !== user.uid);
        }
        return [...prev];
      });
    };

    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);

    joinBattle();

    return () => {
      mounted = false;
      client.off('user-published', handleUserPublished);
      client.off('user-unpublished', handleUserUnpublished);
      if (createdAudioTrack) createdAudioTrack.close();
      if (createdVideoTrack) createdVideoTrack.close();
      client.leave();
    };
  }, [battle, effectiveUserId, isBroadcaster, passedLocalTracks]);

  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);
  const [giftStreamId, setGiftStreamId] = useState<string | null>(null);

  const handleGiftSelect = useCallback((uid: string, sourceStreamId: string) => {
    setGiftRecipientId(uid);
    setGiftStreamId(sourceStreamId);
  }, []);

  // isBroadcaster moved above useEffect to fix ReferenceError
  const myStream = useMemo(() => {
    if (!participantInfo?.team) return null;
    if (participantInfo.team === 'challenger') return challengerStream;
    if (participantInfo.team === 'opponent') return opponentStream;
    return null;
  }, [participantInfo?.team, challengerStream, opponentStream]);

  const updateMyStreamBoxCount = async (newCount: number) => {
    if (!myStream || participantInfo?.role !== 'host') return;

    if (newCount < 1) {
      toast.warning('Cannot have less than 1 box.');
      return;
    }
    if (newCount > 6) {
      toast.warning('Maximum 6 boxes allowed.');
      return;
    }

    const prevStream = myStream;
    if (participantInfo.team === 'challenger') {
      setChallengerStream({ ...myStream, box_count: newCount });
    } else if (participantInfo.team === 'opponent') {
      setOpponentStream({ ...myStream, box_count: newCount });
    }

    // Broadcast the change to all connected clients immediately
    try {
      const broadcastChannel = supabase.channel(`stream:${myStream.id}`);
      
      // Subscribe and wait for confirmation
      await new Promise<void>((resolve, reject) => {
        broadcastChannel.subscribe((status) => {
          console.log('[BoxCount] Battle channel subscription status:', status);
          if (status === 'SUBSCRIBED') {
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reject(new Error('Channel subscription failed'));
          }
        });
      });
      
      // Send the broadcast
      await broadcastChannel.send({
        type: 'broadcast',
        event: 'box_count_changed',
        payload: { box_count: newCount, stream_id: myStream.id }
      });
      console.log('[BoxCount] Battle broadcast sent');
      
      setTimeout(() => {
        supabase.removeChannel(broadcastChannel);
      }, 3000);
    } catch (broadcastErr) {
      console.warn('[BoxCount] Broadcast error (non-fatal):', broadcastErr);
    }

    const { error } = await supabase.rpc('set_stream_box_count', {
      p_stream_id: myStream.id,
      p_new_box_count: newCount
    });

    if (error) {
      toast.error('Failed to update box count.');
      if (participantInfo.team === 'challenger') {
        setChallengerStream(prevStream);
      } else if (participantInfo.team === 'opponent') {
        setOpponentStream(prevStream);
      }
    }
  };

  useEffect(() => {
    const initBattle = async () => {
        try {
            // 1. Fetch Battle
            const { data: battleData, error: battleError } = await supabase.from('battles').select('*').eq('id', battleId).maybeSingle();
            if (battleError || !battleData) return;
            setBattle(battleData);

            if (battleData.status === 'ended') {
                setShowResults(true);
            }

            // 2. Fetch Both Streams
            const { data: streams } = await supabase.from('streams').select('*').in('id', [battleData.challenger_stream_id, battleData.opponent_stream_id]);
            if (!streams) return;

            const cStream = streams.find(s => s.id === battleData.challenger_stream_id);
            const oStream = streams.find(s => s.id === battleData.opponent_stream_id);
            
            setChallengerStream(cStream || null);
            setOpponentStream(oStream || null);

            // 3. Fetch My Participant Info
            if (effectiveUserId) {
                const { data: pData, error: pError } = await supabase
                    .from('battle_participants')
                    .select('*')
                    .eq('battle_id', battleId)
                    .eq('user_id', effectiveUserId)
                    .maybeSingle();
                if (pError) {
                    console.error("Error fetching participant data", pError);
                }
                
                setParticipantInfo(pData || { role: 'viewer', team: null });

            }

            const { data: participantData } = await supabase
              .from('battle_participants')
              .select('user_id, role')
              .eq('battle_id', battleId);
            setParticipantSnapshots((participantData as Array<{ user_id: string; role: 'host' | 'stage' | 'viewer' }>) || []);
        } catch (e) {
            console.error("[BattleView] Initialization error:", e);
        } finally {
            setLoading(false);
        }
    };
    initBattle();

    // Subscribe to Battle Score Updates
    const channel = supabase.channel(`battle:${battleId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'battles',
            filter: `id=eq.${battleId}`
        }, (payload) => {
            const newBattle = payload.new;
            setBattle(newBattle);
            if (newBattle.status === 'ended') {
                setShowResults(true);
            }
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [battleId, effectiveUserId]);

  useEffect(() => {
    if (!battleId) return;
    const participantsChannel = supabase
      .channel(`battle_participants:${battleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'battle_participants', filter: `battle_id=eq.${battleId}` },
        async () => {
          const { data } = await supabase
            .from('battle_participants')
            .select('user_id, role')
            .eq('battle_id', battleId);
          setParticipantSnapshots((data as Array<{ user_id: string; role: 'host' | 'stage' | 'viewer' }>) || []);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(participantsChannel);
    };
  }, [battleId]);

  useEffect(() => {
    if (!battleId) return;

    const arenaChannel = supabase.channel(`battle_arena:${battleId}`);
    arenaChannel
      .on('broadcast', { event: 'arena_ready' }, (payload) => {
        const readyAtMs = Number(payload?.payload?.ready_at_ms || 0);
        if (!readyAtMs || arenaReadyAtMs) return;
        setArenaReadyAtMs(readyAtMs);
        setArenaReady(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(arenaChannel);
    };
  }, [battleId, arenaReadyAtMs]);

  useEffect(() => {
    if (!battle || battle.status !== 'active' || arenaReady) return;

    const expectedHosts = participantSnapshots.filter((p) => p.role === 'host').map((p) => p.user_id);
    const expectedStages = participantSnapshots.filter((p) => p.role === 'stage').map((p) => p.user_id);

    const loaded = new Set<string>();
    if (effectiveUserId && (localVideoTrack || localAudioTrack)) {
      loaded.add(String(effectiveUserId));
    }

    for (const remoteUser of remoteUsers) {
      const hasMedia = Boolean(remoteUser.videoTrack || remoteUser.audioTrack);
      if (!hasMedia) continue;
      loaded.add(String(remoteUser.uid));
    }

    const hostsReady = expectedHosts.length >= 2 && expectedHosts.every((id) => loaded.has(String(id)));
    const stagesReady = expectedStages.every((id) => loaded.has(String(id)));

    if (hostsReady && stagesReady) {
      const nowMs = Date.now();
      setArenaReadyAtMs(nowMs);
      setArenaReady(true);

      if (participantInfo?.role === 'host' && !publishedArenaReadyRef.current) {
        publishedArenaReadyRef.current = true;
        const publishChannel = supabase.channel(`battle_arena:${battleId}`);
        publishChannel.subscribe(async (status) => {
          if (status !== 'SUBSCRIBED') return;
          await publishChannel.send({
            type: 'broadcast',
            event: 'arena_ready',
            payload: { ready_at_ms: nowMs },
          });
          setTimeout(() => {
            supabase.removeChannel(publishChannel);
          }, 500);
        });
      }
    }
  }, [
    battle,
    arenaReady,
    participantSnapshots,
    remoteUsers,
    localVideoTrack,
    localAudioTrack,
    effectiveUserId,
    participantInfo?.role,
    battleId,
  ]);

  useEffect(() => {
    if (!battle || battle.status !== 'active' || arenaReady) return;
    const timeout = setTimeout(() => {
      if (arenaReady) return;
      setArenaReadyAtMs(Date.now());
      setArenaReady(true);
    }, 4500);
    return () => clearTimeout(timeout);
  }, [battle, arenaReady]);

  useEffect(() => {
    if (!challengerStream?.id && !opponentStream?.id) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    if (challengerStream?.id) {
      const c = supabase.channel(`battle_stream_${challengerStream.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${challengerStream.id}` },
          (payload) => {
            setChallengerStream((prev) => prev ? { ...prev, ...(payload.new as Stream) } : (payload.new as Stream));
          }
        )
        // Listen for custom box_count_changed events
        .on(
          'broadcast',
          { event: 'box_count_changed' },
          (payload) => {
            const boxData = payload.payload;
            if (boxData && boxData.box_count !== undefined) {
              setChallengerStream((prev) => prev ? { ...prev, box_count: boxData.box_count } : prev);
            }
          }
        )
        .subscribe();
      channels.push(c);
    }

    if (opponentStream?.id) {
      const c = supabase.channel(`battle_stream_${opponentStream.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${opponentStream.id}` },
          (payload) => {
            setOpponentStream((prev) => prev ? { ...prev, ...(payload.new as Stream) } : (payload.new as Stream));
          }
        )
        // Listen for custom box_count_changed events
        .on(
          'broadcast',
          { event: 'box_count_changed' },
          (payload) => {
            const boxData = payload.payload;
            if (boxData && boxData.box_count !== undefined) {
              setOpponentStream((prev) => prev ? { ...prev, box_count: boxData.box_count } : prev);
            }
          }
        )
        .subscribe();
      channels.push(c);
    }

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [challengerStream?.id, opponentStream?.id]);

  // Timer Logic
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isSuddenDeath, setIsSuddenDeath] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  const endBattle = useCallback(async (skipConfirmation = false) => {
      if (!battle || !user) return;
      
      if (!skipConfirmation && !confirm("Are you sure you want to end this battle?")) {
          return;
      }

      try {
        // Determine winner
        let winner_id = null;
        if (battle.score_challenger > battle.score_opponent) {
            winner_id = challengerStream?.user_id;
        } else if (battle.score_opponent > battle.score_challenger) {
            winner_id = opponentStream?.user_id;
        }

        const { data: endResult, error: endError } = await supabase.rpc('end_battle_guarded', {
          p_battle_id: battle.id,
          p_winner_id: winner_id
        });

        if (endError || !endResult?.success) {
          // If it failed because timer not elapsed, reset hasEnded to allow retry
          if (endResult?.message === 'Battle timer not elapsed') {
            console.warn("Server says timer not elapsed, retrying in 2 seconds...");
            setHasEnded(false);
            setTimeout(() => {
              if (participantInfo?.role === 'host') {
                setHasEnded(true);
                endBattle(true);
              }
            }, 2000);
          }
          return;
        }

        const { error: payoutError } = await supabase.rpc('distribute_battle_winnings', { p_battle_id: battle.id });
        if (payoutError) toast.error("Battle ended but payout failed.");
        else toast.success(`Battle Ended! Winnings distributed.`);
      } catch (e) {
          console.error(e);
      }
  }, [battle, user, challengerStream, opponentStream, participantInfo?.role]);

    const [leaveLoading, setLeaveLoading] = useState(false);

    const handleLeaveBattle = useCallback(async () => {
      if (!battle || !user) return;

      if (!confirm('Leave this battle and forfeit?')) {
        return;
      }

      setLeaveLoading(true);
      try {
        // Immediately set battle as ended locally to stop timer and update UI
        setBattle((prev: any) => prev ? { ...prev, status: 'ended' } : prev);
        setShowResults(true);

        const { data: leaveResult, error: leaveError } = await supabase.rpc('leave_battle', {
          p_battle_id: battle.id,
          p_user_id: user.id
        });

        if (leaveError || leaveResult?.success === false) {
          toast.error(leaveResult?.message || leaveError?.message || 'Failed to leave battle');
          // Still navigate away even if RPC fails
        } else {
          // Distribute winnings
          try {
            await supabase.rpc('distribute_battle_winnings', { p_battle_id: battle.id });
          } catch (payoutErr) {
            console.warn('Payout failed:', payoutErr);
          }
          toast.success('You left the battle. Opponent wins.');
        }
        
        // Navigate to summary when leaving battle
        navigate(`/summary/${currentStreamId}`);
      } catch (e) {
        console.error(e);
        toast.error('Failed to leave battle');
        // Navigate to summary even on error
        navigate(`/summary/${currentStreamId}`);
      } finally {
        setLeaveLoading(false);
      }
    }, [battle, user, navigate, currentStreamId, supabase]);

  useEffect(() => {
    if (!battle?.started_at || battle.status !== 'active' || !arenaReady) {
        if (battle?.status === 'ended') setHasEnded(true);
        return;
    }

    const interval = setInterval(() => {
        const now = new Date();
        const start = new Date(arenaReadyAtMs || battle.started_at);
        const elapsed = (now.getTime() - start.getTime()) / 1000;
        
        const BATTLE_DURATION = 180; 
        const SUDDEN_DEATH = 10; 
        
        if (elapsed < BATTLE_DURATION) {
            setTimeLeft(Math.ceil(BATTLE_DURATION - elapsed));
            setIsSuddenDeath(false);
        } else if (elapsed < BATTLE_DURATION + SUDDEN_DEATH) {
            setTimeLeft(Math.ceil((BATTLE_DURATION + SUDDEN_DEATH) - elapsed));
            setIsSuddenDeath(true);
        } else {
            setTimeLeft(0);
            setIsSuddenDeath(true);
            if (!hasEnded && participantInfo?.role === 'host') {
                setHasEnded(true);
                endBattle(true);
            }
        }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [battle?.started_at, battle?.status, participantInfo?.role, hasEnded, endBattle, arenaReady, arenaReadyAtMs]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Navigate to summary when battle ends (ALL users, ALL categories)
  useEffect(() => {
    if (showResults && battle?.status === 'ended') {
      const timer = setTimeout(() => {
        // Navigate to summary page when battle ends - ALL users, ALL categories
        navigate(`/summary/${currentStreamId}`);
      }, 5000); // 5 seconds to see results
      return () => clearTimeout(timer);
    }
  }, [showResults, battle?.status, navigate, currentStreamId]);

  if (loading || !battle || !challengerStream || !opponentStream) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-amber-500 gap-4">
        <Loader2 className="animate-spin" size={48} />
        <span className="font-medium animate-pulse">Joining Battle Arena...</span>
      </div>
    );
  }

  // Score percentages
  const totalScore = (battle?.score_challenger || 0) + (battle?.score_opponent || 0);
  const challengerPercent = totalScore === 0 ? 50 : Math.round((battle?.score_challenger / totalScore) * 100);
  const opponentPercent = 100 - challengerPercent;

  return (
    <div className="flex flex-col h-[100dvh] bg-black overflow-hidden">
        {/* Battle Header */}
        <div className="h-24 bg-zinc-900 border-b border-amber-500/30 flex items-center justify-between relative z-20 shadow-lg px-8">
            {/* Challenger Info */}
            <div className="flex-1 flex items-center justify-end gap-4">
                <div className="text-right">
                    <h2 className="text-xl font-bold text-white truncate max-w-[150px]">{challengerStream.title}</h2>
                    <div className="font-mono text-xl font-bold text-purple-400">
                        {(battle?.score_challenger || 0).toLocaleString()}
                    </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 border-2 border-white/20 flex items-center justify-center">
                    <User className="text-white" />
                </div>
            </div>

            {/* Center: Pot */}
            <div className="mx-8 flex flex-col items-center justify-center min-w-[200px]">
                <div className="flex flex-col items-center mb-1">
                    <span className="text-[10px] text-amber-500/70 uppercase tracking-widest font-bold">Pot</span>
                    <div className="flex items-center gap-2 text-amber-500 bg-amber-950/50 px-3 py-0.5 rounded-full border border-amber-500/30">
                        <Coins size={14} className="text-amber-400 fill-amber-400" />
                        <span className="font-mono text-xl font-black">
                            {((battle?.pot_challenger || 0) + (battle?.pot_opponent || 0)).toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Opponent Info */}
            <div className="flex-1 flex items-center justify-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-green-500 to-teal-500 border-2 border-white/20 flex items-center justify-center">
                    <User className="text-white" />
                </div>
                <div className="text-left">
                    <h2 className="text-xl font-bold text-white truncate max-w-[150px]">{opponentStream.title}</h2>
                    <div className="font-mono text-xl font-bold text-emerald-400">
                        {(battle?.score_opponent || 0).toLocaleString()}
                    </div>
                </div>
            </div>

            {participantInfo?.role === 'host' && (
              <div className="absolute top-2 right-4 flex items-center gap-2">
                {myStream && (
                  <div className="flex items-center gap-2 bg-black/50 border border-white/10 rounded-full px-3 py-1">
                    <span className="text-xs text-white/70">Boxes</span>
                    <button
                      onClick={() => updateMyStreamBoxCount((myStream.box_count || 1) - 1)}
                      className="p-1 rounded-full hover:bg-white/10 text-white/80"
                      aria-label="Decrease boxes"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-sm font-bold text-white min-w-[16px] text-center">
                      {myStream.box_count || 1}
                    </span>
                    <button
                      onClick={() => updateMyStreamBoxCount((myStream.box_count || 1) + 1)}
                      className="p-1 rounded-full hover:bg-white/10 text-white/80"
                      aria-label="Increase boxes"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                )}

                <button
                  onClick={handleLeaveBattle}
                  disabled={leaveLoading}
                  className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/80 hover:bg-red-500 text-white border border-red-500/40 transition disabled:opacity-60"
                >
                  {leaveLoading ? 'Leaving...' : 'Forfeit'}
                </button>
              </div>
            )}
            
            {/* Progress Bar */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-zinc-800 flex">
                <div 
                    className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-500" 
                    style={{ width: `${challengerPercent}%` }}
                />
                <div 
                    className="h-full bg-gradient-to-l from-green-500 to-teal-500 transition-all duration-500" 
                    style={{ width: `${opponentPercent}%` }}
                />
            </div>
        </div>

        {/* SHARED LIVEKIT ROOM */}

            <MemoBattleArena 
            onGift={handleGiftSelect} 
            battleId={battleId} 
            localAudioTrack={localAudioTrack}
            localVideoTrack={localVideoTrack}
            remoteUsers={remoteUsers}
            challengerStreamId={challengerStream.id}
            opponentStreamId={opponentStream.id}
            challengerHostId={challengerStream.user_id}
            opponentHostId={opponentStream.user_id}
          />

            {/* Central Floating Timer */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 flex flex-col items-center">
                <div className={cn(
                    "flex flex-col items-center justify-center p-6 rounded-3xl backdrop-blur-md border shadow-2xl transition-all duration-500",
                    isSuddenDeath 
                        ? "bg-red-950/40 border-red-500/50 scale-110 shadow-red-500/20" 
                        : "bg-black/40 border-white/10 shadow-black/50"
                )}>
                    <span className={cn(
                        "text-3xl font-black italic tracking-tighter mb-1",
                        isSuddenDeath ? "text-red-500 animate-pulse" : "text-amber-500"
                    )}>
                        {isSuddenDeath ? "SUDDEN DEATH" : "BATTLE TIME"}
                    </span>
                    <div className={cn(
                        "font-mono text-6xl font-black drop-shadow-lg",
                        isSuddenDeath ? "text-red-500" : "text-white"
                    )}>
                        {battle?.status === 'ended' ? "FINISHED" : arenaReady ? formatTime(timeLeft) : "SYNCING"}
                    </div>
                </div>
            </div>

            <MuteHandler streamId={challengerStream.id} />
            
            {/* Shared Chat & Gifts */}
            <div className="absolute bottom-0 left-0 w-full h-[250px] pointer-events-none z-10 flex gap-4 px-4">
                <div className="flex-1 pointer-events-auto">
                    <BroadcastChat 
                        streamId={currentStreamId} 
                        hostId={currentStreamId === challengerStream.id ? challengerStream.user_id : opponentStream.user_id} 
                        isHost={participantInfo?.role === 'host'}
                    />
                </div>
                <div className="flex-1 pointer-events-none">
                    <div className="absolute inset-0 pointer-events-none z-30">
                        <GiftAnimationOverlay streamId={challengerStream.id} />
                        <GiftAnimationOverlay streamId={opponentStream.id} />
                    </div>
                </div>
            </div>

            {/* Battle End Overlay */}
            {showResults && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
                    <div className="bg-zinc-900 border-2 border-amber-500 p-8 rounded-3xl text-center max-w-md shadow-[0_0_50px_rgba(245,158,11,0.3)]">
                        <h2 className="text-4xl font-black text-amber-500 mb-2 uppercase tracking-tighter italic">Battle Ended</h2>
                        <div className="h-px bg-amber-500/30 w-full my-6" />
                        
                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between items-center text-zinc-400 font-mono">
                                <span>{challengerStream.title}</span>
                                <span className="text-purple-400 font-bold">{battle.score_challenger.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-zinc-400 font-mono">
                                <span>{opponentStream.title}</span>
                                <span className="text-emerald-400 font-bold">{battle.score_opponent.toLocaleString()}</span>
                            </div>
                        </div>

        {battle.status === 'ended' ? (
            <div className="mb-8">
                <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Winner</div>
                <div className="text-2xl font-bold text-white">
                    {battle.winner_id === challengerStream.user_id ? challengerStream.title : 
                     battle.winner_id === opponentStream.user_id ? opponentStream.title : 
                     "It's a Draw!"}
                </div>
            </div>
        ) : (
            <div className="mb-8 text-xl font-bold text-zinc-400 italic animate-pulse">Calculating Results...</div>
        )}

                        <div className="text-sm text-zinc-500 animate-pulse">
                            Returning to stream in a few seconds...
                        </div>
                    </div>
                </div>
            )}


        {/* Gift Tray */}
        {giftRecipientId && (
            <GiftTray 
                onClose={() => {
                    setGiftRecipientId(null);
                    setGiftStreamId(null);
                }}
                recipientId={giftRecipientId}
                streamId={giftStreamId || currentStreamId}
            />
        )}
    </div>
  );
}
