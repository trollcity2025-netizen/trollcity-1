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
  Shield,
  LayoutDashboard,
  Banknote,
  Clock,
  FileText,
  UserCheck,
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
  LifeBuoy,
  Shuffle,
  Star,
  Zap
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

  // Role definitions
  const isAdmin = profile?.role === 'admin' || profile?.troll_role === 'admin';
  const isLead = profile?.role === 'lead_troll_officer' || profile?.is_lead_officer || profile?.troll_role === 'lead_troll_officer' || isAdmin;
  // Officer check matches the logic in useEffect (isAdmin || isOfficer)
  const isOfficer = profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer' || profile?.is_lead_officer || profile?.troll_role === 'troll_officer' || profile?.troll_role === 'lead_troll_officer' || isAdmin;

  useEffect(() => {
    const checkAccess = async () => {
      if (!profile) { 
        setCanSeeOfficer(false)
        setCanSeeFamilyLounge(false)
        return 
      }
      
      // Troll Officer Lounge: Only admin and troll_officer role
      setCanSeeOfficer(isOfficer)

      // Troll Family Lounge: Admin, troll_officer, OR approved family application
      if (isOfficer) { 
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

  if (!profile) return null

  // Calculate Level Progress
  // Formula from DB: previous + (Level * 500). 
  // We can approximate or fetch the next level requirement. 
  // For UI simplicity, let's assume a progress bar based on a generic formula if exact data isn't in profile.
  // Ideally, profile should have 'current_xp' and 'xp_for_next_level' or we calculate it.
  // Since we only have 'current_xp' and 'level', let's estimate progress or just show the values.
  
  // Simple calculation for display purposes matching the DB seed roughly
  const getXpForNextLevel = (lvl: number) => {
    // This should match the DB seed logic ideally, or we fetch it.
    // DB: 
    // 1->2: 500
    // 2->3: 1250 (+750)
    // 3->4: 2250 (+1000)
    // ...
    // Let's just use a visual percentage or simple max if we don't have the exact number.
    // Or we can just show "Level X | XP: Y"
    return (lvl * 500) + (lvl > 1 ? (lvl - 1) * 250 : 0) + 500; // Rough approximation
  }

  // Use the profile fields if available, otherwise defaults
  const currentLevel = profile.level || 1
  const currentXP = profile.xp || 0 // profile.xp is mapped to current_xp in interface? 
  // Wait, interface said 'xp: number // Total XP points', DB col is 'current_xp'.
  // Assuming Supabase type generation maps it or we cast it. 
  // Let's rely on what's in profile.

  return (
    <div className={`flex flex-col h-screen bg-[#0A0814] border-r border-white/10 transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'} fixed left-0 top-0 z-50`}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-white/10">
        {!isSidebarCollapsed && (
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-xl font-bold text-white">T</span>
            </div>
            <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              TrollCity
            </span>
          </Link>
        )}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`p-1.5 hover:bg-white/5 rounded-lg text-gray-400 transition-colors ${isSidebarCollapsed ? 'mx-auto' : ''}`}
        >
          {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* User Profile Summary (Level & XP) */}
      {!isSidebarCollapsed && (
        <div className="p-4 border-b border-white/10 bg-white/5 mx-4 mt-4 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <img 
                src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}&background=random`} 
                alt={profile.username}
                className="w-10 h-10 rounded-full border border-purple-500/50"
              />
              <div className="absolute -bottom-1 -right-1 bg-purple-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-[#0A0814]">
                {currentLevel}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{profile.username}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="text-purple-400">{profile.role === 'admin' ? 'Admin' : (profile.title || 'Citizen')}</span>
              </div>
            </div>
          </div>
          
          {/* XP Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>XP</span>
              <span>{currentXP.toLocaleString()}</span>
            </div>
            <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full"
                style={{ width: `${Math.min((currentXP % 1000) / 10, 100)}%` }} // Simplified visual
              ></div>
            </div>
          </div>

          {/* Currency */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-1.5 text-xs text-yellow-400">
              <Coins size={14} />
              <span>{profile.troll_coins?.toLocaleString() || 0}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-blue-400">
              <Crown size={14} />
              <span>{profile.perk_tokens || 0}</span>
            </div>
          </div>

          {/* Go Live Button */}
          {canGoLive && (
            <Link
              to="/broadcast"
              className="mt-3 w-full py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-900/20 group"
            >
              <Radio size={14} className="group-hover:animate-pulse" />
              GO LIVE
            </Link>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6 custom-scrollbar">
        {/* Main Group */}
        <SidebarGroup title={isSidebarCollapsed ? '' : "Main"} collapsed={isSidebarCollapsed}>
          <SidebarItem icon={Home} label="Home" to="/" active={isActive('/')} collapsed={isSidebarCollapsed} />
          <SidebarItem icon={Package} label="Inventory" to="/inventory" active={isActive('/inventory')} collapsed={isSidebarCollapsed} />
          <SidebarItem icon={FileText} label="The Wall" to="/wall" active={isActive('/wall')} collapsed={isSidebarCollapsed} />
          <SidebarItem icon={Store} label="Marketplace" to="/marketplace" active={isActive('/marketplace')} collapsed={isSidebarCollapsed} />
          <SidebarItem icon={Trophy} label="Leaderboard" to="/leaderboard" active={isActive('/leaderboard')} collapsed={isSidebarCollapsed} />
          <SidebarItem icon={Coins} label="Coin Store" to="/store" active={isActive('/store')} collapsed={isSidebarCollapsed} />
          <SidebarItem icon={Shuffle} label="Creator Switch" to="/creator-switch" active={isActive('/creator-switch')} collapsed={isSidebarCollapsed} />
          <SidebarItem icon={Scale} label="Troll Court" to="/troll-court" active={isActive('/troll-court')} collapsed={isSidebarCollapsed} />
        </SidebarGroup>



        {/* Support & Safety */}
        <SidebarGroup title={isSidebarCollapsed ? '' : "Support"} collapsed={isSidebarCollapsed}>
          <SidebarItem icon={LifeBuoy} label="Support" to="/support" active={isActive('/support')} collapsed={isSidebarCollapsed} />
          <SidebarItem icon={Shield} label="Safety" to="/safety" active={isActive('/safety')} collapsed={isSidebarCollapsed} />
        </SidebarGroup>

        {/* Social */}
        <SidebarGroup title={isSidebarCollapsed ? '' : "Social"} collapsed={isSidebarCollapsed}>
          <SidebarItem icon={MessageSquare} label="Messages" to="/messages" active={isActive('/messages')} collapsed={isSidebarCollapsed} />
          {canSeeFamilyLounge && (
            <SidebarItem 
              icon={Crown} 
              label="Family Lounge" 
              to="/family/lounge" 
              active={location.pathname.startsWith('/family')} 
              collapsed={isSidebarCollapsed}
              className="text-amber-400 hover:text-amber-300"
            />
          )}
        </SidebarGroup>

        {/* Special Access */}
        {(canSeeOfficer || canSeeFamilyLounge) && (
          <SidebarGroup title={isSidebarCollapsed ? '' : "Special Access"} collapsed={isSidebarCollapsed}>
            {canSeeOfficer && (
              <>
                <SidebarItem 
                  icon={Shield} 
                  label="Officer Lounge" 
                  to="/officer/dashboard" 
                  active={location.pathname.startsWith('/officer/dashboard')} 
                  collapsed={isSidebarCollapsed}
                  className="text-purple-400 hover:text-purple-300"
                />
                <SidebarItem 
                  icon={Shield} 
                  label="Officer Moderation" 
                  to="/officer/moderation" 
                  active={location.pathname.startsWith('/officer/moderation')} 
                  collapsed={isSidebarCollapsed}
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
                className="text-yellow-400 hover:text-yellow-300"
              />
            )}
            {isAdmin && (
               <SidebarItem 
                  icon={FileText} 
                  label="Review Applications" 
                  to="/admin/applications" 
                  active={location.pathname.startsWith('/admin/applications')} 
                  collapsed={isSidebarCollapsed}
                  className="text-red-400 hover:text-red-300"
                />
            )}
          </SidebarGroup>
        )}

        {/* System */}
        <SidebarGroup title={isSidebarCollapsed ? '' : "System"} collapsed={isSidebarCollapsed}>
          <SidebarItem icon={FileText} label="Applications" to="/application" active={isActive('/application')} collapsed={isSidebarCollapsed} />
          <SidebarItem icon={Banknote} label="Wallet" to="/wallet" active={isActive('/wallet')} collapsed={isSidebarCollapsed} />
        </SidebarGroup>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/10 space-y-2">
        <button 
          onClick={() => setShowStatsPanel(true)}
          className={`flex items-center gap-3 w-full p-2 rounded-lg hover:bg-white/5 text-gray-400 transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`}
        >
          <LayoutDashboard size={20} />
          {!isSidebarCollapsed && <span className="text-sm font-medium">Stats Panel</span>}
        </button>
      </div>

      {/* Modals */}
      {showCourtModal && <CourtEntryModal onClose={() => setShowCourtModal(false)} />}
      {showStatsPanel && <ExpandedStatsPanel onClose={() => setShowStatsPanel(false)} />}
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
  className = '' 
}: { 
  icon: any, 
  label: string, 
  to: string, 
  active: boolean, 
  collapsed: boolean, 
  badge?: string, 
  className?: string 
}) {
  return (
    <Link
      to={to}
      className={`
        flex items-center gap-3 px-4 py-2 mx-2 rounded-lg transition-all duration-200 group
        ${active 
          ? 'bg-purple-600/20 text-purple-400' 
          : 'text-gray-400 hover:bg-white/5 hover:text-white'
        }
        ${collapsed ? 'justify-center px-2' : ''}
        ${className}
      `}
      title={collapsed ? label : undefined}
    >
      <Icon size={20} className={`min-w-[20px] ${active ? 'text-purple-400' : 'group-hover:text-white'}`} />
      
      {!collapsed && (
        <div className="flex items-center justify-between flex-1 min-w-0">
          <span className="text-sm font-medium truncate">{label}</span>
          {badge && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-purple-600 text-white rounded-full">
              {badge}
            </span>
          )}
        </div>
      )}
      
      {collapsed && badge && (
        <div className="absolute top-0 right-0 w-2 h-2 bg-purple-600 rounded-full"></div>
      )}
    </Link>
  )
}
