import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { Coins, AlertCircle, ArrowLeft, Timer } from 'lucide-react';

export default function KickFeePage() {
    const { streamId } = useParams<{ streamId: string }>();
    const navigate = useNavigate();
    const { user, profile, refreshProfile } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [banInfo, setBanInfo] = useState<{ expires_at: string } | null>(null);

    useEffect(() => {
        if (!user || !streamId) return;
        
        const checkBanStatus = async () => {
            const { data } = await supabase
                .from('stream_bans')
                .select('expires_at')
                .eq('stream_id', streamId)
                .eq('user_id', user.id)
                .maybeSingle();

            if (data) {
                setBanInfo(data);
            } else {
                // Not banned? Redirect back to broadcast
                navigate(`/watch/${streamId}`);
            }
            setCheckingStatus(false);
        };

        checkBanStatus();

        // Listen for unban events
        const channel = supabase
            .channel(`kick_fee_bans:${streamId}`)
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'stream_bans',
                filter: `stream_id=eq.${streamId}`
            }, () => {
                // Check if the deleted ban was for this user
                // Payload.old might only contain ID, so we might need to re-check or check ID if we knew it.
                // But DELETE payloads usually only contain the PK. 
                // However, since we are filtering by stream_id (if possible in RLS? No, filter is string).
                // Actually, 'filter' in postgres_changes is limited.
                // Let's just re-check ban status on ANY delete in this stream's bans.
                checkBanStatus();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user, streamId, navigate]);

    const handlePayFee = async () => {
        if (!user || !streamId) return;
        if ((profile?.troll_coins || 0) < 100) {
            toast.error("Insufficient Troll Coins!");
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('pay_kick_fee', {
                p_stream_id: streamId,
                p_user_id: user.id
            });

            if (error) throw error;

            if (data === true) {
                toast.success("Fee paid! You can now re-enter.");
                await refreshProfile(); // Update balance
                navigate(`/watch/${streamId}`);
            } else {
                toast.error("Failed to process payment");
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    if (checkingStatus) {
        return <div className="min-h-screen bg-black flex items-center justify-center text-white">Checking status...</div>;
    }

    if (!banInfo) {
         return <div className="min-h-screen bg-black flex items-center justify-center text-white">Redirecting...</div>;
    }

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-zinc-900 border border-red-900/50 rounded-2xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-900" />
                
                <div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <AlertCircle size={40} className="text-red-500" />
                </div>

                <h1 className="text-3xl font-black uppercase tracking-tighter">Kicked Out!</h1>
                
                <p className="text-zinc-400">
                    You have been kicked from this broadcast by a moderator.
                </p>

                <div className="bg-black/40 rounded-lg p-4 border border-white/5 flex items-center justify-center gap-3">
                    <Timer className="text-orange-500" />
                    <span className="font-mono text-lg text-orange-400">
                        24 Hour Timeout
                    </span>
                </div>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-zinc-900 px-2 text-zinc-500">Or Pay to Re-enter</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={handlePayFee}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-black py-4 rounded-xl flex items-center justify-center gap-3 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            "Processing..."
                        ) : (
                            <>
                                <Coins size={24} className="text-black" />
                                PAY 100 COINS TO ENTER
                            </>
                        )}
                    </button>
                    
                    <p className="text-xs text-zinc-500">
                        Current Balance: <span className="text-yellow-500 font-bold">{profile?.troll_coins || 0}</span> Coins
                    </p>
                </div>

                <button 
                    onClick={() => navigate('/')}
                    className="flex items-center justify-center gap-2 text-zinc-500 hover:text-white text-sm mt-4 w-full"
                >
                    <ArrowLeft size={16} />
                    Return to Home
                </button>
            </div>
        </div>
    );
}