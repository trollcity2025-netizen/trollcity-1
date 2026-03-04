import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import AgoraRTC, { IAgoraRTCClient, IRemoteUser, IRemoteVideoTrack, IRemoteAudioTrack, ILocalVideoTrack, ILocalAudioTrack, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";

import { supabase } from '../../lib/supabase';
import { Stream } from '../../types/broadcast';
import { useAuthStore } from '../../lib/store';
import { PreflightStore } from '../../lib/preflightStore';
import { useStreamStore } from '../../lib/streamStore';
import { Loader2, Coins, User, MicOff, VideoOff, Plus, Minus, Crown, Flame, ArrowLeft, Skull } from 'lucide-react';
import BroadcastChat from './BroadcastChat';
import MuteHandler from './MuteHandler';
import GiftAnimationOverlay from './GiftAnimationOverlay';
import GiftTray from './GiftTray';
import TrollBattleArena from './TrollBattleArena';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// --- Sub-components for the new architecture ---

const AgoraVideoPlayer = ({
  videoTrack,
  isLocal = false,
}: {
  videoTrack?: ILocalVideoTrack | IRemoteVideoTrack;
  isLocal?: boolean;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasPlayedRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  useEffect(() => {
    if (!videoTrack || !containerRef.current) {
      console.log('[AgoraVideoPlayer] Skipping - missing track or container');
      return;
    }

    if (hasPlayedRef.current) {
      console.log('[AgoraVideoPlayer] Already played this track - skipping duplicate');
      return;
    }

    const playWithRetry = () => {
      if (!containerRef.current) return;

      try {
        console.log('[AgoraVideoPlayer] Calling play() - attempt', retryCountRef.current + 1);
        videoTrack.play(containerRef.current);
        hasPlayedRef.current = true;
        console.log('[AgoraVideoPlayer] play() called successfully');

        // Inspect injected video after Agora has time to inject it
        setTimeout(() => {
          const inner = containerRef.current?.querySelector('video') as HTMLVideoElement | null;
          console.log('[AgoraVideoPlayer] Inner <video> inspection:', {
            exists: !!inner,
            width: inner?.videoWidth ?? 0,
            height: inner?.videoHeight ?? 0,
            readyState: inner?.readyState ?? -1,
            paused: inner?.paused ?? false,
            muted: inner?.muted ?? false,
            srcObjectPresent: !!inner?.srcObject,
          });

          if (inner && (inner.videoWidth === 0 || inner.readyState < 2)) {
            if (retryCountRef.current < maxRetries) {
              retryCountRef.current++;
              console.warn(`[AgoraVideoPlayer] No frames yet (attempt ${retryCountRef.current}/${maxRetries}) - retrying in 400ms`);
              hasPlayedRef.current = false;
              setTimeout(playWithRetry, 400);
            } else {
              console.error('[AgoraVideoPlayer] Max retries reached - no frames flowing');
            }
          }
        }, 600);

      } catch (err) {
        console.error('[AgoraVideoPlayer] play() threw error:', err);
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          setTimeout(playWithRetry, 500);
        }
      }
    };

    const initialTimer = setTimeout(playWithRetry, 150);

    return () => {
      clearTimeout(initialTimer);
      if (videoTrack) {
        console.log('[AgoraVideoPlayer] Cleanup - stopping track');
        try {
          videoTrack.stop();
        } catch (e) {}
      }
    };
  }, [videoTrack]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full object-cover overflow-hidden"
      style={{
        minWidth: '100%',
        minHeight: '100%',
      }}
    />
  );
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
  profile?: any;
}

interface CrownInfo {
  crowns: number;
  streak: number;
  hasStreak: boolean;
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
  side,
  crownInfo,
  isSuddenDeath,
  onTroll,
  canTroll,
}: AgoraBattleParticipant & { 
  side: 'challenger' | 'opponent';
  crownInfo?: CrownInfo;
  isSuddenDeath?: boolean;
  onTroll?: () => void;
  canTroll?: boolean;
}) => {
  const isHost = metadata.role === 'host';
  const isMicMuted = !isMicrophoneEnabled;
  const isVideoOn = isCameraEnabled && !!videoTrack;

  return (
    <div className={cn(
      "relative rounded-xl overflow-hidden border-2 transition-all duration-300",
      isHost ? "h-48 md:h-56 lg:h-64" : "h-32 md:h-36 lg:h-40",
      side === 'challenger' 
        ? "border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.3)]" 
        : "border-emerald-500/50 shadow-[0_0_20px_rgba(34,197,94,0.3)]",
      "bg-black/60 backdrop-blur-sm"
    )}>
      {/* Video or Avatar */}
      {isVideoOn ? (
        <AgoraVideoPlayer videoTrack={videoTrack} isLocal={isLocal} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80">
          <div className={cn(
            "rounded-full flex items-center justify-center border-2 mb-2",
            isHost ? "w-16 h-16 md:w-20 md:h-20 border-amber-500/50" : "w-12 h-12 md:w-14 md:h-14 border-white/20"
          )}>
            <User className="text-zinc-400" size={isHost ? 32 : 24} />
          </div>
          <div className="flex items-center gap-2 text-zinc-500 text-xs">
            <VideoOff size={14} />
            <span>Camera Off</span>
          </div>
        </div>
      )}

      {/* Crown & Streak Badge */}
      {isHost && crownInfo && crownInfo.crowns > 0 && (
        <div className="absolute -top-1 -right-1 z-20">
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold shadow-lg",
            crownInfo.hasStreak 
              ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-black animate-pulse"
              : "bg-gradient-to-r from-amber-600 to-yellow-600 text-white"
          )}>
            <Crown size={12} className={crownInfo.hasStreak ? "fill-black" : "fill-white"} />
            <span>{crownInfo.crowns}</span>
            {crownInfo.hasStreak && (
              <Flame size={12} className="ml-0.5 fill-black" />
            )}
          </div>
        </div>
      )}

      {/* Streak indicator */}
      {isHost && crownInfo?.hasStreak && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20">
          <motion.div 
            initial={{ scale: 0, y: -10 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-0.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1"
          >
            <Flame size={12} className="fill-white" />
            <span>{crownInfo.streak} WIN STREAK!</span>
          </motion.div>
        </div>
      )}

      {/* Troll Button - Only during sudden death */}
      {isHost && isSuddenDeath && canTroll && onTroll && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            onTroll();
          }}
          className="absolute bottom-2 right-2 z-20 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white p-2 rounded-full shadow-lg border-2 border-white/20"
          title="Troll Opponent (Deduct 1% coins)"
        >
          <Skull size={18} />
        </motion.button>
      )}

      {/* Overlay Info */}
      <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-10">
        <div className={cn(
          "flex items-center gap-2 backdrop-blur-md px-2 py-1 rounded-full border",
          isHost 
            ? "bg-amber-500/20 border-amber-500/40" 
            : "bg-black/60 border-white/10"
        )}>
          <span className={cn(
            "text-xs font-bold",
            isHost ? "text-amber-400" : "text-white"
          )}>
            {name || 'Anonymous'}
          </span>
          {isHost && (
            <span className="text-[8px] bg-gradient-to-r from-amber-500 to-yellow-500 text-black px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              HOST
            </span>
          )}
        </div>
        
        {isMicMuted && (
          <div className="bg-red-500 p-1.5 rounded-full shadow-lg">
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
  challengerBoxCount?: number;
  opponentBoxCount?: number;
  challengerCrownInfo?: CrownInfo;
  opponentCrownInfo?: CrownInfo;
  isSuddenDeath?: boolean;
  onTrollOpponent?: (targetStreamId: string) => void;
  canTroll?: boolean;
  currentUserTeam?: 'challenger' | 'opponent' | null;
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
  opponentHostId,
  challengerBoxCount = 1,
  opponentBoxCount = 1,
  challengerCrownInfo,
  opponentCrownInfo,
  isSuddenDeath = false,
  onTrollOpponent,
  canTroll = false,
  currentUserTeam,
}: BattleArenaProps) => {
  const { user } = useAuthStore();
  const [allBattleParticipants, setAllBattleParticipants] = useState<AgoraBattleParticipant[]>([]);
  
  useEffect(() => {
    const fetchParticipantData = async () => {
      const getSupabaseParticipant = async (userId: string) => {
        const { data, error } = await supabase
          .from('battle_participants')
          .select('*, profile:user_profiles(*)')
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
          name: localSupabaseParticipant?.username || user.user_metadata?.username || 'You',
          isLocal: true,
          videoTrack: localVideoTrack,
          audioTrack: localAudioTrack,
          isMicrophoneEnabled: localAudioTrack?.enabled ?? false,
          isCameraEnabled: localVideoTrack?.enabled ?? false,
          metadata: localMetadata,
          role: localSupabaseParticipant?.role,
          team: localSupabaseParticipant?.team,
          sourceStreamId: localMetadata.sourceStreamId,
          seatIndex: localMetadata.seatIndex,
          profile: localSupabaseParticipant?.profile,
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
          isMicrophoneEnabled: remoteUser.audioTrack?.enabled ?? false,
          isCameraEnabled: remoteUser.videoTrack?.enabled ?? false,
          metadata: remoteMetadata,
          role: remoteSupabaseParticipant?.role,
          team: remoteSupabaseParticipant?.team,
          sourceStreamId: remoteMetadata.sourceStreamId,
          seatIndex: remoteMetadata.seatIndex,
          profile: remoteSupabaseParticipant?.profile,
        });
      }
      setAllBattleParticipants(participantsData);
    };

    fetchParticipantData();
  }, [remoteUsers, user, localAudioTrack, localVideoTrack, battleId]);

  const categorized = useMemo(() => {
    const teams = {
      challenger: { host: null as AgoraBattleParticipant | null, guests: [] as AgoraBattleParticipant[], boxCount: Math.max(1, Math.min(challengerBoxCount, 6)) },
      opponent: { host: null as AgoraBattleParticipant | null, guests: [] as AgoraBattleParticipant[], boxCount: Math.max(1, Math.min(opponentBoxCount, 6)) }
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
  }, [allBattleParticipants, challengerBoxCount, opponentBoxCount]);

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

  const handleTrollClick = (team: 'challenger' | 'opponent') => {
    if (!onTrollOpponent) return;
    const targetStreamId = team === 'challenger' ? challengerStreamId : opponentStreamId;
    onTrollOpponent(targetStreamId);
  };

  // Generate placeholder slots based on box_count for each team
  const generateSlots = (team: 'challenger' | 'opponent') => {
    const teamData = categorized[team];
    const boxCount = Math.min(teamData.boxCount, 6);
    const slots: Array<{ type: 'host' | 'guest'; participant?: AgoraBattleParticipant; index?: number }> = [];
    
    slots.push({ type: 'host', participant: teamData.host || undefined });
    
    const guestSlots = Math.max(0, boxCount - 1);
    for (let i = 0; i < guestSlots; i++) {
      const guest = teamData.guests[i];
      slots.push({ type: 'guest', participant: guest, index: i + 1 });
    }
    
    return slots;
  };

  const challengerSlots = generateSlots('challenger');
  const opponentSlots = generateSlots('opponent');

  const getGridClass = (slotCount: number) => {
    if (slotCount <= 2) return 'grid-cols-1';
    if (slotCount <= 4) return 'grid-cols-2';
    return 'grid-cols-2 grid-rows-3';
  };

  return (
    <div className="flex-1 flex overflow-hidden p-2 md:p-4 gap-2 md:gap-4">
      {/* Challenger Side */}
      <div className="flex-1 flex flex-col gap-2 md:gap-3 overflow-y-auto pr-1 scrollbar-hide">
        <button
          onClick={() => handleSideGiftClick('challenger')}
          className="self-start px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white border border-purple-400/50 shadow-lg shadow-purple-500/20 transition-all hover:scale-105"
        >
          Gift Side A
        </button>
        
        {/* Host */}
        {challengerSlots[0]?.participant ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleGiftClick(challengerSlots[0].participant!);
            }}
            className="cursor-pointer transform transition-transform hover:scale-[1.02]"
          >
            <BattleParticipantTile 
              {...challengerSlots[0].participant} 
              side="challenger" 
              crownInfo={challengerCrownInfo}
              isSuddenDeath={isSuddenDeath}
              canTroll={canTroll && currentUserTeam === 'opponent'}
              onTroll={() => handleTrollClick('challenger')}
            />
          </div>
        ) : (
          <div className="relative bg-zinc-900/50 rounded-xl overflow-hidden border border-purple-500/20 h-48 md:h-56 lg:h-64 flex items-center justify-center">
            <span className="text-zinc-500 text-sm">Waiting for host...</span>
          </div>
        )}
        
        {/* Guests */}
        <div className={`grid gap-2 ${getGridClass(challengerSlots.length - 1)}`}>
          {challengerSlots.slice(1).map((slot, idx) => (
            <div key={`challenger-guest-${idx}`}>
              {slot.participant ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGiftClick(slot.participant!);
                  }}
                  className="cursor-pointer transform transition-transform hover:scale-[1.02]"
                >
                  <BattleParticipantTile {...slot.participant} side="challenger" />
                </div>
              ) : (
                <div className="relative bg-zinc-900/30 rounded-xl overflow-hidden border border-dashed border-purple-500/20 h-32 md:h-36 lg:h-40 flex items-center justify-center">
                  <span className="text-zinc-600 text-xs">Empty Seat</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* VS Divider */}
      <div className="w-px bg-gradient-to-b from-transparent via-amber-500/50 to-transparent" />

      {/* Opponent Side */}
      <div className="flex-1 flex flex-col gap-2 md:gap-3 overflow-y-auto pl-1 scrollbar-hide">
        <button
          onClick={() => handleSideGiftClick('opponent')}
          className="self-start px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white border border-emerald-400/50 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
        >
          Gift Side B
        </button>
        
        {/* Host */}
        {opponentSlots[0]?.participant ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleGiftClick(opponentSlots[0].participant!);
            }}
            className="cursor-pointer transform transition-transform hover:scale-[1.02]"
          >
            <BattleParticipantTile 
              {...opponentSlots[0].participant} 
              side="opponent" 
              crownInfo={opponentCrownInfo}
              isSuddenDeath={isSuddenDeath}
              canTroll={canTroll && currentUserTeam === 'challenger'}
              onTroll={() => handleTrollClick('opponent')}
            />
          </div>
        ) : (
          <div className="relative bg-zinc-900/50 rounded-xl overflow-hidden border border-emerald-500/20 h-48 md:h-56 lg:h-64 flex items-center justify-center">
            <span className="text-zinc-500 text-sm">Waiting for host...</span>
          </div>
        )}
        
        {/* Guests */}
        <div className={`grid gap-2 ${getGridClass(opponentSlots.length - 1)}`}>
          {opponentSlots.slice(1).map((slot, idx) => (
            <div key={`opponent-guest-${idx}`}>
              {slot.participant ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGiftClick(slot.participant!);
                  }}
                  className="cursor-pointer transform transition-transform hover:scale-[1.02]"
                >
                  <BattleParticipantTile {...slot.participant} side="opponent" />
                </div>
              ) : (
                <div className="relative bg-zinc-900/30 rounded-xl overflow-hidden border border-dashed border-emerald-500/20 h-32 md:h-36 lg:h-40 flex items-center justify-center">
                  <span className="text-zinc-600 text-xs">Empty Seat</span>
                </div>
              )}
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
  currentStreamId: string;
  viewerId?: string;
  localTracks?: [IMicrophoneAudioTrack, ICameraVideoTrack] | null;
  onReturnToStream?: () => void;
}

