
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
  ShoppingBag,
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
  Vote,
  TrendingUp,
  Mars,
  Venus,
  Waves,
  Car,
  BookOpen,
  Radio,
  Warehouse,
  Landmark,
  Video,
  Mic,
  Globe,
  Lock,
  Files,
  Gamepad2,
  Music,
  Newspaper,
  Users
} from 'lucide-react'

import { useAuthStore } from '@/lib/store'
import { supabase, UserRole } from '@/lib/supabase'
import { useCoins } from '@/lib/hooks/useCoins'
import { useXPStore } from '@/stores/useXPStore'
import { useSidebarUpdates } from '@/hooks/useSidebarUpdates'
import { useJailMode } from '@/hooks/useJailMode'

import SidebarTopBroadcasters from './sidebar/SidebarTopBroadcasters'


import UserProfileWidget from './sidebar/UserProfileWidget';
import { getGlowingTextStyle } from '@/lib/perkEffects'

import { useSidebarStore } from '@/stores/useSidebarStore';
import UserPresenceCounter from './sidebar/UserPresenceCounter';
import OnlineUsersModal from './sidebar/OnlineUsersModal';

export default function Sidebar() {
  const { profile } = useAuthStore()
  const { level, progress, fetchXP, subscribeToXP, unsubscribe } = useXPStore()
  const { balances, loading } = useCoins()
  const { isUpdated, markAsViewed } = useSidebarUpdates()
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path

  const [canSeeOfficer, setCanSeeOfficer] = useState(false)
  const [canSeeFamilyLounge, setCanSeeFamilyLounge] = useState(false)
  const [canSeeSecretary, setCanSeeSecretary] = useState(false)

  const [showCourtModal, setShowCourtModal] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [showOnlineUsers, setShowOnlineUsers] = useState(false)

  const { expandedGroups, toggleGroup, expandGroup } = useSidebarStore();

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/city-hall')) {
      expandGroup('City Center');
    } else if (path.startsWith('/pool')) {
      expandGroup('Social');
    } else if (path.startsWith('/marketplace')) {
      expandGroup('City Center');
    } else if (path.startsWith('/government/streams')) {
      expandGroup('Government Sector');
    } else if (path.startsWith('/city-registry')) {
      expandGroup('City Registry');
    }
  }, [location.pathname, expandGroup]);

  const isAdmin = profile?.role === UserRole.ADMIN || profile?.troll_role === UserRole.ADMIN || profile?.role === UserRole.HR_ADMIN || profile?.is_admin;
  const isSecretary = profile?.role === UserRole.SECRETARY || profile?.troll_role === UserRole.SECRETARY;
  const isLead = profile?.role === UserRole.LEAD_TROLL_OFFICER || profile?.is_lead_officer || profile?.troll_role === UserRole.LEAD_TROLL_OFFICER || isAdmin;
  const isOfficer = profile?.role === UserRole.TROLL_OFFICER || profile?.role === UserRole.LEAD_TROLL_OFFICER || profile?.is_lead_officer || profile?.troll_role === UserRole.TROLL_OFFICER || profile?.troll_role === UserRole.LEAD_TROLL_OFFICER || isAdmin;
  const canSeeCourt = true; // Show court dockets for all users
  
  const needsLicense = useMemo(() => {
    if (!profile) return false
    const status = (profile as any).drivers_license_status
    return !status || status === 'revoked' || status === 'suspended'
  }, [profile])

  const { isJailed } = useJailMode(profile?.id)

  // Real-time role change detection - refreshes profile when role changes in DB
  useEffect(() => {
    if (!profile?.id) return

    const channel = supabase
      .channel(`profile-role-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${profile.id}`,
        },
        (payload) => {
          // Check if role-related fields changed
          const newData = payload.new as any
          const oldData = payload.old as any
          
          const roleFields = ['role', 'is_admin', 'is_lead_officer', 'is_troll_officer', 'troll_role', 'is_pastor', 'is_secretary']
          const hasRoleChange = roleFields.some(field => newData[field] !== oldData[field])
          
          if (hasRoleChange) {
            console.log('[Sidebar] Role change detected, refreshing profile...')
            // Refresh the profile to get updated role data
            const { refreshProfile } = useAuthStore.getState()
            refreshProfile()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id])

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
      
      let activeAdmin = false
      try {
        const { data } = await supabase
            .from('admin_for_week_queue')
            .select('user_id')
            .eq('status', 'active')
            .eq('user_id', profile.id)
            .maybeSingle()
        activeAdmin = !!data
      } catch {}

      setCanSeeOfficer(isOfficer || activeAdmin)

      if (isOfficer) { 
        setCanSeeFamilyLounge(true)
      } else {
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

  const mainPaths = ['/', '/trollstown', '/inventory', '/troting', '/marketplace', '/leaderboard', '/credit-scores', '/store', '/creator-switch', '/troll-court', '/troll-games']
  const supportPaths = ['/support', '/safety']
  const socialPaths = ['/tcps', '/pool', '/universe-event', '/media-city']
  if (canSeeFamilyLounge) socialPaths.push('/family/lounge')
  const specialAccessPaths: string[] = []
  if (canSeeCourt) specialAccessPaths.push('/admin/court-dockets')
  if (canSeeOfficer) specialAccessPaths.push('/officer/dashboard', '/officer/lounge', '/officer/moderation')
  if (isLead) specialAccessPaths.push('/lead-officer')
  if (canSeeSecretary) specialAccessPaths.push('/secretary')
  if (isAdmin) specialAccessPaths.push('/admin/applications')
  const systemPaths = ['/application', '/interview-room', '/wallet']
  const isAnyUpdated = (paths: string[]) => paths.some(path => isUpdated(path))

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

      {/* User Profile Summary - Show for all logged-in users */}
      {!isSidebarCollapsed && profile && (
        <div className="p-4">
            <UserProfileWidget />
          </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6 custom-scrollbar min-h-0">
        {isJailed ? (
          <>
            <div className="px-4 py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                <Lock className="text-red-500" size={32} />
              </div>
              <div>
                <p className="text-red-500 font-bold uppercase tracking-wider text-xs">Access Restricted</p>
                <p className="text-gray-400 text-[10px] mt-1">City services suspended while incarcerated.</p>
              </div>
            </div>

            <SidebarGroup title={isSidebarCollapsed ? '' : "Public Services"} isCollapsed={isSidebarCollapsed} highlight={true}>
              <SidebarItem icon={Lock} label="Jail" to="/jail" active={isActive('/jail')} collapsed={isSidebarCollapsed} className="text-red-400 hover:text-red-300" />
              <SidebarItem icon={LifeBuoy} label="Support" to="/support" active={isActive('/support')} collapsed={isSidebarCollapsed} />
            </SidebarGroup>
          </>
        ) : (
          <>
            <SidebarTopBroadcasters isCollapsed={isSidebarCollapsed} />

            <div className={`px-4 mb-2 mt-2 ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
              <Link
                to="/broadcast/setup"
                className={`
                  relative group flex items-center justify-center gap-2
                  bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600
                  hover:from-yellow-500 hover:via-yellow-300 hover:to-yellow-500
                  text-black font-bold rounded-xl shadow-[0_0_15px_rgba(234,179,8,0.5)]
                  transition-all duration-300 hover:scale-[1.02] border border-yellow-200/50
                  ${isSidebarCollapsed ? 'w-10 h-10 p-0' : 'w-full py-3 px-4'}
                `}
              >
                <Video size={isSidebarCollapsed ? 20 : 20} className="text-black" />
                {!isSidebarCollapsed && (
                  <span className="uppercase tracking-wide text-sm">Go Live</span>
                )}
              </Link>
            </div>

            <SidebarGroup 
              title={isSidebarCollapsed ? '' : "City Center"} 
              isCollapsed={isSidebarCollapsed} 
              highlight={isAnyUpdated(mainPaths)}
              isExpanded={expandedGroups.includes('City Center')}
              onToggle={() => toggleGroup('City Center')}
            >
              <SidebarItem icon={Home} label="Home" to="/" active={isActive('/')} collapsed={isSidebarCollapsed} highlight={isUpdated('/')} onClick={() => markAsViewed('/')} />
              <SidebarItem icon={Building2} label="Troll Town" to="/trollstown" active={isActive('/trollstown')} collapsed={isSidebarCollapsed} highlight={isUpdated('/trollstown')} onClick={() => markAsViewed('/trollstown')} />
              <SidebarItem icon={Landmark} label="City Hall" to="/city-hall" active={isActive('/city-hall')} collapsed={isSidebarCollapsed} highlight={isUpdated('/city-hall')} onClick={() => markAsViewed('/city-hall')} />
              <SidebarItem icon={Warehouse} label="Living" to="/living" active={isActive('/living')} collapsed={isSidebarCollapsed} highlight={isUpdated('/living')} onClick={() => markAsViewed('/living')} />
              <SidebarItem icon={Package} label="Inventory" to="/inventory" active={isActive('/inventory')} collapsed={isSidebarCollapsed} highlight={isUpdated('/inventory')} onClick={() => markAsViewed('/inventory')} />
              <SidebarItem icon={Vote} label="Troting" to="/troting" active={isActive('/troting')} collapsed={isSidebarCollapsed} highlight={isUpdated('/troting')} onClick={() => markAsViewed('/troting')} />
              <SidebarItem icon={Store} label="Marketplace" to="/marketplace" active={isActive('/marketplace')} collapsed={isSidebarCollapsed} highlight={isUpdated('/marketplace')} onClick={() => markAsViewed('/marketplace')} />
              <SidebarItem icon={Trophy} label="Leaderboard" to="/leaderboard" active={isActive('/leaderboard')} collapsed={isSidebarCollapsed} highlight={isUpdated('/leaderboard')} onClick={() => markAsViewed('/leaderboard')} />
              <SidebarItem icon={TrendingUp} label="Credit Scores" to="/credit-scores" active={isActive('/credit-scores')} collapsed={isSidebarCollapsed} highlight={isUpdated('/credit-scores')} onClick={() => markAsViewed('/credit-scores')} />
              <SidebarItem icon={Coins} label="Coin Store" to="/store" active={isActive('/store')} collapsed={isSidebarCollapsed} highlight={isUpdated('/store')} onClick={() => markAsViewed('/store')} />
              <SidebarItem icon={Shuffle} label="Creator Switch" to="/creator-switch" active={isActive('/creator-switch')} collapsed={isSidebarCollapsed} highlight={isUpdated('/creator-switch')} onClick={() => markAsViewed('/creator-switch')} />
              <SidebarItem icon={Scale} label="Troll Court" to="/troll-court" active={isActive('/troll-court')} collapsed={isSidebarCollapsed} highlight={isUpdated('/troll-court')} onClick={() => markAsViewed('/troll-court')} />
              <SidebarItem icon={Crown} label="Troll President" to="/president" active={isActive('/president')} collapsed={isSidebarCollapsed} highlight={isUpdated('/president')} onClick={() => markAsViewed('/president')} />
            </SidebarGroup>

            <SidebarGroup 
              title={isSidebarCollapsed ? '' : "Public Services"} 
              isCollapsed={isSidebarCollapsed} 
              highlight={isAnyUpdated(supportPaths)}
              isExpanded={expandedGroups.includes('Public Services')}
              onToggle={() => toggleGroup('Public Services')}
            >
              <SidebarItem icon={Lock} label="Jail" to="/jail" active={isActive('/jail')} collapsed={isSidebarCollapsed} highlight={isUpdated('/jail')} onClick={() => markAsViewed('/jail')} className="text-red-400 hover:text-red-300" />
              <SidebarItem icon={BookOpen} label="Troll Church" to="/church" active={isActive('/church')} collapsed={isSidebarCollapsed} highlight={isUpdated('/church')} onClick={() => markAsViewed('/church')} />
              {((profile as any)?.is_pastor || profile?.role === 'admin' || (profile as any)?.is_admin) && (
                <SidebarItem 
                  icon={LayoutDashboard} 
                  label="Pastor Dashboard" 
                  to="/church/pastor" 
                  active={isActive('/church/pastor')} 
                  collapsed={isSidebarCollapsed} 
                  className="text-purple-400 hover:text-purple-300"
                />
              )}
              <SidebarItem icon={LifeBuoy} label="Support" to="/support" active={isActive('/support')} collapsed={isSidebarCollapsed} highlight={isUpdated('/support')} onClick={() => markAsViewed('/support')} />
              <SidebarItem icon={Shield} label="Safety" to="/safety" active={isActive('/safety')} collapsed={isSidebarCollapsed} highlight={isUpdated('/safety')} onClick={() => markAsViewed('/safety')} />
              <SidebarItem icon={ShoppingBag} label="Trollified" to="/trollifieds" active={isActive('/trollifieds')} collapsed={isSidebarCollapsed} highlight={isUpdated('/trollifieds')} onClick={() => markAsViewed('/trollifieds')} className="text-green-400 hover:text-green-300" />
              <SidebarItem icon={Building2} label="Neighbors" to="/neighbors" active={isActive('/neighbors')} collapsed={isSidebarCollapsed} highlight={isUpdated('/neighbors')} onClick={() => markAsViewed('/neighbors')} className="text-blue-400 hover:text-blue-300" />
            </SidebarGroup>

            <SidebarGroup
              title={isSidebarCollapsed ? '' : "Social"}
              isCollapsed={isSidebarCollapsed}
              highlight={isAnyUpdated(socialPaths)}
              isExpanded={expandedGroups.includes('Social')}
              onToggle={() => toggleGroup('Social')}
            >
              <SidebarItem icon={MessageSquare} label="Troll City Postal Service" to="/tcps" active={isActive('/tcps') || isActive('/messages')} collapsed={isSidebarCollapsed} highlight={isUpdated('/tcps')} onClick={() => markAsViewed('/tcps')} />
              <SidebarItem
                icon={Mic}
                label="Troll Pods"
                to="/pods"
                active={isActive('/pods')}
                collapsed={isSidebarCollapsed}
                highlight={isUpdated('/pods')} onClick={() => markAsViewed('/pods')}
                className="text-purple-400 hover:text-purple-300"
              />
              <SidebarItem
                icon={Music}
                label="Media City"
                to="/media-city"
                active={isActive('/media-city')}
                collapsed={isSidebarCollapsed}
                highlight={isUpdated('/media-city')} onClick={() => markAsViewed('/media-city')}
                className="text-pink-400 hover:text-pink-300"
              />
              <SidebarItem 
                icon={Mic} 
                label="Mai Talent" 
                to="/mai-talent/stage" 
                active={location.pathname.startsWith('/mai-talent')}
                collapsed={isSidebarCollapsed}
                highlight={isUpdated('/mai-talent/stage')} onClick={() => markAsViewed('/mai-talent/stage')}
                className="text-pink-400 hover:text-pink-300"
              />
              <SidebarItem 
                icon={Waves} 
                label="Public Pool" 
                to="/pool" 
                active={isActive('/pool')} 
                collapsed={isSidebarCollapsed}
                highlight={isUpdated('/pool')} onClick={() => markAsViewed('/pool')}
                className="text-cyan-400 hover:text-cyan-300"
              />
              <SidebarItem 
                icon={Globe} 
                label="Universe Event" 
                to="/universe-event" 
                active={isActive('/universe-event')} 
                collapsed={isSidebarCollapsed}
                highlight={isUpdated('/universe-event')} onClick={() => markAsViewed('/universe-event')}
                className="text-indigo-400 hover:text-indigo-300"
              />
              <SidebarItem 
                icon={Gamepad2} 
                label="Troll Games" 
                to="/troll-games" 
                active={isActive('/troll-games')} 
                collapsed={isSidebarCollapsed}
                highlight={isUpdated('/troll-games')} onClick={() => markAsViewed('/troll-games')}
                className="text-green-400 hover:text-green-300"
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

            {(canSeeOfficer || canSeeFamilyLounge || canSeeSecretary || canSeeCourt) && (
              <SidebarGroup 
                title={isSidebarCollapsed ? '' : "Government Sector"} 
                isCollapsed={isSidebarCollapsed} 
                highlight={isAnyUpdated(specialAccessPaths)}
                isExpanded={expandedGroups.includes('Government Sector')}
                onToggle={() => toggleGroup('Government Sector')}
              >
                 {(canSeeOfficer || canSeeSecretary) && (
                  <SidebarItem 
                    icon={Radio} 
                    label="Streams" 
                    to="/government/streams" 
                    active={location.pathname.startsWith('/government/streams')} 
                    collapsed={isSidebarCollapsed}
                    highlight={isUpdated('/government/streams')} onClick={() => markAsViewed('/government/streams')}
                    className="text-red-400 hover:text-red-300"
                  />
                )}
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
                {/* TCNN Dashboard - Only for TCNN staff, Admins, and SuperAdmins */}
                {(profile?.is_journalist || profile?.is_news_caster || profile?.is_chief_news_caster || isAdmin || profile?.role === 'superadmin' || profile?.is_superadmin) && (
                   <SidebarItem 
                      icon={Newspaper} 
                      label="TCNN Dashboard" 
                      to="/tcnn/dashboard" 
                      active={location.pathname.startsWith('/tcnn/dashboard')} 
                      collapsed={isSidebarCollapsed}
                      highlight={isUpdated('/tcnn/dashboard')} onClick={() => markAsViewed('/tcnn/dashboard')}
                      className="text-blue-400 hover:text-blue-300"
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

            <SidebarGroup 
              title={isSidebarCollapsed ? '' : "City Registry"} 
              isCollapsed={isSidebarCollapsed} 
              highlight={isAnyUpdated(systemPaths)}
              isExpanded={expandedGroups.includes('City Registry')}
              onToggle={() => toggleGroup('City Registry')}
            >
              <SidebarItem icon={FileText} label="Careers" to="/application" active={isActive('/application')} collapsed={isSidebarCollapsed} highlight={isUpdated('/application')} onClick={() => markAsViewed('/application')} />
              <SidebarItem icon={Video} label="Interview Room" to="/interview-room" active={isActive('/interview-room')} collapsed={isSidebarCollapsed} highlight={isUpdated('/interview-room')} onClick={() => markAsViewed('/interview-room')} />
              <SidebarItem icon={Banknote} label="Wallet" to="/wallet" active={isActive('/wallet')} collapsed={isSidebarCollapsed} highlight={isUpdated('/wallet')} onClick={() => markAsViewed('/wallet')} />
              <SidebarItem icon={Scale} label="Appeals" to="/city-registry" active={isActive('/city-registry')} collapsed={isSidebarCollapsed} highlight={isUpdated('/city-registry')} onClick={() => markAsViewed('/city-registry')} />
            </SidebarGroup>
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/10 space-y-2">
        {/* Stats Button */}
        <Link 
          to="/stats"
          className={`flex items-center gap-3 w-full p-2 rounded-lg hover:bg-white/5 text-gray-400 transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`}
        >
          <LayoutDashboard size={20} />
          {!isSidebarCollapsed && <span className="text-sm font-medium">Stats</span>}
        </Link>
        
        {/* Online Users Button */}
        <button
          onClick={() => setShowOnlineUsers(true)}
          className={`flex items-center gap-3 w-full p-2 rounded-lg hover:bg-white/5 text-gray-400 transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`}
        >
          <Users size={20} />
          {!isSidebarCollapsed && (
            <div className="flex items-center justify-between flex-1">
              <span className="text-sm font-medium">Online</span>
              <UserPresenceCounter />
            </div>
          )}
        </button>
      </div>

      {/* Modals */}
      {showCourtModal && <CourtEntryModal isOpen={true} onClose={() => setShowCourtModal(false)} />}
      <OnlineUsersModal isOpen={showOnlineUsers} onClose={() => setShowOnlineUsers(false)} />
    </div>
  )
}

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
        relative z-0 
        flex items-center gap-3 px-4 py-2 mx-2 rounded-xl transition-all duration-200 group
        ${active ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}
        ${collapsed ? 'justify-center' : ''}
        ${className}
      `}
    >
      <Icon size={20} className="shrink-0" />
      {!collapsed && <span className="text-sm font-medium">{label}</span>}
      {badge && !collapsed && (
        <span className="ml-auto text-xs font-semibold bg-red-500 text-white px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      {highlight && !collapsed && (
        <span className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full"></span>
      )}
    </Link>
  );
}
