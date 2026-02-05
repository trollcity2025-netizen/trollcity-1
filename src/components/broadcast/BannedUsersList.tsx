import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, UserX, Unlock, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import UserNameWithAge from '../UserNameWithAge';

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

interface BannedUsersListProps {
    streamId: string;
    onClose: () => void;
}

export default function BannedUsersList({ streamId, onClose }: BannedUsersListProps) {
    const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchBannedUsers = useCallback(async () => {
        setLoading(true);
        try {
            // Manual join to avoid relationship errors
            const { data: bans, error } = await supabase
                .from('stream_bans')
                .select('user_id, reason, banned_at, expires_at')
                .eq('stream_id', streamId)
                .order('banned_at', { ascending: false });
            
            if (error) throw error;

            if (!bans || bans.length === 0) {
                setBannedUsers([]);
                setLoading(false);
                return;
            }

            // Fetch user profiles manually
            const userIds = bans.map(b => b.user_id);
            const { data: profiles, error: profilesError } = await supabase
                .from('user_profiles')
                .select('id, username, avatar_url, created_at')
                .in('id', userIds);

            if (profilesError) throw profilesError;

            const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

            const enrichedBans = bans.map(ban => ({
                ...ban,
                user: profileMap.get(ban.user_id) || { username: 'Unknown User', avatar_url: null, created_at: '' }
            }));

            setBannedUsers(enrichedBans as any);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load banned users");
        } finally {
            setLoading(false);
        }
    }, [streamId]);

    useEffect(() => {
        fetchBannedUsers();
    }, [fetchBannedUsers]);

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
        } catch (e) {
            console.error(e);
            toast.error("Failed to unban user");
        }
    };

    return (
        <div className="absolute bottom-full left-0 w-80 mb-4 bg-zinc-900 border border-red-900/50 rounded-xl p-4 shadow-2xl z-50 animate-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <UserX size={16} className="text-red-500" />
                    Banned/Kicked Users
                </h3>
                <button onClick={onClose} className="text-sm text-zinc-400 hover:text-white">Close</button>
            </div>

            {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin text-zinc-500" /></div>
            ) : bannedUsers.length === 0 ? (
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
                                        {ban.expires_at ? 'Kicked (24h)' : 'Banned (Perm)'}
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
            )}
             <div className="mt-3 pt-3 border-t border-white/5 flex justify-center">
                <button onClick={fetchBannedUsers} className="text-xs text-zinc-500 flex items-center gap-1 hover:text-zinc-300">
                    <RefreshCcw size={12} /> Refresh List
                </button>
            </div>
        </div>
    );
}