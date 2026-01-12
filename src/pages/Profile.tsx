import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useInRouterContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import LiveAvatar from '../components/LiveAvatar';
import { Loader2, MessageCircle, UserPlus, Settings, MapPin, Link as LinkIcon, Calendar, Package, Shield, Zap, Phone, Coins, Mail, Bell, BellOff, LogOut, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { deductCoins } from '@/lib/coinTransactions';
import { PERK_CONFIG } from '@/lib/perkSystem';
import { canMessageAdmin } from '@/lib/perkEffects';

function ProfileInner() {
  const { username, userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, refreshProfile } = useAuthStore();
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileLive, setIsProfileLive] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [inventory, setInventory] = useState<{perks: any[], effects: any[], insurance: any[], callMinutes: any}>({perks: [], effects: [], insurance: [], callMinutes: null});
  const [earnings, setEarnings] = useState<any[]>([]);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const viewerRole = useAuthStore.getState().profile?.troll_role || useAuthStore.getState().profile?.role || 'user';
  const [posts, setPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [imageFiles, setImageFiles] = useState<FileList | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [creatingPost, setCreatingPost] = useState(false);
  const [announcementsEnabled, setAnnouncementsEnabled] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [isTabDropdownOpen, setIsTabDropdownOpen] = useState(false);
  const tabDropdownRef = useRef<HTMLDivElement | null>(null);
  

  const fetchInventory = async (uid: string) => {
    // setInventoryLoading(true);
    try {
      const [perksRes, effectsRes, insuranceUserRes, callRes] = await Promise.all([
        supabase.from('user_perks').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
        supabase.from('user_entrance_effects').select('*').eq('user_id', uid),
        supabase.from('user_insurances').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
        supabase.from('call_minutes').select('*').eq('user_id', uid).single()
      ]);

      let insuranceList = insuranceUserRes.data || [];

      // Client-side join to insurance_plans for names
      try {
        const planIds = (insuranceList || []).map((p: any) => p.insurance_id).filter(Boolean);
        if (planIds.length > 0) {
          const { data: plans } = await supabase
            .from('insurance_plans')
            .select('id,name,description')
            .in('id', Array.from(new Set(planIds)));
          const planMap = new Map<string, any>();
          (plans || []).forEach((pl: any) => planMap.set(pl.id, pl));
          insuranceList = (insuranceList || []).map((row: any) => {
            const plan = planMap.get(row.insurance_id);
            return {
              ...row,
              metadata: {
                ...(row.metadata || {}),
                plan_name: plan?.name,
                plan_description: plan?.description
              }
            }
          });
        }
      } catch {}

      setInventory({
        perks: perksRes.data || [],
        effects: effectsRes.data || [],
        insurance: insuranceList || [],
        callMinutes: callRes.data || null
      });
    } catch (e) {
      console.error('Error fetching inventory', e);
    } finally {
      // setInventoryLoading(false);
    }
  };

  const fetchEarnings = async (uid: string) => {
    setEarningsLoading(true);
    try {
      const { data } = await supabase
        .from('coin_transactions')
        .select('*')
        .eq('user_id', uid)
        .gt('amount', 0)
        .in('type', ['gift_received', 'wheel_win', 'wheel_prize', 'reward', 'purchase', 'admin_grant'])
        .order('created_at', { ascending: false })
        .limit(50);
      setEarnings(data || []);
    } catch (e) {
      console.error('Error fetching earnings', e);
    } finally {
      setEarningsLoading(false);
    }
  };

  const [purchases, setPurchases] = useState<any[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);

  const fetchPurchases = async (uid: string) => {
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
  };

  useEffect(() => {
    if (activeTab === 'earnings' && profile?.id) {
      fetchEarnings(profile.id);
    }
    if (activeTab === 'purchases' && profile?.id) {
      fetchPurchases(profile.id);
    }
  }, [activeTab, profile?.id]);

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

    const { error: deductError } = await deductCoins({
        userId: currentUser.id,
        amount: config.cost,
        type: 'perk_purchase',
        metadata: { perk_id: perk.perk_id, perk_name: config.name },
        supabaseClient: supabase
    });

    if (deductError) {
        toast.error("Transaction failed");
        return;
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + config.duration_minutes);

    const { error } = await supabase.from('user_perks').insert({
        user_id: currentUser.id,
        perk_id: perk.perk_id,
        metadata: { perk_name: config.name, description: config.description },
        expires_at: expiresAt.toISOString(),
        is_active: true
    });

    if (error) {
        toast.error('Failed to repurchase perk');
        return;
    }

    if (perk.perk_id === 'perk_rgb_username') {
        await supabase.from('user_profiles').update({ rgb_username_expires_at: expiresAt.toISOString() }).eq('id', currentUser.id);
        await refreshProfile();
    }

    toast.success('Perk repurchased successfully!');
    fetchInventory(currentUser.id);
  };

  const togglePerk = async (perkId: string, isActive: boolean) => {
      if (!currentUser || currentUser.id !== profile.id) return;
      const { error } = await supabase.from('user_perks').update({ is_active: !isActive }).eq('id', perkId);
      if (error) {
          toast.error('Failed to update perk');
          return;
      }

      const perk = inventory.perks.find(p => p.id === perkId);
      if (perk && perk.perk_id === 'perk_rgb_username') {
          if (!isActive) {
              await supabase.from('user_profiles').update({ rgb_username_expires_at: perk.expires_at }).eq('id', currentUser.id);
          } else {
              await supabase.from('user_profiles').update({ rgb_username_expires_at: null }).eq('id', currentUser.id);
          }
          await refreshProfile();
      }

      toast.success(`Perk ${isActive ? 'deactivated' : 'activated'}`);
      fetchInventory(currentUser.id);
  };

  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      let query = supabase.from('user_profiles').select('*');
      
      if (userId) {
        query = query.eq('id', userId);
      } else if (username) {
        query = query.eq('username', username);
      } else {
         setLoading(false);
         return;
      }

      const { data, error } = await query.maybeSingle();
      
      if (error || !data) {
        console.error('Profile not found', error);
      } else {
        setProfile(data);
        fetchInventory(data.id);
        
        // Fetch follower/following counts
        const { count: followers } = await supabase
          .from('user_follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', data.id);
        
        const { count: following } = await supabase
          .from('user_follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', data.id);
          
        setFollowersCount(followers || 0);
        setFollowingCount(following || 0);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [username, userId]);

  // Live status check
  useEffect(() => {
    if (!profile?.id) return;

    const checkLiveStatus = async () => {
      const { data } = await supabase
        .from('streams')
        .select('id')
        .eq('broadcaster_id', profile.id)
        .eq('is_live', true)
        .maybeSingle();
      
      setIsProfileLive(!!data);
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
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // Check follow status
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
  }, [currentUser, profile?.id]);

  const handleFollow = async () => {
    if (!currentUser) {
      toast.error('Please login to follow users');
      return;
    }
    
    if (isFollowing) {
      await supabase.from('user_follows').delete().match({ follower_id: currentUser.id, following_id: profile.id });
      setIsFollowing(false);
      setFollowersCount(prev => Math.max(0, prev - 1));
      toast.success(`Unfollowed ${profile.username}`);
    } else {
      await supabase.from('user_follows').insert({ follower_id: currentUser.id, following_id: profile.id });
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
    
    navigate(`/messages?user=${profile.id}`);
  };

  // Defer early returns to after hooks to satisfy lint rules

  const isOwnProfile = currentUser?.id === profile?.id;
  const canSeeFullProfile = viewerRole === 'admin' || viewerRole === 'lead_troll_officer' || viewerRole === 'secretary' || isOwnProfile;
  const tabOptions = [
    { key: 'posts', label: 'Posts', show: true },
    { key: 'inventory', label: 'Inventory & Perks', show: canSeeFullProfile },
    { key: 'earnings', label: 'Earnings', show: canSeeFullProfile },
    { key: 'purchases', label: 'Purchase History', show: canSeeFullProfile },
    { key: 'settings', label: 'Settings', show: isOwnProfile },
  ];
  const activeTabLabel = tabOptions.find((option) => option.key === activeTab)?.label || 'Posts';

  // Load announcement preferences
  useEffect(() => {
    if (isOwnProfile && profile?.announcements_enabled !== undefined) {
      setAnnouncementsEnabled(profile.announcements_enabled);
    }
  }, [isOwnProfile, profile]);

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

  const fetchPosts = useCallback(async () => {
    if (!profile?.id) return;
    setPostsLoading(true);
    try {
      const { data } = await supabase
        .from('troll_posts')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setPosts(data || []);
    } finally {
      setPostsLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`profile-posts-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'troll_posts', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          setPosts((prev) => [payload.new as any, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'troll_posts', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const deletedId = (payload.old as any).id;
          setPosts((prev) => prev.filter((p) => p.id !== deletedId));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(video.duration || 0);
      };
      video.src = url;
    });
  };

  const createPost = async () => {
    if (!currentUser?.id) {
      toast.error('Please log in');
      return;
    }
    if (!postContent.trim() && !imageFiles && !videoFile) {
      toast.error('Add content or media');
      return;
    }
    if (postContent.length > 4000) {
      toast.error('Text exceeds 4000 characters');
      return;
    }
    setCreatingPost(true);
    try {
      if (videoFile) {
        const duration = await getVideoDuration(videoFile);
        if (duration > 300) {
          toast.error('Video must be 5 minutes or less');
          setCreatingPost(false);
          return;
        }
        const path = `${currentUser.id}/${Date.now()}-${videoFile.name}`;
        const { error: vErr } = await supabase.storage.from('post-images').upload(path, videoFile, {
          cacheControl: '3600',
          upsert: false
        });
        if (vErr) throw vErr;
        const { data: vUrl } = supabase.storage.from('post-images').getPublicUrl(path);
        const { error: insertErr } = await supabase.from('troll_posts').insert({
          user_id: currentUser.id,
          content: postContent.trim(),
          video_url: vUrl.publicUrl
        });
        if (insertErr) throw insertErr;
      }
      if (imageFiles && imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles.item(i)!;
          const path = `${currentUser.id}/${Date.now()}-${i}-${file.name}`;
          const { error: iErr } = await supabase.storage.from('post-images').upload(path, file, {
            cacheControl: '3600',
            upsert: false
          });
          if (iErr) throw iErr;
          const { data: iUrl } = supabase.storage.from('post-images').getPublicUrl(path);
          const { error: insertErr } = await supabase.from('troll_posts').insert({
            user_id: currentUser.id,
            content: postContent.trim(),
            image_url: iUrl.publicUrl
          });
          if (insertErr) throw insertErr;
        }
      }
      if (!videoFile && !imageFiles) {
        const { error: tErr } = await supabase.from('troll_posts').insert({
          user_id: currentUser.id,
          content: postContent.trim()
        });
        if (tErr) throw tErr;
      }
      const { error: wallErr } = await supabase.from('troll_wall_posts').insert({
        user_id: currentUser.id,
        post_type: 'text',
        content: postContent.trim(),
        metadata: {}
      });
      if (wallErr) {}
      setPostContent('');
      setImageFiles(null);
      setVideoFile(null);
      toast.success('Posted');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to post');
    } finally {
      setCreatingPost(false);
    }
  };

  const canDeletePost = (post: any) => {
    if (!currentUser?.id) return false;
    const r = viewerRole;
    if (currentUser.id === post.user_id) return true;
    if (r === 'admin' || r === 'troll_officer' || r === 'lead_troll_officer') return true;
    return false;
  };

  const deletePost = async (postId: string) => {
    try {
      const { error } = await supabase.from('troll_posts').delete().eq('id', postId);
      if (error) throw error;
      toast.success('Deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0A0814]">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
       <div className="min-h-screen bg-[#0A0814] text-white p-8 flex items-center justify-center">
         <div className="text-center">
           <h2 className="text-xl font-bold mb-2">User not found</h2>
           <p className="text-gray-400">The user you are looking for does not exist.</p>
           <button 
             onClick={() => navigate('/')}
             className="mt-4 px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition"
           >
             Go Home
           </button>
         </div>
       </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white pb-20">
      {/* Banner */}
      <div className="h-48 md:h-64 bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900 relative">
        {profile.banner_url && (
          <img 
            src={profile.banner_url} 
            alt="Banner" 
            className="w-full h-full object-cover"
          />
        )}
      </div>
      
      {/* Profile Info */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="-mt-16 mb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
           <div className="flex items-end">
             <LiveAvatar 
                userId={profile.id}
                username={profile.username}
                avatarUrl={profile.avatar_url}
                isLive={isProfileLive}
                size="2xl"
                className="border-4 border-[#0A0814] rounded-full bg-[#0A0814]"
                borderColor="border-[#0A0814]"
                showLiveBadge={true}
             />
           </div>
           
           {/* Actions */}
           <div className="flex gap-2 mt-4 md:mt-0 mb-2">
              {isOwnProfile ? (
                <button 
                  onClick={() => navigate('/profile/setup')}
                  className="px-4 py-2 bg-[#1A1A24] border border-gray-700 rounded-lg hover:bg-[#2A2A35] transition flex items-center gap-2"
                >
                  <Settings size={18} />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <>
                  <button 
                    onClick={handleFollow}
                    className={`px-4 py-2 rounded-lg transition flex items-center gap-2 font-medium ${isFollowing ? 'bg-gray-700 hover:bg-gray-600' : 'bg-purple-600 hover:bg-purple-700'}`}
                  >
                    <UserPlus size={18} />
                    <span>{isFollowing ? 'Following' : 'Follow'}</span>
                  </button>
                  <button 
                    onClick={handleMessage}
                    className="px-4 py-2 bg-[#1A1A24] border border-gray-700 rounded-lg hover:bg-[#2A2A35] transition flex items-center gap-2"
                  >
                    <MessageCircle size={18} />
                    <span>Message</span>
                  </button>
                </>
              )}
           </div>
        </div>
        
        <div className="mt-2">
          <h1 className={`text-2xl font-bold flex items-center gap-2 ${profile.rgb_username_expires_at && new Date(profile.rgb_username_expires_at) > new Date() ? 'rgb-username' : ''}`}>
            {profile.display_name || profile.username}
            {profile.is_verified && (
              <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full" title="Verified">✓</span>
            )}
          </h1>
          <p className={`text-gray-400 ${profile.rgb_username_expires_at && new Date(profile.rgb_username_expires_at) > new Date() ? 'rgb-username font-bold' : ''}`}>@{profile.username}</p>
        </div>
        
        <div className="mt-4 max-w-2xl prose prose-invert prose-sm">
          <p>{profile.bio || "No bio provided."}</p>
        </div>
        
        <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-400">
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
        </div>
        
        {/* Stats */}
        <div className="flex gap-6 mt-6 border-b border-gray-800 pb-4 text-sm">
           <div className="flex gap-1 cursor-pointer hover:text-purple-400 transition" onClick={() => navigate('/following')}>
             <span className="font-bold text-white">{followingCount}</span>
             <span className="text-gray-400">Following</span>
           </div>
           <div className="flex gap-1 cursor-pointer hover:text-purple-400 transition" onClick={() => navigate('/following')}>
             <span className="font-bold text-white">{followersCount}</span>
             <span className="text-gray-400">Followers</span>
           </div>
           <div className="flex gap-1">
             <span className="font-bold text-white">{posts.length}</span>
             <span className="text-gray-400">Posts</span>
           </div>
        </div>
        
        {/* Tabs */}
        <div className="relative mt-6" ref={tabDropdownRef}>
          <button
            type="button"
            onClick={() => setIsTabDropdownOpen((prev) => !prev)}
            className="w-full max-w-xs flex items-center justify-between px-4 py-2 bg-[#0f0f15] border border-gray-800 rounded-2xl text-sm font-medium text-white hover:border-purple-500 transition-colors"
          >
            <span>{activeTabLabel}</span>
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${isTabDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {isTabDropdownOpen && (
            <div className="absolute left-0 right-0 mt-2 max-w-xs bg-[#05050a] border border-gray-800 rounded-2xl shadow-lg z-20 overflow-hidden">
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

        <div className="mt-6">
           {activeTab === 'posts' && (
             <div className="space-y-6">
               {isOwnProfile && (
                 <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-3">
                   <textarea
                     value={postContent}
                     onChange={(e) => setPostContent(e.target.value)}
                     rows={4}
                     maxLength={4000}
                     placeholder="Share text up to 4000 characters"
                     className="w-full px-4 py-3 bg-zinc-800 border border-gray-700 rounded-lg text-white"
                   />
                   <div className="flex gap-3">
                     <input
                       type="file"
                       accept="image/*,video/*"
                       multiple
                       onChange={(e) => {
                         const files = e.target.files;
                         if (!files || files.length === 0) {
                           setImageFiles(null);
                           setVideoFile(null);
                           return;
                         }
                         const allFiles = Array.from(files);
                         const firstVideo = allFiles.find((f) => f.type.startsWith('video/')) || null;
                         if (firstVideo) {
                           setVideoFile(firstVideo);
                           setImageFiles(null);
                         } else {
                           setImageFiles(files);
                           setVideoFile(null);
                         }
                       }}
                     />
                   </div>
                   <div className="flex justify-end">
                     <button
                       type="button"
                       disabled={creatingPost}
                       onClick={createPost}
                       className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                     >
                       {creatingPost ? 'Posting...' : 'Post'}
                     </button>
                   </div>
                 </div>
               )}
               {postsLoading ? (
                 <div className="text-center text-gray-500 py-10 bg-[#12121A] rounded-xl border border-dashed border-gray-800">Loading posts...</div>
               ) : posts.length === 0 ? (
                 <div className="text-center text-gray-500 py-10 bg-[#12121A] rounded-xl border border-dashed border-gray-800">No posts yet.</div>
               ) : (
                 <div className="space-y-4">
                   {posts.map((post) => (
                     <div key={post.id} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                       <div className="flex justify-between items-start mb-2">
                         <div className="text-xs text-gray-400">{new Date(post.created_at).toLocaleString()}</div>
                         {canDeletePost(post) && (
                           <button
                             type="button"
                             onClick={() => deletePost(post.id)}
                             className="text-red-400 hover:text-red-300"
                           >
                             Delete
                           </button>
                       )}
                      </div>
                      {post.video_url ? (
                        <video src={post.video_url} controls className="w-full rounded-lg mb-3" />
                      ) : null}
                      {post.image_url ? (
                        <img src={post.image_url} alt="" className="w-full rounded-lg mb-3" />
                      ) : null}
                      {post.content && (
                        <p className="text-white whitespace-pre-wrap break-words">{post.content}</p>
                      )}
                     </div>
                   ))}
                 </div>
               )}
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
                      return (
                        <div key={perk.id} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                          <div className="flex justify-between items-start mb-2">
                             <h4 className="font-bold text-white">{config?.name || perk.metadata?.perk_name || 'Unknown Perk'}</h4>
                             <span className={`px-2 py-0.5 rounded text-xs ${isExpired ? 'bg-red-900 text-red-200' : perk.is_active ? 'bg-green-900 text-green-200' : 'bg-gray-800 text-gray-400'}`}>
                               {isExpired ? 'EXPIRED' : perk.is_active ? 'ACTIVE' : 'INACTIVE'}
                             </span>
                          </div>
                          <p className="text-sm text-gray-400 mb-3">{config?.description || perk.metadata?.description}</p>
                          <p className="text-sm text-gray-400 mb-3">Expires: {new Date(perk.expires_at).toLocaleString()}</p>
                          <div className="flex gap-2">
                            {!isExpired && isOwnProfile && (
                              <button onClick={() => togglePerk(perk.id, perk.is_active)} className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs">
                                {perk.is_active ? 'Deactivate' : 'Activate'}
                              </button>
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
                    {inventory.perks.length === 0 && <p className="text-gray-500 text-sm">No perks found.</p>}
                  </div>
               </div>

               {/* Call Minutes */}
               <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Phone className="w-5 h-5 text-green-400"/> Call Minutes</h3>
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <p className="text-gray-400 text-sm">Audio Minutes</p>
                           <p className="text-2xl font-bold text-white">{inventory.callMinutes?.audio_minutes || 0}</p>
                        </div>
                        <div>
                           <p className="text-gray-400 text-sm">Video Minutes</p>
                           <p className="text-2xl font-bold text-white">{inventory.callMinutes?.video_minutes || 0}</p>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Effects */}
               <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Package className="w-5 h-5 text-blue-400"/> Entrance Effects</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {inventory.effects.map(effect => (
                       <div key={effect.id} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex justify-between items-center">
                          <span className="font-medium">{effect.effect_id}</span>
                          <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded">OWNED</span>
                       </div>
                    ))}
                    {inventory.effects.length === 0 && <p className="text-gray-500 text-sm">No effects found.</p>}
                  </div>
               </div>
               
               {/* Insurance */}
               <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-green-400"/> Insurance Plans</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {inventory.insurance.map(plan => (
                       <div key={plan.id} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                          <h4 className="font-bold">{plan.metadata?.insurance_name || plan.metadata?.plan_name || 'Insurance Plan'}</h4>
                          <p className="text-sm text-gray-400">Expires: {new Date(plan.expires_at).toLocaleString()}</p>
                       </div>
                    ))}
                    {inventory.insurance.length === 0 && <p className="text-gray-500 text-sm">No insurance found.</p>}
                  </div>
               </div>
             </div>
           )}

           {activeTab === 'earnings' && (
             <div className="space-y-6">
                <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 flex items-center justify-between">
                   <div>
                      <p className="text-gray-400">Total Earned</p>
                      <h3 className="text-3xl font-bold text-yellow-400 flex items-center gap-2">
                        <Coins className="w-6 h-6"/> {profile.total_earned_coins?.toLocaleString() || 0}
                      </h3>
                   </div>
                   <div className="text-right">
                      <p className="text-gray-400">Current Balance</p>
                      <p className="text-xl font-bold text-white">{profile.troll_coins?.toLocaleString() || 0}</p>
                   </div>
                </div>

                <div className="bg-[#12121A] rounded-xl border border-gray-800 overflow-hidden">
                   <div className="p-4 border-b border-gray-800">
                      <h4 className="font-bold">Recent Earnings</h4>
                   </div>
                   {earningsLoading ? (
                      <div className="p-8 text-center text-gray-500">Loading...</div>
                   ) : earnings.length > 0 ? (
                      <div className="divide-y divide-gray-800">
                         {earnings.map(tx => (
                            <div key={tx.id} className="p-4 flex justify-between items-center">
                               <div>
                                  <p className="font-medium text-white capitalize">{tx.type.replace('_', ' ')}</p>
                                  <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleString()}</p>
                               </div>
                               <span className="font-bold text-green-400">+{tx.amount.toLocaleString()} TC</span>
                            </div>
                         ))}
                      </div>
                   ) : (
                      <div className="p-8 text-center text-gray-500">No recent earnings found.</div>
                   )}
                </div>
             </div>
           )}

           {activeTab === 'purchases' && (
             <div className="space-y-6">
                <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 flex items-center justify-between">
                   <div>
                      <p className="text-gray-400">Total Spent</p>
                      <h3 className="text-3xl font-bold text-red-400 flex items-center gap-2">
                        <Coins className="w-6 h-6"/> {profile.total_spent_coins?.toLocaleString() || 0}
                      </h3>
                   </div>
                   <div className="text-right">
                      <p className="text-gray-400">Current Balance</p>
                      <p className="text-xl font-bold text-white">{profile.troll_coins?.toLocaleString() || 0}</p>
                   </div>
                </div>

                <div className="bg-[#12121A] rounded-xl border border-gray-800 overflow-hidden">
                   <div className="p-4 border-b border-gray-800">
                      <h4 className="font-bold">Recent Purchases</h4>
                   </div>
                   {purchasesLoading ? (
                      <div className="p-8 text-center text-gray-500">Loading...</div>
                   ) : purchases.length > 0 ? (
                      <div className="divide-y divide-gray-800">
                         {purchases.map(tx => (
                            <div key={tx.id} className="p-4 flex justify-between items-center">
                               <div>
                                  <p className="font-medium text-white capitalize">
                                    {tx.metadata?.perk_name || tx.type.replace('_', ' ')}
                                  </p>
                                  <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleString()}</p>
                               </div>
                               <span className="font-bold text-red-400">{tx.amount.toLocaleString()} TC</span>
                            </div>
                         ))}
                      </div>
                   ) : (
                      <div className="p-8 text-center text-gray-500">No recent purchases found.</div>
                   )}
                </div>
             </div>
           )}

           {activeTab === 'settings' && isOwnProfile && (
             <div className="space-y-6">
               <h3 className="text-lg font-bold mb-4">Notification Settings</h3>
               
               {/* Announcements Toggle */}
               <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     {announcementsEnabled ? (
                       <Bell className="w-6 h-6 text-green-400" />
                     ) : (
                       <BellOff className="w-6 h-6 text-gray-400" />
                     )}
                     <div>
                       <h4 className="font-medium text-white">Admin Announcements</h4>
                       <p className="text-sm text-gray-400">Receive notifications from administrators</p>
                     </div>
                   </div>
                   <button
                     onClick={toggleAnnouncements}
                     disabled={savingPreferences}
                     className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                       announcementsEnabled ? 'bg-green-500' : 'bg-gray-600'
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
             
             <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <LogOut className="w-6 h-6 text-red-400" />
                   <div>
                     <h4 className="font-medium text-white">Log out</h4>
                     <p className="text-sm text-gray-400">Sign out of your account on this device</p>
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
           </div>
          )}
        </div>
      </div>
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
