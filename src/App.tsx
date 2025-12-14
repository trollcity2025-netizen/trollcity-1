// src/App.tsx
import React, { useEffect, Suspense, lazy, useState, useRef } from "react";
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "./lib/store";
import { supabase, isAdminEmail, UserRole } from "./lib/supabase";
import api from "./lib/api";
import { Toaster, toast } from "sonner";
import { useGlobalApp } from "./contexts/GlobalAppContext";
import GlobalLoadingOverlay from "./components/GlobalLoadingOverlay";
import GlobalErrorBanner from "./components/GlobalErrorBanner";
import GlobalEventsBanner from "./components/GlobalEventsBanner";
import { updateRoute } from "./utils/sessionStorage";

// Layout
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import ProfileSetupModal from "./components/ProfileSetupModal";
import RequireRole from "./components/RequireRole";
import { RequireLeadOrOwner } from "./components/auth/RequireLeadOrOwner";

// Static pages (fast load)
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import TermsAgreement from "./pages/TermsAgreement";

// Lazy-loaded pages
const ProfileSetupPage = lazy(() => import("./pages/ProfileSetupPage"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const StreamEnded = lazy(() => import("./pages/StreamEnded"));
const AdminRFC = lazy(() => import("./components/AdminRFC"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const PaymentTerms = lazy(() => import("./pages/PaymentTerms"));
const CreatorAgreement = lazy(() => import("./pages/CreatorAgreement"));
const TaxOnboarding = lazy(() => import("./pages/TaxOnboarding"));
const AdminEarningsDashboard = lazy(() => import("./pages/admin/AdminEarningsDashboard"));
const MyEarnings = lazy(() => import("./pages/MyEarnings"));
const EarningsPage = lazy(() => import("./pages/EarningsPage"));

// Lazy-loaded pages
const GoLive = lazy(() => import("./pages/GoLive"));
const LiveBroadcast = lazy(() => import("./pages/LiveBroadcast"));
const StreamRoom = lazy(() => import("./pages/StreamRoom"));
const Stream = lazy(() => import("./pages/Stream"));
const StreamSummary = lazy(() => import("./pages/StreamSummary"));
const Messages = lazy(() => import("./pages/Messages"));
const Call = lazy(() => import("./pages/Call"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Trollifications = lazy(() => import("./pages/Trollifications"));
const Following = lazy(() => import("./pages/Following"));
const Application = lazy(() => import("./pages/Application"));
const TrollOfficerLounge = lazy(() => import("./pages/TrollOfficerLounge"));
const OfficerModeration = lazy(() => import("./pages/OfficerModeration"));
const OfficerScheduling = lazy(() => import("./pages/OfficerScheduling"));
const Orientation = lazy(() => import("./pages/officer/Orientation"));
const OrientationQuiz = lazy(() => import("./pages/officer/OrientationQuiz"));
const OfficerOnboarding = lazy(() => import("./pages/officer/OfficerOnboarding"));
const OfficerTrainingSimulator = lazy(() => import("./pages/officer/OfficerTrainingSimulator"));
const OfficerTrainingProgress = lazy(() => import("./pages/officer/OfficerTrainingProgress"));
const OfficerPayrollDashboard = lazy(() => import("./pages/officer/OfficerPayrollDashboard"));
const OfficerDashboard = lazy(() => import("./pages/officer/OfficerDashboard"));
const OfficerOWCDashboard = lazy(() => import("./pages/OfficerOWCDashboard"));
const ReportDetailsPage = lazy(() => import("./pages/ReportDetailsPage"));
const TrollFamilyCity = lazy(() => import("./pages/TrollFamilyCity"));
const FamilyProfilePage = lazy(() => import("./pages/FamilyProfilePage"));
const FamilyWarsPage = lazy(() => import("./pages/FamilyWarsPage"));
const FamilyChatPage = lazy(() => import("./pages/FamilyChatPage"));
const FamilyLounge = lazy(() => import("./pages/FamilyLounge.jsx"));
const FamilyWarsHub = lazy(() => import("./pages/FamilyWarsHub.jsx"));
const FamilyLeaderboard = lazy(() => import("./pages/FamilyLeaderboard.jsx"));
const FamilyShop = lazy(() => import("./pages/FamilyShop.jsx"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const _EarningsPayout = lazy(() => import("./pages/EarningsPayout"));
const TransactionHistory = lazy(() => import("./pages/TransactionHistory"));
const TrollCityWall = lazy(() => import("./pages/TrollCityWall"));
const ReelFeed = lazy(() => import("./pages/ReelFeed"));
const CashoutPage = lazy(() => import("./pages/CashoutPage"));
const FamilyApplication = lazy(() => import("./pages/FamilyApplication"));
const OfficerApplication = lazy(() => import("./pages/OfficerApplication"));
const TrollerApplication = lazy(() => import("./pages/TrollerApplication"));
const LeadOfficerApplication = lazy(() => import("./pages/LeadOfficerApplication"));
const CoinStore = lazy(() => import("./pages/CoinStore"));
const TrollmondsStore = lazy(() => import("./pages/TrollmondsStore"));
const SellOnTrollCity = lazy(() => import("./pages/SellOnTrollCity"));
const ShopEarnings = lazy(() => import("./pages/ShopEarnings"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminPayoutMobile = lazy(() => import("./pages/admin/AdminPayoutMobile"));
const MobileAdminDashboard = lazy(() => import("./pages/admin/MobileAdminDashboard"));
const PaymentsDashboard = lazy(() => import("./pages/admin/PaymentsDashboard"));
const EconomyDashboard = lazy(() => import("./pages/admin/EconomyDashboard"));
const TaxUpload = lazy(() => import("./pages/TaxUpload"));
const TaxReviewPanel = lazy(() => import("./pages/admin/TaxReviewPanel"));
const PaymentCallback = lazy(() => import("./pages/PaymentCallback"));
const CoinsComplete = lazy(() => import("./pages/CoinsComplete"));
const PayoutSetupPage = lazy(() => import("./pages/PayoutSetupPage"));
const Withdraw = lazy(() => import("./pages/Withdraw"));
const Support = lazy(() => import("./pages/Support"));
const Profile = lazy(() => import("./pages/Profile"));
const Changelog = lazy(() => import("./pages/Changelog"));
const _AccountWallet = lazy(() => import("./pages/AccountWallet"));
const _PaymentSettings = lazy(() => import("./pages/PaymentSettings"));
const _AccountPaymentsSuccess = lazy(() => import("./pages/AccountPaymentsSuccess"));
const _AccountPaymentLinkedSuccess = lazy(() => import("./pages/AccountPaymentLinkedSuccess"));
const EmpirePartnerDashboard = lazy(() => import("./pages/EmpirePartnerDashboard"));
const ReferralBonusPanel = lazy(() => import("./pages/admin/ReferralBonusPanel"));
const _EmpireApplications = lazy(() => import("./pages/admin/EmpireApplications"));
const EmpirePartnerApply = lazy(() => import("./pages/EmpirePartnerApply"));
const AddCard = lazy(() => import("./pages/AddCard"));
const EarningsDashboard = lazy(() => import("./pages/EarningsDashboard"));
const CreatorOnboarding = lazy(() => import("./pages/CreatorOnboarding"));
const PolicyCenter = lazy(() => import("./pages/PolicyCenter"));
const TermsOfServiceLegal = lazy(() => import("./pages/legal/TermsOfService"));
const RefundPolicyLegal = lazy(() => import("./pages/legal/RefundPolicy"));
const PayoutPolicyLegal = lazy(() => import("./pages/legal/PayoutPolicy"));
const SafetyGuidelinesLegal = lazy(() => import("./pages/legal/SafetyGuidelines"));
const CreatorEarnings = lazy(() => import("./pages/legal/CreatorEarnings"));
const GamblingDisclosure = lazy(() => import("./pages/legal/GamblingDisclosure"));
const PartnerProgram = lazy(() => import("./pages/legal/PartnerProgram"));
const Safety = lazy(() => import("./pages/Safety"));
const Wallet = lazy(() => import("./pages/Wallet"));
const PayoutRequest = lazy(() => import("./pages/PayoutRequest"));
const AdminPayoutDashboard = lazy(() => import("./pages/admin/components/AdminPayoutDashboard"));
const AdminLiveOfficersTracker = lazy(() => import("./pages/admin/AdminLiveOfficersTracker"));
const _VerificationPage = lazy(() => import("./pages/VerificationPage"));
const _VerificationComplete = lazy(() => import("./pages/VerificationComplete"));
const AdminVerifiedUsers = lazy(() => import("./pages/admin/AdminVerifiedUsers"));
const _AIVerificationPage = lazy(() => import("./pages/AIVerificationPage"));
const AdminVerificationReview = lazy(() => import("./pages/admin/AdminVerificationReview"));
const AdminPoliciesDocs = lazy(() => import("./pages/admin/AdminPoliciesDocs"));
const AdminMarketplace = lazy(() => import("./pages/admin/AdminMarketplace"));
const AdminHQ = lazy(() => import("./pages/admin/AdminHQ"));
const CityControlCenter = lazy(() => import("./pages/admin/CityControlCenter"));
const ReputationDashboard = lazy(() => import("./pages/admin/ReputationDashboard"));
const EscalationMatrix = lazy(() => import("./pages/admin/EscalationMatrix"));
const OfficerOperations = lazy(() => import("./pages/admin/OfficerOperations"));
const CityEventsManager = lazy(() => import("./pages/admin/CityEventsManager"));
const TrollFamily = lazy(() => import("./pages/admin/TrollFamily"));
const LeadOfficerReview = lazy(() => import("./pages/lead-officer/Review"));
const LeadOfficerDashboard = lazy(() => import("./pages/lead-officer/LeadOfficerDashboard").then(m => ({ default: m.LeadOfficerDashboard })));
const ApplicationsPage = lazy(() => import("./pages/admin/Applications"));
const AdminOfficerReports = lazy(() => import("./pages/admin/AdminOfficerReports"));
const StoreDebug = lazy(() => import("./pages/admin/StoreDebug"));
const ShopPartnerPage = lazy(() => import("./pages/ShopPartnerPage"));
const TromodyShow = lazy(() => import("./pages/TromodyShow"));
const CommandBattleGoLive = lazy(() => import("./pages/CommandBattleGoLive"));
const OfficerLoungeStream = lazy(() => import("./pages/OfficerLoungeStream"));
const TrollWheel = lazy(() => import("./pages/TrollWheel"));
const TrollCourt = lazy(() => import("./pages/TrollCourt"));
const CourtRoom = lazy(() => import("./pages/CourtRoom"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const ShopView = lazy(() => import("./pages/ShopView"));
const UserInventory = lazy(() => import("./pages/UserInventory"));
const DistrictTour = lazy(() => import("./pages/DistrictTour"));
const _DistrictNavigation = lazy(() => import("./components/DistrictNavigation"));

function AppContent() {
  console.log('🚀 App component rendering...');
  const {
    user,
    profile,
    setAuth,
    setProfile,
    setLoading,
    isLoading,
  } = useAuthStore();
  console.log('📊 App state:', { hasUser: !!user, hasProfile: !!profile, isLoading });

  // APP INIT ONCE debug log
  useEffect(() => {
    console.log('[APP INIT ONCE]')
  }, [])

  const location = useLocation();
  const navigate = useNavigate();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalLoading] = useState(false);

  // Guard startup navigation
  const didNavigateRef = useRef(false);

  // Global app context for loading and error states
  const { isLoading: globalLoading, loadingMessage, error, errorType, clearError: _clearError, retryLastAction, isReconnecting, reconnectMessage } = useGlobalApp();

  // Track route changes for session persistence
  useEffect(() => {
    updateRoute(location.pathname);
  }, [location.pathname]);

  // 🔹 Auto-routing after approval (only on home page, not on every route change)
  useEffect(() => {
    // Only auto-route from home page (/) - never redirect from other pages
    if (location.pathname !== '/') {
      return;
    }

    // Don't redirect if user is not logged in
    if (!user || !profile) {
      return;
    }

    // Guard against multiple navigates
    if (didNavigateRef.current) {
      return;
    }

    // Only redirect officers who need orientation (lead officers and admins skip quiz)
    if (profile?.role === 'troll_officer' || profile?.is_troll_officer) {
      // Admins don't need orientation/quiz - they're automatically active
      if (profile?.role === 'admin' || profile?.is_admin) {
        // Admin is already active, no redirect needed
        return;
      }
      // Lead officers don't need orientation/quiz - they're activated immediately
      if (profile?.is_lead_officer) {
        // Lead officer is already active, no redirect needed
        return;
      }
      // Regular officers need to complete orientation/quiz
      if (!profile?.is_officer_active) {
        didNavigateRef.current = true;
        navigate('/officer/orientation', { replace: true });
      }
    } else if (profile?.role === 'troll_family') {
      didNavigateRef.current = true;
      navigate('/family', { replace: true });
    }
  }, [profile?.role, profile?.is_troll_officer, profile?.is_officer_active, location.pathname, navigate, user]);

  // 🔹 Check if user is kicked or banned and show re-entry modal
  useEffect(() => {
    if (profile && (profile.is_kicked || profile.is_banned)) {
      // Import and show kick re-entry modal
      import('./components/KickReentryModal').then(({ default: _KickReentryModal }) => {
        // This will be handled by a global state or context
        // For now, we'll check on route changes
      })
    }
  }, [profile?.is_kicked, profile?.is_banned]);

  // 🔹 Track user IP address and check for IP bans
  useEffect(() => {
    const trackIP = async () => {
      if (!user?.id) return

      try {
        // Get user's IP address
        const ipResponse = await fetch('https://api.ipify.org?format=json')
        const ipData = await ipResponse.json()
        const userIP = ipData.ip

        // Check if IP is banned
        const { data: isBanned, error: banError } = await supabase.rpc('is_ip_banned', {
          p_ip_address: userIP
        })

        if (banError) {
          console.error('Error checking IP ban:', banError)
          return
        }

        if (isBanned) {
          toast.error('Your IP address has been banned. Please contact support.')
          // Sign out user
          await supabase.auth.signOut()
          useAuthStore.getState().logout()
          navigate('/auth', { replace: true })
          return
        }

        // Update user's last known IP
        const { data: currentProfile } = await supabase
          .from('user_profiles')
          .select('ip_address_history')
          .eq('id', user.id)
          .single()

        const ipHistory = currentProfile?.ip_address_history || []
        const newIPEntry = {
          ip: userIP,
          timestamp: new Date().toISOString()
        }

        // Add to history if not already present
        const updatedHistory = [...ipHistory, newIPEntry].slice(-10) // Keep last 10 IPs

        await supabase
          .from('user_profiles')
          .update({ 
            last_known_ip: userIP,
            ip_address_history: updatedHistory
          })
          .eq('id', user.id)
      } catch (error) {
        console.error('Error tracking IP:', error)
      }
    }

    if (user) {
      trackIP()
    }
  }, [user?.id])


  // 🔹 Real-time Profile Updates
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('profile-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          console.log('Profile updated via realtime:', payload.new)
          setProfile(payload.new as any)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, setProfile])

  // 🔹 Authentication Initialization
  useEffect(() => {
    const initSession = async () => {
      console.log('🔐 Initializing auth session...');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('📋 Session retrieved:', !!session);
        setAuth(session?.user || null, session);

        if (!session?.user) {
          console.log('❌ No user session, setting profile to null');
          return setProfile(null);
        }

        const isAdmin = isAdminEmail(session.user.email);
        console.log('👑 Is admin:', isAdmin);

        if (isAdmin) {
          const cached = localStorage.getItem("admin-profile-cache");
          if (cached) {
            console.log('📦 Using cached admin profile');
            setProfile(JSON.parse(cached));
          }
          try {
            console.log('🔧 Calling admin fix API...');
            const result = await api.post("/auth/fix-admin-role");
            console.log('🔧 Admin fix result:', result);
            if (result?.success && result.profile) {
              setProfile(result.profile);
              localStorage.setItem("admin-profile-cache", JSON.stringify(result.profile));
              return;
            }
          } catch (apiErr) {
            console.error('❌ Admin fix API failed:', apiErr);
          }
        }

        // Normal user profile
        console.log('👤 Loading normal user profile...');
        const { data: profileData } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();
        console.log('👤 Profile data loaded:', !!profileData);
        setProfile(profileData || null);
      } catch (err) {
        console.error("❌ Auth Init Error:", err);
      } finally {
        setLoading(false);
        console.log('🏁 Auth initialization complete');
      }
    };
    initSession();
  }, []);

  // Failsafe so refreshes never get stuck on the loading screen
  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(timeout);
  }, [setLoading]);


  // 🔹 Auth State Change Listener (handles token refresh failures)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, !!session);

        if (event === 'SIGNED_OUT' || !session) {
          console.log('🚪 User signed out or session expired');
          setAuth(null, null);
          setProfile(null);
          // Clear any cached admin profile
          localStorage.removeItem("admin-profile-cache");
          return;
        }

        if (event === 'TOKEN_REFRESHED') {
          console.log('🔑 Token refreshed successfully');
          setAuth(session?.user || null, session);
        }

        if (event === 'SIGNED_IN') {
          console.log('✅ User signed in');
          setAuth(session?.user || null, session);

          // Load profile for new sign in
          if (session?.user) {
            const isAdmin = isAdminEmail(session.user.email);
            if (isAdmin) {
              try {
                const result = await api.post("/auth/fix-admin-role");
                if (result?.success && result.profile) {
                  setProfile(result.profile);
                  localStorage.setItem("admin-profile-cache", JSON.stringify(result.profile));
                  return;
                }
              } catch (apiErr) {
                console.error('❌ Admin fix API failed on sign in:', apiErr);
              }
            }

            // Normal user profile
            const { data: profileData } = await supabase
              .from("user_profiles")
              .select("*")
              .eq("id", session.user.id)
              .maybeSingle();
            setProfile(profileData || null);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 🔹 Loading state
  const LoadingScreen = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0814] text-white">
      <div className="animate-pulse px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">
        Loading…
      </div>
    </div>
  );

  // 🔐 Route Guard
  const RequireAuth = () => {
    if (isLoading) return <LoadingScreen />;
    if (!user) return <Navigate to="/auth" replace />;
    if (
      profile &&
      profile.terms_accepted === false &&
      profile.role !== "admin" &&
      location.pathname !== "/terms"
    ) {
      return <Navigate to="/terms" replace />;
    }
    return <Outlet />;
  };

  console.log('🎨 App returning JSX...');
  return (
    <>
      {/* Global Error Banner */}
      <GlobalErrorBanner />

      {/* Global Events Banner */}
      <GlobalEventsBanner />

      {/* Global Loading Overlay */}
      <GlobalLoadingOverlay
        isVisible={globalLoading}
        message={loadingMessage}
        type="loading"
      />

      {/* Global Reconnecting Overlay */}
      <GlobalLoadingOverlay
        isVisible={isReconnecting}
        message={reconnectMessage}
        type="reconnecting"
      />

      {/* Global Error Overlay (for critical errors) */}
      <GlobalLoadingOverlay
        isVisible={!!error && errorType !== 'offline' && !isReconnecting}
        message={error || ''}
        type={errorType as 'error' | 'offline'}
        onRetry={retryLastAction}
      />

      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
        <div className="flex min-h-screen">
          {/* Desktop Sidebar */}
          {user && <div className="hidden md:block"><Sidebar /></div>}

          <div className="flex flex-col flex-1 min-h-screen w-full md:w-auto">
            {user && <Header />}

            <main className="flex-1 overflow-y-auto bg-[#121212] safe-area-bottom">
              <Suspense fallback={<LoadingScreen />}>
                <Routes>

                {/* 🚪 Public Routes */}
                <Route path="/" element={user ? <Navigate to="/live" replace /> : <LandingPage />} />
                <Route path="/auth" element={user ? <Navigate to="/live" replace /> : <Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/terms" element={<TermsAgreement />} />
                <Route path="/terms-of-service" element={<TermsOfService />} />
                <Route path="/refund-policy" element={<RefundPolicy />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/payment-terms" element={<PaymentTerms />} />
                <Route path="/creator-agreement" element={<CreatorAgreement />} />
                <Route path="/tax-onboarding" element={<TaxOnboarding />} />
                <Route path="/account/earnings" element={<EarningsDashboard />} />
                
                {/* Legal/Policy Pages */}
                <Route path="/legal" element={<PolicyCenter />} />
                <Route path="/legal/terms" element={<TermsOfServiceLegal />} />
                <Route path="/legal/refunds" element={<RefundPolicyLegal />} />
                <Route path="/legal/refund" element={<RefundPolicyLegal />} />
                <Route path="/legal/payouts" element={<PayoutPolicyLegal />} />
                <Route path="/legal/safety" element={<SafetyGuidelinesLegal />} />
                <Route path="/legal/creator-earnings" element={<CreatorEarnings />} />
                <Route path="/legal/gambling-disclosure" element={<GamblingDisclosure />} />
                <Route path="/legal/partner-program" element={<PartnerProgram />} />
                
                {/* Safety Page (standalone) */}
                <Route path="/safety" element={<Safety />} />

                {/* 🔐 Protected Routes */}
                <Route element={<RequireAuth />}>
                  <Route path="/live" element={<Home />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/call/:roomId/:type/:userId" element={<Call />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/following" element={<Following />} />
                  <Route path="/trollifications" element={<Trollifications />} />
                  <Route path="/troll-wheel" element={<TrollWheel />} />
                  <Route path="/marketplace" element={<Marketplace />} />
                  <Route path="/shop/:id" element={<ShopView />} />
                  <Route path="/inventory" element={<UserInventory />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/wall" element={<TrollCityWall />} />
                  <Route path="/reels" element={<ReelFeed />} />
                  <Route path="/profile/:username" element={<Profile />} />
                  <Route path="/profile/setup" element={<ProfileSetupPage />} />

                  {/* 🎥 Streaming */}
                  <Route path="/go-live" element={<GoLive />} />
                  <Route path="/live/:streamId" element={<LiveBroadcast />} />
                  <Route path="/stream/:id" element={<Stream />} />
                  <Route path="/stream/:streamId" element={<StreamRoom />} />
                  <Route path="/stream/:id/summary" element={<StreamSummary />} />
                  <Route path="/stream-ended" element={<StreamEnded />} />
                  
                  {/* 🎮 Multi-Box Streaming */}
                  <Route path="/command-battle-go-live" element={<CommandBattleGoLive />} />
                  <Route path="/officer-stream" element={
                    <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]} requireActive={true}>
                      <OfficerLoungeStream />
                    </RequireRole>
                  } />
                  
                  {/* 👥 Empire Partner Program */}
                  <Route path="/empire-partner" element={<EmpirePartnerDashboard />} />
                  <Route path="/empire-partner/apply" element={<EmpirePartnerApply />} />

                  {/* 🎤 Tromody Show */}
                  <Route path="/tromody" element={<TromodyShow />} />
                  <Route path="/troll-court" element={<TrollCourt />} />
                  <Route path="/troll-court/session/:sessionId" element={<CourtRoom />} />
                  <Route path="/districts/:districtName/tour" element={<DistrictTour />} />

                  {/* 💳 Payment Methods */}
                  <Route path="/add-card" element={<AddCard />} />
                  
                  {/* 📝 Creator Onboarding */}
                  <Route path="/onboarding/creator" element={<CreatorOnboarding />} />

                  {/* 💰 Earnings & Coins */}
                  <Route path="/store" element={<CoinStore />} />
                  <Route path="/coins" element={<CoinStore />} />
                  <Route path="/trollmonds-store" element={<TrollmondsStore />} />
                  <Route path="/coins/complete" element={<CoinsComplete />} />
                  <Route path="/wallet" element={<Wallet />} />
                  <Route path="/payouts/setup" element={<PayoutSetupPage />} />
                  <Route path="/payouts/request" element={<PayoutRequest />} />
                  <Route path="/payment/callback" element={<PaymentCallback />} />
                  <Route path="/earnings" element={<EarningsPage />} />
                  <Route path="/my-earnings" element={<MyEarnings />} />
                  <Route path="/cashout" element={<CashoutPage />} />
                  <Route path="/withdraw" element={<Withdraw />} />
                  <Route path="/transactions" element={<TransactionHistory />} />
                  <Route path="/shop-partner" element={<ShopPartnerPage />} />
                  <Route path="/sell" element={<SellOnTrollCity />} />
                  <Route path="/seller/earnings" element={<ShopEarnings />} />

                  {/* 👨‍👩‍👧 Family */}
                  <Route path="/family" element={<FamilyLounge />} />
                  <Route path="/family/city" element={<TrollFamilyCity />} />
                  <Route path="/family/profile/:id" element={<FamilyProfilePage />} />
                  <Route path="/family/chat" element={<FamilyChatPage />} />
                  <Route path="/family/wars" element={<FamilyWarsPage />} />

                  {/* 🏰 Troll Family Ecosystem */}
                  <Route path="/family/lounge" element={<FamilyLounge />} />
                  <Route path="/family/wars-hub" element={<FamilyWarsHub />} />
                  <Route path="/family/leaderboard" element={<FamilyLeaderboard />} />
                  <Route path="/family/shop" element={<FamilyShop />} />

                  {/* 📝 Applications */}
                  <Route path="/apply" element={<Application />} />
                  <Route path="/apply/family" element={<FamilyApplication />} />
                  <Route path="/apply/officer" element={<OfficerApplication />} />
                  <Route path="/apply/troller" element={<TrollerApplication />} />
                  <Route path="/apply/lead-officer" element={<LeadOfficerApplication />} />

                  {/* 👮 Officer */}
                  <Route
                    path="/officer/onboarding"
                    element={<OfficerOnboarding />}
                  />
                  <Route
                    path="/officer/orientation"
                    element={<Orientation />}
                  />
                  <Route
                    path="/officer/orientation/quiz"
                    element={<OrientationQuiz />}
                  />
                  <Route
                    path="/lead-officer/review"
                    element={
                      <RequireRole roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER]}>
                        <LeadOfficerReview />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/lead-officer"
                    element={
                      <RequireLeadOrOwner>
                        <LeadOfficerDashboard />
                      </RequireLeadOrOwner>
                    }
                  />
                  <Route
                    path="/officer/lounge"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]} requireActive={true}>
                        <TrollOfficerLounge />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/moderation"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]} requireActive={true}>
                        <OfficerModeration />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/report/:id"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]} requireActive={true}>
                        <ReportDetailsPage />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/scheduling"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]} requireActive={true}>
                        <OfficerScheduling />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/dashboard"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]}>
                        <OfficerDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/owc"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]} requireActive={true}>
                        <OfficerOWCDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/training"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]}>
                        <OfficerTrainingSimulator />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/training-progress"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]}>
                        <OfficerTrainingProgress />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/payroll"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]}>
                        <OfficerPayrollDashboard />
                      </RequireRole>
                    }
                  />

                  {/* 👑 Admin */}
                  <Route
                    path="/admin"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <AdminDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/store-debug"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <StoreDebug />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/payouts-mobile"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <AdminPayoutMobile />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin-mobile"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <MobileAdminDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/officer-reports"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <AdminOfficerReports />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/earnings"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <AdminEarningsDashboard />
                      </RequireRole>
                    }
                  />
                    <Route
                      path="/admin/payments"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER]}>
                          <PaymentsDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/economy"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER]}>
                          <EconomyDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/tax-reviews"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER]}>
                          <TaxReviewPanel />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/tax/upload"
                      element={<TaxUpload />}
                    />
                    <Route
                      path="/admin/referrals"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER]}>
                          <ReferralBonusPanel />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/payouts"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminPayoutDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/officers-live"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminLiveOfficersTracker />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/verified-users"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminVerifiedUsers />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/verification"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminVerificationReview />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/applications"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ApplicationsPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/docs/policies"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminPoliciesDocs />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/marketplace"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminMarketplace />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/hq"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminHQ />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/control-center"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <CityControlCenter />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/reputation"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ReputationDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/escalation-matrix"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <EscalationMatrix />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/officer-operations"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <OfficerOperations />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/city-events"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <CityEventsManager />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/royal-family"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <TrollFamily />
                        </RequireRole>
                      }
                    />
                  <Route path="/rfc" element={<AdminRFC />} />
                  <Route
                    path="/changelog"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <Changelog />
                      </RequireRole>
                    }
                  />
                  {/* Account routes removed - Settings/Account pages no longer in sidebar */}
                </Route>

                {/* 🔙 Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>

      {/* Profile setup modal */}
      <ProfileSetupModal
        isOpen={profileModalOpen}
        onSubmit={() => {}}
        loading={profileModalLoading}
        onClose={() => setProfileModalOpen(false)}
      />

      {/* Toast system */}
      <Toaster
        position="top-right"
        duration={5000}
        toastOptions={{
          style: {
            background: "#2e1065",
            color: "#fff",
            border: "1px solid #22c55e",
          },
        }}
      />
    </div>
  </>
);
}

export default function App() {
  return <AppContent />;
}
