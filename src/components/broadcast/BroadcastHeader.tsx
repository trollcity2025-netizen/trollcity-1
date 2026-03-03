import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../lib/store';
import { Heart, Users, Swords, ArrowLeft } from 'lucide-react';
import { Stream } from '../../types/broadcast';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';

interface BroadcastHeaderProps {
    stream: Stream;
    onStartBattle?: () => void;
    categoryBattleTerm?: string;
    isHost: boolean;
    liveViewerCount?: number;
    handleLike: () => void;
    onBack?: () => void;
}

export default function BroadcastHeader({ stream, onStartBattle, categoryBattleTerm, isHost, liveViewerCount, handleLike, onBack }: BroadcastHeaderProps) {
    const { profile, setProfile } = useAuthStore();
    const [likes, setLikes] = React.useState(0);
    const [isLiking, setIsLiking] = React.useState(false);
    const profileRef = React.useRef(profile);
    const navigate = useNavigate();

    // Handle back button - if onBack prop provided use it, otherwise navigate home
    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate('/');
        }
    };

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
        if (stream.total_likes !== undefined) {
            setLikes(stream.total_likes);
        }
    }, [stream.total_likes]);



    return (
        <div className="absolute top-16 left-4 right-4 z-50 flex items-center justify-between gap-3 pointer-events-none">
            {/* Back Button - Mobile/Immersive Mode */}
            <button
                onClick={handleBack}
                className="pointer-events-auto flex items-center justify-center w-10 h-10 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full border border-white/10 transition-all"
            >
                <ArrowLeft size={20} className="text-white" />
            </button>

            <div className="hidden items-center gap-3">
                {isHost && onStartBattle && (
                    <button
                        onClick={onStartBattle}
                        className="pointer-events-auto flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white rounded-full px-4 py-2 shadow-lg shadow-red-500/20 transition-all"
                    >
                        <Swords size={16} />
                        <span className="text-xs font-bold">
                            {categoryBattleTerm ? categoryBattleTerm.toUpperCase() : (stream.stream_kind === 'trollmers' ? 'HEAD TO HEAD' : 'BATTLE')}
                        </span>
                    </button>
                )}
            </div>

            {/* Right: Stream Stats */}
            <div className="flex items-center gap-3">
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
