import React, { useState, useEffect } from 'react';
import { ShoppingBag, Shield } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { deductCoins } from '../../lib/coinTransactions';

export default function GeneralStorePage() {
  const { user, profile, refreshProfile } = useAuthStore();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [buyingPolicy, setBuyingPolicy] = useState(false);
  const [hasHomeInsurance, setHasHomeInsurance] = useState(false);

  const handleBuyConsumable = async (item: { id: string; name: string; price: number }) => {
    if (!user) return toast.error('You must be logged in');
    if ((profile?.troll_coins || 0) < item.price) return toast.error('Not enough TrollCoins');
    setPurchasingId(item.id);
    try {
      const spend = await deductCoins({
        userId: user.id,
        amount: item.price,
        type: 'purchase',
        coinType: 'troll_coins',
        description: `General Store purchase: ${item.name}`,
        metadata: { consumable_id: item.id }
      });
      if (!spend.success) {
        toast.error(spend.error || 'Failed to purchase item');
        return;
      }
      // Add to user_inventory (or similar table)
      const { error } = await supabase
        .from('user_inventory')
        .upsert({ user_id: user.id, item_id: item.id, quantity: 1 }, { onConflict: 'user_id,item_id' });
      if (error) {
        toast.error(error.message || 'Failed to add to inventory');
        return;
      }
      toast.success(`${item.name} added to your inventory`);
      if (refreshProfile) refreshProfile();
    } catch (err: any) {
      toast.error(err?.message || 'Purchase failed');
    } finally {
      setPurchasingId(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadHomeInsurance = async () => {
      if (!user?.id) {
        if (isMounted) setHasHomeInsurance(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('property_insurance_policies')
          .select('id, expires_at, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .limit(1);

        if (error) {
          console.error('Failed to load property insurance status:', error);
        }

        const active = Array.isArray(data) && data.length > 0;

        if (isMounted) {
          setHasHomeInsurance(active);
          if (active) {
            localStorage.setItem(`trollcity_home_insurance_${user.id}`, JSON.stringify({ active: true }));
          } else {
            localStorage.removeItem(`trollcity_home_insurance_${user?.id}`);
          }
        }
      } catch (err) {
        console.error('Property insurance status lookup failed:', err);
        if (isMounted) {
          try {
            const raw = user?.id ? localStorage.getItem(`trollcity_home_insurance_${user.id}`) : null;
            const parsed = raw ? JSON.parse(raw) : null;
            setHasHomeInsurance(Boolean(parsed && parsed.active));
          } catch {
            setHasHomeInsurance(false);
          }
        }
      }
    };

    loadHomeInsurance();

    if (!user?.id) return () => { isMounted = false; };

    const channel = supabase
      .channel(`property_insurance_policies:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'property_insurance_policies',
          filter: `user_id=eq.${user.id}`
        },
        () => loadHomeInsurance()
      )
      .subscribe();

    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, [user?.id]);

  const handleBuyPolicy = async () => {
    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    setBuyingPolicy(true);
    try {
      const { data: properties, error: propsError } = await supabase
        .from('properties')
        .select('id')
        .eq('owner_user_id', user.id)
        .eq('is_listed', false)
        .order('created_at', { ascending: true });

      if (propsError) {
        console.error('Failed to load properties for insurance:', propsError);
        toast.error(propsError.message || 'Failed to load your properties');
        return;
      }

      const propertyRows = Array.isArray(properties) ? properties : [];

      if (!propertyRows.length) {
        toast.error('You must own a property before buying insurance');
        return;
      }

      const targetProperty = propertyRows[0] as any;

      const { error: rpcError } = await supabase.rpc('buy_property_insurance', {
        house_id: targetProperty.id,
        plan_id: null
      });

      if (rpcError) {
        console.error('buy_property_insurance RPC failed:', rpcError);
        toast.error(rpcError.message || 'Failed to purchase policy');
        return;
      }

      // Immediately update UI to show insurance is active
      setHasHomeInsurance(true);
      toast.success('Home insurance activated for 7 days');
      localStorage.setItem(`trollcity_home_insurance_${user.id}`, JSON.stringify({ active: true }));

      // Reload insurance status from DB to ensure accuracy
      try {
        const { data } = await supabase
          .from('property_insurance_policies')
          .select('id, expires_at, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .limit(1);
        if (Array.isArray(data) && data.length > 0) {
          setHasHomeInsurance(true);
        }
      } catch (verifyErr) {
        console.warn('Failed to verify insurance purchase:', verifyErr);
      }
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
                 disabled={buyingPolicy || hasHomeInsurance}
                 className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
               >
                 {buyingPolicy ? 'Processing...' : hasHomeInsurance ? 'Policy Active' : 'Buy Policy'}
               </button>
             </div>
           </div>

           <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
             <h3 className="font-bold text-lg mb-4">Stream Consumables</h3>
             <div className="grid grid-cols-1 gap-4">
               <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden flex flex-col">
                 <div className="p-4 flex-1">
                   <h4 className="font-semibold">Stream Notification</h4>
                   <p className="text-xs text-gray-400 mb-2">Send a notification to all users to watch your stream. Lasts 1 hour.</p>
                   <span className="text-xs uppercase tracking-widest text-emerald-300">broadcast_notification</span>
                 </div>
                 <div className="flex items-center justify-between p-4 border-t border-white/5">
                   <span className="flex items-center gap-1 text-yellow-300 font-semibold">500 Coins</span>
                   <button
                     className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold disabled:opacity-60"
                     disabled={purchasingId === 'broadcast_notification'}
                     onClick={() => handleBuyConsumable({ id: 'broadcast_notification', name: 'Stream Notification', price: 500 })}
                   >
                     {purchasingId === 'broadcast_notification' ? 'Purchasing…' : 'Buy'}
                   </button>
                 </div>
               </div>
               <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden flex flex-col">
                 <div className="p-4 flex-1">
                   <h4 className="font-semibold">Top Broadcaster Feature</h4>
                   <p className="text-xs text-gray-400 mb-2">Feature your stream in the top broadcasters on the homepage for 1 hour.</p>
                   <span className="text-xs uppercase tracking-widest text-emerald-300">broadcast_feature</span>
                 </div>
                 <div className="flex items-center justify-between p-4 border-t border-white/5">
                   <span className="flex items-center gap-1 text-yellow-300 font-semibold">1000 Coins</span>
                   <button
                     className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold disabled:opacity-60"
                     disabled={purchasingId === 'broadcast_feature'}
                     onClick={() => handleBuyConsumable({ id: 'broadcast_feature', name: 'Top Broadcaster Feature', price: 1000 })}
                   >
                     {purchasingId === 'broadcast_feature' ? 'Purchasing…' : 'Buy'}
                   </button>
                 </div>
               </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
