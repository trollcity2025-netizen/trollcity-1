// src/App.tsx
import React, { useEffect, Suspense, lazy, useState, useRef } from "react";
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "./lib/store";
import { useEligibilityStore } from "./lib/eligibilityStore";
import { supabase, UserRole } from "./lib/supabase";
import { Toaster, toast } from "sonner";
import GlobalLoadingOverlay from "./components/GlobalLoadingOverlay";
import GlobalErrorBanner from "./components/GlobalErrorBanner";
import { useGlobalApp } from "./contexts/GlobalAppContext";
import { updateRoute } from "./utils/sessionStorage";
import { useDebouncedProfileUpdate } from "./hooks/useDebouncedProfileUpdate";
import { APP_DATA_REFETCH_EVENT_NAME } from "./lib/appEvents";

// Layout
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import AdminOfficerQuickMenu from "./components/AdminOfficerQuickMenu";
import ProfileSetupModal from "./components/ProfileSetupModal";
import RequireRole from "./components/RequireRole";
import { RequireLeadOrOwner } from "./components/auth/RequireLeadOrOwner";

// Static pages (fast load)
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import TermsAgreement from "./pages/TermsAgreement";

// Sidebar pages (instant load)
import Messages from "./pages/Messages";
import Following from "./pages/Following";
import CoinStore from "./pages/CoinStore";
import Marketplace from "./pages/Marketplace";
import UserInventory from "./pages/UserInventory";
import SellOnTrollCity from "./pages/SellOnTrollCity";
import Leaderboard from "./pages/Leaderboard";
import TrollCityWall from "./pages/TrollCityWall";
import TrollCourt from "./pages/TrollCourt";
import EmpirePartnerDashboard from "./pages/EmpirePartnerDashboard";
import GiftStorePage from "./pages/GiftStorePage";
import GiftInventoryPage from "./pages/GiftInventoryPage";
import Application from "./pages/Application";
import ApplicationPage from "./pages/ApplicationPage";
import TrollsTownPage from "./pages/TrollsTownPage";
import TrollOfficerLounge from "./pages/TrollOfficerLounge";
import OfficerModeration from "./pages/OfficerModeration";
import TrollFamily from "./pages/TrollFamily";
import FamilyLounge from "./pages/FamilyLounge.jsx";
import FamilyWarsHub from "./pages/FamilyWarsHub.jsx";
import FamilyLeaderboard from "./pages/FamilyLeaderboard.jsx";
import FamilyShop from "./pages/FamilyShop.jsx";
import Support from "./pages/Support";
import Safety from "./pages/Safety";
import AdminRFC from "./components/AdminRFC";
import AdminEarningsDashboard from "./pages/admin/AdminEarningsDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ApplicationsPage from "./pages/admin/Applications";
import AdminMarketplace from "./pages/admin/AdminMarketplace";
import AdminOfficerReports from "./pages/admin/AdminOfficerReports";
import StoreDebug from "./pages/admin/StoreDebug";
import Changelog from "./pages/Changelog";
import AccessDenied from "./pages/AccessDenied";
import ReferralBonusPanel from "./pages/admin/ReferralBonusPanel";

