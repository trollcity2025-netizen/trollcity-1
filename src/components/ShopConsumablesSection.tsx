import React, { useState } from 'react';
import { Coins } from 'lucide-react';
import { usePurchases } from '../hooks/usePurchases';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';

// Mock consumables (should match TrollMart)
const CONSUMABLES = [
  {
    id: 'broadcast_notification',
    name: 'Stream Notification',
    category: 'broadcast_notification',
    price_coins: 500,
    description: 'Send a notification to all users to watch your stream. Lasts 1 hour.',
    durationMinutes: 60,
  },
  {
    id: 'broadcast_feature',
    name: 'Top Broadcaster Feature',
    category: 'broadcast_feature',
    price_coins: 1000,
    description: 'Feature your stream in the top broadcasters on the homepage for 1 hour.',
    durationMinutes: 60,
  },
];

export default function ShopConsumablesSection() {
  const { user, profile, refreshProfile } = useAuthStore();
  const { purchases, addPurchase, loading } = usePurchases();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  const handlePurchase = async (item: any) => {
    if (!user || !profile) return;
    if ((profile.troll_coins || 0) < item.price_coins) {
      toast.error('Not enough TrollCoins');
      return;
    }
    setPurchasingId(item.id);
    try {
      const result = await addPurchase(
        'broadcast_consumable',
        item.id,
        item.name,
        item.price_coins,
        {
          autoActivate: true,
          expiresAt: new Date(Date.now() + item.durationMinutes * 60 * 1000),
          metadata: { category: item.category },
        }
      );
      if (!result.success) {
        toast.error(result.error || 'Failed to purchase');
        return;
      }
      toast.success(item.name + ' activated!');
      refreshProfile();
    } catch (err: any) {
      toast.error(err?.message || 'Purchase failed');
    } finally {
      setPurchasingId(null);
    }
  };

  // Find active consumable (if any)
  const active = purchases.find(
    (p) => p.item_type === 'broadcast_consumable' && p.is_active && (!p.expires_at || new Date(p.expires_at) > new Date())
  );

  return (
    <div className="bg-black/40 border border-yellow-500/40 rounded-2xl p-6 mt-6">
      <h2 className="text-lg font-semibold mb-2 text-yellow-300 flex items-center gap-2">
        <Coins className="w-5 h-5 text-yellow-400" />
        Stream Consumables
      </h2>
      <p className="text-xs text-gray-400 mb-4">Purchase and activate stream features for 1 hour.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CONSUMABLES.map((item) => {
          const isActive = active && active.item_id === item.id;
          return (
            <div key={item.id} className={`border border-white/10 rounded-xl p-4 bg-black/30 flex flex-col gap-2 ${isActive ? 'ring-2 ring-yellow-400' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{item.name}</p>
                  <p className="text-[11px] text-gray-400">{item.description}</p>
                </div>
                <span className="flex items-center gap-1 text-yellow-300 font-semibold">
                  <Coins className="w-4 h-4" />
                  {item.price_coins}
                </span>
              </div>
              <button
                disabled={purchasingId === item.id || isActive || loading}
                onClick={() => handlePurchase(item)}
                className="mt-2 px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-xs font-semibold disabled:opacity-60"
              >
                {isActive ? 'Active' : purchasingId === item.id ? 'Purchasing…' : 'Buy & Activate'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
