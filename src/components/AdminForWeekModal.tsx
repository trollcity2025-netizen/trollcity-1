import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { Crown, Clock, Users, X } from 'lucide-react';

export default function AdminForWeekModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuthStore();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchQueue = async () => {
    const { data, error } = await supabase
      .from('admin_for_week_queue')
      .select('*, user:user_profiles(username, avatar_url)')
      .in('status', ['active', 'queued'])
      .order('created_at', { ascending: true });
    
    if (data) setQueue(data);
  };

  useEffect(() => {
    if (isOpen) fetchQueue();
  }, [isOpen]);

  const handlePurchase = async () => {
    if (!confirm('Purchase Admin for a Week for 5,000 Coins?')) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('purchase_admin_for_week');
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);
      
      toast.success('Joined the Admin Queue!');
      fetchQueue();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const activeAdmin = queue.find(q => q.status === 'active');
  const waitingQueue = queue.filter(q => q.status === 'queued');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-yellow-500/30 rounded-2xl w-full max-w-md overflow-hidden relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        
        <div className="bg-gradient-to-r from-yellow-900/50 to-zinc-900 p-6 border-b border-yellow-500/20">
            <h2 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
                <Crown className="w-6 h-6" /> Admin For A Week
            </h2>
            <p className="text-xs text-yellow-200/70 mt-1">Rule the city. Enforce the law. Be the boss.</p>
        </div>

        <div className="p-6 space-y-6">
            {/* Active Admin */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-2xl border border-yellow-500/50 overflow-hidden">
                    {activeAdmin?.user?.avatar_url ? <img src={activeAdmin.user.avatar_url} className="w-full h-full object-cover" /> : '👑'}
                </div>
                <div>
                    <div className="text-xs uppercase tracking-wider text-yellow-500 font-bold mb-1">Current Ruler</div>
                    <div className="text-white font-bold text-lg">{activeAdmin?.user?.username || 'None'}</div>
                    {activeAdmin && <div className="text-xs text-zinc-400">Ends: {new Date(activeAdmin.ended_at).toLocaleDateString()}</div>}
                </div>
            </div>

            {/* Queue List */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-zinc-300 flex items-center gap-2"><Users className="w-4 h-4" /> Queue Line</span>
                    <span className="text-xs text-zinc-500">{waitingQueue.length} waiting</span>
                </div>
                <div className="bg-zinc-950/50 rounded-lg border border-zinc-800 p-2 max-h-40 overflow-y-auto space-y-2">
                    {waitingQueue.length === 0 ? (
                        <div className="text-center text-zinc-600 py-4 text-sm">The line is empty. Be next!</div>
                    ) : (
                        waitingQueue.map((item, idx) => (
                            <div key={item.id} className="flex items-center justify-between bg-zinc-900 p-2 rounded border border-zinc-800">
                                <span className="text-zinc-400 font-mono text-xs">#{idx + 1}</span>
                                <span className="text-zinc-200 text-sm font-medium">{item.user?.username}</span>
                                <span className="text-zinc-600 text-xs"><Clock className="w-3 h-3" /></span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <button 
                onClick={handlePurchase}
                disabled={loading || queue.some(q => q.user_id === user?.id)}
                className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-yellow-500/20 flex items-center justify-center gap-2"
            >
                {loading ? 'Processing...' : (
                    <>
                        <span>Join Queue</span>
                        <span className="bg-black/20 px-2 py-0.5 rounded text-xs">200k 🪙</span>
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
}