// Lazy-loaded pages
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const StreamEnded = lazy(() => import("./pages/StreamEnded"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const PaymentTerms = lazy(() => import("./pages/PaymentTerms"));
const CreatorAgreement = lazy(() => import("./pages/CreatorAgreement"));
const TaxOnboarding = lazy(() => import("./pages/TaxOnboarding"));
const MyEarnings = lazy(() => import("./pages/MyEarnings"));
const EarningsPage = lazy(() => import("./pages/EarningsPage"));
const VerificationPage = lazy(() => import("./pages/VerificationPage"));
const VerificationComplete = lazy(() => import("./pages/VerificationComplete"));
const AIVerificationPage = lazy(() => import("./pages/AIVerificationPage"));

// Lazy-loaded pages
const GoLiveSetup = lazy(() => import("./pages/GoLiveSetup"));
const TromodyShow = lazy(() => import("./pages/TromodyShow"));
const OfficerLoungeStream = lazy(() => import("./pages/OfficerLoungeStream"));
const LiveStreamPage = lazy(() => import("./pages/LiveStreamPage"));
const Stream = lazy(() => import("./pages/Stream"));
const StreamSummary = lazy(() => import("./pages/StreamSummary"));
const Call = lazy(() => import("./pages/Call"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Trollifications = lazy(() => import("./pages/Trollifications"));
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
const TransactionHistory = lazy(() => import("./pages/TransactionHistory"));
const ReelFeed = lazy(() => import("./pages/ReelFeed"));
const CashoutPage = lazy(() => import("./pages/CashoutPage"));
const FamilyApplication = lazy(() => import("./pages/FamilyApplication"));
const OfficerApplication = lazy(() => import("./pages/OfficerApplication"));
const TrollerApplication = lazy(() => import("./pages/TrollerApplication"));
const LeadOfficerApplication = lazy(() => import("./pages/LeadOfficerApplication"));
const ShopEarnings = lazy(() => import("./pages/ShopEarnings"));
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
const Profile = lazy(() => import("./pages/Profile"));
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
const Wallet = lazy(() => import("./pages/Wallet"));
const PayoutRequest = lazy(() => import("./pages/PayoutRequest"));
const AdminPayoutDashboard = lazy(() => import("./pages/admin/components/AdminPayoutDashboard"));
const AdminLiveOfficersTracker = lazy(() => import("./pages/admin/AdminLiveOfficersTracker"));
const AdminVerifiedUsers = lazy(() => import("./pages/admin/AdminVerifiedUsers"));
const AdminVerificationReview = lazy(() => import("./pages/admin/AdminVerificationReview"));
const AdminPoliciesDocs = lazy(() => import("./pages/admin/AdminPoliciesDocs"));
const LeadOfficerReview = lazy(() => import("./pages/lead-officer/Review"));
const LeadOfficerDashboard = lazy(() => import("./pages/lead-officer/LeadOfficerDashboard").then(m => ({ default: m.LeadOfficerDashboard })));
const ShopPartnerPage = lazy(() => import("./pages/ShopPartnerPage"));
const CommandBattleGoLive = lazy(() => import("./pages/CommandBattleGoLive"));
const TrollBattleSetup = lazy(() => import("./pages/TrollBattleSetup"));
const ShopView = lazy(() => import("./pages/ShopView"));
const CourtRoom = lazy(() => import("./pages/CourtRoom"));
const InterviewRoom = lazy(() => import("./pages/InterviewRoom"));

// Admin pages
const DatabaseBackup = lazy(() => import("./pages/admin/DatabaseBackup"));
const CacheClear = lazy(() => import("./pages/admin/CacheClear"));
const SystemConfig = lazy(() => import("./pages/admin/SystemConfig"));
const BanManagement = lazy(() => import("./pages/admin/BanManagement"));
const RoleManagement = lazy(() => import("./pages/admin/RoleManagement"));
const MediaLibrary = lazy(() => import("./pages/admin/MediaLibrary"));
const ChatModeration = lazy(() => import("./pages/admin/ChatModeration"));
const Announcements = lazy(() => import("./pages/admin/Announcements"));
const ExportData = lazy(() => import("./pages/admin/ExportData"));
const UserSearch = lazy(() => import("./pages/admin/UserSearch"));
const ReportsQueue = lazy(() => import("./pages/admin/ReportsQueue"));
const StreamMonitorPage = lazy(() => import("./pages/admin/StreamMonitorPage"));
const GrantCoins = lazy(() => import("./pages/admin/GrantCoins"));
const PaymentLogs = lazy(() => import("./pages/admin/PaymentLogs"));
const AdminFinanceDashboard = lazy(() => import("./pages/admin/AdminFinanceDashboard"));
const CreateSchedule = lazy(() => import("./pages/admin/CreateSchedule"));
const OfficerShifts = lazy(() => import("./pages/admin/OfficerShifts"));
const EmpireApplicationsPage = lazy(() => import("./pages/admin/EmpireApplicationsPage"));
const ReferralBonuses = lazy(() => import("./pages/admin/ReferralBonuses"));
const ControlPanel = lazy(() => import("./pages/admin/ControlPanel"));
const TestDiagnosticsPage = lazy(() => import("./pages/admin/TestDiagnosticsPage"));
const ResetMaintenance = lazy(() => import("./pages/admin/ResetMaintenance"));
const AdminHR = lazy(() => import("./pages/admin/AdminHR"));

function AppContent() {
  console.log('🚀 App component rendering...');
  const {
    user,
    profile,
    isLoading,
  } = useAuthStore();
  console.log('📊 App state:', { hasUser: !!user, hasProfile: !!profile, isLoading });

  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalLoading] = useState(false);

  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const eligibilityRefresh = useEligibilityStore((s) => s.refresh);

  // Global app context for loading and error states
  const {
    isLoading: globalLoading,
    loadingMessage,
    error,
    errorType,
    retryLastAction,
    isReconnecting,
    reconnectMessage,
  } = useGlobalApp();

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
        navigate('/officer/orientation', { replace: true });
      }
    } else if (profile?.role === 'troll_family') {
      navigate('/family', { replace: true });
    }
  }, [profile?.role, profile?.is_troll_officer, profile?.is_officer_active, location.pathname, navigate, user]);

  // 🔹 Check if user is kicked or banned and show re-entry modal
  useEffect(() => {
    if (profile && (profile.is_kicked || profile.is_banned)) {
      // Dynamic-load the kick re-entry modal for when we need to show it.
      void import('./components/KickReentryModal');
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

  // 🔹 Real-time Profile Updates (Debounced to prevent double renders)
  useDebouncedProfileUpdate(user?.id)

  // 🔹 Tab Visibility Change Handler
  useEffect(() => {
    if (!user?.id) return
 
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible, refresh data
        console.log('Tab became visible, refreshing data...')
        refreshProfile()
        eligibilityRefresh(user.id)
        // Dispatch global refetch event for all components
        window.dispatchEvent(new CustomEvent(APP_DATA_REFETCH_EVENT_NAME))
      }
    }
 
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user?.id, refreshProfile, eligibilityRefresh])

  // 🔹 Scroll to top on route change
  useEffect(() => {
    const targets = [mainRef.current, document.scrollingElement, document.body]
    targets.forEach((el) => {
      if (el && typeof (el as HTMLElement).scrollTo === "function") {
        ;(el as HTMLElement).scrollTo({ top: 0, left: 0 })
      }
    })
  }, [location.pathname])

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
      profile.role !== "admin" &&
      (!profile.terms_accepted || !profile.court_recording_consent) &&
      location.pathname !== "/terms"
    ) {
      return <Navigate to="/terms" replace />;
    }
    if (
      profile?.application_required &&
      !profile?.application_submitted &&
      location.pathname !== "/application"
    ) {
      return <Navigate to="/application" replace />;
    }
    const verificationAllowedPaths = new Set([
      "/verification",
      "/verification/complete",
      "/ai-verification",
      "/terms",
      "/support"
    ]);
    const verificationBypassRoles = new Set([
      "admin",
      "hr_admin",
      "lead_troll_officer",
      "troll_officer"
    ]);
    if (
      profile &&
      !profile.is_verified &&
      !verificationBypassRoles.has(profile.role || "") &&
      !verificationAllowedPaths.has(location.pathname)
    ) {
      return <Navigate to="/verification" replace />;
    }
    return <Outlet />;
  };

  console.log('🎨 App returning JSX...');
  return (
    <>
      {/* Global Error Banner */}
      <GlobalErrorBanner />

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
            {user && <AdminOfficerQuickMenu />}

            <main ref={mainRef} className="flex-1 overflow-y-auto bg-transparent safe-area-bottom">
              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                {/* 🚪 Public Routes */}
                <Route path="/" element={user ? <Home /> : <LandingPage />} />
                <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/terms" element={<TermsAgreement />} />
                <Route path="/access-denied" element={<AccessDenied />} />
                <Route path="/terms-of-service" element={<TermsOfService />} />
                <Route path="/refund-policy" element={<RefundPolicy />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/payment-terms" element={<PaymentTerms />} />
                <Route path="/creator-agreement" element={<CreatorAgreement />} />
                <Route path="/tax-onboarding" element={<TaxOnboarding />} />
                <Route path="/verification" element={<VerificationPage />} />
                <Route path="/verification/complete" element={<VerificationComplete />} />
                <Route path="/ai-verification" element={<AIVerificationPage />} />
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
                  <Route path="/marketplace" element={<Marketplace />} />
                  <Route path="/shop/:id" element={<ShopView />} />
                  <Route path="/inventory" element={<UserInventory />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/wall" element={<TrollCityWall />} />
                  <Route path="/reels" element={<ReelFeed />} />
                  <Route path="/profile/id/:userId" element={<Profile />} />
                  <Route path="/profile/:username" element={<Profile />} />
                  <Route path="/trollstown" element={<TrollsTownPage />} />

                  {/* 🎥 Streaming */}
                  <Route path="/go-live" element={<GoLiveSetup />} />
                  <Route path="/tromody" element={<TromodyShow />} />
                  <Route path="/live/:streamId" element={<LiveStreamPage />} />
                  <Route path="/interview/:sessionId" element={<InterviewRoom />} />
                  <Route path="/stream/:id" element={<Stream />} />
                  <Route path="/stream/:streamId" element={<LiveStreamPage />} />
                  <Route path="/stream/:id/summary" element={<StreamSummary />} />
                  <Route path="/stream-ended" element={<StreamEnded />} />

                  {/* ⚖️ Court */}
                  <Route path="/troll-court" element={<TrollCourt />} />
                  <Route path="/court/:courtId" element={<CourtRoom />} />
                   
                  {/* 🎮 Multi-Box Streaming */}
                  <Route path="/command-battle-go-live" element={<CommandBattleGoLive />} />
                  <Route path="/troll-battle-setup" element={<TrollBattleSetup />} />
                   
                  {/* 👥 Empire Partner Program */}
                  <Route path="/empire-partner" element={<EmpirePartnerDashboard />} />
                  <Route path="/empire-partner/apply" element={<EmpirePartnerApply />} />


                  {/* 💳 Payment Methods */}
                  <Route path="/add-card" element={<AddCard />} />
                   
                  {/* 📝 Creator Onboarding */}
                  <Route path="/onboarding/creator" element={<CreatorOnboarding />} />

                  {/* 💰 Earnings & Coins */}
                  <Route path="/store" element={<CoinStore />} />
                  <Route path="/coins" element={<CoinStore />} />
                  <Route path="/gift-store" element={<GiftStorePage />} />
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
                  <Route path="/gift-inventory" element={<GiftInventoryPage />} />

                  {/* 👨‍👩‍👧 Family */}
                  <Route path="/family" element={<TrollFamily />} />
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
                  <Route path="/application" element={<ApplicationPage />} />
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
                    path="/officer/stream"
                    element={
                      <RequireRole
                        roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER, UserRole.LEAD_TROLL_OFFICER]}
                        requireActive={true}
                      >
                        <OfficerLoungeStream />
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
                      path="/admin/database-backup"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <DatabaseBackup />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/cache-clear"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <CacheClear />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/system-config"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <SystemConfig />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/ban-management"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <BanManagement />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/role-management"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <RoleManagement />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/media-library"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <MediaLibrary />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/chat-moderation"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ChatModeration />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/announcements"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <Announcements />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/export-data"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ExportData />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/user-search"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <UserSearch />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/reports-queue"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ReportsQueue />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/stream-monitor"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <StreamMonitorPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/grant-coins"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <GrantCoins />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/payment-logs"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <PaymentLogs />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/finance"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminFinanceDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/create-schedule"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <CreateSchedule />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/officer-shifts"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <OfficerShifts />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/empire-applications"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <EmpireApplicationsPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/referral-bonuses"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ReferralBonuses />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/control-panel"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ControlPanel />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/test-diagnostics"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <TestDiagnosticsPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/reset-maintenance"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ResetMaintenance />
                        </RequireRole>
                      }
                    />
                  <Route
                    path="/admin/hr"
                    element={
                      <RequireRole roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER, UserRole.HR_ADMIN]}>
                        <AdminHR />
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
  </>)
}

function App() {
  return <AppContent />;
}

export default App;
