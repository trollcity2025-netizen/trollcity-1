import React from 'react';
import { useAuthStore } from '../../lib/store';
import { Heart, Users, Coins, Swords } from 'lucide-react';
import { Stream } from '../../types/broadcast';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';

interface BroadcastHeaderProps {
    stream: Stream;
    onStartBattle?: () => void;
    isHost: boolean;
    liveViewerCount?: number;
    eventRemainingMs?: number | null;
    eventEnded?: boolean;
    broadcasterProfile: any;
    hideBattleButton?: boolean;

}

export default function BroadcastHeader({ stream, onStartBattle, isHost, liveViewerCount, eventRemainingMs, eventEnded, broadcasterProfile, hideBattleButton, hideCoinBalance }: BroadcastHeaderProps) {
    const { profile, setProfile } = useAuthStore();
    const [likes, setLikes] = React.useState(0);
    const [isLiking, setIsLiking] = React.useState(false);
    const profileRef = React.useRef(profile);
    const lastLikeRef = React.useRef(0);

    // Keep profileRef up to date
    React.useEffect(() => {
        profileRef.current = profile;
    }, [profile]);

    // Listen for real-time balance updates
    React.useEffect(() => {
        if (!profile?.id) return;

        const channel = supabase.channel(`profile_balance_${profile.id}`)
            .on(
                'postgres_changes', 
                { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'user_profiles', 
                    filter: `id=eq.${profile.id}` 
                }, 
                (payload) => {
                    const currentProfile = profileRef.current;
                    if (!currentProfile) return;

                    const newProfile = { ...currentProfile, ...payload.new } as any;
                    
                    // TRAE FIX: Race condition protection
                    // Check if the incoming update is actually newer than our current state.
                    // This prevents stale 'postgres_changes' events from overwriting optimistic updates.
                    const currentUpdatedAt = currentProfile.updated_at ? new Date(currentProfile.updated_at).getTime() : 0;
                    const newUpdatedAt = payload.new.updated_at ? new Date(payload.new.updated_at).getTime() : 0;

                    // If timestamps are valid, enforce strict ordering
                    if (currentUpdatedAt > 0 && newUpdatedAt > 0) {
                        if (newUpdatedAt <= currentUpdatedAt) {
                            // Incoming update is older or same age as our base state.
                            // If we have optimistic updates (coins changed locally), we don't want to revert them.
                            return;
                        }
                    }

                    // Only update if balance changed to avoid loops/renders
                    if (newProfile.troll_coins !== currentProfile.troll_coins) {
                         setProfile(newProfile);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, [profile?.id, setProfile]);

    // Prefer live count from presence, fallback to DB count
    const displayViewerCount = liveViewerCount !== undefined 
        ? liveViewerCount 
        : (stream.current_viewers || stream.viewer_count || 0);

    // Sync likes with stream object
    React.useEffect(() => {
        if ((stream as any).total_likes !== undefined) {
            setLikes((stream as any).total_likes);
        }
    }, [stream]);

    // Optimistic Like Handler
    const handleLike = async () => {
        if (isLiking) return;
        const now = Date.now();
        if (now - lastLikeRef.current < 1500) return;
        lastLikeRef.current = now;
        setIsLiking(true);
        const newCount = likes + 1;
        setLikes(newCount);

        try {
            // Fire and forget RPC or update
            const { error } = await supabase.rpc('increment_stream_likes', { stream_id: stream.id });
            if (error) throw error;
        } catch (e) {
            console.error('Failed to like stream', e);
            // Revert on error? Nah, keep it optimistic for now to avoid jumpiness
        } finally {
            setTimeout(() => setIsLiking(false), 500);
        }
    };

    const formatRemaining = (remainingMs: number) => {
        const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const showTimer = typeof eventRemainingMs === 'number' && eventRemainingMs >= 0;

    return (
        <div className="absolute top-16 left-4 right-4 z-50 flex items-center justify-end gap-3 pointer-events-none">
            {showTimer && (
                <div className={`pointer-events-auto rounded-full px-4 py-2 flex items-center gap-2 shadow-lg shadow-black/20 border ${
                    eventEnded ? 'bg-red-500/20 border-red-500/40' : 'bg-black/40 border-white/10'
                }`}
                >
                    <div className={`text-xs font-bold uppercase tracking-wider ${eventEnded ? 'text-red-300' : 'text-zinc-300'}`}>
                        {eventEnded ? 'Event ended' : 'Event ends in'}
                    </div>
                    {!eventEnded && (
                        <div className="text-sm font-mono font-black text-white">
                            {formatRemaining(eventRemainingMs || 0)}
                        </div>
                    )}
                </div>
            )}







            {/* Right: Stream Stats - HIDDEN for now to keep header clean and avoid overlap with sidebar on desktop */}
            <div className="hidden items-center gap-3">
                <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/5">
                    <Users size={14} className="text-zinc-400" />
                    <span className="text-xs font-bold text-white">{displayViewerCount}</span>
                </div>

                <button 
                    onClick={handleLike}
                    disabled={isLiking}
                    className={cn(
                        "flex items-center gap-1.5 bg-pink-500/20 hover:bg-pink-500/30 backdrop-blur-md rounded-full px-3 py-1.5 border border-pink-500/30 transition-all pointer-events-auto",
                        isLiking && "scale-110"
                    )}
                >
                    <Heart size={14} className={cn("text-pink-500", isLiking && "fill-pink-500")} />
                    <span className="text-xs font-bold text-pink-500">{likes}</span>
                </button>

            </div>
        </div>
    );
}