export default function BattleView({ battleId, currentStreamId, viewerId, localTracks: passedLocalTracks, onReturnToStream }: BattleViewProps) {
  const [battle, setBattle] = useState<any>(null);
  const [challengerStream, setChallengerStream] = useState<Stream | null>(null);
  const [opponentStream, setOpponentStream] = useState<Stream | null>(null);
  const [participantInfo, setParticipantInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [agoraClient, setAgoraClient] = useState<IAgoraRTCClient | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<ILocalAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ILocalVideoTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IRemoteUser[]>([]);
  const [participantSnapshots, setParticipantSnapshots] = useState<Array<{ user_id: string; role: 'host' | 'stage' | 'viewer' }>>([]);
  const [arenaReadyAtMs, setArenaReadyAtMs] = useState<number | null>(null);
  const [arenaReady, setArenaReady] = useState(false);
  const [challengerCrownInfo, setChallengerCrownInfo] = useState<CrownInfo>({ crowns: 0, streak: 0, hasStreak: false });
  const [opponentCrownInfo, setOpponentCrownInfo] = useState<CrownInfo>({ crowns: 0, streak: 0, hasStreak: false });
  
  const publishedArenaReadyRef = useRef(false);
  
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { clearTracks } = useStreamStore();
  const effectiveUserId = viewerId || user?.id;

  const isBroadcaster = participantInfo?.role === 'host' || participantInfo?.role === 'stage';

  // Fetch crown info for both broadcasters
  useEffect(() => {
    const fetchCrownInfo = async () => {
      if (!challengerStream?.user_id || !opponentStream?.user_id) return;

      const { data: challengerProfile } = await supabase
        .from('user_profiles')
        .select('battle_crowns, battle_crown_streak')
        .eq('id', challengerStream.user_id)
        .single();

      const { data: opponentProfile } = await supabase
        .from('user_profiles')
        .select('battle_crowns, battle_crown_streak')
        .eq('id', opponentStream.user_id)
        .single();

      if (challengerProfile) {
        setChallengerCrownInfo({
          crowns: challengerProfile.battle_crowns || 0,
          streak: challengerProfile.battle_crown_streak || 0,
          hasStreak: (challengerProfile.battle_crown_streak || 0) >= 3,
        });
      }

      if (opponentProfile) {
        setOpponentCrownInfo({
          crowns: opponentProfile.battle_crowns || 0,
          streak: opponentProfile.battle_crown_streak || 0,
          hasStreak: (opponentProfile.battle_crown_streak || 0) >= 3,
        });
      }
    };

    fetchCrownInfo();
  }, [challengerStream?.user_id, opponentStream?.user_id]);

  // Agora setup
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

          if (passedLocalTracks && passedLocalTracks[0] && passedLocalTracks[1]) {
            if (!mounted) return;
            setLocalAudioTrack(passedLocalTracks[0]);
            setLocalVideoTrack(passedLocalTracks[1]);
            await client.publish([passedLocalTracks[0], passedLocalTracks[1]]);
          } else {
            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
              AEC: true,
              AGC: true,
              ANS: true
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
      PreflightStore.clear();
      clearTracks();
    };
  }, [battle, effectiveUserId, isBroadcaster, passedLocalTracks, clearTracks]);

  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);
  const [giftStreamId, setGiftStreamId] = useState<string | null>(null);

  const handleGiftSelect = useCallback((uid: string, sourceStreamId: string) => {
    setGiftRecipientId(uid);
    setGiftStreamId(sourceStreamId);
  }, []);

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

    try {
      const broadcastChannel = supabase.channel(`stream:${myStream.id}`);
      
      await new Promise<void>((resolve, reject) => {
        broadcastChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reject(new Error('Channel subscription failed'));
          }
        });
      });
      
      await broadcastChannel.send({
        type: 'broadcast',
        event: 'box_count_changed',
        payload: { box_count: newCount, stream_id: myStream.id }
      });
      
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

  // Initialize battle
  useEffect(() => {
    const initBattle = async () => {
      try {
        const { data: battleData, error: battleError } = await supabase.from('battles').select('*').eq('id', battleId).maybeSingle();
        if (battleError || !battleData) {
          setError('Battle not found');
          return;
        }
        setBattle(battleData);

        if (battleData.status === 'ended') {
          setShowResults(true);
        }

        const { data: streams, error: streamsError } = await supabase
          .from('streams')
          .select('*')
          .in('id', [battleData.challenger_stream_id, battleData.opponent_stream_id]);
            
        if (streamsError || !streams) {
          setError('Failed to load battle streams: ' + (streamsError?.message || 'Unknown error'));
          return;
        }

        const cStream = streams.find(s => s.id === battleData.challenger_stream_id);
        const oStream = streams.find(s => s.id === battleData.opponent_stream_id);
            
        if (!cStream) {
          setError('Challenger stream not found or not live.');
          return;
        }
        if (!oStream) {
          setError('Opponent stream not found or not live.');
          return;
        }
              
        setChallengerStream(cStream);
        setOpponentStream(oStream);

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
        setError('Failed to initialize battle');
      } finally {
        setLoading(false);
      }
    };
    initBattle();

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

  // Participants channel
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

  // Arena ready channel
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

  // Arena readiness check
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
    battle, arenaReady, participantSnapshots, remoteUsers, localVideoTrack, localAudioTrack,
    effectiveUserId, participantInfo?.role, battleId,
  ]);

  // Fallback arena ready
  useEffect(() => {
    if (!battle || battle.status !== 'active' || arenaReady) return;
    const timeout = setTimeout(() => {
      if (arenaReady) return;
      setArenaReadyAtMs(Date.now());
      setArenaReady(true);
    }, 4500);
    return () => clearTimeout(timeout);
  }, [battle, arenaReady]);

  // Stream updates
  useEffect(() => {
    if (!challengerStream?.id && !opponentStream?.id) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    if (challengerStream?.id) {
      const c = supabase.channel(`battle_stream_${challengerStream.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${challengerStream.id}` },
          (payload) => {
            setChallengerStream((prev) => prev ? { ...prev, ...(payload.new as Stream) } : (payload.new as Stream));
          }
        )
        .on('broadcast', { event: 'box_count_changed' }, (payload) => {
          const boxData = payload.payload;
          if (boxData && boxData.box_count !== undefined) {
            setChallengerStream((prev) => prev ? { ...prev, box_count: boxData.box_count } : prev);
          }
        })
        .subscribe();
      channels.push(c);
    }

    if (opponentStream?.id) {
      const c = supabase.channel(`battle_stream_${opponentStream.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${opponentStream.id}` },
          (payload) => {
            setOpponentStream((prev) => prev ? { ...prev, ...(payload.new as Stream) } : (payload.new as Stream));
          }
        )
        .on('broadcast', { event: 'box_count_changed' }, (payload) => {
          const boxData = payload.payload;
          if (boxData && boxData.box_count !== undefined) {
            setOpponentStream((prev) => prev ? { ...prev, box_count: boxData.box_count } : prev);
          }
        })
        .subscribe();
      channels.push(c);
    }

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [challengerStream?.id, opponentStream?.id]);

  // Timer Logic - 3 minutes with 10 second sudden death
  const [timeLeft, setTimeLeft] = useState<number>(180);
  const [isSuddenDeath, setIsSuddenDeath] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  const endBattle = useCallback(async (skipConfirmation = false) => {
    if (!battle || !user) return;
    
    if (!skipConfirmation && !confirm("Are you sure you want to end this battle?")) {
      return;
    }

    try {
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
        if (endResult?.message === 'Battle timer not elapsed') {
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
      setBattle((prev: any) => prev ? { ...prev, status: 'ended' } : prev);
      setShowResults(true);

      const { data: leaveResult, error: leaveError } = await supabase.rpc('leave_battle', {
        p_battle_id: battle.id,
        p_user_id: user.id
      });

      if (leaveError || leaveResult?.success === false) {
        toast.error(leaveResult?.message || leaveError?.message || 'Failed to leave battle');
      } else {
        try {
          await supabase.rpc('distribute_battle_winnings', { p_battle_id: battle.id });
        } catch (payoutErr) {
          console.warn('Payout failed:', payoutErr);
        }
        toast.success('You left the battle. Opponent wins.');
      }
      
      handleReturnToStream();
      
      if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack.close();
      }
      if (localVideoTrack) {
        localVideoTrack.stop();
        localVideoTrack.close();
      }
      if (agoraClient) {
        agoraClient.leave();
      }
      PreflightStore.clear();
      clearTracks();
    } catch (e) {
      console.error(e);
      toast.error('Failed to leave battle');
      handleReturnToStream();
    } finally {
      setLeaveLoading(false);
    }
  }, [battle, user, localAudioTrack, localVideoTrack, agoraClient, clearTracks]);

  // Timer effect - 3 minutes + 10 seconds sudden death
  useEffect(() => {
    if (!battle?.started_at || battle.status !== 'active' || !arenaReady) {
      if (battle?.status === 'ended') setHasEnded(true);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const start = new Date(arenaReadyAtMs || battle.started_at);
      const elapsed = (now.getTime() - start.getTime()) / 1000;
      
      const BATTLE_DURATION = 180; // 3 minutes
      const SUDDEN_DEATH = 10; // 10 seconds
      
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

  // Handle troll opponent
  const handleTrollOpponent = async (targetStreamId: string) => {
    if (!battle || !user) return;

    try {
      const { data, error } = await supabase.rpc('troll_opponent', {
        p_battle_id: battle.id,
        p_troller_id: user.id,
        p_target_stream_id: targetStreamId
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data?.success) {
        toast.success(`Trolled opponent! Deducted ${data.deduction} coins`);
      } else {
        toast.error(data?.message || 'Troll failed');
      }
    } catch (e) {
      console.error('Troll error:', e);
      toast.error('Failed to troll opponent');
    }
  };

  // Return to stream handler
  const handleReturnToStream = useCallback(() => {
    // Cleanup media
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
    }
    if (localVideoTrack) {
      localVideoTrack.stop();
      localVideoTrack.close();
    }
    if (agoraClient) {
      agoraClient.leave();
    }
    PreflightStore.clear();
    clearTracks();

    // Call the callback if provided (instant return)
    if (onReturnToStream) {
      onReturnToStream();
    } else {
      // Otherwise navigate to home
      navigate('/');
    }
  }, [localAudioTrack, localVideoTrack, agoraClient, clearTracks, onReturnToStream, navigate]);

  // Auto-return after battle ends
  useEffect(() => {
    if (showResults && battle?.status === 'ended') {
      const timer = setTimeout(() => {
        handleReturnToStream();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showResults, battle?.status, handleReturnToStream]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-red-500 gap-4">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-white">Battle Error</h2>
        <span className="font-medium">{error}</span>
        <button 
          onClick={() => navigate('/')}
          className="mt-4 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition"
        >
          Return Home
        </button>
      </div>
    );
  }

  if (loading || !battle || !challengerStream || !opponentStream) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-amber-500 gap-4">
        <Loader2 className="animate-spin" size={48} />
        <span className="font-medium animate-pulse">Joining Battle Arena...</span>
      </div>
    );
  }

  const totalScore = (battle?.score_challenger || 0) + (battle?.score_opponent || 0);
  const challengerPercent = totalScore === 0 ? 50 : Math.round((battle?.score_challenger / totalScore) * 100);
  const opponentPercent = 100 - challengerPercent;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden z-50">
      {/* Troll Battle Arena Background */}
      <TrollBattleArena isActive={battle?.status === 'active'} intensity={isSuddenDeath ? 'high' : 'medium'} />

      {/* Back Button - Positioned away from broadcast boxes */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white rounded-full border border-white/20 transition-all hover:scale-105"
      >
        <ArrowLeft size={18} />
        <span className="text-sm font-medium">Home</span>
      </button>

      {/* Main Content Container */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Battle Header */}
        <div className="h-20 md:h-24 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between px-4 md:px-8 pt-2">
          {/* Challenger Info */}
          <div className="flex-1 flex items-center justify-end gap-3 md:gap-4">
            <div className="text-right">
              <div className="flex items-center justify-end gap-2">
                <h2 className="text-lg md:text-xl font-bold text-white truncate max-w-[100px] md:max-w-[150px]">
                  {challengerStream.title}
                </h2>
                {challengerCrownInfo.hasStreak && (
                  <Crown size={16} className="text-yellow-400 fill-yellow-400" />
                )}
              </div>
              <div className="font-mono text-lg md:text-xl font-bold text-purple-400">
                {(battle?.score_challenger || 0).toLocaleString()}
              </div>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 border-2 border-white/20 flex items-center justify-center shadow-lg">
              <User className="text-white" size={20} />
            </div>
          </div>

          {/* Center: Pot & Timer */}
          <div className="mx-4 md:mx-8 flex flex-col items-center justify-center min-w-[120px] md:min-w-[180px]">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-amber-500/70 uppercase tracking-widest font-bold">Pot</span>
              <div className="flex items-center gap-1.5 text-amber-400 bg-black/50 px-3 py-0.5 rounded-full border border-amber-500/30">
                <Coins size={14} className="fill-amber-400" />
                <span className="font-mono text-lg md:text-xl font-black">
                  {((battle?.pot_challenger || 0) + (battle?.pot_opponent || 0)).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Opponent Info */}
          <div className="flex-1 flex items-center justify-start gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 border-2 border-white/20 flex items-center justify-center shadow-lg">
              <User className="text-white" size={20} />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                {opponentCrownInfo.hasStreak && (
                  <Crown size={16} className="text-yellow-400 fill-yellow-400" />
                )}
                <h2 className="text-lg md:text-xl font-bold text-white truncate max-w-[100px] md:max-w-[150px]">
                  {opponentStream.title}
                </h2>
              </div>
              <div className="font-mono text-lg md:text-xl font-bold text-emerald-400">
                {(battle?.score_opponent || 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Battle Arena */}
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
          challengerBoxCount={challengerStream.box_count || 1}
          opponentBoxCount={opponentStream.box_count || 1}
          challengerCrownInfo={challengerCrownInfo}
          opponentCrownInfo={opponentCrownInfo}
          isSuddenDeath={isSuddenDeath}
          onTrollOpponent={handleTrollOpponent}
          canTroll={isSuddenDeath && participantInfo?.role === 'host'}
          currentUserTeam={participantInfo?.team}
        />

        {/* Central Floating Timer */}
        <div className="absolute top-24 md:top-28 left-1/2 -translate-x-1/2 pointer-events-none z-40">
          <motion.div 
            animate={isSuddenDeath ? {
              scale: [1, 1.1, 1],
            } : {}}
            transition={{ duration: 0.5, repeat: isSuddenDeath ? Infinity : 0 }}
            className={cn(
              "flex flex-col items-center justify-center px-4 py-2 md:px-6 md:py-3 rounded-2xl backdrop-blur-md border shadow-2xl",
              isSuddenDeath 
                ? "bg-red-950/60 border-red-500/60 shadow-red-500/30" 
                : "bg-black/50 border-white/20"
            )}
          >
            <span className={cn(
              "text-xs md:text-sm font-black uppercase tracking-wider mb-0.5",
              isSuddenDeath ? "text-red-400" : "text-amber-500"
            )}>
              {isSuddenDeath ? "⚡ SUDDEN DEATH ⚡" : "BATTLE TIME"}
            </span>
            <div className={cn(
              "font-mono text-2xl md:text-4xl font-black",
              isSuddenDeath ? "text-red-500" : "text-white"
            )}>
              {battle?.status === 'ended' ? "FINISHED" : arenaReady ? formatTime(timeLeft) : "SYNCING"}
            </div>
            {isSuddenDeath && (
              <span className="text-[10px] text-red-400/80 mt-0.5">Troll buttons active!</span>
            )}
          </motion.div>
        </div>

        {/* Progress Bar */}
        <div className="absolute top-20 md:top-24 left-0 w-full h-1 flex z-30">
          <div 
            className="h-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-500" 
            style={{ width: `${challengerPercent}%` }}
          />
          <div 
            className="h-full bg-gradient-to-l from-emerald-500 to-teal-500 transition-all duration-500" 
            style={{ width: `${opponentPercent}%` }}
          />
        </div>

        <MuteHandler streamId={challengerStream.id} />
        
        {/* Shared Chat & Gifts */}
        <div className="absolute bottom-0 left-0 w-full h-[200px] md:h-[250px] pointer-events-none flex gap-2 md:gap-4 px-2 md:px-4">
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

        {/* Host Controls */}
        {participantInfo?.role === 'host' && (
          <div className="absolute top-20 right-2 md:right-4 z-40 flex flex-col gap-2">
            {myStream && (
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/20 rounded-full px-3 py-1.5">
                <span className="text-xs text-white/70">Boxes</span>
                <button
                  onClick={() => updateMyStreamBoxCount((myStream.box_count || 1) - 1)}
                  className="p-1 rounded-full hover:bg-white/20 text-white/80 transition"
                  aria-label="Decrease boxes"
                >
                  <Minus size={14} />
                </button>
                <span className="text-sm font-bold text-white min-w-[20px] text-center">
                  {myStream.box_count || 1}
                </span>
                <button
                  onClick={() => updateMyStreamBoxCount((myStream.box_count || 1) + 1)}
                  className="p-1 rounded-full hover:bg-white/20 text-white/80 transition"
                  aria-label="Increase boxes"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}

            <button
              onClick={handleLeaveBattle}
              disabled={leaveLoading}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-600/80 hover:bg-red-500 text-white border border-red-500/40 transition disabled:opacity-60 shadow-lg"
            >
              {leaveLoading ? 'Leaving...' : 'Forfeit'}
            </button>
          </div>
        )}

        {/* Battle End Overlay */}
        <AnimatePresence>
          {showResults && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-gradient-to-b from-zinc-900 to-black border-2 border-amber-500/50 p-6 md:p-8 rounded-3xl text-center max-w-md shadow-[0_0_60px_rgba(245,158,11,0.3)]"
              >
                <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-500 mb-2 uppercase tracking-tighter italic">
                  Battle Ended
                </h2>
                <div className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent w-full my-4" />
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center text-zinc-300 font-mono px-4">
                    <span className="flex items-center gap-2">
                      {challengerCrownInfo.hasStreak && <Crown size={14} className="text-yellow-400 fill-yellow-400" />}
                      {challengerStream.title}
                    </span>
                    <span className="text-purple-400 font-bold text-lg">{battle.score_challenger.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-300 font-mono px-4">
                    <span className="flex items-center gap-2">
                      {opponentCrownInfo.hasStreak && <Crown size={14} className="text-yellow-400 fill-yellow-400" />}
                      {opponentStream.title}
                    </span>
                    <span className="text-emerald-400 font-bold text-lg">{battle.score_opponent.toLocaleString()}</span>
                  </div>
                </div>

                {battle.status === 'ended' ? (
                  <div className="mb-6">
                    <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Winner</div>
                    <div className="flex items-center justify-center gap-2 text-2xl font-bold text-white">
                      <Crown size={24} className="text-yellow-400 fill-yellow-400" />
                      {battle.winner_id === challengerStream.user_id ? challengerStream.title : 
                       battle.winner_id === opponentStream.user_id ? opponentStream.title : 
                       "It's a Draw!"}
                    </div>
                    {(battle.winner_id === challengerStream.user_id && challengerCrownInfo.hasStreak) ||
                     (battle.winner_id === opponentStream.user_id && opponentCrownInfo.hasStreak) ? (
                      <div className="mt-2 text-amber-400 font-bold flex items-center justify-center gap-1">
                        <Flame size={16} className="fill-amber-400" />
                        WIN STREAK CONTINUES!
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mb-6 text-xl font-bold text-zinc-400 italic animate-pulse">Calculating Results...</div>
                )}

                <div className="text-sm text-zinc-500">
                  Returning to stream in a few seconds...
                </div>

                <button
                  onClick={handleReturnToStream}
                  className="mt-4 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-full transition"
                >
                  Return Now
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
    </div>
  );
}
