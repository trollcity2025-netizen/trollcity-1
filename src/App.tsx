// src/App.tsx
import React, { useEffect, Suspense, useState, useRef, lazy } from "react";
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

// Layout
import OfficerAlertBanner from "./components/OfficerAlertBanner";
import AdminOfficerQuickMenu from "./components/AdminOfficerQuickMenu";
import GlobalUserCounter from "./components/admin/GlobalUserCounter";

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
const SetupPage = lazy(() => import("./pages/broadcast/SetupPage"));
const BroadcastPage = lazy(() => import("./pages/broadcast/BroadcastPage"));
const StreamSummary = lazy(() => import("./pages/broadcast/StreamSummary"));
const BattlePreview = lazy(() => import("./pages/dev/BattlePreview"));
const FrontendLimitsTest = lazy(() => import("./pages/dev/FrontendLimitsTest"));
const LivingPage = lazy(() => import("./pages/LivingPage"));
const ChurchPage = lazy(() => import("./pages/ChurchPage"));
const PastorDashboard = lazy(() => import("./pages/church/PastorDashboard"));
const XPSimulatorPage = lazy(() => import("./pages/dev/XPSimulatorPage"));
const BadgePopup = lazy(() => import("./components/BadgePopup"));



// Sidebar pages (instant load)
const TCPS = lazy(() => import("./pages/TCPS"));
const TrollPodsListing = lazy(() => import("./pages/pods/TrollPodsListing"));
const TrollPodRoom = lazy(() => import("./pages/pods/TrollPodRoom"));

// Lazy-loaded pages
const MobileShell = lazyWithRetry(() => import("./pages/MobileShell"));
const Following = lazy(() => import("./pages/Following"));

