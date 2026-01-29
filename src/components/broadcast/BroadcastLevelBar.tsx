import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { X, Zap, Pizza, Coffee, Crown } from 'lucide-react';
import { useAuthStore } from '../../lib/store';

const SPONSOR_ITEMS = [
  { id: 'pizza', name: 'Pizza', cost: 50, icon: Pizza, color: 'text-orange-400' },
  { id: 'drink', name: 'Drink', cost: 20, icon: Coffee, color: 'text-blue-400' },
  { id: 'vip_badge', name: 'VIP Badge', cost: 1000, icon: Crown, color: 'text-yellow-400' },
];

export default function BroadcastLevelBar({ 
  streamId, 
  currentLevel, 
  lastLevelUpdateAt,
  onLevelUpdate 
}: { 
  streamId: string; 
  currentLevel: number;
  lastLevelUpdateAt?: string | null;
  onLevelUpdate?: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [displayLevel, setDisplayLevel] = useState(currentLevel);

  // Calculate decay on client side for real-time feedback
  React.useEffect(() => {
    const calculateDecay = () => {
      if (!lastLevelUpdateAt) {
        setDisplayLevel(currentLevel);
        return;
      }

      const lastUpdate = new Date(lastLevelUpdateAt).getTime();
      const now = Date.now();
      const diffMs = now - lastUpdate;
      const minutesElapsed = diffMs / 60000;
      
      // Decay logic: -1% every 5 minutes
      const decayAmount = Math.floor(minutesElapsed / 5);
      const newLevel = Math.max(0, currentLevel - decayAmount);
      
      setDisplayLevel(newLevel);
    };

    calculateDecay();
    const interval = setInterval(calculateDecay, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [currentLevel, lastLevelUpdateAt]);

  return (
    <>
      <div className="w-full bg-black/40 backdrop-blur-sm border border-white/10 p-3 rounded-xl mb-4 flex items-center gap-3 shadow-lg relative overflow-hidden group">
         {/* Background Glow */}
         <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
         
         <div className="flex-1 relative z-10">
            <div className="flex justify-between text-xs font-bold text-purple-300 mb-1.5 uppercase tracking-wider">
               <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Broadcast Level</span>
               <span>{displayLevel}%</span>
            </div>
            <div className="w-full bg-gray-900/80 rounded-full h-3 border border-white/5 overflow-hidden relative">
              <div 
                className="bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(168,85,247,0.5)] animate-pulse" 
                style={{ width: `${displayLevel}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
              </div>
            </div>
         </div>
         
         <button 
           onClick={() => setShowModal(true)}
           className="relative z-10 bg-gradient-to-br from-yellow-600 to-yellow-700 text-white border border-yellow-400/30 px-4 py-1.5 rounded-lg text-xs font-bold hover:from-yellow-500 hover:to-yellow-600 transition-all shadow-lg hover:shadow-yellow-500/20 active:scale-95 flex items-center gap-2"
         >
           <Crown className="w-3 h-3" />
           SPONSOR
         </button>
      </div>

      {showModal && (
        <SponsorModal 
          streamId={streamId} 
          onClose={() => setShowModal(false)} 
          onSuccess={onLevelUpdate}
        />
      )}
    </>
  );
}

function SponsorModal({ 
  streamId, 
  onClose,
  onSuccess 
}: { 
  streamId: string; 
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const { profile } = useAuthStore();

  const handleSponsor = async (item: typeof SPONSOR_ITEMS[0]) => {
    if (!profile) return toast.error('You must be logged in');
    
    setLoading(item.id);
    try {
      const { data, error } = await supabase.rpc('sponsor_broadcast_item', {
        p_stream_id: streamId,
        p_item_id: item.id,
        p_recipient_id: null // Assuming self/stream for now unless UI allows selecting user
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Failed to sponsor');

      toast.success(`Sponsored ${item.name}!`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Transaction failed');
    } finally {
      setLoading(null);
    }
  };

  const handleBoost = async () => {
    setLoading('boost');
    try {
      const { data, error } = await supabase.rpc('boost_broadcast_level', {
        p_stream_id: streamId
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Failed to boost');

      toast.success('Broadcast Level Boosted!');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Boost failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1a1625] border border-purple-500/20 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-purple-900/10">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            Sponsor Broadcast
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {SPONSOR_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSponsor(item)}
                disabled={!!loading}
                className="group relative flex flex-col items-center gap-2 p-3 rounded-xl bg-black/20 border border-white/5 hover:bg-white/5 hover:border-purple-500/50 transition-all active:scale-95 disabled:opacity-50"
              >
                <div className={`p-3 rounded-full bg-black/40 ${item.color} group-hover:scale-110 transition-transform`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-white">{item.name}</div>
                  <div className="text-xs text-yellow-500 font-mono">{item.cost} TC</div>
                </div>
                {loading === item.id && (
                  <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-300">Quick Boost</span>
              <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">200 TC</span>
            </div>
            <button
              onClick={handleBoost}
              disabled={!!loading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-purple-900/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading === 'boost' ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  Boost Level (+1%)
                </>
              )}
            </button>
            <p className="text-center text-xs text-gray-500 mt-2">
              Boosting increases visibility and prevents decay.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
