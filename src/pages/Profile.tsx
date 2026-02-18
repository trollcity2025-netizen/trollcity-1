import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useInRouterContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../lib/store';
import { useXPStore } from '../stores/useXPStore';
import CreditScoreBadge from '../components/CreditScoreBadge';
import BadgesGrid from '../components/badges/BadgesGrid';     
import UserBadge from '../components/UserBadge';
import { useCreditScore as _useCreditScore } from '../lib/hooks/useCreditScore';
import { useProfileViewPayment as _useProfileViewPayment } from '../hooks/useProfileViewPayment';
import { getLevelName } from '../lib/xp';
import { ENTRANCE_EFFECTS_MAP, EntranceEffect } from '../lib/entranceEffects';
import { Loader2, MessageCircle, UserPlus, Settings, MapPin, Link as LinkIcon, Calendar, Package, Shield, Zap, Phone, Coins, Mail, Bell, BellOff, LogOut, ChevronDown, Car, RefreshCw, Home, Mars, Venus, Trash2, CheckCircle, CreditCard, FileText, Palette, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { PERK_CONFIG } from '@/lib/perkSystem';
import { canMessageAdmin, getGlowingTextStyle } from '@/lib/perkEffects';
import { GlowingUsernameColorPicker } from '../components/GlowingUsernameColorPicker';
import { cars } from '../data/vehicles';
import { trollCityTheme } from '../styles/trollCityTheme';
import ProfileFeed from '../components/profile/ProfileFeed';

function ProfileInner() {
  const { username, userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, profile: currentUserProfile } = useAuth();
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const { fetchXP, subscribeToXP, unsubscribe } = useXPStore();
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileLive, setIsProfileLive] = useState(false);
  const [activeTab, setActiveTab] = useState('social');
  const [showColorPickerModal, setShowColorPickerModal] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [inventory, setInventory] = useState<{
    perks: any[], 
    effects: any[], 
    insurance: any[], 
    callMinutes: any, 
    homeListings: any[], 
    vehicleListings: any[],
    vehicles: any[],
    titlesAndDeeds: any[]
  }>({
    perks: [], 
    effects: [], 
    insurance: [], 
    callMinutes: null, 
    homeListings: [], 
    vehicleListings: [],
    vehicles: [],
    titlesAndDeeds: []
  });
  const [showInsuranceCard, setShowInsuranceCard] = useState<any | null>(null);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const viewerRole = useAuthStore.getState().profile?.troll_role || useAuthStore.getState().profile?.role || 'user';
  const [postsCount, setPostsCount] = useState(0);
  const [announcementsEnabled, setAnnouncementsEnabled] = useState(true);
  const [bannerNotificationsEnabled, setBannerNotificationsEnabled] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [isTabDropdownOpen, setIsTabDropdownOpen] = useState(false);
  const tabDropdownRef = useRef<HTMLDivElement | null>(null);

  // DISABLED - These hooks were causing multiple API calls and re-renders on load
  // const memoizedProfileId = useMemo(() => profile?.id, [profile?.id]);
  // const { data: creditData, loading: creditLoading } = useCreditScore(memoizedProfileId);

  // Profile Costs State
  const [messageCost, setMessageCost] = useState(0);
  const [viewCost, setViewCost] = useState(0);

  const _handlePaymentComplete = useCallback(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Disabled hooks - were causing multiple API calls and re-renders on load
  const creditData = null;
  const creditLoading = false;
  const paymentChecking = false;
  const canView = true;

  const handleUpdateCosts = async () => {
    if (!currentUser || currentUser.id !== profile.id) return;
    
    try {
      setSavingPreferences(true);
      
      const { error } = await supabase.rpc('update_profile_costs', {
        p_message_cost: messageCost,
        p_view_cost: viewCost
      });

      if (error) throw error;
      
      toast.success('Profile costs updated successfully');
      
      // Update local profile state
      setProfile((prev: any) => ({
        ...prev,
        message_cost: messageCost,
        profile_view_cost: viewCost
      }));
    } catch (error) {
      console.error('Error updating costs:', error);
      toast.error('Failed to update profile costs');
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleClearCacheReload = () => {
    try {
      if (currentUser?.id) {
        const keysToRemove = [
          `tc-profile-${currentUser.id}`,
          `trollcity_car_${currentUser.id}`,
          `trollcity_owned_vehicles_${currentUser.id}`,
          `trollcity_car_insurance_${currentUser.id}`,
          `trollcity_vehicle_condition_${currentUser.id}`,
          `trollcity_home_owned_${currentUser.id}`
        ];

        keysToRemove.forEach((key) => localStorage.removeItem(key));
      }

      localStorage.removeItem('pwa-installed');
      sessionStorage.clear();
    } catch {}

    window.location.reload();
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    
    if (!window.confirm('Are you sure you want to PERMANENTLY delete your account? This action cannot be undone and you will lose all progress, coins, and items.')) {
      return;
    }

    // Double confirmation
    const confirmUsername = window.prompt(`Please type your username "${currentUserProfile?.username}" to confirm deletion:`);
    if (confirmUsername !== currentUserProfile?.username) {
      toast.error('Username does not match. Deletion cancelled.');
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase.rpc('delete_own_account');
      
      if (error) throw error;
      
      toast.success('Account deleted successfully');
      
      // Cleanup local state
      handleClearCacheReload(); // This clears storage and reloads, but we should redirect
      navigate('/auth');
      
    } catch (e: any) {
      console.error('Delete account error:', e);
      toast.error(e?.message || 'Failed to delete account');
      setLoading(false);
    }
  };

  const handleSetEntranceEffect = async (effectId: string | null) => {
    if (!currentUser || currentUser.id !== profile.id) return;
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ active_entrance_effect: effectId })
        .eq('id', currentUser.id);

      if (error) throw error;

      // Update local profile state
      setProfile((prev: any) => ({
        ...prev,
        active_entrance_effect: effectId
      }));

      if (effectId) {
         const effectName = ENTRANCE_EFFECTS_MAP[effectId]?.name || 'Effect';
         toast.success(`Equipped ${effectName}`);
      } else {
         toast.success('Entrance effect unequipped');
      }

    } catch (e: any) {
      console.error('Error setting entrance effect:', e);
      toast.error('Failed to update entrance effect');
    }
  };

  const fetchInventory = useCallback(async (uid: string) => {
    // setInventoryLoading(true);
    try {
      const results = await Promise.all([
        supabase.from('user_perks').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
        supabase.from('user_entrance_effects').select('*').eq('user_id', uid),
        supabase.from('user_insurances').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
        supabase.from('call_minutes').select('*').eq('user_id', uid).single(),
        supabase.from('properties').select('*').eq('owner_user_id', uid).eq('is_listed', true).order('created_at', { ascending: false }),
        supabase.from('vehicle_listings').select('*').eq('seller_id', uid).eq('status', 'active').order('created_at', { ascending: false }),
        supabase.from('user_vehicles').select('*, vehicles_catalog(*)').eq('user_id', uid).order('purchased_at', { ascending: false }),
        supabase.from('user_inventory').select('*').eq('user_id', uid)
      ]);

      const perksRes = results[0];
      const effectsRes = results[1];
      const insuranceUserRes = results[2];
      const callRes = results[3];
      const homesRes = results[4];
      const vehicleListingsRes = results[5];
      const vehiclesRes = results[6];
      const inventoryRes = results[7];

      // Manual fetch for marketplace items to avoid 400 Bad Request on join
      let titlesAndDeedsData = inventoryRes.data || [];
      if (titlesAndDeedsData.length > 0) {
        try {
          const itemIds = titlesAndDeedsData.map((i: any) => i.item_id).filter(Boolean);
          if (itemIds.length > 0) {
             const { data: items } = await supabase
              .from('marketplace_items')
              .select('*')
              .in('id', itemIds);
             
             if (items) {
               const itemMap = new Map(items.map((i: any) => [i.id, i]));
               titlesAndDeedsData = titlesAndDeedsData.map((entry: any) => ({
                 ...entry,
                 marketplace_item: itemMap.get(entry.item_id)
               }));
             }
          }
        } catch (err) {
          console.error('Error fetching marketplace items:', err);
        }
      }

      let insuranceList = insuranceUserRes.data || [];

      // Client-side join to insurance_plans/options for names
      try {
        const rawIds = (insuranceList || []).map((p: any) => p.insurance_id || p.plan_id).filter(Boolean);
        
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const uuidIds = rawIds.filter((id: string) => uuidRegex.test(id));
        const slugIds = rawIds.filter((id: string) => !uuidRegex.test(id));
        
        const planMap = new Map<string, any>();

        if (uuidIds.length > 0) {
          const { data: plans } = await supabase
            .from('insurance_plans')
            .select('id,name,description')
            .in('id', Array.from(new Set(uuidIds)));
          (plans || []).forEach((pl: any) => planMap.set(pl.id, pl));
        }

        if (slugIds.length > 0) {
           const { data: options } = await supabase
             .from('insurance_options')
             .select('id,name,description')
             .in('id', Array.from(new Set(slugIds)));
           (options || []).forEach((o: any) => planMap.set(o.id, o));
        }
          
        insuranceList = (insuranceList || []).map((row: any) => {
            const id = row.insurance_id || row.plan_id;
            const plan = planMap.get(id);
            return {
                ...row,
                metadata: {
                    ...(row.metadata || {}),
                    plan_name: plan?.name || row.metadata?.plan_name || id,
                    plan_description: plan?.description || row.metadata?.plan_description || 'Insurance Plan'
                }
            };
        });
      } catch (err) {
          console.error('Error fetching insurance plans:', err);
      }

      setInventory({
        perks: perksRes.data || [],
        effects: effectsRes.data || [],
        insurance: insuranceList || [],
        callMinutes: callRes.data || null,
        homeListings: homesRes.data || [],
        vehicleListings: vehicleListingsRes.data || [],
        vehicles: vehiclesRes.data || [],
        titlesAndDeeds: titlesAndDeedsData || []
      });
    } catch (e) {
      console.error('Error fetching inventory', e);
    } finally {
      // setInventoryLoading(false);
    }
  }, []);

  const fetchEarnings = useCallback(async (uid: string) => {
    setEarningsLoading(true);
    try {
      const { data } = await supabase
        .from('coin_transactions')
        .select('*')
        .eq('user_id', uid)
        .gt('amount', 0)
        .in('type', ['gift_received', 'reward', 'purchase', 'admin_grant'])
        .order('created_at', { ascending: false })
        .limit(50);
      setEarnings(data || []);
    } catch (e) {
      console.error('Error fetching earnings', e);
    } finally {
      setEarningsLoading(false);
    }
  }, []);

  const [purchases, setPurchases] = useState<any[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);

  const fetchPurchases = useCallback(async (uid: string) => {
    setPurchasesLoading(true);
    try {
      const { data } = await supabase
        .from('coin_transactions')
        .select('*')
        .eq('user_id', uid)
        .lt('amount', 0) // Spent
        .order('created_at', { ascending: false })
        .limit(50);
      setPurchases(data || []);
    } catch (e) {
      console.error('Error fetching purchases', e);
    } finally {
      setPurchasesLoading(false);
    }
  }, []);

  // Move const declarations before useEffects that use them
  const isOwnProfile = currentUser?.id === profile?.id;
  const canSeeFullProfile = isOwnProfile;
  const isAdminViewer =
    viewerRole === 'admin' ||
    viewerRole === 'troll_officer' ||
    viewerRole === 'lead_troll_officer';
  const tabOptions = [
    { key: 'social', label: 'Social', show: true },
    { key: 'inventory', label: 'Inventory & Perks', show: canSeeFullProfile },
    { key: 'earnings', label: 'Earnings', show: canSeeFullProfile },
    { key: 'purchases', label: 'Purchase History', show: canSeeFullProfile },
    { key: 'admin_titles', label: 'Admin Titles', show: canSeeFullProfile && isAdminViewer },
    { key: 'settings', label: 'Settings', show: isOwnProfile },
  ];
  const activeTabLabel = tabOptions.find((option) => option.key === activeTab)?.label || 'Posts';

  useEffect(() => {
    if (!isOwnProfile || !profile?.id) return;
    if (activeTab === 'earnings') {
      fetchEarnings(profile.id);
    }
    if (activeTab === 'purchases') {
      fetchPurchases(profile.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, profile?.id, isOwnProfile]);

  const handleRepurchasePerk = async (perk: any) => {
    if (!currentUser || currentUser.id !== profile.id) return;
    
    const config = PERK_CONFIG[perk.perk_id as keyof typeof PERK_CONFIG];
    if (!config) {
        toast.error("Perk configuration not found");
        return;
    }

    if ((profile.troll_coins || 0) < config.cost) {
        toast.error(`Insufficient coins. Need ${config.cost.toLocaleString()}`);
        return;
    }

    const metadata = { 
        perk_name: config.name, 
        description: config.description,
        perk_type: config.type, // Ensure type is passed if available
        base_cost: config.cost,
        final_cost: config.cost,
        duration_minutes: config.duration_minutes
    };

    const { error } = await supabase.rpc('shop_buy_perk', {
        p_user_id: currentUser.id,
        p_perk_id: perk.perk_id,
        p_cost: config.cost,
        p_duration_minutes: config.duration_minutes,
        p_metadata: metadata
    });

    if (error) {
        console.error('Repurchase error:', error);
        toast.error('Failed to repurchase perk');
        return;
    }

    if (perk.perk_id === 'perk_rgb_username') {
        await refreshProfile();
    }

    toast.success('Perk repurchased successfully!');
    fetchInventory(currentUser.id);
  };

  const togglePerk = async (perkId: string, isActive: boolean) => {
      if (!currentUser || currentUser.id !== profile.id) return;
      
      // Use secure RPC to toggle perk and handle side effects (like RGB username)
      const { error } = await supabase.rpc('toggle_user_perk', {
        p_perk_id: perkId,
        p_is_active: !isActive // The UI passes the CURRENT state, so we want to flip it? Wait.
      });
      // Logic check: The UI calls togglePerk(perk.id, perk.is_active). 
      // If perk.is_active is true, we want to set it to false.
      // So !isActive is correct for the new state.

      if (error) {
          console.error('Toggle perk error:', error);
          toast.error('Failed to update perk');
          return;
      }

      // Check if it was RGB to refresh profile
      const perk = inventory.perks.find(p => p.id === perkId);
      if (perk && perk.perk_id === 'perk_rgb_username') {
          await refreshProfile();
      }

      toast.success(`Perk ${!isActive ? 'activated' : 'deactivated'}`);
      fetchInventory(currentUser.id);
  };

  const [isFollowing, setIsFollowing] = useState(false);

  // Track if this is the initial load (not a re-render)
  const initialLoadRef = useRef(true);
  const prevProfileIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Auto-scroll to top on page load
    window.scrollTo(0, 0);

    let isMounted = true;

    const fetchProfile = async () => {
      // Determine the target ID before any early returns
      let targetId: string | null = null;
      if (userId) {
        targetId = userId;
      } else if (username) {
        // Will resolve username to ID in the query
      } else if (currentUser?.id) {
        targetId = currentUser.id;
      }
      
      // Only show loading spinner on initial load or when viewing a different profile
      // This prevents flashing on re-renders
      const isDifferentProfile = prevProfileIdRef.current !== targetId && !username;
      if (initialLoadRef.current || isDifferentProfile) {
        if (!isMounted) return;
        setLoading(true);
      }
      
      // Always fetch fresh XP data for own profile
      if (currentUser?.id) {
        console.log('Fetching fresh XP data for user:', currentUser.id);
        fetchXP(currentUser.id);
        subscribeToXP(currentUser.id);
      }
      
      // Build the query
      let query = supabase.from('user_profiles').select('*');
      
      if (userId) {
        query = query.eq('id', userId);
      } else if (username) {
        query = query.eq('username', username);
      } else if (currentUser?.id) {
         query = query.eq('id', currentUser.id);
      } else {
         if (isMounted) setLoading(false);
         return;
      }

      const { data, error } = await query.maybeSingle();
      
      if (error || !data) {
        console.error('Profile not found', error);
        if (isMounted) setLoading(false);
        return;
      }

      // Track the profile ID for future comparisons
      prevProfileIdRef.current = data.id;
      initialLoadRef.current = false;

      // Fetch all related data in parallel
      const [followersRes, followingRes, postsRes, statsRes] = await Promise.all([
        supabase
          .from('user_follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', data.id),
        supabase
          .from('user_follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', data.id),
        supabase
          .from('troll_posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', data.id),
        supabase
          .from('user_stats')
          .select('level')
          .eq('user_id', data.id)
          .maybeSingle()
      ]);

      // Override profile level with stats level if available (source of truth)
      if (statsRes.data?.level) {
        console.log('Overriding profile level with stats level:', statsRes.data.level);
        data.level = statsRes.data.level;
      }
      
      // BATCH ALL UPDATES INTO SINGLE STATE CALLS
      // This prevents flashing from multiple re-renders
      if (isMounted) {
        setProfile(data);
        setFollowersCount(followersRes.count || 0);
        setFollowingCount(followingRes.count || 0);
        setPostsCount(postsRes.count || 0);
        
        if (currentUser?.id === data.id) {
          setMessageCost(data.message_cost || 0);
          setViewCost(data.profile_view_cost || 0);
          // Fetch inventory for own profile only
          fetchInventory(data.id);
        } else {
          // Reset inventory for other profiles
          setInventory({ perks: [], effects: [], insurance: [], callMinutes: null, homeListings: [], vehicleListings: [], vehicles: [], titlesAndDeeds: [] });
          setEarnings([]);
          setPurchases([]);
        }
        
        setLoading(false);
      }
    };

    fetchProfile();
    
    // Set up real-time subscription for profile updates with debouncing
    if (userId || username) {
      let debounceTimer: ReturnType<typeof setTimeout>;
      
      const channel = supabase
        .channel(`profile-updates-${userId || username}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_profiles',
            filter: userId ? `id=eq.${userId}` : `username=eq.${username}`
          },
          (payload) => {
            // Only update profile data if critical info changed
            // DO NOT call fetchProfile again as it creates a loop with inventory fetches
            const newP = payload.new as any;
            const oldP = payload.old as any;
            
            if (
                newP.coins !== oldP.coins || 
                newP.troll_coins !== oldP.troll_coins ||
                newP.level !== oldP.level
            ) {
                console.log('Profile balance/level updated in real-time, updating local state only');
                
                // Update profile state directly without refetching inventory
                setProfile((prev: any) => ({
                  ...prev,
                  coins: newP.coins,
                  troll_coins: newP.troll_coins,
                  level: newP.level
                }));
            }
          }
        )
        .subscribe()
      
      return () => {
        isMounted = false;
        clearTimeout(debounceTimer);
        supabase.removeChannel(channel);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, userId, currentUser?.id]);

  // Cleanup XP subscription on unmount
  useEffect(() => {
    return () => {
      try {
        unsubscribe();
      } catch (err) {
        console.error('Error unsubscribe from XP store:', err);
      }
    };
  }, [unsubscribe]);

  // Live status check - prevent unnecessary re-renders
  useEffect(() => {
    if (!profile?.id) return;

    let isMounted = true;
    
    const checkLiveStatus = async () => {
      try {
        const { data } = await supabase
          .from('streams')
          .select('id')
          .eq('broadcaster_id', profile.id)
          .eq('is_live', true)
          .maybeSingle();
        
        if (isMounted) {
          setIsProfileLive(!!data);
        }
      } catch (err) {
        console.error('Error checking live status:', err);
      }
    };
    
    checkLiveStatus();
    
    const channel = supabase
      .channel(`profile-live-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'streams',
          filter: `broadcaster_id=eq.${profile.id}`
        },
        () => checkLiveStatus()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // Check follow status - with precise dependencies to prevent excessive checks
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!currentUser || !profile?.id) return;

      const { data } = await supabase
        .from('user_follows')
        .select('*')
        .eq('follower_id', currentUser.id)
        .eq('following_id', profile.id)
        .maybeSingle();
      
      setIsFollowing(!!data);
    };

    checkFollowStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, profile?.id]);

  const handleFollow = async () => {
    if (!currentUser) {
      toast.error('Please login to follow users');
      return;
    }
    
    if (isFollowing) {
      const { error } = await supabase.from('user_follows').delete().match({ follower_id: currentUser.id, following_id: profile.id });
      if (error) {
        console.error('Error unfollowing:', error);
        toast.error('Failed to unfollow user');
        return;
      }
      setIsFollowing(false);
      setFollowersCount(prev => Math.max(0, prev - 1));
      toast.success(`Unfollowed ${profile.username}`);
    } else {
      const { error } = await supabase.from('user_follows').insert({ follower_id: currentUser.id, following_id: profile.id });
      if (error) {
        console.error('Error following:', error);
        toast.error('Failed to follow user');
        return;
      }
      setIsFollowing(true);
      setFollowersCount(prev => prev + 1);
      toast.success(`Followed ${profile.username}`);
    }
  };

  const handleMessage = async () => {
    if (!currentUser) {
      toast.error('Please login to message users');
      return;
    }

    // If profile is admin, check for perk or follow
    const isAdmin = profile.role === 'admin' || profile.is_admin;
    
    if (isAdmin) {
        // Check if THEY follow ME
        const { data: followedByData } = await supabase
          .from('user_follows')
          .select('*')
          .eq('follower_id', profile.id)
          .eq('following_id', currentUser.id)
          .maybeSingle();
        
        const isFollowedByProfile = !!followedByData;
        const hasPerk = await canMessageAdmin(currentUser.id);

        if (!isFollowedByProfile && !hasPerk) {
            toast.error("You need the 'Message Admin' perk or be followed by the Admin to message them!");
            return;
        }
    }
    
    navigate(`/tcps?user=${profile.id}`);
  };

  // Defer early returns to after hooks to satisfy lint rules

  // Load announcement preferences - only trigger when these specific properties change
  useEffect(() => {
    if (isOwnProfile && profile?.announcements_enabled !== undefined) {
      setAnnouncementsEnabled(profile.announcements_enabled);
    }
    if (isOwnProfile && profile?.banner_notifications_enabled !== undefined) {
      setBannerNotificationsEnabled(profile.banner_notifications_enabled);
    }
  }, [isOwnProfile, profile?.announcements_enabled, profile?.banner_notifications_enabled]);

  const toggleAnnouncements = async () => {
    if (!currentUser) return;
    setSavingPreferences(true);
    try {
      const newValue = !announcementsEnabled;
      const { error } = await supabase
        .from('user_profiles')
        .update({ announcements_enabled: newValue })
        .eq('id', currentUser.id);
      
      if (error) throw error;
      setAnnouncementsEnabled(newValue);
      toast.success(newValue ? 'Announcements enabled' : 'Announcements disabled');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update preferences');
    } finally {
      setSavingPreferences(false);
    }
  };

  const toggleBannerNotifications = async () => {
    if (!currentUser) return;
    setSavingPreferences(true);
    try {
      const newValue = !bannerNotificationsEnabled;
      const { error } = await supabase
        .from('user_profiles')
        .update({ banner_notifications_enabled: newValue })
        .eq('id', currentUser.id);
      
      if (error) throw error;
      setBannerNotificationsEnabled(newValue);
      toast.success(newValue ? 'Banner notifications enabled' : 'Banner notifications disabled');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update preferences');
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleTabSelect = (tabKey: string) => {
    setActiveTab(tabKey);
    setIsTabDropdownOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tabDropdownRef.current && !tabDropdownRef.current.contains(event.target as Node)) {
        setIsTabDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Logged out');
      navigate('/auth');
    } catch (e: any) {
      console.error('Logout error:', e);
      toast.error(e?.message || 'Failed to log out');
    }
  };







  if (loading || (profile && !isOwnProfile && (paymentChecking || !canView))) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${trollCityTheme.backgrounds.primary}`}>
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
       <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white p-8 flex items-center justify-center`}>
         <div className="text-center">
           <h2 className="text-xl font-bold mb-2">User not found</h2>
           <p className={trollCityTheme.text.muted}>The user you are looking for does not exist.</p>
           <button 
             onClick={() => navigate('/')}
             className={`mt-4 ${trollCityTheme.components.buttonPrimary} rounded-lg`}
           >
             Go Home
           </button>
         </div>
       </div>
    );
  }

  const hasRgbUsername = profile?.rgb_username_expires_at && new Date(profile.rgb_username_expires_at) > new Date();
  const glowingStyle = (!hasRgbUsername && profile?.glowing_username_color) ? getGlowingTextStyle(profile.glowing_username_color) : undefined;
  const isGold = profile?.is_gold || false;
  const style = (isGold && profile?.username_style === 'gold') ? { color: '#FFD700', textShadow: '0 0 10px #FFD700' } : undefined;

  return (
    <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white pb-20`}>
      {/* Banner / Cover Photo */}
      <div className="h-48 md:h-64 bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900 relative overflow-hidden">
        {profile.banner_url ? (
          <img 
            src={`${profile.banner_url}${profile.banner_url.includes('?') ? '&' : '?'}cb=${profile.updated_at || Date.now()}`}
            alt="Cover Photo" 
            className="w-full h-full object-contain bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900"
            style={{ objectFit: 'contain', objectPosition: 'center' }}
            onError={(e) => {
              console.error('Failed to load cover photo:', profile.banner_url)
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 text-sm">
            No cover photo
          </div>
        )}
      </div>
      
      {/* Profile Info */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="-mt-16 mb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
           <div className="flex items-end relative">
             <img
               src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`}
               alt={profile.username}
               className={`w-32 h-32 rounded-full border-4 border-slate-950 bg-slate-950 object-cover ${isProfileLive ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
               onError={(e) => {
                 e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`
               }}
               onClick={() => {
                 if (isProfileLive) {
                   navigate(`/live/${profile.id}`);
                 }
               }}
             />
             {isProfileLive && (
               <div className="absolute bottom-0 right-0 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full border-2 border-slate-950">
                 LIVE
               </div>
             )}
           </div>
           
           {/* Actions */}
           <div className="flex gap-2 mt-4 md:mt-0 mb-2">
              {isOwnProfile ? (
                <button 
                  onClick={() => navigate('/profile/setup')}
                  className={`${trollCityTheme.components.buttonSecondary} py-2 px-4 flex items-center gap-2`}
                >
                  <Settings size={18} />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <>
                  <button 
                    onClick={handleFollow}
                    className={`px-4 py-2 rounded-lg transition flex items-center gap-2 font-medium ${isFollowing ? 'bg-slate-800 hover:bg-slate-700' : trollCityTheme.gradients.button} shadow-lg`}
                  >
                    <UserPlus size={18} />
                    <span>{isFollowing ? 'Following' : 'Follow'}</span>
                  </button>
                  <button 
                    onClick={handleMessage}
                    className={`${trollCityTheme.components.buttonSecondary} py-2 px-4 flex items-center gap-2`}
                  >
                    <MessageCircle size={18} />
                    <span>Message</span>
                  </button>
                </>
              )}
           </div>
        </div>
        
        <div className="mt-2">
          <h1 className={`text-2xl font-bold flex items-center gap-2 ${hasRgbUsername ? 'rgb-username' : ''}`} style={glowingStyle}>
            {profile.display_name || profile.username}
            {(profile as any).gender === 'male' && (
              <Mars className="text-blue-400" size={16} />
            )}

            {(profile as any).gender === 'female' && (
              <Venus className="text-pink-400" size={16} />
            )}

            {profile.is_verified && (
              <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full" title="Verified">✓</span>
            )}

            <UserBadge profile={profile} />

            {isOwnProfile && (
              <button
                onClick={handleClearCacheReload}
                className="ml-1 p-1 rounded-md bg-white/10 hover:bg-white/20 text-gray-300"
                aria-label="Clear cache and reload"
                title="Clear cache and reload"
              >
                <RefreshCw size={12} />
              </button>
            )}
          </h1>
          <p className={`${trollCityTheme.text.muted} ${isGold ? 'gold-username font-bold' : hasRgbUsername ? 'rgb-username font-bold' : ''}`} style={style}>@{profile.username}</p>
          {profile.level !== undefined && (
            <p className="text-sm text-purple-400 font-semibold mt-1">
              Level {profile.level} · {getLevelName(profile.level)}
            </p>
          )}
        </div>
        
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl prose prose-invert prose-sm">
            <p>{(profile.bio || '').replace(/(https?:\/\/[^\s]+)/g, '').trim() || "No bio provided."}</p>
          </div>
          <div className="w-full max-w-sm md:max-w-xs">
            <CreditScoreBadge
              score={creditData?.score}
              tier={creditData?.tier}
              trend7d={creditData?.trend_7d}
              loading={creditLoading}
            />
          </div>
        </div>
        
        <div className={`flex flex-wrap gap-4 mt-4 text-sm ${trollCityTheme.text.muted}`}>
          {profile.location && (
            <div className="flex items-center gap-1">
              <MapPin size={14} />
              <span>{profile.location}</span>
            </div>
          )}
          {profile.website && (
            <div className="flex items-center gap-1">
              <LinkIcon size={14} />
              <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                {profile.website}
              </a>
            </div>
          )}
          {canSeeFullProfile && profile.email && (
            <div className="flex items-center gap-1 text-yellow-400/80">
              <Mail size={14} />
              <span>{profile.email}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Calendar size={14} />
            <span>Joined {new Date(profile.created_at || Date.now()).toLocaleDateString()}</span>
          </div>
          {profile.terms_accepted && (
            <div className="flex items-center gap-1 text-green-400">
              <FileText size={14} />
              <span>Agreement Accepted</span>
            </div>
          )}
        </div>
        
        {/* Stats */}
        <div className={`flex gap-6 mt-6 border-b border-white/10 pb-4 text-sm`}>
           <div className="flex gap-1 cursor-pointer hover:text-purple-400 transition" onClick={() => navigate(`/following/${profile.id}`)}>
             <span className="font-bold text-white">{followingCount}</span>
             <span className={trollCityTheme.text.muted}>Following</span>
           </div>
           <div className="flex gap-1 cursor-pointer hover:text-purple-400 transition" onClick={() => navigate(`/following/${profile.id}`)}>
             <span className="font-bold text-white">{followersCount}</span>
             <span className={trollCityTheme.text.muted}>Followers</span>
           </div>
           <div className="flex gap-1">
             <span className="font-bold text-white">{postsCount}</span>
             <span className={trollCityTheme.text.muted}>Posts</span>
           </div>
        </div>
        
        {/* Tabs */}
        {tabOptions.filter(o => o.show).length > 1 && (
        <div className="relative mt-6" ref={tabDropdownRef}>
          <button
            type="button"
            onClick={() => setIsTabDropdownOpen((prev) => !prev)}
            className={`w-full max-w-xs flex items-center justify-between px-4 py-2 ${trollCityTheme.components.input} rounded-2xl text-sm font-medium text-white hover:border-purple-500 transition-colors`}
          >
            <span>{activeTabLabel}</span>
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${isTabDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {isTabDropdownOpen && (
            <div className={`absolute left-0 right-0 mt-2 max-w-xs ${trollCityTheme.backgrounds.card} border border-white/10 rounded-2xl shadow-lg z-20 overflow-hidden`}>
              {tabOptions.filter((option) => option.show).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleTabSelect(option.key)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${activeTab === option.key ? 'text-purple-400 font-semibold bg-white/5' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        )}

        <div className="mt-6">
           {activeTab === 'social' && (
             <div className="space-y-6">
               
               {/* Badges Toggle */}
              <div className="flex justify-end mb-2">
                <details className="relative group">
                  <summary className={`list-none cursor-pointer px-4 py-2 ${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} hover:bg-white/5 rounded-xl text-sm font-medium text-white flex items-center gap-2 transition-colors`}>
                    <Shield className="w-4 h-4 text-yellow-400"/>
                    View Badges
                    <ChevronDown size={16} className="text-gray-400 group-open:rotate-180 transition-transform"/>
                  </summary>
                  <div className={`absolute right-0 top-full mt-2 w-[90vw] md:w-[600px] ${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-xl shadow-2xl z-50 p-6 max-h-[60vh] overflow-y-auto backdrop-blur-xl`}>
                      <BadgesGrid userId={profile.id} showViewAllLink={false} />
                   </div>
                </details>
              </div>

               <ProfileFeed userId={profile.id} />
             </div>
           )}

          {activeTab === 'inventory' && (
            <div className="space-y-8">
               {/* Perks */}
               <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-400"/> Active Perks</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {inventory.perks.map(perk => {
                      const isExpired = new Date(perk.expires_at) < new Date();
                      const config = PERK_CONFIG[perk.perk_id as keyof typeof PERK_CONFIG];
                      // Fallback name generation
                      const fallbackName = perk.perk_id ? perk.perk_id.replace(/^perk_/, '').replace(/_/g, ' ').toUpperCase() : 'Unknown Perk';
                      const displayName = config?.name || perk.metadata?.perk_name || fallbackName;

                      return (
                        <div key={perk.id} className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-4 rounded-xl`}>
                          <div className="flex justify-between items-start mb-2">
                             <h4 className="font-bold text-white">{displayName}</h4>
                             <span className={`px-2 py-0.5 rounded text-xs ${isExpired ? 'bg-red-900 text-red-200' : perk.is_active ? 'bg-green-900 text-green-200' : 'bg-gray-800 text-gray-400'}`}>
                               {isExpired ? 'EXPIRED' : perk.is_active ? 'ACTIVE' : 'INACTIVE'}
                             </span>
                          </div>
                          <p className={`text-sm ${trollCityTheme.text.muted} mb-3`}>{config?.description || perk.metadata?.description || 'No description available'}</p>
                          <p className={`text-sm ${trollCityTheme.text.muted} mb-3`}>Expires: {new Date(perk.expires_at).toLocaleString()}</p>
                          <div className="flex gap-2">
                            {!isExpired && isOwnProfile && (
                              <>
                              <button onClick={() => togglePerk(perk.id, perk.is_active)} className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs">
                                {perk.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              
                              {perk.perk_id === 'perk_global_highlight' && perk.is_active && (
                                <button
                                  onClick={() => setShowColorPickerModal(true)}
                                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs flex items-center gap-1"
                                >
                                  <Palette className="w-3 h-3" />
                                  Choose Color
                                </button>
                              )}
                              </>
                            )}
                            {(isExpired || !perk.is_active) && isOwnProfile && (
                              <button onClick={() => handleRepurchasePerk(perk)} className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs flex items-center gap-1">
                                <Coins size={12}/> Repurchase
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {inventory.perks.length === 0 && <p className={trollCityTheme.text.muted}>No perks found.</p>}
                  </div>
               </div>

               {/* Titles & Deeds */}
               <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-yellow-500"/> Titles & Deeds</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {inventory.titlesAndDeeds.map((item: any) => {
                      const title = item.marketplace_item?.title || item.metadata?.title || item.metadata?.name || 'Unknown Item';
                      const description = item.marketplace_item?.description || item.metadata?.description || 'No description available';
                      const imageUrl = item.marketplace_item?.image_url || item.metadata?.image_url || item.metadata?.image;
                      
                      return (
                      <div key={item.id} className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-4 rounded-xl flex items-start gap-4`}>
                         <div className="bg-zinc-800 p-2 rounded-lg">
                           {imageUrl ? (
                             <img src={imageUrl} alt={title} className="w-10 h-10 object-cover rounded" />
                           ) : (
                             <FileText className="w-8 h-8 text-gray-400" />
                           )}
                         </div>
                         <div>
                           <h4 className="font-bold text-white">{title}</h4>
                           <p className={`text-sm ${trollCityTheme.text.muted}`}>{description}</p>
                           <span className={`text-[10px] px-2 py-0.5 rounded uppercase mt-2 inline-block ${item.marketplace_item?.type === 'title' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30' : 'bg-blue-900/30 text-blue-400 border border-blue-500/30'}`}>
                             {item.marketplace_item?.type || item.metadata?.type || 'item'}
                           </span>
                         </div>
                      </div>
                    )})}
                    {inventory.titlesAndDeeds.length === 0 && <p className={trollCityTheme.text.muted}>No titles or deeds found.</p>}
                  </div>
               </div>

               {/* Call Minutes */}
               <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Phone className="w-5 h-5 text-green-400"/> Call Minutes</h3>
                  <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-4 rounded-xl`}>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <p className={`text-sm ${trollCityTheme.text.muted}`}>Audio Minutes</p>
                           <p className="text-2xl font-bold text-white">{inventory.callMinutes?.audio_minutes || 0}</p>
                        </div>
                        <div>
                           <p className={`text-sm ${trollCityTheme.text.muted}`}>Video Minutes</p>
                           <p className="text-2xl font-bold text-white">{inventory.callMinutes?.video_minutes || 0}</p>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Effects */}
               <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Package className="w-5 h-5 text-blue-400"/> Entrance Effects</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {inventory.effects.map(effect => {
                                               const effectData: Partial<EntranceEffect> = ENTRANCE_EFFECTS_MAP[effect.effect_id] || {};
                       const isActive = profile.active_entrance_effect === effect.effect_id;
                       
                       return (
                         <div key={effect.id} className={`${trollCityTheme.backgrounds.card} p-4 rounded-xl border ${isActive ? 'border-blue-500 bg-blue-500/10' : 'border-white/10'} flex justify-between items-center`}>
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{effectData.icon || '✨'}</span>
                              <div className="flex flex-col">
                                <span className="font-medium text-white">{effectData.name || effect.effect_id}</span>
                                {effectData.description && <span className={`text-xs ${trollCityTheme.text.muted}`}>{effectData.description}</span>}
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-2">
                                <span className={`text-xs px-2 py-1 rounded ${isActive ? 'bg-green-500 text-white' : 'bg-blue-900 text-blue-200'}`}>
                                    {isActive ? 'ACTIVE' : 'OWNED'}
                                </span>
                                
                                {isOwnProfile && (
                                    <button
                                        onClick={() => handleSetEntranceEffect(isActive ? null : effect.effect_id)}
                                        className={`px-3 py-1 text-xs rounded transition ${
                                            isActive 
                                            ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' 
                                            : 'bg-white/10 text-white hover:bg-white/20'
                                        }`}
                                    >
                                        {isActive ? 'Unequip' : 'Equip'}
                                    </button>
                                )}
                            </div>
                         </div>
                       );
                    })}
                    {inventory.effects.length === 0 && <p className={trollCityTheme.text.muted}>No effects found.</p>}
                  </div>
               </div>
               
              {/* Insurance */}
              <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-green-400"/> Troll Protection</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {inventory.insurance.map(plan => (
                       <div key={plan.id} className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-4 rounded-xl`}>
                          <h4 className="font-bold">{plan.metadata?.package_name || plan.metadata?.insurance_name || plan.metadata?.plan_name || 'Protection Plan'}</h4>
                          <p className={`text-sm ${trollCityTheme.text.muted}`}>Expires: {new Date(plan.expires_at).toLocaleString()}</p>
                       </div>
                    ))}
                    {inventory.insurance.length === 0 && <p className={trollCityTheme.text.muted}>No protection plans active.</p>}
               </div>
             </div>

              <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Car className="w-5 h-5 text-red-400" />
                  Vehicles
                </h3>
                <div className="space-y-4">
                  {inventory.vehicles.length > 0 ? (
                    inventory.vehicles.map((v: any) => {
                      const catalog = v.vehicles_catalog;
                      
                      // Legacy Fallback
                      let legacyCarConfig = null;
                      if (!catalog) {
                          if (v.customization_json?.car_model_id) {
                             legacyCarConfig = cars.find(c => c.id === v.customization_json.car_model_id);
                          } else if (v.car_id && !isNaN(Number(v.car_id))) {
                             legacyCarConfig = cars.find(c => c.id === Number(v.car_id));
                          }
                      }

                      const displayName = catalog?.name || legacyCarConfig?.name || `Vehicle #${v.id.slice(0,8)}`;
                      const displayImage = catalog?.image || legacyCarConfig?.image || null;
                      const displayTier = catalog?.tier || legacyCarConfig?.tier || null;

                      const isInsured = v.insurance_expiry && new Date(v.insurance_expiry) > new Date();
                      const isActive = String(profile.active_vehicle) === String(v.id);

                      return (
                        <div key={v.id} className={`${trollCityTheme.backgrounds.card} p-4 rounded-xl border ${isActive ? 'border-emerald-500/50 bg-emerald-900/10' : 'border-white/10'} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
                           <div className="flex items-center gap-4">
                             <div className="w-24 h-14 flex-shrink-0 flex items-center justify-center bg-black/40 rounded-lg border border-white/10 overflow-hidden p-1 relative">
                                {displayImage ? (
                                  <img 
                                    src={displayImage} 
                                    alt={displayName} 
                                    className="w-full h-full object-contain" 
                                  />
                                ) : (
                                  <Car className="text-zinc-600" />
                                )}
                                {isActive && (
                                  <div className="absolute top-0 right-0 p-1 bg-emerald-500 rounded-bl-lg">
                                    <CheckCircle size={10} className="text-white" />
                                  </div>
                                )}
                             </div>
                             <div>
                               <div className="flex items-center gap-2">
                                 <p className="font-bold text-white">{displayName}</p>
                                 {isActive && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">EQUIPPED</span>}
                               </div>
                               {displayTier && <p className={`text-xs ${trollCityTheme.text.muted}`}>{displayTier} Class</p>}
                               <div className="mt-1 flex items-center gap-2">
                                  {isInsured ? (
                                    <span className="flex items-center gap-1 text-xs text-green-400 font-medium bg-green-900/20 px-2 py-0.5 rounded border border-green-500/20">
                                      <Shield size={10} /> Insured
                                    </span>
                                  ) : (
                                    <span className={`text-xs ${trollCityTheme.text.muted} flex items-center gap-1`}>
                                      <Shield size={10} /> No Insurance
                                    </span>
                                  )}
                               </div>
                             </div>
                           </div>
                           
                           <div className="flex items-center gap-2 mt-2 md:mt-0">
                              {isInsured && (
                                <button
                                  onClick={() => setShowInsuranceCard({
                                    user: profile,
                                    vehicle: v,
                                    config: catalog || legacyCarConfig
                                  })}
                                  className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                                >
                                  <CreditCard size={14} /> View Card
                                </button>
                              )}
                              {isOwnProfile && (
                                <button
                                  type="button"
                                  onClick={() => navigate('/dealership')}
                                  className={`${trollCityTheme.components.buttonSecondary} px-3 py-1.5 text-xs font-medium transition-colors`}
                                >
                                  Manage
                                </button>
                              )}
                           </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-8 rounded-xl text-center`}>
                      <Car className={`w-12 h-12 ${trollCityTheme.text.muted} mx-auto mb-3`} />
                      <p className={`${trollCityTheme.text.muted} mb-4`}>No vehicles found in garage.</p>
                      {isOwnProfile && (
                         <button
                           onClick={() => navigate('/dealership')}
                           className={`${trollCityTheme.components.buttonPrimary} px-4 py-2 font-medium`}
                         >
                           Visit Dealership
                         </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {inventory.homeListings && inventory.homeListings.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Home className="w-5 h-5 text-emerald-400" />
                    Homes For Sale
                  </h3>
                  <div className="space-y-3">
                    {inventory.homeListings.map((home: any) => (
                      <div
                        key={home.id}
                        className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-4 rounded-xl flex items-center justify-between gap-4`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">
                            Home {String(home.id).slice(0, 6).toUpperCase()}
                            {home.is_starter ? ' • Starter' : ''}
                          </p>
                          {home.ask_price && (
                            <p className={`text-xs ${trollCityTheme.text.muted}`}>
                              Listed for {Number(home.ask_price).toLocaleString()} TrollCoins
                            </p>
                          )}
                        </div>
                        {isOwnProfile && (
                          <button
                            type="button"
                            onClick={() => navigate('/trollstown')}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium"
                          >
                            Manage In Troll Town
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inventory.vehicleListings && inventory.vehicleListings.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Car className="w-5 h-5 text-purple-400" />
                    Vehicle Listings
                  </h3>
                  <div className="space-y-3">
                    {inventory.vehicleListings.map((listing: any) => {
                      const vehicle = cars.find(c => c.id === listing.vehicle_id);
                      const name =
                        listing.metadata?.vehicle_name ||
                        vehicle?.name ||
                        `Vehicle #${listing.vehicle_id}`;
                      const tier =
                        listing.metadata?.tier ||
                        (vehicle as any)?.tier;
                      return (
                        <div
                          key={listing.id}
                          className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-4 rounded-xl flex items-center justify-between gap-4`}
                        >
                          <div>
                            <p className="text-sm font-semibold text-white">{name}</p>
                            <p className={`text-xs ${trollCityTheme.text.muted}`}>
                              {listing.listing_type === 'auction' ? 'Auction starting at ' : 'Listed for '}
                              {Number(listing.price).toLocaleString()} TrollCoins
                            </p>
                            {tier && (
                              <p className={`text-xs ${trollCityTheme.text.muted}`}>
                                Tier: {tier}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/10 text-gray-300">
                              {listing.listing_type === 'auction' ? 'Auction' : 'Sale'}
                            </span>
                            {isOwnProfile && (
                              <button
                                type="button"
                                onClick={() => navigate(listing.listing_type === 'auction' ? '/auctions' : '/dealership')}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium"
                              >
                                Manage Listing
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

           {activeTab === 'earnings' && (
             <div className="space-y-6">
                <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-6 rounded-xl flex items-center justify-between`}>
                   <div>
                      <p className={trollCityTheme.text.muted}>Total Earned</p>
                      <h3 className="text-3xl font-bold text-yellow-400 flex items-center gap-2">
                        <Coins className="w-6 h-6"/> {profile.total_earned_coins?.toLocaleString() || 0}
                      </h3>
                   </div>
                   <div className="text-right">
                      <p className={trollCityTheme.text.muted}>Current Balance</p>
                      <p className="text-xl font-bold text-white">{profile.troll_coins?.toLocaleString() || 0}</p>
                   </div>
                </div>

                <div className={`${trollCityTheme.backgrounds.card} rounded-xl border border-white/5 overflow-hidden`}>
                   <div className="p-4 border-b border-white/10">
                      <h4 className="font-bold">Recent Earnings</h4>
                   </div>
                   {earningsLoading ? (
                      <div className={`p-8 text-center ${trollCityTheme.text.muted}`}>Loading...</div>
                   ) : earnings.length > 0 ? (
                      <div className="divide-y divide-white/10">
                         {earnings.map(tx => (
                            <div key={tx.id} className="p-4 flex justify-between items-center">
                               <div>
                                  <p className="font-medium text-white capitalize">{tx.type.replace('_', ' ')}</p>
                                  <p className={`text-xs ${trollCityTheme.text.muted}`}>{new Date(tx.created_at).toLocaleString()}</p>
                               </div>
                               <span className="font-bold text-green-400">+{tx.amount.toLocaleString()} TC</span>
                            </div>
                         ))}
                      </div>
                   ) : (
                      <div className={`p-8 text-center ${trollCityTheme.text.muted}`}>No recent earnings found.</div>
                   )}
                </div>
             </div>
           )}

           {activeTab === 'purchases' && (
             <div className="space-y-6">
                <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-6 rounded-xl flex items-center justify-between`}>
                   <div>
                      <p className={trollCityTheme.text.muted}>Total Spent</p>
                      <h3 className="text-3xl font-bold text-red-400 flex items-center gap-2">
                        <Coins className="w-6 h-6"/> {profile.total_spent_coins?.toLocaleString() || 0}
                      </h3>
                   </div>
                   <div className="text-right">
                      <p className={trollCityTheme.text.muted}>Current Balance</p>
                      <p className="text-xl font-bold text-white">{profile.troll_coins?.toLocaleString() || 0}</p>
                   </div>
                </div>

                <div className={`${trollCityTheme.backgrounds.card} rounded-xl border border-white/5 overflow-hidden`}>
                   <div className="p-4 border-b border-white/10">
                      <h4 className="font-bold">Recent Purchases</h4>
                   </div>
                   {purchasesLoading ? (
                      <div className={`p-8 text-center ${trollCityTheme.text.muted}`}>Loading...</div>
                   ) : purchases.length > 0 ? (
                      <div className="divide-y divide-white/10">
                         {purchases.map(tx => (
                            <div key={tx.id} className="p-4 flex justify-between items-center">
                               <div>
                                  <p className="font-medium text-white capitalize">
                                    {tx.metadata?.perk_name || tx.type.replace('_', ' ')}
                                  </p>
                                  <p className={`text-xs ${trollCityTheme.text.muted}`}>{new Date(tx.created_at).toLocaleString()}</p>
                               </div>
                               <span className="font-bold text-red-400">{tx.amount.toLocaleString()} TC</span>
                            </div>
                         ))}
                      </div>
                   ) : (
                      <div className={`p-8 text-center ${trollCityTheme.text.muted}`}>No recent purchases found.</div>
                   )}
                </div>
             </div>
           )}

           {activeTab === 'admin_titles' && canSeeFullProfile && isAdminViewer && (
             <div className="space-y-6">
               <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-6 rounded-xl`}>
                 <h3 className="text-lg font-bold mb-4">Admin Titles</h3>
                 <div className={`space-y-3 text-sm ${trollCityTheme.text.muted}`}>
                   <div className="flex items-center justify-between">
                     <span>System role</span>
                     <span className="px-3 py-1 rounded-full border border-purple-500/40 bg-purple-500/10 text-xs font-semibold uppercase tracking-wide">
                       {profile.role || 'user'}
                     </span>
                   </div>
                   <div className="flex items-center justify-between">
                     <span>Troll role</span>
                     <span className="px-3 py-1 rounded-full border border-indigo-500/40 bg-indigo-500/10 text-xs font-semibold uppercase tracking-wide">
                       {profile.troll_role || 'none'}
                     </span>
                   </div>
                   <div className="flex items-center justify-between">
                     <span>Lead officer</span>
                     <span className="px-3 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-xs font-semibold uppercase tracking-wide">
                       {profile.is_lead_officer ? 'Yes' : 'No'}
                     </span>
                   </div>
                 </div>
               </div>
             </div>
           )}

           {activeTab === 'settings' && isOwnProfile && (
             <div className="space-y-6">
               <h3 className="text-lg font-bold mb-4">Notification Settings</h3>

               {/* Profile Costs */}
               <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-6 rounded-xl space-y-4`}>
                 <div className="flex items-center gap-3 mb-2">
                   <Coins className="w-6 h-6 text-yellow-400" />
                   <div>
                     <h4 className="font-medium text-white">Profile Costs</h4>
                     <p className={`text-sm ${trollCityTheme.text.muted}`}>Set prices for interactions (0 = Free)</p>
                   </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className={`block text-xs font-medium ${trollCityTheme.text.muted} mb-1`}>Message Cost (TC)</label>
                     <input 
                       type="number" 
                       min="0"
                       value={messageCost}
                       onChange={(e) => setMessageCost(Number(e.target.value))}
                       className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                     />
                   </div>
                   <div>
                     <label className={`block text-xs font-medium ${trollCityTheme.text.muted} mb-1`}>Profile View Cost (TC)</label>
                     <input 
                       type="number" 
                       min="0"
                       value={viewCost}
                       onChange={(e) => setViewCost(Number(e.target.value))}
                       className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                     />
                   </div>
                 </div>
                 
                 <div className="flex justify-end">
                   <button
                     onClick={handleUpdateCosts}
                     disabled={savingPreferences}
                     className={`${trollCityTheme.components.buttonPrimary} px-4 py-2 font-medium text-sm transition-colors disabled:opacity-50`}
                   >
                     {savingPreferences ? 'Saving...' : 'Save Costs'}
                   </button>
                 </div>
               </div>
               
               {/* Announcements Toggle */}
              <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-6 rounded-xl`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {announcementsEnabled ? (
                      <Bell className="w-6 h-6 text-green-400" />
                    ) : (
                      <BellOff className={`w-6 h-6 ${trollCityTheme.text.muted}`} />
                    )}
                    <div>
                      <h4 className="font-medium text-white">Admin Announcements</h4>
                      <p className={`text-sm ${trollCityTheme.text.muted}`}>Receive notifications from administrators</p>
                    </div>
                  </div>
                  <button
                    onClick={toggleAnnouncements}
                    disabled={savingPreferences}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      announcementsEnabled ? 'bg-green-500' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        announcementsEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Banner Notifications Toggle */}
              <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-6 rounded-xl`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {bannerNotificationsEnabled ? (
                      <Zap className="w-6 h-6 text-green-400" />
                    ) : (
                      <Zap className={`w-6 h-6 ${trollCityTheme.text.muted}`} />
                    )}
                    <div>
                      <h4 className="font-medium text-white">Live Banners</h4>
                      <p className={`text-sm ${trollCityTheme.text.muted}`}>Receive notifications when pods go live</p>
                    </div>
                  </div>
                  <button
                    onClick={toggleBannerNotifications}
                    disabled={savingPreferences}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      bannerNotificationsEnabled ? 'bg-green-500' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        bannerNotificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
             
             <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-6 rounded-xl`}>
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <LogOut className="w-6 h-6 text-red-400" />
                   <div>
                     <h4 className="font-medium text-white">Log out</h4>
                     <p className={`text-sm ${trollCityTheme.text.muted}`}>Sign out of your account on this device</p>
                   </div>
                 </div>
                 <button
                   onClick={handleLogout}
                   className="px-4 py-2 bg-red-600/20 border border-red-500/40 text-red-300 rounded-lg hover:bg-red-600/30 transition"
                 >
                   Log out
                 </button>
               </div>
             </div>

             {/* Delete Account */}
             <div className="bg-red-950/20 p-6 rounded-xl border border-red-900/50">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <Trash2 className="w-6 h-6 text-red-500" />
                   <div>
                     <h4 className="font-medium text-red-200">Delete Account</h4>
                     <p className="text-sm text-red-400/70">Permanently delete your account and all data</p>
                   </div>
                 </div>
                 <button
                   onClick={handleDeleteAccount}
                   className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                 >
                   Delete Account
                 </button>
               </div>
             </div>
           </div>
          )}
        </div>
      </div>

      {/* Insurance Card Modal */}
      {showInsuranceCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setShowInsuranceCard(null)}>
          <div className="w-full max-w-md bg-[#0f172a] border border-blue-500/30 rounded-2xl overflow-hidden shadow-2xl relative transform transition-all scale-100" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-4 flex justify-between items-center shadow-md z-10 relative">
              <div className="flex items-center gap-2">
                <Shield className="text-white fill-white/20" size={24} />
                <h2 className="text-lg font-bold text-white uppercase tracking-wider text-shadow-sm">Troll City Insurance</h2>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
                 <Shield size={16} className="text-white" />
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-5 bg-[#0f172a] relative overflow-hidden">
               <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
               
               <div className="flex justify-between items-start relative z-10">
                  <div>
                     <p className="text-[10px] uppercase text-blue-400 tracking-widest mb-1 font-semibold">Policy Holder</p>
                     <p className="text-xl font-bold text-white tracking-tight">{showInsuranceCard.user.display_name || showInsuranceCard.user.username}</p>
                     <p className="text-xs text-blue-400/80 font-mono mt-0.5">ID: {showInsuranceCard.user.id.slice(0, 8)}</p>
                  </div>
                  {showInsuranceCard.user.avatar_url ? (
                     <img src={showInsuranceCard.user.avatar_url} className="w-16 h-16 rounded-lg border-2 border-blue-500/30 object-cover shadow-lg bg-black" />
                  ) : (
                     <div className="w-16 h-16 rounded-lg border-2 border-blue-500/30 bg-blue-900/20 flex items-center justify-center">
                        <span className="text-2xl">👤</span>
                     </div>
                  )}
               </div>

               <div className="grid grid-cols-2 gap-4 relative z-10 bg-blue-900/10 p-3 rounded-xl border border-blue-500/10">
                   <div>
                      <p className="text-[10px] uppercase text-blue-400 tracking-widest mb-1 font-semibold">Vehicle</p>
                      <p className="text-sm font-bold text-white truncate">{showInsuranceCard.config?.name || 'Unknown Vehicle'}</p>
                      <p className="text-xs text-gray-400">{showInsuranceCard.config?.tier || 'Standard'} Class</p>
                   </div>
                   <div>
                      <p className="text-[10px] uppercase text-blue-400 tracking-widest mb-1 font-semibold">Status</p>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-bold uppercase shadow-sm">
                         <CheckCircle size={10} strokeWidth={3} /> Active
                      </div>
                   </div>
               </div>
               
               <div className="border-t border-blue-500/20 pt-4 relative z-10">
                   <div className="flex justify-between items-center">
                      <div>
                         <p className="text-[10px] uppercase text-blue-400 tracking-widest mb-1 font-semibold">Expires</p>
                         <p className="text-sm font-mono text-white font-medium">
                            {new Date(showInsuranceCard.vehicle.insurance_expiry).toLocaleDateString()}
                         </p>
                         <p className="text-[10px] text-gray-500">
                            {new Date(showInsuranceCard.vehicle.insurance_expiry).toLocaleTimeString()}
                         </p>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] uppercase text-blue-400 tracking-widest mb-1 font-semibold">Policy ID</p>
                         <p className="text-xs font-mono text-gray-500">
                            {showInsuranceCard.vehicle.id.slice(0, 12)}...
                         </p>
                      </div>
                   </div>
               </div>
            </div>
            
            {/* Footer */}
            <div className="bg-[#020617] p-3 text-center border-t border-blue-900/30">
               <p className="text-[10px] text-slate-500 font-medium">Authorized by Troll City Motor Vehicle Department</p>
               <button 
                 className="mt-3 w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-900/20" 
                 onClick={() => setShowInsuranceCard(null)}
               >
                 Close Card
               </button>
            </div>
          </div>
        </div>
      )}
      {/* Glowing Username Color Picker Modal */}
      {showColorPickerModal && currentUser?.id && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[#0A0A14] border border-[#2C2C2C] rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#2C2C2C]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                Choose Glow Color
              </h2>
              <button
                onClick={() => setShowColorPickerModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <GlowingUsernameColorPicker
                userId={currentUser.id}
                onColorSelected={() => {
                  setShowColorPickerModal(false)
                  toast.success('Color saved!')
                  refreshProfile()
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Profile() {
  const inRouter = useInRouterContext();
  if (!inRouter) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-sm text-gray-400">Profile view is unavailable outside the app router.</div>
      </div>
    );
  }
  return <ProfileInner />;
}
