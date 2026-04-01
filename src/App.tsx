
// src/App.tsx
import React, { useEffect, Suspense, useState, useRef } from "react";
import TrollProvider from "./troll/TrollProvider";
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "./lib/store";

import { useEligibilityStore } from "./lib/eligibilityStore";
import { useJailMode } from "./hooks/useJailMode";
import { supabase, UserRole, reportError } from "./lib/supabase";
import { Toaster, toast } from "sonner";
import GlobalLoadingOverlay from "./components/GlobalLoadingOverlay";
import GlobalErrorBanner from "./components/GlobalErrorBanner";
import GlobalGiftBanner from "./components/GlobalGiftBanner";
import GlobalPayoutBanner from "./components/GlobalPayoutBanner";
import BroadcastAnnouncement from "./components/BroadcastAnnouncement";
import GlobalPodBanner from "./components/GlobalPodBanner";
import BugAlertPopup from "./components/BugAlertPopup";
import { useBugAlertStore } from "./stores/useBugAlertStore";
import DailyChurchNotification from "./components/church/DailyChurchNotification";
import GlobalEventsBanner from "./components/GlobalEventsBanner";
import { useGlobalApp } from "./contexts/GlobalAppContext";
import { updateRoute } from "./utils/sessionStorage";
import { useDebouncedProfileUpdate } from "./hooks/useDebouncedProfileUpdate";
import { initTimeUpdater } from "./hooks/useGlobalTime";
import { APP_DATA_REFETCH_EVENT_NAME } from "./lib/appEvents";
import { autoUnlockPayouts } from "./lib/supabase";
import { initTelemetry } from "./lib/telemetry";
import GlobalPresenceTracker from "./components/GlobalPresenceTracker";
import { useIsMobile } from "./hooks/useIsMobile";

// Animation components
import { AnimationsContainer } from "./components/animations";

// Layout
import OfficerAlertBanner from "./components/OfficerAlertBanner";
import AdminOfficerQuickMenu from "./components/AdminOfficerQuickMenu";
import { RTCAdminMonitor } from "./components/admin";


import AdminErrors from "./pages/admin/AdminErrors";
import ProfileSetupModal from "./components/ProfileSetupModal";
import RequireRole from "./components/RequireRole";
import { RequireLeadOrOwner } from "./components/auth/RequireLeadOrOwner";
import ErrorBoundary from "./components/ErrorBoundary";

import AppLayout from "./components/layout/AppLayout";


import { lazyWithRetry } from "./utils/lazyImport";

// Static pages (fast load)
import LandingHome from "./pages/Home";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import SessionMonitor from "./components/auth/SessionMonitor";
import TermsAgreement from "./pages/TermsAgreement";
import ExitPage from "./pages/ExitPage";

import TrollBank from "./pages/TrollBank";
import CityHall from "./pages/CityHall";
import CityRegistry from "./pages/CityRegistry";
const SetupPage = lazyWithRetry(() => import("./pages/broadcast/SetupPage"));
const BroadcastPage = lazyWithRetry(() => import("./pages/broadcast/BroadcastPage"));
const BroadcastRouter = lazyWithRetry(() => import("./pages/broadcast/BroadcastRouter"));
const StreamSummary = lazyWithRetry(() => import("./pages/broadcast/StreamSummary"));
const BattlePreview = lazyWithRetry(() => import("./pages/dev/BattlePreview"));
const FrontendLimitsTest = lazyWithRetry(() => import("./pages/dev/FrontendLimitsTest"));
const TrollopolyCityDevTest = lazyWithRetry(() => import("./pages/dev/TrollopolyCityDevTest"));
const LivingPage = lazyWithRetry(() => import("./pages/LivingPage"));
const ChurchPage = lazyWithRetry(() => import("./pages/ChurchPage"));
const PastorDashboard = lazyWithRetry(() => import("./pages/church/PastorDashboard"));
const BadgeDesignShowcase = lazyWithRetry(() => import("./pages/dev/BadgeDesignShowcase"));
const HomepageBackgroundShowcase = lazyWithRetry(() => import("./pages/dev/HomepageBackgroundShowcase"));
const GiftAnimationShowcase = lazyWithRetry(() => import("./pages/dev/GiftAnimationShowcase"));
const XPSimulatorPage = lazyWithRetry(() => import("./pages/dev/XPSimulatorPage"));
const StreamControlPreview = lazyWithRetry(() => import("./pages/dev/StreamControlPreview"));
const BroadcastLayoutPreview = lazyWithRetry(() => import("./pages/dev/BroadcastLayoutPreview"));
const SetupPreview = lazyWithRetry(() => import("./pages/dev/SetupPreview"));
const BadgePopup = lazyWithRetry(() => import("./components/BadgePopup"));

// Live Streaming System
const LiveCommandCenter = lazyWithRetry(() => import("./pages/live/LiveCommandCenter"));
const LiveStreamOverlay = lazyWithRetry(() => import("./pages/live/LiveStreamOverlay"));
const AudioSettings = lazyWithRetry(() => import("./pages/live/AudioSettings"));

// Sidebar pages (instant load)
const TCPS = lazyWithRetry(() => import("./pages/TCPS"));
const MatchPage = lazyWithRetry(() => import("./pages/MatchPage"));
const TMFamilyInviteHandler = lazyWithRetry(() => import("./components/trollmatch/TMFamilyInviteHandler"));
const TrollPodsListing = lazyWithRetry(() => import("./pages/pods/TrollPodsListing"));
const TrollPodRoom = lazyWithRetry(() => import("./pages/pods/TrollPodRoom"));
const PodSummary = lazyWithRetry(() => import("./pages/pods/PodSummary"));

// Lazy-loaded pages
const Following = lazyWithRetry(() => import("./pages/Following"));
const ExploreFeed = lazyWithRetry(() => import("./pages/ExploreFeed"));
const StreamSwipePage = lazyWithRetry(() => import("./pages/StreamSwipePage"));
const CoinStore = lazyWithRetry(() => import("./pages/CoinStore"));
const Marketplace = lazyWithRetry(() => import("./pages/Marketplace"));
const PublicPool = lazyWithRetry(() => import("./pages/PublicPool"));
const TrollGamesPage = lazyWithRetry(() => import("./pages/TrollGamesPage"));
const TrollWheel = lazyWithRetry(() => import("./pages/TrollWheel"));
const GiveawaysPage = lazyWithRetry(() => import("./pages/GiveawaysPage"));
const UserInventory = lazyWithRetry(() => import("./pages/UserInventory"));
const Troting = lazyWithRetry(() => import("./pages/Troting"));
const ProfileSettings = lazyWithRetry(() => import("./pages/ProfileSettings"));
const SellOnTrollCity = lazyWithRetry(() => import("./pages/SellOnTrollCity"));
const SellerOrders = lazyWithRetry(() => import("./pages/SellerOrders"));
const MyOrders = lazyWithRetry(() => import("./pages/MyOrders"));
const Leaderboard = lazyWithRetry(() => import("./pages/Leaderboard"));
const TrollCityWall = lazyWithRetry(() => import("./pages/TrollCityWall"));
const WallPostPage = lazyWithRetry(() => import("./pages/WallPostPage"));
const TrollCourt = lazyWithRetry(() => import("./pages/TrollCourt"));
const PresidentPage = lazyWithRetry(() => import("./pages/President"));
const PresidentDashboard = lazyWithRetry(() => import("./pages/president/PresidentDashboard"));
const SecretaryDashboard = lazyWithRetry(() => import("./pages/president/SecretaryDashboard"));

