import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  useLocalParticipant, 
  useParticipants,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { LocalTrack, Track, Participant } from 'livekit-client';
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

/**
 * Ensures the host/guest is unmuted when joining the battle room
 */
const BattleRoomSync = ({ isBroadcaster }: { isBroadcaster: boolean }) => {
    const { localParticipant } = useLocalParticipant();

    useEffect(() => {
      if (!localParticipant || !isBroadcaster) return;

      let attempts = 0;
      const maxAttempts = 10;
      const intervalMs = 1000;

      const syncState = async () => {
        try {
          const publications = localParticipant.getTrackPublications();
          if (publications) {
            for (const pub of publications.values()) {
              if (pub.track?.kind === 'video' && pub.isMuted) {
                await (pub.track as LocalTrack).unmute();
              }
              if (pub.track?.kind === 'audio' && pub.isMuted) {
                await (pub.track as LocalTrack).unmute();
              }
            }
          }

          if (!localParticipant.isCameraEnabled) {
            await localParticipant.setCameraEnabled(true);
          }
          if (!localParticipant.isMicrophoneEnabled) {
            await localParticipant.setMicrophoneEnabled(true);
          }
        } catch (error) {
          console.error('[BattleRoomSync] Error syncing state:', error);
        }
      };

      const tick = async () => {
        attempts += 1;
        await syncState();

        const ready = localParticipant.isCameraEnabled && localParticipant.isMicrophoneEnabled;
        if (ready || attempts >= maxAttempts) {
          clearInterval(timer);
        }
      };

      const timer = setInterval(tick, intervalMs);
      tick();

      return () => clearInterval(timer);
    }, [isBroadcaster, localParticipant]);

    return null;
};

/**
 * Individual participant tile in the battle arena
 */
