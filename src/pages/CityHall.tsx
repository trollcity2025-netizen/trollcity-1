import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Building2, Crown, Users, Clock, ArrowRight } from 'lucide-react';
import { trollCityTheme } from '../styles/trollCityTheme';
// import { useNavigate } from 'react-router-dom';

interface AdminQueueItem {
    user_id: string;
    username: string;
    joined_at: string;
    status: string;
    position: number;
}

interface CurrentAdmin {
    user_id: string;
    username: string;
    started_at: string;
}

export default function CityHall() {
    const { user } = useAuthStore();
    const isUnderConstruction = true;
    const [queue, setQueue] = useState<AdminQueueItem[]>([]);
    const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
    const [loading, setLoading] = useState(false);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        // Fetch Current Admin
        const { data: currentData, error: _currentError } = await supabase.rpc('get_current_admin_week');
        if (currentData && currentData.length > 0) {
            setCurrentAdmin(currentData[0]);
        } else {
            setCurrentAdmin(null);
        }

        // Fetch Queue
        const { data: queueData, error: _queueError } = await supabase.rpc('get_admin_queue');
        if (queueData) {
            setQueue(queueData);
        }
        setLoading(false);
    };

    const handleJoinQueue = async () => {
        if (!user) return;
        if (!confirm('Join the "Admin for a Week" queue for 100,000 coins?')) return;

        setJoining(true);
        try {
            const { data, error } = await supabase.rpc('join_admin_queue');
            
            if (error) throw error;
            if (data && !data.success) {
                throw new Error(data.error || 'Failed to join queue');
            }

            toast.success('You have joined the Admin Queue!');
            fetchData();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setJoining(false);
        }
    };

    return (
        <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white p-4 pb-20 md:pb-4 md:ml-64`}>
            <div className="max-w-4xl mx-auto space-y-8">
                
                {/* Header */}
                <div className={`flex items-center gap-4 border-b ${trollCityTheme.borders.glass} pb-6`}>
                    <div className={`p-4 ${trollCityTheme.backgrounds.card} rounded-2xl border ${trollCityTheme.borders.glass}`}>
                        <Building2 className="w-10 h-10 text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            Troll City Hall
                        </h1>
                        <p className={`${trollCityTheme.text.muted} mt-1`}>
                            The seat of temporary power. Rule the city for a week.
                        </p>
                    </div>
                </div>

                {/* Under Construction Banner */}
                {isUnderConstruction && (
                    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-amber-200">
                        <div className="text-sm font-semibold uppercase tracking-wider">Under Construction</div>
                        <div className="mt-1 text-sm text-amber-100/90">
                            City Hall is being rebuilt. Admin queue and actions are temporarily disabled.
                        </div>
                    </div>
                )}

                {/* Current Admin Section */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-6 relative overflow-hidden rounded-2xl`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Crown className="w-32 h-32" />
                        </div>
                        
                        <div className="relative z-10">
                            <h2 className="text-yellow-500 font-bold uppercase tracking-wider text-sm mb-4 flex items-center gap-2">
                                <Crown className="w-4 h-4" /> Current Admin of the Week
                            </h2>
                            
                            {loading ? (
                                <div className="animate-pulse h-16 bg-white/5 rounded-xl"></div>
                            ) : currentAdmin ? (
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center text-black font-bold text-2xl">
                                        {currentAdmin.username.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-white">{currentAdmin.username}</div>
                                        <div className="text-sm text-yellow-500/70 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Reign started: {new Date(currentAdmin.started_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    No Admin currently seated.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Join Queue CTA */}
                    <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-6 flex flex-col justify-between rounded-2xl`}>
                        <div>
                            <h2 className="text-purple-400 font-bold uppercase tracking-wider text-sm mb-2 flex items-center gap-2">
                                <Users className="w-4 h-4" /> Join the Queue
                            </h2>
                            <p className={`${trollCityTheme.text.muted} text-sm mb-4`}>
                                Become an Admin for 7 days. Gain special moderation powers and a badge.
                            </p>
                            <div className="text-3xl font-bold text-white mb-1">
                                100,000 <span className="text-sm text-purple-400 font-normal">Coins</span>
                            </div>
                        </div>

                        <button 
                            onClick={handleJoinQueue}
                            disabled={joining || loading || isUnderConstruction}
                            className={`w-full mt-4 ${trollCityTheme.buttons.primary} py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isUnderConstruction ? 'Under Construction' : joining ? 'Processing...' : 'Join Queue'}
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Queue List */}
                <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl overflow-hidden`}>
                    <div className={`p-4 border-b ${trollCityTheme.borders.glass} flex items-center justify-between`}>
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Clock className={`w-4 h-4 ${trollCityTheme.text.muted}`} /> Waiting List
                        </h3>
                        <span className={`text-xs ${trollCityTheme.text.muted}`}>{queue.length} in line</span>
                    </div>

                    <div className={`divide-y ${trollCityTheme.borders.glass}`}>
                        {loading ? (
                            [1,2,3].map(i => (
                                <div key={i} className="p-4 animate-pulse flex items-center gap-4">
                                    <div className="w-8 h-8 bg-white/10 rounded-full"></div>
                                    <div className="h-4 bg-white/10 rounded w-32"></div>
                                </div>
                            ))
                        ) : queue.length === 0 ? (
                            <div className={`p-8 text-center ${trollCityTheme.text.muted}`}>
                                The queue is empty. Be the next Admin!
                            </div>
                        ) : (
                            queue.map((item) => (
                                <div key={item.user_id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 ${trollCityTheme.backgrounds.input} rounded-full flex items-center justify-center text-xs font-bold ${trollCityTheme.text.muted}`}>
                                            #{item.position}
                                        </div>
                                        <div>
                                            <div className="font-medium text-white">{item.username}</div>
                                            <div className={`text-xs ${trollCityTheme.text.muted}`}>Joined {new Date(item.joined_at).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    {item.user_id === user?.id && (
                                        <div className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded border border-purple-500/30">
                                            YOU
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Info Section */}
                <div className={`grid md:grid-cols-3 gap-4 text-sm ${trollCityTheme.text.muted}`}>
                    <div className={`p-4 ${trollCityTheme.backgrounds.card} rounded-xl border ${trollCityTheme.borders.glass}`}>
                        <h4 className="font-bold text-white mb-2">Duration</h4>
                        <p>Each term lasts exactly 7 days. If the current admin is removed early, the next person in line takes over immediately.</p>
                    </div>
                    <div className={`p-4 ${trollCityTheme.backgrounds.card} rounded-xl border ${trollCityTheme.borders.glass}`}>
                        <h4 className="font-bold text-white mb-2">Powers</h4>
                        <p>Access to kick, mute, and ban (24h) controls. You can also host city-wide events.</p>
                    </div>
                    <div className={`p-4 ${trollCityTheme.backgrounds.card} rounded-xl border ${trollCityTheme.borders.glass}`}>
                        <h4 className="font-bold text-white mb-2">Rules</h4>
                        <p>Abuse of power will result in immediate removal and a permanent ban from the Admin Queue. No refunds.</p>
                    </div>
                </div>

            </div>
        </div>
    );
}
