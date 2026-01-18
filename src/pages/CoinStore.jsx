import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useCoins } from '@/lib/hooks/useCoins';
import { toast } from 'sonner';
import { loadStripe } from '@stripe/stripe-js';
import { Coins, DollarSign, ShoppingCart, CreditCard, CheckCircle, Loader2 } from 'lucide-react';
import { formatCoins, formatUSD } from '../lib/coinMath';
import { addCoins, deductCoins } from '@/lib/coinTransactions';
import { useLiveContextStore } from '../lib/liveContextStore';
import { useStreamMomentum } from '@/lib/hooks/useStreamMomentum';
import { useCheckOfficerOnboarding } from '@/hooks/useCheckOfficerOnboarding';

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
  const stripeCheckoutUrl = import.meta.env.VITE_API_URL || '/api/stripe';
  const stripePaymentIntentUrl = import.meta.env.VITE_STRIPE_PI_URL || stripeCheckoutUrl;
  const STRIPE_ENABLED = String(import.meta.env.VITE_STRIPE_ENABLED || '').trim() === '1';
  const { user, profile, refreshProfile } = useAuthStore();
  const navigate = useNavigate();
  const { troll_coins, refreshCoins } = useCoins();
  const { checkOnboarding } = useCheckOfficerOnboarding();
  const STORE_TAB_KEY = 'tc-store-active-tab';
  const STORE_COMPLETE_KEY = 'tc-store-show-complete';
  const CASHAPP_TAG_KEY = 'tc-cashapp-tag';
  const MANUAL_ORDER_KEY_PREFIX = 'tc-manual-order-';
  const [loading, setLoading] = useState(true);
  const [loadingPackage, setLoadingPackage] = useState(null);
  const [tab, setTab] = useState('coins');
  const [durationMultiplier, setDurationMultiplier] = useState(1);
  const [effects, setEffects] = useState([]);
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
  const [savedMethods, setSavedMethods] = useState([]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [pendingPackage, setPendingPackage] = useState(null);
  const [paymentClientSecret, setPaymentClientSecret] = useState(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSetupLoading, setPaymentSetupLoading] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const activeStreamId = useLiveContextStore((s) => s.activeStreamId);
  const { momentum } = useStreamMomentum(activeStreamId);
  const [liveStreamIsLive, setLiveStreamIsLive] = useState(false);
  const [snackLoading, setSnackLoading] = useState(null);
  const [lastSnackAt, setLastSnackAt] = useState({});
  const [showPurchaseComplete, setShowPurchaseComplete] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(sessionStorage.getItem('tc-store-show-complete'));
  });
  const [coinPackages, setCoinPackages] = useState([]);

  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const paymentElementRef = useRef(null);
  const paymentAttachedRef = useRef(false);
  const [manualOrderRefId, setManualOrderRefId] = useState(null);
  const [cashAppTag, setCashAppTag] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(CASHAPP_TAG_KEY) || '';
  });
  const [cashAppTagError, setCashAppTagError] = useState(null);

  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true;
  const isSecretary = profile?.role === 'secretary' || profile?.troll_role === 'secretary';
  const isOfficer = profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer' || profile?.is_lead_officer === true || profile?.troll_role === 'troll_officer' || profile?.troll_role === 'lead_troll_officer';

  useEffect(() => {
    const loadCoinPackages = async () => {
      try {
        const { data, error } = await supabase
          .from('coin_packages')
          .select('id, name, coins, price_usd, amount_cents')
          .eq('is_active', true)
          .order('coins', { ascending: true });

        if (error) throw error;
        if (Array.isArray(data)) {
          setCoinPackages(data);
        }
      } catch (err) {
        console.error('Failed to load coin packages:', err);
        toast.error('Unable to load coin packages');
      }
    };

    loadCoinPackages();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CASHAPP_TAG_KEY, (cashAppTag || '').trim());
  }, [cashAppTag]);

  const getThemeStyle = (theme) => {
    if (!theme) return undefined;
    const imageUrl = theme.image_url || theme.preview_url || theme.background_asset_url;
    if (imageUrl) {
      return {
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    }
    if (theme.background_css) {
      return { background: theme.background_css };
    }
    return undefined;
  };

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

  const getManualOrderStorageKey = (pkgId) => `${MANUAL_ORDER_KEY_PREFIX}${pkgId}`;

  const normalizeCashAppTag = useCallback((value) => {
    const trimmed = String(value || '').trim();
    const withoutDollar = trimmed.replace(/^\$+/, '');
    if (!withoutDollar) return { tag: null, error: 'Enter your Cash App tag (no $)' };
    if (!/^[A-Za-z0-9._-]{2,20}$/.test(withoutDollar)) {
      return { tag: null, error: 'Cash App tag must be 2-20 letters/numbers (no $).' };
    }
    return { tag: withoutDollar, error: null };
  }, []);

  const ensureCashAppTag = useCallback(() => {
    const { tag, error } = normalizeCashAppTag(cashAppTag);
    if (error || !tag) {
      setCashAppTagError(error || 'Cash App tag is required');
      toast.error(error || 'Cash App tag is required');
      return null;
    }
    setCashAppTagError(null);
    setCashAppTag(tag);
    return tag;
  }, [cashAppTag, normalizeCashAppTag]);

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

  const trollPassExpiresAt = profile?.troll_pass_expires_at || null;
  const trollPassLastPurchasedAt = profile?.troll_pass_last_purchased_at || null;
  const trollPassActive = Boolean(
    trollPassExpiresAt && new Date(trollPassExpiresAt).getTime() > Date.now(),
  );

  const trollPassBundle = {
    id: 'troll_pass_bundle',
    coins: 1500,
    price: 4.50,
  };

  const _isViewerOnly = Boolean(
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

  const loadWalletData = useCallback(async (showLoading = true) => {
    console.log('?? Loading wallet data for user:', user?.id);
    try {
      if (showLoading) setLoading(true);

      await refreshCoins();

      const [effRes, perkRes, planRes, themeRes, themeOwnedRes, entitlementsRes, callSoundRes, callSoundOwnedRes] = await Promise.all([
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
        supabase.from('call_sound_catalog').select('*').eq('is_active', true).order('sound_type', { ascending: true }),
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
      setCallSounds(callSoundRes?.data || []);
      const ownedSoundIds = new Set((callSoundOwnedRes?.data || []).map((row) => row.sound_id));
      setOwnedCallSoundIds(ownedSoundIds);
      const activeMap = {};
      (callSoundOwnedRes?.data || []).forEach((row) => {
        if (row.is_active && row.call_sound_catalog?.sound_type) {
          activeMap[row.call_sound_catalog.sound_type] = row.sound_id;
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

  const loadPaymentMethods = useCallback(async () => {
    if (!profile?.id) return;
    setMethodsLoading(true);
    const { data, error } = await supabase
      .from('user_payment_methods')
      .select('id, provider, display_name, is_default, brand, last4, exp_month, exp_year')
      .eq('user_id', profile.id)
      .order('is_default', { ascending: false });

    if (error) {
      console.error('Failed to load payment methods:', error);
    }
    setSavedMethods(data || []);
    setMethodsLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    loadWalletData(true);
  }, [user, navigate, loadWalletData]);

  useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

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

  const initPaymentElement = useCallback(async (clientSecret) => {
    if (paymentAttachedRef.current) return;
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      setPaymentError('Stripe publishable key not configured');
      return;
    }

    setPaymentSetupLoading(true);
    try {
      const stripe = await loadStripe(publishableKey);
      if (!stripe) throw new Error('Stripe failed to load');

      const elements = stripe.elements({
        clientSecret,
        appearance: { theme: 'night' },
      });

      const container = document.getElementById('stripe-coin-payment-element');
      if (!container) throw new Error('Payment element container missing');

      container.innerHTML = '';
      const paymentElement = elements.create('payment');
      paymentElement.mount('#stripe-coin-payment-element');

      stripeRef.current = stripe;
      elementsRef.current = elements;
      paymentElementRef.current = paymentElement;
      paymentAttachedRef.current = true;
    } catch (err) {
      console.error('Stripe payment element error:', err);
      setPaymentError(err?.message || 'Stripe setup failed');
    } finally {
      setPaymentSetupLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!paymentModalOpen || !paymentClientSecret) return;
    initPaymentElement(paymentClientSecret);

    return () => {
      if (paymentElementRef.current) {
        try {
          paymentElementRef.current.destroy();
        } catch {}
        paymentElementRef.current = null;
      }
      elementsRef.current = null;
      stripeRef.current = null;
      paymentAttachedRef.current = false;
    };
  }, [paymentModalOpen, paymentClientSecret, initPaymentElement]);
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
        await addCoins({
          userId: user.id,
          amount: totalCost,
          type: 'refund',
          coinType: 'troll_coins',
          description: `Refund for ${pkg.minutes} ${pkg.type} call minutes`,
          metadata: { package_id: pkg.id, minutes: pkg.minutes, call_type: pkg.type },
          supabaseClient: supabase
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

  const startPaymentIntent = async (pkg, purchaseType) => {
    const loadingId = pkg?.id || purchaseType || 'stripe-payment';
    setLoadingPackage(loadingId);
    setPaymentError(null);
    if (pkg) setPendingPackage(pkg);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No authentication token available');

      const res = await fetch(stripePaymentIntentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(
          purchaseType
            ? { purchaseType }
            : { packageId: pkg.id }
        )
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error('❌ Backend error:', txt);
        throw new Error(`Payment start error: ${res.status}`);
      }

      const data = await res.json();
      if (!data.clientSecret) throw new Error('Missing payment client secret');

      setPaymentClientSecret(data.clientSecret);
      setPaymentModalOpen(true);
    } catch (err) {
      console.error('❌ Failed to start Stripe payment:', err);
      toast.error('Unable to start payment.');
    } finally {
      setLoadingPackage(null);
    }
  };

  const handleBuy = async (pkg) => {
    const canProceed = await checkOnboarding();
    if (!canProceed) return;
    setPendingPackage(pkg);
    if (!STRIPE_ENABLED) {
      try {
        const tag = ensureCashAppTag();
        if (!tag) return;
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('Not authenticated');
        const storageKey = getManualOrderStorageKey(pkg.id);
        let existingOrderId = null;
        if (typeof window !== 'undefined') {
          existingOrderId = localStorage.getItem(storageKey);
        }
        if (existingOrderId) {
          const statusRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual-coin-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              action: 'status',
              order_id: existingOrderId,
            }),
          });
          const statusText = await statusRes.text();
          let statusJson = null;
          try { statusJson = JSON.parse(statusText); } catch {}
          if (statusRes.ok && statusJson?.success && statusJson.order) {
            if (statusJson.order.status !== 'fulfilled') {
              setManualOrderRefId(existingOrderId);
              setPaymentModalOpen(true);
              toast('You already have a pending manual order for this package.');
              return;
            }
            if (typeof window !== 'undefined') {
              localStorage.removeItem(storageKey);
            }
          }
        }
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual-coin-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            action: 'create',
            package_id: pkg.id,
            coins: pkg.coins || pkg?.coins_amount || 0,
            amount_usd: pkg.price_usd || Number(String(pkg.price).replace(/[^0-9.]/g, '')) || 0,
            cashapp_tag: tag,
          }),
        });
        const txt = await res.text();
        let json = null;
        try { json = JSON.parse(txt); } catch {}
        if (!res.ok) throw new Error(json?.error || 'Failed to create manual order');
        setManualOrderRefId(json?.orderId || null);
        if (json?.orderId && typeof window !== 'undefined') {
          localStorage.setItem(storageKey, json.orderId);
        }
        setPaymentModalOpen(true);
        toast.success('Manual order created. Follow Cash App instructions.');
      } catch (e) {
        console.error('Manual order error:', e);
        toast.error(e?.message || 'Failed to create manual order');
      }
      return;
    }
    await startPaymentIntent(pkg);
  };

  const openAdminManualTab = (orderId, pkg) => {
    if (!orderId) return;
    const params = new URLSearchParams({
      orderId,
      user: profile?.username || profile?.id || '',
      coins: String(pkg?.coins || 0),
      amount: String(pkg?.price_usd || ''),
    });
    window.open(`/admin/manual-orders?${params.toString()}`, '_blank', 'noopener');
  };

  const handleCashApp = async (pkg) => {
    const canProceed = await checkOnboarding();
    if (!canProceed) return;
    const tag = ensureCashAppTag();
    if (!tag) return;
    setPendingPackage(pkg);
    setLoadingPackage(pkg?.id || null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const storageKey = getManualOrderStorageKey(pkg.id);
      let existingOrderId = null;
      if (typeof window !== 'undefined') {
        existingOrderId = localStorage.getItem(storageKey);
      }
      if (existingOrderId) {
        const statusRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual-coin-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            action: 'status',
            order_id: existingOrderId,
          }),
        });
        const statusText = await statusRes.text();
        let statusJson = null;
        try { statusJson = JSON.parse(statusText); } catch {}
        if (statusRes.ok && statusJson?.success && statusJson.order) {
          if (statusJson.order.status !== 'fulfilled') {
            setManualOrderRefId(existingOrderId);
            setPaymentModalOpen(true);
            toast('You already have a pending manual order for this package.');
            return;
          }
          if (typeof window !== 'undefined') {
            localStorage.removeItem(storageKey);
          }
        }
      }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual-coin-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'create',
          package_id: pkg.id,
          coins: pkg.coins || pkg?.coins_amount || 0,
          amount_usd: pkg.price_usd || Number(String(pkg.price).replace(/[^0-9.]/g, '')) || 0,
          username: profile?.username,
          cashapp_tag: tag,
        }),
      });
      const txt = await res.text();
      let json = null;
      try { json = JSON.parse(txt); } catch {}
      if (!res.ok) throw new Error(json?.error || 'Failed to create manual order');
      setManualOrderRefId(json?.orderId || null);
      if (json?.orderId && typeof window !== 'undefined') {
        localStorage.setItem(storageKey, json.orderId);
      }
      setPaymentModalOpen(true);
      openAdminManualTab(json?.orderId, pkg);
      toast.success('Manual order created. Cash App instructions ready.');
    } catch (e) {
      console.error('Manual order error:', e);
      toast.error(e?.message || 'Failed to create manual order');
    } finally {
      setLoadingPackage(null);
    }
  };

  const handleBuyTrollPass = async () => {
    const canProceed = await checkOnboarding();
    if (!canProceed) return;

    if (trollPassActive) return;
    setPendingPackage({
      ...trollPassBundle,
      name: 'Troll Pass Bundle',
    });
    await startPaymentIntent(null, 'troll_pass_bundle');
  };

  const handleBuyTrollPassCashApp = async () => {
    const canProceed = await checkOnboarding();
    if (!canProceed) return;
    if (trollPassActive) return;
    const tag = ensureCashAppTag();
    if (!tag) return;
    
    setPendingPackage({
      ...trollPassBundle,
      name: 'Troll Pass Bundle',
    });
    setLoadingPackage(trollPassBundle.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual-coin-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'create',
          package_id: trollPassBundle.id,
          coins: trollPassBundle.coins,
          amount_usd: trollPassBundle.price,
          username: profile?.username,
          cashapp_tag: tag,
          purchase_type: 'troll_pass',
        }),
      });
      const txt = await res.text();
      let json = null;
      try { json = JSON.parse(txt); } catch {}
      if (!res.ok) throw new Error(json?.error || 'Failed to create manual order');
      setManualOrderRefId(json?.orderId || null);
      setPaymentModalOpen(true);
      openAdminManualTab(json?.orderId, { ...trollPassBundle, name: 'Troll Pass Bundle' });
      toast.success('Troll Pass manual order created. Cash App instructions ready.');
    } catch (e) {
      console.error('Manual order error:', e);
      toast.error(e?.message || 'Failed to create manual order');
    } finally {
      setLoadingPackage(null);
    }
  };

  const closePaymentModal = () => {
    setPaymentModalOpen(false);
    setPaymentClientSecret(null);
    setPaymentError(null);
    setPendingPackage(null);
  };

  const handleConfirmPayment = async () => {
    if (!stripeRef.current || !elementsRef.current) {
      setPaymentError('Stripe is not ready yet');
      return;
    }

    try {
      setPaymentProcessing(true);
      setPaymentError(null);

      const { error, paymentIntent } = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        confirmParams: {
          return_url: `${window.location.origin}/wallet?success=1`,
        },
        redirect: 'if_required',
      });

      if (error) {
        throw new Error(error.message || 'Payment failed');
      }

      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
        toast.success('Payment confirmed');
        showPurchaseCompleteOverlay();
        closePaymentModal();
      }
    } catch (err) {
      console.error('Stripe confirm error:', err);
      setPaymentError(err?.message || 'Payment failed');
      toast.error(err?.message || 'Payment failed');
    } finally {
      setPaymentProcessing(false);
    }
  };

  const purchaseCompleteActive =
    showPurchaseComplete ||
    (typeof window !== 'undefined' && Boolean(sessionStorage.getItem(STORE_COMPLETE_KEY)));

  useEffect(() => {
    if (!purchaseCompleteActive || showPurchaseComplete) return;
    setShowPurchaseComplete(true);
  }, [purchaseCompleteActive, showPurchaseComplete]);

  return (
      purchaseCompleteActive ? (
        <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center p-6">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-purple-400 mx-auto mb-4" />
            <div className="text-xl font-semibold">Your Troll City purchase is complete</div>
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
          {/* Warning Banner */}
          <div className="bg-purple-500/10 border border-purple-500/50 rounded-xl p-4 flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div className="text-purple-200 text-sm font-medium space-y-1">
              <p>
                {STRIPE_ENABLED
                  ? 'Secure payments are processed via Stripe.'
                  : 'Manual Cash App flow is active. Stripe verification is temporarily disabled.'}
              </p>
              <p>
                Link your preferred payment method in your profile for a faster checkout experience.
              </p>
            </div>
          </div>

          {tab === 'coins' && (
            <div className="bg-zinc-900/80 border border-[#2C2C2C] rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-300" />
                  <p className="font-semibold">Saved payment methods</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/profile/setup')}
                  className="text-xs px-3 py-1 rounded bg-[#1A1A24] border border-gray-700 hover:bg-[#2A2A35]"
                >
                  Manage in Edit Profile
                </button>
              </div>

              <div className="mt-3">
                {methodsLoading ? (
                  <p className="text-sm text-gray-400">Loading payment methods…</p>
                ) : savedMethods.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {savedMethods.map((method) => (
                      <div
                        key={method.id}
                        className="px-3 py-2 rounded-lg border border-[#2C2C2C] bg-black/40 text-sm"
                      >
                        <div className="font-medium">
                          {method.display_name || method.brand || 'Payment Method'}
                          {method.is_default ? ' • Default' : ''}
                        </div>
                        {method.last4 ? (
                          <div className="text-xs text-gray-400">•••• {method.last4}</div>
                        ) : (
                          <div className="text-xs text-gray-500">Saved method</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No saved payment methods yet.</p>
                )}
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Coins className="w-8 h-8 text-purple-400" />
              Troll City Coin Store
            </h1>
            <div className="flex gap-2 hidden md:flex">
              <button type="button" className={`px-3 py-2 rounded ${tab==='coins'?'bg-purple-600':'bg-zinc-800'}`} onClick={() => setTab('coins')}>Coin Packages</button>
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
                <option value="coins">Coin Packages</option>
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
                <p className="text-xs text-gray-500 mt-1">withdrawable balance</p>
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
                  +{trollPassBundle.coins.toLocaleString()} Troll Coins + 30-day Troll Pass perk (chat boost + +5% gift bonus)
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
                <div className="mt-2 space-y-2">
                  <button
                    type="button"
                    onClick={handleBuyTrollPass}
                    disabled={!_isViewerOnly || trollPassActive || loadingPackage === trollPassBundle.id}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded font-semibold text-sm"
                  >
                    {loadingPackage === trollPassBundle.id
                      ? 'Starting payment...'
                      : trollPassActive
                        ? 'Active'
                        : 'Pay with Stripe'}
                  </button>
                  {!STRIPE_ENABLED && !trollPassActive && _isViewerOnly && (
                    <button
                      type="button"
                      onClick={handleBuyTrollPassCashApp}
                      disabled={loadingPackage === trollPassBundle.id}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded font-semibold text-sm"
                    >
                      {loadingPackage === trollPassBundle.id ? 'Creating order...' : 'Pay with Cash App'}
                    </button>
                  )}
                </div>
              </div>
            </div>
            </div>

            {/* Temporarily disabled
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
            */}
          </div>

          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-6 border border-purple-500/30 shadow-lg">
            {tab === 'coins' && (
              <>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-purple-400" />
                  Available Coin Packages
                </h2>
                {!STRIPE_ENABLED && (
                  <div className="mb-4 bg-green-500/5 border border-green-500/30 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-green-200">Cash App tag (required for manual payments)</div>
                      <span className="text-[11px] text-green-300">No $ sign</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="px-2 py-2 bg-green-500/10 border border-green-500/30 rounded text-green-200 text-sm">$</span>
                      <input
                        value={cashAppTag}
                        onChange={(e) => setCashAppTag(e.target.value)}
                        onBlur={() => cashAppTag && ensureCashAppTag()}
                        placeholder="yourcashtag"
                        className="w-full bg-black/40 border border-green-500/30 rounded px-3 py-2 text-sm text-white focus:border-green-400 outline-none"
                      />
                    </div>
                    {cashAppTagError && (
                      <div className="text-xs text-red-300 mt-1">{cashAppTagError}</div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">We display your tag to admins/secretaries so they can match your Cash App payment quickly.</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {coinPackages.map((pkg) => (
                    <div key={pkg.id} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20 hover:border-purple-500/40 transition-all">
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg font-bold text-purple-300">{pkg.name || 'Coin Package'}</span>
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
                        <p className="text-xl font-bold text-green-400">{formatUSD(pkg.price_usd)}</p>
                      </div>
                      <div className="mt-4 space-y-2">
                        {!STRIPE_ENABLED && (
                          <button
                            type="button"
                            onClick={() => handleCashApp(pkg)}
                            disabled={loadingPackage === pkg.id}
                            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded font-semibold"
                          >
                            {loadingPackage === pkg.id ? 'Creating manual order...' : 'Pay with Cash App'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => STRIPE_ENABLED && handleBuy(pkg)}
                          disabled={!STRIPE_ENABLED || loadingPackage === pkg.id}
                          className={`w-full px-4 py-2 rounded font-semibold border border-purple-500/30 ${STRIPE_ENABLED ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-800 text-gray-400 cursor-not-allowed'}`}
                        >
                          {STRIPE_ENABLED ? (loadingPackage === pkg.id ? 'Starting Stripe...' : 'Pay with Stripe') : 'Stripe temporarily disabled'}
                        </button>
                        <div className="mt-1 text-[11px] text-gray-400 text-center">
                          {STRIPE_ENABLED
                            ? 'Stripe securely processes this purchase.'
                            : 'Cash App sends a manual request to admins when Stripe is disabled.'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {tab === 'broadcast_themes' && (
              <>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-purple-400" />
                  Broadcast Themes
                </h2>
                {themesNote && (
                  <div className="mb-4 text-xs text-yellow-200 bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-3">
                    {themesNote}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {broadcastThemes.map((theme) => {
                    const owned = ownedThemeIds.has(theme.id);
                    const eligibility = getEligibility(theme);
                    const rarityFrame = getRarityFrame(theme.rarity);
                    const isAnimated = theme.asset_type === 'video';
                    const isLimited = Boolean(theme.is_limited);
                    const isExclusive = Boolean(theme.is_streamer_exclusive || theme.min_stream_level || theme.min_followers || theme.min_total_hours_streamed);
                    const purchaseDisabled = !eligibility.isEligible || owned || themePurchasing === theme.id;
                    return (
                      <div key={theme.id} className={`bg-zinc-900 rounded-xl p-4 border ${rarityFrame} hover:border-purple-500/40 transition-all`}>
                        <div
                          className="h-28 rounded-lg border border-white/10 mb-3 overflow-hidden"
                          style={getThemeStyle(theme)}
                        />
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg font-bold text-purple-200">{theme.name}</span>
                          {owned ? (
                            <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                              Owned
                            </span>
                          ) : (
                            <span className="text-xs text-yellow-300 font-semibold">
                              {Number(theme.price_coins || 0).toLocaleString()} coins
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-3">
                          <span>{(theme.rarity || 'common').toUpperCase()}</span>
                          {isAnimated && <span className="text-cyan-200">Animated</span>}
                          {isLimited && <span className="text-pink-200">Limited</span>}
                          {isExclusive && <span className="text-amber-200">Exclusive</span>}
                        </div>
                        {!eligibility.isEligible && (
                          <div className="text-xs text-red-200 mb-3 space-y-1">
                            <div>{eligibility.seasonalState || 'Locked'}</div>
                            {eligibility.requiresStreamer && !eligibility.meetsStreamer && (
                              <div className="text-[11px] text-white/60">
                                Needs
                                {eligibility.minLevel ? ` Lv ${eligibility.minLevel}` : ''}
                                {eligibility.minFollowers ? ` • ${eligibility.minFollowers}+ followers` : ''}
                                {eligibility.minHours ? ` • ${eligibility.minHours}+ hrs` : ''}
                              </div>
                            )}
                          </div>
                        )}
                        {eligibility.isEligible && eligibility.seasonalState && (
                          <div className="text-xs text-yellow-200 mb-3">{eligibility.seasonalState}</div>
                        )}
                        <button
                          type="button"
                          disabled={purchaseDisabled}
                          onClick={() => buyBroadcastTheme(theme)}
                          className="w-full py-2 rounded-lg text-sm font-semibold border border-pink-500/50 text-pink-100 hover:text-white hover:border-pink-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {owned
                            ? 'Owned'
                            : themePurchasing === theme.id
                              ? 'Purchasing...'
                              : Number(theme.price_coins || 0) === 0
                                ? 'Claim Free'
                                : eligibility.isEligible
                                  ? 'Buy Theme'
                                  : 'Locked'}
                        </button>
                      </div>
                    );
                  })}
                  {broadcastThemes.length === 0 && !themesNote && (
                    <div className="text-sm text-gray-400">No broadcast themes available yet.</div>
                  )}
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
                
                <div className="flex items-center gap-2 mb-4 bg-zinc-900/50 p-3 rounded-lg border border-purple-500/20 overflow-x-auto">
                  <span className="text-sm text-gray-400 whitespace-nowrap">Duration Multiplier:</span>
                  <div className="flex gap-2">
                    {[1, 2, 4, 6, 8].map(m => (
                      <button
                        key={m}
                        onClick={() => setDurationMultiplier(m)}
                        className={`px-3 py-1 rounded text-sm font-bold transition-all ${
                          durationMultiplier === m 
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50 scale-105' 
                            : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'
                        }`}
                      >
                        {m}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {perks.map((p) => (
                    <div key={p.id} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
                      <div className="font-semibold mb-2">{p.name}</div>
                      <div className="text-sm text-gray-400 mb-3">{p.description}</div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-yellow-400 font-bold">{(getPerkPrice(p) * durationMultiplier).toLocaleString()} Troll Coins</div>
                          {durationMultiplier > 1 && (
                            <div className="text-xs text-purple-300">
                              {durationMultiplier}x duration ({(p.duration_minutes * durationMultiplier).toLocaleString()} mins)
                            </div>
                          )}
                        </div>
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
                  Call minutes are priced in Troll Coins only.
                </p>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-purple-300 mb-3">Call Sounds</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {callSounds.map((sound) => {
                        const owned = ownedCallSoundIds.has(sound.id);
                        const isActive = activeCallSounds[sound.sound_type] === sound.id;
                        return (
                          <div key={sound.id} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
                            <div className="font-semibold mb-1">{sound.name}</div>
                            <div className="text-xs text-gray-400 mb-2">{sound.sound_type}</div>
                            <div className="text-sm text-gray-300">
                              {formatCoins(sound.price_coins)} Troll Coins
                            </div>
                            <button
                              type="button"
                              onClick={() => buyCallSound(sound)}
                              disabled={owned || callSoundPurchasing === sound.id}
                              className="mt-4 w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded font-semibold"
                            >
                              {owned ? (isActive ? 'Owned • Active' : 'Owned') : callSoundPurchasing === sound.id ? 'Processing...' : 'Purchase'}
                            </button>
                          </div>
                        );
                      })}
                      {callSounds.length === 0 && (
                        <div className="text-gray-400">No call sounds available</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-purple-300 mb-3">Audio Call Packages</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {callPackages.audio.map((pkg) => (
                        <div key={pkg.id} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
                          <div className="font-semibold mb-1">{pkg.name}</div>
                          <div className="text-sm text-gray-400 mb-3">{pkg.minutes.toLocaleString()} minutes</div>
                          <div className="text-sm text-gray-300">
                            {formatCoins(pkg.totalCost)} Troll Coins
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
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-purple-300 mb-3">Video Call Packages</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {callPackages.video.map((pkg) => (
                        <div key={pkg.id} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
                          <div className="font-semibold mb-1">{pkg.name}</div>
                          <div className="text-sm text-gray-400 mb-3">{pkg.minutes.toLocaleString()} minutes</div>
                          <div className="text-sm text-gray-300">
                            {formatCoins(pkg.totalCost)} Troll Coins
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
                      ))}
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
                
                <div className="flex items-center gap-2 mb-4 bg-zinc-900/50 p-3 rounded-lg border border-purple-500/20 overflow-x-auto">
                  <span className="text-sm text-gray-400 whitespace-nowrap">Duration Multiplier:</span>
                  <div className="flex gap-2">
                    {[1, 2, 4, 6, 8].map(m => (
                      <button
                        key={m}
                        onClick={() => setDurationMultiplier(m)}
                        className={`px-3 py-1 rounded text-sm font-bold transition-all ${
                          durationMultiplier === m 
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50 scale-105' 
                            : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'
                        }`}
                      >
                        {m}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plans.map((p) => (
                    <div key={p.id} className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
                      <div className="font-semibold mb-2">{p.name}</div>
                      <div className="text-sm text-gray-400 mb-2">{p.protection_type} protection</div>
                      <div className="text-xs text-gray-500 mb-3">{p.description}</div>
                      <div className="text-xs text-gray-500 mb-3">
                        Base Duration: {p.duration_hours} hours
                        {durationMultiplier > 1 && <span className="text-purple-400 ml-2">({p.duration_hours * durationMultiplier} hours total)</span>}
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-yellow-400 font-bold">{((p.cost || 0) * durationMultiplier).toLocaleString()} Troll Coins</div>
                        </div>
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
                  <p className="font-semibold">{STRIPE_ENABLED ? 'Pay with Stripe' : 'Pay via Cash App'}</p>
                  <p className="text-sm text-gray-400">
                    {STRIPE_ENABLED ? 'Secure payment processing through Stripe' : 'Send to $trollcity95 with note: PREFIX-COINS (first 6 chars of username and coin amount)'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm">3</span>
                </div>
                <div>
                  <p className="font-semibold">Coins Added After Payment</p>
                  <p className="text-sm text-gray-400">Coins are only added after successful Stripe payment completion</p>
                </div>
              </div>
            </div>
          </div>

          {paymentModalOpen && pendingPackage && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-[#0D0D1A] border border-[#2C2C2C] rounded-xl p-6 w-full max-w-lg max-h-[100dvh] overflow-y-auto">
                <h3 className="text-lg font-semibold mb-2">Complete payment</h3>
                {STRIPE_ENABLED ? (
                  <>
                    <p className="text-sm text-gray-400 mb-4">Confirm your Stripe payment to finish this purchase.</p>
                    {savedMethods.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {savedMethods.map((method) => (
                          <div key={method.id} className="flex items-center justify-between px-3 py-2 rounded border border-[#2C2C2C]">
                            <div>
                              <div className="text-sm font-medium">
                                {method.display_name || method.brand || 'Payment Method'}{method.is_default ? ' • Default' : ''}
                              </div>
                              {method.last4 ? (
                                <div className="text-xs text-gray-400">•••• {method.last4}</div>
                              ) : (
                                <div className="text-xs text-gray-500">Saved method</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div id="stripe-coin-payment-element" className="p-3 rounded border border-[#2C2C2C] bg-black mb-3" />
                    {paymentSetupLoading && (<div className="text-xs text-gray-400 mb-3">Loading payment options…</div>)}
                    {paymentError && (<div className="text-xs text-red-400 mb-3">{paymentError}</div>)}
                    <div className="text-xs text-gray-500 mb-4">Stripe verifies methods automatically (you may see a $0.00 authorization).</div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-yellow-200 mb-4">Send payment to <span className="font-semibold">$trollcity95</span>. In the Cash App note, include: <span className="font-mono">PREFIX-COINS</span> (first 6 characters of your username and coin amount).</p>
                    {manualOrderRefId && (
                      <div className="text-xs text-yellow-300 mb-3">Reference ID: {manualOrderRefId}. Keep this for support.</div>
                    )}
                    <div className="text-xs text-gray-400 mb-4">Coins are granted after manual verification.</div>
                    {(isAdmin || isSecretary) && (
                      <div className="flex items-center justify-between bg-emerald-900/30 border border-emerald-500/30 rounded p-2 mb-3 text-xs text-emerald-100">
                        <span>Staff: manage manual payments</span>
                        <a
                          href="/admin/manual-orders"
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-white text-xs font-semibold"
                        >
                          Open dashboard
                        </a>
                      </div>
                    )}
                  </>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={closePaymentModal}
                    className="px-4 py-2 rounded bg-gray-700"
                  >
                    Cancel
                  </button>
                  {STRIPE_ENABLED ? (
                    <button
                      type="button"
                      onClick={handleConfirmPayment}
                      disabled={paymentProcessing || paymentSetupLoading}
                      className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                    >
                      {paymentProcessing ? 'Processing…' : 'Confirm Payment'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={closePaymentModal}
                      className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-700"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )
  );
}
