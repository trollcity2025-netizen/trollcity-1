import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import CourtEntryModal from './CourtEntryModal'
import ExpandedStatsPanel from './ExpandedStatsPanel'
import SidebarGroup from './ui/SidebarGroup'
import {
  Home,
  MessageSquare,
  Radio,
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
  ChevronLeft,
  ChevronRight,
  LifeBuoy
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
      const isOfficer = profile.role === 'troll_officer' || profile.role === 'lead_troll_officer' || profile.is_lead_officer
      
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
  }, [profile])

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
          className={`mt-3 font-bold text-lg flex items-center justify-center gap-2 hover:text-purple-300 transition-colors cursor-pointer ${
            profile?.rgb_username_expires_at && new Date(profile.rgb_username_expires_at) > new Date()
              ? 'rgb-username'
              : ''
          }`}
        >
          @{profile?.username || 'Guest'}
          {badge && <span className="text-yellow-400">{badge}</span>}
        </button>

        <p className="text-xs text-gray-400">
          {(profile?.troll_role === 'admin' || profile?.role === 'admin') ? 'Admin' : (profile?.troll_role === 'troll_officer' || profile?.role === 'troll_officer') ? 'Troll Officer' : 'Member'}
        </p>

        {/* Go Live Button - Under username */}
        {canGoLive && (
          <button
            onClick={() => navigate("/go-live")}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold shadow-lg border border-red-500"
          >
            <Radio className="w-4 h-4" />
            {!isSidebarCollapsed && "Go Live"}
          </button>
        )}

        {/* Real-time Wallet Section */}
        <div className="mt-4 space-y-2">
          {/* TROLL COINS */}
          <div
            onClick={() => navigate("/earnings")}
            className="flex items-center gap-2 bg-[#1C1C24] px-3 py-2 rounded-lg border border-green-500/40 text-green-300 cursor-pointer hover:bg-[#252530] transition-colors justify-center"
          >
            <Coins className="w-4 h-4" />
            {!isSidebarCollapsed && <span className="text-sm font-semibold">Troll Coins</span>}
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

      {/* Scrollable Nav Area */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        
        {/* MAIN GROUP */}
        <SidebarGroup title="Main" defaultExpanded={true} isCollapsed={isSidebarCollapsed}>
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
            } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
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
        </SidebarGroup>

        {/* STORE GROUP */}
        <SidebarGroup title="Store" defaultExpanded={true} isCollapsed={isSidebarCollapsed}>
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
        </SidebarGroup>

        {/* COMMUNITY GROUP */}
        <SidebarGroup title="Community" isCollapsed={isSidebarCollapsed}>
          <MenuLink
            to="/wall"
            icon={<MessageCircle className="w-5 h-5 text-cyan-400" />}
            label="Troll City Wall"
            active={isActive('/wall')}
            collapsed={isSidebarCollapsed}
          />
          <MenuLink
            to="/leaderboard"
            icon={<Trophy className="w-5 h-5 text-yellow-500" />}
            label="Leaderboard"
            active={isActive('/leaderboard')}
            collapsed={isSidebarCollapsed}
          />
          <button
            type="button"
            onClick={() => toast('Empire Partner program is under construction', { icon: '🚧' })}
            className={`flex w-full items-center rounded-lg transition hover:bg-[#1F1F2E] text-gray-300 border-transparent gap-3 px-4 py-2 ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
          >
            <UserPlus className="w-5 h-5 text-green-400" />
            {!isSidebarCollapsed && <span className="flex-1 text-left">Empire Partner</span>}
          </button>
          <button
            type="button"
            onClick={() => toast('Troll Wheel is under construction', { icon: '🚧' })}
            className={`flex w-full items-center rounded-lg transition hover:bg-[#1F1F2E] text-gray-300 border-transparent gap-3 px-4 py-2 ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
          >
            <FerrisWheel className="w-5 h-5 text-pink-500" />
            {!isSidebarCollapsed && <span className="flex-1 text-left">Troll Wheel</span>}
          </button>
          <MenuLink
            to="/apply"
            icon={<FileText className="w-5 h-5 text-slate-400" />}
            label="Applications"
            active={isActive('/apply')}
            collapsed={isSidebarCollapsed}
          />
        </SidebarGroup>

        {/* FAMILY GROUP */}
        {canSeeFamilyLounge && (
          <SidebarGroup title="Family" isCollapsed={isSidebarCollapsed}>
            <MenuLink
              to="/family"
              icon={<Users className="w-5 h-5 text-cyan-400" />}
              label="Troll Family Lounge"
              active={isActive('/family')}
              collapsed={isSidebarCollapsed}
            />
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
          </SidebarGroup>
        )}

        {/* OFFICER TOOLS (Only for Officers/Admins) */}
        {canSeeOfficer && (
          <SidebarGroup title="Officer Tools" isCollapsed={isSidebarCollapsed}>
            <MenuLink
              to="/troll-court"
              icon={<Scale className="w-5 h-5 text-red-400" />}
              label="Troll Court"
              active={isActive('/troll-court')}
              collapsed={isSidebarCollapsed}
            />
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
            {profile?.role === 'admin' && (
              <MenuLink
                to="/admin/applications"
                icon={<UserPlus className="w-5 h-5 text-blue-500" />}
                label="Review Applications"
                active={isActive('/admin/applications')}
                collapsed={isSidebarCollapsed}
              />
            )}
          </SidebarGroup>
        )}

        {/* SUPPORT GROUP */}
        <SidebarGroup title="Support" isCollapsed={isSidebarCollapsed}>
          <MenuLink
            to="/support"
            icon={<LifeBuoy className="w-5 h-5 text-gray-400" />}
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
        </SidebarGroup>

        {/* ADMIN EXTRAS (If any left over) */}
        {profile?.role === 'admin' && (
          <SidebarGroup title="Admin Controls" isCollapsed={isSidebarCollapsed}>
             <MenuLink
              to="/admin"
              icon={<LayoutDashboard className="w-5 h-5 text-violet-500" />}
              label="Admin Dashboard"
              active={isActive('/admin')}
              collapsed={isSidebarCollapsed}
            />
            <MenuLink
              to="/admin/earnings"
              icon={<Banknote className="w-5 h-5 text-green-500" />}
              label="Earnings Dashboard"
              active={isActive('/admin/earnings')}
              collapsed={isSidebarCollapsed}
            />
            <MenuLink
              to="/admin/royal-family"
              icon={<Crown className="w-5 h-5 text-yellow-500" />}
              label="Royal Family"
              active={isActive('/admin/royal-family')}
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
              to="/rfc"
              icon={<Shield className="w-5 h-5 text-purple-500" />}
              label="RFC"
              active={isActive('/rfc')}
              collapsed={isSidebarCollapsed}
            />
          </SidebarGroup>
        )}
      </nav>

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
