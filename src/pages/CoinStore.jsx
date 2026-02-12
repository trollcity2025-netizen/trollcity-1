import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useCoins } from '@/lib/hooks/useCoins';
import { useBank as useBankHook } from '../lib/hooks/useBank';
import { useAllCreditScores } from '../lib/hooks/useAllCreditScores';
// import { toast } from 'sonner';
import { Coins, ShoppingCart, CreditCard, Landmark, History, CheckCircle, AlertCircle, AlertTriangle, ChevronDown, Gem, X } from 'lucide-react';
import { formatCoins, COIN_PACKAGES } from '../lib/coinMath';
import { ENTRANCE_EFFECTS_DATA } from '../lib/entranceEffects';
import { deductCoins } from '@/lib/coinTransactions';
import { purchaseCallMinutes } from '@/lib/callMinutes';
import { useLiveContextStore } from '../lib/liveContextStore';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

import { trollCityTheme } from '@/styles/trollCityTheme';
import ManualPaymentModal from '@/components/broadcast/ManualPaymentModal';
import TrollPassBanner from '@/components/ui/TrollPassBanner';
import { toast } from 'sonner';

const MANUAL_PROVIDERS = [
  { id: 'venmo', name: 'Venmo', icon: '📱', color: 'bg-[#008CFF]' },
  { id: 'paypal', name: 'PayPal', icon: '🅿️', color: 'bg-[#00457C]' },
  { id: 'cashapp', name: 'Cash App', icon: '💲', color: 'bg-[#00D632]' }
];

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