const BattleParticipantTile = ({ 
  participant, 
  side 
}: { 
  participant: Participant; 
  side: 'challenger' | 'opponent' 
}) => {
  const tracks = useTracks([Track.Source.Camera]);
  const track = tracks.find((t) => t.participant.identity === participant.identity);
  
  const metadata = useMemo(() => {
    try {
      return JSON.parse(participant.metadata || '{}');
    } catch {
      return {};
    }
  }, [participant.metadata]);

  const isHost = metadata.role === 'host';
  const isMuted = !participant.isMicrophoneEnabled;
  const isVideoMuted = track?.publication?.isMuted ?? false;
  const isVideoOn = !!track && !isVideoMuted;

  console.log(`[BattleParticipantTile] Rendering ${participant.identity}:`, {
    hasTrack: !!track,
    isCameraEnabled: participant.isCameraEnabled,
    metadata
  });

  return (
    <div className={cn(
      "relative bg-zinc-900/50 rounded-xl overflow-hidden border transition-all duration-300",
      isHost ? "h-64 border-amber-500/30" : "h-40 border-white/10",
      side === 'challenger' ? "hover:border-purple-500/50" : "hover:border-emerald-500/50"
    )}>
      {isVideoOn ? (
        <VideoTrack
          trackRef={track}
          className={cn('w-full h-full object-cover', participant.isLocal && 'scale-x-[-1]')}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
           <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center border-2 border-white/10 mb-2">
              <User className="text-zinc-500" size={32} />
           </div>
           <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <VideoOff size={14} />
                <span>{track ? 'Loading video...' : 'Camera Off'}</span>
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
            {participant.name || 'Anonymous'}
          </span>
          {isHost && (
            <span className="text-[8px] bg-red-600 px-1 rounded text-white font-bold uppercase">HOST</span>
          )}
        </div>
        
        {isMuted && (
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
const BattleArena = ({ onGift }: { onGift: (uid: string, sourceStreamId: string) => void }) => {
  const participants = useParticipants();
  
  const categorized = useMemo(() => {
    const teams = {
      challenger: { host: null as Participant | null, guests: [] as Participant[] },
      opponent: { host: null as Participant | null, guests: [] as Participant[] }
    };

    participants.forEach(p => {
      try {
        const meta = JSON.parse(p.metadata || '{}');
        const team = meta.team as 'challenger' | 'opponent';
        const role = meta.role;

        if (team === 'challenger' || team === 'opponent') {
          if (role === 'host') {
            teams[team].host = p;
          } else if (role === 'stage') {
            teams[team].guests.push(p);
          }
        }
      } catch {}
    });

    // Sort guests by seat index if available
    const sortBySeat = (a: Participant, b: Participant) => {
      const metaA = JSON.parse(a.metadata || '{}');
      const metaB = JSON.parse(b.metadata || '{}');
      return (metaA.seatIndex || 0) - (metaB.seatIndex || 0);
    };
    
    teams.challenger.guests.sort(sortBySeat);
    teams.opponent.guests.sort(sortBySeat);

    return teams;
  }, [participants]);

  const handleGiftClick = (p: Participant) => {
    try {
      const meta = JSON.parse(p.metadata || '{}');
      if (meta.sourceStreamId) {
        onGift(p.identity, meta.sourceStreamId);
      }
    } catch {}
  };

  return (
    <div className="flex-1 flex overflow-hidden p-4 gap-4 bg-black/40">
      {/* Challenger Side */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-hide">
        {categorized.challenger.host && (
          <div onClick={() => handleGiftClick(categorized.challenger.host!)} className="cursor-pointer">
            <BattleParticipantTile participant={categorized.challenger.host} side="challenger" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          {categorized.challenger.guests.map(p => (
            <div key={p.identity} onClick={() => handleGiftClick(p)} className="cursor-pointer">
              <BattleParticipantTile participant={p} side="challenger" />
            </div>
          ))}
        </div>
      </div>

      {/* VS Divider (Visual Only) */}
      <div className="w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      {/* Opponent Side */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pl-2 scrollbar-hide">
        {categorized.opponent.host && (
          <div onClick={() => handleGiftClick(categorized.opponent.host!)} className="cursor-pointer">
            <BattleParticipantTile participant={categorized.opponent.host} side="opponent" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          {categorized.opponent.guests.map(p => (
            <div key={p.identity} onClick={() => handleGiftClick(p)} className="cursor-pointer">
              <BattleParticipantTile participant={p} side="opponent" />
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
}

export default function BattleView({ battleId, currentStreamId, viewerId }: BattleViewProps) {
  const [battle, setBattle] = useState<any>(null);
  const [challengerStream, setChallengerStream] = useState<Stream | null>(null);
  const [opponentStream, setOpponentStream] = useState<Stream | null>(null);
  const [participantInfo, setParticipantInfo] = useState<any>(null);
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showResults, setShowResults] = useState(false);
  
  const { user } = useAuthStore();
  const effectiveUserId = viewerId || user?.id;

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

  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);
  const [giftStreamId, setGiftStreamId] = useState<string | null>(null);

  const handleGiftSelect = useCallback((uid: string, sourceStreamId: string) => {
    setGiftRecipientId(uid);
    setGiftStreamId(sourceStreamId);
  }, []);

  const isBroadcaster = participantInfo?.role === 'host' || participantInfo?.role === 'stage';
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
            const { data: battleData } = await supabase.from('battles').select('*').eq('id', battleId).single();
            if (!battleData) return;
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
                const { data: pData } = await supabase
                    .from('battle_participants')
                    .select('*')
                    .eq('battle_id', battleId)
                    .eq('user_id', effectiveUserId)
                    .single();
                
                setParticipantInfo(pData || { role: 'viewer', team: null });

                // 4. Fetch LiveKit Token for the SHARED room
                const attributes = pData ? {
                    team: pData.team,
                    role: pData.role,
                    seatIndex: pData.seat_index?.toString(),
                    sourceStreamId: pData.source_stream_id
                } : { role: 'viewer' };

                const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
                    body: { 
                        room: `battle-${battleId}`, 
                        username: effectiveUserId,
                        attributes,
                        allowPublish: pData?.role === 'host' || pData?.role === 'stage'
                    }
                });

                if (!tokenError && tokenData?.token) {
                    setToken(tokenData.token);
                }
            }
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
        const { data: leaveResult, error: leaveError } = await supabase.rpc('leave_battle', {
          p_battle_id: battle.id,
          p_user_id: user.id
        });

        if (leaveError || leaveResult?.success === false) {
          toast.error(leaveResult?.message || leaveError?.message || 'Failed to leave battle');
          return;
        }

        const { error: payoutError } = await supabase.rpc('distribute_battle_winnings', { p_battle_id: battle.id });
        if (payoutError) {
          toast.error('Left battle but payout failed.');
        } else {
          toast.success('You left the battle. Opponent wins.');
        }
      } catch (e) {
        console.error(e);
        toast.error('Failed to leave battle');
      } finally {
        setLeaveLoading(false);
      }
    }, [battle, user]);

  useEffect(() => {
    if (!battle?.started_at || battle.status !== 'active') {
        if (battle?.status === 'ended') setHasEnded(true);
        return;
    }

    const interval = setInterval(() => {
        const now = new Date();
        const start = new Date(battle.started_at);
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
  }, [battle?.started_at, battle?.status, participantInfo?.role, hasEnded, endBattle]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading || !battle || !challengerStream || !opponentStream || !token) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-amber-500 gap-4">
        <Loader2 className="animate-spin" size={48} />
        <span className="font-medium animate-pulse">Joining Battle Arena...</span>
      </div>
    );
  }

  const liveKitUrl = import.meta.env.VITE_LIVEKIT_URL || "wss://trollcity-722100.livekit.cloud";

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
                  {leaveLoading ? 'Leaving...' : 'Leave Battle'}
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
        <LiveKitRoom
            token={token}
            serverUrl={liveKitUrl}
            connect={true}
            className="flex-1 flex flex-col relative"
        >
            <MemoBattleArena onGift={handleGiftSelect} />

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
                        {battle?.status === 'ended' ? "FINISHED" : formatTime(timeLeft)}
                    </div>
                </div>
            </div>

            <RoomAudioRenderer />
            <MuteHandler streamId={challengerStream.id} />
            <BattleRoomSync isBroadcaster={isBroadcaster} />
            
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
        </LiveKitRoom>

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