// Speculative lazy imports to resolve "Cannot find name" errors
const ExploreFeed = lazy(() => import("./pages/ExploreFeed"));
const CoinStore = lazy(() => import("./pages/CoinStore"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const PublicPool = lazy(() => import("./pages/PublicPool"));
const UserInventory = lazy(() => import("./pages/UserInventory"));
const Troting = lazy(() => import("./pages/Troting"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const SellOnTrollCity = lazy(() => import("./pages/SellOnTrollCity"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const TrollCityWall = lazy(() => import("./pages/TrollCityWall"));
const WallPostPage = lazy(() => import("./pages/WallPostPage"));
const TrollCourt = lazy(() => import("./pages/TrollCourt"));
const PresidentPage = lazy(() => import("./pages/President"));
const PresidentDashboard = lazy(() => import("./pages/president/PresidentDashboard"));
const SecretaryDashboard = lazy(() => import("./pages/president/SecretaryDashboard"));
const EmpirePartnerDashboard = lazy(() => import("./pages/EmpirePartnerDashboard"));
// Gift store pages removed
const Application = lazy(() => import("./pages/Application"));
const ApplicationPage = lazy(() => import("./pages/ApplicationPage"));
const TrollsTownPage = lazy(() => import("./pages/TrollsTownPage"));
const DistrictTour = lazy(() => import("./pages/DistrictTour"));
const TrollOfficerLounge = lazy(() => import("./pages/TrollOfficerLounge"));
const FoundingOfficerTrial = lazy(() => import("./pages/FoundingOfficerTrial"));
const OfficerModeration = lazy(() => import("./pages/OfficerModeration"));
const TrollFamily = lazy(() => import("./pages/TrollFamily"));
const FamilyLounge = lazy(() => import("./pages/FamilyLounge.jsx"));
const FamilyWarsHub = lazy(() => import("./pages/FamilyWarsHub.jsx"));
const FamilyLeaderboard = lazy(() => import("./pages/FamilyLeaderboard.jsx"));
const FamilyShop = lazy(() => import("./pages/FamilyShop.jsx"));
const FamilyBrowse = lazy(() => import("./pages/FamilyBrowse"));
const Support = lazy(() => import("./pages/Support"));
const JailPage = lazy(() => import("./pages/JailPage"));
const Safety = lazy(() => import("./pages/Safety"));
const AdminRFC = lazy(() => import("./components/AdminRFC"));
const AdminEarningsDashboard = lazy(() => import("./pages/admin/AdminEarningsDashboard"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const ApplicationsPage = lazy(() => import("./pages/admin/Applications"));
const AdminMarketplace = lazy(() => import("./pages/admin/AdminMarketplace"));
const AdminOfficerReports = lazy(() => import("./pages/admin/AdminOfficerReports"));
const MaiTalentPage = lazy(() => import("./pages/MaiTalentPage"));
const StoreDebug = lazy(() => import("./pages/admin/StoreDebug"));
const Changelog = lazy(() => import("./pages/Changelog"));
const AccessDenied = lazy(() => import("./pages/AccessDenied"));
const ReferralBonusPanel = lazy(() => import("./pages/admin/ReferralBonusPanel"));
const SecretaryConsole = lazy(() => import("./pages/secretary/SecretaryConsole"));
import { systemManagementRoutes } from "./pages/admin/adminRoutes";


const TaxOnboarding = lazy(() => import("./pages/TaxOnboarding"));
const MyEarnings = lazy(() => import("./pages/MyEarnings"));
const EarningsPage = lazy(() => import("./pages/EarningsPage"));
const VerificationPage = lazy(() => import("./pages/VerificationPage"));
const VerificationComplete = lazy(() => import("./pages/VerificationComplete"));
const PayoutStatus = lazy(() => import("./pages/PayoutStatus"));
const AdminLaunchTrial = lazy(() => import("./pages/admin/LaunchTrial"));


const JoinPage = lazyWithRetry(() => import("./pages/Join"));
const KickFeePage = lazy(() => import("./pages/broadcast/KickFeePage"));
const KickFee = lazy(() => import("./pages/KickFee"));
const BanFee = lazy(() => import("./pages/BanFee"));
const TrollCourtSession = lazy(() => import("./pages/TrollCourtSession"));

const Call = lazy(() => import("./pages/Call"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Trollifications = lazy(() => import("./pages/Trollifications"));
const OfficerScheduling = lazy(() => import("./pages/OfficerScheduling"));
const InterviewRoom = lazy(() => import("./pages/InterviewRoom"));
const OfficerPayrollDashboard = lazy(() => import("./pages/officer/OfficerPayrollDashboard"));
const OfficerDashboard = lazy(() => import("./pages/officer/OfficerDashboard"));
const OfficerOWCDashboard = lazy(() => import("./pages/OfficerOWCDashboard"));
const OfficerVote = lazy(() => import("./pages/OfficerVote"));
const GovernmentStreams = lazy(() => import("./pages/government/GovernmentStreams"));
const ReportDetailsPage = lazy(() => import("./pages/ReportDetailsPage"));
const TrollFamilyCity = lazy(() => import("./pages/TrollFamilyCity"));
const FamilyProfilePage = lazy(() => import("./pages/FamilyProfilePage"));
const FamilyWarsPage = lazy(() => import("./pages/FamilyWarsPage"));
const FamilyChatPage = lazy(() => import("./pages/FamilyChatPage"));
const TransactionHistory = lazy(() => import("./pages/TransactionHistory"));
const CashoutPage = lazy(() => import("./pages/CashoutPage"));
const FamilyApplication = lazy(() => import("./pages/FamilyApplication"));
const OfficerApplication = lazy(() => import("./pages/OfficerApplication"));
const TrollerApplication = lazy(() => import("./pages/TrollerApplication"));
const Career = lazy(() => import("./pages/Career"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const Contact = lazy(() => import("./pages/Contact"));
const LeadOfficerApplication = lazy(() => import("./pages/LeadOfficerApplication"));
const PastorApplication = lazy(() => import("./pages/PastorApplication"));
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
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const BadgesPage = lazy(() => import("./pages/BadgesPage"));
const Stats = lazy(() => import("./pages/Stats"));
const EmpirePartnerApply = lazy(() => import("./pages/EmpirePartnerApply"));
const EarningsDashboard = lazy(() => import("./pages/EarningsDashboard"));
const CreatorOnboarding = lazy(() => import("./pages/CreatorOnboarding"));
const CreatorSwitchProgram = lazy(() => import("./pages/CreatorSwitchProgram"));
const PolicyCenter = lazy(() => import("./pages/PolicyCenter"));
const TermsOfServiceLegal = lazy(() => import("./pages/legal/TermsOfService"));
const PrivacyPolicyLegal = lazy(() => import("./pages/legal/PrivacyPolicy"));
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
const ExecutiveSecretaries = lazy(() => import("./pages/admin/ExecutiveSecretaries"));
const GiftCardsManager = lazy(() => import("./pages/admin/GiftCardsManager"));
const ExecutiveIntake = lazy(() => import("./pages/admin/ExecutiveIntake"));
const ExecutiveReports = lazy(() => import("./pages/admin/ExecutiveReports"));
const AdminManualOrders = lazy(() => import("./pages/admin/AdminManualOrders"));
const CashoutManager = lazy(() => import("./pages/admin/CashoutManager"));
const TrollmersTournament = lazy(() => import("./pages/admin/TrollmersTournament"));
const CriticalAlertsManager = lazy(() => import("./pages/admin/CriticalAlertsManager"));
const OfficerManager = lazy(() => import("./pages/admin/OfficerManager"));
const AdminTrollTownDeeds = lazy(() => import("./pages/admin/AdminTrollTownDeeds"));
const LeadOfficerDashboard = lazy(() => import("./pages/lead-officer/LeadOfficerDashboard"));
const ShopPartnerPage = lazy(() => import("./pages/ShopPartnerPage"));
const UniverseEventPage = lazy(() => import("./pages/UniverseEventPage"));

const ShopView = lazy(() => import("./pages/ShopView"));
const CourtRoom = lazy(() => import("./pages/CourtRoom"));
const InterviewRoomPage = lazy(() => import("./pages/InterviewRoomPage"));
const AdminInterviewDashboard = lazy(() => import("./pages/AdminInterviewDashboard"));
const PasswordReset = lazy(() => import("./pages/PasswordReset"));
const CreditScorePage = lazy(() => import("./pages/CreditScorePage"));
const _LoansPage = lazy(() => import("./pages/Loans"));


// Admin pages
const BanManagement = lazy(() => import("./pages/admin/BanManagement"));
const RoleManagement = lazy(() => import("./pages/admin/RoleManagement"));
const MediaLibrary = lazy(() => import("./pages/admin/MediaLibrary"));
const ChatModeration = lazy(() => import("./pages/admin/ChatModeration"));
const Announcements = lazy(() => import("./pages/admin/Announcements"));
const SendNotifications = lazy(() => import("./pages/admin/SendNotifications"));
const ExportData = lazy(() => import("./pages/admin/ExportData"));
const UserSearch = lazy(() => import("./pages/admin/UserSearch"));
const ReportsQueue = lazy(() => import("./pages/admin/ReportsQueue"));
const StreamMonitorPage = lazy(() => import("./pages/admin/StreamMonitorPage"));
const TrotingAdminPage = lazy(() => import("./pages/admin/TrotingAdminPage"));
const PaymentLogs = lazy(() => import("./pages/admin/PaymentLogs"));
const StorePriceEditor = lazy(() => import("./pages/admin/components/StorePriceEditor"));
const AdminFinanceDashboard = lazy(() => import("./pages/admin/AdminFinanceDashboard"));
const CreateSchedule = lazy(() => import("./pages/admin/CreateSchedule"));
const OfficerShifts = lazy(() => import("./pages/admin/OfficerShifts"));
const EmpireApplicationsPage = lazy(() => import("./pages/admin/EmpireApplicationsPage"));


const ReferralBonuses = lazy(() => import("./pages/admin/ReferralBonuses"));
const ControlPanel = lazy(() => import("./pages/admin/ControlPanel"));
const TestDiagnosticsPage = lazy(() => import("./pages/admin/TestDiagnosticsPage"));
const ResetMaintenance = lazy(() => import("./pages/admin/ResetMaintenance"));
const AdminHR = lazy(() => import("./pages/admin/AdminHR"));
const UserFormsTab = lazy(() => import("./pages/admin/components/UserFormsTab"));
const BucketsDashboard = lazy(() => import("./pages/admin/BucketsDashboard"));
const GrantCoins = lazy(() => import("./pages/admin/GrantCoins"));
const OfficerOperations = lazy(() => import("./pages/admin/OfficerOperations"));
const CreatorSwitchApprovals = lazy(() => import("./pages/admin/components/CreatorSwitchApprovals"));

const LoadingScreen = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0814] text-white">
      <div className="animate-pulse px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">
        Loading…
      </div>
    </div>
  );

  const ProfileRedirect = () => {
    const profile = useAuthStore((s) => s.profile);

    if (!profile) return <Navigate to="/profile/setup" replace />;

    const target = profile.username
      ? `/profile/${profile.username}`
      : profile.id
        ? `/profile/id/${profile.id}`
        : "/profile/setup";

    return <Navigate to={target} replace />;
  };

  // 🔐 Route Guard
    const RequireAuth = () => {
    const user = useAuthStore((s) => s.user);
  useAutoClickerDetection(user?.id);
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

import { useAutoClickerDetection } from './hooks/useAutoClickerDetection';

function AppContent() {
  // Lightweight render counter (dev only)
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    const w = window as any;
    w.__tc_app_renders = (w.__tc_app_renders || 0) + 1;
    if (w.__tc_app_renders % 50 === 0) {
      console.debug('[App] render count', w.__tc_app_renders);
    }
  }

  // Narrow selectors to avoid returning a fresh object from the selector
  const user = useAuthStore((s) => s.user);

  // Some legacy logic needs the full profile object in several effects
  const profile = useAuthStore((s) => s.profile);


  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalLoading] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingServiceWorker, setWaitingServiceWorker] = useState<ServiceWorker | null>(null);
  const didReloadRef = useRef(false);


  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const eligibilityRefresh = useEligibilityStore((s) => s.refresh);

  // Global app context for loading and error states
  const {
    isLoading: globalLoading,
    loadingMessage,
    error,
    retryLastAction,
    isReconnecting,
    reconnectMessage,
  } = useGlobalApp();

  // Handle Service Worker navigation requests (e.g. from push notifications)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE' && event.data.url) {
        try {
          const nextPath = new URL(event.data.url, window.location.origin).pathname;
          if (nextPath !== window.location.pathname) {
            console.log('[App] Received NAVIGATE from SW:', nextPath);
            navigate(nextPath);
          }
        } catch (error) {
          console.warn('[App] Ignored NAVIGATE with invalid URL', error);
        }
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
        console.warn('Caught invalid refresh token error, signing out...');
        event.preventDefault(); // Prevent default console error
        
        // Clear session and redirect to auth
        useAuthStore.getState().logout()
        window.location.href = '/auth';
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
    if (user && profile?.role === 'admin') {
      console.log('[BugAlert] Admin detected, setting up real-time subscription');
      
      // Subscribe to real-time bug alerts
      subscribeToRealtime(user.id, true);
      
      // Fetch initial alerts
      fetchAlerts({ status: 'active' });
    }
    
    // Cleanup on unmount
    return () => {
      unsubscribeFromRealtime();
    };
  }, [user, profile?.role]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      ((window.navigator as any).standalone === true);
    setIsStandalone(standalone);
  }, []);

  // Warrant Access Restriction
  useEffect(() => {
    if (profile?.has_active_warrant) {
       // Allow access to court pages, auth pages, and static assets
       const allowedPaths = ['/troll-court', '/court', '/auth', '/legal', '/support'];
       const isAllowed = allowedPaths.some(path => location.pathname.startsWith(path));
       
       if (!isAllowed) {
         toast.error("Active Warrant Issued! You must appear in Troll Court.");
         navigate('/troll-court');
       }
    }
  }, [profile?.has_active_warrant, location.pathname, navigate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const handleControllerChange = () => {
      if (didReloadRef.current) return;
      didReloadRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

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

    toast.info("New update available!", {
      duration: Infinity,
      description: "A new version of Troll City is available.",
      action: {
        label: "Update Now",
        onClick: () => {
          waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
          setUpdateAvailable(false);

          setTimeout(() => {
            if (didReloadRef.current) return;
            didReloadRef.current = true;
            window.location.reload();
          }, 1500);
        }
      },
      onDismiss: () => {}
    });
  }, [updateAvailable, waitingServiceWorker]);

  useEffect(() => {
    if (!user || !isStandalone) return;
    if (location.pathname === '/' || location.pathname === '/auth') {
      navigate('/mobile', { replace: true });
    }
  }, [user, isStandalone, location.pathname, navigate]);

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
    if (location.pathname !== '/') {
      return;
    }

    // Don't redirect if user is not logged in
    if (!user || !profile) {
      return;
    }

    if (profile?.role === 'troll_family') {
      navigate('/family', { replace: true });
    }
  }, [profile, location.pathname, navigate, user]);

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
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [navigate, profile])

  // 🔹 Check if user is kicked or banned and route to fee pages
  useEffect(() => {
    if (!profile) return;

    if (profile.is_banned && location.pathname !== '/ban-fee') {
      navigate('/ban-fee', { replace: true });
      return;
    }

    if (profile.is_kicked && location.pathname !== '/kick-fee') {
      navigate('/kick-fee', { replace: true });
    }
  }, [profile, location.pathname, navigate]);

  // 🔹 Track user IP address and check for IP bans
  useEffect(() => {
    const controller = new AbortController()

    const trackIP = async () => {
      if (!user?.id) return

      try {
        // Get user's IP address with timeout
        const ipResponse = await fetch('https://api.ipify.org?format=json', {
            signal: controller.signal
        });
        const ipData = await ipResponse.json();
        const userIP = ipData.ip;

        if (userIP && user?.id) {
            supabase.functions.invoke('vpn-detect', {
                body: { ip: userIP, user_id: user.id },
            });
        }

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
          .eq('id', user.id)
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
          .eq('id', user.id)
      } catch (error: any) {
        // Ignore abort errors
        if (error.name === 'AbortError' || error.message?.includes('AbortError')) return
        console.error('Error tracking IP:', error)
      }
    }

    if (user) {
      trackIP()
    }

    return () => {
        controller.abort()
    }
  }, [user, navigate])

  // 🔹 Check Daily Login for XP
  useEffect(() => {
    if (user?.id) {
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
  }, [user?.id]);

  // 🔹 Real-time Profile Updates (Debounced to prevent double renders)
  useDebouncedProfileUpdate(user?.id)

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      void reportError({
        message: event.message || 'window.onerror',
        stack: event.error?.stack,
        userId: user?.id || null,
        url: window.location.pathname,
        component: 'global'
      })
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      
      // Handle Invalid Refresh Token error by logging out
      const reasonMsg = reason?.message || String(reason)
      if (reasonMsg.includes('Invalid Refresh Token') || reasonMsg.includes('Refresh Token Not Found')) {
        console.warn('Invalid refresh token detected, logging out...')
        useAuthStore.getState().logout()
        return
      }

      void reportError({
        message: (reason?.message || String(reason) || 'unhandledrejection'),
        stack: reason?.stack,
        userId: user?.id || null,
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
          userId: user?.id || null,
          url: window.location.pathname,
          component: 'console',
          context: { args }
        })
      } catch {}
      originalConsoleError.apply(console, args)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
      console.error = originalConsoleError
    }
  }, [user?.id])

  // 🔹 Tab Visibility Change Handler
  useEffect(() => {
    if (!user?.id) return
 
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
            .eq('user_id', user.id);
            
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

  const handleUpdateClick = () => {
    if (!waitingServiceWorker) return;
    waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
    setUpdateAvailable(false);
  };

  return (
    <>
      <SessionMonitor />
      <GlobalUserCounter />
      {updateAvailable && (
        <div className="fixed bottom-0 inset-x-0 z-[60] flex items-center justify-between bg-purple-900 text-white px-4 py-3">
          <span className="text-sm">A new version of Troll City is available.</span>
          <button
            type="button"
            onClick={handleUpdateClick}
            className="ml-4 rounded bg-white text-black text-sm font-semibold px-3 py-1"
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


      <AppLayout showSidebar={true} showHeader={true} showBottomNav={true}>
        <GlobalPresenceTracker />
        {user && <AdminOfficerQuickMenu />}
        {user && (
          <Suspense fallback={null}>
            <BadgePopup />
          </Suspense>
        )}

        <ErrorBoundary>
          <Suspense fallback={<LoadingScreen />}>
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
                <Route path="/watch/:id" element={<BroadcastPage />} />

                <Route path="/badges" element={<BadgesPage />} />
                <Route path="/badges/:userId" element={<BadgesPage />} />

                {/* Safety Page (standalone) */}
                <Route path="/safety" element={<Safety />} />

                {/* 🔐 Protected Routes */}
                <Route element={<RequireAuth />}>
                  <Route path="/broadcast/setup" element={<SetupPage />} />
                  <Route path="/broadcast/:id" element={<BroadcastPage />} />
                  <Route path="/kick-fee/:streamId" element={<KickFeePage />} />
                  <Route path="/broadcast/summary" element={<StreamSummary />} />
                  
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

                  <Route path="/mobile" element={<MobileShell><Outlet /></MobileShell>}>
                    <Route index element={<Navigate to="/mobile/tcps" replace />} />
                    <Route path="tcps" element={<TCPS />} />
                    <Route path="troll-pods" element={<TrollPodsListing />} />
                    <Route path="troll-pods/:id" element={<TrollPodRoom />} />
                    <Route path="watch" element={<TrollPodsListing />} />
                    <Route path="pods" element={<TrollPodsListing />} />
                  </Route>
                  <Route path="/live" element={<LandingHome />} />
                  <Route path="/messages" element={<Navigate to="/tcps" replace />} />
                  <Route path="/tcps" element={<MobileShell><TCPS /></MobileShell>} />
          <Route path="/city-hall" element={<CityHall />} />
                  <Route path="/universe-event" element={<UniverseEventPage />} />
                  <Route path="/events/universe" element={<Navigate to="/universe-event" replace />} />
                  <Route path="/call/:roomId/:type/:userId" element={<Call />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/following" element={<Following />} />
                  <Route path="/following/:userId" element={<Following />} />
                  <Route path="/trollifications" element={<Trollifications />} />
                  <Route path="/marketplace" element={<Marketplace />} />
                  <Route path="/pool" element={<PublicPool />} />
                  <Route path="/social/mai-talent" element={<MaiTalentPage />} />
                  <Route path="/mai-talent" element={<Navigate to="/social/mai-talent" replace />} />
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
                  <Route path="/profile" element={<ProfileRedirect />} />
                  <Route path="/profile/setup" element={<ProfileSetup />} />
                  <Route path="/profile/id/:userId" element={<Profile />} />
                  <Route path="/profile/:username" element={<Profile />} />
                  <Route path="/trollstown" element={<TrollsTownPage />} />
                  <Route path="/district/:districtName" element={<DistrictTour />} />
                  <Route path="/living" element={<LivingPage />} />
                  
                  <Route path="/pods" element={<TrollPodsListing />} />
                  <Route path="/pods/:roomId" element={<TrollPodRoom />} />
                  
                  <Route path="/church" element={<ChurchPage />} />
                  <Route path="/church/pastor" element={<PastorDashboard />} />
                  <Route path="/dev/xp" element={<XPSimulatorPage />} />
                  
                  {/* 🎥 Streaming */}

                  <Route path="/join" element={<JoinPage />} />
                  <Route path="/kick-fee" element={<KickFee />} />
                  <Route path="/ban-fee" element={<BanFee />} />
                  <Route path="/troll-court/session" element={<TrollCourtSession />} />
                  <Route path="/live/:streamId" element={<Navigate to="/live" replace />} />
                  <Route path="/interview/:roomId" element={<InterviewRoom />} />
                  <Route path="/stream/:id" element={<Navigate to="/live" replace />} />
                  <Route path="/stream/:streamId" element={<Navigate to="/live" replace />} />
                  <Route path="/stream/:id/summary" element={<Navigate to="/live" replace />} />
                  <Route path="/stream-ended" element={<Navigate to="/live" replace />} />

                  {/* ⚖️ Court */}
                  <Route path="/troll-court" element={<TrollCourt />} />
                  <Route path="/court/:courtId" element={<CourtRoom />} />
                   
                  {/* 🎮 Multi-Box Streaming */}

                   
                  {/* 👥 Empire Partner Program */}
                  <Route path="/empire-partner" element={<EmpirePartnerDashboard />} />
                  <Route path="/empire-partner/apply" element={<EmpirePartnerApply />} />


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
                  <Route path="/cashout" element={<CashoutPage />} />
                  <Route path="/withdraw" element={<Withdraw />} />
                  <Route path="/transactions" element={<TransactionHistory />} />
                  <Route path="/shop-partner" element={<ShopPartnerPage />} />
                  <Route path="/sell" element={<SellOnTrollCity />} />
                  <Route path="/seller/earnings" element={<ShopEarnings />} />
                  {/* Gift store routes removed */}

                  {/* 👨‍👩‍👧 Family */}
                  <Route path="/family" element={<TrollFamily />} />
                  <Route path="/family/browse" element={<FamilyBrowse />} />
                  <Route path="/family/city" element={<TrollFamilyCity />} />
                  <Route path="/family/profile/:id" element={<FamilyProfilePage />} />
                  <Route path="/family/chat" element={<FamilyChatPage />} />
                  <Route path="/family/wars" element={<FamilyWarsPage />} />

                  {/* 🏰 Troll Family Ecosystem */}
                  <Route path="/family/lounge" element={<FamilyLounge user={profile || undefined} />} />
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
                  <Route path="/career" element={<Career />} />
                  <Route path="/about" element={<AboutUs />} />
                  <Route path="/contact" element={<Contact />} />
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
                    
                    {/* Secretary Console - Protected by internal logic */}
                    <Route
                      path="/secretary"
                      element={
                        <SecretaryConsole />
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
  </>)
}

function App() {
  useEffect(() => {
    initTelemetry();
    // Initialize global time updater for account age calculations
    const cleanup = initTimeUpdater();
    return cleanup;
  }, []);

  return <AppContent />;
}

export default App;
// Removed stray JSX outside of App component
