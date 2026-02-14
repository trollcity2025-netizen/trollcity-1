import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, UserX, Unlock, RefreshCcw, User, Eye, Shield, Crown } from 'lucide-react';
import { toast } from 'sonner';
import UserNameWithAge from '../UserNameWithAge';
import { useAuthStore } from '../../lib/store';
import { cn } from '../../lib/utils';

interface BannedUser {
    user_id: string;
    reason: string;
    banned_at: string;
    expires_at: string | null;
    user: {
        username: string;
        avatar_url: string | null;
        created_at: string;
    };
}

interface ActiveViewer {
    user_id: string;
    username: string;
    avatar_url: string | null;
    role?: string;
    troll_role?: string;
    created_at: string;
    joined_at: string;
}

interface BannedUsersListProps {
    streamId: string;
    onClose: () => void;
}

export default function BannedUsersList({ streamId, onClose }: BannedUsersListProps) {
    const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
    const [activeViewers, setActiveViewers] = useState<ActiveViewer[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'banned' | 'active'>('banned');
    const { user: _user } = useAuthStore();

    const fetchActiveViewers = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('stream_viewers')
                .select('user_id, joined_at')
                .eq('stream_id', streamId);

            if (error) throw error;

            if (!data || data.length === 0) {
                setActiveViewers([]);
                return;
            }

            // Fetch user profiles for all viewers
            const userIds = data.map(v => v.user_id);
            const { data: profiles, error: profileError } = await supabase
                .from('user_profiles')
                .select('id, username, avatar_url, role, troll_role, created_at')
                .in('id', userIds);

            if (profileError) throw profileError;

            const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

            const viewers = data.map(v => {
                const profile = profileMap.get(v.user_id);
                return {
                    user_id: v.user_id,
                    username: profile?.username || 'Unknown',
                    avatar_url: profile?.avatar_url || null,
                    role: profile?.role,
                    troll_role: profile?.troll_role,
                    created_at: profile?.created_at || '',
                    joined_at: v.joined_at
                };
            });

            setActiveViewers(viewers);
        } catch (err) {
            console.error('Failed to fetch active viewers:', err);
        }
    }, [streamId]);

    const fetchBannedUsers = useCallback(async () => {
        setLoading(true);
        // Add timeout to prevent infinite spinning
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), 5000));
        
        try {
            // Manual join to avoid relationship errors
            const fetchPromise = supabase
                .from('stream_bans')
                .select('user_id, reason, banned_at, expires_at')
                .eq('stream_id', streamId)
                .order('banned_at', { ascending: false });

            const { data: bans, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;
            
            if (error) throw error;

            if (!bans || bans.length === 0) {
                setBannedUsers([]);
                setLoading(false);
                return;
            }

            // Fetch user profiles manually
            const userIds = bans.map((b: any) => b.user_id);
            const { data: profiles, error: profilesError } = await supabase
                .from('user_profiles')
                .select('id, username, avatar_url, created_at')
                .in('id', userIds);

            if (profilesError) throw profilesError;

            const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

            const enrichedBans = bans.map((ban: any) => ({
                ...ban,
                user: profileMap.get(ban.user_id) || { username: 'Unknown User', avatar_url: null, created_at: '' }
            }));

            setBannedUsers(enrichedBans);
        } catch (error: any) {
            console.error(error);
            // Don't show toast for empty lists or simple errors to avoid spam, just stop loading
            if (error.message !== 'Request timed out') {
                 // Check if table exists error
                 if (error.code === '42P01') { // undefined_table
                     console.warn('stream_bans table missing');
                 } else {
                     toast.error("Failed to load banned users");
                 }
            }
        } finally {
            setLoading(false);
        }
    }, [streamId]);

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            await Promise.all([fetchBannedUsers(), fetchActiveViewers()]);
            setLoading(false);
        };
        fetchAllData();
    }, [fetchBannedUsers, fetchActiveViewers]);

    const handleUnban = async (userId: string) => {
        try {
            const { error } = await supabase.rpc('unban_user', {
                p_stream_id: streamId,
                p_user_id: userId
            });

            if (error) throw error;
            
            // Notify user
            await supabase.from('notifications').insert({
                user_id: userId,
                type: 'moderation_action',
                title: 'Unbanned from Stream',
                message: 'You have been unbanned/unkicked from the broadcast.',
                metadata: { stream_id: streamId }
            });

            toast.success("User unbanned");
            fetchBannedUsers();
        } catch (e: any) {
            console.error(e);
            
            // Fallback if RPC missing
            const msg = (e?.message || JSON.stringify(e) || '').toLowerCase();
            if (
                msg.includes('function') || 
                msg.includes('schema cache') || 
                msg.includes('could not find') ||
                e?.code === '42883' ||
                e?.code === 'PGRST202'
            ) {
                 const { error: delError } = await supabase
                    .from('stream_bans')
                    .delete()
                    .eq('stream_id', streamId)
                    .eq('user_id', userId);
                 
                 if (delError) {
                     toast.error("Failed to unban user (DB Error)");
                 } else {
                     toast.success("User unbanned");
                     fetchBannedUsers();
                     return;
                 }
            }

            toast.error("Failed to unban user");
        }
    };

    return (
        <div className="absolute bottom-full left-0 w-80 mb-4 bg-zinc-900 border border-red-900/50 rounded-xl p-4 shadow-2xl z-50 animate-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Eye size={16} className="text-purple-400" />
                    Room Users
                </h3>
                <button onClick={onClose} className="text-sm text-zinc-400 hover:text-white">Close</button>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setActiveTab('banned')}
                    className={cn(
                        "flex-1 py-2 rounded-lg font-medium text-sm transition-colors",
                        activeTab === 'banned' 
                            ? "bg-red-600 text-white" 
                            : "bg-black/40 text-zinc-400 hover:bg-black/60"
                    )}
                >
                    <div className="flex items-center justify-center gap-2">
                        <UserX size={14} />
                        Banned ({bannedUsers.length})
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('active')}
                    className={cn(
                        "flex-1 py-2 rounded-lg font-medium text-sm transition-colors",
                        activeTab === 'active' 
                            ? "bg-green-600 text-white" 
                            : "bg-black/40 text-zinc-400 hover:bg-black/60"
                    )}
                >
                    <div className="flex items-center justify-center gap-2">
                        <User size={14} />
                        Active ({activeViewers.length})
                    </div>
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin text-zinc-500" /></div>
            ) : activeTab === 'banned' ? (
                bannedUsers.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-sm">
                        No banned users
                    </div>
                ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {bannedUsers.map((ban) => (
                        <div key={ban.user_id} className="bg-black/40 p-2 rounded-lg border border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0">
                                    {ban.user.avatar_url ? (
                                        <img src={ban.user.avatar_url} alt={ban.user.username} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-500">
                                            {ban.user.username?.[0]?.toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-bold text-white truncate">
                                        <UserNameWithAge 
                                            user={{
                                                username: ban.user.username,
                                                created_at: ban.user.created_at
                                            }}
                                            showBadges={false}
                                        />
                                    </div>
                                    <p className="text-xs text-red-400 truncate">
                                        Banned (Perm)
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleUnban(ban.user_id)}
                                className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-green-400 transition-colors"
                                title="Unban / Unkick"
                            >
                                <Unlock size={16} />
                            </button>
                        </div>
                    ))}
                    </div>
                )
            ) : (
                activeViewers.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-sm">
                        No active viewers
                    </div>
                ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {activeViewers.map((viewer) => (
                            <div key={viewer.user_id} className="bg-black/40 p-2 rounded-lg border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2 overflow-hidden flex-1">
                                    <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0">
                                        {viewer.avatar_url ? (
                                            <img src={viewer.avatar_url} alt={viewer.username} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-500">
                                                {viewer.username?.[0]?.toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-bold text-white truncate flex items-center gap-1">
                                            <UserNameWithAge 
                                                user={{
                                                    username: viewer.username,
                                                    created_at: viewer.created_at
                                                }}
                                                showBadges={false}
                                            />
                                            {(viewer.role === 'admin' || viewer.troll_role === 'admin') && (
                                                <Crown size={12} className="text-red-500" />
                                            )}
                                            {(viewer.role === 'moderator' || viewer.troll_role === 'troll_officer') && (
                                                <Shield size={12} className="text-blue-400" />
                                            )}
                                        </div>
                                        <p className="text-xs text-green-400 truncate">
                                            {viewer.role || viewer.troll_role || 'Viewer'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}
             <div className="mt-3 pt-3 border-t border-white/5 flex justify-center">
                <button onClick={async () => { setLoading(true); await Promise.all([fetchBannedUsers(), fetchActiveViewers()]); setLoading(false); }} className="text-xs text-zinc-500 flex items-center gap-1 hover:text-zinc-300">
                    <RefreshCcw size={12} /> Refresh List
                </button>
            </div>
        </div>
    );
}