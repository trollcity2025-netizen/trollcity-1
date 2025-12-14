 import React, { useEffect, useState } from 'react'
 import { Link, useLocation, useNavigate } from 'react-router-dom'
 import CourtEntryModal from './CourtEntryModal'
 import ExpandedStatsPanel from './ExpandedStatsPanel'
 import {
   Home,
   MessageSquare,
   Radio,
   Gift,
   Coins,
   Users,
   Shield,
   LayoutDashboard,
   Banknote,
   FileText,
   UserCheck,
   ListChecks,
   Receipt,
   Sword,
   UserPlus,
   Bug,
   Store,
   Crown,
   Mic,
   Trophy,
   FerrisWheel,
   MessageCircle,
   Headphones,
   Package,
   Scale,
 } from 'lucide-react'
 import { useAuthStore } from '../lib/store'
 import { supabase, isAdminEmail } from '../lib/supabase'

export default function Sidebar() {
  const { profile, user } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const isActive = (path: string) => location.pathname === path

  // Real-time wallet state
  const [walletData, setWalletData] = useState({
    paid_coins: profile?.paid_coin_balance || 0,
    trollmonds: profile?.free_coin_balance || 0,
  })

  const badge =
    profile?.role === 'admin'
      ? '🛡️'
      : profile?.tier && ['gold', 'platinum', 'diamond'].includes(profile.tier)
      ? '⭐'
      : null

  const [canSeeOfficer, setCanSeeOfficer] = useState(false)
  const [canSeeFamilyLounge, setCanSeeFamilyLounge] = useState(false)
  const [showCourtModal, setShowCourtModal] = useState(false)
  const [showStatsPanel, setShowStatsPanel] = useState(false)
  const isAdmin = profile?.role === 'admin'

  // Role logic for Go Live access
  const canGoLive =
    profile?.role === "admin" ||
    profile?.role === "lead_troll_officer" ||
    profile?.role === "troll_officer" ||
    profile?.is_broadcaster ||
    profile?.is_lead_officer;

  // Real-time wallet updates
  useEffect(() => {
    if (!profile) return

    setWalletData({
      paid_coins: profile.paid_coin_balance || 0,
      trollmonds: profile.free_coin_balance || 0,
    })

    // Realtime Supabase listener for profile updates
    const channel = supabase
      .channel("wallet_updates_sidebar")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_profiles",
          filter: `id=eq.${profile.id}`,
        },
        (payload) => {
          if (payload.new) {
            const profileData = payload.new as any
            setWalletData({
              paid_coins: profileData.paid_coin_balance || 0,
              trollmonds: profileData.free_coin_balance || 0,
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id, profile?.paid_coin_balance, profile?.free_coin_balance])

  useEffect(() => {
    const checkAccess = async () => {
      if (!profile) { 
        setCanSeeOfficer(false)
        setCanSeeFamilyLounge(false)
        return 
      }
      
      const isAdmin = profile.role === 'admin'
      const isOfficer = profile.role === 'troll_officer'
      
      // Troll Officer Lounge: Only admin and troll_officer role
      setCanSeeOfficer(isAdmin || isOfficer)

      // Troll Family Lounge: Admin, troll_officer, OR approved family application
      if (isAdmin || isOfficer) { 
        setCanSeeFamilyLounge(true)
        return 
      }
      
      // Check if user has an approved family application
      try {
        const { data: familyApp } = await supabase
          .from('applications')
          .select('status')
          .eq('user_id', profile.id)
          .eq('type', 'troll_family')
          .eq('status', 'approved')
          .maybeSingle()

        setCanSeeFamilyLounge(!!familyApp)
      } catch {
        setCanSeeFamilyLounge(false)
      }
    }
    checkAccess()
  }, [profile?.id, profile?.role])

  if (!user) return null

  return (
    <div className="w-64 min-h-screen bg-[#0A0A14] text-white flex flex-col border-r border-[#2C2C2C] shadow-xl">

      {/* Profile Block with Real-time Wallet */}
      <div className="p-5 text-center border-b border-[#2C2C2C]">
        <div className="w-20 h-20 mx-auto rounded-full overflow-hidden border-4 border-purple-500 shadow-lg">
          <img
            src={
              profile?.avatar_url ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.username || 'user'}`
            }
            alt="avatar"
            className="w-full h-full object-cover"
          />
        </div>

        <button
          onClick={() => setShowStatsPanel(true)}
          className="mt-3 font-bold text-lg flex items-center justify-center gap-2 hover:text-purple-300 transition-colors cursor-pointer"
        >
          @{profile?.username || 'Guest'}
          {badge && <span className="text-yellow-400">{badge}</span>}
        </button>

        <p className="text-xs text-gray-400">
          {profile?.role === 'admin' ? 'Admin' : profile?.role === 'troll_officer' ? 'Troll Officer' : 'Member'}
        </p>

        {/* Go Live Button - Under username */}
        {canGoLive && (
          <button
            onClick={() => navigate("/go-live")}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold shadow-lg border border-red-500"
          >
            <Radio className="w-4 h-4" />
            Go Live
          </button>
        )}

        {/* Real-time Wallet Section */}
        <div className="mt-4 space-y-2">
          {/* TROLL COINS */}
          <div
            onClick={() => navigate("/earnings")}
            className="flex items-center justify-between bg-[#1C1C24] px-3 py-2 rounded-lg border border-green-500/40 text-green-300 cursor-pointer hover:bg-[#252530] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">💰</span>
              <span className="text-sm font-semibold">Troll Coins</span>
            </div>
            <span className="font-bold">
              {walletData.paid_coins?.toLocaleString() ?? 0}
            </span>
          </div>

          {/* TROLLMONDS */}
          <div
            onClick={() => navigate("/trollmonds-store")}
            className="flex items-center justify-between bg-[#1C1C24] px-3 py-2 rounded-lg border border-green-500/40 text-green-300 cursor-pointer hover:bg-[#252530] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">💎</span>
              <span className="text-sm font-semibold">Trollmonds</span>
            </div>
            <span className="font-bold">
              {walletData.trollmonds?.toLocaleString() ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Main Menu */}
      <nav className="flex-1 p-4 space-y-1">
        <MenuLink to="/" icon={<Home className="w-5 h-5 text-green-400" />} label="Home" active={isActive('/')} />
        <MenuLink to="/messages" icon={<MessageSquare className="w-5 h-5 text-blue-400" />} label="Messages" active={isActive('/messages')} />
        <MenuLink to="/following" icon={<UserCheck className="w-5 h-5 text-indigo-400" />} label="Following" active={isActive('/following')} />
        <MenuLink to="/store" icon={<Coins className="w-5 h-5 text-yellow-500" />} label="Coin Store" active={isActive('/store')} />
        <MenuLink to="/marketplace" icon={<Store className="w-5 h-5 text-orange-500" />} label="Marketplace" active={isActive('/marketplace')} />
        <MenuLink to="/inventory" icon={<Package className="w-5 h-5 text-cyan-500" />} label="My Inventory" active={isActive('/inventory')} />
        <MenuLink to="/sell" icon={<Store className="w-5 h-5 text-emerald-500" />} label="Sell on Troll City" active={isActive('/sell')} />

        <MenuLink to="/leaderboard" icon={<Trophy className="w-5 h-5 text-yellow-500" />} label="Leaderboard" active={isActive('/leaderboard')} />
        <MenuLink to="/wall" icon={<MessageCircle className="w-5 h-5 text-cyan-400" />} label="Troll City Wall" active={isActive('/wall')} />

        <MenuLink to="/tromody" icon={<Mic className="w-5 h-5 text-purple-400" />} label="Tromody Show" active={isActive('/tromody')} />
        <button
          onClick={() => setShowCourtModal(true)}
          className={`flex items-center gap-3 px-4 py-2 rounded-lg transition w-full text-left ${
            isActive('/troll-court') || isActive('/court-room')
              ? 'bg-purple-600 text-white border border-purple-400'
              : 'hover:bg-[#1F1F2E] text-gray-300'
          }`}
        >
          <span className={`w-5 h-5 ${isActive('/troll-court') || isActive('/court-room') ? 'text-white' : ''}`}>
            <Scale className="w-5 h-5 text-red-400" />
          </span>
          <span>Troll Court</span>
        </button>
        <MenuLink to="/empire-partner" icon={<UserPlus className="w-5 h-5 text-green-400" />} label="Empire Partner" active={isActive('/empire-partner')} />
        <MenuLink to="/troll-wheel" icon={<FerrisWheel className="w-5 h-5 text-pink-500" />} label="Troll Wheel" active={isActive('/troll-wheel')} />
        
        {/* Applications - Show for everyone */}
        <MenuLink to="/apply" icon={<FileText className="w-5 h-5 text-slate-400" />} label="Applications" active={isActive('/apply')} />

        {/* Troll Officer Lounge - Only for admin and troll_officer role */}
        {canSeeOfficer && (
          <>
            <MenuLink to="/officer/lounge" icon={<Shield className="w-5 h-5 text-red-500" />} label="Officer Lounge" active={isActive('/officer/lounge')} />
            <MenuLink to="/officer/moderation" icon={<Shield className="w-5 h-5 text-orange-500" />} label="Officer Moderation" active={isActive('/officer/moderation')} />
          </>
        )}

        {/* Troll Family Lounge - Only for admin, troll_officer, OR approved family app */}
        {canSeeFamilyLounge && (
          <>
            <MenuLink to="/family" icon={<Users className="w-5 h-5 text-cyan-400" />} label="Troll Family Lounge" active={isActive('/family')} />

            {/* Troll Families Section */}
            <div className="mt-4">
              <p className="text-gray-500 uppercase text-xs mb-2 px-4">Troll Families</p>
              <MenuLink to="/family/lounge" icon={<Crown className="w-5 h-5 text-purple-400" />} label="Family Lounge" active={isActive('/family/lounge')} />
              <MenuLink to="/family/wars-hub" icon={<Sword className="w-5 h-5 text-red-400" />} label="Family War Hub" active={isActive('/family/wars-hub')} />
              <MenuLink to="/family/leaderboard" icon={<Trophy className="w-5 h-5 text-yellow-400" />} label="Family Leaderboard" active={isActive('/family/leaderboard')} />
              <MenuLink to="/family/shop" icon={<Coins className="w-5 h-5 text-green-400" />} label="Family Shop" active={isActive('/family/shop')} />
            </div>
          </>
        )}

        <MenuLink to="/support" icon={<FileText className="w-5 h-5 text-gray-400" />} label="Support" active={isActive('/support')} />
        <MenuLink to="/safety" icon={<Shield className="w-5 h-5 text-red-400" />} label="Safety & Policies" active={isActive('/safety')} />

        {/* 🔐 RFC — Only Admin */}
        {profile?.role === 'admin' && (
          <MenuLink to="/rfc" icon={<Shield className="w-5 h-5 text-purple-500" />} label="RFC" active={isActive('/rfc')} />
        )}

        {/* Admin Earnings Dashboard — Only Admin */}
        {profile?.role === 'admin' && (
          <MenuLink to="/admin/earnings" icon={<Banknote className="w-5 h-5 text-green-500" />} label="Earnings Dashboard" active={isActive('/admin/earnings')} />
        )}
      </nav>

      {/* Lead Officer Section — Lead Officers and Admins */}
      {profile?.is_lead_officer && (
        <div className="p-4 border-t border-[#2C2C2C]">
          <p className="text-gray-500 uppercase text-xs mb-2">Lead Officer</p>
          <MenuLink to="/lead-officer" icon={<Shield className="w-5 h-5 text-amber-500" />} label="Lead Officer HQ" active={isActive('/lead-officer')} />
        </div>
      )}

      {/* Admin Dashboard — Only Admin */}
      {profile?.role === 'admin' && (
        <div className="p-4 border-t border-[#2C2C2C]">
          <p className="text-gray-500 uppercase text-xs mb-2">Admin Controls</p>
          <MenuLink to="/admin" icon={<LayoutDashboard className="w-5 h-5 text-violet-500" />} label="Admin Dashboard" active={isActive('/admin')} />
          <MenuLink to="/admin/applications" icon={<UserPlus className="w-5 h-5 text-blue-500" />} label="Applications" active={isActive('/admin/applications')} />
          <MenuLink to="/admin/marketplace" icon={<Store className="w-5 h-5 text-orange-500" />} label="Marketplace Admin" active={isActive('/admin/marketplace')} />
          <MenuLink to="/admin/officer-reports" icon={<FileText className="w-5 h-5 text-teal-500" />} label="Officer Reports" active={isActive('/admin/officer-reports')} />
          <MenuLink to="/store-debug" icon={<Bug className="w-5 h-5 text-red-600" />} label="Store Debug" active={isActive('/store-debug')} />
          <MenuLink to="/changelog" icon={<ListChecks className="w-5 h-5 text-lime-500" />} label="Updates & Changes" active={isActive('/changelog')} />
          <MenuLink to="/admin/royal-family" icon={<Crown className="w-5 h-5 text-yellow-500" />} label="Royal Family" active={isActive('/admin/royal-family')} />
        </div>
      )}

      {/* Court Entry Modal */}
      <CourtEntryModal
        isOpen={showCourtModal}
        onClose={() => setShowCourtModal(false)}
      />

      {/* Expanded Stats Panel */}
      <ExpandedStatsPanel
        isOpen={showStatsPanel}
        onClose={() => setShowStatsPanel(false)}
      />
    </div>
  )
}

function MenuLink({ to, icon, label, active }: any) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
        active
          ? 'bg-purple-600 text-white border border-purple-400'
          : 'hover:bg-[#1F1F2E] text-gray-300'
      }`}
    >
      <span className={`w-5 h-5 ${active ? 'text-white' : ''}`}>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