// Gift store pages removed
const Application = lazyWithRetry(() => import("./pages/Application"));
const ApplicationPage = lazyWithRetry(() => import("./pages/ApplicationPage"));
const TrollsTownPage = lazyWithRetry(() => import("./pages/TrollsTownPage"));
const DistrictTour = lazyWithRetry(() => import("./pages/DistrictTour"));
const TrollOfficerLounge = lazyWithRetry(() => import("./pages/TrollOfficerLounge"));
const FoundingOfficerTrial = lazyWithRetry(() => import("./pages/FoundingOfficerTrial"));
const OfficerModeration = lazyWithRetry(() => import("./pages/OfficerModeration"));
const TrollFamily = lazyWithRetry(() => import("./pages/TrollFamily"));
const TrollFamilyHome = lazyWithRetry(() => import("./pages/TrollFamilyHome"));
const FamilyWarsHub = lazyWithRetry(() => import("./pages/FamilyWarsHub.jsx"));
const FamilyLeaderboard = lazyWithRetry(() => import("./pages/FamilyLeaderboard.jsx"));
const FamilyShop = lazyWithRetry(() => import("./pages/FamilyShop.jsx"));
const FamilyBrowse = lazyWithRetry(() => import("./pages/FamilyBrowse"));
const Support = lazyWithRetry(() => import("./pages/Support"));
const JailPage = lazyWithRetry(() => import("./pages/JailPage"));
const Safety = lazyWithRetry(() => import("./pages/Safety"));
const AdminRFC = lazyWithRetry(() => import("./components/AdminRFC"));
const AdminEarningsDashboard = lazyWithRetry(() => import("./pages/admin/AdminEarningsDashboard"));
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/AdminDashboard"));
const ApplicationsPage = lazyWithRetry(() => import("./pages/admin/Applications"));
const AdminMarketplace = lazyWithRetry(() => import("./pages/admin/AdminMarketplace"));
const AdminOfficerReports = lazyWithRetry(() => import("./pages/admin/AdminOfficerReports"));
const StoreDebug = lazyWithRetry(() => import("./pages/admin/StoreDebug"));
const Changelog = lazyWithRetry(() => import("./pages/Changelog"));
const AccessDenied = lazyWithRetry(() => import("./pages/AccessDenied"));
const ReferralBonusPanel = lazyWithRetry(() => import("./pages/admin/ReferralBonusPanel"));
const SecretaryConsole = lazyWithRetry(() => import("./pages/secretary/SecretaryConsole"));
const AppealManagement = lazyWithRetry(() => import("./pages/admin/AppealManagement"));
import { systemManagementRoutes } from "./pages/admin/adminRoutes";

const TaxOnboarding = lazyWithRetry(() => import("./pages/TaxOnboarding"));
const MyEarnings = lazyWithRetry(() => import("./pages/MyEarnings"));
const EarningsPage = lazyWithRetry(() => import("./pages/EarningsPage"));
const VerificationPage = lazyWithRetry(() => import("./pages/VerificationPage"));
const VerificationComplete = lazyWithRetry(() => import("./pages/VerificationComplete"));
const PayoutStatus = lazyWithRetry(() => import("./pages/PayoutStatus"));
const AdminLaunchTrial = lazyWithRetry(() => import("./pages/admin/LaunchTrial"));


const JoinPage = lazyWithRetry(() => import("./pages/Join"));
const KickFeePage = lazyWithRetry(() => import("./pages/broadcast/KickFeePage"));
const KickFee = lazyWithRetry(() => import("./pages/KickFee"));
const BanFee = lazyWithRetry(() => import("./pages/BanFee"));
const TrollCourtSession = lazyWithRetry(() => import("./pages/TrollCourtSession"));

const Call = lazyWithRetry(() => import("./pages/Call"));
const Notifications = lazyWithRetry(() => import("./pages/Notifications"));
const Trollifications = lazyWithRetry(() => import("./pages/Trollifications"));
const Trollifieds = lazyWithRetry(() => import("./pages/Trollifieds"));
const OfficerScheduling = lazyWithRetry(() => import("./pages/OfficerScheduling"));
const InterviewRoom = lazyWithRetry(() => import("./pages/InterviewRoom"));
const OfficerPayrollDashboard = lazyWithRetry(() => import("./pages/officer/OfficerPayrollDashboard"));
const OfficerDashboard = lazyWithRetry(() => import("./pages/officer/OfficerDashboard"));
const OfficerOWCDashboard = lazyWithRetry(() => import("./pages/OfficerOWCDashboard"));
const OfficerVote = lazyWithRetry(() => import("./pages/OfficerVote"));
const GovernmentPage = lazyWithRetry(() => import("./pages/Government"));
const GovernmentStreams = lazyWithRetry(() => import("./pages/government/GovernmentStreams"));
const ReportDetailsPage = lazyWithRetry(() => import("./pages/ReportDetailsPage"));
const TrollFamilyCity = lazyWithRetry(() => import("./pages/TrollFamilyCity"));
const FamilyProfilePage = lazyWithRetry(() => import("./pages/FamilyProfilePage"));
const FamilyWarsPage = lazyWithRetry(() => import("./pages/FamilyWarsPage"));
const FamilyChatPage = lazyWithRetry(() => import("./pages/TrollFamilyChat"));
const TransactionHistory = lazyWithRetry(() => import("./pages/TransactionHistory"));
const CashoutPage = lazyWithRetry(() => import("./pages/CashoutPage"));
const FamilyApplication = lazyWithRetry(() => import("./pages/FamilyApplication"));
const OfficerApplication = lazyWithRetry(() => import("./pages/OfficerApplication"));
const TrollerApplication = lazyWithRetry(() => import("./pages/TrollerApplication"));
const Career = lazyWithRetry(() => import("./pages/Career"));
const LeadOfficerApplication = lazyWithRetry(() => import("./pages/LeadOfficerApplication"));
const PastorApplication = lazyWithRetry(() => import("./pages/PastorApplication"));
const ShopEarnings = lazyWithRetry(() => import("./pages/ShopEarnings"));
const AdminPayoutMobile = lazyWithRetry(() => import("./pages/admin/AdminPayoutMobile"));
const MobileAdminDashboard = lazyWithRetry(() => import("./pages/admin/MobileAdminDashboard"));
const PaymentsDashboard = lazyWithRetry(() => import("./pages/admin/PaymentsDashboard"));
const EconomyDashboard = lazyWithRetry(() => import("./pages/admin/EconomyDashboard"));
const TaxUpload = lazyWithRetry(() => import("./pages/TaxUpload"));
const TaxReviewPanel = lazyWithRetry(() => import("./pages/admin/TaxReviewPanel"));
const PaymentCallback = lazyWithRetry(() => import("./pages/PaymentCallback"));
const CoinsComplete = lazyWithRetry(() => import("./pages/CoinsComplete"));
const PayoutSetupPage = lazyWithRetry(() => import("./pages/PayoutSetupPage"));
const Withdraw = lazyWithRetry(() => import("./pages/Withdraw"));

