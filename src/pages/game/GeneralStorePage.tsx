import React, { useState } from 'react';
import { ShoppingBag, Shield, Package } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { deductCoins } from '../../lib/coinTransactions';
import { toast } from 'sonner';

export default function GeneralStorePage() {
  const { user, profile } = useAuthStore();
  const [buyingPolicy, setBuyingPolicy] = useState(false);

  const handleBuyPolicy = async () => {
    if (!user || !profile) {
      toast.error('You must be logged in');
      return;
    }

    const price = 2000;
    if ((profile.troll_coins || 0) < price) {
      toast.error('Not enough troll coins');
      return;
    }

    setBuyingPolicy(true);
    try {
      const result = await deductCoins({
        userId: user.id,
        amount: price,
        type: 'insurance_purchase',
        description: 'Home insurance purchase (7 days)',
        metadata: { source: 'general_store', protection: 'home_7d' }
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to purchase policy');
        return;
      }

      toast.success('Home insurance activated for 7 days');
      localStorage.setItem(`trollcity_home_insurance_${user.id}`, JSON.stringify({ active: true }));
    } finally {
      setBuyingPolicy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 pt-24 pb-20">
      <div className="max-w-4xl mx-auto">
        {/* Troll Mart Banner */}
        <div className="relative w-full h-64 rounded-2xl overflow-hidden mb-8 border border-zinc-800 shadow-2xl shadow-purple-900/20">
          <img 
            src="/assets/trollmart.png" 
            alt="Troll Mart Storefront" 
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          <div className="absolute bottom-6 left-6 flex items-center gap-4">
            <div className="p-4 bg-purple-600/20 rounded-2xl border border-purple-500/30 backdrop-blur-sm">
              <ShoppingBag size={32} className="text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white drop-shadow-lg">
                Troll Mart
              </h1>
              <p className="text-gray-200 drop-shadow-md">Essentials for your daily trolling needs.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-2 bg-yellow-500 text-black text-xs font-bold">HOT</div>
             <div className="flex items-center gap-4 mb-4">
               <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400">
                 <Shield size={24} />
               </div>
               <div>
                 <h3 className="font-bold text-lg">Property Insurance</h3>
                 <p className="text-xs text-gray-500">7 Day Protection</p>
               </div>
             </div>
             <p className="text-sm text-gray-400 mb-6">
               Blocks all raids on your home for 7 days. Sleep soundly knowing your coins are safe.
             </p>
             <div className="flex items-center justify-between mt-auto">
               <span className="text-xl font-bold text-blue-300">2,000 Coins</span>
               <button
                 onClick={handleBuyPolicy}
                 disabled={buyingPolicy}
                 className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
               >
                 {buyingPolicy ? 'Processing...' : 'Buy Policy'}
               </button>
             </div>
           </div>

           <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 opacity-50 cursor-not-allowed">
             <div className="flex items-center gap-4 mb-4">
               <div className="p-3 bg-gray-700/50 rounded-lg text-gray-500">
                 <Package size={24} />
               </div>
               <div>
                 <h3 className="font-bold text-lg">Consumables</h3>
                 <p className="text-xs text-gray-500">Coming Soon</p>
               </div>
             </div>
             <p className="text-sm text-gray-500 mb-6">
               Energy drinks, snacks, and other items to boost your performance.
             </p>
             <div className="flex items-center justify-between mt-auto">
               <span className="text-xl font-bold text-gray-600">??? Coins</span>
               <button className="px-4 py-2 bg-gray-700 rounded-lg text-sm font-bold text-gray-400" disabled>
                 Out of Stock
               </button>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
