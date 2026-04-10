import React from 'react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { Heart, Users, Crown, Gem, Coins, LayoutGrid } from 'lucide-react';
import { Stream } from '../../types/broadcast';
import { cn } from '../../lib/utils';

interface BroadcastHeaderProps {
    stream: Stream;
    isHost: boolean;
    liveViewerCount?: number;
    handleLike: () => void;
    hasPendingChallenge?: boolean;
    onAddBox?: () => void;
    onRemoveBox?: () => void;
    boxCount?: number;
}

export default function BroadcastHeader({ 
    stream, 
    isHost, 
    liveViewerCount, 
    handleLike,
    hasPendingChallenge,
    onAddBox,
    onRemoveBox,
    boxCount
}: BroadcastHeaderProps) {
    const { profile, setProfile } = useAuthStore();
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

    // Get likes directly from stream - no local state needed
    const displayLikes = stream.total_likes || 0;

    return (
        <div className="absolute top-16 left-4 right-4 z-50 flex items-center justify-between gap-2 pointer-events-none">
            {/* Left: Balance displays + Layout button */}
            <div className="flex items-center gap-2">
                {isHost && (
                    <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                        <button 
                            onClick={onRemoveBox}
                            disabled={!onRemoveBox || (boxCount || 1) <= 1}
                            className="px-2 py-1.5 text-white hover:bg-white/10 disabled:opacity-30 pointer-events-auto"
                        >
                            <LayoutGrid size={12} className="rotate-90" />
                        </button>
                        <span className="text-[10px] font-bold text-white min-w-[16px] text-center">{boxCount || 1}</span>
                        <button 
                            onClick={onAddBox}
                            disabled={!onAddBox || (boxCount || 1) >= 6}
                            className="px-2 py-1.5 text-white hover:bg-white/10 disabled:opacity-30 pointer-events-auto"
                        >
                            <LayoutGrid size={12} className="-rotate-90" />
                        </button>
                    </div>
                )}
                {profile && (
                    <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-2 py-1 border border-white/10">
                        <Crown size={10} className="text-amber-400" />
                        <span className="text-[10px] font-bold text-white">{profile.battle_crowns || 0}</span>
                        <Gem size={10} className="text-purple-400" />
                        <span className="text-[10px] font-bold text-white">{profile.trollmonds || 0}</span>
                        <Coins size={10} className="text-yellow-400" />
                        <span className="text-[10px] font-bold text-white">{(profile.troll_coins || 0).toLocaleString()}</span>
                    </div>
                )}
            </div>

            {/* Right: Stream Stats */}
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-2 py-1.5 border border-white/10">
                    <Users size={12} className="text-zinc-400" />
                    <span className="text-[10px] font-bold text-white">{displayViewerCount}</span>
                </div>

                <button 
                    onClick={handleLike}
                    disabled={isLiking}
                    className={cn(
                        "flex items-center gap-1.5 bg-pink-500/20 hover:bg-pink-500/30 backdrop-blur-md rounded-full px-2 py-1.5 border border-pink-500/30 transition-all pointer-events-auto",
                        isLiking && "scale-110"
                    )}
                >
                    <Heart size={12} className={cn("text-pink-500", isLiking && "fill-pink-500")} />
                    <span className="text-[10px] font-bold text-pink-500">{displayLikes.toLocaleString()}</span>
                </button>

            </div>
        </div>
    );
}
