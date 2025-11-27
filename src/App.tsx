import React, { useState, useEffect } from 'react'
import { useLocation, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './lib/store'
import { supabase, isAdminEmail } from './lib/supabase'
import { API_ENDPOINTS } from './lib/config'
import { Toaster, toast } from 'sonner'
import { coinOptimizer } from './lib/coinRotation'

import Sidebar from './components/Sidebar'
import Header from './components/Header'
import ProfileSetupModal from './components/ProfileSetupModal'

// Pages
import Home from './pages/Home'
import GoLive from './pages/GoLive'
import StreamRoom from './pages/StreamRoom'
import StreamSummary from './pages/StreamSummary'
import CoinStore from './pages/CoinStore'
import Messages from './pages/Messages'
import Notifications from './pages/Notifications'
import Trollifications from './pages/Trollifications'
import Following from './pages/Following'
import Application from './pages/Application'
import TrollOfficerLounge from './pages/TrollOfficerLounge'
import TrollFamily from './pages/TrollFamily'
import TrollFamilyCity from './pages/TrollFamilyCity'
import FamilyCityMap from './FamilyCityMap'
import FamilyProfilePage from './pages/FamilyProfilePage'
import FamilyWarsPage from './pages/FamilyWarsPage'
import FamilyChatPage from './pages/FamilyChatPage'
import Leaderboard from './pages/Leaderboard'
import OfficerApplication from './pages/OfficerApplication'
import TrollerApplication from './pages/TrollerApplication'
import FamilyApplication from './pages/FamilyApplication'
import TrollWheel from './pages/TrollWheel'
import TrollerInsurance from './pages/TrollerInsurance'
import Cashouts from './pages/Cashouts'
import AdminDashboard from './pages/AdminDashboard'
import AdminRFC from './components/AdminRFC'
import Profile from './pages/Profile'
import Auth from './pages/Auth'
import AuthCallback from './pages/AuthCallback'
import EarningsPayout from './pages/EarningsPayout'
import ProfileSetup from './pages/ProfileSetup'
import AccountPaymentsSuccess from './pages/AccountPaymentsSuccess'
import AccountWallet from './pages/AccountWallet'
import AccountPaymentLinkedSuccess from './pages/AccountPaymentLinkedSuccess'
import Support from './pages/Support'
import TermsAgreement from './pages/TermsAgreement'
import Changelog from './pages/Changelog'
import TransactionHistory from './pages/TransactionHistory'

function App() {
  const { user, profile, setAuth, setProfile, setLoading, setIsAdmin } = useAuthStore()
  const ADMIN_EMAIL = (import.meta as any).env?.VITE_ADMIN_EMAIL || 'trollcity2025@gmail.com'
  const isLoading = useAuthStore.getState().isLoading
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [profileModalLoading, setProfileModalLoading] = useState(false)
  const location = useLocation()
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installed, setInstalled] = useState<boolean>(() => {
    try { return localStorage.getItem('pwa-installed') === 'true' } catch { return false }
  })

  // 🔐 Require Auth — No change
  const RequireAuth = () => {
    const { user, profile, isLoading } = useAuthStore()
    const location = useLocation()
    
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0A0814] text-white">
          <div className="animate-pulse px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">
            Loading…
          </div>
        </div>
      )
    }
    
    if (!user) return <Navigate to="/auth" replace />
    
    // Check if user has accepted terms (skip for admin)
    // Only redirect if explicitly false (not null/undefined which means loading)
    const needsTerms = profile && profile.terms_accepted === false && profile.role !== 'admin'
    if (needsTerms && location.pathname !== '/terms') {
      console.log('Redirecting to terms - user has not accepted:', profile.username)
      return <Navigate to="/terms" replace />
    }
    
    return <Outlet />
  }

  const FamilyAccessRoute = () => {
    const { user, profile } = useAuthStore()
    const [allowed, setAllowed] = useState<boolean | null>(null)
    useEffect(() => {
      const run = async () => {
        if (!user) { setAllowed(false); return }
        if (profile?.role === 'admin') { setAllowed(true); return }
        try {
          const { data: member } = await supabase
            .from('troll_family_members')
            .select('approved, has_crown_badge')
            .eq('user_id', user.id)
            .maybeSingle()

          const { data: payment } = await supabase
            .from('coin_transactions')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .ilike('description', '%Family Lounge%')
            .maybeSingle()

          const ok = !!member?.approved && !!member?.has_crown_badge && !!payment
          setAllowed(ok)
        } catch {
          setAllowed(false)
        }
      }
      run()
    }, [user?.id, profile?.role])
    if (allowed === null) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0A0814] text-white">
          <div className="animate-pulse px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">Loading…</div>
        </div>
      )
    }
    return allowed ? <Outlet /> : <Navigate to="/apply/family" replace />
  }

  // Focus Lock Cleanup — untouched
  useEffect(() => {
    setProfileModalOpen(false)
    try {
      document.querySelectorAll('[inert], .focus-lock').forEach(el => el.remove())
      document.body.style.overflow = ''
    } catch {}
  }, [location.pathname])

  // Session Restore — untouched
  useEffect(() => {
    let isMounted = true
    const initializeAuth = async () => {
      try {
        const params = new URLSearchParams(location.search)
        const isReset = params.get('reset') === '1'
        if (isReset) {
          try {
            await supabase.auth.signOut()
            useAuthStore.getState().logout()
            try { localStorage.clear(); sessionStorage.clear() } catch {}
          } catch {}
        }
        const { data: { session } } = await supabase.auth.getSession()
        const currentUser = session?.user ?? null
        setAuth(currentUser, session)

        // Resolve mismatched persisted auth vs current session (prevents ghost auto-login)
        try {
          const persisted = localStorage.getItem('troll-city-auth-user')
          if (persisted) {
            const parsed = JSON.parse(persisted)
            const persistedId = parsed?.id
            const sessionId = currentUser?.id
            if (persistedId && sessionId && persistedId !== sessionId) {
              useAuthStore.getState().logout()
              setAuth(currentUser, session)
            }
          }
        } catch {}

        if (session?.user) {
          // Always check if this is an admin email FIRST and set profile immediately
          const isAdmin = isAdminEmail(session.user.email)
          
          console.log('=== APP.TSX SESSION INIT ===')
          console.log('Email:', session.user.email)
          console.log('Is admin email:', isAdmin)
          console.log('User ID:', session.user.id)
          
          // If admin email, load cached profile first to prevent flash, then fetch from backend
          if (isAdmin) {
            try {
              // Load from localStorage immediately to prevent flash
              const cachedProfile = localStorage.getItem('admin-profile-cache')
              if (cachedProfile) {
                try {
                  const parsed = JSON.parse(cachedProfile)
                  if (parsed.id === session.user.id) {
                    console.log('Setting cached admin profile to prevent flash')
                    setProfile(parsed)
                    setIsAdmin(true)
                  }
                } catch {}
              }

              const { data: { session: currentSession } } = await supabase.auth.getSession()
              const token = currentSession?.access_token
              
              if (token) {
                const response = await fetch(API_ENDPOINTS.auth.fixAdminRole, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                })
                const result = await response.json()
                console.log('Fix admin role result:', result)
                
                if (result.success && result.profile) {
                  console.log('Setting admin profile from backend:', result.profile)
                  setProfile(result.profile)
                  setIsAdmin(true)
                  // Cache the profile for next time
                  try {
                    localStorage.setItem('admin-profile-cache', JSON.stringify(result.profile))
                  } catch {}
                  setLoading(false)
                  return
                }
              }
            } catch (err) {
              console.error('Failed to fix admin role:', err)
            }
          }
          
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()
            
          console.log('Profile from DB:', profileData)

          if (!profileData) {
            let tries = 0
            let prof: any = null
            while (tries < 3 && !prof) {
              const { data: p } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle()
              if (p) prof = p
              else {
                await new Promise(r => setTimeout(r, 500))
                tries++
              }
            }
            
            // Set admin role if applicable
            if (prof && isAdmin && prof.role !== 'admin') {
              console.log('Updating role to admin for retry path')
              const { data: updated, error: updateError } = await supabase
                .from('user_profiles')
                .update({ role: 'admin', updated_at: new Date().toISOString() })
                .eq('id', session.user.id)
                .select('*')
                .single()
              console.log('Update result:', updated, 'Error:', updateError)
              setProfile(updated || prof)
              if (updated) setIsAdmin(true)
            } else {
              setProfile(prof || null)
            }
          } else {
            // Check if admin BEFORE setting profile to avoid flash
            if (isAdmin && profileData.role !== 'admin') {
              console.log('Updating role to admin (profile exists)')
              const { data: updated, error: updateError } = await supabase
                .from('user_profiles')
                .update({ role: 'admin', updated_at: new Date().toISOString() })
                .eq('id', session.user.id)
                .select('*')
                .single()
              console.log('Update result:', updated, 'Error:', updateError)
              setProfile(updated || profileData)
              if (updated) setIsAdmin(true)
            } else {
              console.log('Setting profile with role:', profileData.role)
              setProfile(profileData)
              if (profileData.role === 'admin') setIsAdmin(true)
            }
          }
        } else {
          setProfile(null)
        }
      } catch {}
      finally {
        setLoading(false)
      }
    }
    initializeAuth()
    return () => { isMounted = false }
  }, [setAuth, setProfile, setLoading])

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    const handleInstalled = () => {
      try { localStorage.setItem('pwa-installed', 'true') } catch {}
      setInstalled(true)
      setInstallPrompt(null)
      toast.success('App installed')
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall as any)
    window.addEventListener('appinstalled', handleInstalled as any)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall as any)
      window.removeEventListener('appinstalled', handleInstalled as any)
    }
  }, [])

  const handleProfileSetup = async (username: string, bio?: string) => {
    if (!user) return
    const uname = String(username || '').trim()
    if (!/^[a-zA-Z0-9_]{2,20}$/.test(uname)) { toast.error('Use 2–20 letters, numbers, or underscores'); return }
    setProfileModalLoading(true)
    try {
      if (profile?.username !== uname) {
        const { data: existing } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('username', uname)
          .neq('id', user.id)
          .maybeSingle()
        if (existing) { toast.error('Username is taken'); setProfileModalLoading(false); return }
      }

      const now = new Date().toISOString()
      const { data: updated, error } = await supabase
        .from('user_profiles')
        .update({ username: uname, bio: bio || null, updated_at: now })
        .eq('id', user.id)
        .select('*')
        .single()
      if (error) { toast.error(error.message || 'Failed to save profile'); return }

      if (updated) {
        if (isAdminEmail(user.email) && updated.role !== 'admin') {
          const { data: updAdmin } = await supabase
            .from('user_profiles')
            .update({ role: 'admin', updated_at: new Date().toISOString() })
            .eq('id', user.id)
            .select('*')
            .single()
          setProfile(updAdmin || updated)
        } else {
          setProfile(updated)
        }
        toast.success('Profile updated')
        setProfileModalOpen(false)
      }
    } catch (e: any) {
      toast.error(e?.message || 'Unexpected error')
    } finally {
      setProfileModalLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="flex min-h-screen">
        {user && <Sidebar />}
        <div className="flex-1 flex flex-col min-h-screen">
          {user && <Header />}

          <main className="flex-1 overflow-y-auto bg-[#121212]">
            <Routes>
              <Route element={<RequireAuth />}>

                <Route path="/" element={<Home />} />
                <Route path="/go-live" element={<GoLive />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/trollifications" element={<Trollifications />} />
                <Route path="/stream/:id/summary" element={<StreamSummary />} />
                <Route path="/following" element={<Following />} />
                <Route path="/stream/:streamId" element={<StreamRoom />} />

                <Route path="/store" element={<CoinStore />} />

                <Route path="/profile/setup" element={<ProfileSetup />} />
                <Route path="/profile/id/:userId" element={<Profile />} />
                <Route path="/profile/:username" element={<Profile />} />
                <Route path="/account/wallet" element={<AccountWallet />} />
                <Route path="/account/payments/success" element={<AccountPaymentsSuccess />} />
                <Route path="/account/payment-linked-success" element={<AccountPaymentLinkedSuccess />} />

                <Route path="/apply" element={<Application />} />
                <Route path="/apply/officer" element={<OfficerApplication />} />
                <Route path="/apply/troller" element={<TrollerApplication />} />
                <Route path="/apply/family" element={<FamilyApplication />} />

                <Route element={<FamilyAccessRoute />}>
                  <Route path="/family" element={<TrollFamily />} />
                  <Route path="/family/city" element={<TrollFamilyCity />} />
                  <Route path="/family/city-map" element={<FamilyCityMap />} />
                  <Route path="/family/profile" element={<FamilyProfilePage />} />
                  <Route path="/family/wars" element={<FamilyWarsPage />} />
                  <Route path="/family/chat" element={<FamilyChatPage />} />
                </Route>
                <Route path="/leaderboard" element={<Leaderboard />} />

                <Route path="/wheel" element={<TrollWheel />} />
                <Route path="/rfc" element={<AdminRFC />} />
                <Route path="/insurance" element={<TrollerInsurance />} />
                <Route path="/cashouts" element={<Cashouts />} />
                <Route path="/earnings" element={<EarningsPayout />} />
                <Route path="/support" element={<Support />} />
                <Route path="/transactions" element={<TransactionHistory />} />

                <Route
                  path="/officer/lounge"
                  element={
                    (useAuthStore.getState().profile?.role === 'troll_officer' || useAuthStore.getState().profile?.role === 'admin')
                      ? <TrollOfficerLounge />
                      : <Navigate to="/" replace />
                  }
                />

                <Route
                  path="/admin"
                  element={
                    profile?.role === 'admin' || isAdminEmail(user?.email)
                      ? <AdminDashboard />
                      : <Navigate to="/" replace />
                  }
                />

                <Route
                  path="/changelog"
                  element={
                    profile?.role === 'admin'
                      ? <Changelog />
                      : <Navigate to="/" replace />
                  }
                />

              </Route>

              <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/terms" element={<TermsAgreement />} />

              {/* 🛠 FIX: Always redirect unknown URLs to HOME, not back to /auth */}
              <Route path="*" element={<Navigate to="/" replace />} />

              </Routes>

              {user && installPrompt && !installed && (
                <div className="fixed bottom-4 right-4 z-50">
                  <button
                    className="px-4 py-2 rounded-full bg-[#22c55e] text-black shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                    onClick={async () => {
                      try {
                        await installPrompt.prompt()
                        const choice = await installPrompt.userChoice
                        if (choice?.outcome === 'accepted') {
                          try { localStorage.setItem('pwa-installed', 'true') } catch {}
                          setInstalled(true)
                          setInstallPrompt(null)
                        }
                      } catch {}
                    }}
                  >
                    Install App
                  </button>
                </div>
              )}
          </main>
          {location.pathname === '/' && (
            <div className="pointer-events-none fixed inset-0 z-0">
              {Array.from({ length: 16 }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    top: -40,
                    left: `${(i * 7) % 100}%`,
                    fontSize: '12px',
                    animation: 'fallTroll 10s linear infinite',
                    animationDelay: `${(i % 8) * 0.8}s`,
                    color: i % 2 === 0 ? '#22c55e' : '#ef4444'
                  }}
                >
                  👹
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <ProfileSetupModal
        isOpen={profileModalOpen}
        onSubmit={handleProfileSetup}
        loading={profileModalLoading}
        onClose={() => setProfileModalOpen(false)}
      />

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#2e1065',
            color: '#fff',
            border: '1px solid #22c55e',
            boxShadow: '0 0 15px rgba(34, 197, 94, 0.5)',
          }
        }}
      />
    </div>
  )
}

export default App