const Profile = lazyWithRetry(() => import("./pages/Profile"));
const ProfileSetup = lazyWithRetry(() => import("./pages/ProfileSetup"));
const BadgesPage = lazyWithRetry(() => import("./pages/BadgesPage"));
const Stats = lazyWithRetry(() => import("./pages/Stats"));
const EmpirePartnerDashboard = lazyWithRetry(() => import("./pages/EmpirePartnerDashboard"));

const EarningsDashboard = lazyWithRetry(() => import("./pages/EarningsDashboard"));
const CreatorOnboarding = lazyWithRetry(() => import("./pages/CreatorOnboarding"));
const CreatorSwitchProgram = lazyWithRetry(() => import("./pages/CreatorSwitchProgram"));
const PolicyCenter = lazyWithRetry(() => import("./pages/PolicyCenter"));
const TermsOfServiceLegal = lazyWithRetry(() => import("./pages/legal/TermsOfService"));
const PrivacyPolicyLegal = lazyWithRetry(() => import("./pages/legal/PrivacyPolicy"));
const RefundPolicyLegal = lazyWithRetry(() => import("./pages/legal/RefundPolicy"));
const PayoutPolicyLegal = lazyWithRetry(() => import("./pages/legal/PayoutPolicy"));
const SafetyGuidelinesLegal = lazyWithRetry(() => import("./pages/legal/SafetyGuidelines"));
const CreatorEarnings = lazyWithRetry(() => import("./pages/legal/CreatorEarnings"));
const GamblingDisclosure = lazyWithRetry(() => import("./pages/legal/GamblingDisclosure"));
const PartnerProgram = lazyWithRetry(() => import("./pages/legal/PartnerProgram"));
const Wallet = lazyWithRetry(() => import("./pages/Wallet"));
const PayoutRequest = lazyWithRetry(() => import("./pages/PayoutRequest"));
const AdminPayoutDashboard = lazyWithRetry(() => import("./pages/admin/components/AdminPayoutDashboard"));
const AdminLiveOfficersTracker = lazyWithRetry(() => import("./pages/admin/AdminLiveOfficersTracker"));
const AdminVerifiedUsers = lazyWithRetry(() => import("./pages/admin/AdminVerifiedUsers"));
const AdminVerificationReview = lazyWithRetry(() => import("./pages/admin/AdminVerificationReview"));
const AdminPoliciesDocs = lazyWithRetry(() => import("./pages/admin/AdminPoliciesDocs"));
const ExecutiveSecretaries = lazyWithRetry(() => import("./pages/admin/ExecutiveSecretaries"));
const GiftCardsManager = lazyWithRetry(() => import("./pages/admin/GiftCardsManager"));
const ExecutiveIntake = lazyWithRetry(() => import("./pages/admin/ExecutiveIntake"));
const ExecutiveReports = lazyWithRetry(() => import("./pages/admin/ExecutiveReports"));
const AdminManualOrders = lazyWithRetry(() => import("./pages/admin/AdminManualOrders"));
const CashoutManager = lazyWithRetry(() => import("./pages/admin/CashoutManager"));
const TrollmersTournament = lazyWithRetry(() => import("./pages/admin/TrollmersTournament"));
const CriticalAlertsManager = lazyWithRetry(() => import("./pages/admin/CriticalAlertsManager"));
const OfficerManager = lazyWithRetry(() => import("./pages/admin/OfficerManager"));
const AdminTrollTownDeeds = lazyWithRetry(() => import("./pages/admin/AdminTrollTownDeeds"));
const LeadOfficerDashboard = lazyWithRetry(() => import("./pages/lead-officer/LeadOfficerDashboard"));
const ShopPartnerPage = lazyWithRetry(() => import("./pages/ShopPartnerPage"));
const UniverseEventPage = lazyWithRetry(() => import("./pages/UniverseEventPage"));
const NeighborsPage = lazyWithRetry(() => import("./pages/Neighbors"));

// TCNN - Troll City News Network
const TCNNMainPage = lazyWithRetry(() => import("./pages/tcnn/TCNNMainPage"));
const TCNNInternalDashboard = lazyWithRetry(() => import("./pages/tcnn/TCNNInternalDashboard"));
const ArticleReader = lazyWithRetry(() => import("./pages/tcnn/ArticleReader"));
const TCNNBroadcasterPage = lazyWithRetry(() => import("./pages/tcnn/TCNNBroadcasterPage"));
const TCNNViewerPage = lazyWithRetry(() => import("./pages/tcnn/TCNNViewerPage"));

// Troll City Deck - Broadcast Control Companion
const DeckAuth = lazyWithRetry(() => import("./pages/deck/DeckAuth"));
const DeckDashboard = lazyWithRetry(() => import("./pages/deck/DeckDashboard"));

const ShopView = lazyWithRetry(() => import("./pages/ShopView"));
const CourtRoom = lazyWithRetry(() => import("./pages/CourtRoom"));
const InterviewRoomPage = lazyWithRetry(() => import("./pages/InterviewRoomPage"));
const AdminInterviewDashboard = lazyWithRetry(() => import("./pages/AdminInterviewDashboard"));
const PasswordReset = lazyWithRetry(() => import("./pages/PasswordReset"));
const CreditScorePage = lazyWithRetry(() => import("./pages/CreditScorePage"));


// Admin pages
const BanManagement = lazyWithRetry(() => import("./pages/admin/BanManagement"));
const RoleManagement = lazyWithRetry(() => import("./pages/admin/RoleManagement"));
const MediaLibrary = lazyWithRetry(() => import("./pages/admin/MediaLibrary"));
const ChatModeration = lazyWithRetry(() => import("./pages/admin/ChatModeration"));
const Announcements = lazyWithRetry(() => import("./pages/admin/Announcements"));
const SendNotifications = lazyWithRetry(() => import("./pages/admin/SendNotifications"));
const ExportData = lazyWithRetry(() => import("./pages/admin/ExportData"));
const UserSearch = lazyWithRetry(() => import("./pages/admin/UserSearch"));
const ReportsQueue = lazyWithRetry(() => import("./pages/admin/ReportsQueue"));
const StreamMonitorPage = lazyWithRetry(() => import("./pages/admin/StreamMonitorPage"));
const TrotingAdminPage = lazyWithRetry(() => import("./pages/admin/TrotingAdminPage"));
const PaymentLogs = lazyWithRetry(() => import("./pages/admin/PaymentLogs"));
const StorePriceEditor = lazyWithRetry(() => import("./pages/admin/components/StorePriceEditor"));
const AdminFinanceDashboard = lazyWithRetry(() => import("./pages/admin/AdminFinanceDashboard"));
const CreateSchedule = lazyWithRetry(() => import("./pages/admin/CreateSchedule"));
const OfficerShifts = lazyWithRetry(() => import("./pages/admin/OfficerShifts"));


const ReferralBonuses = lazyWithRetry(() => import("./pages/admin/ReferralBonuses"));
const ControlPanel = lazyWithRetry(() => import("./pages/admin/ControlPanel"));
const TestDiagnosticsPage = lazyWithRetry(() => import("./pages/admin/TestDiagnosticsPage"));
const ResetMaintenance = lazyWithRetry(() => import("./pages/admin/ResetMaintenance"));
const AdminHR = lazyWithRetry(() => import("./pages/admin/AdminHR"));
const UserFormsTab = lazyWithRetry(() => import("./pages/admin/components/UserFormsTab"));
const BucketsDashboard = lazyWithRetry(() => import("./pages/admin/BucketsDashboard"));
const GrantCoins = lazyWithRetry(() => import("./pages/admin/GrantCoins"));
const OfficerOperations = lazyWithRetry(() => import("./pages/admin/OfficerOperations"));
const CreatorSwitchApprovals = lazyWithRetry(() => import("./pages/admin/components/CreatorSwitchApprovals"));

