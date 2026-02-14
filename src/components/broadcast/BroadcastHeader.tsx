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
}

export default function BroadcastHeader({ stream, onStartBattle, isHost, liveViewerCount }: BroadcastHeaderProps) {
    const { profile, setProfile } = useAuthStore();
    const [likes, setLikes] = React.useState(0);
    const [isLiking, setIsLiking] = React.useState(false);
    const profileRef = React.useRef(profile);

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

    return (
        <div className="absolute top-16 left-4 right-4 z-50 flex items-center justify-end pointer-events-none">
            {/* Left: Coin Balance - REMOVED from left to avoid covering LIVE indicator, now on right */}
            <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-yellow-500/30 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg shadow-black/20">
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/50">
                    <Coins size={16} className="text-yellow-400" />
                </div>
                <div className="flex flex-col leading-none">
                    <span className="text-[10px] text-yellow-500/70 font-bold uppercase tracking-wider">Balance</span>
                    <span className="text-sm font-black text-white">
                        {(profile?.troll_coins || 0).toLocaleString()}
                    </span>
                </div>
            </div>

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

                {isHost && onStartBattle && (
                    <button 
                        onClick={onStartBattle}
                        className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full px-4 py-1.5 shadow-lg shadow-red-500/20 transition-all pointer-events-auto"
                    >
                        <Swords size={14} />
                        <span className="text-xs font-bold">BATTLE</span>
                    </button>
                )}
            </div>
        </div>
    );
}
