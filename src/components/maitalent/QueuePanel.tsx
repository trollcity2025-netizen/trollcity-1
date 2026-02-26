
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
import { toast } from 'sonner';

interface Auditioner {
  id: string;
  user_id: string;
  user_profiles: {
    username: string;
    avatar_url: string;
  } | null;
}

import { X } from 'lucide-react';

const QueuePanel = ({ showId, performers, setIsQueueOpen }: { showId: string, performers: any[], setIsQueueOpen: (isOpen: boolean) => void }) => {
  const [auditioners, setAuditioners] = useState<Auditioner[]>([]);
  const { profile } = useAuthStore();

  useEffect(() => {
    const fetchQueue = async () => {
      const { data, error } = await supabase
        .from('mai_talent_queue')
        .select('id, user_id, user_profiles ( username, avatar_url )')
        .eq('session_id', showId)
        .eq('status', 'waiting');

      if (error) console.error('Error fetching queue:', error);
      else setAuditioners(data as any);
    };

    fetchQueue();

    const subscription = supabase
      .channel(`mai_talent_queue:${showId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mai_talent_queue', filter: `show_id=eq.${showId}` }, fetchQueue)
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, [showId]);

  const promoteToStage = async (userId: string) => {
    const { error } = await supabase.from('mai_talent_queue').update({ status: 'on_stage' }).eq('show_id', showId).eq('user_id', userId);
    if (error) toast.error('Failed to promote user.');
    else toast.success('User promoted to stage!');
  };

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-slate-900/80 backdrop-blur-md border-l border-white/10 p-4 flex flex-col z-40">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white">Audition Queue</h3>
        <Button variant="ghost" size="icon" onClick={() => setIsQueueOpen(false)}>
          <X className="h-6 w-6" />
        </Button>
      </div>
      <div className="space-y-2 flex-1 overflow-y-auto">
        {auditioners.map((auditioner) => (
          <div key={auditioner.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
            <div className="flex items-center gap-2">
              <img src={auditioner.user_profiles?.avatar_url || 'https://ui-avatars.com/api/?background=random'} className="w-8 h-8 rounded-full" />
              <span>{auditioner.user_profiles?.username || 'Unknown User'}</span>
            </div>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => promoteToStage(auditioner.user_id)}>Promote</Button>
          </div>
        ))}
        {auditioners.length === 0 && <p className="text-slate-400 text-center py-4">The queue is empty.</p>}
      </div>
    </div>
  );
};

export default QueuePanel;
