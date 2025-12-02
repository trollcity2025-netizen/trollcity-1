import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
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
} from 'lucide-react'
import { useAuthStore } from '../lib/store'
import { supabase, isAdminEmail } from '../lib/supabase'

export default function Sidebar() {
  const { profile, user } = useAuthStore()
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path

  const badge =
    profile?.role === 'admin'
      ? '🛡️'
      : profile?.tier && ['gold', 'platinum', 'diamond'].includes(profile.tier)
      ? '⭐'
      : null

  const [canSeeOfficer, setCanSeeOfficer] = useState(false)
  const [canSeeFamilyLounge, setCanSeeFamilyLounge] = useState(false)
  const isAdmin = profile?.role === 'admin'

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
          .eq('type', 'family')
          .eq('status', 'approved')
          .maybeSingle()

        setCanSeeFamilyLounge(!!familyApp)
      } catch {
        setCanSeeFamilyLounge(false)
      }
    }
    checkAccess()
  }, [profile?.id, profile?.role])

  return (
    <div className="w-64 min-h-screen bg-[#0A0A14] text-white flex flex-col border-r border-[#2C2C2C] shadow-xl">

      {/* Profile Block */}
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

        <p className="mt-3 font-bold text-lg flex items-center justify-center gap-2">
          @{profile?.username || 'Guest'}
          {badge && <span className="text-yellow-400">{badge}</span>}
        </p>

        <p className="text-xs text-gray-400">
          {profile?.role === 'admin' ? 'Admin' : profile?.role === 'troll_officer' ? 'Troll Officer' : 'Member'}
        </p>

        <div className="flex justify-center gap-3 mt-4 text-xs">
          <div className="bg-[#1C1C24] px-3 py-2 rounded-lg border border-purple-500/40 text-purple-300">
            Paid: {profile?.paid_coin_balance ?? 0}
          </div>
          <div className="bg-[#1C1C24] px-3 py-2 rounded-lg border border-green-500/40 text-green-300">
            Free: {profile?.free_coin_balance ?? 0}
          </div>
        </div>
      </div>

      {/* Main Menu */}
      <nav className="flex-1 p-4 space-y-1">
        <MenuLink to="/" icon={<Home />} label="Home" active={isActive('/')} />
        <MenuLink to="/messages" icon={<MessageSquare />} label="Messages" active={isActive('/messages')} />
        <MenuLink to="/following" icon={<UserCheck />} label="Following" active={isActive('/following')} />
        <MenuLink to="/store" icon={<Coins />} label="Coin Store" active={isActive('/store')} />
        <MenuLink to="/transactions" icon={<Receipt />} label="Transactions" active={isActive('/transactions')} />


        <MenuLink to="/leaderboard" icon={<span className="inline-block w-5 h-5">🏆</span>} label="Leaderboard" active={isActive('/leaderboard')} />
        <MenuLink to="/wall" icon={<span className="inline-block w-5 h-5">🧌</span>} label="Troll City Wall" active={isActive('/wall')} />

        <MenuLink to="/go-live" icon={<Radio />} label="Go Live" active={isActive('/go-live')} />
        <MenuLink to="/battles" icon={<Sword />} label="Battle History" active={isActive('/battles')} />
        <MenuLink to="/empire-partner" icon={<UserPlus />} label="Empire Partner" active={isActive('/empire-partner')} />
        <MenuLink to="/trollifications" icon={<Gift />} label="Trollifications" active={isActive('/trollifications')} />
        {/* Note: Trollifications is the unified notifications page */}
        
        {/* Applications - Show for everyone */}
        <MenuLink to="/apply" icon={<FileText />} label="Applications" active={isActive('/apply')} />

        {/* Troll Officer Lounge - Only for admin and troll_officer role */}
        {canSeeOfficer && (
          <>
            <MenuLink to="/officer/lounge" icon={<Shield />} label="Officer Lounge" active={isActive('/officer/lounge')} />
            <MenuLink to="/officer/moderation" icon={<Shield />} label="Officer Moderation" active={isActive('/officer/moderation')} />
          </>
        )}

        {/* Troll Family Lounge - Only for admin, troll_officer, OR approved family app */}
        {canSeeFamilyLounge && (
          <MenuLink to="/family" icon={<Users />} label="Troll Family Lounge" active={isActive('/family')} />
        )}

        <MenuLink to="/earnings" icon={<Banknote />} label="Earnings" active={isActive('/earnings') || isActive('/my-earnings')} />
        <MenuLink to="/support" icon={<FileText />} label="Support" active={isActive('/support')} />
        <MenuLink to="/safety" icon={<Shield />} label="Safety & Policies" active={isActive('/safety')} />

        {/* 🔐 RFC — Only Admin */}
        {profile?.role === 'admin' && (
          <MenuLink to="/rfc" icon={<Shield />} label="RFC" active={isActive('/rfc')} />
        )}

        {/* Admin Earnings Dashboard — Only Admin */}
        {profile?.role === 'admin' && (
          <MenuLink to="/admin/earnings" icon={<Banknote />} label="Earnings Dashboard" active={isActive('/admin/earnings')} />
        )}
      </nav>

      {/* Lead Officer Section — Only Lead Officers */}
      {profile?.is_lead_officer && (
        <div className="p-4 border-t border-[#2C2C2C]">
          <p className="text-gray-500 uppercase text-xs mb-2">Lead Officer</p>
          <MenuLink to="/lead-officer" icon={<Shield />} label="Lead Officer HQ" active={isActive('/lead-officer')} />
        </div>
      )}

      {/* Admin Dashboard — Only Admin */}
      {profile?.role === 'admin' && (
        <div className="p-4 border-t border-[#2C2C2C]">
          <p className="text-gray-500 uppercase text-xs mb-2">Admin Controls</p>
          <MenuLink to="/admin" icon={<LayoutDashboard />} label="Admin Dashboard" active={isActive('/admin')} />
          <MenuLink to="/admin/officer-reports" icon={<FileText />} label="Officer Reports" active={isActive('/admin/officer-reports')} />
          <MenuLink to="/store-debug" icon={<Bug />} label="Store Debug" active={isActive('/store-debug')} />
          <MenuLink to="/changelog" icon={<ListChecks />} label="Updates & Changes" active={isActive('/changelog')} />
        </div>
      )}

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
      <span className="w-5 h-5">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
