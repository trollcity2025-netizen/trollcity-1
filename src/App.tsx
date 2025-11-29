// src/App.tsx
import React, { useEffect, Suspense, lazy, useState } from "react";
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "./lib/store";
import { supabase, isAdminEmail } from "./lib/supabase";
import api from "./lib/api";
import { Toaster } from "sonner";

// Layout
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import ProfileSetupModal from "./components/ProfileSetupModal";
import RequireRole from "./components/RequireRole";

// Static pages (fast load)
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import TermsAgreement from "./pages/TermsAgreement";

// Lazy-loaded pages
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

// Lazy-loaded pages
const GoLive = lazy(() => import("./pages/GoLive"));
const StreamRoom = lazy(() => import("./pages/StreamRoom"));
const StreamSummary = lazy(() => import("./pages/StreamSummary"));
const Messages = lazy(() => import("./pages/Messages"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Trollifications = lazy(() => import("./pages/Trollifications"));
const Following = lazy(() => import("./pages/Following"));
const Application = lazy(() => import("./pages/Application"));
const TrollOfficerLounge = lazy(() => import("./pages/TrollOfficerLounge"));
const TrollFamily = lazy(() => import("./pages/TrollFamily"));
const TrollFamilyCity = lazy(() => import("./pages/TrollFamilyCity"));
const FamilyProfilePage = lazy(() => import("./pages/FamilyProfilePage"));
const FamilyWarsPage = lazy(() => import("./pages/FamilyWarsPage"));
const FamilyChatPage = lazy(() => import("./pages/FamilyChatPage"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const EarningsPayout = lazy(() => import("./pages/EarningsPayout"));
const TransactionHistory = lazy(() => import("./pages/TransactionHistory"));
const TrollWheel = lazy(() => import("./pages/TrollWheel"));
const TrollCityWall = lazy(() => import("./pages/TrollCityWall"));
const ReelFeed = lazy(() => import("./pages/ReelFeed"));
const CashoutPage = lazy(() => import("./pages/CashoutPage"));
const FamilyApplication = lazy(() => import("./pages/FamilyApplication"));
const OfficerApplication = lazy(() => import("./pages/OfficerApplication"));
const TrollerApplication = lazy(() => import("./pages/TrollerApplication"));
const CoinStore = lazy(() => import("./pages/CoinStore"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminPayoutMobile = lazy(() => import("./pages/admin/AdminPayoutMobile"));
const Support = lazy(() => import("./pages/Support"));
const Profile = lazy(() => import("./pages/Profile"));

function App() {
  const {
    user,
    profile,
    setAuth,
    setProfile,
    setLoading,
    setIsAdmin,
    isLoading,
  } = useAuthStore();

  const location = useLocation();
  const navigate = useNavigate();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalLoading] = useState(false);

  // 🔹 Auto-routing after approval
  useEffect(() => {
    if (profile?.role === 'troll_officer') {
      navigate('/officer/lounge');
    } else if (profile?.role === 'troll_family') {
      navigate('/family');
    } else if (profile?.role === 'troller') {
      navigate('/');
    }
  }, [profile?.role, navigate]);

  // 🔹 Authentication Initialization
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setAuth(session?.user || null, session);

        if (!session?.user) return setProfile(null);

        const isAdmin = isAdminEmail(session.user.email);

        if (isAdmin) {
          setIsAdmin(true);
          const cached = localStorage.getItem("admin-profile-cache");
          if (cached) setProfile(JSON.parse(cached));
          try {
            const result = await api.post("/auth/fix-admin-role");
            if (result?.success && result.profile) {
              setProfile(result.profile);
              localStorage.setItem("admin-profile-cache", JSON.stringify(result.profile));
              return;
            }
          } catch {}
        }

        // Normal user profile
        const { data: profileData } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();
        setProfile(profileData || null);
      } catch (err) {
        console.error("Auth Init Error:", err);
      } finally {
        setLoading(false);
      }
    };
    initSession();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="flex min-h-screen">
        {user && <Sidebar />}
        <div className="flex flex-col flex-1 min-h-screen">
          {user && <Header />}

          <main className="flex-1 overflow-y-auto bg-[#121212]">
            <Suspense fallback={<LoadingScreen />}>
              <Routes>

                {/* 🚪 Public Routes */}
                <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/terms" element={<TermsAgreement />} />
                <Route path="/terms-of-service" element={<TermsOfService />} />
                <Route path="/refund-policy" element={<RefundPolicy />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/payment-terms" element={<PaymentTerms />} />
                <Route path="/creator-agreement" element={<CreatorAgreement />} />
                <Route path="/tax-onboarding" element={<TaxOnboarding />} />
                <Route path="/earnings" element={<MyEarnings />} />
                <Route path="/live" element={<LandingPage />} />

                {/* 🔐 Protected Routes */}
                <Route element={<RequireAuth />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/following" element={<Following />} />
                  <Route path="/trollifications" element={<Trollifications />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/wall" element={<TrollCityWall />} />
                  <Route path="/reels" element={<ReelFeed />} />
                  <Route path="/profile/:username" element={<Profile />} />

                  {/* 🎥 Streaming */}
                  <Route path="/go-live" element={<GoLive />} />
                  <Route path="/stream/:streamId" element={<StreamRoom />} />
                  <Route path="/stream/:id/summary" element={<StreamSummary />} />
                  <Route path="/stream-ended" element={<StreamEnded />} />

                  {/* 💰 Earnings & Coins */}
                  <Route path="/store" element={<CoinStore />} />
                  <Route path="/earnings" element={<EarningsPayout />} />
                  <Route path="/cashout" element={<CashoutPage />} />
                  <Route path="/transactions" element={<TransactionHistory />} />
                  <Route path="/wheel" element={<TrollWheel />} />

                  {/* 👨‍👩‍👧 Family */}
                  <Route path="/family" element={<TrollFamily />} />
                  <Route path="/family/city" element={<TrollFamilyCity />} />
                  <Route path="/family/profile/:id" element={<FamilyProfilePage />} />
                  <Route path="/family/chat" element={<FamilyChatPage />} />
                  <Route path="/family/wars" element={<FamilyWarsPage />} />

                  {/* 📝 Applications */}
                  <Route path="/apply" element={<Application />} />
                  <Route path="/apply/family" element={<FamilyApplication />} />
                  <Route path="/apply/officer" element={<OfficerApplication />} />
                  <Route path="/apply/troller" element={<TrollerApplication />} />

                  {/* 👮 Officer */}
                  <Route
                    path="/officer/lounge"
                    element={
                      <RequireRole roles={['troll_officer', 'admin']}>
                        <TrollOfficerLounge />
                      </RequireRole>
                    }
                  />

                  {/* 👑 Admin */}
                  <Route
                    path="/admin"
                    element={
                      <RequireRole roles={['admin']}>
                        <AdminDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/payouts-mobile"
                    element={
                      <RequireRole roles={['admin']}>
                        <AdminPayoutMobile />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/earnings"
                    element={
                      <RequireRole roles={['admin']}>
                        <AdminEarningsDashboard />
                      </RequireRole>
                    }
                  />
                  <Route path="/rfc" element={<AdminRFC />} />
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
        toastOptions={{
          style: {
            background: "#2e1065",
            color: "#fff",
            border: "1px solid #22c55e",
          },
        }}
      />
    </div>
  );
}

export default App;
