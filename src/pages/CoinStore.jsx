import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { Coins, DollarSign, ShoppingCart, CreditCard, CheckCircle, Loader2 } from 'lucide-react';
import { coinPackages, formatCoins, formatUSD } from '../lib/coinMath';
import RequireRole from '../components/RequireRole';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

export default function CoinStore() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadingPackage, setLoadingPackage] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [tab, setTab] = useState('coins');
  const [effects, setEffects] = useState([]);
  const [perks, setPerks] = useState([]);
  const [plans, setPlans] = useState([]);

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
        .select('paid_coin_balance, free_coin_balance, total_earned_coins')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      console.log('✅ Profile data loaded:', profileData);
      setWalletData({
        paidCoins: profileData.paid_coin_balance || 0,
        freeCoins: profileData.free_coin_balance || 0,
        totalCoins: (profileData.paid_coin_balance || 0) + (profileData.free_coin_balance || 0)
      });
      const [effRes, perkRes, planRes] = await Promise.all([
        supabase.from('entrance_effects').select('*').order('created_at', { ascending: false }),
        supabase.from('perks').select('*').order('created_at', { ascending: false }),
        supabase.from('insurance_plans').select('*').order('created_at', { ascending: false })
      ])
      console.log('✅ Effects, perks, plans loaded:', { effects: effRes.data?.length, perks: perkRes.data?.length, plans: planRes.data?.length });
      setEffects(effRes.data || [])
      setPerks(perkRes.data || [])
      setPlans(planRes.data || [])

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
      const price = perk.price_paid_coins || 0
      const { error: deductErr } = await supabase.rpc('deduct_coins', { p_user_id: user.id, p_amount: price, p_coin_type: 'paid' })
      if (deductErr) throw deductErr
      const { error } = await supabase.from('user_perks').insert([{ user_id: user.id, perk_id: perk.id }])
      if (error) throw error
      toast.success('Perk purchased')
      await loadWalletData()
    } catch (err) {
      toast.error('Purchase failed')
    }
  }

  const buyInsurance = async (plan) => {
    try {
      const price = plan.price_paid_coins || 0
      const { error: deductErr } = await supabase.rpc('deduct_coins', { p_user_id: user.id, p_amount: price, p_coin_type: 'paid' })
      if (deductErr) throw deductErr
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + (plan.duration_days || 0))
      const { error } = await supabase.from('user_insurance').insert([{ user_id: user.id, plan_id: plan.id, end_date: endDate.toISOString() }])
      if (error) throw error
      toast.success('Insurance purchased')
      await loadWalletData()
    } catch (err) {
      toast.error('Purchase failed')
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
                            toast.error("Payment completed, but coin update failed.");
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
                  {perks.map((p) => (
                    <div key={p.id} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
                      <div className="font-semibold mb-2">{p.name}</div>
                      <div className="text-sm text-gray-400 mb-3">{p.description}</div>
                      <div className="flex items-center justify-between">
                        <div className="text-yellow-400 font-bold">{(p.price_paid_coins || 0).toLocaleString()} Troll Coins</div>
                        <button onClick={() => buyPerk(p)} className="px-3 py-2 bg-purple-600 rounded">Purchase</button>
                      </div>
                    </div>
                  ))}
                  {perks.length === 0 && <div className="text-gray-400">No perks available</div>}
                </div>
              </>
            )}

            {tab === 'insurance' && (
              <>
                <h2 className="text-xl font-bold mb-4">Insurance</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plans.map((p) => (
                    <div key={p.id} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
                      <div className="font-semibold mb-2">{p.name}</div>
                      <div className="text-sm text-gray-400 mb-2">{p.description}</div>
                      <div className="text-xs text-gray-500 mb-3">{p.coverage_description}</div>
                      <div className="flex items-center justify-between">
                        <div className="text-yellow-400 font-bold">{(p.price_paid_coins || 0).toLocaleString()} Troll Coins</div>
                        <button onClick={() => buyInsurance(p)} className="px-3 py-2 bg-purple-600 rounded">Purchase</button>
                      </div>
                    </div>
                  ))}
                  {plans.length === 0 && <div className="text-gray-400">No plans available</div>}
                </div>
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
