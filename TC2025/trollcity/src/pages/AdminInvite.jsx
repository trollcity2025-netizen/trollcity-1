import React, { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function AdminInvite() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [lastToken, setLastToken] = useState('');

  const inviteMutation = useMutation(async () => {
    if (!email) throw new Error('Email required');
    if (!role) throw new Error('Role required');
    // Generate a one-time token and insert into pending_invites table
    const tokenBytes = crypto.getRandomValues(new Uint8Array(18));
    const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const { error } = await supabase.from('pending_invites').insert({
      email: email.toLowerCase(),
      assigned_role: role,
      invited_by: (await supabase.auth.getUser()).data?.user?.id || null,
      token,
      expires_at: expiresAt,
      created_date: new Date().toISOString(),
    });
    if (error) throw error;
    return { email, token };
  }, {
    onSuccess: (data) => {
      qc.invalidateQueries(['pendingInvites']);
      toast.success(`Invite created for ${data.email}. Copy the signup link below to email them.`);
      setLastToken(data.token);
      const link = `${window.location.origin}/Login?token=${encodeURIComponent(data.token)}`;
      try {
        navigator.clipboard.writeText(link);
        toast.success('Signup link copied to clipboard');
      } catch (e) {
        // ignore clipboard errors
      }
      setEmail('');
      setRole('user');
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to send invite');
    }
  });

  const handleInvite = () => {
    inviteMutation.mutate();
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Admin: Send Invite</h1>
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Auto-Assign Role</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="troll_officer">Troll Officer</SelectItem>
                  <SelectItem value="troller">Troller</SelectItem>
                  <SelectItem value="broadcaster">Broadcaster</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-sm text-gray-400">
              <p>When the invited user signs up via the one-time link, they will automatically be assigned the "{role}" role.</p>
            </div>

            <Button onClick={handleInvite} className="w-full bg-emerald-500">
              Generate Invite Link
            </Button>

            {lastToken && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mt-4">
                <p className="text-sm text-gray-300">📋 Signup Link (auto-copied):</p>
                <code className="text-xs text-cyan-300 break-all mt-2 block bg-black/50 p-2 rounded">{`${window.location.origin}/Login?token=${encodeURIComponent(lastToken)}`}</code>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
