import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function AdminTrollers() {
  const qc = useQueryClient();
  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: () => supabase.auth.me() });

  const { data: trollers = [] } = useQuery({
    queryKey: ['trollersList'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('role', 'troller').order('created_date', { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser,
  });

  const demoteMutation = useMutation(async (userId) => {
    const { error } = await supabase.from('profiles').update({ role: 'user', is_troller: false }).eq('id', userId);
    if (error) throw error;
  }, { onSuccess: () => { qc.invalidateQueries(['trollersList']); toast.success('Demoted to user'); }, onError: (e) => toast.error(e?.message || 'Failed') });

  const banMutation = useMutation(async (userId) => {
    const { error } = await supabase.from('profiles').update({ is_banned: true }).eq('id', userId);
    if (error) throw error;
  }, { onSuccess: () => { qc.invalidateQueries(['trollersList']); toast.success('Troller banned'); }, onError: (e) => toast.error(e?.message || 'Failed') });

  const unbanMutation = useMutation(async (userId) => {
    const { error } = await supabase.from('profiles').update({ is_banned: false }).eq('id', userId);
    if (error) throw error;
  }, { onSuccess: () => { qc.invalidateQueries(['trollersList']); toast.success('Unbanned'); }, onError: (e) => toast.error(e?.message || 'Failed') });

  const { data: activeBans = [] } = useQuery({
    queryKey: ['activeStreamBans'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_stream_bans').select('*').eq('is_active', true).order('created_date', { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser,
  });

  const unkickMutation = useMutation(async (banId) => {
    const { error } = await supabase.from('user_stream_bans').update({ is_active: false, removed_date: new Date().toISOString() }).eq('id', banId);
    if (error) throw error;
  }, { onSuccess: () => { qc.invalidateQueries(['activeStreamBans']); toast.success('Unkicked'); }, onError: (e) => toast.error(e?.message || 'Failed') });

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Admin: Trollers</h1>

        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-2">Troller Accounts</h3>
          <div className="grid grid-cols-1 gap-3">
            {trollers.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-[#0a0a0f] rounded">
                <div>
                  <p className="font-semibold">{t.username || t.full_name || t.email}</p>
                  <p className="text-xs text-gray-400">Joined: {new Date(t.created_date || t.created_at || Date.now()).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {t.is_banned ? (
                    <Button size="sm" onClick={() => unbanMutation.mutate(t.id)}>Unban</Button>
                  ) : (
                    <Button size="sm" onClick={() => banMutation.mutate(t.id)}>Ban</Button>
                  )}
                  <Button size="sm" onClick={() => demoteMutation.mutate(t.id)}>Demote to User</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-2">Active Stream Bans (Unkick)</h3>
          <div className="space-y-2">
            {activeBans.map(b => (
              <div key={b.id} className="flex items-center justify-between p-2 bg-[#0a0a0f] rounded">
                <div>
                  <p className="text-sm">User: {b.user_id} — Streamer: {b.streamer_id}</p>
                  <p className="text-xs text-gray-400">Since: {new Date(b.created_date).toLocaleString()}</p>
                </div>
                <div>
                  <Button size="sm" onClick={() => unkickMutation.mutate(b.id)}>Unkick</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

      </div>
    </div>
  );
}
