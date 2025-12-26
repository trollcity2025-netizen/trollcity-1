import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { useCoins } from '../lib/hooks/useCoins';
import { toast } from 'sonner';
import { Coins, DollarSign, ShoppingCart, CreditCard, CheckCircle, Loader2 } from 'lucide-react';
import { coinPackages, formatCoins, formatUSD } from '../lib/coinMath';
import { addCoins, deductCoins } from '../lib/coinTransactions';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useLiveContextStore } from '../lib/liveContextStore';
import { useStreamMomentum } from '../lib/hooks/useStreamMomentum';

const SAMPLE_EFFECTS = [
  { id: 'effect_confetti_pop', name: 'Confetti Pop', description: 'Confetti burst', coin_cost: 1000 },
  { id: 'effect_neon_flash', name: 'Neon Flash', description: 'Quick neon glow wave', coin_cost: 1500 },
  { id: 'effect_smoke_drift', name: 'Smoke Drift', description: 'Soft fog trail', coin_cost: 2000 },
  { id: 'effect_glitter_steps', name: 'Glitter Steps', description: 'Glitter trail follows', coin_cost: 2500 },
  { id: 'effect_pixel_burst', name: 'Pixel Burst', description: 'Retro pixel explosion', coin_cost: 3000 },
  { id: 'effect_bubble_bounce', name: 'Bubble Bounce', description: 'Floating bubble pops', coin_cost: 3500 },
  { id: 'effect_snowfall_drop', name: 'Snowfall Drop', description: 'Snowflakes fall briefly', coin_cost: 4000 },
];

const SAMPLE_PERKS = [
  { id: 'perk_chat_shine', name: 'Chat Shine', description: 'Chat messages glow', cost: 2000, duration_minutes: 1440, perk_type: 'visibility' },
  { id: 'perk_stream_boost_lite', name: 'Stream Boost Lite', description: 'Slight discovery boost', cost: 3500, duration_minutes: 1440, perk_type: 'boost' },
  { id: 'perk_coin_magnet', name: 'Coin Magnet', description: '+5% coin reward', cost: 4500, duration_minutes: 1440, perk_type: 'boost' },
  { id: 'perk_troll_shield', name: 'Troll Shield', description: '-10% TrollCourt fines', cost: 5000, duration_minutes: 1440, perk_type: 'protection' },
  { id: 'perk_priority_tag', name: 'Priority Tag', description: 'Name above chat', cost: 7500, duration_minutes: 1440, perk_type: 'cosmetic' },
  { id: 'perk_faster_cooldowns', name: 'Faster Cooldowns', description: '-15% cooldown time', cost: 10000, duration_minutes: 1440, perk_type: 'boost' },
];

const SAMPLE_INSURANCE_PLANS = [
  { id: 'insurance_basic_week', name: 'Basic Coverage', description: '-10% gambling loss, covers 10,000 coins/week', cost: 8000, duration_hours: 168, protection_type: 'gambling' },
  { id: 'insurance_basic_month', name: 'Basic Monthly', description: '-10% gambling loss, covers 50,000 coins/month', cost: 25000, duration_hours: 720, protection_type: 'gambling' },
  { id: 'insurance_vip_week', name: 'VIP Coverage', description: '-25% loss + 1 penalty block/week', cost: 18000, duration_hours: 168, protection_type: 'penalty' },
  { id: 'insurance_vip_month', name: 'VIP Monthly', description: '-25% loss + 4 penalty blocks/month', cost: 60000, duration_hours: 720, protection_type: 'penalty' },
  { id: 'insurance_elite_week', name: 'Elite Coverage', description: '-40% loss + dispute help', cost: 45000, duration_hours: 168, protection_type: 'dispute' },
  { id: 'insurance_elite_month', name: 'Elite Monthly', description: '-40% loss + 8 penalty blocks', cost: 150000, duration_hours: 720, protection_type: 'dispute' },
  { id: 'insurance_supreme_week', name: 'Supreme Court Shield', description: '-50% loss + unlimited disputes', cost: 120000, duration_hours: 168, protection_type: 'supreme' },
  { id: 'insurance_supreme_month', name: 'Supreme Monthly Shield', description: '-50% loss + 20 penalty blocks/month', cost: 300000, duration_hours: 720, protection_type: 'supreme' },
];

const isMissingTableError = (error) =>
  Boolean(
    error?.message?.includes('schema cache') ||
      error?.message?.includes('Could not find the table') ||
      error?.message?.includes('relation') ||
      error?.message?.includes('does not exist'),
  );