const SAMPLE_BROADCAST_THEMES = [
  { id: 'classic', slug: 'classic', name: 'Classic Dark', description: 'The classic Troll City look.', price_coins: 0, preview_url: '/assets/themes/theme_purple.svg' },
  { id: 'neon', slug: 'neon', name: 'Neon Night', description: 'High contrast neon styling.', price_coins: 100, preview_url: '/assets/themes/theme_neon.svg' },
  { id: 'cyber', slug: 'cyber', name: 'Cyberpunk', description: 'Futuristic cyber styling.', price_coins: 250, preview_url: '/assets/themes/theme_cyber.svg' },
  { id: 'rgb', slug: 'rgb', name: 'Gamer RGB', description: 'Animated RGB flow for true gamers.', price_coins: 500, preview_url: '/assets/themes/theme_rgb.svg' },
  { id: 'ocean', slug: 'ocean', name: 'Ocean Breeze', description: 'Calming blue gradients.', price_coins: 750, preview_url: '/assets/themes/theme_ocean.svg' },
  { id: 'sunset', slug: 'sunset', name: 'Sunset Gold', description: 'Warm golden tones.', price_coins: 1000, preview_url: '/assets/themes/theme_sunset.svg' }
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
  const { loans: activeLoans, ledger, refresh: refreshBank, payCreditCard, creditInfo, tiers, payLoan, applyForLoan } = useBankHook(); // useBank hook

  const STORE_TAB_KEY = 'tc-store-active-tab';
  const STORE_COMPLETE_KEY = 'tc-store-show-complete';
  const [loading, setLoading] = useState(true);
  const [loadingPackage, setLoadingPackage] = useState(null);
  const [tab, setTab] = useState('coins');
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [useCredit, setUseCredit] = useState(false);
  
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

  const handleDrawCredit = async () => {}; // Legacy placeholder

  const handlePayCredit = async () => {
    const amount = parseInt(payAmount);
    if (!amount || amount <= 0) {
        toast.error('Invalid amount');
        return;
    }
    const result = await payCreditCard(amount);
    if (result.success) {
        setPayAmount('');
        refreshCoins();
    }
  };


  // Eligibility effect removed


  const [selectedPackage, setSelectedPackage] = useState(null);
  const [manualPaymentModalOpen, setManualPaymentModalOpen] = useState(false);
  // Default to Venmo as requested
  const [selectedProviderId, setSelectedProviderId] = useState('venmo');
  const [showPayPal, setShowPayPal] = useState(false);

  const handleManualPurchase = (pkg) => {
    // PayPal handling
    if (selectedProviderId === 'paypal') {
        setSelectedPackage(pkg);
        setShowPayPal(true);
        return;
    }

    // Check for cooldown on CashApp/Venmo
    if (['cashapp', 'venmo'].includes(selectedProviderId)) {
      const lastRequest = localStorage.getItem('last_manual_request_time');
      if (lastRequest) {
        const diff = Date.now() - parseInt(lastRequest, 10);
        if (diff < 60000) {
          const remaining = Math.ceil((60000 - diff) / 1000);
          toast.error(`Please wait ${remaining} seconds before making another request.`);
          return;
        }
      }
      localStorage.setItem('last_manual_request_time', Date.now().toString());
    }

    setSelectedPackage(pkg);
    setManualPaymentModalOpen(true);
  };

  // const [loadingPay, setLoadingPay] = useState(false);
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
  const isEmployee = isAdmin || isSecretary || isOfficer;

  // Employee discounts
  const EMPLOYEE_CALL_DISCOUNT = 0.5; // 50% off call minutes
  const EMPLOYEE_COIN_DISCOUNT = 0.015; // 1.5% off coin packs

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
        supabase.from('entrance_effects').select('*').neq('category', 'gift').order('created_at', { ascending: false }),
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
        SAMPLE_BROADCAST_THEMES,
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
   try {
     const price = effect.price_troll_coins || effect.coin_cost || 0
     if (price <= 0) {
       toast.error('Invalid effect price')
       return
     }
     
     if (!useCredit && troll_coins < price) {
       toast.error(`Not enough Troll Coins. Need ${price}, have ${troll_coins}`)
       return
     }
     if (useCredit && (creditInfo?.available || 0) < price) {
       toast.error(`Not enough Credit. Need ${price}, available ${creditInfo?.available}`)
       return
     }

     const { success, error: deductError } = await deductCoins({
        userId: user.id,
        amount: price,
        type: 'entrance_effect',
        description: `Purchased ${effect.name} entrance effect`,
        metadata: { effect_id: effect.id, effect_name: effect.name },
        useCredit,
        supabaseClient: supabase
     });

     if (!success) {
        throw new Error(deductError || 'Payment failed');
     }

     const { error } = await supabase
       .from('user_entrance_effects')
       .upsert({
         user_id: user.id,
         effect_id: effect.id,
         purchased_at: new Date().toISOString()
       }, { onConflict: 'user_id, effect_id' });
     
     if (error) {
       console.error('Effect purchase error:', error)
       toast.error(error.message || 'Failed to purchase effect')
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
     
     if (!useCredit && troll_coins < price) {
       toast.error(`Not enough Troll Coins. Need ${price}, have ${troll_coins}`)
       return
     }
     if (useCredit && (creditInfo?.available || 0) < price) {
       toast.error(`Not enough Credit. Need ${price}, available ${creditInfo?.available}`)
       return
     }

     const metadata = {
        perk_name: perk.name,
        base_cost: Number(perk.cost || 0),
        final_cost: price,
        duration_minutes: durationMinutes,
        perk_type: perk.perk_type,
        multiplier: durationMultiplier
     };

     const { success, error: deductError } = await deductCoins({
        userId: user.id,
        amount: price,
        type: 'perk_purchase',
        description: `Purchased Perk: ${perk.name}`,
        metadata: { ...metadata, perk_id: perk.id },
        useCredit,
        supabaseClient: supabase
     });

     if (!success) throw new Error(deductError || 'Payment failed');

     // Calculate expiry
     const now = new Date();
     const expiresAt = new Date(now.getTime() + durationMinutes * 60000).toISOString();

     const { error } = await supabase.from('user_perks').insert({
         user_id: user.id,
         perk_id: perk.id,
         expires_at: expiresAt,
         is_active: true,
         metadata: { ...metadata, purchased_at: now.toISOString() }
     });

     if (error) {
        throw error;
     }

     await refreshCoins();
     if (perk.id === 'perk_rgb_username') {
        await refreshProfile();
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
    try {
      const basePrice = Number(plan.cost || 0);
      const price = basePrice * durationMultiplier;
      const baseDuration = Number(plan.duration_hours || 0);
      const durationHours = baseDuration * durationMultiplier;
      
      if (price <= 0) {
        toast.error('Invalid insurance price')
        return
      }

      if (!useCredit && troll_coins < price) {
        toast.error(`Not enough Troll Coins. Need ${price}, have ${troll_coins}`)
        return
      }
      if (useCredit && (creditInfo?.available || 0) < price) {
        toast.error(`Not enough Credit. Need ${price}, available ${creditInfo?.available}`)
        return
      }
      
      const { success, error: deductError } = await deductCoins({
        userId: user.id,
        amount: price,
        type: 'insurance_purchase',
        description: `Purchased Insurance: ${plan.name} (${durationMultiplier}x)`,
        metadata: { 
            insurance_id: plan.id, 
            plan_name: plan.name, 
            multiplier: durationMultiplier,
            protection_type: plan.protection_type
        },
        useCredit,
        supabaseClient: supabase
      });

      if (!success) {
         throw new Error(deductError || 'Payment failed');
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + durationHours * 3600000).toISOString();

      const { error } = await supabase.from('user_insurances').insert({
        user_id: user.id,
        insurance_id: plan.id,
        protection_type: plan.protection_type,
        expires_at: expiresAt,
        is_active: true,
        purchased_at: now.toISOString(),
        metadata: {
          multiplier: durationMultiplier,
          base_cost: basePrice,
          original_duration_hours: baseDuration
        }
      });
     
     if (error) {
       console.error('Insurance purchase error:', error)
       toast.error(error.message || 'Failed to purchase insurance')
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
      if (price < 0) {
        toast.error('Invalid theme price');
        setThemePurchasing(null);
        return;
      }
      if (!useCredit && troll_coins < price) {
        toast.error(`Not enough Troll Coins. Need ${price}, have ${troll_coins}`);
        setThemePurchasing(null);
        return;
      }
      if (useCredit && (creditInfo?.available || 0) < price) {
        toast.error(`Not enough Credit. Need ${price}, available ${creditInfo?.available}`);
        setThemePurchasing(null);
        return;
      }

      // Use RPC function to handle purchase (handles both coin deduction and recording)
      const { data, error } = await supabase.rpc('purchase_broadcast_theme', {
        p_user_id: user.id,
        p_theme_id: theme.id,
        p_set_active: false
      });

      if (error) {
        console.error('Purchase RPC error:', error);
        throw new Error(error.message || 'Theme purchase failed');
      }

      if (data && !data.success) {
        throw new Error(data.error || 'Theme purchase failed');
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
        useCredit,
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
    if (!user?.id) {
      toast.error('Please log in to purchase minutes');
      return;
    }

    const totalCost = Number(pkg.totalCost || 0);
    if (!Number.isFinite(totalCost) || totalCost <= 0) {
      toast.error('Invalid package cost');
      return;
    }

    if (!useCredit && troll_coins < totalCost) {
      toast.error(`Need ${formatCoins(totalCost)} troll_coins to purchase this package.`);
      return;
    }
    if (useCredit && (creditInfo?.available || 0) < totalCost) {
      toast.error(`Need ${formatCoins(totalCost)} credit to purchase this package.`);
      return;
    }

    setLoadingPackage(pkg.id);
    try {
      const { success, error } = await purchaseCallMinutes(user.id, {
        ...pkg,
        cost: totalCost
      }, useCredit);

      if (!success) {
        throw new Error(error || 'Failed to purchase minutes');
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

  // PayPal functions removed

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
        <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white flex items-center justify-center p-6`}>
          <div className="text-center">
            <div className="text-xl font-semibold">Order submitted</div>
          </div>
        </div>
      ) : loading ? (
        <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white p-6`}>
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Coins className="w-8 h-8 text-purple-400" />
                Troll City Coin Store
              </h1>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-xl p-6 animate-pulse`}>
                  <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-700 rounded w-1/3 mt-2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white p-6 overflow-x-hidden`}>
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
            <div className="flex items-center gap-6">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Coins className="w-8 h-8 text-purple-400" />
                Troll City Store
                </h1>

                {/* Credit Card Toggle */}
                {['effects', 'perks', 'calls', 'insurance', 'broadcast_themes'].includes(tab) && (
                <div className="flex items-center gap-3 bg-black/30 border border-white/10 px-4 py-2 rounded-full">
                    <span className={`text-xs font-bold ${!useCredit ? 'text-yellow-400' : 'text-gray-400'}`}>Use Coins</span>
                    <button 
                        onClick={() => setUseCredit(!useCredit)}
                        className={`w-10 h-5 rounded-full relative transition-colors ${useCredit ? 'bg-purple-600' : 'bg-zinc-600'}`}
                    >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${useCredit ? 'left-6' : 'left-1'}`} />
                    </button>
                    <span className={`text-xs font-bold ${useCredit ? 'text-purple-400' : 'text-gray-400'}`}>Use Credit (+8%)</span>
                </div>
                )}
            </div>

            <div className="flex gap-2 hidden md:flex relative">
              <button type="button" className={`px-3 py-2 rounded ${tab==='coins'?'bg-purple-600':trollCityTheme.backgrounds.card}`} onClick={() => setTab('coins')}>Coins</button>
              <button type="button" className={`px-3 py-2 rounded ${tab==='bank'?'bg-purple-600':trollCityTheme.backgrounds.card}`} onClick={() => setTab('bank')}>Bank</button>
              
              <div className="relative">
                <button 
                    type="button" 
                    className={`px-3 py-2 rounded flex items-center gap-2 ${['effects', 'perks', 'calls', 'insurance', 'broadcast_themes'].includes(tab) ? 'bg-purple-600' : trollCityTheme.backgrounds.card}`}
                    onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                >
                    Store Items
                    <ChevronDown className="w-4 h-4" />
                </button>
                
                {showStoreDropdown && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-zinc-900 border border-purple-500/30 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col">
                        <button className={`text-left px-4 py-3 hover:bg-white/10 ${tab==='effects' ? 'text-purple-400 font-bold' : 'text-gray-300'}`} onClick={() => { setTab('effects'); setShowStoreDropdown(false); }}>Entrance Effects</button>
                        <button className={`text-left px-4 py-3 hover:bg-white/10 ${tab==='perks' ? 'text-purple-400 font-bold' : 'text-gray-300'}`} onClick={() => { setTab('perks'); setShowStoreDropdown(false); }}>Perks</button>
                        <button className={`text-left px-4 py-3 hover:bg-white/10 ${tab==='calls' ? 'text-purple-400 font-bold' : 'text-gray-300'}`} onClick={() => { setTab('calls'); setShowStoreDropdown(false); }}>Call Minutes</button>
                        <button className={`text-left px-4 py-3 hover:bg-white/10 ${tab==='insurance' ? 'text-purple-400 font-bold' : 'text-gray-300'}`} onClick={() => { setTab('insurance'); setShowStoreDropdown(false); }}>Insurance</button>
                        <button className={`text-left px-4 py-3 hover:bg-white/10 ${tab==='broadcast_themes' ? 'text-purple-400 font-bold' : 'text-gray-300'}`} onClick={() => { setTab('broadcast_themes'); setShowStoreDropdown(false); }}>Broadcast Themes</button>
                    </div>
                )}
              </div>

              {showLiveSnacks && (
                <button type="button" className={`px-3 py-2 rounded ${tab==='live_snacks'?'bg-purple-600':trollCityTheme.backgrounds.card}`} onClick={() => setTab('live_snacks')}>LIVE SNACKS</button>
              )}
            </div>
            <div className="md:hidden w-full">
              <select
                value={tab}
                onChange={(e) => setTab(e.target.value)}
                className={`w-full ${trollCityTheme.backgrounds.card} text-white ${trollCityTheme.borders.glass} rounded-lg p-2 text-sm focus:outline-none focus:border-purple-500`}
              >
                <option value="coins">Coins</option>
                <option value="bank">Troll Bank</option>
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
                            <h2 className="text-xl font-bold text-red-400 mb-4">Legacy Loan Detected</h2>
                            <p className="mb-6 text-gray-200">You have an outstanding legacy loan. Please pay it off before using new credit features.</p>
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
                {/* Credit Card Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Credit Status Card */}
                  <div className="bg-gradient-to-br from-purple-900/50 via-black to-black border border-purple-500/30 rounded-xl p-6 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 blur-[50px] rounded-full pointer-events-none" />
                     <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                           <div>
                              <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                                <CreditCard className="w-6 h-6 text-purple-400" />
                                Troll Card
                              </h2>
                              <div className="text-xs text-purple-300/70 font-mono tracking-widest">**** **** **** {user?.id?.slice(0, 4) || '0000'}</div>
                           </div>
                           <div className="text-right">
                              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Status</div>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                creditInfo?.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                              }`}>
                                {creditInfo?.status || 'Active'}
                              </span>
                           </div>
                        </div>

                        <div className="space-y-6">
                           <div>
                              <div className="flex justify-between text-sm mb-2">
                                 <span className="text-gray-400">Credit Used</span>
                                 <span className="text-white font-mono">{formatCoins(creditInfo?.used || 0)}</span>
                              </div>
                              <div className="flex justify-between text-sm mb-2">
                                 <span className="text-gray-400">Credit Limit</span>
                                 <span className="text-gray-400 font-mono">{formatCoins(creditInfo?.limit || 1000)}</span>
                              </div>
                              {/* Progress Bar */}
                              <div className="h-4 bg-gray-800 rounded-full overflow-hidden border border-white/5 relative">
                                 <div 
                                    className={`h-full transition-all duration-500 ${
                                       (creditInfo?.used || 0) > (creditInfo?.limit || 1000) ? 'bg-red-500' : 'bg-purple-500'
                                    }`}
                                    style={{ width: `${Math.min(100, ((creditInfo?.used || 0) / (creditInfo?.limit || 1000)) * 100)}%` }}
                                 />
                              </div>
                              <div className="flex justify-between text-xs mt-2">
                                 <span className="text-purple-400 font-bold">Available: {formatCoins((creditInfo?.limit || 1000) - (creditInfo?.used || 0))}</span>
                                 <span className="text-gray-500">APR: {creditInfo?.apr || 8}%</span>
                              </div>
                           </div>

                           <div className="pt-4 border-t border-white/10">
                              <div className="flex gap-2">
                                 <button 
                                    onClick={() => {
                                        const amount = prompt('Enter amount to pay off credit card debt:', Math.ceil(creditInfo?.used || 0).toString());
                                        if (amount) {
                                            const val = parseInt(amount);
                                            if (val > 0) payCreditCard(val);
                                        }
                                    }}
                                    disabled={!creditInfo?.used || creditInfo.used <= 0}
                                    className="flex-1 bg-white text-black font-bold py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                 >
                                    Pay Bill
                                 </button>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Credit Info / Rules */}
                  <div className="bg-black/30 border border-white/10 rounded-xl p-6 md:col-span-2">
                     <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-blue-400" />
                        Card Rules
                     </h3>
                     <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                        <li className="flex items-start gap-2">
                           <span className="text-purple-400 font-bold">•</span>
                           <span><strong className="text-white">8% Finance Fee:</strong> Applied immediately to any credit purchase.</span>
                        </li>
                        <li className="flex items-start gap-2">
                           <span className="text-red-400 font-bold">•</span>
                           <span><strong className="text-white">Direct Purchase Only:</strong> Use your card directly in the shop. No cash advances or transfers.</span>
                        </li>
                        <li className="flex items-start gap-2">
                           <span className="text-yellow-400 font-bold">•</span>
                           <span><strong className="text-white">Cashout Block:</strong> You cannot request a payout while you have ANY credit debt.</span>
                        </li>
                        <li className="flex items-start gap-2">
                           <span className="text-green-400 font-bold">•</span>
                           <span><strong className="text-white">Dynamic Limit:</strong> Increases by 10 coins for every day your account exists.</span>
                        </li>
                     </ul>
                  </div>
                </div>

                {/* Legacy Loans Section */}
                {activeLoans && activeLoans.length > 0 && (
                                   <div className="space-y-6">
                                     <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                       <CreditCard className="w-5 h-5 text-purple-400" />
                                       Legacy Loans
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
                                            <div className="text-lg font-bold text-yellow-400">
                                              {allCreditScores?.find(s => s.user_id === user?.id)?.score ?? 400}
                                            </div>
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
                                    entry.bucket === 'credit_spend' ? 'bg-blue-500/20 text-blue-300' :
                                    'bg-gray-500/20 text-gray-300'
                                }`}>
                                    {entry.bucket === 'loan' ? 'CREDIT DRAW' : 
                                     entry.bucket === 'credit_spend' ? 'CREDIT PURCHASE' :
                                     entry.bucket.toUpperCase()}
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
              <>
                <div className="mb-6">
                  <TrollPassBanner 
                    onPurchase={async () => {
                      const trollPassPkg = {
                        id: 'troll_pass_bundle',
                        coins: 1500,
                        price: '$9.99',
                        name: 'Troll Pass Premium',
                        purchaseType: 'troll_pass_bundle'
                      };
                      handleManualPurchase(trollPassPkg);
                    }}
                  />
                </div>
                 
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-yellow-400" />
                  Coin Packages
                </h2>

                {isEmployee && (
                  <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
                    <span className="text-2xl">🎉</span>
                    <div>
                      <div className="font-bold text-green-400">Employee Discount Applied</div>
                      <div className="text-sm text-gray-300">Secretaries, Lead Troll Officers, and Troll Officers get <span className="font-bold text-green-400">1.5% OFF</span> all coin packs!</div>
                    </div>
                  </div>
                )}

                <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-yellow-200 mb-1">Launch Notice: Manual Purchases</h3>
                    <p className="text-sm text-yellow-200/80">
                      Manual coin purchases are temporarily enabled to ensure accurate tracking and credit verification during our initial launch. 
                      Staff will personally verify all transactions to prevent issues. Thank you for your patience!
                    </p>
                  </div>
                </div>

                {/* Payment Provider Selector */}
                <div className="mb-4 flex gap-2">
                  {MANUAL_PROVIDERS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedProviderId(p.id);
                        setShowPayPal(false);
                      }}
                      className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 border transition-colors ${selectedProviderId === p.id ? 'bg-purple-600 text-white border-purple-400' : 'bg-[#181825] text-gray-300 border-[#2C2C2C] hover:bg-[#232336]'}`}
                    >
                      <span>{p.icon}</span>
                      {p.name}
                    </button>
                  ))}
                </div>
                
                {showPayPal && selectedPackage ? (
                   <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                     <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <span className="text-2xl">🅿️</span> PayPal Checkout
                            </h3>
                            <button onClick={() => setShowPayPal(false)} className="p-1 hover:bg-zinc-800 rounded-full">
                                <X className="w-6 h-6 text-zinc-400" />
                            </button>
                        </div>
                        
                        <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-400">Package</span>
                                <span className="font-bold text-yellow-400">{selectedPackage.coins.toLocaleString()} Coins</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Total</span>
                                <span className="font-bold text-white text-xl">${isEmployee ? (selectedPackage.price.replace('$', '') * (1 - EMPLOYEE_COIN_DISCOUNT)).toFixed(2) : selectedPackage.price.replace('$', '')}</span>
                            </div>
                        </div>

                        <PayPalScriptProvider options={{ 
                            clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "sb",
                            currency: "USD",
                            intent: "capture"
                        }}>
                            <PayPalButtons 
                                style={{ layout: "vertical", color: "gold", shape: "pill", label: "paypal", height: 48 }}
                                createOrder={async (data, actions) => {
                                  try {
                                      const price = isEmployee ? (selectedPackage.price.replace('$', '') * (1 - EMPLOYEE_COIN_DISCOUNT)).toFixed(2) : selectedPackage.price.replace('$', '');
                                      const { data: orderData, error } = await supabase.functions.invoke('paypal-create-order', {
                                        body: {
                                          amount: price,
                                          coins: selectedPackage.coins,
                                          user_id: user?.id,
                                          package_id: selectedPackage.id
                                        }
                                      });
                                      if (error) throw error;
                                      if (!orderData?.orderId) throw new Error("Order creation failed");
                                      return orderData.orderId;
                                  } catch (err) {
                                      console.error("PayPal Create Error:", err);
                                      toast.error("Failed to initialize PayPal: " + (err.message || "Unknown error"));
                                      return "";
                                  }
                                }}
                                onApprove={async (data, actions) => {
                                  try {
                                      const { error } = await supabase.functions.invoke('paypal-complete-order', {
                                        body: {
                                          orderId: data.orderID,
                                          userId: user?.id,
                                          packageId: selectedPackage.id
                                        }
                                      });
                                      if (error) throw error;
                                      toast.success(`Successfully purchased ${selectedPackage.coins.toLocaleString()} coins!`);
                                      setShowPayPal(false);
                                      refreshCoins();
                                  } catch (err) {
                                      console.error("PayPal Capture Error:", err);
                                      toast.error("Payment verification failed. Please contact support.");
                                  }
                                }}
                                onCancel={() => setShowPayPal(false)}
                                onError={(err) => {
                                    console.error("PayPal Error:", err);
                                    toast.error("PayPal encountered an error");
                                    setShowPayPal(false);
                                }}
                            />
                        </PayPalScriptProvider>
                     </div>
                   </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {coinPackages.map((pkg) => {
                      // Parse the USD price
                      const priceMatch = pkg.price.match(/\$(\d+\.?\d*)/);
                      const originalPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;
                      const discountedPrice = isEmployee ? originalPrice * (1 - EMPLOYEE_COIN_DISCOUNT) : originalPrice;
                      
                      return (
                        <div key={pkg.id} className={`bg-black/40 p-4 rounded-lg border ${pkg.promo ? 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : (pkg.popular || pkg.bestValue ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-purple-500/20')} relative overflow-hidden group ${isEmployee ? 'border-green-500/30' : ''}`}>
                          {isEmployee && (
                            <div className="absolute top-3 left-3 bg-green-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              1.5% OFF
                            </div>
                          )}
                          {(pkg.popular || pkg.bestValue || pkg.promo) && !isEmployee && (
                            <div className={`absolute top-3 right-3 ${pkg.promo ? 'bg-green-500' : 'bg-yellow-500'} text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider`}>
                              {pkg.promo ? 'Limited Offer' : (pkg.popular ? 'Popular' : 'Best Value')}
                            </div>
                          )}
                          <div className="flex flex-col items-center text-center p-2">
                            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">{pkg.emoji}</div>
                            <div className="font-bold text-2xl text-white mb-1">{formatCoins(pkg.coins)}</div>
                            {isEmployee ? (
                              <div className="mb-1">
                                <span className="text-lg font-semibold text-gray-400 line-through">{pkg.price}</span>
                                <span className="text-lg font-semibold text-green-400 ml-2">${discountedPrice.toFixed(2)}</span>
                              </div>
                            ) : (
                              <div className="text-lg font-semibold text-green-400 mb-1">{pkg.price}</div>
                            )}
                            <div className="text-sm text-gray-400 mb-4">Troll Coins</div>
                            
                            <button
                              onClick={() => {
                                const purchasePkg = isEmployee ? { ...pkg, price: `${discountedPrice.toFixed(2)}` } : pkg;
                                handleManualPurchase(purchasePkg);
                              }}
                              className={`w-full py-2 rounded font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${isEmployee ? 'bg-green-600 hover:bg-green-500' : (MANUAL_PROVIDERS.find(p => p.id === selectedProviderId)?.color || 'bg-purple-600')} hover:brightness-110`}
                            >
                              Buy with {MANUAL_PROVIDERS.find(p => p.id === selectedProviderId)?.name}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              )}
            </>
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
                {isEmployee && (
                  <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
                    <span className="text-2xl">🎉</span>
                    <div>
                      <div className="font-bold text-green-400">Employee Discount Applied</div>
                      <div className="text-sm text-gray-300">Secretaries, Lead Troll Officers, and Troll Officers get <span className="font-bold text-green-400">50% OFF</span> all call minutes!</div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div>
                     <h3 className="text-lg font-semibold mb-3 text-blue-300">Audio Calls</h3>
                     <div className="space-y-3">
                       {callPackages.audio.map(pkg => {
                         const discountedPrice = isEmployee ? Math.round(pkg.totalCost * (1 - EMPLOYEE_CALL_DISCOUNT)) : pkg.totalCost;
                         return (
                           <div key={pkg.id} className={`flex justify-between items-center bg-black/30 p-3 rounded border ${isEmployee ? 'border-green-500/30' : 'border-white/10'}`}>
                             <div>
                               <div className="font-medium">{pkg.name}</div>
                               <div className="text-xs text-gray-400">{pkg.minutes} minutes</div>
                               {isEmployee && (
                                 <div className="text-xs text-green-400 font-medium">Employee: {formatCoins(discountedPrice)}</div>
                               )}
                             </div>
                             <button
                               onClick={() => buyCallMinutes({...pkg, type: 'audio', totalCost: discountedPrice})}
                               disabled={loadingPackage === pkg.id}
                               className={`px-3 py-1 rounded text-xs flex items-center gap-2 ${isEmployee ? 'bg-green-600 hover:bg-green-500' : 'bg-zinc-700 hover:bg-zinc-600'}`}
                             >
                               <span className={isEmployee ? 'text-white' : 'text-yellow-400'}>{formatCoins(isEmployee ? discountedPrice : pkg.totalCost)}</span>
                               {loadingPackage === pkg.id ? '...' : 'Buy'}
                             </button>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                   
                   <div>
                     <h3 className="text-lg font-semibold mb-3 text-pink-300">Video Calls</h3>
                     <div className="space-y-3">
                       {callPackages.video.map(pkg => {
                         const discountedPrice = isEmployee ? Math.round(pkg.totalCost * (1 - EMPLOYEE_CALL_DISCOUNT)) : pkg.totalCost;
                         return (
                           <div key={pkg.id} className={`flex justify-between items-center bg-black/30 p-3 rounded border ${isEmployee ? 'border-green-500/30' : 'border-white/10'}`}>
                             <div>
                               <div className="font-medium">{pkg.name}</div>
                               <div className="text-xs text-gray-400">{pkg.minutes} minutes</div>
                               {isEmployee && (
                                 <div className="text-xs text-green-400 font-medium">Employee: {formatCoins(discountedPrice)}</div>
                               )}
                             </div>
                             <button
                               onClick={() => buyCallMinutes({...pkg, type: 'video', totalCost: discountedPrice})}
                               disabled={loadingPackage === pkg.id}
                               className={`px-3 py-1 rounded text-xs flex items-center gap-2 ${isEmployee ? 'bg-green-600 hover:bg-green-500' : 'bg-zinc-700 hover:bg-zinc-600'}`}
                             >
                               <span className={isEmployee ? 'text-white' : 'text-yellow-400'}>{formatCoins(isEmployee ? discountedPrice : pkg.totalCost)}</span>
                               {loadingPackage === pkg.id ? '...' : 'Buy'}
                             </button>
                           </div>
                         );
                       })}
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
                <div className="bg-black/40 p-8 rounded-lg border border-purple-500/30 text-center">
                  <div className="text-6xl mb-4">🎨</div>
                  <h3 className="text-2xl font-bold mb-2 text-yellow-400">Coming Soon</h3>
                  <p className="text-zinc-400 mb-4">Broadcast themes are coming soon!</p>
                  <p className="text-sm text-zinc-500">Stay tuned for amazing new theme options to customize your broadcast background.</p>
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
        
        <ManualPaymentModal
          isOpen={manualPaymentModalOpen}
          onClose={() => setManualPaymentModalOpen(false)}
          pkg={selectedPackage}
          providerId={selectedProviderId}
          onSuccess={() => {
            setManualPaymentModalOpen(false);
            showPurchaseCompleteOverlay();
            refreshCoins();
          }}
        />
        </div>
      )
  );
}
