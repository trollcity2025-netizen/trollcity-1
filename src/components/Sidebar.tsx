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
  Settings,
  LayoutDashboard,
  Banknote,
  Zap,
  Aperture, // Troll Wheel icon
  FileText,
} from 'lucide-react'
import { useAuthStore } from '../lib/store'
import { supabase, isAdminEmail } from '../lib/supabase'

export default function Sidebar() {
  const { profile, user } = useAuthStore()
  const ADMIN_EMAIL = (import.meta as any).env?.VITE_ADMIN_EMAIL || 'trollcity2025@gmail.com'
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

  useEffect(() => {
    const checkAccess = async () => {
      if (!profile) { setCanSeeOfficer(false); setCanSeeFamilyLounge(false); return }
      const isAdmin = profile.role === 'admin'
      const isOfficer = profile.role === 'troll_officer'
      setCanSeeOfficer(isAdmin || isOfficer)

      if (isAdmin) { setCanSeeFamilyLounge(true); return }
      try {
        const { data: member } = await supabase
          .from('troll_family_members')
          .select('approved, has_crown_badge')
          .eq('user_id', profile.id)
          .maybeSingle()

        const { data: payment } = await supabase
          .from('coin_transactions')
          .select('id')
          .eq('user_id', profile.id)
          .eq('status', 'completed')
          .ilike('description', '%Family Lounge%')
          .maybeSingle()

        setCanSeeFamilyLounge(!!member?.approved && !!member?.has_crown_badge && !!payment)
      } catch {
        setCanSeeFamilyLounge(false)
      }
    }
    checkAccess()
  }, [profile?.id, profile?.role])

  return (
    <div className="w-64 min-h-screen bg-[#0A0A14] text-white flex flex-col border-r gold-border shadow-xl">

      {/* Profile Block */}
      <div className="p-5 text-center gold-border">
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
          @{profile?.username || (user?.email ? user.email.split('@')[0] : 'Guest')}
          {badge && <span className="text-yellow-400">{badge}</span>}
        </p>

        <p className="text-xs text-gray-400">
          {profile?.role === 'admin' ? 'Admin' : 'Member'}
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
        <MenuLink to="/store" icon={<Coins />} label="Coin Store" active={isActive('/store')} />
        
        {/* Troll Wheel */}
        <MenuLink to="/wheel" icon={<Aperture />} label="Troll Wheel" active={isActive('/wheel')} />

        <MenuLink to="/leaderboard" icon={<span className="inline-block w-5 h-5">🏆</span>} label="Leaderboard" active={isActive('/leaderboard')} />
        {canSeeFamilyLounge && (
          <MenuLink to="/family" icon={<Users />} label="Troll Family Lounge" active={isActive('/family')} />
        )}
        <MenuLink to="/go-live" icon={<Radio />} label="Go Live" active={isActive('/go-live')} />
        <MenuLink to="/trollifications" icon={<Gift />} label="Trollifications" active={isActive('/trollifications')} />
        {canSeeOfficer && (
          <MenuLink to="/officer/lounge" icon={<Shield />} label="Officer Moderation" active={isActive('/officer/lounge')} />
        )}
        <MenuLink to="/earnings" icon={<Banknote />} label="Earnings" active={isActive('/earnings')} />
        <MenuLink to="/support" icon={<FileText />} label="Support" active={isActive('/support')} />
        {(profile?.role === 'admin' || isAdminEmail(user?.email)) && (
          <MenuLink to="/rfc" icon={<Shield />} label="RFC" active={isActive('/rfc')} />
        )}
      </nav>

      {/* Admin Section */}
      {(profile?.role === 'admin' || isAdminEmail(user?.email)) && (
        <div className="p-4 gold-border">
          <p className="text-gray-500 uppercase text-xs mb-2">Admin Controls</p>

          <MenuLink to="/admin" icon={<LayoutDashboard />} label="Admin Dashboard" active={isActive('/admin')} />
        </div>
      )}

      {/* Settings */}
      <div className="p-4 gold-border">
        <MenuLink to="/account/wallet" icon={<Settings />} label="Settings & Account" active={isActive('/account/wallet')} />
      </div>
    </div>
  )
}

function MenuLink({ to, icon, label, active }: any) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
        active
          ? 'bg-purple-600 text-white gold-border'
          : 'hover:bg-[#1F1F2E] text-gray-300'
      }`}
    >
      <span className="w-5 h-5">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
