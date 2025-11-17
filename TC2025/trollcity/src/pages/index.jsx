import Layout from "./Layout.jsx";
import HolidayTheme from "@/components/HolidayTheme";

import Home from "./Home";
import Store from "./Store";
import StreamViewer from "./StreamViewer";
import GoLive from "./GoLive";
import ProfileSetup from "./ProfileSetup";
import Profile from "./Profile";
import Trending from "./Trending";
import Following from "./Following";
import Followers from "./Followers";
import BroadcasterApplication from "./BroadcasterApplication";
import PublicProfile from "./PublicProfile";
import Notifications from "./Notifications";
import NotificationsPage from "./NotificationsPage";
import AdminDashboardPage from "./AdminDashboardPage.jsx";
import LoginPage from "./LoginPage";
import Auth from "./Auth.jsx";
import Messages from "./Messages.jsx";
import Employment from "./Employment.jsx";
import ContactUs from "./ContactUs.jsx";
import TrollerApplication from "./TrollerApplication.jsx";
import AdminTrollers from "./AdminTrollers.jsx";
import AdminInvite from "./AdminInvite.jsx";
import Earnings from "./Earnings.jsx";
import TrollFamilyApplication from "./TrollFamilyApplication.jsx";
import FamilyPayoutsAdmin from "./FamilyPayoutsAdmin.jsx";
import GamblePage from "./GamblePage.jsx";
import LiveStreamsAdmin from "./LiveStreamsAdmin.jsx";
import AdminAIPanel from "./AdminAIPanel.jsx";
import PaymentRequired from "./PaymentRequired.jsx";
import KickBanFeePage from "./KickBanFee.jsx";
import TrollFamilyHub from "./TrollFamilyHub.jsx";
import TFamPage from "./TFamPage.jsx";
import RulesPage from "./RulesPage.jsx";
import ModernStreamViewer from "./ModernStreamViewer.jsx";
import TrollWheel from "./TrollWheel.jsx";
import TrollLiveShow from "./TrollLiveShow.jsx";
import React, { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from "@/api/supabaseClient";

  const PAGES = {
    Home: Home,
    Store: Store,
    StreamViewer: StreamViewer,
    ModernStreamViewer: ModernStreamViewer,
    GoLive: GoLive,
    ProfileSetup: ProfileSetup,
    Profile: Profile,
    Earnings: Earnings,
    Trending: Trending,
    Following: Following,
    Followers: Followers,
    BroadcasterApplication: BroadcasterApplication,
    PublicProfile: PublicProfile,
    Notifications: Notifications,
    NotificationsPage: NotificationsPage,
    Admin: AdminDashboardPage,
    Messages: Messages,
    TrollerApplication: TrollerApplication,
    TrollFamilyApplication: TrollFamilyApplication,
    TrollFamilyHub: TrollFamilyHub,
    FamilyPayouts: FamilyPayoutsAdmin,
    Gamble: GamblePage,
    Trollers: AdminTrollers,
    AdminInvite: AdminInvite,
    KickBanFee: KickBanFeePage,
    TFam: TFamPage,
    Rules: RulesPage,
    TrollWheel: TrollWheel,
    TrollLiveShow: TrollLiveShow,
  }

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    // Track raw auth session separately so we don't block rendering
    const { data: authUser, isLoading: authLoading } = useQuery({
      queryKey: ["authUser"],
      queryFn: async () => {
        try {
          const { data, error } = await supabase.auth.getUser();
          return data?.user || null;
        } catch (err) {
          return null;
        }
      },
      staleTime: 30000, // Increased to 30 seconds
      retry: 1,
      retryDelay: 500,
      refetchOnWindowFocus: false, // Disable to improve performance
    });

    // Check if user is kicked and redirect to payment page
    const { data: isKicked } = useQuery({
      queryKey: ["isUserKicked", authUser?.id],
      queryFn: async () => {
        if (!authUser?.id) return false;
        const { data, error } = await supabase
          .from("kicked_users")
          .select("id")
          .eq("user_id", authUser.id)
          .order("kicked_at", { ascending: false })
          .limit(1);
        
        if (error) {
          return false;
        }
        
        return data && data.length > 0;
      },
      enabled: !!authUser?.id,
      staleTime: 30000, // Increased to 30 seconds
      refetchOnWindowFocus: false,
    });

    // Check if user is banned
    const { data: isBanned } = useQuery({
      queryKey: ["isUserBanned", authUser?.id],
      queryFn: async () => {
        if (!authUser?.id) return false;
        const { data, error } = await supabase
          .from("profiles")
          .select("is_banned")
          .eq("id", authUser.id)
          .single();
        
        if (error) {
          return false;
        }
        
        return data?.is_banned || false;
      },
      enabled: !!authUser?.id,
      staleTime: 30000, // Increased to 30 seconds
      refetchOnWindowFocus: false,
    });
    const attemptedAutoLoginRef = useRef(false);

    // Keep auth-aware queries fresh when the session changes - optimized
    useEffect(() => {
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        // Only invalidate on significant auth events
        if (_event === 'SIGNED_IN' || _event === 'SIGNED_OUT' || _event === 'TOKEN_REFRESHED') {
          try { queryClient.invalidateQueries({ queryKey: ["authUser"] }); } catch {}
        }
      });
      return () => {
        try { listener.subscription.unsubscribe(); } catch {}
      };
    }, [queryClient]);

    // Dev-only auto-login using env credentials
    useEffect(() => {
      const autoEmail = import.meta.env.VITE_DEV_AUTO_LOGIN_EMAIL || null;
      const autoPass = import.meta.env.VITE_DEV_AUTO_LOGIN_PASSWORD || null;
      const isLoginRoute = location.pathname.toLowerCase() === "/login";

      if (
        !authLoading && !authUser &&
        !attemptedAutoLoginRef.current &&
        supabase.__isConfigured &&
        autoEmail && autoPass &&
        !isLoginRoute
      ) {
        attemptedAutoLoginRef.current = true;
        console.log('🤖 Attempting auto-login with dev credentials');
        supabase.auth
          .signInWithPassword({ email: autoEmail, password: autoPass })
          .catch((e) => {
            console.warn("Auto-login failed:", e?.message || e);
            attemptedAutoLoginRef.current = true;
          });
      }
    }, [authLoading, authUser, location.pathname]);
    const currentPage = _getCurrentPage(location.pathname);
    
    // Force authentication as first screen - redirect all unauthenticated users to login
    const isSupabaseConfigured = !!supabase.__isConfigured;
    const hasCheckedAuth = useRef(false);
    
    useEffect(() => {
      // Only redirect if we're not loading and Supabase is configured
      if (!authLoading && !authUser && isSupabaseConfigured && hasCheckedAuth.current) {
        const allowedPaths = ['/login', '/auth', '/Login', '/Auth'];
        const currentPath = location.pathname.toLowerCase();
        const isAllowedPath = allowedPaths.some(path => currentPath === path.toLowerCase());
        if (!isAllowedPath) {
          console.log('🔄 Redirecting to login - user not authenticated');
          navigate('/login', { replace: true });
        }
      }
      
      // Mark that we've checked auth at least once
      if (!authLoading) {
        hasCheckedAuth.current = true;
      }
    }, [authLoading, authUser, location.pathname, navigate, isSupabaseConfigured]);

    // Redirect kicked users to payment page
    useEffect(() => {
      if (!authLoading && authUser && (isKicked || isBanned)) {
        const allowedPaths = ['/paymentrequired', '/PaymentRequired', '/KickBanFee', '/kickbanfee'];
        const currentPath = location.pathname.toLowerCase();
        const isAllowedPath = allowedPaths.some(path => currentPath === path.toLowerCase());
        if (!isAllowedPath) {
          navigate('/paymentrequired', { replace: true });
        }
      }
    }, [authLoading, authUser, isKicked, isBanned, location.pathname, navigate]);
    // Show loading state while checking authentication
    if (authLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-purple-300">Loading...</p>
          </div>
        </div>
      );
    }

    // Only show login page if we're not loading and user is not authenticated
    if (!authLoading && !authUser && isSupabaseConfigured) {
      const allowedPaths = ['/login', '/auth', '/Login', '/Auth'];
      const currentPath = location.pathname.toLowerCase();
      const isAllowedPath = allowedPaths.some(path => currentPath === path.toLowerCase());
      if (!isAllowedPath) {
        return <LoginPage />;
      }
    }

    return (
        <HolidayTheme>
            <Layout currentPageName={currentPage}>
                <Routes>
                    <Route path="/Login" element={<LoginPage />} />
                    <Route path="/login" element={<LoginPage />} />            
                    <Route path="/Auth" element={<LoginPage />} />
                    <Route path="/" element={<Home />} />
                    <Route path="/Home" element={<Home />} />
                    <Route path="/Store" element={<Store />} />
                    <Route path="/StreamViewer" element={<StreamViewer />} />
                    <Route path="/stream/:streamId" element={<ModernStreamViewer />} />
                    <Route path="/GoLive" element={<GoLive />} />
                    <Route path="/ProfileSetup" element={<ProfileSetup />} />
                    <Route path="/Profile" element={<Profile />} />
                    <Route path="/Trending" element={<Trending />} />
                    <Route path="/Following" element={<Following />} />
                    <Route path="/Followers" element={<Followers />} />
                    <Route path="/Messages" element={<Messages />} />
                    <Route path="/BroadcasterApplication" element={<BroadcasterApplication />} />
                    <Route path="/PublicProfile" element={<PublicProfile />} />
                    <Route path="/Notifications" element={<Notifications />} />
                    <Route path="/NotificationsPage" element={<NotificationsPage />} />
                    <Route path="/Admin" element={<AdminDashboardPage />} />
                    <Route path="/Employment" element={<Employment />} />
                    <Route path="/ContactUs" element={<ContactUs />} />
                    <Route path="/TrollerApplication" element={<TrollerApplication />} />
                    <Route path="/TrollFamilyApplication" element={<TrollFamilyApplication />} />
                    <Route path="/Trollers" element={<AdminTrollers />} />
                    <Route path="/FamilyPayouts" element={<FamilyPayoutsAdmin />} />
                    <Route path="/Gamble" element={<GamblePage />} />
                    <Route path="/Earnings" element={<Earnings />} />
                    <Route path="/AdminAI" element={<AdminAIPanel />} />
                    <Route path="/AdminLiveControl" element={<LiveStreamsAdmin />} />
                    <Route path="/AdminInvite" element={<AdminInvite />} />
                    <Route path="/PaymentRequired" element={<PaymentRequired />} />
                    <Route path="/KickBanFee" element={<KickBanFeePage />} />
                    <Route path="/TFam" element={<TFamPage />} />
                    <Route path="/Rules" element={<RulesPage />} />
                    <Route path="/TrollWheel" element={<TrollWheel />} />
                    <Route path="/TrollLiveShow" element={<TrollLiveShow />} />
                </Routes>
            </Layout>
        </HolidayTheme>
    );
}

export default function Pages() {
    return <PagesContent />;
}

// Global error handler to prevent authentication popups during initial load
window.addEventListener('error', (event) => {
  if (event.error && event.error.message) {
    const errorMessage = event.error.message.toLowerCase();
    if (errorMessage.includes('please log in') || errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
      console.log('🚫 Suppressed authentication error popup:', event.error.message);
      event.preventDefault();
      return false;
    }
  }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message) {
    const errorMessage = event.reason.message.toLowerCase();
    if (errorMessage.includes('please log in') || errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
      console.log('🚫 Suppressed authentication promise rejection:', event.reason.message);
      event.preventDefault();
      return false;
    }
  }
});
