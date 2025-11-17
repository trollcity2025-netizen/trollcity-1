import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getCurrentUserProfile } from '@/api/supabaseHelpers';
import { toast } from 'sonner';

export default function LiveStreamsAdmin() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUserProfile });
  const isOfficer = currentUser?.role === 'admin' || currentUser?.is_troll_officer || currentUser?.is_admin;

  const { data: streams = [], isLoading } = useQuery({
    queryKey: ['liveStreams'],
    queryFn: async () => {
      const { data, error } = await supabase.from('streams').select('*').eq('is_live', true).order('created_date', { ascending: false }).limit(200);
      if (error) {
        console.warn('Failed to fetch live streams:', error.message);
        return [];
      }
      return data || [];
    },
    enabled: !!isOfficer,
    refetchInterval: 5000,
  });

  const [search, setSearch] = useState('');

  const endStreamMutation = useMutation({
    mutationFn: async (streamId) => {
      const { error } = await supabase.from('streams').update({ is_live: false, status: 'ended', ended_date: new Date().toISOString() }).eq('id', streamId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries(['liveStreams']); toast.success('Stream ended'); },
    onError: (e) => toast.error(e?.message || 'Failed to end stream'),
  });

  const kickStreamMutation = useMutation({
    mutationFn: async ({ streamId, userId }) => {
      // mark stream as ended and insert moderation action
      const { error: uErr } = await supabase.from('streams').update({ is_live: false, status: 'kicked', ended_date: new Date().toISOString() }).eq('id', streamId);
      if (uErr) throw uErr;
      const { error: aErr } = await supabase.from('moderation_actions').insert([{ user_id: userId, action: 'kick', target_type: 'stream', target_id: streamId, moderator_id: currentUser?.id || null, created_date: new Date().toISOString() }]);
      if (aErr) throw aErr;
    },
    onSuccess: () => { queryClient.invalidateQueries(['liveStreams']); toast.success('Streamer kicked'); },
    onError: (e) => toast.error(e?.message || 'Failed to kick streamer'),
  });

  const banUserMutation = useMutation({
    mutationFn: async ({ userId, streamId }) => {
      const { error } = await supabase.from('profiles').update({ is_banned: true, ban_reason: 'Banned by moderator via live admin', ban_expires: null, banned_by: currentUser?.id || null }).eq('id', userId);
      if (error) throw error;
      await supabase.from('moderation_actions').insert([{ user_id: userId, action: 'ban', target_type: 'user', target_id: userId, moderator_id: currentUser?.id || null, created_date: new Date().toISOString(), notes: `From stream ${streamId}` }]);
    },
    onSuccess: () => { queryClient.invalidateQueries(['adminAllUsers', 'liveStreams']); toast.success('User banned'); },
    onError: (e) => toast.error(e?.message || 'Failed to ban user'),
  });

  const muteUserMutation = useMutation({
    mutationFn: async ({ userId }) => {
      const { error } = await supabase.from('profiles').update({ is_muted: true }).eq('id', userId);
      if (error) throw error;
      await supabase.from('moderation_actions').insert([{ user_id: userId, action: 'mute', target_type: 'user', target_id: userId, moderator_id: currentUser?.id || null, created_date: new Date().toISOString() }]);
    },
    onSuccess: () => { queryClient.invalidateQueries(['adminAllUsers']); toast.success('User muted'); },
    onError: (e) => toast.error(e?.message || 'Failed to mute user'),
  });

  if (!isOfficer) return (
    <main className="min-h-screen p-6">
      <Card className="p-6 bg-[#0b0b10]">You do not have access to the Officer Command Center.</Card>
    </main>
  );

  const filtered = (streams || []).filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.title || '').toLowerCase().includes(q) || (s.broadcaster_name || '').toLowerCase().includes(q) || (String(s.broadcaster_id || '')).toLowerCase().includes(q);
  });

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#09090d] to-[#07060a] py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">Officer Command Center — Live Streams</h1>

        <div className="flex items-center gap-3 mb-4">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search streams or broadcaster..." className="w-96 bg-[#0a0a0f] text-white" />
          <Button onClick={() => queryClient.invalidateQueries(['liveStreams'])}>Refresh</Button>
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card className="p-6 bg-[#0b0b10]">No live streams found.</Card>
          ) : (
            filtered.map(s => (
              <Card key={s.id} className="p-4 bg-[#0b0b10] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="text-white font-bold">{s.title || `Stream ${s.id}`}</div>
                    <div className="text-sm text-gray-400">by {s.broadcaster_name || s.broadcaster_id}</div>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Viewers: {s.viewer_count || 0} • Started: {s.created_date ? new Date(s.created_date).toLocaleString() : 'unknown'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => endStreamMutation.mutate(s.id)} disabled={endStreamMutation.isLoading}>End</Button>
                  <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700" onClick={() => kickStreamMutation.mutate({ streamId: s.id, userId: s.broadcaster_id })} disabled={kickStreamMutation.isLoading}>Kick</Button>
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => muteUserMutation.mutate({ userId: s.broadcaster_id })} disabled={muteUserMutation.isLoading}>Mute</Button>
                  <Button size="sm" className="bg-black text-white border border-red-500" onClick={() => {
                    if (!confirm('Ban this user? This will disable their account.')) return;
                    banUserMutation.mutate({ userId: s.broadcaster_id, streamId: s.id });
                  }} disabled={banUserMutation.isLoading}>Ban</Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