export default function CoinStore() {
  const { user, profile, refreshProfile } = useAuthStore();
  const navigate = useNavigate();
  const { troll_coins, trollmonds, refreshCoins } = useCoins();
  const STORE_TAB_KEY = 'tc-store-active-tab';
  const STORE_COMPLETE_KEY = 'tc-store-show-complete';
  const [loading, setLoading] = useState(true);
  const [loadingPackage, setLoadingPackage] = useState(null);
  const [walletMeta, setWalletMeta] = useState(null);
  const [tab, setTab] = useState('coins');
  const [effects, setEffects] = useState([]);
  const [perks, setPerks] = useState([]);
  const [plans, setPlans] = useState([]);
  const [effectsNote, setEffectsNote] = useState(null);
  const [perksNote, setPerksNote] = useState(null);
  const [insuranceNote, setInsuranceNote] = useState(null);
  const activeStreamId = useLiveContextStore((s) => s.activeStreamId);
  const { momentum } = useStreamMomentum(activeStreamId);
  const [liveStreamIsLive, setLiveStreamIsLive] = useState(false);
  const [snackLoading, setSnackLoading] = useState(null);
  const [lastSnackAt, setLastSnackAt] = useState({});
  const [showPurchaseComplete, setShowPurchaseComplete] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(sessionStorage.getItem('tc-store-show-complete'));
  });

  const showLiveSnacks = Boolean(activeStreamId && liveStreamIsLive);
  const callPackages = {
    audio: [
      { id: 'audio_60', name: 'Base Audio', minutes: 60, totalCost: 1000 },
      { id: 'audio_150', name: 'Standard Audio', minutes: 150, totalCost: 2000 },
      { id: 'audio_400', name: 'Premium Audio', minutes: 400, totalCost: 5000 },
      { id: 'audio_1000', name: 'Ultra Audio', minutes: 1000, totalCost: 10000 },
    ],
    video: [
      { id: 'video_30', name: 'Base Video', minutes: 30, totalCost: 1000 },
      { id: 'video_75', name: 'Standard Video', minutes: 75, totalCost: 2000 },
      { id: 'video_200', name: 'Premium Video', minutes: 200, totalCost: 5000 },
      { id: 'video_500', name: 'Ultra Video', minutes: 500, totalCost: 10000 },
    ],
  };

  const trollPassExpiresAt =
    walletMeta?.trollPassExpiresAt || profile?.troll_pass_expires_at || null;
  const trollPassLastPurchasedAt =
    walletMeta?.trollPassLastPurchasedAt || profile?.troll_pass_last_purchased_at || null;
  const trollPassActive = Boolean(
    trollPassExpiresAt && new Date(trollPassExpiresAt).getTime() > Date.now(),
  );

  const trollPassBundle = {
    id: 'troll_pass_bundle',
    coins: 1500,
    price: 4.50,
  };

  const isViewerOnly = Boolean(
    profile &&
      profile.role !== 'admin' &&
      profile.role !== 'troll_officer' &&
      profile.is_admin !== true &&
      profile.is_troll_officer !== true &&
      profile.is_lead_officer !== true &&
      !profile.officer_role &&
      profile.is_broadcaster !== true &&
      profile.role !== 'broadcaster',
  );

  const getPerkPrice = (perk) => {
    const base = Number(perk?.cost || 0);
    if (!Number.isFinite(base) || base <= 0) return 0;

    const dayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const input = `${dayKey}:${perk?.id || ''}`;

    // Simple deterministic hash (stable per day + perk)
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
    }

    const normalized = Math.abs(hash) % 51; // 0..50
    const multiplier = 0.75 + normalized / 100; // 0.75..1.25
    const price = Math.round((base * multiplier) / 10) * 10;
    return Math.max(10, price);
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    loadWalletData(true);
  }, [user?.id, navigate]);

  useEffect(() => {
    let isActive = true;

    const loadLive = async () => {
      if (!activeStreamId) {
        setLiveStreamIsLive(false);
        return;
      }

      const { data } = await supabase
        .from('streams')
        .select('id,is_live')
        .eq('id', activeStreamId)
        .maybeSingle();

      if (!isActive) return;
      setLiveStreamIsLive(Boolean(data?.is_live));
    };

    loadLive();
    return () => {
      isActive = false;
    };
  }, [activeStreamId]);

  useEffect(() => {
    if (tab === 'live_snacks' && !showLiveSnacks) setTab('coins');
  }, [tab, showLiveSnacks]);

  useEffect(() => {
    const savedTab = sessionStorage.getItem(STORE_TAB_KEY);
    if (savedTab && savedTab !== tab) {
      setTab(savedTab);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(STORE_TAB_KEY, tab);
  }, [tab]);

  const loadWalletData = async (showLoading = true) => {
    console.log('?? Loading wallet data for user:', user?.id);
    try {
      if (showLoading) setLoading(true);

      await refreshCoins();

      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('troll_pass_expires_at, troll_pass_last_purchased_at')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.warn('Failed to load wallet metadata:', profileError);
      }

      setWalletMeta({
        trollPassExpiresAt: profileData?.troll_pass_expires_at || profile?.troll_pass_expires_at || null,
        trollPassLastPurchasedAt:
          profileData?.troll_pass_last_purchased_at || profile?.troll_pass_last_purchased_at || null,
      });

      const [effRes, perkRes, planRes] = await Promise.all([
        supabase.from('entrance_effects').select('*').order('created_at', { ascending: false }),
        supabase.from('perks').select('*').order('created_at', { ascending: false }),
        supabase.from('insurance_options').select('*').order('created_at', { ascending: false })
      ]);
      const applyCatalogData = (result, fallback = [], setter, noteSetter, label) => {
        if (result.error) {
          const missing = isMissingTableError(result.error);
          const message = missing
            ? `${label} catalog is not provisioned in this environment; showing curated samples.`
            : `Unable to load ${label} (${result.error.message || 'unknown error'}); showing curated samples.`;
          noteSetter(message);
          setter(fallback);
          return fallback;
        }

        const items = result.data || [];
        if (!items.length && fallback.length) {
          noteSetter(`No ${label} are configured yet; showing curated samples instead.`);
          setter(fallback);
          return fallback;
        }

        setter(items);
        if (!items.length) {
          noteSetter(`No ${label} are configured yet. Please check back soon.`);
        } else {
          noteSetter(null);
        }
        return items;
      };

      const loadedEffects = applyCatalogData(
        effRes,
        SAMPLE_EFFECTS,
        setEffects,
        setEffectsNote,
        'entrance effects',
      );
      const loadedPerks = applyCatalogData(
        perkRes,
        SAMPLE_PERKS,
        setPerks,
        setPerksNote,
        'perks',
      );
      const loadedPlans = applyCatalogData(
        planRes,
        SAMPLE_INSURANCE_PLANS,
        setPlans,
        setInsuranceNote,
        'insurance plans',
      );

      console.log('Effects, perks, plans loaded:', { effects: loadedEffects.length, perks: loadedPerks.length, plans: loadedPlans.length });

    } catch (err) {
      console.error('? Error loading wallet data:', err);
      toast.error('Failed to load wallet data');
      setWalletMeta({
        trollPassExpiresAt: profile?.troll_pass_expires_at || null,
        trollPassLastPurchasedAt: profile?.troll_pass_last_purchased_at || null,
      });
    } finally {
      if (showLoading) setLoading(false);
      console.log('?? Wallet data loading complete');
    }
  };

  const showPurchaseCompleteOverlay = () => {
    sessionStorage.setItem(STORE_COMPLETE_KEY, Date.now().toString());
    setShowPurchaseComplete(true);
  };

  useEffect(() => {
    if (!showPurchaseComplete) return;
    sessionStorage.removeItem(STORE_COMPLETE_KEY);
    const timer = setTimeout(() => setShowPurchaseComplete(false), 1400);
    return () => clearTimeout(timer);
  }, [showPurchaseComplete]);
  const canBuySnack = (key) => {
    const ts = lastSnackAt[key];
    if (!ts) return true;
    return Date.now() - ts > 30 * 1000;
  };

  const buySnack = async (snackKey) => {
    if (!activeStreamId || !showLiveSnacks) {
      toast.error('Live Snacks are only available inside a live stream');
      return;
    }

    if (!canBuySnack(snackKey)) {
      toast.error('Snack on cooldown');
      return;
    }

    setSnackLoading(snackKey);
    try {
      const { data, error } = await supabase.rpc('buy_live_snack', {
        p_stream_id: activeStreamId,
        p_snack_key: snackKey,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Snack purchase failed');

      setLastSnackAt((prev) => ({ ...prev, [snackKey]: Date.now() }));
      await loadWalletData(false);

      const after = Number(data?.momentum_after ?? 0);
      toast.success(`Live Snack activated. Momentum: ${after}%`);
      showPurchaseCompleteOverlay();
    } catch (e) {
      toast.error(e?.message || 'Snack purchase failed');
    } finally {
      setSnackLoading(null);
    }
  };

  const buyTrollPass = async () => {
    if (!isViewerOnly) {
      toast.error('Troll Pass is viewer-only');
      return;
    }
    if (trollPassActive) {
      toast.error('Troll Pass is already active');
      return;
    }
    if (troll_coins < 1500) {
      toast.error('Not enough troll_coins (requires 1,500)');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('buy_troll_pass');
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Purchase failed');
      toast.success('Troll Pass activated (30 days)');
      showPurchaseCompleteOverlay();
      await loadWalletData(false);
      if (refreshProfile) await refreshProfile();
    } catch (e) {
      toast.error(e?.message || 'Purchase failed');
    }
  };

  const deducttroll_coins = async (amount) => {
    if (amount <= 0) return { error: new Error('Invalid coin amount') }

    const result = await supabase.rpc('deduct_troll_coins', {
      p_user_id: user.id,
      p_amount: amount
    })

    if (result.error) {
      const message = result.error.message || 'Failed to deduct troll_coins'
      return { error: new Error(message) }
    }

    return result
  }

  const logCoinTransaction = async (payload) => {
    const attempts = [
      { ...payload, coin_type: 'troll_coins' },
      { ...payload, coin_type: 'paid' }
    ]

    for (const entry of attempts) {
      const { error } = await supabase.from('coin_transactions').insert([entry])
      if (!error) return

      const message = error.message || ''
      const isCoinTypeError =
        message.toLowerCase().includes('coin type') ||
        message.toLowerCase().includes('coin_type') ||
        message.toLowerCase().includes('check constraint')

      if (!isCoinTypeError) return
    }
  }

  const buyEffect = async (effect) => {
   try {
     const price = effect.price_troll_coins || effect.coin_cost || 0
     if (price <= 0) {
       toast.error('Invalid effect price')
       return
     }
     
     if (troll_coins < price) {
       toast.error(`Not enough Troll Coins. Need ${price}, have ${troll_coins}`)
       return
     }
     
      const { error: deductErr } = await deducttroll_coins(price)
     
     if (deductErr) {
       console.error('Coin deduction error:', deductErr)
       toast.error(deductErr.message || 'Failed to deduct coins')
       return
     }
     
     const { error: insertErr } = await supabase
       .from('user_entrance_effects')
       .upsert(
         [{
           user_id: user.id,
           effect_id: effect.id
         }],
         { onConflict: 'user_id,effect_id', ignoreDuplicates: true }
       )
     
     if (insertErr) {
       console.error('Effect purchase error:', insertErr)
       toast.error(insertErr.message || 'Failed to purchase effect')
       return
     }
     
     // Log the transaction
      await logCoinTransaction({
        user_id: user.id,
        type: 'entrance_effect',
        amount: price,
        coin_delta: -price,
        description: `Purchased entrance effect: ${effect.name}`,
        metadata: { effect_id: effect.id }
      })
     
     toast.success('Entrance effect purchased')
     showPurchaseCompleteOverlay()
     await loadWalletData(false)
   } catch (err) {
     console.error('Effect purchase error:', err)
     toast.error(err.message || 'Purchase failed')
   }
 }

  const buyPerk = async (perk) => {
   try {
     const price = getPerkPrice(perk)
     const durationMinutes = Number(perk.duration_minutes || 0)
     
     if (price <= 0) {
       toast.error('Invalid perk price')
       return
     }
     
     if (troll_coins < price) {
       toast.error(`Not enough Troll Coins. Need ${price}, have ${troll_coins}`)
       return
     }
     
     const expiresAt = new Date(Date.now() + Math.max(1, durationMinutes) * 60 * 1000).toISOString()
     
      const { error: deductErr } = await deducttroll_coins(price)
     
     if (deductErr) {
       console.error('Coin deduction error:', deductErr)
       toast.error(deductErr.message || 'Failed to deduct coins')
       return
     }
     
     const { error: insertErr } = await supabase.from('user_perks').insert([{
       user_id: user.id,
       perk_id: perk.id,
       expires_at: expiresAt,
       is_active: true,
       metadata: {
         perk_name: perk.name,
         base_cost: Number(perk.cost || 0),
         final_cost: price,
         duration_minutes: durationMinutes,
         perk_type: perk.perk_type,
       }
     }])
     
     if (insertErr) {
       console.error('Perk purchase error:', insertErr)
       toast.error(insertErr.message || 'Failed to purchase perk')
       return
     }
     
     // Log the transaction
      await logCoinTransaction({
        user_id: user.id,
        type: 'perk_purchase',
        amount: price,
        coin_delta: -price,
        description: `Purchased perk: ${perk.name}`,
        metadata: { perk_id: perk.id }
      })
     
     toast.success('Perk purchased')
     showPurchaseCompleteOverlay()
     await loadWalletData(false)
   } catch (err) {
     console.error('Perk purchase error:', err)
     toast.error(err.message || 'Purchase failed')
   }
 }

  const buyInsurance = async (plan) => {
   try {
     const price = Number(plan.cost || 0)
     const durationHours = Number(plan.duration_hours || 0)
     
     if (price <= 0) {
       toast.error('Invalid insurance price')
       return
     }
     
     if (troll_coins < price) {
       toast.error(`Not enough Troll Coins. Need ${price}, have ${troll_coins}`)
       return
     }
     
      const { error: deductErr } = await deducttroll_coins(price)
     
     if (deductErr) {
       console.error('Coin deduction error:', deductErr)
       toast.error(deductErr.message || 'Failed to deduct coins')
       return
     }
     
     const expiresAt = new Date(Date.now() + Math.max(1, durationHours) * 60 * 60 * 1000).toISOString()
     
     const { error: insertErr } = await supabase.from('user_insurances').insert([{
       user_id: user.id,
       insurance_id: plan.id,
       expires_at: expiresAt,
       is_active: true,
       protection_type: plan.protection_type,
       metadata: {
         insurance_name: plan.name,
         cost: price,
         duration_hours: durationHours,
         protection_type: plan.protection_type,
       }
     }])
     
     if (insertErr) {
       console.error('Insurance purchase error:', insertErr)
       toast.error(insertErr.message || 'Failed to purchase insurance')
       return
     }
     
     // Log the transaction
      await logCoinTransaction({
        user_id: user.id,
        type: 'insurance_purchase',
        amount: price,
        coin_delta: -price,
        description: `Purchased insurance: ${plan.name}`,
        metadata: { insurance_id: plan.id }
      })
     
     toast.success('Insurance purchased')
     showPurchaseCompleteOverlay()
     await loadWalletData(false)
   } catch (err) {
     console.error('Insurance purchase error:', err)
     toast.error(err.message || 'Purchase failed')
   }
 }

  const buyCallMinutes = async (pkg) => {
    if (!user?.id) {
      toast.error('Please log in to purchase minutes');
      return;
    }

    const paidCost = Math.floor(pkg.totalCost / 2);
    const freeCost = pkg.totalCost - paidCost;

    if (troll_coins < paidCost || trollmonds < freeCost) {
      toast.error(
        `Need ${formatCoins(paidCost)} troll_coins and ${formatCoins(freeCost)} trollmonds to purchase.`
      );
      return;
    }

    setLoadingPackage(pkg.id);
    try {
      const paidResult = await deductCoins({
        userId: user.id,
        amount: paidCost,
        type: 'call_minutes',
        coinType: 'troll_coins',
        description: `Purchased ${pkg.minutes} ${pkg.type} call minutes`,
        metadata: { package_id: pkg.id, minutes: pkg.minutes, call_type: pkg.type }
      });

      if (!paidResult?.success) {
        throw new Error(paidResult?.error || 'Failed to deduct troll_coins');
      }

      const freeResult = await deductCoins({
        userId: user.id,
        amount: freeCost,
        type: 'call_minutes',
        coinType: 'trollmonds',
        description: `Purchased ${pkg.minutes} ${pkg.type} call minutes`,
        metadata: { package_id: pkg.id, minutes: pkg.minutes, call_type: pkg.type }
      });

      if (!freeResult?.success) {
        await addCoins({
          userId: user.id,
          amount: paidCost,
          type: 'refund',
          coinType: 'troll_coins',
          description: `Refund for ${pkg.minutes} ${pkg.type} call minutes`,
          metadata: { package_id: pkg.id, minutes: pkg.minutes, call_type: pkg.type }
        });
        throw new Error(freeResult?.error || 'Failed to deduct trollmonds');
      }

      const { error } = await supabase.rpc('add_call_minutes', {
        p_user_id: user.id,
        p_minutes: pkg.minutes,
        p_type: pkg.type
      });

      if (error) {
        await addCoins({
          userId: user.id,
          amount: paidCost,
          type: 'refund',
          coinType: 'troll_coins',
          description: `Refund for ${pkg.minutes} ${pkg.type} call minutes`,
          metadata: { package_id: pkg.id, minutes: pkg.minutes, call_type: pkg.type }
        });
        await addCoins({
          userId: user.id,
          amount: freeCost,
          type: 'refund',
          coinType: 'trollmonds',
          description: `Refund for ${pkg.minutes} ${pkg.type} call minutes`,
          metadata: { package_id: pkg.id, minutes: pkg.minutes, call_type: pkg.type }
        });
        throw error;
      }

      toast.success(`Added ${pkg.minutes} ${pkg.type} minutes!`);
      showPurchaseCompleteOverlay();
      await refreshCoins();
    } catch (err) {
      console.error('Call minutes purchase error:', err);
      toast.error(err?.message || 'Failed to purchase minutes');
    } finally {
      setLoadingPackage(null);
    }
  };

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

  const purchaseCompleteActive =
    showPurchaseComplete ||
    (typeof window !== 'undefined' && Boolean(sessionStorage.getItem(STORE_COMPLETE_KEY)));

  useEffect(() => {
    if (!purchaseCompleteActive || showPurchaseComplete) return;
    setShowPurchaseComplete(true);
  }, [purchaseCompleteActive, showPurchaseComplete]);

  if (purchaseCompleteActive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-purple-400 mx-auto mb-4" />
          <div className="text-xl font-semibold">Your Troll City purchase is complete</div>
        </div>
      </div>
    );
  }

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

  if (!walletMeta && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-4xl mx-auto bg-zinc-900 border border-gray-700 rounded-xl p-8 text-center">
          <Coins className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Wallet Data Not Available</h2>
          <p className="text-gray-400 mb-6">Unable to load your wallet information</p>
          <button
            type="button"
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
        <PayPalScriptProvider
        options={{
          "client-id": import.meta.env.VITE_PAYPAL_CLIENT_ID,
          currency: "USD",
          intent: "capture"
        }}
        onError={(err) => {
          console.error("PayPal Script Provider Error:", err);
          toast.error("PayPal is currently unavailable. Please try again later.");
        }}
        onInit={() => {
          console.log("PayPal Script Provider initialized successfully");
        }}
        onApprove={() => {
          console.log("PayPal Script Provider onApprove callback");
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
              <button type="button" className={`px-3 py-2 rounded ${tab==='coins'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('coins')}>Coin Packages</button>
              <button type="button" className={`px-3 py-2 rounded ${tab==='effects'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('effects')}>Entrance Effects</button>
              <button type="button" className={`px-3 py-2 rounded ${tab==='perks'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('perks')}>Perks</button>
              <button type="button" className={`px-3 py-2 rounded ${tab==='calls'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('calls')}>Call Minutes</button>
              <button type="button" className={`px-3 py-2 rounded ${tab==='insurance'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('insurance')}>Insurance</button>
              {showLiveSnacks && (
                <button type="button" className={`px-3 py-2 rounded ${tab==='live_snacks'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('live_snacks')}>LIVE SNACKS</button>
              )}
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
                  {formatCoins(troll_coins + trollmonds)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Troll Coins + Trollmonds combined</p>
              </div>

              {/* troll_coins */}
              <div className="bg-zinc-900 rounded-lg p-4 border border-yellow-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-yellow-400" />
                <span className="text-sm text-gray-400">Troll Coins</span>
              </div>
                <p className="text-2xl font-bold text-yellow-400">
                  {formatCoins(troll_coins)}
                </p>
                <p className="text-xs text-gray-500 mt-1">withdrawable balance</p>
              </div>

              {/* trollmonds */}
              <div className="bg-zinc-900 rounded-lg p-4 border border-green-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-green-400" />
                <span className="text-sm text-gray-400">Trollmonds</span>
              </div>
                <p className="text-2xl font-bold text-green-400">
                  {formatCoins(trollmonds)}
                </p>
                <p className="text-xs text-gray-500 mt-1">earned from activities</p>
              </div>
            </div>

            {/* Troll Pass (viewer-only) */}
            <div className="mt-6 bg-zinc-900 rounded-xl p-4 border border-green-500/20">
              <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  <span>🎟️</span> Troll Pass
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  PayPal-only bundle: +{trollPassBundle.coins.toLocaleString()} Troll Coins + 30-day Troll Pass perk (chat boost + +5% gift bonus)
                </div>
{trollPassActive ? (
                 <div className="text-xs text-green-400 mt-2">
                   Active until {trollPassExpiresAt ? new Date(trollPassExpiresAt).toLocaleDateString() : '—'}
                 </div>
               ) : (
                 <div className="text-xs text-gray-500 mt-2">Duration: 30 days</div>
               )}
                {trollPassLastPurchasedAt && (
                  <div className="text-xs text-gray-500 mt-1">
                    Last purchased {new Date(trollPassLastPurchasedAt).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="text-right">
                <div className="text-yellow-400 font-bold">+{trollPassBundle.coins.toLocaleString()} Troll Coins</div>
                <div className="text-green-400 font-bold">{formatUSD(trollPassBundle.price)}</div>
                <div className="mt-2">
                  <PayPalButtons
                    style={{ layout: "horizontal" }}
                    fundingSource="paypal"
                    createOrder={async () => {
                      const { data: { session } } = await supabase.auth.getSession();
                      const token = session?.access_token;
                      if (!token) throw new Error('No authentication token available');

                      const res = await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/paypal-create-order`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
                        },
                        body: JSON.stringify({
                          amount: trollPassBundle.price,
                          coins: trollPassBundle.coins,
                          user_id: user.id,
                          package_id: trollPassBundle.id,
                        }),
                      });

                      if (!res.ok) {
                        const txt = await res.text();
                        throw new Error(txt || `Backend error: ${res.status}`);
                      }

                      const created = await res.json();
                      if (!created.orderID) throw new Error("Backend did not return orderID");
                      return created.orderID;
                    }}
                    onApprove={async (data) => {
                      const { data: { session } } = await supabase.auth.getSession();
                      const token = session?.access_token;

                      const captureRes = await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/paypal-capture-order`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                        },
                        body: JSON.stringify({ orderId: data.orderID }),
                      });

                      const captureJson = await captureRes.json().catch(() => ({}));
                      if (captureRes.ok) {
                        toast.success(`Troll Pass activated! +${trollPassBundle.coins.toLocaleString()} Troll Coins added.`);
                        await loadWalletData();
                        if (refreshProfile) await refreshProfile();
                      } else {
                        toast.error(captureJson?.error || "Payment completed, but activation failed.");
                      }
                    }}
                    onError={(err) => {
                      console.error("PayPal error:", err);
                      toast.error("PayPal checkout error.");
                    }}
                  />
                </div>
              </div>
            </div>
            </div>

            {false && (
            <div className="mt-6 bg-zinc-900 rounded-xl p-4 border border-green-500/20">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>🎟️</span> Troll Pass
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    One-time monthly purchase (no auto-renew). Slight chat boost + +5% gift value bonus.
                  </div>
                  {trollPassActive ? (
                    <div className="text-xs text-green-400 mt-2">
                      Active until {trollPassExpiresAt ? new Date(trollPassExpiresAt).toLocaleDateString() : '—'}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 mt-2">Duration: 30 days</div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-yellow-400 font-bold">1,500 troll_coins</div>
                  <button
                    type="button"
                    onClick={buyTrollPass}
                    disabled={!isViewerOnly || trollPassActive || troll_coins < 1500}
                    className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded font-semibold"
                  >
                    {trollPassActive ? 'Active' : (isViewerOnly ? 'Purchase' : 'Viewer only')}
                  </button>
                </div>
              </div>
              {!isViewerOnly && (
                <div className="mt-3 text-xs text-gray-500">
                  Locked: Troll Pass is for viewers only (does not grant streaming or guest access).
                </div>
              )}
            </div>
            )}
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
                      <div className="mt-4">
                        {!import.meta.env.VITE_PAYPAL_CLIENT_ID && (
                          <div className="bg-red-600 text-white p-2 rounded text-center text-sm mb-2">
                            PayPal client ID not configured. Please check environment variables.
                          </div>
                        )}
                        <PayPalButtons
                          style={{ layout: "horizontal" }}
                          fundingSource="paypal"
                          createOrder={async () => {
                            try {
                              return await handleBuy(pkg); // MUST return orderID
                            } catch (err) {
                              console.error("❌ PayPal createOrder error:", err);
                              toast.error("Unable to start PayPal checkout. Please try again.");
                              throw err;
                            }
                          }}
                          onApprove={async (data) => {
                            try {
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
                                  body: JSON.stringify({ orderId: data.orderID }),
                                }
                              );

                              const captureJson = await captureRes.json();
                              console.log("💰 Capture result:", captureJson);

                              if (captureRes.ok) {
                                toast.success(`+${pkg.coins.toLocaleString()} Troll Coins added!`);
                                loadWalletData(false);
                              } else {
                                toast.error("Payment completed, but coin update failed.");
                              }
                            } catch (err) {
                              console.error("❌ PayPal onApprove error:", err);
                              toast.error("Payment processing failed. Please contact support.");
                            }
                          }}
                          onError={(err) => {
                            console.error("❌ PayPal error:", err);
                            toast.error("PayPal checkout error. Please try again later.");
                          }}
                          createBillingAgreement={async () => {
                            // This is for subscriptions, but we'll provide it for completeness
                            throw new Error("Subscriptions not supported");
                          }}
                        />
                        <div className="mt-2 text-xs text-gray-400 text-center">
                          Secure PayPal checkout
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {tab === 'effects' && (
              <>
                <h2 className="text-xl font-bold mb-4">Entrance Effects</h2>
                {effectsNote && (
                  <div className="text-xs text-yellow-300 mb-3">{effectsNote}</div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {effects.map((e) => (
                    <div key={e.id} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
                      <div className="font-semibold mb-2">{e.name}</div>
                      <div className="text-sm text-gray-400 mb-3">{e.description}</div>
                      <div className="flex items-center justify-between">
                        <div className="text-yellow-400 font-bold">{(e.price_troll_coins || e.coin_cost || 0).toLocaleString()} Troll Coins</div>
                        <button type="button" onClick={() => buyEffect(e)} className="px-3 py-2 bg-purple-600 rounded">Purchase</button>
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
                {perksNote && (
                  <div className="text-xs text-yellow-300 mb-3">{perksNote}</div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {perks.map((p) => (
                    <div key={p.id} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
                      <div className="font-semibold mb-2">{p.name}</div>
                      <div className="text-sm text-gray-400 mb-3">{p.description}</div>
                      <div className="flex items-center justify-between">
                        <div className="text-yellow-400 font-bold">{getPerkPrice(p).toLocaleString()} Troll Coins</div>
                        <button type="button" onClick={() => buyPerk(p)} className="px-3 py-2 bg-purple-600 rounded">Purchase</button>
                      </div>
                    </div>
                  ))}
                  {perks.length === 0 && <div className="text-gray-400">No perks available</div>}
                </div>
              </>
            )}

            {tab === 'calls' && (
              <>
                <h2 className="text-xl font-bold mb-4">Call Minutes</h2>
                <p className="text-sm text-gray-400 mb-6">
                  Call minutes are split 50/50 between troll_coins and trollmonds.
                </p>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-purple-300 mb-3">Audio Call Packages</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {callPackages.audio.map((pkg) => {
                        const paidCost = Math.floor(pkg.totalCost / 2);
                        const freeCost = pkg.totalCost - paidCost;
                        return (
                          <div key={pkg.id} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
                            <div className="font-semibold mb-1">{pkg.name}</div>
                            <div className="text-sm text-gray-400 mb-3">{pkg.minutes.toLocaleString()} minutes</div>
                            <div className="text-sm text-gray-300">
                              {formatCoins(paidCost)} troll_coins + {formatCoins(freeCost)} trollmonds
                            </div>
                            <button
                              type="button"
                              onClick={() => buyCallMinutes({ ...pkg, type: 'audio' })}
                              disabled={loadingPackage === pkg.id}
                              className="mt-4 w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded font-semibold"
                            >
                              {loadingPackage === pkg.id ? 'Processing...' : 'Purchase'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-purple-300 mb-3">Video Call Packages</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {callPackages.video.map((pkg) => {
                        const paidCost = Math.floor(pkg.totalCost / 2);
                        const freeCost = pkg.totalCost - paidCost;
                        return (
                          <div key={pkg.id} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
                            <div className="font-semibold mb-1">{pkg.name}</div>
                            <div className="text-sm text-gray-400 mb-3">{pkg.minutes.toLocaleString()} minutes</div>
                            <div className="text-sm text-gray-300">
                              {formatCoins(paidCost)} troll_coins + {formatCoins(freeCost)} trollmonds
                            </div>
                            <button
                              type="button"
                              onClick={() => buyCallMinutes({ ...pkg, type: 'video' })}
                              disabled={loadingPackage === pkg.id}
                              className="mt-4 w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded font-semibold"
                            >
                              {loadingPackage === pkg.id ? 'Processing...' : 'Purchase'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab === 'insurance' && (
              <>
                <h2 className="text-xl font-bold mb-4">Insurance Plans</h2>
                {insuranceNote && (
                  <div className="text-xs text-yellow-300 mb-3">{insuranceNote}</div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plans.map((p) => (
                    <div key={p.id} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
                      <div className="font-semibold mb-2">{p.name}</div>
                      <div className="text-sm text-gray-400 mb-2">{p.protection_type} protection</div>
                      <div className="text-xs text-gray-500 mb-3">{p.description}</div>
                      <div className="text-xs text-gray-500 mb-3">Duration: {p.duration_hours} hours</div>
                      <div className="flex items-center justify-between">
                        <div className="text-yellow-400 font-bold">{(p.cost || 0).toLocaleString()} Troll Coins</div>
                        <button type="button" onClick={() => buyInsurance(p)} className="px-3 py-2 bg-purple-600 rounded">Purchase</button>
                      </div>
                    </div>
                  ))}
                  {plans.length === 0 && <div className="text-gray-400">No insurance plans available</div>}
                </div>
              </>
            )}

            {tab === 'live_snacks' && showLiveSnacks && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">LIVE SNACKS</h2>
                  <div className="text-sm text-gray-400">
                    Stream momentum: <span className="text-green-400 font-semibold">{Math.round(momentum ?? 0)}%</span>
                  </div>
                </div>

                <div className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20 mb-4">
                  <div className="h-2 rounded bg-zinc-800 overflow-hidden">
                    <div
                      className="h-2 bg-gradient-to-r from-red-500 via-yellow-400 to-green-400"
                      style={{ width: `${Math.max(0, Math.min(100, momentum ?? 0))}%` }}
                    />
                  </div>
                  {(momentum ?? 100) <= 40 && (
                    <div className="mt-3 text-sm text-yellow-300">
                      Crowd energy is low — a snack can bring the room back to life.
                    </div>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    Momentum decays every 10 minutes without gifting. Snacks boost momentum but don’t affect payouts or gambling.
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'small', name: 'Small Snack', desc: 'Small momentum boost', icon: '🍿', cost: 50 },
                    { key: 'medium', name: 'Medium Snack', desc: 'Medium momentum boost', icon: '🍔', cost: 120 },
                    { key: 'large', name: 'Large Snack', desc: 'Full momentum restore', icon: '🍕', cost: 250 },
                    { key: 'mystery', name: 'Mystery Snack', desc: 'Random fun effect + boost', icon: '🎁', cost: 150 },
                  ].map((s) => (
                    <div key={s.key} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold flex items-center gap-2">
                          <span className="text-2xl">{s.icon}</span> {s.name}
                        </div>
                        <div className="text-yellow-400 font-bold">{s.cost} Troll Coins</div>
                      </div>
                      <div className="text-sm text-gray-400 mb-3">{s.desc}</div>
                      <button
                        type="button"
                        onClick={() => buySnack(s.key)}
                        disabled={snackLoading === s.key || !canBuySnack(s.key)}
                        className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded font-semibold"
                      >
                        {snackLoading === s.key ? 'Activating…' : (canBuySnack(s.key) ? 'Purchase' : 'Cooldown')}
                      </button>
                      <div className="mt-2 text-xs text-gray-500">Viewers boost more. Broadcasters pay more.</div>
                    </div>
                  ))}
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
  );
}
