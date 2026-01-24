import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import CourtEntryModal from './CourtEntryModal'
import SidebarGroup from './ui/SidebarGroup'
import {
  Home,
  MessageSquare,
  Coins,
  Shield,
  Gavel,
  LayoutDashboard,
  Banknote,
  FileText,
  Store,
  Crown,
  Trophy,
  Package,
  Scale,
  ChevronLeft,
  ChevronRight,
  LifeBuoy,
  Shuffle,
  Star,
  Building2,
  RefreshCw,
  Vote,
  TrendingUp,
  Mars,
  Venus,
  Waves
} from 'lucide-react'

import { useAuthStore } from '@/lib/store'
import { supabase, UserRole } from '@/lib/supabase'
import { useCoins } from '@/lib/hooks/useCoins'
import { useXPStore } from '@/stores/useXPStore'
import { useSidebarUpdates } from '@/hooks/useSidebarUpdates'

export default function Sidebar() {
  const { profile } = useAuthStore()
  const { level, fetchXP, subscribeToXP, unsubscribe } = useXPStore()
  const { balances, loading } = useCoins()
  const { isUpdated, isCategoryUpdated, markAsViewed } = useSidebarUpdates()
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path

  // badge placeholder not currently used

  const [canSeeOfficer, setCanSeeOfficer] = useState(false)
  const [canSeeFamilyLounge, setCanSeeFamilyLounge] = useState(false)
  const [canSeeSecretary, setCanSeeSecretary] = useState(false)

  const handleClearCacheReload = () => {
    try {
      if (profile?.id) {
        const keysToRemove = [
          `tc-profile-${profile.id}`,
          `trollcity_car_${profile.id}`,
          `trollcity_owned_vehicles_${profile.id}`,
          `trollcity_car_insurance_${profile.id}`,
          `trollcity_vehicle_condition_${profile.id}`,
          `trollcity_home_owned_${profile.id}`
        ]

        keysToRemove.forEach((key) => localStorage.removeItem(key))
      }

      localStorage.removeItem('pwa-installed')
      sessionStorage.clear()
    } catch {}

    window.location.reload()
  }
  const [showCourtModal, setShowCourtModal] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Role definitions
  const isAdmin = profile?.role === UserRole.ADMIN || profile?.troll_role === UserRole.ADMIN || profile?.role === UserRole.HR_ADMIN;
  const isSecretary = profile?.role === UserRole.SECRETARY || profile?.troll_role === UserRole.SECRETARY;
  
  const isLead = profile?.role === UserRole.LEAD_TROLL_OFFICER || profile?.is_lead_officer || profile?.troll_role === UserRole.LEAD_TROLL_OFFICER || isAdmin;
  // Officer check matches the logic in useEffect (isAdmin || isOfficer)
  const isOfficer = profile?.role === UserRole.TROLL_OFFICER || profile?.role === UserRole.LEAD_TROLL_OFFICER || profile?.is_lead_officer || profile?.troll_role === UserRole.TROLL_OFFICER || profile?.troll_role === UserRole.LEAD_TROLL_OFFICER || isAdmin;
  const canSeeCourt = isOfficer || isSecretary;
  const hasRgb = useMemo(() => {
    if (!profile?.rgb_username_expires_at) return false
    return new Date(profile.rgb_username_expires_at) > new Date()
  }, [profile?.rgb_username_expires_at])

  useEffect(() => {
    if (profile?.id) {
        fetchXP(profile.id)
        subscribeToXP(profile.id)
        return () => unsubscribe()
    }
  }, [profile?.id, fetchXP, subscribeToXP, unsubscribe])

  useEffect(() => {
    const checkAccess = async () => {
      if (!profile) { 
        setCanSeeOfficer(false)
        setCanSeeFamilyLounge(false)
        setCanSeeSecretary(false)
        return 
      }
      
      // Troll Officer Lounge: Only admin and troll_officer role
      setCanSeeOfficer(isOfficer)

      // Troll Family Lounge: Admin, troll_officer, OR approved family application
      if (isOfficer) { 
        setCanSeeFamilyLounge(true)
      } else {
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

      // Check Secretary Access
      if (isAdmin || isSecretary) {
        setCanSeeSecretary(true)
      } else {
        try {
          const { data: secData } = await supabase
            .from('secretary_assignments')
            .select('id')
            .eq('secretary_id', profile.id)
            .maybeSingle()
          
          setCanSeeSecretary(!!secData)
        } catch {
          setCanSeeSecretary(false)
        }
      }
    }
    checkAccess()
  }, [profile, isOfficer, isAdmin, isSecretary])

  if (!profile) return null

  return (
    <div className={`flex flex-col h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 backdrop-blur-xl border-r border-white/10 shadow-[10px_0_40px_rgba(0,0,0,0.35)] transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'} fixed left-0 top-0 z-50`}>

      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-white/5 bg-white/5/10">
        {!isSidebarCollapsed && (
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-tr from-purple-600 via-pink-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-[0_10px_30px_rgba(99,102,241,0.35)]">
              <span className="text-xl font-bold text-white">T</span>
            </div>
            <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
              TrollCity
            </span>
          </Link>
        )}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`p-1.5 hover:bg-white/10 rounded-lg text-gray-300 transition-colors ${isSidebarCollapsed ? 'mx-auto' : ''}`}
        >
          {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* User Profile Summary (Level & XP) */}
      {!isSidebarCollapsed && (
        <div className="p-4 border-b border-white/5 bg-white/5 mx-4 mt-4 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <img 
                src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}&background=random`} 
                alt={profile.username}
                className="w-12 h-12 rounded-xl border border-white/15 shadow-[0_10px_30px_rgba(99,102,241,0.3)] object-cover"
              />
              <div className="absolute -bottom-1.5 -right-1.5 bg-gradient-to-r from-purple-600 to-cyan-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-900 shadow-[0_0_10px_rgba(59,130,246,0.35)]">
                {level}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold text-sm truncate text-slate-50 ${hasRgb ? 'rgb-username' : ''}`}>{profile.username}</h3>
                {(profile as any).gender === 'male' && (
                  <Mars size={14} className="text-blue-400" title="Male" />
                )}
                {(profile as any).gender === 'female' && (
                  <Venus size={14} className="text-pink-400" title="Female" />
                )}
                <button
                  onClick={handleClearCacheReload}
                  className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-gray-200"
                  aria-label="Clear cache and reload"
                  title="Clear cache and reload"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="px-2 py-0.5 rounded-full bg-white/5 text-purple-200 border border-white/10">{profile.role === 'admin' ? 'Admin' : (profile.title || 'Citizen')}</span>
              </div>
            </div>
          </div>
          
          {/* Level Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Level Progress</span>
              <span>{level} → {level + 1}</span>
            </div>
            <div className="h-2 bg-slate-900/70 rounded-full overflow-hidden border border-white/10">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.45)]"
                style={{ width: `${Math.min((level / (level + 1)) * 100, 100)}%` }}
              ></div>
            </div>
            <div className="text-[9px] text-gray-500 text-right">
                {Math.round((level / (level + 1)) * 100)}% to next level
            </div>
          </div>

          {/* Currency */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-1.5 text-xs text-yellow-300 bg-white/5 px-2 py-1 rounded-lg border border-white/10">
                <Coins size={14} />
                <span>{loading ? '...' : balances.troll_coins.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-blue-200 bg-white/5 px-2 py-1 rounded-lg border border-white/10">
                <Crown size={14} />
                <span>{profile.perk_tokens || 0}</span>
              </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6 custom-scrollbar min-h-0">
        {/* Main Group */}
        <SidebarGroup title={isSidebarCollapsed ? '' : "Main"} isCollapsed={isSidebarCollapsed} highlight={isCategoryUpdated('Main')}>
          <SidebarItem icon={Home} label="Home" to="/" active={isActive('/')} collapsed={isSidebarCollapsed} highlight={isUpdated('/')} onClick={() => markAsViewed('/')} />
          <SidebarItem icon={Building2} label="Troll Town" to="/trollstown" active={isActive('/trollstown')} collapsed={isSidebarCollapsed} highlight={isUpdated('/trollstown')} onClick={() => markAsViewed('/trollstown')} />
          <SidebarItem icon={Crown} label="Troll G" to="/trollg" active={isActive('/trollg')} collapsed={isSidebarCollapsed} highlight={isUpdated('/trollg')} onClick={() => markAsViewed('/trollg')} />
          <SidebarItem icon={Package} label="Inventory" to="/inventory" active={isActive('/inventory')} collapsed={isSidebarCollapsed} highlight={isUpdated('/inventory')} onClick={() => markAsViewed('/inventory')} />
          <SidebarItem icon={Vote} label="Troting" to="/troting" active={isActive('/troting')} collapsed={isSidebarCollapsed} highlight={isUpdated('/troting')} onClick={() => markAsViewed('/troting')} />
          <SidebarItem icon={FileText} label="The Wall" to="/wall" active={isActive('/wall')} collapsed={isSidebarCollapsed} highlight={isUpdated('/wall')} onClick={() => markAsViewed('/wall')} />
          <SidebarItem icon={Store} label="Marketplace" to="/marketplace" active={isActive('/marketplace')} collapsed={isSidebarCollapsed} highlight={isUpdated('/marketplace')} onClick={() => markAsViewed('/marketplace')} />
          <SidebarItem icon={Trophy} label="Leaderboard" to="/leaderboard" active={isActive('/leaderboard')} collapsed={isSidebarCollapsed} highlight={isUpdated('/leaderboard')} onClick={() => markAsViewed('/leaderboard')} />
          <SidebarItem icon={TrendingUp} label="Credit Scores" to="/credit-scores" active={isActive('/credit-scores')} collapsed={isSidebarCollapsed} highlight={isUpdated('/credit-scores')} onClick={() => markAsViewed('/credit-scores')} />
          <SidebarItem icon={Coins} label="Coin Store" to="/store" active={isActive('/store')} collapsed={isSidebarCollapsed} highlight={isUpdated('/store')} onClick={() => markAsViewed('/store')} />
          <SidebarItem icon={Shuffle} label="Creator Switch" to="/creator-switch" active={isActive('/creator-switch')} collapsed={isSidebarCollapsed} highlight={isUpdated('/creator-switch')} onClick={() => markAsViewed('/creator-switch')} />
          <SidebarItem icon={Scale} label="Troll Court" to="/troll-court" active={isActive('/troll-court')} collapsed={isSidebarCollapsed} highlight={isUpdated('/troll-court')} onClick={() => markAsViewed('/troll-court')} />
        </SidebarGroup>



        {/* Support & Safety */}
        <SidebarGroup title={isSidebarCollapsed ? '' : "Support"} isCollapsed={isSidebarCollapsed} highlight={isCategoryUpdated('Support')}>
          <SidebarItem icon={LifeBuoy} label="Support" to="/support" active={isActive('/support')} collapsed={isSidebarCollapsed} highlight={isUpdated('/support')} onClick={() => markAsViewed('/support')} />
          <SidebarItem icon={Shield} label="Safety" to="/safety" active={isActive('/safety')} collapsed={isSidebarCollapsed} highlight={isUpdated('/safety')} onClick={() => markAsViewed('/safety')} />
        </SidebarGroup>

        {/* Social */}
        <SidebarGroup title={isSidebarCollapsed ? '' : "Social"} isCollapsed={isSidebarCollapsed} highlight={isCategoryUpdated('Social')}>
          <SidebarItem icon={MessageSquare} label="Messages" to="/messages" active={isActive('/messages')} collapsed={isSidebarCollapsed} highlight={isUpdated('/messages')} onClick={() => markAsViewed('/messages')} />
          <SidebarItem 
            icon={Waves} 
            label="Public Pool" 
            to="/pool" 
            active={isActive('/pool')} 
            collapsed={isSidebarCollapsed}
            highlight={isUpdated('/pool')} onClick={() => markAsViewed('/pool')}
            className="text-cyan-400 hover:text-cyan-300"
          />
          {canSeeFamilyLounge && (
            <SidebarItem 
              icon={Crown} 
              label="Family Lounge" 
              to="/family/lounge" 
              active={location.pathname.startsWith('/family')} 
              collapsed={isSidebarCollapsed}
              highlight={isUpdated('/family/lounge')} onClick={() => markAsViewed('/family/lounge')}
              className="text-amber-400 hover:text-amber-300"
            />
          )}
        </SidebarGroup>

        {/* Special Access */}
        {(canSeeOfficer || canSeeFamilyLounge || canSeeSecretary || canSeeCourt) && (
          <SidebarGroup title={isSidebarCollapsed ? '' : "Special Access"} isCollapsed={isSidebarCollapsed} highlight={isCategoryUpdated('Special Access')}>
            {canSeeCourt && (
              <SidebarItem 
                icon={Gavel} 
                label="Court Dockets" 
                to="/admin/court-dockets" 
                active={location.pathname.startsWith('/admin/court-dockets')} 
                collapsed={isSidebarCollapsed}
                highlight={isUpdated('/admin/court-dockets')} onClick={() => markAsViewed('/admin/court-dockets')}
                className="text-orange-400 hover:text-orange-300"
              />
            )}
            {canSeeOfficer && (
              <>
                <SidebarItem 
                  icon={LayoutDashboard} 
                  label="Officer Dashboard" 
                  to="/officer/dashboard" 
                  active={location.pathname.startsWith('/officer/dashboard')} 
                  collapsed={isSidebarCollapsed}
                  highlight={isUpdated('/officer/dashboard')} onClick={() => markAsViewed('/officer/dashboard')}
                  className="text-emerald-400 hover:text-emerald-300"
                />
                <SidebarItem 
                  icon={Shield} 
                  label="Officer Lounge" 
                  to="/officer/lounge" 
                  active={location.pathname.startsWith('/officer/lounge')} 
                  collapsed={isSidebarCollapsed}
                  highlight={isUpdated('/officer/lounge')} onClick={() => markAsViewed('/officer/lounge')}
                  className="text-purple-400 hover:text-purple-300"
                />
                <SidebarItem 
                  icon={Shield} 
                  label="Officer Moderation" 
                  to="/officer/moderation" 
                  active={location.pathname.startsWith('/officer/moderation')} 
                  collapsed={isSidebarCollapsed}
                  highlight={isUpdated('/officer/moderation')} onClick={() => markAsViewed('/officer/moderation')}
                  className="text-blue-400 hover:text-blue-300"
                />
              </>
            )}
            {isLead && (
              <SidebarItem 
                icon={Star} 
                label="Lead HQ" 
                to="/lead-officer" 
                active={location.pathname.startsWith('/lead-officer')} 
                collapsed={isSidebarCollapsed}
                highlight={isUpdated('/lead-officer')} onClick={() => markAsViewed('/lead-officer')}
                className="text-yellow-400 hover:text-yellow-300"
              />
            )}
            {canSeeSecretary && (
               <SidebarItem 
                  icon={LayoutDashboard} 
                  label="Secretary Console" 
                  to="/secretary" 
                  active={location.pathname.startsWith('/secretary')} 
                  collapsed={isSidebarCollapsed}
                  highlight={isUpdated('/secretary')} onClick={() => markAsViewed('/secretary')}
                  className="text-pink-400 hover:text-pink-300"
                />
            )}
            {isAdmin && (
               <SidebarItem 
                  icon={FileText} 
                  label="Review Applications" 
                  to="/admin/applications" 
                  active={location.pathname.startsWith('/admin/applications')} 
                  collapsed={isSidebarCollapsed}
                  highlight={isUpdated('/admin/applications')} onClick={() => markAsViewed('/admin/applications')}
                  className="text-red-400 hover:text-red-300"
                />
            )}
          </SidebarGroup>
        )}

        {/* System */}
        <SidebarGroup title={isSidebarCollapsed ? '' : "System"} isCollapsed={isSidebarCollapsed} highlight={isCategoryUpdated('System')}>
          <SidebarItem icon={FileText} label="Applications" to="/application" active={isActive('/application')} collapsed={isSidebarCollapsed} highlight={isUpdated('/application')} onClick={() => markAsViewed('/application')} />
          <SidebarItem icon={Banknote} label="Wallet" to="/wallet" active={isActive('/wallet')} collapsed={isSidebarCollapsed} highlight={isUpdated('/wallet')} onClick={() => markAsViewed('/wallet')} />
        </SidebarGroup>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/10 space-y-2">
        <Link 
          to="/stats"
          className={`flex items-center gap-3 w-full p-2 rounded-lg hover:bg-white/5 text-gray-400 transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`}
        >
          <LayoutDashboard size={20} />
          {!isSidebarCollapsed && <span className="text-sm font-medium">Stats</span>}
        </Link>
      </div>

      {/* Modals */}
      {showCourtModal && <CourtEntryModal isOpen={true} onClose={() => setShowCourtModal(false)} />}
    </div>
  )
}

// Helper Component for Sidebar Items
function SidebarItem({ 
  icon: Icon, 
  label, 
  to, 
  active, 
  collapsed, 
  badge, 
  highlight,
  onClick,
  className = '' 
}: { 
  icon: any, 
  label: string, 
  to: string, 
  active: boolean, 
  collapsed: boolean, 
  badge?: string, 
  highlight?: boolean,
  onClick?: () => void,
  className?: string 
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`
        relative z-0 bg-transparent
        flex items-center gap-3 px-4 py-2 mx-2 rounded-xl transition-all duration-200 group
        ${active 
          ? 'text-white bg-white/5 border border-white/10 shadow-[0_10px_30px_rgba(109,40,217,0.35)]' 
          : highlight
            ? 'text-white bg-gradient-to-r from-red-500/20 via-green-500/20 to-blue-500/20 border border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.3)] animate-pulse'
            : 'text-gray-300 hover:bg-white/5 hover:text-white border border-transparent'
        }
        ${collapsed ? 'justify-center px-2' : ''}
        ${className}
      `}
      title={collapsed ? label : undefined}
    >
      <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full bg-gradient-to-b from-purple-500 to-cyan-400 ${active ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`} />
      <Icon size={20} className={`min-w-[20px] ${active ? 'text-purple-200' : highlight ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]' : 'group-hover:text-white'}`} />
      
      {!collapsed && (
        <div className="flex items-center justify-between flex-1 min-w-0">
          <span className="text-sm font-medium truncate">{label}</span>
          {badge && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-purple-600 text-white rounded-full">
              {badge}
            </span>
          )}
          {highlight && !badge && (
            <span className="w-2 h-2 rounded-full bg-gradient-to-r from-red-500 via-green-500 to-blue-500 shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse" />
          )}
        </div>
      )}
      
      {collapsed && (badge || highlight) && (
        <div className={`absolute top-0 right-0 w-2 h-2 rounded-full ${highlight ? 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500 shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-purple-600'}`}></div>
      )}
    </Link>
  )
}
