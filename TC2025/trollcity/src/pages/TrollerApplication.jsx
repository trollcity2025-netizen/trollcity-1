import React, { useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function TrollerApplication() {
  const { data: me } = useQuery({ queryKey: ['currentUser'], queryFn: () => supabase.auth.me(), staleTime: 1000 });
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);

  const applyMutation = useMutation(async () => {
    if (!me) throw new Error('Please sign in to apply');
    const userId = me.id || me.user?.id || null;
    if (!userId) throw new Error('No user');
    // Update profiles role to 'troller' and mark troller_badge true
    const { error } = await supabase.from('profiles').update({ role: 'troller', is_troller: true }).eq('id', userId);
    if (error) throw error;
  }, {
    onSuccess: () => {
      toast.success('You are now a Troller — enjoy the Troller badge!');
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to apply');
    }
  });

  const handleApply = () => {
    if (!agree) { toast.error('You must promise to follow the Troller rules'); return; }
    applyMutation.mutate();
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Troller Application</h1>
        <Card className="p-6 mb-6">
          <p className="mb-4">Thank you for wanting to be a Troller. Trollers are allowed to troll playfully but must promise NOT to discuss or harass about race, sexuality or gender. By applying you accept these rules. Trollers receive a special badge and are not subject to Troll Officer bans. Admins can demote or ban Trollers.</p>

          <div className="mb-4">
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>I promise to avoid race, sexuality, and gender topics and to follow community guidelines.</span>
            </label>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleApply} className="bg-emerald-500">Apply to be a Troller</Button>
            <span className="text-sm text-gray-400 self-center">You will receive a Troller badge immediately after applying.</span>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2">Troller Notes</h3>
          <ul className="list-disc pl-5 text-sm text-gray-300">
            <li>Trollers can be kicked if users report them; they cannot be banned by Troll Officers.</li>
            <li>Admins retain full control including demote/ban.</li>
            <li>Troll badge is visible on profiles and in chat.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
