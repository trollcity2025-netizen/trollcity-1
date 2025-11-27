// src/App.tsx
import React, { useState, useEffect, Suspense, lazy } from 'react'
import { useLocation, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './lib/store'
import { supabase, isAdminEmail } from './lib/supabase'
import { Toaster, toast } from 'sonner'

// COMPONENTS
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import ProfileSetupModal from './components/ProfileSetupModal'

// STATIC
import Home from './pages/Home'
import Auth from './pages/Auth'
import AuthCallback from './pages/AuthCallback'
import TermsAgreement from './pages/TermsAgreement'

// LAZY LOADED
const GoLive = lazy(() => import('./pages/GoLive'))
const StreamRoom = lazy(() => import('./pages/StreamRoom'))
const StreamSummary = lazy(() => import('./pages/StreamSummary'))
const Messages = lazy(() => import('./pages/Messages'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Trollifications = lazy(() => import('./pages/Trollifications'))
const Following = lazy(() => import('./pages/Following'))
const Application = lazy(() => import('./pages/Application'))
const TrollOfficerLounge = lazy(() => import('./pages/TrollOfficerLounge'))
const TrollFamily = lazy(() => import('./pages/TrollFamily'))
const TrollFamilyCity = lazy(() => import('./pages/TrollFamilyCity'))
const FamilyProfilePage = lazy(() => import('./pages/FamilyProfilePage'))
const FamilyWarsPage = lazy(() => import('./pages/FamilyWarsPage'))
const FamilyChatPage = lazy(() => import('./pages/FamilyChatPage'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const TrollerInsurance = lazy(() => import('./pages/TrollerInsurance'))
const Cashouts = lazy(() => import('./pages/Cashouts'))
const EarningsPayout = lazy(() => import('./pages/EarningsPayout'))
const Support = lazy(() => import('./pages/Support'))
const AccountWallet = lazy(() => import('./pages/AccountWallet'))
const AccountPaymentsSuccess = lazy(() => import('./pages/AccountPaymentsSuccess'))
const AccountPaymentLinkedSuccess = lazy(() => import('./pages/AccountPaymentLinkedSuccess'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminRFC = lazy(() => import('./components/AdminRFC'))
const Profile = lazy(() => import('./pages/Profile'))
const TrollWheel = lazy(() => import('./pages/TrollWheel'))
const TransactionHistory = lazy(() => import('./pages/TransactionHistory'))
const Changelog = lazy(() => import('./pages/Changelog'))
const FamilyApplication = lazy(() => import('./pages/FamilyApplication'))
const OfficerApplication = lazy(() => import('./pages/OfficerApplication'))
const TrollerApplication = lazy(() => import('./pages/TrollerApplication'))
const CoinStore = lazy(() => import('./pages/CoinStore'))
const FamilyCityMap = lazy(() => import('./FamilyCityMap'))

function App() {
  const { user, profile, setAuth, setProfile, setLoading, setIsAdmin, isLoading } = useAuthStore()
  const location = useLocation()
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [profileModalLoading, setProfileModalLoading] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<any>(null)

  const RequireAuth = () => {
    if (isLoading) return <LoadingScreen />
    if (!user) return <Navigate to="/auth" replace />
    if (profile && profile.terms_accepted === false && location.pathname !== '/terms' && profile.role !== 'admin') {
      return <Navigate to="/terms" replace />
    }
    return <Outlet />
  }

  const LoadingScreen = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0814] text-white">
      <div className="animate-pulse px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">Loading…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="flex min-h-screen">
        {user && <Sidebar />}
        <div className="flex flex-col flex-1 min-h-screen">
          {user && <Header />}

          <main className="flex-1 overflow-y-auto bg-[#121212]">
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route element={<RequireAuth />}>
                  <Route path="/" element={<Home />} />

                  {/* CORE PAGES */}
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/following" element={<Following />} />
                  <Route path="/trollifications" element={<Trollifications />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/support" element={<Support />} />

                  {/* STORE & ECONOMY */}
                  <Route path="/store" element={<CoinStore />} />
                  <Route path="/transactions" element={<TransactionHistory />} />
                  <Route path="/earnings" element={<EarningsPayout />} />

                  {/* LIVE STREAMS */}
                  <Route path="/go-live" element={<GoLive />} />
                  <Route path="/stream/:streamId" element={<StreamRoom />} />
                  <Route path="/stream/:id/summary" element={<StreamSummary />} />

                  {/* FAMILY */}
                  <Route path="/family" element={<TrollFamily />} />
                  <Route path="/family/city" element={<TrollFamilyCity />} />
                  <Route path="/family/profile/:id" element={<FamilyProfilePage />} />
                  <Route path="/family/wars" element={<FamilyWarsPage />} />
                  <Route path="/family/chat" element={<FamilyChatPage />} />

                  {/* APPLICATIONS */}
                  <Route path="/apply" element={<Application />} />
                  <Route path="/apply/family" element={<FamilyApplication />} />
                  <Route path="/apply/officer" element={<OfficerApplication />} />
                  <Route path="/apply/troller" element={<TrollerApplication />} />

                  {/* PROFILE */}
                  <Route path="/profile/:username" element={<Profile />} />

                  {/* TROLL WHEEL */}
                  <Route path="/wheel" element={<TrollWheel />} />

                  {/* SETTINGS */}
                  <Route path="/account/wallet" element={<AccountWallet />} />

                  {/* OFFICER */}
                  <Route
                    path="/officer/lounge"
                    element={profile?.role === 'admin' || profile?.role === 'troll_officer'
                      ? <TrollOfficerLounge />
                      : <Navigate to="/" replace />}
                  />

                  {/* ADMIN */}
                 <Route element={<RequireAuth />}>
  <Route
    path="/admin"
    element={
      profile?.role === 'admin'
        ? (
            <Suspense fallback={<LoadingScreen />}>
              <AdminDashboard />
            </Suspense>
          )
        : <Navigate to="/" replace />
    }
  />
</Route>


                {/* AUTH & TERMS */}
                <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/terms" element={<TermsAgreement />} />

                {/* CATCH-ALL */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>

      <Toaster position="top-right" toastOptions={{
        style: { background: '#2e1065', color: '#fff', border: '1px solid #22c55e' }
      }} />
    </div>
  )
}

export default App
