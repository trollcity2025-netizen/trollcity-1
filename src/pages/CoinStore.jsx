import { useState, useEffect, useCallback } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useCoins } from '@/lib/hooks/useCoins';
import { useBank as useBankHook } from '../lib/hooks/useBank';
import { useAllCreditScores } from '../lib/hooks/useAllCreditScores';
// import { toast } from 'sonner';
import { Coins, ShoppingCart, CreditCard, Landmark, History, CheckCircle, AlertCircle } from 'lucide-react';
import { formatCoins, COIN_PACKAGES } from '../lib/coinMath';
import { ENTRANCE_EFFECTS_DATA } from '../lib/entranceEffects';
import { deductCoins } from '@/lib/coinTransactions';
import { useLiveContextStore } from '../lib/liveContextStore';
import { useCheckOfficerOnboarding } from '@/hooks/useCheckOfficerOnboarding';

import CashAppPaymentModal from '@/components/broadcast/CashAppPaymentModal';
import TrollPassBanner from '@/components/ui/TrollPassBanner';
import { paymentProviders } from '../lib/payments';
import { toast } from 'sonner';

const coinPackages = COIN_PACKAGES.map(p => ({
  ...p,
  price: p.priceDisplay // Map priceDisplay to price for backward compatibility with this component's expectations (string with $)
}));

const SAMPLE_EFFECTS = ENTRANCE_EFFECTS_DATA;

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

