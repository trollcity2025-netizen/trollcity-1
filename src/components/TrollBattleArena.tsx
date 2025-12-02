// src/components/TrollBattleArena.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { Trophy, Sword, Flame, Clock, Coins } from "lucide-react";

type TrollBattle = {
  id: string;
  host_id: string;
  challenger_id: string;
  host_paid_coins: number;
  challenger_paid_coins: number;
  host_free_coins: number;
  challenger_free_coins: number;
  start_time: string;
  end_time: string;
  status: "pending" | "active" | "completed";
  winner_id: string | null;
};

interface TrollBattleArenaProps {
  battleId: string;
  hostUsername: string;
  challengerUsername: string;
  isHost: boolean;        // true if current user is the host in this battle
}

const TrollBattleArena: React.FC<TrollBattleArenaProps> = ({
  battleId,
  hostUsername,
  challengerUsername,
  isHost
}) => {
  const { user } = useAuthStore();
  const [battle, setBattle] = useState<TrollBattle | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(120);
  const [completing, setCompleting] = useState(false);
  const [loadedHostUsername, setLoadedHostUsername] = useState(hostUsername);
  const [loadedChallengerUsername, setLoadedChallengerUsername] = useState(challengerUsername);

  // Load battle data and usernames
  useEffect(() => {
    const loadBattle = async () => {
      const { data, error } = await supabase
        .from("troll_battles")
        .select("*")
        .eq("id", battleId)
        .single();

      if (!error && data) {
        setBattle(data as TrollBattle);
        
        // Load usernames
        const [hostData, challengerData] = await Promise.all([
          supabase.from('user_profiles').select('username').eq('id', data.host_id).single(),
          supabase.from('user_profiles').select('username').eq('id', data.challenger_id).single(),
        ]);
        
        if (hostData.data) setLoadedHostUsername(hostData.data.username);
        if (challengerData.data) setLoadedChallengerUsername(challengerData.data.username);
      }
    };
    loadBattle();
  }, [battleId]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`troll-battle-${battleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "troll_battles",
          filter: `id=eq.${battleId}`
        },
        (payload) => {
          setBattle(payload.new as TrollBattle);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [battleId]);

  // Timer
  useEffect(() => {
    if (!battle || battle.status !== "active") return;

    const endTime = new Date(battle.end_time).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((endTime - now) / 1000));
      setRemainingSeconds(diff);
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [battle]);

  // Auto-complete when timer hits zero
  useEffect(() => {
    const autoComplete = async () => {
      if (!battle) return;
      if (battle.status !== "active") return;
      if (remainingSeconds > 0) return;
      if (completing) return;

      setCompleting(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        const accessToken = session.session?.access_token;
        if (!accessToken) return;

        const functionUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL?.replace(/\/$/, '') 
          || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1';

        await fetch(
          `${functionUrl}/troll-battle?op=complete`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify({ battle_id: battle.id })
          }
        );
      } catch (err) {
        console.error("Error completing battle", err);
      } finally {
        setCompleting(false);
      }
    };

    autoComplete();
  }, [remainingSeconds, battle, completing]);

  if (!battle) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white">
        Loading Troll Battle...
      </div>
    );
  }

  const hostPaid = battle.host_paid_coins || 0;
  const challengerPaid = battle.challenger_paid_coins || 0;
  const hostFree = battle.host_free_coins || 0;
  const challengerFree = battle.challenger_free_coins || 0;
  
  // Total coins (paid + free) count toward victory
  const hostTotal = hostPaid + hostFree;
  const challengerTotal = challengerPaid + challengerFree;
  
  const totalFree = hostFree + challengerFree || 1;
  const hostFreePct = Math.round((hostFree / totalFree) * 100);
  const challengerFreePct = 100 - hostFreePct;

  const isCompleted = battle.status === "completed";
  const winnerIsHost = battle.winner_id && battle.winner_id === battle.host_id;
  const winnerIsChallenger =
    battle.winner_id && battle.winner_id === battle.challenger_id;
  const isTie = isCompleted && !battle.winner_id;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative w-full h-full flex flex-col gap-3 bg-black/80 border border-purple-500/50 rounded-2xl p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-purple-300 uppercase text-xs tracking-wide">
          <Sword className="w-4 h-4" />
          <span>Troll Battle</span>
        </div>
        <div className="flex items-center gap-2 text-green-300">
          <Clock className="w-4 h-4" />
          <span className="font-mono text-sm">
            {formatTime(remainingSeconds)}
          </span>
        </div>
      </div>

      {/* Main battle area */}
      <div className="grid grid-cols-2 gap-3">
        {/* Host side */}
        <div className="flex flex-col gap-2 bg-purple-900/40 border border-purple-500/50 rounded-xl p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-purple-200 uppercase">Host</span>
            <span className="text-sm font-semibold text-white">
              {loadedHostUsername}
            </span>
          </div>

          {/* Video placeholder - swap these for your actual video components */}
          <div className="relative w-full aspect-[9/16] bg-black rounded-lg overflow-hidden flex items-center justify-center text-xs text-purple-200 border border-purple-600/60">
            {/* Drop in your actual live video here for host */}
            Host Video
          </div>

          {/* Total coins (paid + free count toward win) */}
          <div className="flex items-center justify-between text-xs text-yellow-300 mb-1">
            <div className="flex items-center gap-1">
              <Coins className="w-4 h-4" />
              <span>Total Coins</span>
            </div>
            <span className="font-mono text-sm font-bold">{hostTotal}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span>Paid: {hostPaid}</span>
            <span>Free: {hostFree}</span>
          </div>
        </div>

        {/* Challenger side */}
        <div className="flex flex-col gap-2 bg-amber-900/40 border border-amber-500/50 rounded-xl p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-200 uppercase">
              Challenger
            </span>
            <span className="text-sm font-semibold text-white">
              {loadedChallengerUsername}
            </span>
          </div>

          {/* Video placeholder - swap these for challenger video */}
          <div className="relative w-full aspect-[9/16] bg-black rounded-lg overflow-hidden flex items-center justify-center text-xs text-amber-200 border border-amber-600/60">
            Challenger Video
          </div>

          {/* Total coins (paid + free count toward win) */}
          <div className="flex items-center justify-between text-xs text-yellow-300 mb-1">
            <div className="flex items-center gap-1">
              <Coins className="w-4 h-4" />
              <span>Total Coins</span>
            </div>
            <span className="font-mono text-sm font-bold">{challengerTotal}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span>Paid: {challengerPaid}</span>
            <span>Free: {challengerFree}</span>
          </div>
        </div>
      </div>

      {/* Coin breakdown bar */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-[10px] text-gray-300 mb-1">
          <span>All coins count toward victory (paid + free)</span>
          <Flame className="w-3 h-3" />
        </div>
        <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-purple-500/80"
            style={{ width: `${hostFreePct}%` }}
          />
          <div
            className="h-full bg-amber-500/80"
            style={{ width: `${challengerFreePct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>Host: {hostFree} free</span>
          <span>Challenger: {challengerFree} free</span>
        </div>
      </div>

      {/* Winner banner */}
      {isCompleted && (
        <div className="mt-2 flex items-center justify-center">
          {isTie ? (
            <div className="flex items-center gap-2 text-gray-200 text-sm bg-gray-800/80 px-3 py-1 rounded-full">
              <Trophy className="w-4 h-4" />
              <span>It&apos;s a tie! Trolls are confused.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-yellow-300 text-sm bg-black/80 border border-yellow-500/60 px-3 py-1 rounded-full">
              <Trophy className="w-4 h-4" />
              <span>
                Winner:{" "}
                {winnerIsHost ? loadedHostUsername : winnerIsChallenger ? loadedChallengerUsername : "Unknown"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tiny footer note */}
      <div className="mt-1 text-[10px] text-gray-500 text-center">
        All coins (paid + free) count toward victory!
      </div>
    </div>
  );
};

export default TrollBattleArena;

