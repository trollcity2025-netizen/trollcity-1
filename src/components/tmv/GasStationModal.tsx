import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { deductCoins } from '@/lib/coinTransactions';
import { X, Fuel, Users, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import UserNameWithAge from '../UserNameWithAge';

export default function GasStationModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { profile, refreshProfile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'refill' | 'request'>('refill');
  const [targetUser, setTargetUser] = useState('');
  
  // New state for following list
  const [followingUsers, setFollowingUsers] = useState<any[]>([]);
  const [followingLoading, setFollowingLoading] = useState(false);
  
  // Active Car State for Registration Display
  const [activeCar, setActiveCar] = useState<any>(null);

  useEffect(() => {
    const fetchFollowing = async () => {
      if (!profile) return;
      setFollowingLoading(true);
      try {
        const { data } = await supabase
          .from('user_follows')
          // Added created_at to fix "actual days" display in user list
          .select('following:user_profiles!user_follows_following_id_fkey(id, username, avatar_url, created_at)')
          .eq('follower_id', profile.id)
          .limit(50); // Limit to recent/top 50 for performance
  
        if (data) {
          const users = data.map((d: any) => d.following).filter(Boolean);
          setFollowingUsers(users);
        }
      } catch (e) {
        console.error('Error fetching following:', e);
      } finally {
        setFollowingLoading(false);
      }
    };

    if (isOpen && tab === 'request') {
      fetchFollowing();
    }
  }, [isOpen, tab, profile]);

  // Fetch Active Car Registration
  useEffect(() => {
    if (isOpen && profile) {
      const fetchCar = async () => {
         const { data } = await supabase
           .from('user_cars')
           .select('registration_expires_at')
           .eq('user_id', profile.id)
           .eq('is_active', true)
           .maybeSingle();
         if (data) setActiveCar(data);
      };
      fetchCar();
    }
  }, [isOpen, profile]);

  if (!isOpen || !profile) return null;

  const filteredUsers = followingUsers.filter(u => 
    u.username.toLowerCase().includes(targetUser.toLowerCase())
  );
  
  const gas = profile.gas_balance ?? 100;
  
  // Cost: 300 coins per 5%
  const handleRefill = async (amount: number) => {
    setLoading(true);
    try {
      // Secure Refill: Spend coins then add gas using centralized deductCoins
      const cost = Math.ceil((amount / 5) * 300);
      
      // Deduct coins using the same function as coin store items
      const deductResult = await deductCoins({
        userId: profile.id,
        amount: cost,
        type: 'gas_refill',
        metadata: { amount_percent: amount }
      });

      if (!deductResult.success) {
        throw new Error(deductResult.error || 'Failed to deduct coins');
      }

      // Add Gas (consume_gas with negative amount)
      // consume_gas logic: gas = gas - p_amount. So passing -amount adds gas.
      const { data: gasData, error: gasError } = await supabase.rpc('consume_gas', { p_amount: -amount });
      
      if (gasError) throw gasError;

      // Update local state
      if (gasData && gasData.success) {
          useAuthStore.getState().setProfile({ ...profile, gas_balance: gasData.new_balance });
          toast.success(`Refilled ${amount}% gas!`);
      } else {
          await refreshProfile();
          toast.success(`Refilled ${amount}% gas!`);
      }
    } catch (e: any) {
      console.error('Refill error:', e);
      toast.error(e.message || 'Failed to refill');
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async () => {
    if (!targetUser) return toast.error('Enter a username');
    setLoading(true);
    try {
       // Search user first to get ID
       const { data: users } = await supabase.from('user_profiles').select('id').eq('username', targetUser).maybeSingle();
       if (!users) throw new Error('User not found');
       
       const { error } = await supabase.rpc('request_gas', { 
         p_target_user_id: users.id,
         p_amount: 20 // Request 20% by default
       });
       if (error) throw error;
       toast.success('Gas request sent!');
       onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  // Pre-calculate options
  const options = [5, 25, 50, 100];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Fuel className="text-yellow-500" /> Gas Station
          </h2>
          <button onClick={onClose}><X className="text-gray-400 hover:text-white" /></button>
        </div>
        
        <div className="p-6">
           {/* Tabs */}
           <div className="flex gap-2 mb-6 bg-zinc-950 p-1 rounded-lg">
             <button 
               onClick={() => setTab('refill')}
               className={`flex-1 py-2 rounded-md text-sm font-medium transition ${tab === 'refill' ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:text-white'}`}
             >
               Refill
             </button>
             <button 
               onClick={() => setTab('request')}
               className={`flex-1 py-2 rounded-md text-sm font-medium transition ${tab === 'request' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
             >
               Request Gas
             </button>
           </div>

           {tab === 'refill' && (
             <div className="space-y-4">
                 
                 {/* Registration Display */}
                 {activeCar && activeCar.registration_expires_at && (
                   <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
                     <div className="flex items-center gap-2 text-gray-400">
                       <Calendar className="w-4 h-4" />
                       <span className="text-sm">Vehicle Registration</span>
                     </div>
                     <span className={`font-mono font-bold ${
                         new Date(activeCar.registration_expires_at) < new Date() ? 'text-red-500' : 'text-green-400'
                     }`}>
                       {Math.max(0, Math.ceil((new Date(activeCar.registration_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}d Left
                     </span>
                   </div>
                 )}

                 <div className="text-center mb-4">
                    <p className="text-gray-400">Current Tank</p>
                    <div className="text-4xl font-bold text-white flex justify-center items-end gap-1">
                      {Math.floor(gas)}<span className="text-lg text-yellow-500 mb-1">%</span>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3">
                    {options.map(pct => {
                      if (gas + pct > 100) {
                          // Optional: Handle overflow logic visually if needed
                      }
                      
                      const cost = Math.ceil((pct / 5) * 300);
                      const wouldOverflow = gas >= 100;
                      
                      return (
                        <button
                          key={pct}
                          disabled={wouldOverflow || loading}
                          onClick={() => handleRefill(pct)}
                          className="flex flex-col items-center p-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl border border-zinc-700 transition"
                        >
                          <span className="text-lg font-bold text-white">+{pct}%</span>
                          <span className="text-xs text-yellow-400">{cost} Coins</span>
                        </button>
                      );
                    })}
                    <button
                      disabled={gas >= 100 || loading}
                      onClick={() => handleRefill(100 - gas)}
                      className="col-span-2 flex flex-col items-center p-3 bg-green-900/50 hover:bg-green-900/70 border border-green-700 rounded-xl transition"
                    >
                       <span className="text-lg font-bold text-white">Fill Tank</span>
                       <span className="text-xs text-green-300">
                         {Math.ceil(((100 - gas) / 5) * 300)} Coins
                       </span>
                    </button>
                 </div>
                 
                 <p className="text-xs text-center text-gray-500 mt-4">
                   Staff members refill for free.
                 </p>
              </div>
           )}

           {tab === 'request' && (
             <div className="space-y-4">
               <p className="text-sm text-gray-400">Ask a friend to send you gas.</p>
               <div className="relative">
                 <Users className="absolute left-3 top-3 text-gray-500 w-5 h-5" />
                 <input 
                   type="text" 
                   placeholder="Enter username..."
                   value={targetUser}
                   onChange={e => setTargetUser(e.target.value)}
                   className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                 />
               </div>

               {/* Following List */}
               <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                 {followingLoading ? (
                   <p className="text-center text-xs text-gray-500 py-2">Loading friends...</p>
                 ) : filteredUsers.length > 0 ? (
                   filteredUsers.map(u => (
                     <button
                       key={u.id}
                       onClick={() => setTargetUser(u.username)}
                       className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800 transition text-left group"
                     >
                       <img 
                         src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} 
                         alt={u.username}
                         className="w-8 h-8 rounded-full bg-zinc-800 object-cover"
                       />
                       <UserNameWithAge 
                         user={u} 
                         onClick={() => setTargetUser(u.username)}
                         className="text-sm text-gray-300 group-hover:text-white transition-colors"
                       />
                     </button>
                   ))
                 ) : (
                   targetUser && <p className="text-center text-xs text-gray-500 py-2">No friends found matching &quot;{targetUser}&quot;</p>
                 )}
               </div>

               <button 
                 onClick={handleRequest}
                 disabled={loading}
                 className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition disabled:opacity-50"
               >
                 {loading ? 'Sending...' : 'Send Request'}
               </button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
