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
    const { profile } = useAuthStore();
    const [likes, setLikes] = React.useState(0);
    const [isLiking, setIsLiking] = React.useState(false);

    // Prefer live count from presence, fallback to DB count
    const displayViewerCount = liveViewerCount !== undefined ? liveViewerCount : (stream.viewer_count || 0);

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
        <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between pointer-events-none">
            {/* Left: Coin Balance */}
            <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-yellow-500/30 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg shadow-black/20">
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/50">
                    <Coins size={16} className="text-yellow-400" />
                </div>
                <div className="flex flex-col leading-none">
                    <span className="text-[10px] text-yellow-500/80 font-bold uppercase tracking-wider">Balance</span>
                    <span className="text-white font-bold font-mono">{profile?.troll_coins?.toLocaleString() || 0}</span>
                </div>
            </div>

            {/* Right: Stream Stats & Actions */}
            <div className="flex items-center gap-3 pointer-events-auto">
                {/* Viewers */}
                <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-2">
                    <Users size={14} className="text-blue-400" />
                    <span className="text-white font-bold text-sm">{displayViewerCount}</span>
                </div>

                {/* Likes */}
                <button 
                    onClick={handleLike}
                    className="bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/10 transition-colors group active:scale-95"
                >
                    <Heart size={14} className={cn("transition-colors", isLiking ? "text-pink-500 fill-pink-500" : "text-pink-400 group-hover:text-pink-300")} />
                    <span className="text-white font-bold text-sm">{likes.toLocaleString()}</span>
                </button>

                {/* Start Battle (Host Only or if allowed) */}
                {isHost && onStartBattle && (
                    <button 
                        onClick={onStartBattle}
                        className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-full px-4 py-1.5 font-bold text-sm flex items-center gap-2 shadow-lg shadow-red-900/20 active:scale-95 transition-transform"
                    >
                        <Swords size={14} />
                        <span className="hidden sm:inline">Battle</span>
                    </button>
                )}
            </div>
        </div>
    );
}
