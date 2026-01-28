import { useState, useEffect, useCallback } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useCoins } from '@/lib/hooks/useCoins';
import { useBank as useBankHook } from '../lib/hooks/useBank';
// import { toast } from 'sonner';
import { Coins, ShoppingCart, CreditCard, Landmark, History, CheckCircle, AlertCircle } from 'lucide-react';
import { formatCoins } from '../lib/coinMath';
import { deductCoins } from '@/lib/coinTransactions';
import { useLiveContextStore } from '../lib/liveContextStore';
import { useCheckOfficerOnboarding } from '@/hooks/useCheckOfficerOnboarding';

import CashAppPaymentModal from '@/components/broadcast/CashAppPaymentModal';
import TrollPassBanner from '@/components/ui/TrollPassBanner';
import { paymentProviders } from '../lib/payments';
import { toast } from 'sonner';

const coinPackages = [
  { id: 'pkg-1000-promo', coins: 1000, price: "$0.10", emoji: "💎", popular: true, promo: true, expiresAt: new Date('2026-01-28T00:51:27Z').getTime() },
  { id: 1, coins: 300, price: "$1.99", emoji: "💰", popular: true },
  { id: 2, coins: 500, price: "$4.99", emoji: "💰", popular: true },
  { id: 3, coins: 1000, price: "$9.99", emoji: "💎" },
  { id: 4, coins: 2500, price: "$19.99", emoji: "👑" },
  { id: 5, coins: 5000, price: "$39.99", emoji: "🚀" },
  { id: 6, coins: 10000, price: "$69.99", emoji: "⭐", bestValue: true },
  { id: 7, coins: 13000, price: "$89.99", emoji: "🌟" },
  { id: 8, coins: 20000, price: "$129.00", emoji: "🏆" },
].filter(p => !p.expiresAt || Date.now() < p.expiresAt);

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
  { id: 'perk_rgb_username', name: 'RGB Username (24h)', description: 'Rainbow glow visible to everyone', cost: 450, duration_minutes: 24 * 60, perk_type: 'cosmetic' },
  { id: 'perk_disappearing_chats', name: 'Disappearing Chats (30m)', description: 'Chats auto-hide after 10s for 30 minutes', cost: 190, duration_minutes: 30, perk_type: 'chat' },
  { id: 'perk_ghost_mode', name: 'Ghost Mode (30m)', description: 'View streams in stealth without status indicators', cost: 560, duration_minutes: 30, perk_type: 'privacy' },
  { id: 'perk_message_admin', name: 'Message Admin (Officer Only)', description: 'Unlock DM to Admin', cost: 230, duration_minutes: 24 * 60, perk_type: 'access', role_required: 'officer' },
  { id: 'perk_glowing_username', name: 'Glowing Username (1h)', description: 'Neon glow in all chats & gift animations', cost: 5750, duration_minutes: 60, perk_type: 'cosmetic' },
  { id: 'perk_slowmo_chat', name: 'Slow-Motion Chat Control (5h)', description: 'Activate chat slow-mode in any live stream', cost: 3600, duration_minutes: 5 * 60, perk_type: 'control' },
  { id: 'perk_troll_alarm', name: 'Troll Alarm Arrival (100h)', description: 'Sound + flash announces your arrival', cost: 3000, duration_minutes: 100 * 60, perk_type: 'entrance' },
  { id: 'perk_ban_shield', name: 'Ban Shield (2h)', description: 'Immunity from kick, mute, or ban for 2 hours', cost: 1660, duration_minutes: 2 * 60, perk_type: 'protection' },
  { id: 'perk_double_xp', name: 'Double XP Mode (1h)', description: 'Earn 2x XP for the next hour', cost: 780, duration_minutes: 60, perk_type: 'boost' },
  { id: 'perk_golden_banner', name: 'Golden Flex Banner (100h)', description: 'Golden crown banner on all your messages', cost: 3390, duration_minutes: 100 * 60, perk_type: 'cosmetic' },
  { id: 'perk_troll_spell', name: 'Troll Spell (1h)', description: "Randomly change another user's username style & emoji for 1 hour", cost: 2240, duration_minutes: 60, perk_type: 'fun' },
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
  const { troll_coins, refreshCoins } = useCoins();
  const { checkOnboarding } = useCheckOfficerOnboarding();
  const { loan: activeLoan, ledger, refresh: refreshBank, applyForLoan, tiers } = useBankHook(); // useBank hook

  const STORE_TAB_KEY = 'tc-store-active-tab';
  const STORE_COMPLETE_KEY = 'tc-store-show-complete';
  const [loading, setLoading] = useState(true);
  const [loadingPackage, setLoadingPackage] = useState(null);
  const [tab, setTab] = useState('coins');
  
  // Bank State
  const [bankBalance] = useState(null);
  const [applying, setApplying] = useState(false);
  const [requestedAmount, setRequestedAmount] = useState(100);
  const [eligibility, setEligibility] = useState({
    canApply: false,
    reasons: [],
    maxAmount: 0
  });

  // Calculate Loan Eligibility
  useEffect(() => {
    // DEBUG: Check if coin_packages table is accessible
    const debugLoadPackages = async () => {
      const { data, error } = await supabase
        .from("coin_packages")
        .select("*");

      console.log("coin packages data:", data);
      console.log("coin packages error:", error);

      if (error) throw error;
    };
    debugLoadPackages();

    if (!user || !tiers.length) return;

    const reasons = [];
    let maxAmount = 0;
    
    // 1. Check active loan
    if (activeLoan) {
      reasons.push('You already have an active loan.');
    }

    // 2. Calculate Max Amount based on Tenure
    const accountAgeDays = Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24));
    
    // Find highest tier matching tenure
    const eligibleTier = tiers
      .filter(t => t.min_tenure_days <= accountAgeDays)
      .sort((a, b) => b.min_tenure_days - a.min_tenure_days)[0];

    if (eligibleTier) {
      maxAmount = eligibleTier.max_loan_coins;
    } else {
      reasons.push('Account too new for loan eligibility.');
    }

    setEligibility({
      canApply: reasons.length === 0 && maxAmount > 0,
      reasons,
      maxAmount
    });
  }, [user, activeLoan, tiers]);

  const [selectedPackage, setSelectedPackage] = useState(null);
  const [cashAppModalOpen, setCashAppModalOpen] = useState(false);
  // Default to CashApp as the payment provider (PayPal temporarily disabled)
  const [selectedProviderId, setSelectedProviderId] = useState('cashapp');
  const [loadingPay, setLoadingPay] = useState(false);
  const [durationMultiplier, setDurationMultiplier] = useState(1);
  const [effects, setEffects] = useState([]);
  const [perks, setPerks] = useState([]);
  const [plans, setPlans] = useState([]);
  const [broadcastThemes, setBroadcastThemes] = useState([]);
  const [ownedThemeIds, setOwnedThemeIds] = useState(new Set());
  const [themesNote, setThemesNote] = useState(null);
  const [themePurchasing, setThemePurchasing] = useState(null);
  // const [callSounds, setCallSounds] = useState([]);
  // const [ownedCallSoundIds, setOwnedCallSoundIds] = useState(new Set());
  // const [activeCallSounds, setActiveCallSounds] = useState({});
  // const [callSoundPurchasing, setCallSoundPurchasing] = useState(null);
  const [streamerEntitlements, setStreamerEntitlements] = useState(null);
  const [effectsNote, setEffectsNote] = useState(null);
  const [perksNote, setPerksNote] = useState(null);
  const [insuranceNote, setInsuranceNote] = useState(null);
  const activeStreamId = useLiveContextStore((s) => s.activeStreamId);
  const [liveStreamIsLive, setLiveStreamIsLive] = useState(false);
  const [snackLoading, setSnackLoading] = useState(null);
  const [lastSnackAt, setLastSnackAt] = useState({});
  const [showPurchaseComplete, setShowPurchaseComplete] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(sessionStorage.getItem('tc-store-show-complete'));
  });

  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true;
  const isSecretary = profile?.role === 'secretary' || profile?.troll_role === 'secretary';
  const isOfficer = profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer' || profile?.is_lead_officer === true || profile?.troll_role === 'troll_officer' || profile?.troll_role === 'lead_troll_officer';

  const formatCountdown = (targetDate) => {
    if (!targetDate) return null;
    const diff = new Date(targetDate).getTime() - Date.now();
    if (diff <= 0) return '0h';
    const totalMinutes = Math.floor(diff / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  };

  const getEligibility = (theme) => {
    const now = Date.now();
    const startsAt = theme?.starts_at ? new Date(theme.starts_at).getTime() : null;
    const endsAt = theme?.ends_at ? new Date(theme.ends_at).getTime() : null;
    const limitedActive = !theme?.is_limited || ((startsAt ? now >= startsAt : true) && (endsAt ? now <= endsAt : true));
    const seasonalState = theme?.is_limited
      ? startsAt && now < startsAt
        ? `Starts in ${formatCountdown(theme.starts_at)}`
        : endsAt && now > endsAt
          ? 'Season ended'
          : endsAt
            ? `Ends in ${formatCountdown(theme.ends_at)}`
            : null
      : null;

    const entitlements = streamerEntitlements || {};
    const streamLevel = entitlements.streamer_level ?? profile?.level ?? 0;
    const followersCount = entitlements.followers_count ?? 0;
    const hoursStreamed = entitlements.total_hours_streamed ?? 0;
    const minLevel = theme?.min_stream_level ?? null;
    const minFollowers = theme?.min_followers ?? null;
    const minHours = theme?.min_total_hours_streamed ?? null;

    const requiresStreamer = Boolean(theme?.is_streamer_exclusive || minLevel || minFollowers || minHours);
    const meetsStreamer =
      (!minLevel || streamLevel >= minLevel) &&
      (!minFollowers || followersCount >= minFollowers) &&
      (!minHours || hoursStreamed >= minHours);

    return {
      limitedActive,
      seasonalState,
      requiresStreamer,
      meetsStreamer,
      isEligible: limitedActive && (!requiresStreamer || meetsStreamer),
      minLevel,
      minFollowers,
      minHours,
    };
  };

  /*
  const getRarityFrame = (rarity) => {
    switch (String(rarity || '').toLowerCase()) {
      case 'rare':
        return 'border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.25)]';
      case 'epic':
        return 'border-pink-500/40 shadow-[0_0_24px_rgba(236,72,153,0.3)]';
      case 'legendary':
        return 'border-yellow-400/50 shadow-[0_0_28px_rgba(250,204,21,0.35)]';
      default:
        return 'border-white/10';
    }
  };
  */

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

  const loadWalletData = useCallback(async (showLoading = true) => {
    console.log('?? Loading wallet data for user:', user?.id);
    try {
      if (showLoading) setLoading(true);

      await refreshCoins();

      const [effRes, perkRes, planRes, themeRes, themeOwnedRes, entitlementsRes] = await Promise.all([
        supabase.from('entrance_effects').select('*').order('created_at', { ascending: false }),
        supabase.from('perks').select('*').order('created_at', { ascending: false }),
        supabase.from('insurance_options').select('*').order('created_at', { ascending: false }),
        supabase.from('broadcast_background_themes').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
        user?.id
          ? supabase.from('user_broadcast_theme_purchases').select('theme_id').eq('user_id', user.id)
          : Promise.resolve({ data: [] }),
        user?.id
          ? supabase.from('user_streamer_entitlements').select('*').eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        // supabase.from('call_sound_catalog').select('*').eq('is_active', true).order('sound_type', { ascending: true }),
        // user?.id
        //   ? supabase.from('user_call_sounds').select('sound_id,is_active,call_sound_catalog(sound_type)').eq('user_id', user.id)
        //   : Promise.resolve({ data: [] })
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

      const filteredPlans = (loadedPlans || []).filter((p) => p.protection_type !== 'bankrupt');
      if (filteredPlans.length !== (loadedPlans || []).length) {
        setInsuranceNote((prev) => prev || 'Bankrupt insurance retired with Troll Wheel removal.');
      }
      setPlans(filteredPlans);

      const loadedThemes = applyCatalogData(
        themeRes,
        [],
        setBroadcastThemes,
        setThemesNote,
        'broadcast themes',
      );

      setOwnedThemeIds(new Set((themeOwnedRes?.data || []).map((row) => row.theme_id)));
      setStreamerEntitlements(entitlementsRes?.data || null);
      // setCallSounds(callSoundRes?.data || []);
      // const ownedSoundIds = new Set((callSoundOwnedRes?.data || []).map((row) => row.sound_id));
      // setOwnedCallSoundIds(ownedSoundIds);
      // const activeMap = {};
      // (callSoundOwnedRes?.data || []).forEach((row) => {
      //   if (row.is_active && row.call_sound_catalog?.sound_type) {
      //     activeMap[row.call_sound_catalog.sound_type] = row.sound_id;
      //   }
      // });
      // setActiveCallSounds(activeMap);

      console.log('Effects, perks, plans, themes loaded:', { effects: loadedEffects.length, perks: loadedPerks.length, plans: loadedPlans.length, themes: loadedThemes.length });

    } catch (err) {
      console.error('? Error loading wallet data:', err);
      toast.error('Failed to load wallet data');
    } finally {
      if (showLoading) setLoading(false);
      console.log('?? Wallet data loading complete');
    }
  }, [user?.id, refreshCoins]);

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    // Auto-scroll to top on page load
    window.scrollTo(0, 0);

    loadWalletData(true);
  }, [user, navigate, loadWalletData]);

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
    if (tab === 'live_snacks' && !showLiveSnacks) setTab('effects');
  }, [tab, showLiveSnacks]);

  useEffect(() => {
    sessionStorage.setItem(STORE_TAB_KEY, tab);
  }, [tab]);

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


  const formatDeductErrorMessage = (error) =>
    typeof error === 'string'
      ? error
      : error?.message || 'Failed to deduct coins'

  const buyEffect = async (effect) => {
   // Check officer onboarding first
   const canProceed = await checkOnboarding();
   if (!canProceed) return;

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
     
      const { error: deductErr } = await deductCoins({
        userId: user.id,
        amount: price,
        type: 'entrance_effect',
        description: `Purchased entrance effect: ${effect.name}`,
        metadata: { effect_id: effect.id },
        supabaseClient: supabase,
      })
    
    if (deductErr) {
      console.error('Coin deduction error:', deductErr)
      toast.error(formatDeductErrorMessage(deductErr))
      return
    }
    
    await refreshCoins()

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
     
      toast.success('Entrance effect purchased')
     showPurchaseCompleteOverlay()
     await loadWalletData(false)
   } catch (err) {
     console.error('Effect purchase error:', err)
     toast.error(err.message || 'Purchase failed')
   }
 }

  const buyPerk = async (perk) => {
   // Check officer onboarding first
   const canProceed = await checkOnboarding();
   if (!canProceed) return;

   if (perk.role_required === 'officer' && !(isOfficer || isAdmin || isSecretary)) {
     toast.error('This perk is limited to officers');
     return;
   }

   try {
     const basePrice = getPerkPrice(perk)
     const price = basePrice * durationMultiplier
     const baseDuration = Number(perk.duration_minutes || 0)
     const durationMinutes = baseDuration * durationMultiplier
     
     if (price <= 0) {
       toast.error('Invalid perk price')
       return
     }
     
     if (troll_coins < price) {
       toast.error(`Not enough Troll Coins. Need ${price}, have ${troll_coins}`)
       return
     }
     
     const expiresAt = new Date(Date.now() + Math.max(1, durationMinutes) * 60 * 1000).toISOString()
     
    const { error: deductErr } = await deductCoins({
      userId: user.id,
      amount: price,
      type: 'perk_purchase',
      description: `Purchased perk: ${perk.name} (${durationMultiplier}x duration)`,
      metadata: { perk_id: perk.id, multiplier: durationMultiplier },
      supabaseClient: supabase,
    })
    
    if (deductErr) {
      console.error('Coin deduction error:', deductErr)
      toast.error(formatDeductErrorMessage(deductErr))
      return
    }
    
    await refreshCoins()

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

     if (perk.id === 'perk_rgb_username') {
       const { error: profileUpdateErr } = await supabase
         .from('user_profiles')
         .update({ rgb_username_expires_at: expiresAt })
         .eq('id', user.id);
       
       if (profileUpdateErr) {
         console.error('Failed to update RGB status:', profileUpdateErr);
       } else {
         await refreshProfile();
       }
     }
     
      toast.success('Perk purchased')
     showPurchaseCompleteOverlay()
     await loadWalletData(false)
   } catch (err) {
     console.error('Perk purchase error:', err)
     toast.error(err.message || 'Purchase failed')
   }
 }

  const buyInsurance = async (plan) => {
    // Check officer onboarding first
    const canProceed = await checkOnboarding();
    if (!canProceed) return;

    try {
      const basePrice = Number(plan.cost || 0);
      const price = basePrice * durationMultiplier;
      const baseDuration = Number(plan.duration_hours || 0);
      const durationHours = baseDuration * durationMultiplier;
      
      if (price <= 0) {
        toast.error('Invalid insurance price')
        return
      }

      if (troll_coins < price) {
        toast.error(`Not enough Troll Coins. Need ${price}, have ${troll_coins}`)
        return
      }
      
      const { error: deductErr } = await deductCoins({
        userId: user.id,
        amount: price,
        type: 'insurance_purchase',
        description: `Purchased insurance: ${plan.name} (${durationMultiplier}x duration)`,
        metadata: { insurance_id: plan.id, multiplier: durationMultiplier },
        supabaseClient: supabase,
      })
      
      if (deductErr) {
        console.error('Coin deduction error:', deductErr)
        toast.error(formatDeductErrorMessage(deductErr))
        return
      }
      
      await refreshCoins()
 
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
          multiplier: durationMultiplier,
        }
      }])
     
     if (insertErr) {
       console.error('Insurance purchase error:', insertErr)
       toast.error(insertErr.message || 'Failed to purchase insurance')
       return
     }
     
      toast.success('Insurance purchased')
     showPurchaseCompleteOverlay()
     await loadWalletData(false)
   } catch (err) {
     console.error('Insurance purchase error:', err)
     toast.error(err.message || 'Purchase failed')
   }
 }

  const buyBroadcastTheme = async (theme) => {
    const canProceed = await checkOnboarding();
    if (!canProceed) return;
    if (!user?.id) {
      toast.error('Please log in to purchase a theme');
      return;
    }

    if (!theme?.id) {
      toast.error('Invalid theme');
      return;
    }

    if (ownedThemeIds.has(theme.id)) {
      toast.info('You already own this theme');
      return;
    }

    const eligibility = getEligibility(theme);
    if (!eligibility.isEligible) {
      toast.error('This theme is locked.');
      return;
    }

    setThemePurchasing(theme.id);
          try {
            const { data, error } = await supabase.rpc('purchase_broadcast_theme', {
              p_user_id: user.id,
              p_theme_id: theme.id,
              p_set_active: false,
            });
            if (error || data?.success === false) {
        throw new Error(data?.error || error?.message || 'Theme purchase failed');
      }

      setOwnedThemeIds((prev) => new Set([...Array.from(prev), theme.id]));
      await refreshCoins();
      if (refreshProfile) {
        await refreshProfile();
      }
      toast.success('Theme purchased');
      showPurchaseCompleteOverlay();
    } catch (err) {
      console.error('Theme purchase error:', err);
      toast.error(err?.message || 'Failed to purchase theme');
    } finally {
      setThemePurchasing(null);
    }
  };

  /*
  const buyCallSound = async (sound) => {
    const canProceed = await checkOnboarding();
    if (!canProceed) return;
    if (!user?.id) {
      toast.error('Please log in to purchase a call sound');
      return;
    }
    if (!sound?.id) {
      toast.error('Invalid call sound');
      return;
    }
    if (ownedCallSoundIds.has(sound.id)) {
      toast.info('You already own this sound');
      return;
    }

    setCallSoundPurchasing(sound.id);
    try {
      const { data, error } = await supabase.rpc('purchase_call_sound', {
        p_sound_id: sound.id,
        p_set_active: false,
      });
      if (error || data?.success === false) {
        throw new Error(data?.error || error?.message || 'Call sound purchase failed');
      }
      setOwnedCallSoundIds((prev) => new Set([...Array.from(prev), sound.id]));
      await refreshCoins();
      if (refreshProfile) {
        await refreshProfile();
      }
      toast.success('Call sound purchased');
    } catch (err) {
      console.error('Call sound purchase error:', err);
      toast.error(err?.message || 'Failed to purchase call sound');
    } finally {
      setCallSoundPurchasing(null);
    }
  };
  */

  const buyCallMinutes = async (pkg) => {
    // Check officer onboarding first
    const canProceed = await checkOnboarding();
    if (!canProceed) return;

    if (!user?.id) {
      toast.error('Please log in to purchase minutes');
      return;
    }

    const totalCost = Number(pkg.totalCost || 0);
    if (!Number.isFinite(totalCost) || totalCost <= 0) {
      toast.error('Invalid package cost');
      return;
    }

    if (troll_coins < totalCost) {
      toast.error(`Need ${formatCoins(totalCost)} troll_coins to purchase this package.`);
      return;
    }

    setLoadingPackage(pkg.id);
    try {
      const deduction = await deductCoins({
        userId: user.id,
        amount: totalCost,
        type: 'call_minutes',
        description: `Purchased ${pkg.minutes} ${pkg.type} call minutes`,
        metadata: { package_id: pkg.id, minutes: pkg.minutes, call_type: pkg.type },
        supabaseClient: supabase,
      });

      if (!deduction?.success) {
        throw new Error(deduction?.error || 'Failed to deduct troll_coins');
      }

      const { error } = await supabase.rpc('add_call_minutes', {
        p_user_id: user.id,
        p_minutes: pkg.minutes,
        p_type: pkg.type
      });

      if (error) {
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

  const createPayPalOrder = async (pkg) => {
    try {
      setLoadingPay(true);
      const { data, error } = await supabase.functions.invoke('paypal-create-order', {
        body: {
          user_id: user.id,
          package_id: pkg.id,
          coins: pkg.coins,
          amount: typeof pkg.price === 'string' ? pkg.price.replace('$', '') : pkg.price
        }
      });

      if (error) throw error;
      if (!data?.orderId) throw new Error('Failed to create order');
      
      return data.orderId;
    } catch (err) {
      console.error('Create Order Error:', err);
      toast.error('Failed to initialize PayPal');
      setLoadingPay(false);
      throw err;
    }
  };

  const onPayPalApprove = async (data, actions, pkg) => {
    try {
      const { orderID } = data;
      const { data: result, error } = await supabase.functions.invoke('paypal-complete-order', {
        body: {
          orderId: orderID,
          userId: user.id,
          packageId: pkg.id
        }
      });

      console.log("paypal-complete-order data:", result);
      console.log("paypal-complete-order error:", error);

      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'Payment verification failed');

      toast.success(`Successfully purchased ${pkg.coins} coins!`);
      await refreshCoins();
      refreshBank(); // Update loan status if any
      showPurchaseCompleteOverlay();

    } catch (err) {
      console.error('Capture Error (full):', err);
      toast.error(err.message || 'Payment failed');
    } finally {
      setLoadingPay(false);
    }
  };

  const handleApplyLoan = async () => {
    if (!requestedAmount || requestedAmount < 100) {
      toast.error('Minimum loan amount is 100 coins');
      return;
    }
    setApplying(true);
    try {
      const result = await applyForLoan(requestedAmount);
      if (result.success) {
        toast.success('Loan approved! Coins added to your wallet.');
        setRequestedAmount(100);
        await refreshCoins();
        refreshBank();
      } else {
        toast.error(result.error || 'Loan application failed');
      }
    } catch (err) {
      console.error('Loan application error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setApplying(false);
      // Ensure we don't get stuck in a global loading state if something weird happens
      setLoading(false);
    }
  };

  return (
      showPurchaseComplete ? (
        <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center p-6">
          <div className="text-center">
            <div className="text-xl font-semibold">Order submitted</div>
          </div>
        </div>
      ) : loading ? (
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
      ) : (
        <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6 overflow-x-hidden">
        <div className="max-w-6xl mx-auto space-y-6 w-full">
          {/* Bank Info Banner */}
          <div className="bg-blue-500/10 border border-blue-500/50 rounded-xl p-4 flex items-start gap-3">
            <Landmark className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-blue-200 text-sm font-medium space-y-1">
              <p>
                Need more coins? Visit the <button onClick={() => navigate('/bank')} className="underline hover:text-white">Troll Bank</button> to apply for a loan.
              </p>
            </div>
          </div>

          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Coins className="w-8 h-8 text-purple-400" />
              Troll City Store
            </h1>
            <div className="flex gap-2 hidden md:flex">
              <button type="button" className={`px-3 py-2 rounded ${tab==='coins'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('coins')}>Coins</button>
              <button type="button" className={`px-3 py-2 rounded ${tab==='bank'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('bank')}>Bank</button>
              <button type="button" className={`px-3 py-2 rounded ${tab==='effects'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('effects')}>Entrance Effects</button>
              <button type="button" className={`px-3 py-2 rounded ${tab==='perks'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('perks')}>Perks</button>
              <button type="button" className={`px-3 py-2 rounded ${tab==='calls'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('calls')}>Call Minutes</button>
              <button type="button" className={`px-3 py-2 rounded ${tab==='insurance'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('insurance')}>Insurance</button>
              <button type="button" className={`px-3 py-2 rounded ${tab==='broadcast_themes'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('broadcast_themes')}>Broadcast Themes</button>
              {showLiveSnacks && (
                <button type="button" className={`px-3 py-2 rounded ${tab==='live_snacks'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('live_snacks')}>LIVE SNACKS</button>
              )}
            </div>
            <div className="md:hidden w-full">
              <select
                value={tab}
                onChange={(e) => setTab(e.target.value)}
                className="w-full bg-zinc-900 text-white border border-purple-500/30 rounded-lg p-2 text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="coins">Coins</option>
                <option value="bank">Troll Bank & Loans</option>
                <option value="effects">Entrance Effects</option>
                <option value="perks">Perks</option>
                <option value="calls">Call Minutes</option>
                <option value="insurance">Insurance</option>
                <option value="broadcast_themes">Broadcast Themes</option>
                {showLiveSnacks && <option value="live_snacks">LIVE SNACKS</option>}
              </select>
            </div>
          </div>

          {/* Wallet Summary */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-6 border border-purple-500/30 shadow-lg">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-purple-400" />
              Your Wallet Balance
            </h2>

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-zinc-900 rounded-lg p-4 border border-yellow-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-gray-400">Troll Coins</span>
                </div>
                <p className="text-2xl font-bold text-yellow-400">
                  {formatCoins(troll_coins)}
                </p>
                <div className="flex gap-2 mt-2">
                    <button
                        onClick={() => setTab('bank')}
                        className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white"
                    >
                        Request Loan
                    </button>
                </div>
              </div>
            </div>
          </div>

          {/* Content Areas */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-6 border border-purple-500/30 shadow-lg">
            
            {/* Bank Tab */}
            {tab === 'bank' && (
              <div className="space-y-8 animate-fadeIn">
                 {/* Bank Header Stats */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-black/30 border border-white/5 rounded-xl p-4 relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-gray-400 text-sm font-medium mb-1">Bank Reserves</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-emerald-400">
                                {bankBalance !== null ? bankBalance.toLocaleString() : '---'}
                                </span>
                                <span className="text-xs text-emerald-400/70">coins</span>
                            </div>
                            <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-500">
                                <CheckCircle className="w-3 h-3" />
                                <span>Verified Holdings</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-black/30 border border-white/5 rounded-xl p-4 relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-gray-400 text-sm font-medium mb-1">Your Active Loan</p>
                            {activeLoan ? (
                                <div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-red-400">{activeLoan.balance.toLocaleString()}</span>
                                    <span className="text-xs text-red-400/70">due</span>
                                </div>
                                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-200">
                                    Auto-repayment active (50% of purchases)
                                </div>
                                </div>
                            ) : (
                                <div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-green-400">None</span>
                                </div>
                                <p className="mt-1 text-xs text-gray-400">You are debt free!</p>
                                </div>
                            )}
                        </div>
                    </div>
                 </div>

                 {/* Loan Application / Management */}
                 <div className="bg-black/20 border border-white/5 rounded-xl p-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-purple-400" />
                        Loan Services
                    </h2>
                    
                    {activeLoan ? (
                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-blue-400 text-sm">Repayment Information</h3>
                                <p className="text-xs text-gray-300 mt-1">
                                Loans are repaid automatically when you purchase or receive paid coins. 
                                There is no interest if paid within 30 days.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="font-semibold text-white mb-2 text-sm">Apply for a Loan</h3>
                                <p className="text-xs text-gray-400 mb-4">
                                Get coins instantly and pay them back later automatically.
                                </p>
                                
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-400 mb-1">
                                            Amount (Coins) - Max: {eligibility.maxAmount}
                                        </label>
                                        <input 
                                            type="number"
                                            value={requestedAmount}
                                            onChange={(e) => setRequestedAmount(Number(e.target.value))}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                                            min={100}
                                            max={eligibility.maxAmount || 100}
                                        />
                                    </div>
                                    
                                    <button
                                      onClick={handleApplyLoan}
                                      disabled={(!eligibility.canApply && !isAdmin) || applying}
                                      className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg text-sm transition-all"
                                    >
                                      {applying ? 'Processing...' : 'Apply for Loan'}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-black/20 rounded-xl p-4">
                                <h3 className="font-semibold text-white mb-2 text-sm">Eligibility Requirements</h3>
                                <ul className="space-y-2">
                                    <li className="flex items-center gap-2 text-xs">
                                        {!activeLoan ? <CheckCircle className="w-3 h-3 text-green-500"/> : <div className="w-3 h-3 border rounded-full border-gray-600"/>}
                                        <span className={!activeLoan ? 'text-gray-200' : 'text-gray-500'}>No active loans</span>
                                    </li>
                                    <li className="flex items-center gap-2 text-xs">
                                        {eligibility.maxAmount > 0 ? <CheckCircle className="w-3 h-3 text-green-500"/> : <div className="w-3 h-3 border rounded-full border-gray-600"/>}
                                        <span className={eligibility.maxAmount > 0 ? 'text-gray-200' : 'text-gray-500'}>Account age check {eligibility.maxAmount > 0 && `(Max: ${eligibility.maxAmount})`}</span>
                                    </li>
                                </ul>
                                
                                {eligibility.reasons.length > 0 && (
                                    <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded">
                                        <p className="text-[10px] text-red-300 font-semibold mb-1">Why you can't apply:</p>
                                        <ul className="list-disc list-inside text-[10px] text-red-200/80">
                                            {eligibility.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                 </div>

                 {/* Recent Transactions */}
                 <div>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <History className="w-5 h-5 text-gray-400" />
                        Recent Transactions
                    </h2>
                    <div className="overflow-x-auto bg-black/20 rounded-xl border border-white/5">
                        <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-[10px] text-gray-500 border-b border-white/5 uppercase tracking-wider">
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Type</th>
                            <th className="py-3 px-4">Source</th>
                            <th className="py-3 px-4 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {ledger.map((entry) => (
                            <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="py-3 px-4 text-gray-400 text-xs">
                                {new Date(entry.created_at).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                    entry.bucket === 'repayment' ? 'bg-red-500/20 text-red-300' :
                                    entry.bucket === 'loan' ? 'bg-purple-500/20 text-purple-300' :
                                    'bg-gray-500/20 text-gray-300'
                                }`}>
                                    {entry.bucket.toUpperCase()}
                                </span>
                                </td>
                                <td className="py-3 px-4 text-gray-400 text-xs">{entry.source}</td>
                                <td className={`py-3 px-4 text-right font-mono font-medium ${
                                entry.amount_delta > 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                {entry.amount_delta > 0 ? '+' : ''}{entry.amount_delta}
                                </td>
                            </tr>
                            ))}
                            {ledger.length === 0 && (
                            <tr>
                                <td colSpan={4} className="py-8 text-center text-gray-500 text-xs">
                                No transactions found.
                                </td>
                            </tr>
                            )}
                        </tbody>
                        </table>
                    </div>
                 </div>
              </div>
            )}

            {/* Coins Tab */}
            {tab === 'coins' && (
              <PayPalScriptProvider options={{ "client-id": import.meta.env.VITE_PAYPAL_CLIENT_ID || "test" }}>
                <div className="mb-6">
                  <TrollPassBanner 
                    onPurchase={async () => {
                      const trollPassPkg = {
                        id: 'troll_pass_bundle',
                        coins: 1500,
                        price: 9.99,
                        name: 'Troll Pass Premium',
                        purchaseType: 'troll_pass_bundle'
                      };
                      setSelectedPackage(trollPassPkg);
                      setCashAppModalOpen(true);
                    }} 
                    customActionComponent={selectedProviderId === 'paypal' ? (
                      <div className="min-w-[150px]">
                        <PayPalButtons
                          style={{ layout: "horizontal", height: 45, tagline: false }}
                          createOrder={(data, actions) => createPayPalOrder({
                            id: 'troll_pass_bundle',
                            coins: 1500,
                            price: 9.99,
                            name: 'Troll Pass Premium'
                          })}
                          onApprove={(data, actions) => onPayPalApprove(data, actions, {
                            id: 'troll_pass_bundle',
                            coins: 1500,
                            price: 9.99,
                            name: 'Troll Pass Premium'
                          })}
                          onError={(err) => {
                            console.error('PayPal Error:', err);
                            toast.error('Payment failed. Please try again.');
                          }}
                          disabled={loadingPay}
                        />
                      </div>
                    ) : null}
                  />
                </div>
                 
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-yellow-400" />
                  Coin Packages
                </h2>
                {/* Payment Provider Selector */}
                <div className="mb-4 flex gap-2">
                  {paymentProviders.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProviderId(p.id)}
                      className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 border transition-colors ${selectedProviderId === p.id ? 'bg-purple-600 text-white border-purple-400' : 'bg-[#181825] text-gray-300 border-[#2C2C2C] hover:bg-[#232336]'}`}
                    >
                      {p.logoUrl && <img src={p.logoUrl} alt={p.displayName} className="h-5 w-5" />}
                      {p.displayName}
                    </button>
                  ))}
                </div>
                
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {coinPackages.map((pkg) => (
                      <div key={pkg.id} className={`bg-black/40 p-4 rounded-lg border ${pkg.promo ? 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : (pkg.popular || pkg.bestValue ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-purple-500/20')} relative overflow-hidden group`}>
                        {(pkg.popular || pkg.bestValue || pkg.promo) && (
                          <div className={`absolute top-3 right-3 ${pkg.promo ? 'bg-green-500' : 'bg-yellow-500'} text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider`}>
                            {pkg.promo ? 'Limited Offer' : (pkg.popular ? 'Popular' : 'Best Value')}
                          </div>
                        )}
                        <div className="flex flex-col items-center text-center p-2">
                          <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">{pkg.emoji}</div>
                          <div className="font-bold text-2xl text-white mb-1">{formatCoins(pkg.coins)}</div>
                          <div className="text-lg font-semibold text-green-400 mb-1">{pkg.price}</div>
                          <div className="text-sm text-gray-400 mb-4">Troll Coins</div>
                          {selectedProviderId === 'paypal' ? (
                            <PayPalButtons
                              style={{ layout: "horizontal", height: 45, tagline: false }}
                              createOrder={(data, actions) => createPayPalOrder(pkg)}
                              onApprove={(data, actions) => onPayPalApprove(data, actions, pkg)}
                              onError={(err) => {
                                console.error('PayPal Error:', err);
                                toast.error('Payment failed. Please try again.');
                              }}
                              disabled={loadingPay}
                            />
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedPackage(pkg);
                                setCashAppModalOpen(true);
                              }}
                              className="w-full py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                              disabled={loadingPay && selectedPackage?.id === pkg.id}
                            >
                              {loadingPay && selectedPackage?.id === pkg.id ? 'Processing...' : pkg.price}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
              </PayPalScriptProvider>
            )}

            {/* Entrance Effects */}
            {tab === 'effects' && (
              <>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-purple-400" />
                  Entrance Effects
                </h2>
                {effectsNote && (
                   <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-sm text-blue-200">
                     {effectsNote}
                   </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {effects.map((effect) => (
                    <div key={effect.id} className="bg-black/40 p-4 rounded-lg border border-purple-500/20">
                      <div className="font-semibold text-lg">{effect.name}</div>
                      <div className="text-sm text-gray-400 mb-2">{effect.description}</div>
                      <div className="flex justify-between items-center mt-4">
                        <span className="text-yellow-400 font-bold">{formatCoins(effect.price_troll_coins || effect.coin_cost)}</span>
                        <button
                          onClick={() => buyEffect(effect)}
                          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm font-semibold"
                        >
                          Buy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Perks */}
            {tab === 'perks' && (
              <>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-purple-400" />
                  Perks
                </h2>
                {perksNote && (
                   <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-sm text-blue-200">
                     {perksNote}
                   </div>
                )}
                
                <div className="mb-6 bg-black/20 p-4 rounded-lg border border-white/10">
                   <label className="text-sm text-gray-400 mb-2 block">Duration Multiplier</label>
                   <div className="flex gap-2">
                     {[1, 2, 5, 10].map(m => (
                       <button
                         key={m}
                         onClick={() => setDurationMultiplier(m)}
                         className={`px-3 py-1 rounded text-sm ${durationMultiplier === m ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-gray-400'}`}
                       >
                         {m}x
                       </button>
                     ))}
                   </div>
                   <p className="text-xs text-gray-500 mt-2">
                     Extend perk duration by purchasing multiple units at once.
                   </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {perks.map((perk) => {
                    const price = getPerkPrice(perk) * durationMultiplier;
                    const duration = (perk.duration_minutes || 0) * durationMultiplier;
                    const isRestricted = perk.role_required === 'officer' && !(isOfficer || isAdmin || isSecretary);
                    
                    return (
                    <div key={perk.id} className={`bg-black/40 p-4 rounded-lg border ${isRestricted ? 'border-red-500/20 opacity-75' : 'border-purple-500/20'}`}>
                      <div className="flex justify-between items-start">
                        <div className="font-semibold text-lg">{perk.name}</div>
                        {perk.role_required === 'officer' && (
                          <span className="text-[10px] uppercase bg-red-900/50 text-red-200 px-1.5 py-0.5 rounded border border-red-500/30">Officer</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400 mb-2">{perk.description}</div>
                      <div className="text-xs text-purple-300 mb-2">Duration: {duration} mins</div>
                      <div className="flex justify-between items-center mt-4">
                        <span className="text-yellow-400 font-bold">{formatCoins(price)}</span>
                        <button
                          onClick={() => buyPerk(perk)}
                          disabled={isRestricted}
                          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-semibold"
                        >
                          {isRestricted ? 'Locked' : 'Buy'}
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              </>
            )}

            {/* Insurance */}
            {tab === 'insurance' && (
              <>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-purple-400" />
                  Insurance Plans
                </h2>
                {insuranceNote && (
                   <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-sm text-blue-200">
                     {insuranceNote}
                   </div>
                )}
                
                <div className="mb-6 bg-black/20 p-4 rounded-lg border border-white/10">
                   <label className="text-sm text-gray-400 mb-2 block">Duration Multiplier</label>
                   <div className="flex gap-2">
                     {[1, 2, 4].map(m => (
                       <button
                         key={m}
                         onClick={() => setDurationMultiplier(m)}
                         className={`px-3 py-1 rounded text-sm ${durationMultiplier === m ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-gray-400'}`}
                       >
                         {m}x
                       </button>
                     ))}
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plans.map((plan) => {
                    const price = (plan.cost || 0) * durationMultiplier;
                    const duration = (plan.duration_hours || 0) * durationMultiplier;
                    
                    return (
                    <div key={plan.id} className="bg-black/40 p-4 rounded-lg border border-purple-500/20">
                      <div className="font-semibold text-lg">{plan.name}</div>
                      <div className="text-sm text-gray-400 mb-2">{plan.description}</div>
                      <div className="text-xs text-purple-300 mb-2">Duration: {duration} hours</div>
                      <div className="flex justify-between items-center mt-4">
                        <span className="text-yellow-400 font-bold">{formatCoins(price)}</span>
                        <button
                          onClick={() => buyInsurance(plan)}
                          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm font-semibold"
                        >
                          Buy
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              </>
            )}

            {/* Call Minutes */}
            {tab === 'calls' && (
              <>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-purple-400" />
                  Call Minutes
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div>
                     <h3 className="text-lg font-semibold mb-3 text-blue-300">Audio Calls</h3>
                     <div className="space-y-3">
                       {callPackages.audio.map(pkg => (
                         <div key={pkg.id} className="flex justify-between items-center bg-black/30 p-3 rounded border border-white/10">
                           <div>
                             <div className="font-medium">{pkg.name}</div>
                             <div className="text-xs text-gray-400">{pkg.minutes} minutes</div>
                           </div>
                           <button
                             onClick={() => buyCallMinutes({...pkg, type: 'audio'})}
                             disabled={loadingPackage === pkg.id}
                             className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs flex items-center gap-2"
                           >
                             <span className="text-yellow-400">{formatCoins(pkg.totalCost)}</span>
                             {loadingPackage === pkg.id ? '...' : 'Buy'}
                           </button>
                         </div>
                       ))}
                     </div>
                   </div>
                   
                   <div>
                     <h3 className="text-lg font-semibold mb-3 text-pink-300">Video Calls</h3>
                     <div className="space-y-3">
                       {callPackages.video.map(pkg => (
                         <div key={pkg.id} className="flex justify-between items-center bg-black/30 p-3 rounded border border-white/10">
                           <div>
                             <div className="font-medium">{pkg.name}</div>
                             <div className="text-xs text-gray-400">{pkg.minutes} minutes</div>
                           </div>
                           <button
                             onClick={() => buyCallMinutes({...pkg, type: 'video'})}
                             disabled={loadingPackage === pkg.id}
                             className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs flex items-center gap-2"
                           >
                             <span className="text-yellow-400">{formatCoins(pkg.totalCost)}</span>
                             {loadingPackage === pkg.id ? '...' : 'Buy'}
                           </button>
                         </div>
                       ))}
                     </div>
                   </div>
                </div>
              </>
            )}

            {/* Broadcast Themes */}
            {tab === 'broadcast_themes' && (
              <>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-purple-400" />
                  Broadcast Themes
                </h2>
                {themesNote && (
                   <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-sm text-blue-200">
                     {themesNote}
                   </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {broadcastThemes.map((theme) => {
                    const owned = ownedThemeIds.has(theme.id);
                    const eligibility = getEligibility(theme);
                    
                    return (
                    <div key={theme.id} className={`bg-black/40 p-4 rounded-lg border ${owned ? 'border-green-500/30' : 'border-purple-500/20'} relative overflow-hidden`}>
                      {owned && <div className="absolute top-2 right-2 bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded">Owned</div>}
                      
                      <div className="h-24 mb-3 rounded bg-zinc-800 w-full overflow-hidden relative">
                         {theme.image_url ? (
                           <img src={theme.image_url} alt={theme.name} className="w-full h-full object-cover" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No Preview</div>
                         )}
                      </div>
                      
                      <div className="font-semibold text-lg">{theme.name}</div>
                      <div className="text-sm text-gray-400 mb-2 line-clamp-2">{theme.description}</div>
                      
                      {!eligibility.isEligible && (
                        <div className="text-xs text-red-400 mb-2">
                           {eligibility.seasonalState || 'Requirements not met'}
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center mt-4">
                        <span className="text-yellow-400 font-bold">{formatCoins(theme.price_coins || 0)}</span>
                        <button
                          onClick={() => buyBroadcastTheme(theme)}
                          disabled={owned || !eligibility.isEligible || themePurchasing === theme.id}
                          className={`px-3 py-1 rounded text-sm font-semibold ${owned ? 'bg-zinc-700 text-gray-400 cursor-default' : 'bg-purple-600 hover:bg-purple-700'}`}
                        >
                          {owned ? 'Owned' : themePurchasing === theme.id ? '...' : 'Buy'}
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              </>
            )}

            {/* Live Snacks */}
            {tab === 'live_snacks' && showLiveSnacks && (
              <>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-purple-400" />
                  Live Snacks
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   <div className="bg-black/40 p-4 rounded-lg border border-purple-500/20">
                      <div className="font-semibold text-lg">🍿 Popcorn</div>
                      <div className="text-sm text-gray-400 mb-2">Boost momentum slightly</div>
                      <div className="flex justify-between items-center mt-4">
                        <span className="text-yellow-400 font-bold">50</span>
                        <button
                          onClick={() => buySnack('popcorn')}
                          disabled={snackLoading === 'popcorn' || !canBuySnack('popcorn')}
                          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm font-semibold disabled:opacity-50"
                        >
                          {snackLoading === 'popcorn' ? '...' : 'Buy'}
                        </button>
                      </div>
                   </div>
                   <div className="bg-black/40 p-4 rounded-lg border border-purple-500/20">
                      <div className="font-semibold text-lg">🍕 Pizza</div>
                      <div className="text-sm text-gray-400 mb-2">Boost momentum moderate</div>
                      <div className="flex justify-between items-center mt-4">
                        <span className="text-yellow-400 font-bold">150</span>
                        <button
                          onClick={() => buySnack('pizza')}
                          disabled={snackLoading === 'pizza' || !canBuySnack('pizza')}
                          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm font-semibold disabled:opacity-50"
                        >
                          {snackLoading === 'pizza' ? '...' : 'Buy'}
                        </button>
                      </div>
                   </div>
                </div>
              </>
            )}

          </div>
        </div>
        
        <CashAppPaymentModal
          isOpen={cashAppModalOpen}
          onClose={() => setCashAppModalOpen(false)}
          amount={selectedPackage?.price ? parseFloat(String(selectedPackage.price).replace('$','')) : 0}
          packageId={selectedPackage?.id}
          coins={selectedPackage?.coins}
          purchaseType={selectedPackage?.purchaseType || 'coin_package'}
          onSuccess={() => {
            setCashAppModalOpen(false);
            showPurchaseCompleteOverlay();
            refreshCoins();
            // Duplicate toast removed
          }}
        />
        </div>
      )
  );
}