const LoadingScreen = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0814] text-white">
      <div className="animate-pulse px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">
        Loading…
      </div>
    </div>
  );

  // 🔐 Route Guard
    const RequireAuth = () => {
    const user = useAuthStore((s) => s.user);
    const profile = useAuthStore((s) => s.profile);
    const isLoading = useAuthStore((s) => s.isLoading);
    const isRefreshing = useAuthStore((s) => s.isRefreshing);
    const { isJailed } = useJailMode(user?.id);
    const location = useLocation();
    
    

    if (isLoading || isRefreshing) return <LoadingScreen />;
    if (!user) return <Navigate to="/auth" replace />;

    // 🚔 Jail Guard
    if (isJailed && location.pathname !== "/jail") {
      return <Navigate to="/jail" replace />;
    }
    
    // If we have a user but no profile, and we are not loading, it means the profile row is missing.
    // We must redirect to setup to create one.
    if (!profile && location.pathname !== "/profile/setup") {
      if (isLoading) return <LoadingScreen />;
      return <Navigate to="/profile/setup" replace />;
    }
    
    if (
      profile &&
      !profile.username &&
      location.pathname !== "/profile/setup" &&
      location.pathname !== "/auth" &&
      location.pathname !== "/callback"
    ) {
      return <Navigate to="/profile/setup" replace />;
    }
    
    if (
      profile &&
      profile.role !== "admin" &&
      (!profile.terms_accepted || !profile.court_recording_consent) &&
      location.pathname !== "/terms"
    ) {
      return <Navigate to="/terms" replace />;
    }
    if (
      profile && // Add this check
      profile?.application_required &&
      !profile?.application_submitted &&
      location.pathname !== "/application"
    ) {
      return <Navigate to="/application" replace />;
    }
    return (
      <>
        
        <Outlet />
      </>
    );
  };

import AdminPoolTab from './pages/admin/components/AdminPoolTab'

import { useSidebarStore } from './stores/useSidebarStore';

