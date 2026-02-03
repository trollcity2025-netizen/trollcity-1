import React, { useEffect, useState } from 'react';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { supabase } from '../../lib/supabase';
import { Stream } from '../../types/broadcast';
import BroadcastGrid from './BroadcastGrid';
import { useAuthStore } from '../../lib/store';
import { Loader2, Coins, User, Plus } from 'lucide-react';
import BroadcastControls from './BroadcastControls';
import BroadcastChat from './BroadcastChat';
import MuteHandler from './MuteHandler';
import { toast } from 'sonner';

interface BattleViewProps {
  battleId: string;
  currentStreamId: string; // The stream ID the user originally navigated to
}

export default function BattleView({ battleId, currentStreamId }: BattleViewProps) {
  const [battle, setBattle] = useState<any>(null);
  const [challengerStream, setChallengerStream] = useState<Stream | null>(null);
  const [opponentStream, setOpponentStream] = useState<Stream | null>(null);
  
  const [tokenChallenger, setTokenChallenger] = useState<string>("");
  const [tokenOpponent, setTokenOpponent] = useState<string>("");
  
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initBattle = async () => {
        // 1. Fetch Battle
        const { data: battleData } = await supabase.from('battles').select('*').eq('id', battleId).single();
        if (!battleData) return;
        setBattle(battleData);

        // 2. Fetch Both Streams
        const { data: streams } = await supabase.from('streams').select('*').in('id', [battleData.challenger_stream_id, battleData.opponent_stream_id]);
        if (!streams) return;

        const cStream = streams.find(s => s.id === battleData.challenger_stream_id);
        const oStream = streams.find(s => s.id === battleData.opponent_stream_id);
        
        setChallengerStream(cStream || null);
        setOpponentStream(oStream || null);
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
            setBattle(payload.new);
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [battleId, user]);

  // Timer & Sudden Death Logic
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isSuddenDeath, setIsSuddenDeath] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  useEffect(() => {
    if (!battle?.started_at || battle.status !== 'active') {
        if (battle?.status === 'ended') setHasEnded(true);
        return;
    }

    const interval = setInterval(() => {
        const now = new Date();
        const start = new Date(battle.started_at);
        const elapsed = (now.getTime() - start.getTime()) / 1000;
        
        const BATTLE_DURATION = 180; // 3 mins
        const SUDDEN_DEATH = 10; // 10s
        
        if (elapsed < BATTLE_DURATION) {
            setTimeLeft(Math.ceil(BATTLE_DURATION - elapsed));
            setIsSuddenDeath(false);
        } else if (elapsed < BATTLE_DURATION + SUDDEN_DEATH) {
            setTimeLeft(Math.ceil((BATTLE_DURATION + SUDDEN_DEATH) - elapsed));
            setIsSuddenDeath(true);
        } else {
            setTimeLeft(0);
            setIsSuddenDeath(true);
            if (!hasEnded && (isChallengerHost || isOpponentHost)) {
                setHasEnded(true);
                endBattle();
            }
        }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [battle?.started_at, battle?.status, isChallengerHost, isOpponentHost, hasEnded]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Using a separate effect to fetch tokens via the existing API pattern
  useEffect(() => {
    if (!user || !challengerStream || !opponentStream) return;

    const fetchTokens = async () => {
        try {
            // Token for Challenger Room
            const { data: dataC, error: errorC } = await supabase.functions.invoke('get-livekit-token', {
                body: { room: challengerStream.id, username: user.id } // Room name is stream ID
            });
            if (errorC) throw errorC;
            if (dataC?.token) setTokenChallenger(dataC.token);

            // Token for Opponent Room
            const { data: dataO, error: errorO } = await supabase.functions.invoke('get-livekit-token', {
                body: { room: opponentStream.id, username: user.id }
            });
            if (errorO) throw errorO;
            if (dataO?.token) setTokenOpponent(dataO.token);

            setLoading(false);
        } catch (e) {
            console.error("Error fetching tokens", e);
            // Don't set loading false immediately if we want to retry, but for now just show error state
            setLoading(false);
        }
    };
    fetchTokens();
  }, [user, challengerStream, opponentStream]);

  const endBattle = async () => {
      if (!battle) return;
      if (confirm("Are you sure you want to end this battle?")) {
          try {
            // 1. Mark as ended
            await supabase.from('battles').update({ status: 'ended', winner_id: user?.id }).eq('id', battle.id);
            
            // 2. Distribute Winnings (RPC)
            const { data, error } = await supabase.rpc('distribute_battle_winnings', { p_battle_id: battle.id });
            if (error) {
                console.error("Distribution error:", error);
                toast.error("Battle ended but payout failed.");
            } else {
                toast.success(`Battle Ended! Winnings distributed to ${data?.recipients || 0} participants.`);
            }

            // 3. Cleanup Streams
            await supabase.from('streams').update({ battle_id: null, is_battle: false }).in('id', [challengerStream?.id, opponentStream?.id]);
          } catch (e) {
              console.error(e);
          }
      }
  };

  if (loading || !challengerStream || !opponentStream) {
    return <div className="flex items-center justify-center h-screen bg-black text-amber-500"><Loader2 className="animate-spin" size={48} /></div>;
  }

  // Determine if I am a host of one of the sides
  const isChallengerHost = user?.id === challengerStream.user_id;
  const isOpponentHost = user?.id === opponentStream.user_id;
  const liveKitUrl = import.meta.env.VITE_LIVEKIT_URL || "wss://trollcity-722100.livekit.cloud";

  // Calculate percentages for bar
  const totalScore = (battle?.score_challenger || 0) + (battle?.score_opponent || 0);
  const challengerPercent = totalScore === 0 ? 50 : Math.round((battle?.score_challenger / totalScore) * 100);
  const opponentPercent = 100 - challengerPercent;

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden">
        {/* Battle Header */}
        <div className="h-24 bg-zinc-900 border-b border-amber-500/30 flex items-center justify-between relative z-20 shadow-lg shadow-amber-900/20 px-8">
            
            {/* Challenger Info */}
            <div className="flex-1 flex items-center justify-end gap-4">
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-white tracking-tight">{challengerStream.title}</h2>
                    <div className="flex items-center justify-end gap-1 text-zinc-400">
                        {/* Removed Coins Icon to reduce confusion */}
                        <span className="font-mono text-xl font-bold">{(battle?.score_challenger || 0).toLocaleString()} pts</span>
                    </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 border-2 border-white/20 shadow-lg flex items-center justify-center relative">
                    <User className="text-white" />
                    {/* Win Indicator if needed */}
                </div>
            </div>

            {/* Center: VS & Pot */}
            <div className="mx-8 flex flex-col items-center justify-center min-w-[200px]">
                 <div className="flex flex-col items-center mb-1">
                    <span className="text-xs text-amber-500/70 uppercase tracking-widest font-bold">Battle Pot</span>
                    <div className="flex items-center gap-2 text-amber-500 bg-amber-950/50 px-4 py-1 rounded-full border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                        <Coins size={20} className="text-amber-400 fill-amber-400" />
                        <span className="font-mono text-2xl font-black tracking-tight">
                            {((battle?.pot_challenger || 0) + (battle?.pot_opponent || 0)).toLocaleString()}
                        </span>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-3 flex-col">
                     <span className={`text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b ${isSuddenDeath ? 'from-red-500 to-yellow-500 animate-pulse scale-110' : 'from-red-500 to-red-800'} italic tracking-widest transform -skew-x-12 transition-all duration-300`}>
                        {isSuddenDeath ? "SUDDEN DEATH" : "VS"}
                     </span>
                     
                     <div className={`font-mono text-2xl font-bold ${isSuddenDeath ? 'text-red-500 animate-bounce' : 'text-white'}`}>
                        {battle?.status === 'ended' ? "FINISHED" : formatTime(timeLeft)}
                     </div>
                 </div>
            </div>

            {/* Opponent Info */}
            <div className="flex-1 flex items-center justify-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-green-500 to-teal-500 border-2 border-white/20 shadow-lg flex items-center justify-center">
                    <User className="text-white" />
                </div>
                <div className="text-left">
                    <h2 className="text-2xl font-bold text-white tracking-tight">{opponentStream.title}</h2>
                    <div className="flex items-center justify-start gap-1 text-zinc-400">
                        {/* Removed Coins Icon */}
                        <span className="font-mono text-xl font-bold">{(battle?.score_opponent || 0).toLocaleString()} pts</span>
                    </div>
                </div>
            </div>
            
            {/* Progress Bar (Absolute Bottom of Header) */}
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

        {/* Battle Arena (Split View) */}
        <div className="flex-1 flex overflow-hidden">
            {/* Challenger Side */}
            <div className="w-1/2 border-r border-amber-500/20 relative">
                 {tokenChallenger && (
                    <LiveKitRoom
                        serverUrl={liveKitUrl}
                        token={tokenChallenger}
                        connect={true}
                        video={isChallengerHost} // Only publish if host
                        audio={isChallengerHost}
                        className="h-full"
                    >
                        <MuteHandler streamId={challengerStream.id} />
                        <BroadcastGrid 
                            stream={challengerStream} 
                            isHost={isChallengerHost} 
                            maxItems={4} 
                        />
                        <RoomAudioRenderer />
                    </LiveKitRoom>
                 )}
            </div>

            {/* Opponent Side */}
            <div className="w-1/2 relative">
                {tokenOpponent && (
                    <LiveKitRoom
                        serverUrl={liveKitUrl}
                        token={tokenOpponent}
                        connect={true}
                        video={isOpponentHost} // Only publish if host
                        audio={isOpponentHost}
                        className="h-full"
                    >
                        <MuteHandler streamId={opponentStream.id} />
                        <BroadcastGrid 
                            stream={opponentStream} 
                            isHost={isOpponentHost} 
                            maxItems={4} 
                        />
                        <RoomAudioRenderer />
                    </LiveKitRoom>
                 )}
            </div>
        </div>
        
        {/* Chat & Controls Overlay (Bottom) */}
        {/* We reuse the Chat from the stream we are originally viewing or a unified chat? */}
        {/* Ideally, a unified battle chat or just show the chat of the stream we entered through. */}
        {/* For MVP, let's show the chat of the `currentStreamId`. */}
        <div className="h-64 border-t border-zinc-800 flex bg-zinc-900">
             <div className="w-1/3 border-r border-zinc-800 p-4">
                 <h3 className="text-amber-500 font-bold mb-2">Battle Chat</h3>
                 <BroadcastChat streamId={currentStreamId} isModerator={false} />
             </div>
             <div className="w-2/3 p-4">
                {/* Controls for the host if I am one */}
                {(isChallengerHost || isOpponentHost) && (
                    <div className="flex gap-4">
                         <button 
                            onClick={endBattle}
                            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-bold shadow-lg"
                         >
                            END BATTLE
                         </button>
                         {/* Other controls */}
                    </div>
                )}
             </div>
        </div>
    </div>
  );
}