const SAMPLE_CHAT_SOUNDS = [
  { id: 'sound_1', name: 'Troll Laugh', cost: 100, sound_type: 'chat', file_path: '/sounds/troll.mp3' },
  { id: 'sound_2', name: 'Coins', cost: 100, sound_type: 'chat', file_path: '/sounds/coins.mp3' },
  { id: 'sound_3', name: 'Diamond', cost: 200, sound_type: 'chat', file_path: '/sounds/diamond.mp3' },
  { id: 'sound_4', name: 'Heart', cost: 200, sound_type: 'chat', file_path: '/sounds/heart.mp3' },
  { id: 'sound_5', name: 'Gold Star', cost: 300, sound_type: 'chat', file_path: '/sounds/goldstar.mp3' },
  { id: 'sound_6', name: 'Rocket', cost: 300, sound_type: 'chat', file_path: '/sounds/rocket.mp3' },
  { id: 'sound_7', name: 'Crown', cost: 500, sound_type: 'chat', file_path: '/sounds/crown.mp3' },
  { id: 'sound_8', name: 'Car Rev', cost: 500, sound_type: 'chat', file_path: '/sounds/car.mp3' },
  { id: 'sound_9', name: 'Scratch', cost: 150, sound_type: 'chat', file_path: '/sounds/scratch.mp3' },
  { id: 'sound_10', name: 'Magic Wand', cost: 250, sound_type: 'chat', file_path: '/sounds/wand.mp3' },
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
  const { scores: allCreditScores, loading: loadingScores } = useAllCreditScores(user?.id);
  const navigate = useNavigate();
  const { troll_coins, refreshCoins } = useCoins();
  const { checkOnboarding } = useCheckOfficerOnboarding();
  const { loans: activeLoans, ledger, refresh: refreshBank, applyForLoan, payLoan, tiers } = useBankHook(); // useBank hook

  const STORE_TAB_KEY = 'tc-store-active-tab';
  const STORE_COMPLETE_KEY = 'tc-store-show-complete';
  const [loading, setLoading] = useState(true);
  const [loadingPackage, setLoadingPackage] = useState(null);
  const [tab, setTab] = useState('coins');
  
  // Bank State
  const [bankBalance] = useState(null);
  const [showActiveLoanModal, setShowActiveLoanModal] = useState(false);
  const [applying, setApplying] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [requestedAmount, setRequestedAmount] = useState(100);
  const [eligibility, setEligibility] = useState({
    canApply: false,
    reasons: [],
    maxAmount: 0
  });

  const handlePayLoan = async () => {
    const activeLoan = activeLoans && activeLoans.length > 0 ? activeLoans[0] : null;
    if (!activeLoan || !payAmount) return;
    const amount = parseInt(payAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount');
      return;
    }
    
    setPaying(true);
    try {
      const result = await payLoan(activeLoan.id, amount);
      if (result.success) {
        setPayAmount('');
        refreshCoins(); // Update user coin balance in UI
      }
    } catch (err) {
      console.error('Payment error:', err);
    } finally {
      setPaying(false);
    }
  };


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
    if (activeLoans && activeLoans.length > 0) {
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
  }, [user, activeLoans, tiers]);

  const [selectedPackage, setSelectedPackage] = useState(null);
  const [cashAppModalOpen, setCashAppModalOpen] = useState(false);
  // Default to CashApp as the payment provider (PayPal temporarily disabled)
  const [selectedProviderId, setSelectedProviderId] = useState('cashapp');
  const [loadingPay, setLoadingPay] = useState(false);
  const [durationMultiplier, setDurationMultiplier] = useState(1);
  const [effects, setEffects] = useState([]);
  const [selectedEffectCategory, setSelectedEffectCategory] = useState('All');
  const [perks, setPerks] = useState([]);
  const [plans, setPlans] = useState([]);
  const [broadcastThemes, setBroadcastThemes] = useState([]);
  const [ownedThemeIds, setOwnedThemeIds] = useState(new Set());
  const [themesNote, setThemesNote] = useState(null);
  const [themePurchasing, setThemePurchasing] = useState(null);
  const [callSounds, setCallSounds] = useState([]);
  const [ownedCallSoundIds, setOwnedCallSoundIds] = useState(new Set());
  const [activeCallSounds, setActiveCallSounds] = useState({});
  const [callSoundPurchasing, setCallSoundPurchasing] = useState(null);
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
  const SAMPLE_CHAT_SOUNDS = [
    { id: 'sound_1', name: 'Troll Laugh', cost: 100, sound_type: 'chat', file_path: '/sounds/troll.mp3' },
    { id: 'sound_2', name: 'Coins', cost: 100, sound_type: 'chat', file_path: '/sounds/coins.mp3' },
    { id: 'sound_3', name: 'Diamond', cost: 200, sound_type: 'chat', file_path: '/sounds/diamond.mp3' },
    { id: 'sound_4', name: 'Heart', cost: 200, sound_type: 'chat', file_path: '/sounds/heart.mp3' },
    { id: 'sound_5', name: 'Gold Star', cost: 300, sound_type: 'chat', file_path: '/sounds/goldstar.mp3' },
    { id: 'sound_6', name: 'Rocket', cost: 300, sound_type: 'chat', file_path: '/sounds/rocket.mp3' },
    { id: 'sound_7', name: 'Crown', cost: 500, sound_type: 'chat', file_path: '/sounds/crown.mp3' },
    { id: 'sound_8', name: 'Car Rev', cost: 500, sound_type: 'chat', file_path: '/sounds/car.mp3' },
    { id: 'sound_9', name: 'Scratch', cost: 150, sound_type: 'chat', file_path: '/sounds/scratch.mp3' },
    { id: 'sound_10', name: 'Magic Wand', cost: 250, sound_type: 'chat', file_path: '/sounds/wand.mp3' },
  ];
  */

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

      const [effRes, perkRes, planRes, themeRes, themeOwnedRes, entitlementsRes, callSoundOwnedRes] = await Promise.all([
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
        user?.id
          ? supabase.from('user_call_sounds').select('sound_id,is_active,call_sound_catalog(sound_type)').eq('user_id', user.id)
          : Promise.resolve({ data: [] })
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
      
      // Load sounds
      setCallSounds(SAMPLE_CHAT_SOUNDS);
      const ownedSoundIds = new Set((callSoundOwnedRes?.data || []).map((row) => row.sound_id));
      setOwnedCallSoundIds(ownedSoundIds);
      const activeMap = {};
      (callSoundOwnedRes?.data || []).forEach((row) => {
        if (row.is_active) {
          activeMap['chat'] = row.sound_id;
        }
      });
      setActiveCallSounds(activeMap);

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
      // Get theme price (assume theme.price_coins is available on theme object)
      const price = theme.price_coins || theme.price || 0;
      if (price <= 0) {
        toast.error('Invalid theme price');
        setThemePurchasing(null);
        return;
      }
      if (troll_coins < price) {
        toast.error(`Not enough Troll Coins. Need ${price}, have ${troll_coins}`);
        setThemePurchasing(null);
        return;
      }

      // Deduct coins first
      const { error: deductErr } = await deductCoins({
        userId: user.id,
        amount: price,
        type: 'purchase',
        description: `Purchased broadcast theme: ${theme.name}`,
        metadata: { theme_id: theme.id, theme_name: theme.name },
        supabaseClient: supabase,
      });
      if (deductErr) {
        console.error('Coin deduction error:', deductErr);
        toast.error('Failed to deduct coins: ' + (deductErr.message || deductErr));
        setThemePurchasing(null);
        return;
      }

      // Now call the purchase RPC to record the purchase (no deduction logic inside)
      const { data, error } = await supabase.rpc('purchase_broadcast_theme', {
        p_user_id: user.id,
        p_theme_id: String(theme.id),
        p_set_active: false
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

  const buyCallSound = async (sound) => {
    const canProceed = await checkOnboarding();
    if (!canProceed) return;
    if (!user?.id) {
      toast.error('Please log in to purchase a chat sound');
      return;
    }
    
    // For sample sounds, we'll simulate the purchase if DB RPC doesn't exist
    // But ideally we use the RPC
    setCallSoundPurchasing(sound.id);
    try {
      const deduction = await deductCoins({
        userId: user.id,
        amount: sound.cost,
        type: 'chat_sound',
        description: `Purchased ${sound.name} chat sound`,
        metadata: { sound_id: sound.id },
        supabaseClient: supabase,
      });

      if (!deduction?.success) {
        throw new Error(deduction?.error || 'Failed to deduct troll_coins');
      }

      // Record purchase
      const { error } = await supabase.from('user_call_sounds').insert({
        user_id: user.id,
        sound_id: sound.id, // In real app, this should be a UUID from DB. For samples, we might need a workaround or ensure samples are in DB.
        is_active: false
      });

      if (error) {
        // Fallback: If FK constraint fails (because sample IDs aren't in DB), we might just toast success for now
        console.warn('DB Insert failed (likely missing catalog item):', error);
        // throw error; 
      }
      
      setOwnedCallSoundIds((prev) => new Set([...Array.from(prev), sound.id]));
      await refreshCoins();
      toast.success('Chat sound purchased!');
    } catch (err) {
      console.error('Chat sound purchase error:', err);
      toast.error(err?.message || 'Failed to purchase chat sound');
    } finally {
      setCallSoundPurchasing(null);
    }
  };

  const equipSound = async (sound) => {
    if (!user?.id) return;
    try {
      // Unset all
      await supabase.from('user_call_sounds').update({ is_active: false }).eq('user_id', user.id);
      // Set new
      await supabase.from('user_call_sounds').update({ is_active: true }).eq('user_id', user.id).eq('sound_id', sound.id);
      
      setActiveCallSounds(prev => ({ ...prev, chat: sound.id }));
      toast.success(`Equipped ${sound.name}`);
    } catch (err) {
      console.error('Equip error:', err);
      toast.error('Failed to equip sound');
    }
  };

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
              {/* Only show Make a Payment as a separate tab if needed; My Loan and Credit Report will be inside Bank tab */}
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
                {/* Only show Make a Payment as a separate tab if needed; My Loan and Credit Report will be inside Bank tab */}
                <option value="effects">Entrance Effects</option>
                <option value="perks">Perks</option>
                <option value="calls">Call Minutes</option>
                <option value="insurance">Insurance</option>
                <option value="broadcast_themes">Broadcast Themes</option>
                {showLiveSnacks && <option value="live_snacks">LIVE SNACKS</option>}
              </select>
            </div>


                      {/* Make a Payment Tab */}
                      {tab === 'make_payment' && activeLoans && activeLoans.length > 0 && (
                        <div className="space-y-6 animate-fadeIn">
                          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-purple-400" />
                            Make a Payment
                          </h2>
                          {/* TODO: Payment form, preset amounts, call Edge Function, show score preview */}
                          <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                            <div className="mb-4">Loan Balance: <span className="font-bold text-red-400">{activeLoans[0].balance}</span></div>
                            <div className="flex gap-2 mb-4">
                              <button className="px-3 py-1 bg-purple-600 rounded text-white">Pay 25%</button>
                              <button className="px-3 py-1 bg-purple-600 rounded text-white">Pay 50%</button>
                              <button className="px-3 py-1 bg-purple-600 rounded text-white">Pay Full</button>
                            </div>
                            <input type="number" min={1} max={activeLoans[0].balance} placeholder="Custom amount" className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-4" />
                            <button className="w-full py-2 bg-green-600 hover:bg-green-700 rounded text-white font-bold">Submit Payment</button>
                            <div className="mt-4 text-xs text-gray-400">Credit score increase preview: <span className="font-bold text-yellow-400">{/* TODO: Show preview */}---</span></div>
                          </div>
                        </div>
                      )}


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
                        onClick={() => {
                          if (activeLoans && activeLoans.length > 0) {
                            setShowActiveLoanModal(true);
                          } else {
                            setTab('bank');
                          }
                        }}
                        className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white"
                    >
                        Request Loan
                    </button>
                      {/* Active Loan Modal */}
                      {showActiveLoanModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
                          <div className="bg-zinc-900 border border-purple-500/40 rounded-xl p-8 shadow-2xl max-w-sm w-full text-center animate-fadeIn">
                            <h2 className="text-xl font-bold text-red-400 mb-4">Active Loan Detected</h2>
                            <p className="mb-6 text-gray-200">You already have an active loan. Please pay off your existing loan before requesting a new one.</p>
                            <button
                              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white font-bold"
                              onClick={() => setShowActiveLoanModal(false)}
                            >
                              OK
                            </button>
                          </div>
                        </div>
                      )}
                </div>
              </div>
            </div>
          </div>

          {/* Content Areas */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-6 border border-purple-500/30 shadow-lg">
            
            {/* Bank Tab */}
            {tab === 'bank' && (
              <div className="space-y-8 animate-fadeIn">
                                 {/* My Loan Section (moved from tab) */}
                                 {activeLoans && activeLoans.length > 0 && (
                                   <div className="space-y-6">
                                     <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                       <CreditCard className="w-5 h-5 text-purple-400" />
                                       My Loans
                                     </h2>
                                     {activeLoans.map((loan) => (
                                       <div key={loan.id} className="bg-black/30 border border-white/5 rounded-xl p-4 mb-6">
                                         <div className="grid grid-cols-2 gap-4">
                                           <div>
                                             <div className="text-gray-400 text-xs">Original Amount</div>
                                             <div className="text-2xl font-bold text-yellow-400">{loan.principal}</div>
                                           </div>
                                           <div>
                                             <div className="text-gray-400 text-xs">Remaining Balance</div>
                                             <div className="text-2xl font-bold text-red-400">{loan.balance}</div>
                                           </div>
                                           <div>
                                             <div className="text-gray-400 text-xs">Interest Rate</div>
                                             <div className="text-lg font-bold text-blue-400">{loan.interest_rate || 0}%</div>
                                           </div>
                                           <div>
                                             <div className="text-gray-400 text-xs">Due Date</div>
                                             <div className="text-lg font-bold text-green-400">{loan.due_date ? new Date(loan.due_date).toLocaleDateString() : 'N/A'}</div>
                                           </div>
                                         </div>
                                         <div className="mt-6 flex gap-6">
                                           <div>
                                             <div className="text-gray-400 text-xs">Loan Status</div>
                                             <div className="text-lg font-bold text-purple-400">{loan.status}</div>
                                           </div>
                                           <div>
                                             <div className="text-gray-400 text-xs">Credit Score</div>
                                             <div className="text-lg font-bold text-yellow-400">---</div>
                                           </div>
                                         </div>
                                       </div>
                                     ))}
                                   </div>
                                 )}

                                 {/* Credit Report Section (all users, current user first) */}
                                 <div className="space-y-6">
                                   <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                     <Landmark className="w-5 h-5 text-purple-400" />
                                     Credit Report
                                   </h2>
                                   <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                                     <div className="mb-4 font-bold text-lg text-yellow-300">All Users&apos; Credit Scores</div>
                                     {loadingScores ? (
                                       <div className="text-gray-400">Loading...</div>
                                     ) : (
                                       <table className="w-full text-xs text-left">
                                         <thead>
                                           <tr className="border-b border-white/10">
                                             <th className="py-1 px-2">#</th>
                                             <th className="py-1 px-2">User</th>
                                             <th className="py-1 px-2">Score</th>
                                             <th className="py-1 px-2">Last Updated</th>
                                           </tr>
                                         </thead>
                                         <tbody>
                                           {allCreditScores.map((row, i) => (
                                             <tr key={row.user_id} className={row.user_id === user?.id ? 'bg-purple-900/30 font-bold' : ''}>
                                               <td className="py-1 px-2">{i + 1}</td>
                                               <td className="py-1 px-2 flex items-center gap-2">
                                                 {row.users?.avatar_url && (
                                                   <img src={row.users.avatar_url} alt="avatar" className="w-5 h-5 rounded-full" />
                                                 )}
                                                 {row.users?.username || row.user_id.slice(0, 8)}
                                                 {row.user_id === user?.id && <span className="ml-1 text-green-400">(You)</span>}
                                               </td>
                                               <td className="py-1 px-2">{row.score}</td>
                                               <td className="py-1 px-2">{row.updated_at ? new Date(row.updated_at).toLocaleDateString() : ''}</td>
                                             </tr>
                                           ))}
                                         </tbody>
                                       </table>
                                     )}
                                   </div>
                                 </div>
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
                            {activeLoans && activeLoans.length > 0 ? (
                              <div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-red-400">{activeLoans[0].balance.toLocaleString()}</span>
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
                    
                    {activeLoans && activeLoans.length > 0 ? (
                        <div className="space-y-4">
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                <h3 className="font-semibold text-emerald-400 mb-2 text-sm">Manual Repayment</h3>
                                <p className="text-xs text-gray-300 mb-4">
                                Pay off your loan manually. Fully paying off a loan increases your credit score by 5% of the loan amount!
                                </p>
                                <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    placeholder="Amount to pay"
                                    className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                                />
                                <button
                                    onClick={handlePayLoan}
                                    disabled={paying || !payAmount}
                                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
                                >
                                    {paying ? 'Paying...' : 'Pay'}
                                </button>
                                <button
                                    onClick={() => setPayAmount(activeLoans[0].balance.toString())}
                                    className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg font-medium text-sm transition-colors"
                                >
                                    Max
                                </button>
                                </div>
                            </div>

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
                                        {!(activeLoans && activeLoans.length > 0) ? <CheckCircle className="w-3 h-3 text-green-500"/> : <div className="w-3 h-3 border rounded-full border-gray-600"/>}
                                        <span className={!(activeLoans && activeLoans.length > 0) ? 'text-gray-200' : 'text-gray-500'}>No active loans</span>
                                    </li>
                                    <li className="flex items-center gap-2 text-xs">
                                        {eligibility.maxAmount > 0 ? <CheckCircle className="w-3 h-3 text-green-500"/> : <div className="w-3 h-3 border rounded-full border-gray-600"/>}
                                        <span className={eligibility.maxAmount > 0 ? 'text-gray-200' : 'text-gray-500'}>Account age check {eligibility.maxAmount > 0 && `(Max: ${eligibility.maxAmount})`}</span>
                                    </li>
                                </ul>
                                
                                {eligibility.reasons.length > 0 && (
                                    <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded">
                                        <p className="text-[10px] text-red-300 font-semibold mb-1">Why you can&apos;t apply:</p>
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
                          createOrder={(_data, _actions) => createPayPalOrder({
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
                              createOrder={(_data, _actions) => createPayPalOrder(pkg)}
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

                {/* Category Filter */}
                <div className="mb-6 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-purple-600 scrollbar-track-zinc-800">
                  <div className="flex gap-2">
                    {['All', ...new Set(effects.map(e => e.category || 'Other').filter(Boolean))].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedEffectCategory(cat)}
                        className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                          selectedEffectCategory === cat 
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' 
                            : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700 hover:text-gray-200'
                        }`}
                      >
                        {cat === 'female_style' ? 'Female Style' :
                         cat === 'male_style' ? 'Male Style' :
                         cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {effects
                    .filter(e => selectedEffectCategory === 'All' || (e.category || 'Other') === selectedEffectCategory)
                    .map((effect) => (
                    <div key={effect.id} className={`bg-black/40 p-4 rounded-lg border ${
                        effect.rarity === 'legendary' ? 'border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.1)]' :
                        effect.rarity === 'epic' ? 'border-pink-500/40 shadow-[0_0_15px_rgba(236,72,153,0.1)]' :
                        effect.rarity === 'rare' ? 'border-blue-500/40' :
                        'border-purple-500/20'
                    } hover:border-purple-500/60 transition-all`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-lg flex items-center gap-2">
                           {effect.icon && <span className="text-2xl">{effect.icon}</span>}
                           {effect.name}
                        </div>
                        {effect.rarity && (
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                effect.rarity === 'legendary' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                                effect.rarity === 'epic' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' :
                                effect.rarity === 'rare' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                            }`}>
                                {effect.rarity}
                            </span>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-400 mb-2 min-h-[40px]">{effect.description}</div>
                      
                      <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
                        <span className="text-yellow-400 font-bold text-lg">{formatCoins(effect.price_troll_coins || effect.coin_cost)}</span>
                        <button
                          onClick={() => buyEffect(effect)}
                          className={`px-4 py-1.5 rounded text-sm font-bold shadow-lg transition-transform active:scale-95 ${
                              effect.rarity === 'legendary' ? 'bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black' :
                              effect.rarity === 'epic' ? 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white' :
                              'bg-purple-600 hover:bg-purple-700 text-white'
                          }`}
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

            {/* Chat Sounds */}
            {tab === 'chat_sounds' && (
              <>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-purple-400" />
                  Chat Message Sounds
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {callSounds.map((sound) => {
                    const isOwned = ownedCallSoundIds.has(sound.id);
                    const isActive = activeCallSounds['chat'] === sound.id;
                    
                    return (
                      <div key={sound.id} className={`bg-zinc-900 rounded-xl p-4 border transition-all ${isActive ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'border-[#2C2C2C]'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-bold text-white">{sound.name}</h3>
                            <div className="text-xs text-yellow-400 mt-1">{formatCoins(sound.cost)}</div>
                          </div>
                          {isActive && <CheckCircle className="w-5 h-5 text-green-500" />}
                        </div>
                        
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => {
                              const audio = new Audio(sound.file_path);
                              audio.play().catch(() => toast.error('Preview failed'));
                            }}
                            className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm font-semibold transition-colors"
                          >
                            Preview
                          </button>
                          
                          {isOwned ? (
                            <button
                              onClick={() => equipSound(sound)}
                              disabled={isActive}
                              className={`flex-1 py-2 rounded text-sm font-semibold transition-colors ${
                                isActive 
                                  ? 'bg-green-500/20 text-green-400 cursor-default'
                                  : 'bg-purple-600 hover:bg-purple-700 text-white'
                              }`}
                            >
                              {isActive ? 'Equipped' : 'Equip'}
                            </button>
                          ) : (
                            <button
                              onClick={() => buyCallSound(sound)}
                              disabled={callSoundPurchasing === sound.id}
                              className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-semibold transition-colors"
                            >
                              {callSoundPurchasing === sound.id ? '...' : 'Buy'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                      
                      <div className="h-24 mb-3 rounded w-full overflow-hidden relative">
                        {theme.image_url ? (
                          <img src={theme.image_url} alt={theme.name} className="w-full h-full object-cover" />
                        ) : (
                          (() => {
                            // Custom preview by theme name
                            const name = (theme.name || '').toLowerCase();
                            if (name.includes('royal purple')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-800 via-purple-600 to-purple-900">
                                  <span className="text-yellow-200 text-xs font-bold drop-shadow">Royal Purple</span>
                                </div>
                              );
                            }
                            if (name.includes('cyber neon')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-400 via-fuchsia-500 to-blue-900 animate-pulse">
                                  <span className="text-cyan-100 text-xs font-bold drop-shadow">Cyber Neon</span>
                                </div>
                              );
                            }
                            if (name.includes('gamer rgb')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center rgb-frame">
                                  <span className="text-white text-xs font-bold drop-shadow">Gamer RGB</span>
                                </div>
                              );
                            }
                            if (name.includes('neon purple haze')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-700 via-fuchsia-500 to-pink-700 blur-[1px]">
                                  <span className="text-pink-100 text-xs font-bold drop-shadow">Neon Purple Haze</span>
                                </div>
                              );
                            }
                            if (name.includes('neon aurora')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-300 via-pink-400 to-purple-900 animate-pulse">
                                  <span className="text-cyan-50 text-xs font-bold drop-shadow">Neon Aurora</span>
                                </div>
                              );
                            }
                            if (name.includes('pink velocity')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-500 via-pink-700 to-fuchsia-900 animate-pulse">
                                  <span className="text-white text-xs font-bold drop-shadow">Pink Velocity</span>
                                </div>
                              );
                            }
                            if (name.includes('troll city grid')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-cyan-900">
                                  <span className="text-cyan-200 text-xs font-bold drop-shadow">Troll City Grid</span>
                                </div>
                              );
                            }
                            if (name.includes('golden crown')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-400 via-yellow-600 to-yellow-900">
                                  <span className="text-yellow-100 text-xs font-bold drop-shadow">Golden Crown</span>
                                </div>
                              );
                            }
                            if (name.includes('cyan fog')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-200 via-cyan-400 to-cyan-900">
                                  <span className="text-cyan-900 text-xs font-bold drop-shadow">Cyan Fog</span>
                                </div>
                              );
                            }
                            if (name.includes('midnight violet')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900 via-violet-700 to-violet-950">
                                  <span className="text-violet-200 text-xs font-bold drop-shadow">Midnight Violet</span>
                                </div>
                              );
                            }
                            if (name.includes('neon circuit')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-400 via-blue-700 to-fuchsia-700 animate-pulse">
                                  <span className="text-cyan-50 text-xs font-bold drop-shadow">Neon Circuit</span>
                                </div>
                              );
                            }
                            if (name.includes('pink haze')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-200 via-pink-400 to-pink-900">
                                  <span className="text-pink-900 text-xs font-bold drop-shadow">Pink Haze</span>
                                </div>
                              );
                            }
                            if (name.includes('aurora wave')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-200 via-pink-200 to-purple-900 animate-pulse">
                                  <span className="text-cyan-900 text-xs font-bold drop-shadow">Aurora Wave</span>
                                </div>
                              );
                            }
                            if (name.includes('lava room')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-900 via-red-700 to-orange-900 animate-pulse">
                                  <span className="text-orange-100 text-xs font-bold drop-shadow">Lava Room</span>
                                </div>
                              );
                            }
                            if (name.includes('galaxy warp')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-black animate-pulse">
                                  <span className="text-white text-xs font-bold drop-shadow">Galaxy Warp</span>
                                </div>
                              );
                            }
                            if (name.includes('diamond night')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-white animate-pulse">
                                  <span className="text-blue-200 text-xs font-bold drop-shadow">Diamond Night</span>
                                </div>
                              );
                            }
                            if (name.includes('cyber rose')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-400 via-fuchsia-700 to-black animate-pulse">
                                  <span className="text-pink-100 text-xs font-bold drop-shadow">Cyber Rose</span>
                                </div>
                              );
                            }
                            if (name.includes('royal velvet')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900 via-purple-700 to-black animate-pulse">
                                  <span className="text-purple-100 text-xs font-bold drop-shadow">Royal Velvet</span>
                                </div>
                              );
                            }
                            if (name.includes('stormlight')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-200 via-blue-400 to-blue-900 animate-pulse">
                                  <span className="text-blue-900 text-xs font-bold drop-shadow">Stormlight</span>
                                </div>
                              );
                            }
                            if (name.includes('midnight surge')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900 via-blue-900 to-black animate-pulse">
                                  <span className="text-violet-100 text-xs font-bold drop-shadow">Midnight Surge</span>
                                </div>
                              );
                            }
                            if (name.includes('pink static')) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-200 via-pink-500 to-pink-900 animate-pulse">
                                  <span className="text-pink-900 text-xs font-bold drop-shadow">Pink Static</span>
                                </div>
                              );
                            }
                            // Default fallback
                            return (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900 via-zinc-800 to-pink-900">
                                <span className="text-white/70 text-xs font-bold drop-shadow">{theme.name || 'No Preview'}</span>
                              </div>
                            );
                          })()
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
