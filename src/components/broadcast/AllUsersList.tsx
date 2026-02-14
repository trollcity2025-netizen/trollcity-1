import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, UserX, Unlock, RefreshCcw, Shield, UserMinus, Crown, User, Eye } from 'lucide-react';
import { toast } from 'sonner';
import UserNameWithAge from '../UserNameWithAge';
import { useAuthStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import { Virtuoso } from 'react-virtuoso';

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

interface AllUsersListProps {
    streamId: string;
    onClose: () => void;
}

export default function AllUsersList({ streamId, onClose }: AllUsersListProps) {
    const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
    const [activeViewers, setActiveViewers] = useState<ActiveViewer[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'viewers' | 'banned'>('viewers');
    const { user } = useAuthStore();

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
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), 5000));
        
        try {
            const fetchPromise = supabase
                .from('stream_bans')
                .select('user_id, reason, banned_at, expires_at')
                .eq('stream_id', streamId)
                .order('banned_at', { ascending: false });

            const { data: bans, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;
            
            if (error) throw error;

            if (!bans || bans.length === 0) {
                setBannedUsers([]);
                return;
            }

            const userIds = bans.map((b: any) => b.user_id);
            const { data: profiles, error: profileError } = await supabase
                .from('user_profiles')
                .select('id, username, avatar_url, created_at')
                .in('id', userIds);

            if (profileError) throw profileError;

            const profileMap = new Map((profiles || []).map(p => [p.id, p]));

            const bannedUsersList = bans.map((ban: any) => ({
                ...ban,
                user: profileMap.get(ban.user_id) || {
                    username: 'Unknown User',
                    avatar_url: null,
                    created_at: ''
                }
            }));

            setBannedUsers(bannedUsersList);
        } catch (err) {
            console.error('Failed to fetch banned users:', err);
            if (err.message !== 'Request timed out') {
                toast.error('Failed to load banned users');
            }
        }
    }, [streamId]);

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        await Promise.all([fetchActiveViewers(), fetchBannedUsers()]);
        setLoading(false);
    }, [fetchActiveViewers, fetchBannedUsers]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleUnban = async (userId: string) => {
        try {
            const { error } = await supabase.rpc('unban_user', {
                p_stream_id: streamId,
                p_user_id: userId
            });

            if (error) throw error;

            await supabase.from('notifications').insert({
                user_id: userId,
                type: 'moderation_action',
                title: 'Unbanned from Stream',
                message: 'You have been unbanned from the broadcast.',
                metadata: { stream_id: streamId }
            });

            toast.success('User unbanned');
            fetchBannedUsers();
        } catch {
            // Fallback to direct delete if RPC fails
            const { error: delError } = await supabase
                .from('stream_bans')
                .delete()
                .eq('stream_id', streamId)
                .eq('user_id', userId);
             
            if (delError) {
                toast.error('Failed to unban user');
            } else {
                toast.success('User unbanned');
                fetchBannedUsers();
            }
        }
    };

    const handleKickUser = async (userId: string, username: string) => {
        if (!confirm(`Kick ${username} for 24 hours? They'll need to pay 100 coins to rejoin.`)) return;

        try {
            const { data, error } = await supabase.rpc('kick_user_paid', {
                p_stream_id: streamId,
                p_target_user_id: userId,
                p_kicker_id: user?.id
            });

            if (error) throw error;
            if (data && !data.success) {
                toast.error(data.message || 'Failed to kick user');
                return;
            }

            toast.success('User kicked');
            fetchAllData();
        } catch {
            toast.error('Failed to kick user');
        }
    };

    const handleAssignBroadOfficer = async (userId: string, username: string) => {
        if (!confirm(`Promote ${username} to Broad Officer? They will have moderation powers.`)) return;

        try {
            const { error } = await supabase.rpc('assign_broadofficer', {
                p_user_id: userId
            });

            if (error) throw error;

            toast.success(`${username} promoted to Broad Officer`);
            fetchAllData();
        } catch (err) {
            toast.error('Failed to promote user');
            console.error(err);
        }
    };

    const renderViewerItem = (index: number, viewer: ActiveViewer) => (
        <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex items-center justify-between group mb-2">
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
                    <p className="text-xs text-zinc-400 truncate">
                        {viewer.role || viewer.troll_role || 'Viewer'}
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => handleAssignBroadOfficer(viewer.user_id, viewer.username)}
                    className="p-1.5 hover:bg-blue-500/20 rounded-full text-blue-400 hover:text-blue-300 transition-colors"
                    title="Assign Broad Officer"
                >
                    <Shield size={14} />
                </button>
                <button
                    onClick={() => handleKickUser(viewer.user_id, viewer.username)}
                    className="p-1.5 hover:bg-red-500/20 rounded-full text-red-400 hover:text-red-300 transition-colors"
                    title="Kick User (100 coins)"
                >
                    <UserMinus size={14} />
                </button>
            </div>
        </div>
    );

    const renderBannedItem = (index: number, ban: BannedUser) => (
        <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex items-center justify-between mb-2">
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
                    <p className="text-xs text-red-400 truncate">Banned (Perm)</p>
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
    );

    return (
        <div className="absolute bottom-full left-0 w-96 mb-4 bg-zinc-900 border border-white/10 rounded-xl p-4 shadow-2xl z-50 animate-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Eye size={16} className="text-purple-400" />
                    Room Users
                </h3>
                <button onClick={onClose} className="text-sm text-zinc-400 hover:text-white">Close</button>
            </div>

            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setActiveTab('viewers')}
                    className={cn(
                        "flex-1 py-2 rounded-lg font-medium text-sm transition-colors",
                        activeTab === 'viewers' 
                            ? "bg-purple-600 text-white" 
                            : "bg-black/40 text-zinc-400 hover:bg-black/60"
                    )}
                >
                    <div className="flex items-center justify-center gap-2">
                        <User size={14} />
                        Active ({activeViewers.length})
                    </div>
                </button>
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
            </div>

            {loading ? (
                <div className="flex justify-center py-4">
                    <Loader2 className="animate-spin text-zinc-500" />
                </div>
            ) : activeTab === 'viewers' ? (
                activeViewers.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-sm">No viewers</div>
                ) : (
                    <div className="h-80 pr-1">
                        <Virtuoso
                            style={{ height: '100%' }}
                            data={activeViewers}
                            itemContent={renderViewerItem}
                        />
                    </div>
                )
            ) : (
                bannedUsers.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-sm">No banned users</div>
                ) : (
                    <div className="h-80 pr-1">
                        <Virtuoso
                            style={{ height: '100%' }}
                            data={bannedUsers}
                            itemContent={renderBannedItem}
                        />
                    </div>
                )
            )}

            <div className="mt-3 pt-3 border-t border-white/5 flex justify-center">
                <button onClick={fetchAllData} className="text-xs text-zinc-500 flex items-center gap-1 hover:text-zinc-300">
                    <RefreshCcw size={12} /> Refresh
                </button>
            </div>
        </div>
    );
}