function AppContent() {
  // Lightweight render counter (dev only)
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    const w = window as any;
    w.__tc_app_renders = (w.__tc_app_renders || 0) + 1;
    if (w.__tc_app_renders % 50 === 0) {
      console.debug('[App] render count', w.__tc_app_renders);
    }
  }

  // Use granular selectors to prevent unnecessary re-renders
  // Only re-render when these specific values change
  const userId = useAuthStore((s) => s.user?.id);
  const user = useAuthStore((s) => s.user); // Keep full user object for components that need it
  const userRole = useAuthStore((s) => s.profile?.role);
  const isAdmin = useAuthStore((s) => s.profile?.is_admin);
  const isLeadOfficer = useAuthStore((s) => s.profile?.is_lead_officer);
  const isTrollOfficer = useAuthStore((s) => s.profile?.is_troll_officer);
  const isPastor = useAuthStore((s) => s.profile?.is_pastor);
  const isJailed = useAuthStore((s) => s.profile?.is_jailed);
  const isBanned = useAuthStore((s) => s.profile?.is_banned);
  const isKicked = useAuthStore((s) => s.profile?.is_kicked);
  const hasActiveWarrant = useAuthStore((s) => s.profile?.has_active_warrant);
  const username = useAuthStore((s) => s.profile?.username);
  const profileRole = useAuthStore((s) => s.profile?.role);

  // Some legacy logic needs the full profile object in several effects
  const profile = useAuthStore((s) => s.profile);

  const { expandGroup } = useSidebarStore();


  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalLoading] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const { isMobile, isMobileWidth } = useIsMobile();
  const isMobileUI = isMobileWidth || isStandalone;
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingServiceWorker, setWaitingServiceWorker] = useState<ServiceWorker | null>(null);
  const [initialProfileLoaded, setInitialProfileLoaded] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const hasNavigatedRef = useRef(false);


  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const eligibilityRefresh = useEligibilityStore((s) => s.refresh);

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOffline = () => {
      toast.error('You are offline', { duration: 4000 })
    }

    const handleOnline = () => {
      toast.success('Back online', { duration: 2500 })
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  // Global app context for loading and error states
  const {
    isLoading: globalLoading,
    loadingMessage,
    error,
    retryLastAction,
    isReconnecting,
    reconnectMessage,
  } = useGlobalApp();

  // Initial profile load
  useEffect(() => {
    if (userId && !initialProfileLoaded && userIdRef.current !== userId) {
      console.log(`Found user, refreshing profile ${userId}`);
      refreshProfile();
      eligibilityRefresh(userId);
      setInitialProfileLoaded(true);
      userIdRef.current = userId;
    }
  }, [userId, initialProfileLoaded, refreshProfile, eligibilityRefresh]);

  // Handle Service Worker navigation requests (e.g. from push notifications)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE' && event.data.url) {
        console.log('[App] Received NAVIGATE from SW:', event.data.url);
        navigate(event.data.url);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [navigate]);

  // Global unhandled rejection handler for AuthApiError
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Check if the error is related to "Invalid Refresh Token" or similar auth errors
      const reason = event.reason;
      const message = reason?.message || reason?.error_description || '';
      
      if (
        message.includes('Invalid Refresh Token') ||
        message.includes('Refresh Token Not Found')
      ) {
        console.warn('Caught invalid refresh token error, attempting recovery...');
        event.preventDefault(); // Prevent default console error
        
        // Don't immediately logout - attempt session recovery first
        // The background refresh hook will handle logout if recovery truly fails
        supabase.auth.getSession().then(({ data }) => {
          if (!data.session?.access_token) {
            // Try refreshing once before giving up
            supabase.auth.refreshSession().then(({ data: refreshData }) => {
              if (!refreshData.session?.access_token) {
                console.warn('Session recovery failed, signing out...')
                useAuthStore.getState().logout()
                window.location.href = '/auth'
              }
            }).catch(() => {
              useAuthStore.getState().logout()
              window.location.href = '/auth'
            })
          }
        })
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Bug Alert real-time subscription for admins
  useEffect(() => {
    const { subscribeToRealtime, unsubscribeFromRealtime, fetchAlerts } = useBugAlertStore.getState();
    
    // Only set up subscription if user is admin
    if (userId && userRole === 'admin') {
      console.log('[BugAlert] Admin detected, setting up real-time subscription');
      
      // Subscribe to real-time bug alerts
      subscribeToRealtime(userId, true);
      
      // Fetch initial alerts
      fetchAlerts({ status: 'active' });
    }
    
    // Cleanup on unmount
    return () => {
      unsubscribeFromRealtime();
    };
  }, [userId, userRole]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      ((window.navigator as any).standalone === true);
    setIsStandalone(standalone);
  }, []);

  // Warrant Access Restriction
  useEffect(() => {
    if (!hasNavigatedRef.current && profile?.has_active_warrant) {
       // Allow access to court pages, auth pages, and static assets
       const allowedPaths = ['/troll-court', '/court', '/auth', '/legal', '/support'];
       const isAllowed = allowedPaths.some(path => location.pathname.startsWith(path));
       
       if (!isAllowed) {
         hasNavigatedRef.current = true;
         toast.error("Active Warrant Issued! You must appear in Troll Court.");
         navigate('/troll-court');
       }
    }
  }, [profile?.has_active_warrant, location.pathname, navigate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const handleUpdateAvailable = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const waiting = registration?.waiting;
        if (waiting) {
          setWaitingServiceWorker(waiting);
          setUpdateAvailable(true);
        }
      } catch {}
    };

    window.addEventListener('pwa-update-available', handleUpdateAvailable);

    return () => {
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
    };
  }, []);

  // Show update toast when update is available
  useEffect(() => {
    if (!updateAvailable || !waitingServiceWorker) return;

    // Don't auto-reload - let user click the toast action to update
    // This prevents infinite reload loops in PWA mode
    if (isStandalone) {
      toast.info("New update available!", {
        duration: Infinity,
        description: "A new version of Troll City is available.",
        action: {
          label: "Update Now",
          onClick: () => {
            waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
            setTimeout(() => {
              window.location.reload();
            }, 500);
          }
        },
        onDismiss: () => {}
      });
      return;
    }

    toast.info("New update available!", {
      duration: Infinity,
      description: "A new version of Troll City is available.",
      action: {
        label: "Update Now",
        onClick: () => {
          waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      },
      onDismiss: () => {}
    });
  }, [updateAvailable, waitingServiceWorker, isStandalone]);

  useEffect(() => {
    if (hasNavigatedRef.current) return;
    if (!userId || !isStandalone) return;
    // Mobile UI is now activated automatically for PWA standalone.
  }, [userId, isStandalone, location.pathname, navigate]);

  // Track route changes for session persistence
  useEffect(() => {
    updateRoute(location.pathname);
  }, [location.pathname]);

  // Check payouts unlock on mount
  useEffect(() => {
    void autoUnlockPayouts();
  }, []);

  // 🔹 Auto-routing after approval (only on home page, not on every route change)
  useEffect(() => {
    // Only auto-route from home page (/) - never redirect from other pages
    if (hasNavigatedRef.current) return;
    if (location.pathname !== '/') {
      return;
    }

    // Don't redirect if user is not logged in
    if (!userId || !profile) {
      return;
    }

    hasNavigatedRef.current = true;

    // Redirect to family if troll_family role
    if (profileRole === 'troll_family') {
      navigate('/family', { replace: true });
    }
  }, [profile, location.pathname, navigate, userId, profileRole]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      // Ignore if user is typing in an input/textarea/contentEditable
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // 'd' -> District Tour
      if (event.key === 'd' || event.key === 'D') {
        navigate('/district/main_plaza', { replace: true })
        return
      }

      // 'a' -> Admin Dashboard
      if ((event.key === 'a' || event.key === 'A') && (profile?.role === 'admin' || profile?.is_admin)) {
        navigate('/admin', { replace: true })
        return
      }

      // 't' -> Troll Officer / Lead Officer Dashboard
      if (event.key === 't' || event.key === 'T') {
        if (profile?.is_lead_officer) {
          navigate('/lead-officer', { replace: true })
          return
        }
        if (profile?.is_troll_officer) {
          navigate('/officer/dashboard', { replace: true })
          return
        }
      }

      // 's' -> Secretary Dashboard
      if ((event.key === 's' || event.key === 'S') && profile?.role === 'secretary') {
        navigate('/secretary', { replace: true })
        return
      }

      // 'p' -> Pastor Dashboard
      if ((event.key === 'p' || event.key === 'P') && profile?.is_pastor) {
        navigate('/church/pastor', { replace: true })
        return
      }

      // 'v' -> Toggle Voice Notifications (Admin Only)
      if ((event.key === 'v' || event.key === 'V') && (profile?.role === 'admin' || profile?.is_admin)) {
        const currentState = localStorage.getItem('voiceNotificationsEnabled') === 'true';
        const newState = !currentState;
        localStorage.setItem('voiceNotificationsEnabled', String(newState));
        
        // Dispatch event for hook to listen
        const event_toggle = new CustomEvent('toggleVoiceNotifications', {
          detail: { enabled: newState }
        });
        window.dispatchEvent(event_toggle);
        
        // Show feedback
        toast[newState ? 'success' : 'info'](
          newState ? '🔊 Voice Notifications: ACTIVE' : '🔇 Voice Notifications: INACTIVE'
        );
        return
      }

      // General navigation shortcuts
      if (event.key === 'c' || event.key === 'C') {
        navigate('/city-hall');
        expandGroup('City Center');
        return;
      }
      if (event.key === 'p' || event.key === 'P') {
        navigate('/pool');
        expandGroup('Social');
        return;
      }
      if (event.key === 's' || event.key === 'S') {
        navigate('/marketplace');
        expandGroup('City Center');
        return;
      }
      if (event.key === 'g' || event.key === 'G') {
        navigate('/government');
        expandGroup('Government Sector');
        return;
      }
      if (event.key === 'r' || event.key === 'R') {
        navigate('/city-registry');
        expandGroup('City Registry');
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [navigate, profile, expandGroup])

  // 🔹 Check if user is kicked or banned and route to fee pages
  useEffect(() => {
    if (!profile) return;

    if (profile.is_banned && location.pathname !== '/ban-fee') {
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        navigate('/ban-fee', { replace: true });
      }
      return;
    }

    if (profile.is_kicked && location.pathname !== '/kick-fee') {
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        navigate('/kick-fee', { replace: true });
      }
    }
  }, [profile, location.pathname, navigate]);

  // 🔹 Track user IP address and check for IP bans
  useEffect(() => {
    const controller = new AbortController()

    const trackIP = async () => {
      if (!userId) return

      try {
        // Get user's IP address with timeout
        const ipResponse = await fetch('https://api.ipify.org?format=json', {
            signal: controller.signal
        })
        const ipData = await ipResponse.json()
        const userIP = ipData.ip

        if (controller.signal.aborted) return

        // Check if IP is banned
        const { data: isBanned, error: banError } = await supabase.rpc('is_ip_banned', {
          p_ip_address: userIP
        })

        if (banError) {
          // Ignore abort/timeout errors from Supabase
          if (
            banError.message?.includes('AbortError') || 
            banError.details?.includes('AbortError') ||
            banError.message?.includes('timeout')
          ) {
            return
          }
          console.error('Error checking IP ban:', banError)
          return
        }

        if (isBanned) {
          if (controller.signal.aborted) return
          toast.error('Your IP address has been banned. Please contact support.')
          // Sign out user (defensive)
          try {
            const { data: sessionData } = await supabase.auth.getSession()
            const hasSession = !!sessionData?.session
            if (hasSession) {
              const { error } = await supabase.auth.signOut()
              if (error) console.warn('supabase.signOut returned error:', error)
            } else {
              console.debug('No active session; skipping supabase.auth.signOut()')
            }
          } catch (innerErr) {
            console.warn('Error during sign-out (ignored):', innerErr)
          }

          useAuthStore.getState().logout()
          navigate('/auth', { replace: true })
          return
        }

        if (controller.signal.aborted) return

        // Update user's last known IP
        const { data: currentProfile } = await supabase
          .from('user_profiles')
          .select('ip_address_history')
          .eq('id', userId)
          .maybeSingle()

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
          .eq('id', userId)
      } catch (error: any) {
        // Ignore abort errors
        if (error.name === 'AbortError' || error.message?.includes('AbortError')) return
        console.error('Error tracking IP:', error)
      }
    }

    if (userId) {
      trackIP()
    }

    return () => {
        controller.abort()
    }
  }, [userId, navigate])

  // 🔹 Check Daily Login for XP
  useEffect(() => {
    if (userId) {
      const checkLogin = async () => {
        try {
          // This function checks the date, updates streak, and awards XP if valid
          await supabase.rpc('check_daily_login');
        } catch (e) {
          console.error('Error checking daily login:', e);
        }
      };
      checkLogin();
    }
  }, [userId]);

  

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      void reportError({
        message: event.message || 'window.onerror',
        stack: event.error?.stack,
        userId: userId || null,
        url: window.location.pathname,
        component: 'global'
      })
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      
      // Handle Invalid Refresh Token error - attempt recovery before logging out
      const reasonMsg = reason?.message || String(reason)
      if (reasonMsg.includes('Invalid Refresh Token') || reasonMsg.includes('Refresh Token Not Found')) {
        console.warn('Invalid refresh token detected, attempting recovery...')
        // Attempt session recovery instead of immediate logout
        supabase.auth.refreshSession().then(({ data }) => {
          if (!data.session?.access_token) {
            console.warn('Session recovery failed, logging out...')
            useAuthStore.getState().logout()
          }
        }).catch(() => {
          useAuthStore.getState().logout()
        })
        return
      }

      void reportError({
        message: (reason?.message || String(reason) || 'unhandledrejection'),
        stack: reason?.stack,
        userId: userId || null,
        url: window.location.pathname,
        component: 'global'
      })
    }
    const originalConsoleError = console.error
    console.error = (...args: any[]) => {
      try {
        const msg = typeof args[0] === 'string' ? args[0] : (args[0]?.message || JSON.stringify(args[0]))
        void reportError({
          message: msg || 'console.error',
          userId: userId || null,
          url: window.location.pathname,
          component: 'console',
          context: { args }
        })
      } catch {}
      originalConsoleError(...args)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
      console.error = originalConsoleError
    }
  }, [userId])

  // 🔹 Tab Visibility Change Handler
  useEffect(() => {
    if (!userId) return
 
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        // BATTLE PROTECTION: Don't refresh data if user is in an active battle
        // Check current URL for battle routes
        const currentPath = window.location.pathname;
        if (currentPath.includes('/battle/')) {
          console.log('⚔️ Battle mode detected - skipping visibility refresh to prevent disruption');
          return;
        }
        
        // Also check if user has any active battles in the database
        try {
          // First get the user's stream IDs
          const { data: userStreams } = await supabase
            .from('streams')
            .select('id')
            .eq('user_id', userId);
            
          const streamIds = userStreams?.map(s => s.id) || [];
          
          if (streamIds.length > 0) {
            const { data: activeBattles } = await supabase
              .from('battles')
              .select('id, status')
              .or(`challenger_stream_id.in.(${streamIds.join(',')}),opponent_stream_id.in.(${streamIds.join(',')})`)
              .eq('status', 'active')
              .limit(1);
              
            if (activeBattles && activeBattles.length > 0) {
              console.log('⚔️ User has active battle - skipping visibility refresh');
              return;
            }
          }
        } catch (e) {
          console.error('Failed to check battle status:', e);
          // Continue with refresh if check fails
        }
        
        // Tab became visible, refresh data
        console.log('Tab became visible, refreshing data...')
        refreshProfile()
        eligibilityRefresh(userId)
        // Dispatch global refetch event for all components
        window.dispatchEvent(new CustomEvent(APP_DATA_REFETCH_EVENT_NAME))
      }
    }
 
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [userId, refreshProfile, eligibilityRefresh])

  // 🔹 Scroll to top on route change
  useEffect(() => {
    const targets = [mainRef.current, document.scrollingElement, document.body]
    targets.forEach((el) => {
      if (el && typeof (el as HTMLElement).scrollTo === "function") {
        ;(el as HTMLElement).scrollTo({ top: 0, left: 0 })
      }
    })
  }, [location.pathname])

  const handleUpdateClick = () => {
    if (!waitingServiceWorker) return;
    waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
    setUpdateAvailable(false);
  };

  const appShell = (
    <>
      <SessionMonitor />
      
      {updateAvailable && (
        <div className="fixed top-0 inset-x-0 z-[60] flex items-center justify-between bg-purple-900 text-white px-4 py-2">
          <span className="text-sm">A new version of Troll City is available.</span>
          <button
            type="button"
            onClick={handleUpdateClick}
            className="ml-4 rounded bg-purple-600 text-white text-sm font-semibold px-3 py-1 hover:bg-purple-500"
          >
            Update now
          </button>
        </div>
      )}
      {/* Global Error Banner */}
      <GlobalErrorBanner />
      
      <GlobalPayoutBanner />
      <GlobalEventsBanner />
      {/* Officer Alert Banner */}
      <OfficerAlertBanner />
      
      {/* Global Gift Banner */}
      <GlobalGiftBanner />

      {/* Animation System Container */}
      <AnimationsContainer />

      {/* Broadcast Announcement */}
      <BroadcastAnnouncement />
      <GlobalPodBanner />
      <DailyChurchNotification />

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
        isVisible={!!error && !isReconnecting}
        message={error || ''}
        type="error"
        onRetry={retryLastAction}
      />

      <AppLayout showSidebar={!isMobileUI} showHeader={!isMobileUI} showBottomNav={true}>
        <GlobalPresenceTracker />
        {user && <AdminOfficerQuickMenu />}
        <RTCAdminMonitor />
        {user && (
          <Suspense fallback={null}>
            <BadgePopup />
          </Suspense>
        )}

        <ErrorBoundary>
          <Suspense fallback={null}>
            <Routes>
                {/* 🚪 Public Routes */}
                <Route path="/" element={<LandingHome />} />
              <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/exit" element={<ExitPage />} />
                <Route path="/terms" element={<TermsAgreement />} />
                <Route path="/access-denied" element={<AccessDenied />} />
                <Route path="/terms-of-service" element={<Navigate to="/legal/terms" replace />} />
                <Route path="/privacy-policy" element={<Navigate to="/legal/privacy" replace />} />
                <Route path="/payment-terms" element={<Navigate to="/legal/refunds" replace />} />
                <Route path="/creator-agreement" element={<Navigate to="/legal/creator-earnings" replace />} />
                <Route path="/reset-password" element={<PasswordReset />} />
                <Route path="/tax-onboarding" element={<TaxOnboarding />} />
                <Route path="/verification" element={<VerificationPage />} />
                <Route path="/verification/complete" element={<VerificationComplete />} />
                <Route path="/founding-officer-trial" element={<FoundingOfficerTrial />} />

                <Route path="/account/earnings" element={<EarningsDashboard />} />
                <Route path="/payout-status" element={<PayoutStatus />} />
                 
                {/* 📜 Legal & Policy Pages (Public) */}
                <Route path="/legal" element={<PolicyCenter />} />
                <Route path="/legal/terms" element={<TermsOfServiceLegal />} />
                <Route path="/legal/privacy" element={<PrivacyPolicyLegal />} />
                <Route path="/legal/refunds" element={<RefundPolicyLegal />} />
                <Route path="/legal/refund" element={<RefundPolicyLegal />} />
                <Route path="/legal/payouts" element={<PayoutPolicyLegal />} />
                <Route path="/legal/safety" element={<SafetyGuidelinesLegal />} />
                <Route path="/legal/creator-earnings" element={<CreatorEarnings />} />
                <Route path="/legal/gambling-disclosure" element={<GamblingDisclosure />} />
                <Route path="/legal/partner-program" element={<PartnerProgram />} />
                 
                {/* 🔓 Public Discover & Watch */}
                <Route path="/explore" element={<ExploreFeed />} />
                <Route path="/live-swipe" element={<StreamSwipePage />} />
                <Route path="/watch/:id" element={<BroadcastRouter />} />

                <Route path="/badges" element={<BadgesPage />} />
                <Route path="/badges/:userId" element={<BadgesPage />} />

                {/* Safety Page (standalone) */}
                <Route path="/safety" element={<Safety />} />

                {/* Dev preview pages (no auth required) */}
                <Route path="/dev/stream-controls" element={<StreamControlPreview />} />
                <Route path="/dev/broadcast-layout" element={<BroadcastLayoutPreview />} />
                <Route path="/dev/setup-preview" element={<SetupPreview />} />

                {/* 📡 Troll Deck - Broadcast Control Companion (separate auth) */}
                <Route path="/deck" element={<DeckDashboard />} />
                <Route path="/deck/auth" element={<DeckAuth />} />
                <Route path="/deck/*" element={<DeckDashboard />} />

                {/* 🔐 Protected Routes */}
                <Route element={<RequireAuth />}>
                  <Route path="/" element={<LandingHome />} />
                  <Route path="/broadcast/setup" element={<SetupPage />} />
                  <Route path="/broadcast/:id" element={<BroadcastRouter />} />
                  <Route path="/kick-fee/:streamId" element={<KickFeePage />} />
                  <Route path="/broadcast/summary/:streamId" element={<StreamSummary />} />
                  
                  {/* President Routes */}
                  <Route path="/president" element={<PresidentPage />} />
                  <Route path="/president/dashboard" element={
                    <RequireRole roles={[UserRole.PRESIDENT, UserRole.ADMIN]}>
                      <PresidentDashboard />
                    </RequireRole>
                  } />
                  <Route path="/president/secretary" element={
                    <RequireRole roles={[UserRole.SECRETARY, UserRole.ADMIN]}>
                      <SecretaryDashboard />
                    </RequireRole>
                  } />

                  <Route path="/dev/battle" element={<BattlePreview />} />
                  <Route path="/dev/stress-test" element={<FrontendLimitsTest />} />
                  <Route path="/dev/trollopoly-test" element={<Navigate to="/dev/trollopoly-city" replace />} />
                  <Route path="/dev/trollopoly-city" element={<TrollopolyCityDevTest />} />

                  <Route path="/mobile" element={<Navigate to="/" replace />} />
                  <Route path="/live" element={<ExploreFeed />} />
                  <Route path="/messages" element={<Navigate to="/tcps" replace />} />
                  <Route path="/tcps" element={<TCPS />} />
                  <Route path="/match" element={<MatchPage />} />
          <Route path="/city-hall" element={<CityHall />} />
                  <Route path="/city-registry" element={<CityRegistry />} />
                <Route path="/universe-event" element={<UniverseEventPage />} />
                <Route path="/events/universe" element={<Navigate to="/universe-event" replace />} />
                
                {/* 📺 TCNN - Troll City News Network */}
                <Route path="/tcnn" element={<TCNNMainPage />} />
                <Route path="/tcnn/article/:id" element={<ArticleReader />} />
                <Route path="/tcnn/dashboard" element={<TCNNInternalDashboard />} />
                <Route path="/tcnn/broadcaster" element={<TCNNBroadcasterPage />} />
                <Route path="/tcnn/broadcaster/:streamId" element={<TCNNBroadcasterPage />} />
                <Route path="/tcnn/viewer/:streamId" element={<TCNNViewerPage />} />
                
                <Route path="/call/:roomId/:type/:userId" element={<Call />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/following" element={<Following />} />
                  <Route path="/following/:userId" element={<Following />} />
                  <Route path="/trollifications" element={<Trollifications />} />
                  <Route path="/trollifieds" element={<Trollifieds />} />
                  <Route path="/marketplace" element={<Marketplace />} />
                  <Route path="/marketplace/orders" element={<Marketplace />} />
                  <Route path="/marketplace/sales" element={<Marketplace />} />
                  <Route path="/pool" element={<PublicPool />} />
                  <Route path="/troll-games" element={<TrollGamesPage />} />
                  <Route path="/troll-games/queue" element={<TrollGamesPage />} />
                  <Route path="/troll-games/live" element={<TrollGamesPage />} />
                  <Route path="/troll-games/match/:matchId" element={<TrollGamesPage />} />
                  <Route path="/troll-games/:gameType/:matchId" element={<TrollGamesPage />} />
                  <Route path="/troll-games/giveaways" element={<GiveawaysPage />} />
                  <Route path="/troll-wheel" element={<TrollWheel />} />

                  <Route path="/shop/:username" element={<ShopView />} />
                  <Route path="/inventory" element={<UserInventory />} />
          <Route path="/troting" element={<Troting />} />
          <Route path="/profile/settings" element={<ProfileSettings />} />
                  <Route path="/bank" element={<TrollBank />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/credit-scores" element={<CreditScorePage />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/jail" element={<JailPage />} />
                  <Route path="/wall" element={<TrollCityWall />} />
                  <Route path="/wall/:postId" element={<WallPostPage />} />
                  <Route path="/profile/setup" element={<ProfileSetup />} />
                  <Route path="/profile/id/:userId" element={<Profile />} />
                  <Route path="/profile/:username" element={<Profile />} />
                  <Route path="/trollstown" element={<TrollsTownPage />} />
                   <Route path="/district/:districtName" element={<DistrictTour />} />
                   <Route path="/living" element={<LivingPage />} />
                   <Route path="/neighbors" element={<NeighborsPage />} />
                   
                   <Route path="/pods" element={<TrollPodsListing />} />
                  <Route path="/pods/:roomId" element={<TrollPodRoom />} />
                   <Route path="/pods/:roomId/summary" element={<PodSummary />} />
                   
                   
                   <Route path="/church" element={<ChurchPage />} />
                  <Route path="/church/pastor" element={<PastorDashboard />} />
                  <Route path="/dev/xp" element={<XPSimulatorPage />} />
                  <Route path="/dev/badge-showcase" element={<BadgeDesignShowcase />} />
                  <Route path="/dev/homepage-bg-showcase" element={<HomepageBackgroundShowcase />} />
                   <Route path="/dev/gift-animation-showcase" element={<GiftAnimationShowcase />} />


                   {/* 📺 Live Streaming System */}
                  <Route path="/live/command-center/:streamId" element={<LiveCommandCenter />} />
                  <Route path="/live/overlay/:streamId" element={<LiveStreamOverlay />} />
                  <Route path="/settings/audio" element={<AudioSettings />} />

                   {/* 🎥 Streaming */}

                  <Route path="/join" element={<JoinPage />} />
                  <Route path="/kick-fee" element={<KickFee />} />
                  <Route path="/ban-fee" element={<BanFee />} />
                  <Route path="/troll-court/session" element={<TrollCourtSession />} />
                  <Route path="/live/:streamId" element={<Navigate to="/live" replace />} />
                  <Route path="/interview/:roomId" element={<InterviewRoom />} />
                  <Route path="/stream/:id" element={<BroadcastRouter />} />
                  <Route path="/stream/:streamId" element={<BroadcastRouter />} />
                  <Route path="/stream/:id/summary" element={<Navigate to="/live" replace />} />
                  <Route path="/stream-ended" element={<Navigate to="/live" replace />} />

                  {/* ⚖️ Court */}
                  <Route path="/troll-court" element={<TrollCourt />} />
                  <Route path="/court/:courtId" element={<CourtRoom />} />
                   
                  {/* 🎮 Multi-Box Streaming */}

                   
                  {/* 👥 Empire Partner Program */}
   

                  {/* 💳 Payment Methods */}
                  <Route path="/add-card" element={<Navigate to="/profile/setup" replace />} />
                   
                  {/* 📝 Creator Onboarding */}
                  <Route path="/onboarding/creator" element={<CreatorOnboarding />} />
                  <Route path="/creator-switch" element={<CreatorSwitchProgram />} />

                  {/* 💰 Earnings & Coins */}
                  <Route path="/store" element={<CoinStore />} />
                  <Route path="/coins" element={<CoinStore />} />
                  <Route path="/coins/complete" element={<CoinsComplete />} />
                  <Route path="/wallet" element={<Wallet />} />
                  <Route path="/stats" element={<Stats />} />
                  <Route path="/payouts/setup" element={<PayoutSetupPage />} />
                  <Route path="/payouts/request" element={<PayoutRequest />} />
                  <Route path="/payment/callback" element={<PaymentCallback />} />
                  <Route path="/earnings" element={<EarningsPage />} />
                  <Route path="/my-earnings" element={<MyEarnings />} />
                  <Route path="/empire-partner" element={<EmpirePartnerDashboard />} />
                  <Route path="/cashout" element={<CashoutPage />} />
                  <Route path="/withdraw" element={<Withdraw />} />
                  <Route path="/transactions" element={<TransactionHistory />} />
                  <Route path="/shop-partner" element={<ShopPartnerPage />} />
                  <Route path="/sell" element={<SellOnTrollCity />} />
                  <Route path="/seller/orders" element={<SellerOrders />} />
                  <Route path="/my-orders" element={<MyOrders />} />
                  <Route path="/seller/earnings" element={<ShopEarnings />} />
                  {/* Gift store routes removed */}

                  {/* 👨‍👩‍👧 Family */}
                  <Route path="/family" element={<TrollFamily />} />
                  <Route path="/family/browse" element={<FamilyBrowse />} />
                  <Route path="/family/create" element={<FamilyBrowse />} />
                  <Route path="/family/city" element={<TrollFamilyCity />} />
                  <Route path="/family/profile/:id" element={<FamilyProfilePage />} />
                  <Route path="/family/chat" element={<Navigate to="/family" replace />} />
                  <Route path="/family/chat/:familyId" element={<FamilyChatPage />} />
                  <Route path="/family/wars" element={<FamilyWarsPage />} />

                  {/* 🏰 Troll Family Ecosystem */}
                  <Route path="/family/home" element={<TrollFamilyHome user={profile || undefined} />} />
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
                  <Route path="/apply/pastor" element={<PastorApplication />} />
                  <Route path="/apply/journalist" element={<Application />} />
                  <Route path="/apply/news-caster" element={<Application />} />
                  <Route path="/apply/chief-news-caster" element={<Application />} />
                  <Route path="/career" element={<Career />} />
                  <Route path="/interview-room" element={<InterviewRoomPage />} />
                  <Route path="/admin/interview-test" element={<AdminInterviewDashboard />} />

                  {/* 👮 Officer */}
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
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]}>
                        <TrollOfficerLounge />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/moderation"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]}>
                        <OfficerModeration />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/report/:id"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]}>
                        <ReportDetailsPage />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/scheduling"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]}>
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
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]}>
                        <OfficerOWCDashboard />
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
                  <Route path="/officer/vote" element={<OfficerVote />} />
                  <Route
                    path="/government/streams"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.LEAD_TROLL_OFFICER, UserRole.ADMIN, UserRole.SECRETARY]}>
                        <GovernmentStreams />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/government"
                    element={<GovernmentPage />}
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
                    path="/admin/interviews"
                    element={
                      <RequireRole roles={[UserRole.ADMIN, UserRole.LEAD_TROLL_OFFICER]}>
                        <AdminInterviewDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/creator-approvals"
                    element={
                      <RequireRole roles={[UserRole.ADMIN, UserRole.SECRETARY, UserRole.LEAD_TROLL_OFFICER]}>
                        <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-5">
                          <CreatorSwitchApprovals />
                        </div>
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
                    {systemManagementRoutes.map((route) => {
                      const Component = route.component
                      return (
                        <Route
                          key={route.id}
                          path={route.path}
                          element={
                            <RequireRole roles={route.roles ?? [UserRole.ADMIN]}>
                              <Component />
                            </RequireRole>
                          }
                        />
                      )
                    })}
                    <Route
                      path="/admin/pool"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminPoolTab />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/trollmers-tournament"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <TrollmersTournament />
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
                      path="/admin/user-forms"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <UserFormsTab />
                        </RequireRole>
                      }
                    />
                    

                    
                    {/* Executive Office Routes */}
                    <Route
                      path="/admin/executive-secretaries"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ExecutiveSecretaries />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/gift-cards"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <GiftCardsManager />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/executive-intake"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ExecutiveIntake />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/executive-reports"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ExecutiveReports />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/troll-town-deeds"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminTrollTownDeeds />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/cashout-manager"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <CashoutManager />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/critical-alerts"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <CriticalAlertsManager />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/officer-management"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <OfficerManager />
                        </RequireRole>
                      }
                    />
                    
                    {/* Secretary Console */}
                    <Route
                      path="/secretary"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.SECRETARY]}>
                          <SecretaryConsole />
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
                      path="/admin/send-notifications"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <SendNotifications />
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
                      path="/admin/voting"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <TrotingAdminPage />
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
                      path="/admin/launch-trial"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminLaunchTrial />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/store-pricing"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <StorePriceEditor />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/errors"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminErrors />
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
                      path="/admin/manual-orders"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.SECRETARY]}>
                          <AdminManualOrders />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/buckets"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <BucketsDashboard />
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
                  <Route
                    path="/admin/appeals"
                    element={
                      <RequireRole roles={[UserRole.ADMIN, UserRole.SECRETARY]}>
                        <AppealManagement />
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
              </ErrorBoundary>
        <GlobalPodBanner />
        <BugAlertPopup />
      </AppLayout>

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
    </>
  );

  return appShell;
}

function App() {
  useEffect(() => {
    initTelemetry();
    // Initialize global time updater for account age calculations
    const cleanup = initTimeUpdater();
    return cleanup;
  }, []);

  return (
    <TrollProvider>
      <AppContent />
      {/* TM Family Invite Handler - shows pending invites as notifications */}
      <TMFamilyInviteHandler />
    </TrollProvider>
  );
}

export default App;
// Removed stray JSX outside of App component
