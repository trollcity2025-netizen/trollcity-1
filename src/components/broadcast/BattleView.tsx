import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { AgoraProvider, useAgora } from '../../hooks/useAgora';
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

import { IAgoraRTCRemoteUser, ILocalVideoTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng';

interface BattleParticipant {
  uid: string | number;
  isLocal?: boolean;
  hasVideo?: boolean;
  hasAudio?: boolean;
  videoTrack?: ILocalVideoTrack | IRemoteVideoTrack;
}

const BattleParticipantTile = ({ participant, side }: { participant: BattleParticipant; side: 'challenger' | 'opponent' }) => {
  const videoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (participant.videoTrack && videoRef.current) {
      participant.videoTrack.play(videoRef.current);
    }
    return () => {
      participant.videoTrack?.stop();
    };
  }, [participant.videoTrack]);

  const isHost = participant.uid === 'host'; // This is a placeholder, you need to find a way to identify the host
  const isMuted = !participant.hasAudio;
  const isVideoOn = participant.hasVideo;

  return (
    <div className={cn(
      "relative bg-zinc-900/50 rounded-xl overflow-hidden border transition-all duration-300",
      isHost ? "h-64 border-amber-500/30" : "h-40 border-white/10",
      side === 'challenger' ? "hover:border-purple-500/50" : "hover:border-emerald-500/50"
    )}>
      {isVideoOn ? (
        <div ref={videoRef} className={cn('w-full h-full object-cover', participant.isLocal && 'scale-x-[-1]')} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
           <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center border-2 border-white/10 mb-2">
              <User className="text-zinc-500" size={32} />
           </div>
           <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <VideoOff size={14} />
                <span>{participant.hasVideo ? 'Loading video...' : 'Camera Off'}</span>
           </div>
        </div>
      )}

      <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-10">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
          <span className={cn(
            "text-xs font-bold",
            isHost ? "text-amber-400" : "text-white"
          )}>
            {participant.uid || 'Anonymous'}
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

const BattleArena = ({ onGift }: { onGift: (uid: string, sourceStreamId: string) => void }) => {
  const { remoteUsers, localVideoTrack } = useAgora();
  const { profile } = useAuthStore();

  const categorized = useMemo(() => {
    const teams = {
      challenger: { host: null as any | null, guests: [] as any[] },
      opponent: { host: null as any | null, guests: [] as any[] }
    };

    const allUsers: BattleParticipant[] = [
      ...remoteUsers.map(u => ({ ...u, isLocal: false })),
    ];
    if (localVideoTrack) {
      allUsers.push({ uid: profile.id, isLocal: true, hasVideo: true, hasAudio: true, videoTrack: localVideoTrack });
    }

    allUsers.forEach(p => {
        // This is a placeholder, you need to find a way to get the team and role of each participant
        const team = 'challenger'; 
        const role = p.uid === profile.id ? 'host' : 'guest';

        if (team === 'challenger' || team === 'opponent') {
          if (role === 'host') {
            teams[team].host = p;
          } else if (role === 'guest') {
            teams[team].guests.push(p);
          }
        }
    });

    return teams;
  }, [remoteUsers, localVideoTrack, profile.id]);

  const handleGiftClick = (p: any) => {
    if (p.uid) {
      onGift(p.uid, ''); // This is a placeholder, you need to find a way to get the sourceStreamId
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden p-4 gap-4 bg-black/40">
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-hide">
        {categorized.challenger.host && (
          <div onClick={() => handleGiftClick(categorized.challenger.host!)} className="cursor-pointer">
            <BattleParticipantTile participant={categorized.challenger.host} side="challenger" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          {categorized.challenger.guests.map(p => (
            <div key={p.uid} onClick={() => handleGiftClick(p)} className="cursor-pointer">
              <BattleParticipantTile participant={p} side="challenger" />
            </div>
          ))}
        </div>
      </div>

      <div className="w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pl-2 scrollbar-hide">
        {categorized.opponent.host && (
          <div onClick={() => handleGiftClick(categorized.opponent.host!)} className="cursor-pointer">
            <BattleParticipantTile participant={categorized.opponent.host} side="opponent" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          {categorized.opponent.guests.map(p => (
            <div key={p.uid} onClick={() => handleGiftClick(p)} className="cursor-pointer">
              <BattleParticipantTile participant={p} side="opponent" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MemoBattleArena = React.memo(BattleArena);

interface BattleViewProps {
  battleId?: string;
  currentStreamId?: string;
  viewerId?: string;
  streamId?: string;
  onClose?: () => void;
}

const BattleViewWithAgora = ({ battle, challengerStream, opponentStream, participantInfo, currentStreamId }: any) => {
  const { join, leave, publish, unpublish } = useAgora();
  const { user } = useAuthStore();
  const effectiveUserId = participantInfo?.user_id || user?.id;
  const sessionRef = useRef(0);

  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);
  const [giftStreamId, setGiftStreamId] = useState<string | null>(null);

  const handleGiftSelect = useCallback((uid: string, sourceStreamId: string) => {
    setGiftRecipientId(uid);
    setGiftStreamId(sourceStreamId);
  }, []);

  useEffect(() => {
    if (!effectiveUserId || !battle.id) return;

    const sessionId = ++sessionRef.current;
    let cancelled = false;
    let joined = false;
    const shouldPublish = participantInfo?.role === 'host' || participantInfo?.role === 'stage';
    const role = shouldPublish ? 'host' : 'audience';
    const numericUid = Number(String(effectiveUserId).replace(/\D/g, "").slice(0, 9)) || 0;
    const channelName = `battle-${battle.id}`;

    const run = async () => {
      try {
        await join(import.meta.env.VITE_AGORA_APP_ID, channelName, null, numericUid, role);

        if (cancelled || sessionRef.current !== sessionId) return;
        joined = true;

        if (shouldPublish) {
          await publish();
        } else {
          await unpublish();
        }
      } catch (e) {
        if (!cancelled) console.error("[BattleView] run failed", e);
      }
    };

    run();

    return () => {
      cancelled = true;
      if (sessionRef.current === sessionId && joined) {
        leave().catch((e) => console.error('[BattleView] Leave failed on cleanup', e));
      }
    };
  }, [battle.id, effectiveUserId, participantInfo, join, leave, publish, unpublish]);

  const totalScore = (battle?.score_challenger || 0) + (battle?.score_opponent || 0);
  const challengerPercent = totalScore === 0 ? 50 : Math.round((battle?.score_challenger / totalScore) * 100);
  const opponentPercent = 100 - challengerPercent;

  return (
    <div className="flex-1 flex flex-col relative">
      <MemoBattleArena onGift={handleGiftSelect} />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 flex flex-col items-center">
        <div className={cn(
          "flex flex-col items-center justify-center p-6 rounded-3xl backdrop-blur-md border shadow-2xl transition-all duration-500",
          false ? "bg-red-950/40 border-red-500/50 scale-110 shadow-red-500/20" : "bg-black/40 border-white/10 shadow-black/50"
        )}>
          <span className={cn(
            "text-3xl font-black italic tracking-tighter mb-1",
            false ? "text-red-500 animate-pulse" : "text-amber-500"
          )}>
            {false ? "SUDDEN DEATH" : "BATTLE TIME"}
          </span>
          <div className={cn(
            "font-mono text-6xl font-black drop-shadow-lg",
            false ? "text-red-500" : "text-white"
          )}>
            {battle?.status === 'ended' ? "FINISHED" : "0:00"}
          </div>
        </div>
      </div>

      <MuteHandler streamId={challengerStream.id} />
      
      <div className="absolute bottom-0 left-0 w-full h-[250px] pointer-events-none z-10 flex gap-4 px-4">
        <div className="flex-1 pointer-events-auto">
          <BroadcastChat 
            streamId={currentStreamId} 
            hostId={currentStreamId === challengerStream.id ? challengerStream.user_id : opponentStream.user_id} 
            isHost={participantInfo?.role === 'host'}
            guestUser={null}
          />
        </div>
        <div className="flex-1 pointer-events-none">
          <div className="absolute inset-0 pointer-events-none z-30">
            <GiftAnimationOverlay streamId={challengerStream.id} />
            <GiftAnimationOverlay streamId={opponentStream.id} />
          </div>
        </div>
      </div>

      {battle.status === 'ended' && (
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

            <div className="mb-8">
              <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Winner</div>
              <div className="text-2xl font-bold text-white">
                {battle.winner_id === challengerStream.user_id ? challengerStream.title : 
                 battle.winner_id === opponentStream.user_id ? opponentStream.title : 
                 "It's a Draw!"}
              </div>
            </div>

            <div className="text-sm text-zinc-500 animate-pulse">
              Returning to stream in a few seconds...
            </div>
          </div>
        </div>
      )}

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
};

export default function BattleView({ battleId, currentStreamId, viewerId, streamId, onClose }: BattleViewProps) {
  const [battle, setBattle] = useState<any>(null);
  const [challengerStream, setChallengerStream] = useState<Stream | null>(null);
  const [opponentStream, setOpponentStream] = useState<Stream | null>(null);
  const [participantInfo, setParticipantInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showResults, setShowResults] = useState(false);
  
  const { user } = useAuthStore();
  const effectiveUserId = viewerId || user?.id;
  const _currentStreamId = currentStreamId || streamId;

  useEffect(() => {
    const initBattle = async () => {
        try {
            const { data: battleData } = await supabase.from('battles').select('*').eq('id', battleId).single();
            if (!battleData) return;
            setBattle(battleData);

            if (battleData.status === 'ended') {
                setShowResults(true);
            }

            const { data: streams } = await supabase.from('streams').select('*').in('id', [battleData.challenger_stream_id, battleData.opponent_stream_id]);
            if (!streams) return;

            const cStream = streams.find(s => s.id === battleData.challenger_stream_id);
            const oStream = streams.find(s => s.id === battleData.opponent_stream_id);
            
            setChallengerStream(cStream || null);
            setOpponentStream(oStream || null);

            if (effectiveUserId) {
                const { data: pData } = await supabase
                    .from('battle_participants')
                    .select('*')
                    .eq('battle_id', battleId)
                    .eq('user_id', effectiveUserId)
                    .single();
                
                setParticipantInfo(pData || { role: 'viewer', team: null });
            }
        } catch (e) {
            console.error("[BattleView] Initialization error:", e);
        } finally {
            setLoading(false);
        }
    };

    const initBattleManager = async () => {
        // Logic for battle manager
        setLoading(false);
    };

    if (streamId) {
        initBattleManager();
    } else if (battleId) {
        initBattle();
    }

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
  }, [battleId, streamId, effectiveUserId]);

  if (streamId) {
    return (
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col p-4 text-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Battle Manager</h2>
          {onClose && (
            <button onClick={onClose} className="text-white">
              X
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-400">Battle management UI coming soon.</p>
        </div>
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
    <AgoraProvider>
      <div className="flex flex-col h-[100dvh] bg-black overflow-hidden">
          <div className="h-24 bg-zinc-900 border-b border-amber-500/30 flex items-center justify-between relative z-20 shadow-lg px-8">
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

        <BattleViewWithAgora 
          battle={battle} 
          challengerStream={challengerStream} 
          opponentStream={opponentStream} 
          participantInfo={participantInfo} 
          currentStreamId={_currentStreamId} 
        />
      </div>
    </AgoraProvider>
  );
}
