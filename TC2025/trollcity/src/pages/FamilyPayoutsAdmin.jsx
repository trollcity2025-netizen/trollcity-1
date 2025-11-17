import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { generateWeeklyFamilyPayout, getRecentFamilyPayouts } from '@/lib/families';

export default function FamilyPayoutsAdmin() {
  const queryClient = useQueryClient();

  const { data: recent = [] } = useQuery({
    queryKey: ['familyPayoutsRecent'],
    queryFn: () => getRecentFamilyPayouts(20),
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const result = await generateWeeklyFamilyPayout(new Date());
      return result;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries(['familyPayoutsRecent']);
      queryClient.invalidateQueries(['adminAllPayouts']);
      if (res) {
        toast.success(`Weekly family payout generated: ${res.family_name} — $${res.perMember} per member`);
      } else {
        toast.info('No family qualified for this week');
      }
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to generate payouts');
    }
  });

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Family Weekly Payouts</h1>
        <Card className="p-4">
          <p className="text-sm text-gray-400 mb-4">Generate the weekly top Troll Family payout ($50 split evenly among members). This should be scheduled weekly (Friday) via a cron job; you can trigger it manually here for testing.</p>
          <Button onClick={() => runMutation.mutate()} className="bg-purple-600">Run Weekly Payout Now</Button>
        </Card>

        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-2">Recent Family Payouts</h3>
          <div className="space-y-3">
            {recent.length === 0 && <p className="text-sm text-gray-400">No payouts yet</p>}
            {recent.map(p => (
              <div key={`${p.family_id}-${p.created_date}`} className="flex items-center justify-between p-3 bg-[#0a0a0f] rounded">
                <div>
                  <p className="font-semibold">{p.family_name}</p>
                  <p className="text-xs text-gray-400">Week: {new Date(p.week_start).toLocaleDateString()} - {new Date(p.week_end).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-yellow-400 font-semibold">${p.payout_per_member}</p>
                  <p className="text-xs text-gray-400">Total: ${p.payout_amount_total}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
