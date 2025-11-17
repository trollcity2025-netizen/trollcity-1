

import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, Radio, Heart, User, TrendingUp, Coins, ShoppingBag, DollarSign, Shield, Swords, Trophy, Crown, Gift, Calendar, MessageCircle, Bell, X, Users, Flame, ChevronDown, Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/api/supabaseClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from 'react-hot-toast';
import { Toaster as SonnerToaster } from 'sonner';
import { Toaster as HotToaster } from 'react-hot-toast';
import UserBadges from "@/components/UserBadges";

function SidebarContentComponent({ user }) {
  const location = useLocation();
  const { openMobile, setOpenMobile } = useSidebar();
  const [openSections, setOpenSections] = useState({
    main: true,
    discover: true,
    monetization: true,
    profile: true,
    admin: true
  });

  // Debug user information
  useEffect(() => {
    if (user) {
      console.log('🔍 Layout User Debug:', {
        role: user.role,
        is_admin: user.is_admin,
        username: user.username,
        full_name: user.full_name,
        user_metadata: user.user_metadata,
        raw_user: user,
        pathname: location.pathname,
        homePath: createPageUrl("Home"),
        isHomePage: location.pathname === createPageUrl("Home"),
        shouldShowSidebar: user && user.id
      });
    }
  }, [user, location.pathname]);
  const [latestGift, setLatestGift] = useState(null);
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unreadNotifications', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      
      // Get the current unread count only - remove cleanup for performance
      const { data = [], error } = await supabase
        .from('notifications')
        .select('id, is_read, created_at')
        .eq('user_id', user.id)
        .eq('is_read', false);
        
      if (error) {
        return 0;
      }
      
      return data.length || 0;
    },
    enabled: !!user,
    refetchInterval: 30000, // Increased to 30 seconds for better performance
    initialData: 0,
    staleTime: 20000,
    refetchOnWindowFocus: false, // Disable to prevent unnecessary refetches
  });

  // ✅ Add real-time subscription for notification updates - optimized
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Invalidate the unread count query when notifications change
          queryClient.invalidateQueries({ queryKey: ['unreadNotifications', user.id] });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, queryClient]);

  const { data: unreadMessagesCount = 0 } = useQuery({
    queryKey: ['unreadMessages', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      
      // Use a single query with OR condition for better performance
      const { data: conversations = [], error } = await supabase
        .from('conversations')
        .select('unread_count_p1, unread_count_p2, participant1_id, participant2_id')
        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`);

      if (error) return 0;

      const totalUnread = conversations.reduce((sum, conv) => {
        if (conv.participant1_id === user.id) {
          return sum + (conv.unread_count_p1 || 0);
        } else {
          return sum + (conv.unread_count_p2 || 0);
        }
      }, 0);

      return totalUnread;
    },
    enabled: !!user,
    refetchInterval: 30000, // Increased to 30 seconds
    initialData: 0,
    staleTime: 20000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: recentGifts = [] } = useQuery({
    queryKey: ['recentGifts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      try {
        const { data = [], error } = await supabase
          .from('stream_gifts')
          .select('*')
          .eq('recipient_id', user.id)
          .order('created_date', { ascending: false })
          .limit(3); // Reduced limit for better performance
        if (error) {
          return [];
        }
        return data;
      } catch (e) {
        return [];
      }
    },
    enabled: !!user,
    refetchInterval: 30000, // Increased to 30 seconds
    initialData: [],
    staleTime: 20000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Check troll family status - optimized
  const { data: isTrollFamily = false } = useQuery({
    queryKey: ['isTrollFamily', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from('profiles')
        .select('is_troll_family')
        .eq('id', user.id)
        .single();
      if (error) return false;
      return data?.is_troll_family || false;
    },
    enabled: !!user?.id,
    staleTime: 60000, // Increased to 1 minute
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (recentGifts.length > 0) {
      const newest = recentGifts[0];
      if (!latestGift || newest.id !== latestGift.id) {
        setLatestGift(newest);

        toast.success(`🎁 ${newest.sender_name} sent you ${newest.gift_emoji} ${newest.gift_name}!`, {
          duration: 5000
        });

        queryClient.invalidateQueries(['currentUser']);
        queryClient.refetchQueries(['currentUser'], { force: true });
      }
    }
  }, [recentGifts, latestGift, queryClient]);

  const handleLinkClick = () => {
    setOpenMobile(false);
  };

  const toggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getTierInfo = (level) => {
    if (level >= 1 && level <= 9) return { tier: 1, color: "from-gray-500 to-slate-500" };
    if (level >= 10 && level <= 19) return { tier: 2, color: "from-blue-500 to-cyan-500" };
    if (level >= 20 && level <= 29) return { tier: 3, color: "from-purple-500 to-pink-500" };
    if (level >= 30) return { tier: 4, color: "from-yellow-500 to-orange-500" };
    return { tier: 1, color: "from-gray-500 to-slate-500" };
  };

  const userLevel = user?.level || 1;
  const tierInfo = getTierInfo(userLevel);

  const mainNavItems = [
    { title: "Home", url: createPageUrl("Home"), icon: Home },
    { title: "Following", url: createPageUrl("Following"), icon: Heart },
    { title: "Messages", url: createPageUrl("Messages"), icon: MessageCircle, badge: unreadMessagesCount },
    { title: "Notifications", url: createPageUrl("Notifications"), icon: Bell, badge: unreadCount },
  ];

  const discoverNavItems = [
    { title: "Trending", url: createPageUrl("Trending"), icon: TrendingUp },
  ];

  const monetizationNavItems = [
    { title: "Store", url: createPageUrl("Store"), icon: ShoppingBag },
    { title: "Earnings", url: createPageUrl("Earnings"), icon: DollarSign },
  ];

  const profileNavItems = [
    { title: "My Profile", url: createPageUrl("Profile"), icon: User },
  ];

  const adminNavItems = [
    { title: "Admin Dashboard", url: createPageUrl("Admin"), icon: Shield },
    { title: "Troll Family Lounge", url: "/TFam", icon: Users },
    ...(!isTrollFamily ? [{ title: "Troll Family App", url: createPageUrl("TrollFamilyApplication"), icon: Users }] : []),
  ];

  const renderNavItems = (items) => (
    items.map((item) => (
      <SidebarMenuItem key={item.title} className="mb-1">
        <SidebarMenuButton
          asChild
          className={`hover:bg-purple-500/20 transition-all duration-200 rounded-xl ${
            location.pathname === item.url
              ? 'bg-purple-500/30 text-white'
              : 'bg-black text-gray-300 hover:text-white'
          }`}
        >
          <Link 
            to={item.url} 
            onClick={(e) => {
              handleLinkClick(e);
              // ✅ Immediately clear notification count when clicking notifications
              if (item.title === 'Notifications') {
                console.log('🎯 Immediately clearing notification count from', unreadCount, 'to 0');
                queryClient.setQueryData(['unreadNotifications', user?.id], 0);
                // Also invalidate the query to ensure fresh data
                queryClient.invalidateQueries({ queryKey: ['unreadNotifications', user?.id] });
              }
            }} 
            className="flex items-center gap-3 px-4 py-3 relative"
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.title}</span>
            {item.badge > 0 && (
              <Badge className="ml-auto bg-red-500 text-white h-5 min-w-[20px] flex items-center justify-center px-1.5">
                {item.badge > 99 ? '99+' : item.badge}
              </Badge>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ))
  );

  return (
    <>
      {openMobile && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setOpenMobile(false)} />
      )}
      <Sidebar data-sidebar className={`border-r w-64 md:w-72 shrink-0 ${openMobile ? 'fixed z-50 inset-y-0 left-0 md:static md:block' : 'hidden md:block'}`}>
      <SidebarHeader className="border-b p-6" style={{ borderColor: 'var(--border)' }}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <span className="text-xl font-bold text-white">T</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg">
                <span className="text-emerald-400">Troll</span>
                <span className="text-cyan-400">City</span>
              </span>
            </div>
          </div>

          <Link to={createPageUrl("GoLive")} onClick={handleLinkClick}>
            <Button className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600">
              <Radio className="w-4 h-4 mr-2" />
              Go Live
            </Button>
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-3">
        <Collapsible open={openSections.main} onOpenChange={() => toggleSection('main')}>
          <SidebarGroup>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between text-gray-400 hover:text-white cursor-pointer px-2 py-2">
                <span className="text-sm font-semibold">Main</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${openSections.main ? 'rotate-180' : ''}`} />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderNavItems(mainNavItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible open={openSections.discover} onOpenChange={() => toggleSection('discover')}>
          <SidebarGroup>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between text-gray-400 hover:text-white cursor-pointer px-2 py-2">
                <span className="text-sm font-semibold">Discover</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${openSections.discover ? 'rotate-180' : ''}`} />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderNavItems(discoverNavItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible open={openSections.monetization} onOpenChange={() => toggleSection('monetization')}>
          <SidebarGroup>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between text-gray-400 hover:text-white cursor-pointer px-2 py-2">
                <span className="text-sm font-semibold">Earn</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${openSections.monetization ? 'rotate-180' : ''}`} />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderNavItems(monetizationNavItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible open={openSections.profile} onOpenChange={() => toggleSection('profile')}>
          <SidebarGroup>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between text-gray-400 hover:text-white cursor-pointer px-2 py-2">
                <span className="text-sm font-semibold">Profile & Settings</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${openSections.profile ? 'rotate-180' : ''}`} />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderNavItems(profileNavItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible open={openSections.admin} onOpenChange={() => toggleSection('admin')}>
          <SidebarGroup>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between text-gray-400 hover:text-white cursor-pointer px-2 py-2">
                <span className="text-sm font-semibold">
                  {(user && (user.role === "admin" || user.is_admin || user.user_metadata?.role === "admin")) ? "Admin" : "Opportunities"}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${openSections.admin ? 'rotate-180' : ''}`} />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {(user && (user.role === "admin" || user.is_admin || user.user_metadata?.role === "admin"))
                    ? renderNavItems(adminNavItems)
                    : renderNavItems(adminNavItems.filter(item => item.title.includes("App") || item.title.includes("Banned Users")))
                  }
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {user && (
          <>
            <SidebarGroup className="mt-4">
              <Link to={createPageUrl("Store")} onClick={handleLinkClick}>
                <div className="px-4 py-3 rounded-xl cursor-pointer hover:bg-yellow-500/10 transition-all" style={{ background: 'rgba(234, 179, 8, 0.1)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">My Coins</span>
                    <Coins className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {(user.coins || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                    <ShoppingBag className="w-3 h-3" />
                    Buy More
                  </div>
                </div>
              </Link>
            </SidebarGroup>

            <SidebarGroup className="mt-4">
              <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(168, 85, 247, 0.1)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Level & Tier</span>
                </div>
                <div>
                  <div className={`text-2xl font-bold bg-gradient-to-r ${tierInfo.color} bg-clip-text text-transparent`}>
                    {userLevel}
                  </div>
                  <Badge className={`bg-gradient-to-r ${tierInfo.color} border-0 text-white text-xs`}>
                    Tier {tierInfo.tier}
                  </Badge>
                </div>
              </div>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t p-4" style={{ borderColor: 'var(--border)' }}>
        {user ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.username || user.full_name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {(user.username || user.full_name)?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate text-gray-200">
                    @{user.username || user.user_metadata?.user_name || 'NoUsername'}
                  </p>
                  <UserBadges user={user} size="sm" />
                </div>

                <p className="text-xs text-gray-400 truncate">{user.email || user.user_metadata?.email || ''}</p>
                <p className="text-xs text-gray-400 truncate">
                  Level {userLevel} • Status: {user.is_banned ? 'Banned' : (user.role === 'admin' || user.is_admin || user.user_metadata?.role === 'admin') ? 'Admin' : (user.is_troll_officer || user.user_metadata?.is_troll_officer) ? 'Troll Officer' : user.is_og ? 'OG' : 'Member'}
                </p>
              </div>
            </div>
            <Button
              onClick={() => supabase.auth.signOut()}
              variant="outline"
              className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
              size="sm"
            >
              Logout
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <span className="text-xl font-bold text-white">T</span>
              </div>
              <div className="flex flex-col">
                <p className="font-semibold text-sm text-white">Welcome</p>
                <p className="text-xs text-gray-400">Log in to personalize TrollCity</p>
              </div>
            </div>
            <Button
              onClick={() => supabase.auth.redirectToLogin()}
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-600 text-black"
            >
              Login
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
    </>
  );
}

export default function Layout({ children }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  // Optimized user loading with immediate sidebar rendering
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      // Get user data immediately without waiting for full auth.me()
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;
      
      // Get profile data in parallel for immediate sidebar rendering
      const [{ data: profileData }, { data: userData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', authUser.id).single(),
        supabase.auth.me()
      ]);
      
      return {
        ...authUser,
        ...userData,
        ...profileData
      };
    },
    retry: false,
    refetchInterval: 60000, // Increased to 1 minute for better performance
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const { data: authSession } = useQuery({
    queryKey: ['authSession'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data?.user || null;
    },
    retry: false,
    staleTime: 30000, // Increased to 30 seconds
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!user) return;

      const paymentRequiredUrl = createPageUrl('PaymentRequired');
      const currentPath = window.location.hash.replace('#/', '');

      if (user.is_banned) {
        if (currentPath !== 'PaymentRequired') {
          navigate(paymentRequiredUrl);
        }
        return;
      }

      // Check if user is kicked
      if (user.is_kicked) {
        if (currentPath !== 'PaymentRequired') {
          navigate(paymentRequiredUrl);
        }
        return;
      }

      try {
        const pendingKicks = await supabase.entities.KickPayment.filter({
          user_id: user.id,
          payment_status: 'pending'
        });

        if (pendingKicks.length > 0) {
          if (currentPath !== 'PaymentRequired') {
            navigate(paymentRequiredUrl);
          }
        }
      } catch (error) {
        // FIXED: Silently handle rate limit errors - don't show black screen
        console.warn('Kick status check skipped:', error.message);
      }
    };

    // FIXED: Only check every 120 seconds to avoid rate limits and improve performance
    checkPaymentStatus(); // Initial check
    const interval = setInterval(checkPaymentStatus, 120000); // Check every 2 minutes
    
    return () => clearInterval(interval); // Cleanup on unmount or dependency change
  }, [user, navigate]);

  useEffect(() => {
    // Only register when supported and in production or localhost
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );
    const shouldRegister = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && (import.meta.env.PROD || isLocalhost);
    if (!shouldRegister) return;
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then(() => console.log('✅ PWA Service Worker registered'))
      .catch((error) => console.warn('❌ Service Worker registration failed:', error?.message || error));
  }, []);

  // Debug sidebar visibility
  const isLoggedIn = (user && user.id) || (authSession && authSession.id);
  
  console.log('🔍 Sidebar Visibility Debug:', {
    pathname: location.pathname,
    user: user ? { id: user.id, username: user.username } : null,
    isLoggedIn
  });

  return (
    <SidebarProvider>
      <style>{`
        :root {
          --background: #0a0a0f;
          --foreground: #f5f5f7;
          --primary: #ff0844;
          --primary-hover: #cc0636;
          --accent-cyan: #00ff88;
          --accent-pink: #ff0844;
          --card-bg: #1a0f14;
          --border: #3a1a24;
        }

        body {
          touch-action: pan-x pan-y;
          background: linear-gradient(135deg, #0a0a0f 0%, #1a0514 25%, #0f0a0f 50%, #14050f 75%, #0a0a0f 100%);
          background-attachment: fixed;
          color: var(--foreground);
          overscroll-behavior: none;
        }

        input, select, textarea, button {
          font-size: 16px !important;
        }

        html, body {
          width: 100%;
          overflow-x: hidden;
          overflow-y: auto;
        }

        @media (max-width: 768px) {
          .min-h-screen {
            min-height: 100vh;
            min-height: 100dvh;
          }
        }

        .neon-troll {
          color: #00ff88;
          text-shadow:
            0 0 10px #00ff88,
            0 0 20px #00ff88,
            0 0 30px #00ff88,
            0 0 40px #00ff88;
          animation: neon-pulse 2s ease-in-out infinite;
        }

        .neon-red {
          color: #ff0844;
          text-shadow:
            0 0 10px #ff0844,
            0 0 20px #ff0844,
            0 0 30px #ff0844,
            0 0 40px #ff0844;
          animation: neon-pulse 2s ease-in-out infinite;
        }

        @keyframes neon-pulse {
          0%, 100% {
            text-shadow:
              0 0 10px currentColor,
              0 0 20px currentColor,
              0 0 30px currentColor,
              0 0 40px currentColor;
          }
          50% {
            text-shadow:
              0 0 15px currentColor,
              0 0 30px currentColor,
              0 0 45px currentColor,
              0 0 60px currentColor,
              0 0 75px currentColor;
          }
        }

        .logo-glow {
          filter: drop-shadow(0 0 10px rgba(0, 255, 136, 0.7)) drop-shadow(0 0 20px rgba(255, 8, 68, 0.5));
        }

        .neon-border-green {
          border-color: #00ff88;
          box-shadow: 0 0 10px rgba(0, 255, 136, 0.5), inset 0 0 10px rgba(0, 255, 136, 0.2);
        }

        .neon-border-red {
          border-color: #ff0844;
          box-shadow: 0 0 10px rgba(255, 8, 68, 0.5), inset 0 0 10px rgba(255, 8, 68, 0.2);
        }

        [data-sidebar] {
          background: linear-gradient(180deg, #1a0f14 0%, #0f0a0f 50%, #0a0f14 100%);
          border-right: 2px solid rgba(0, 255, 136, 0.3);
        }

        .bg-card {
          background: linear-gradient(135deg, rgba(26, 15, 20, 0.9) 0%, rgba(15, 10, 15, 0.9) 100%);
          border: 1px solid rgba(0, 255, 136, 0.2);
        }
      `}</style>

      <div className="min-h-screen flex w-full">
        {/* Show sidebar for all logged-in users on all pages */}
        {isLoggedIn && (
          <SidebarContentComponent user={user || authSession} />
        )}

        <main className="flex-1 flex flex-col overflow-y-auto">
          <header className="border-b px-6 py-4 md:hidden neon-border-green" style={{ background: 'linear-gradient(90deg, rgba(26, 15, 20, 0.95) 0%, rgba(15, 26, 15, 0.95) 100%)' }}>
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-[#00ff88]/10 p-2 rounded-lg transition-colors duration-200" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <span className="text-lg font-bold text-white">T</span>
                </div>
                <span className="font-bold">
                  <span className="text-emerald-400">Troll</span>
                  <span className="text-cyan-400">City</span>
                </span>
              </div>
            </div>
          </header>

          <div className="flex-1">
            {children}
          </div>

          <footer className="border-t px-6 py-4 text-center neon-border-red" style={{ background: 'linear-gradient(90deg, rgba(26, 15, 20, 0.95) 0%, rgba(26, 10, 15, 0.95) 100%)' }}>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-400">
                © {new Date().getFullYear()} <span className="neon-troll font-semibold">Troll</span><span className="neon-red font-semibold">City</span>. All Rights Reserved.
              </p>
              <p className="text-xs text-red-400 font-semibold">
                ⚠️ Copyright Infringement is a Crime. Unauthorized use of content is strictly prohibited.
              </p>
              <p className="text-xs text-gray-500">
                All content on this platform is protected by copyright law.
              </p>
            </div>
          </footer>
        </main>
      </div>
      <SonnerToaster richColors theme="dark" position="top-right" />
      <HotToaster position="top-right" />
    </SidebarProvider>
  );
}

