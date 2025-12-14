import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { Coins, DollarSign, ShoppingCart, CreditCard, CheckCircle, Loader2, Clock, Sparkles, Shield } from 'lucide-react';
import { coinPackages, formatCoins, formatUSD } from '../lib/coinMath';
import { purchasePerk, getActivePerks, getAllPerks, formatPerkDuration, canAffordPerk } from '../lib/perkSystem';
import { purchaseEntranceEffect, setActiveEntranceEffect, getAllEntranceEffects } from '../lib/entranceEffects';
import { useOwnedEntranceEffects, useActiveEntranceEffect, useEntranceEffectPurchase, useSetActiveEntranceEffect } from '../hooks/useEntranceEffects';
import { useInsurancePlans, useActiveInsurance, useInsurancePurchase, useProtectionStatus } from '../hooks/useInsurance';
import RequireRole from '../components/RequireRole';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import LuckyStats from '../components/LuckyStats';
import PayoutRequest from '../components/PayoutRequest';

export default function CoinStore() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadingPackage, setLoadingPackage] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [tab, setTab] = useState('coins');
  const [effects, setEffects] = useState([]);
  const [perks, setPerks] = useState([]);
  const [activePerks, setActivePerks] = useState([]);
  const [entranceEffects, setEntranceEffects] = useState([]);

  // Insurance hooks
  const { plans: insurancePlans, loading: loadingInsurancePlans } = useInsurancePlans();
  const { activeInsurance, refreshInsurance } = useActiveInsurance();
  const { purchase: purchaseInsurancePlan, purchasing: purchasingInsurance } = useInsurancePurchase();

  // Entrance effects hooks
  const { ownedEffects, refreshOwnedEffects } = useOwnedEntranceEffects();
  const { activeEffect, refreshActiveEffect } = useActiveEntranceEffect();
  const { purchase: purchaseEffect, purchasing: purchasingEffect } = useEntranceEffectPurchase();
  const { setActive, setting: settingActive } = useSetActiveEntranceEffect();

  useEffect(() => {
    if (!user || !profile) {
      navigate('/auth', { replace: true });
      return;
    }

    loadWalletData();
  }, [user, profile, navigate]);

  const loadWalletData = async () => {
    console.log('🔄 Loading wallet data for user:', user?.id);
    try {
      setLoading(true);

      // Load user profile data with coin balances
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('paid_coins, trollmonds, total_earned_coins')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      console.log('✅ Profile data loaded:', profileData);
      setWalletData({
        paidCoins: profileData.paid_coins || 0,
        freeCoins: profileData.trollmonds || 0,
        totalCoins: (profileData.paid_coins || 0) + (profileData.trollmonds || 0)
      });
      const [effRes] = await Promise.all([
        supabase.from('entrance_effects').select('*').order('created_at', { ascending: false })
      ])

      // Load perks from the new system
      const allPerks = getAllPerks();
      const userActivePerks = await getActivePerks(user.id);
      const allEntranceEffects = getAllEntranceEffects();

      console.log('✅ Effects, perks, entrance effects loaded:', {
        effects: effRes.data?.length,
        perks: allPerks.length,
        activePerks: userActivePerks.length,
        entranceEffects: allEntranceEffects.length
      });

      setEffects(effRes.data || [])
      setPerks(allPerks)
      setActivePerks(userActivePerks)
      setEntranceEffects(allEntranceEffects)

    } catch (err) {
      console.error('❌ Error loading wallet data:', err);
      toast.error('Failed to load wallet data');
    } finally {
      setLoading(false);
      console.log('🏁 Wallet data loading complete');
    }
  };

  const buyEffect = async (effect) => {
    try {
      const price = effect.price_paid_coins || effect.coin_cost || 0
      const { error: deductErr } = await supabase.rpc('deduct_coins', { p_user_id: user.id, p_amount: price, p_coin_type: 'paid' })
      if (deductErr) throw deductErr
      const { error } = await supabase.from('user_entrance_effects').insert([{ user_id: user.id, effect_id: effect.id }])
      if (error) throw error
      toast.success('Entrance effect purchased')
      await loadWalletData()
    } catch (err) {
      toast.error('Purchase failed')
    }
  }

  const buyPerk = async (perk) => {
    try {
      const result = await purchasePerk(user.id, perk.key);

      if (result.success) {
        toast.success(`${perk.name} activated!`);
        await loadWalletData(); // Refresh wallet and active perks
      } else {
        toast.error(result.error || 'Purchase failed');
      }
    } catch (err) {
      console.error('Perk purchase error:', err);
      toast.error('Purchase failed');
    }
  }


  const handleBuy = async (pkg) => {
    console.log('🛒 Starting PayPal checkout for package:', pkg.id);
    setLoadingPackage(pkg.id);

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No authentication token available');

      const payload = {
        amount: pkg.price,
        coins: pkg.coins,
        user_id: user.id
      };

      console.log("📤 Sending payload →", payload);

      const res = await fetch(
        `${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/paypal-create-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
          },
          body: JSON.stringify(payload),
        }
      );

      console.log("📡 PayPal response status:", res.status);

      if (!res.ok) {
        const txt = await res.text();
        console.error("❌ Backend error:", txt);
        throw new Error(`Backend error: ${res.status}`);
      }

      const data = await res.json();
      console.log("📦 Order created:", data);

      if (!data.orderID) throw new Error("Backend did not return orderID");

      // THIS IS THE REAL FLOW → RETURN THE ORDER ID TO PAYPAL BUTTONS
      return data.orderID;

    } catch (err) {
      console.error("❌ Failed to start PayPal checkout:", err);
      toast.error("Unable to start checkout.");
      throw err;
    } finally {
      setLoadingPackage(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Coins className="w-8 h-8 text-purple-400" />
              Troll City Coin Store
            </h1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C] animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-700 rounded w-1/3 mt-2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!walletData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-4xl mx-auto bg-zinc-900 border border-gray-700 rounded-xl p-8 text-center">
          <Coins className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Wallet Data Not Available</h2>
          <p className="text-gray-400 mb-6">Unable to load your wallet information</p>
          <button
            onClick={loadWalletData}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <RequireRole roles={['user', 'broadcaster', 'admin']} fallbackPath="/dashboard">
      <PayPalScriptProvider
        options={{
          "client-id": import.meta.env.VITE_PAYPAL_CLIENT_ID,
          currency: "USD",
          intent: "capture"
        }}
      >
        <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Coins className="w-8 h-8 text-purple-400" />
              Troll City Coin Store
            </h1>
            <div className="flex gap-2">
              <button className={`px-3 py-2 rounded ${tab==='coins'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('coins')}>Coin Packages</button>
              <button className={`px-3 py-2 rounded ${tab==='effects'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('effects')}>Entrance Effects</button>
              <button className={`px-3 py-2 rounded ${tab==='perks'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('perks')}>Perks</button>
              <button className={`px-3 py-2 rounded ${tab==='insurance'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('insurance')}>Insurance</button>
              <button className={`px-3 py-2 rounded ${tab==='lucky'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('lucky')}>Lucky Stats</button>
              <button className={`px-3 py-2 rounded ${tab==='payouts'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('payouts')}>Payouts</button>
            </div>
          </div>

          {/* Wallet Summary */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-6 border border-purple-500/30 shadow-lg">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-purple-400" />
              Your Wallet Balance
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Coins */}
              <div className="bg-zinc-900 rounded-lg p-4 border border-purple-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-5 h-5 text-purple-400" />
                  <span className="text-sm text-gray-400">Total Coins</span>
                </div>
                <p className="text-2xl font-bold text-purple-400">
                  {formatCoins(walletData.totalCoins)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Troll Coins + Trollmonds combined</p>
              </div>

              {/* Paid Coins */}
              <div className="bg-zinc-900 rounded-lg p-4 border border-yellow-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-yellow-400" />
                <span className="text-sm text-gray-400">Troll Coins</span>
              </div>
                <p className="text-2xl font-bold text-yellow-400">
                  {formatCoins(walletData.paidCoins)}
                </p>
                <p className="text-xs text-gray-500 mt-1">withdrawable balance</p>
              </div>

              {/* Free Coins */}
              <div className="bg-zinc-900 rounded-lg p-4 border border-green-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-green-400" />
                <span className="text-sm text-gray-400">Trollmonds</span>
              </div>
                <p className="text-2xl font-bold text-green-400">
                  {formatCoins(walletData.freeCoins)}
                </p>
                <p className="text-xs text-gray-500 mt-1">earned from activities</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-6 border border-purple-500/30 shadow-lg">
            {tab === 'coins' && (
              <>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-purple-400" />
                  Available Coin Packages
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {coinPackages.map((pkg) => (
                    <div key={pkg.id} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20 hover:border-purple-500/40 transition-all">
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg font-bold text-purple-300">{pkg.name}</span>
                          <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full">{pkg.id}</span>
                        </div>
                        <p className="text-xs text-gray-400 mb-2">Package</p>
                      </div>
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Coins className="w-4 h-4 text-yellow-400" />
                          <span className="text-sm text-gray-400">Coins</span>
                        </div>
                        <p className="text-2xl font-bold text-yellow-400">{formatCoins(pkg.coins)}</p>
                      </div>
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="w-4 h-4 text-green-400" />
                          <span className="text-sm text-gray-400">Price</span>
                        </div>
                        <p className="text-xl font-bold text-green-400">{formatUSD(pkg.price)}</p>
                      </div>
                      <PayPalButtons
                        style={{ layout: "horizontal" }}
                        fundingSource="paypal"
                        createOrder={async () => {
                          return await handleBuy(pkg); // MUST return orderID
                        }}
                        onApprove={async (data) => {
                           console.log("✅ PayPal approved:", data);

                           if (!data.orderID) {
                             toast.error("Missing PayPal order ID");
                             return;
                           }

                           const { data: { session } } = await supabase.auth.getSession();
                           const token = session?.access_token;

                           const captureRes = await fetch(
                             `${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/paypal-capture-order`,
                             {
                               method: "POST",
                               headers: {
                                 "Content-Type": "application/json",
                                 Authorization: `Bearer ${token}`,
                                 apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                               },
                               body: JSON.stringify({
                                 orderID: data.orderID,
                                 user_id: user.id,
                                 coins: pkg.coins,
                               }),
                             }
                           );

                           const captureJson = await captureRes.json();
                           console.log("💰 Capture result:", captureJson);

                           if (captureRes.ok) {
                             toast.success(`+${pkg.coins.toLocaleString()} Troll Coins added!`);
                             loadWalletData();
                           } else {
                             const errorMsg = captureJson.paypalDebugId
                               ? `Payment failed (Debug ID: ${captureJson.paypalDebugId})`
                               : "Payment completed, but coin update failed.";
                             toast.error(errorMsg);
                           }
                         }}
                        onError={(err) => {
                          console.error("❌ PayPal error:", err);
                          toast.error("PayPal checkout error.");
                        }}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {tab === 'effects' && (
              <>
                <h2 className="text-xl font-bold mb-4">Entrance Effects</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {effects.map((e) => (
                    <div key={e.id} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
                      <div className="font-semibold mb-2">{e.name}</div>
                      <div className="text-sm text-gray-400 mb-3">{e.description}</div>
                      <div className="flex items-center justify-between">
                        <div className="text-yellow-400 font-bold">{(e.price_paid_coins || e.coin_cost || 0).toLocaleString()} Troll Coins</div>
                        <button onClick={() => buyEffect(e)} className="px-3 py-2 bg-purple-600 rounded">Purchase</button>
                      </div>
                    </div>
                  ))}
                  {effects.length === 0 && <div className="text-gray-400">No effects available</div>}
                </div>
              </>
            )}

            {tab === 'perks' && (
              <>
                <h2 className="text-xl font-bold mb-4">Perks</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {perks.map((perk) => {
                    const isActive = activePerks.some(
                      p => p.perk_id === perk.key && new Date(p.expires_at) > new Date()
                    );
                    const activePerk = activePerks.find(p => p.perk_id === perk.key);
                    const timeLeft = activePerk ? new Date(activePerk.expires_at).getTime() - Date.now() : 0;

                    return (
                      <div key={perk.key} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
                        <div className="font-semibold mb-2">{perk.name}</div>
                        <div className="text-sm text-gray-400 mb-2">{perk.description}</div>
                        <div className="text-xs text-gray-500 mb-3 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          Duration: {formatPerkDuration(perk.duration_minutes)}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-yellow-400 font-bold">{perk.cost.toLocaleString()} Troll Coins</div>
                          {isActive ? (
                            <div className="text-green-400 text-sm font-semibold">
                              Active ({Math.max(0, Math.ceil(timeLeft / (1000 * 60))).toLocaleString()}m left)
                            </div>
                          ) : (
                            <button
                              onClick={() => buyPerk(perk)}
                              className="px-3 py-2 bg-purple-600 rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={walletData?.paidCoins < perk.cost}
                            >
                              {walletData?.paidCoins < perk.cost ? 'Not enough coins' : 'Purchase'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {perks.length === 0 && <div className="text-gray-400">No perks available</div>}
                </div>
              </>
            )}

            {tab === 'insurance' && (
              <>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-400" />
                  Insurance Plans
                </h2>

                {/* Active Insurance Status */}
                {activeInsurance.length > 0 && (
                  <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 mb-6">
                    <h3 className="text-lg font-semibold text-green-400 mb-3">Active Protection</h3>
                    <div className="space-y-2">
                      {activeInsurance.map((insurance) => (
                        <div key={insurance.id} className="flex items-center justify-between bg-green-900/30 rounded-lg p-3">
                          <div>
                            <span className="font-medium text-green-300 capitalize">
                              {insurance.protection_type} Protection
                            </span>
                            <span className="text-sm text-green-400 ml-2">
                              ({Math.max(0, Math.ceil((new Date(insurance.expires_at) - Date.now()) / (1000 * 60))).toLocaleString()}m remaining)
                            </span>
                          </div>
                          <Shield className="w-5 h-5 text-green-400" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {insurancePlans.map((plan) => {
                    // Check if user already has this type of protection
                    const hasProtection = activeInsurance.some(ins =>
                      ins.protection_type === plan.protection_type ||
                      ins.protection_type === 'full'
                    );

                    return (
                      <div key={plan.id} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
                        <div className="font-semibold mb-2">{plan.name}</div>
                        <div className="text-sm text-gray-400 mb-2">{plan.description}</div>
                        <div className="text-xs text-gray-500 mb-3">
                          Duration: {plan.duration_hours}h | Protection: <span className="capitalize font-medium">{plan.protection_type}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-yellow-400 font-bold">{plan.cost.toLocaleString()} Troll Coins</div>
                          {hasProtection ? (
                            <div className="text-green-400 text-sm font-semibold">Active</div>
                          ) : (
                            <button
                              onClick={async () => {
                                const result = await purchaseInsurancePlan(plan.id);
                                if (result.success) {
                                  toast.success(`${plan.name} activated!`);
                                  refreshInsurance();
                                  loadWalletData();
                                } else {
                                  toast.error(result.error || 'Purchase failed');
                                }
                              }}
                              disabled={purchasingInsurance || walletData?.paidCoins < plan.cost}
                              className="px-3 py-2 bg-purple-600 rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {purchasingInsurance ? 'Purchasing...' :
                               walletData?.paidCoins < plan.cost ? 'Not enough coins' : 'Purchase'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {insurancePlans.length === 0 && !loadingInsurancePlans && (
                    <div className="text-gray-400">No insurance plans available</div>
                  )}
                  {loadingInsurancePlans && (
                    <div className="text-gray-400">Loading insurance plans...</div>
                  )}
                </div>
              </>
            )}

            {tab === 'effects' && (
              <>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  Entrance Effects
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {entranceEffects.map((effect) => {
                    const isOwned = ownedEffects.includes(effect.key);
                    const isActive = activeEffect === effect.key;

                    return (
                      <div key={effect.key} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
                        <div className="font-semibold mb-2">{effect.name}</div>
                        <div className="text-sm text-gray-400 mb-2">{effect.description}</div>
                        <div className="text-xs text-gray-500 mb-3">
                          Rarity: <span className={`font-semibold ${
                            effect.rarity === 'Exclusive' ? 'text-red-400' :
                            effect.rarity === 'Mythic' ? 'text-purple-400' :
                            effect.rarity === 'Legendary' ? 'text-yellow-400' :
                            effect.rarity === 'Epic' ? 'text-blue-400' :
                            'text-green-400'
                          }`}>{effect.rarity}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-yellow-400 font-bold">{effect.cost.toLocaleString()} Troll Coins</div>
                          {isActive ? (
                            <div className="text-green-400 text-sm font-semibold">Active</div>
                          ) : isOwned ? (
                            <button
                              onClick={async () => {
                                const result = await setActive(effect.key);
                                if (result.success) {
                                  toast.success(`${effect.name} activated!`);
                                  refreshActiveEffect();
                                } else {
                                  toast.error(result.error || 'Failed to activate effect');
                                }
                              }}
                              disabled={settingActive}
                              className="px-3 py-2 bg-green-600 rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              {settingActive ? 'Setting...' : 'Activate'}
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                const result = await purchaseEffect(effect.key);
                                if (result.success) {
                                  toast.success(`${effect.name} purchased!`);
                                  refreshOwnedEffects();
                                  loadWalletData();
                                } else {
                                  toast.error(result.error || 'Purchase failed');
                                }
                              }}
                              disabled={purchasingEffect || walletData?.paidCoins < effect.cost}
                              className="px-3 py-2 bg-purple-600 rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {purchasingEffect ? 'Buying...' :
                               walletData?.paidCoins < effect.cost ? 'Not enough coins' : 'Purchase'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {entranceEffects.length === 0 && <div className="text-gray-400">No entrance effects available</div>}
                </div>
              </>
            )}

            {tab === 'lucky' && (
              <>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  Lucky Trollmonds Stats
                </h2>
                <LuckyStats />
              </>
            )}

            {tab === 'payouts' && (
              <>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  Creator Payouts
                </h2>
                <PayoutRequest />
              </>
            )}
          </div>

          {/* Purchase Information */}
          <div className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C]">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-purple-400" />
              How It Works
            </h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm">1</span>
                </div>
                <div>
                  <p className="font-semibold">Select a Package</p>
                  <p className="text-sm text-gray-400">Choose from 6 coin packages based on your needs</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm">2</span>
                </div>
                <div>
                  <p className="font-semibold">Pay with PayPal</p>
                  <p className="text-sm text-gray-400">Secure payment processing through PayPal checkout</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm">3</span>
                </div>
                <div>
                  <p className="font-semibold">Coins Added After Payment</p>
                  <p className="text-sm text-gray-400">Coins are only added after successful PayPal payment completion</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </PayPalScriptProvider>
    </RequireRole>
  );
}
