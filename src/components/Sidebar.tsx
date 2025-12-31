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
   Sword,
   UserPlus,
   Bug,
   Store,
   Crown,
   Trophy,
   FerrisWheel,
   MessageCircle,
   Package,
   Scale,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from 'lucide-react'

import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function Sidebar() {
  const { profile, user } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const isActive = (path: string) => location.pathname === path

  const badge =
    profile?.role === 'admin'
      ? 'Admin'
      : profile?.tier && ['gold', 'platinum', 'diamond'].includes(profile.tier)
      ? profile.tier.charAt(0).toUpperCase() + profile.tier.slice(1)
      : null

  const [canSeeOfficer, setCanSeeOfficer] = useState(false)
  const [canSeeFamilyLounge, setCanSeeFamilyLounge] = useState(false)
  const [showCourtModal, setShowCourtModal] = useState(false)
  const [showStatsPanel, setShowStatsPanel] = useState(false)
  const [trollFamiliesCollapsed, setTrollFamiliesCollapsed] = useState(false)
  const [leadOfficerCollapsed, setLeadOfficerCollapsed] = useState(false)
  const [adminControlsCollapsed, setAdminControlsCollapsed] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Role logic for Go Live access
  const canGoLive =
    profile?.role === "admin" ||
    profile?.role === "lead_troll_officer" ||
    profile?.role === "troll_officer" ||
    profile?.is_broadcaster ||
    profile?.is_lead_officer;

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
    <div
      className={`min-h-screen bg-[#0A0A14] text-white flex flex-col border-r border-[#2C2C2C] shadow-xl transition-all duration-300 ${
        isSidebarCollapsed ? 'w-20' : 'w-64'
      }`}
    >

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
            className="flex items-center gap-2 bg-[#1C1C24] px-3 py-2 rounded-lg border border-green-500/40 text-green-300 cursor-pointer hover:bg-[#252530] transition-colors"
          >
            <span className="text-sm font-semibold">Troll Coins</span>
          </div>

          {/* GIFT STORE */}
          <div
            onClick={() => navigate("/gift-store")}
            className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 px-3 py-2 rounded-lg border border-yellow-500/40 text-yellow-300 cursor-pointer hover:border-yellow-300 transition-colors"
          >
            <Gift className="w-5 h-5 text-yellow-400" />
            <span className="text-sm font-semibold">Gift Store</span>
          </div>
        </div>
      </div>
      <div className="flex justify-end px-3 mt-1">
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed((prev) => !prev)}
          className="p-2 rounded-full hover:bg-white/10 transition text-gray-400"
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
      {/* Main Menu */}
      <nav
        className={`flex-1 flex flex-col gap-1 p-4 transition-all ${
          isSidebarCollapsed ? 'items-center' : ''
        }`}
      >
        <MenuLink
          to="/"
          icon={<Home className="w-5 h-5 text-green-400" />}
          label="Home"
          active={isActive('/')}
          collapsed={isSidebarCollapsed}
        />
        <MenuLink
          to="/messages"
          icon={<MessageSquare className="w-5 h-5 text-blue-400" />}
          label="Messages"
          active={isActive('/messages')}
          collapsed={isSidebarCollapsed}
        />
        <MenuLink
          to="/following"
          icon={<UserCheck className="w-5 h-5 text-indigo-400" />}
          label="Following"
          active={isActive('/following')}
          collapsed={isSidebarCollapsed}
        />
        <Link
          to="/trolls-night"
          className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2 transition ${
            isActive('/trolls-night')
              ? 'border-yellow-400/80 bg-gradient-to-r from-red-600/30 to-black text-white shadow-[0_0_20px_rgba(255,0,48,0.65)]'
              : 'border-yellow-300/40 bg-gradient-to-r from-red-500/20 to-black text-white/80 hover:border-yellow-300/60'
          }`}
        >
          <Shield className="w-5 h-5 text-yellow-300" />
          {!isSidebarCollapsed && (
            <span
              style={{ textShadow: '0 0 8px #ff3048, 0 0 16px #ffd65c' }}
              className="flex-1 text-left text-xs font-black uppercase tracking-[0.5em] text-[#ff3159]"
            >
              TROLLS@NIGHT
            </span>
          )}
        </Link>
        <MenuLink
          to="/store"
          icon={<Coins className="w-5 h-5 text-yellow-500" />}
          label="Coin Store"
          active={isActive('/store')}
          collapsed={isSidebarCollapsed}
        />
        <MenuLink
          to="/marketplace"
          icon={<Store className="w-5 h-5 text-orange-500" />}
          label="Marketplace"
          active={isActive('/marketplace')}
          collapsed={isSidebarCollapsed}
        />
        <MenuLink
          to="/inventory"
          icon={<Package className="w-5 h-5 text-cyan-500" />}
          label="My Inventory"
          active={isActive('/inventory')}
          collapsed={isSidebarCollapsed}
        />
        <MenuLink
          to="/sell"
          icon={<Store className="w-5 h-5 text-emerald-500" />}
          label="Sell on Troll City"
          active={isActive('/sell')}
          collapsed={isSidebarCollapsed}
        />

        <MenuLink
          to="/leaderboard"
          icon={<Trophy className="w-5 h-5 text-yellow-500" />}
          label="Leaderboard"
          active={isActive('/leaderboard')}
          collapsed={isSidebarCollapsed}
        />
        <MenuLink
          to="/wall"
          icon={<MessageCircle className="w-5 h-5 text-cyan-400" />}
          label="Troll City Wall"
          active={isActive('/wall')}
          collapsed={isSidebarCollapsed}
        />

        <button
          onClick={() => navigate('/troll-court')}
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
        <button
          type="button"
          onClick={() => toast('Empire Partner program is under construction', { icon: '🚧' })}
          className="flex items-center gap-3 px-4 py-2 rounded-lg transition w-full text-left hover:bg-[#1F1F2E] text-gray-300"
        >
          <UserPlus className="w-5 h-5 text-green-400" />
          Empire Partner
        </button>
        <button
          type="button"
          onClick={() => toast('Troll Wheel is under construction', { icon: '🚧' })}
          className="flex items-center gap-3 px-4 py-2 rounded-lg transition w-full text-left hover:bg-[#1F1F2E] text-gray-300"
        >
          <FerrisWheel className="w-5 h-5 text-pink-500" />
          Troll Wheel
        </button>
        
        {/* Applications - Show for everyone */}
        <MenuLink
          to="/apply"
          icon={<FileText className="w-5 h-5 text-slate-400" />}
          label="Applications"
          active={isActive('/apply')}
          collapsed={isSidebarCollapsed}
        />

        {/* Troll Officer Lounge - Only for admin and troll_officer role */}
        {canSeeOfficer && (
          <>
            <MenuLink
              to="/officer/lounge"
              icon={<Shield className="w-5 h-5 text-red-500" />}
              label="Officer Lounge"
              active={isActive('/officer/lounge')}
              collapsed={isSidebarCollapsed}
            />
            <MenuLink
              to="/officer/moderation"
              icon={<Shield className="w-5 h-5 text-orange-500" />}
              label="Officer Moderation"
              active={isActive('/officer/moderation')}
              collapsed={isSidebarCollapsed}
            />
          </>
        )}

        {/* Troll Family Lounge - Only for admin, troll_officer, OR approved family app */}
        {canSeeFamilyLounge && (
          <>
            <MenuLink
              to="/family"
              icon={<Users className="w-5 h-5 text-cyan-400" />}
              label="Troll Family Lounge"
              active={isActive('/family')}
              collapsed={isSidebarCollapsed}
            />

            {/* Troll Families Section */}
            <div className="mt-4">
              <button
                onClick={() => setTrollFamiliesCollapsed(!trollFamiliesCollapsed)}
                className="flex items-center justify-between w-full text-gray-500 uppercase text-xs mb-2 px-4 hover:text-gray-400 transition-colors"
                title="Toggle Troll Families"
              >
                {!isSidebarCollapsed && <span>Troll Families</span>}
                {trollFamiliesCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              {!trollFamiliesCollapsed && (
                <>
                  <MenuLink
                    to="/family/lounge"
                    icon={<Crown className="w-5 h-5 text-purple-400" />}
                    label="Family Lounge"
                    active={isActive('/family/lounge')}
                    collapsed={isSidebarCollapsed}
                  />
                  <MenuLink
                    to="/family/wars-hub"
                    icon={<Sword className="w-5 h-5 text-red-400" />}
                    label="Family War Hub"
                    active={isActive('/family/wars-hub')}
                    collapsed={isSidebarCollapsed}
                  />
                  <MenuLink
                    to="/family/leaderboard"
                    icon={<Trophy className="w-5 h-5 text-yellow-400" />}
                    label="Family Leaderboard"
                    active={isActive('/family/leaderboard')}
                    collapsed={isSidebarCollapsed}
                  />
                  <MenuLink
                    to="/family/shop"
                    icon={<Coins className="w-5 h-5 text-green-400" />}
                    label="Family Shop"
                    active={isActive('/family/shop')}
                    collapsed={isSidebarCollapsed}
                  />
                </>
              )}
            </div>
          </>
        )}

        <MenuLink
          to="/support"
          icon={<FileText className="w-5 h-5 text-gray-400" />}
          label="Support"
          active={isActive('/support')}
          collapsed={isSidebarCollapsed}
        />
        <MenuLink
          to="/safety"
          icon={<Shield className="w-5 h-5 text-red-400" />}
          label="Safety & Policies"
          active={isActive('/safety')}
          collapsed={isSidebarCollapsed}
        />

        {/* 🔐 RFC — Only Admin */}
        {profile?.role === 'admin' && (
          <MenuLink
            to="/rfc"
            icon={<Shield className="w-5 h-5 text-purple-500" />}
            label="RFC"
            active={isActive('/rfc')}
            collapsed={isSidebarCollapsed}
          />
        )}

        {/* Admin Earnings Dashboard — Only Admin */}
        {profile?.role === 'admin' && (
          <MenuLink
            to="/admin/earnings"
            icon={<Banknote className="w-5 h-5 text-green-500" />}
            label="Earnings Dashboard"
            active={isActive('/admin/earnings')}
            collapsed={isSidebarCollapsed}
          />
        )}
      </nav>

      {/* Lead Officer Section — Lead Officers and Admins */}
      {profile?.is_lead_officer && (
        <div className="p-4 border-t border-[#2C2C2C]">
          <button
            onClick={() => setLeadOfficerCollapsed(!leadOfficerCollapsed)}
            className="flex items-center justify-between w-full text-gray-500 uppercase text-xs mb-2 hover:text-gray-400 transition-colors"
            title="Toggle Lead Officer links"
          >
            {!isSidebarCollapsed && <span>Lead Officer</span>}
            {leadOfficerCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          {!leadOfficerCollapsed && (
            <MenuLink
              to="/lead-officer"
              icon={<Shield className="w-5 h-5 text-amber-500" />}
              label="Lead Officer HQ"
              active={isActive('/lead-officer')}
              collapsed={isSidebarCollapsed}
            />
          )}
        </div>
      )}

      {/* Admin Dashboard — Only Admin */}
      {profile?.role === 'admin' && (
        <div className="p-4 border-t border-[#2C2C2C]">
          <button
            onClick={() => setAdminControlsCollapsed(!adminControlsCollapsed)}
            className="flex items-center justify-between w-full text-gray-500 uppercase text-xs mb-2 hover:text-gray-400 transition-colors"
            title="Toggle Admin controls"
          >
            {!isSidebarCollapsed && <span>Admin Controls</span>}
            {adminControlsCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          {!adminControlsCollapsed && (
            <>
              <MenuLink
                to="/admin"
                icon={<LayoutDashboard className="w-5 h-5 text-violet-500" />}
                label="Admin Dashboard"
                active={isActive('/admin')}
                collapsed={isSidebarCollapsed}
              />
              <MenuLink
                to="/admin/applications"
                icon={<UserPlus className="w-5 h-5 text-blue-500" />}
                label="Applications"
                active={isActive('/admin/applications')}
                collapsed={isSidebarCollapsed}
              />
              <MenuLink
                to="/admin/marketplace"
                icon={<Store className="w-5 h-5 text-orange-500" />}
                label="Marketplace Admin"
                active={isActive('/admin/marketplace')}
                collapsed={isSidebarCollapsed}
              />
              <MenuLink
                to="/admin/officer-reports"
                icon={<FileText className="w-5 h-5 text-teal-500" />}
                label="Officer Reports"
                active={isActive('/admin/officer-reports')}
                collapsed={isSidebarCollapsed}
              />
              <MenuLink
                to="/store-debug"
                icon={<Bug className="w-5 h-5 text-red-600" />}
                label="Store Debug"
                active={isActive('/store-debug')}
                collapsed={isSidebarCollapsed}
              />
              <MenuLink
                to="/changelog"
                icon={<ListChecks className="w-5 h-5 text-lime-500" />}
                label="Updates & Changes"
                active={isActive('/changelog')}
                collapsed={isSidebarCollapsed}
              />
              <MenuLink
                to="/admin/royal-family"
                icon={<Crown className="w-5 h-5 text-yellow-500" />}
                label="Royal Family"
                active={isActive('/admin/royal-family')}
                collapsed={isSidebarCollapsed}
              />
            </>
          )}
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

interface MenuLinkProps {
  to: string
  icon: React.ReactNode
  label: string
  active: boolean
  collapsed?: boolean
}

function MenuLink({ to, icon, label, active, collapsed = false }: MenuLinkProps) {
  const activeClasses = active
    ? 'bg-purple-600 text-white border border-purple-400'
    : 'hover:bg-[#1F1F2E] text-gray-300 border-transparent'

  const layoutClasses = collapsed ? 'justify-center gap-0 px-2 py-3' : 'gap-3 px-4 py-2'

  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className={`flex w-full items-center rounded-lg transition ${activeClasses} ${layoutClasses}`}
    >
      <span className={`w-5 h-5 ${active ? 'text-white' : ''}`}>{icon}</span>
      {!collapsed && <span className="flex-1 text-left">{label}</span>}
    </Link>
  )
}


