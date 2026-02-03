import React, { useEffect, useCallback, memo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { hasRole, UserRole } from '../lib/supabase'
import {
  Video,
  MessageSquare,
  Wallet,
  Gavel,
  Shield,
  Radio,
  Users,
  LayoutDashboard,
  HelpCircle,
  Crown,
  User,
  LucideIcon,
  Landmark,
} from 'lucide-react'
import { cn } from '../lib/utils'

interface NavButtonProps {
  icon: LucideIcon
  label: string
  sublabel: string
  path: string
  colorClass: string
  bgClass: string
  borderClass?: string
  isActive: boolean
  onClick: (path: string) => void
}

export default function MobileShell() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const go = useCallback(
    (path: string) => {
      navigate(path)
    },
    [navigate]
  )

  useEffect(() => {
    if (!user) navigate('/login', { replace: true })
  }, [user, navigate])

  if (!user) return null

  if (!profile) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#05010a] text-white/70">
        <div className="animate-pulse">Loading profile...</div>
      </div>
    )
  }

  const isAdmin = hasRole(profile as any, UserRole.ADMIN)
  const isOfficer = hasRole(profile as any, [UserRole.TROLL_OFFICER, UserRole.LEAD_TROLL_OFFICER], {
    requireActive: true,
    allowAdminOverride: true,
  })

  const isActive = (base: string) => pathname === base || pathname.startsWith(base + '/')
  const profilePath = profile.username ? `/profile/${profile.username}` : '/profile/setup'

  return (
    <div className="h-dvh flex flex-col bg-gradient-to-b from-[#05010a] via-[#080316] to-[#05010a] pb-safe">
      <div className="px-4 pt-safe pt-4 pb-3 border-b border-white/10 bg-black/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-white/40">Troll City</div>
            <div className="text-lg font-bold text-white">Mobile Control Center</div>
            <div className="text-xs text-white/60 mt-1">All your tools in one mobile view.</div>
          </div>

          <div className="flex flex-col items-end text-right">
            <div className="text-sm font-semibold text-white truncate max-w-[120px]">
              {profile.username || profile.email || 'User'}
            </div>

            <div className="flex items-center gap-1 text-[11px] text-white/50">
              {isAdmin ? (
                <>
                  <Crown className="w-3 h-3 text-yellow-400" />
                  <span>Admin</span>
                </>
              ) : isOfficer ? (
                <>
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span>Officer</span>
                </>
              ) : (
                <span>Viewer</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.25em] text-white/50">My App</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NavButton
              icon={Video}
              label="Live"
              sublabel="Browse streams"
              path="/live"
              colorClass="text-purple-400"
              bgClass="bg-purple-500/20"
              isActive={isActive('/live')}
              onClick={go}
            />
            <NavButton
              icon={Radio}
              label="Go Live"
              sublabel="Start broadcasting"
              path="/go-live"
              colorClass="text-purple-200"
              bgClass="bg-purple-600/30"
              borderClass="border-purple-500/40"
              isActive={isActive('/go-live')}
              onClick={go}
            />
            <NavButton
              icon={MessageSquare}
              label="TCPS"
              sublabel="Troll City Postal Service"
              path="/tcps"
              colorClass="text-cyan-300"
              bgClass="bg-cyan-500/20"
              isActive={isActive('/tcps')}
              onClick={go}
            />
            <NavButton
              icon={User}
              label="Profile"
              sublabel="View and edit profile"
              path={profilePath}
              colorClass="text-indigo-300"
              bgClass="bg-indigo-500/20"
              isActive={isActive('/profile')}
              onClick={go}
            />
            <NavButton
              icon={Wallet}
              label="Wallet"
              sublabel="Coins and payouts"
              path="/wallet"
              colorClass="text-amber-300"
              bgClass="bg-amber-500/20"
              isActive={isActive('/wallet')}
              onClick={go}
            />
            <NavButton
              icon={Gavel}
              label="Troll Court"
              sublabel="Cases and sessions"
              path="/troll-court"
              colorClass="text-rose-300"
              bgClass="bg-rose-500/20"
              isActive={isActive('/troll-court')}
              onClick={go}
            />
            <NavButton
              icon={Landmark}
              label="City Hall"
              sublabel="Admin Queue"
              path="/city-hall"
              colorClass="text-yellow-300"
              bgClass="bg-yellow-500/20"
              isActive={isActive('/city-hall')}
              onClick={go}
            />
            <NavButton
              icon={HelpCircle}
              label="Support"
              sublabel="Help and safety"
              path="/support"
              colorClass="text-sky-300"
              bgClass="bg-sky-500/20"
              isActive={isActive('/support')}
              onClick={go}
            />
          </div>
        </section>

        {isOfficer && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.25em] text-emerald-300/80">Officer Tools</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NavButton
                icon={Users}
                label="Officer Lounge"
                sublabel="Live patrol and chat"
                path="/officer/lounge"
                colorClass="text-emerald-300"
                bgClass="bg-emerald-500/20"
                borderClass="border-emerald-500/40 bg-emerald-900/40"
                isActive={isActive('/officer/lounge')}
                onClick={go}
              />
              <NavButton
                icon={LayoutDashboard}
                label="Officer Dashboard"
                sublabel="Stats and cases"
                path="/officer/dashboard"
                colorClass="text-emerald-300"
                bgClass="bg-emerald-500/20"
                borderClass="border-emerald-500/40 bg-emerald-900/40"
                isActive={isActive('/officer/dashboard')}
                onClick={go}
              />
              <NavButton
                icon={Shield}
                label="Moderation"
                sublabel="Kick, ban, mute tools"
                path="/officer/moderation"
                colorClass="text-emerald-300"
                bgClass="bg-emerald-500/20"
                borderClass="border-emerald-500/40 bg-emerald-900/40"
                isActive={isActive('/officer/moderation')}
                onClick={go}
              />
              <NavButton
                icon={Video}
                label="Officer Stream"
                sublabel="Multi-box live view"
                path="/officer/stream"
                colorClass="text-emerald-300"
                bgClass="bg-emerald-500/20"
                borderClass="border-emerald-500/40 bg-emerald-900/40"
                isActive={isActive('/officer/stream')}
                onClick={go}
              />
            </div>
          </section>
        )}

        {isAdmin && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.25em] text-yellow-300/80">Admin</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NavButton
                icon={LayoutDashboard}
                label="Admin Dashboard"
                sublabel="System overview"
                path="/admin"
                colorClass="text-yellow-300"
                bgClass="bg-yellow-500/20"
                borderClass="border-yellow-500/40 bg-yellow-900/40"
                isActive={isActive('/admin')}
                onClick={go}
              />
              <NavButton
                icon={Shield}
                label="Officer Reports"
                sublabel="Review cases"
                path="/admin/officer-reports"
                colorClass="text-yellow-300"
                bgClass="bg-yellow-500/20"
                borderClass="border-yellow-500/40 bg-yellow-900/40"
                isActive={isActive('/admin/officer-reports')}
                onClick={go}
              />
              <NavButton
                icon={Gavel}
                label="Ban Management"
                sublabel="Appeals and bans"
                path="/admin/ban-management"
                colorClass="text-yellow-300"
                bgClass="bg-yellow-500/20"
                borderClass="border-yellow-500/40 bg-yellow-900/40"
                isActive={isActive('/admin/ban-management')}
                onClick={go}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

const NavButton = memo(function NavButton({
  icon: Icon,
  label,
  sublabel,
  path,
  colorClass,
  bgClass,
  borderClass,
  isActive,
  onClick,
}: NavButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(path)}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-3 rounded-2xl px-3 py-3 transition-all active:scale-[0.97] focus:outline-none w-full text-left rgb-outline-card',
        'bg-[#110e1b]',
        isActive ? 'bg-[#1a1625]' : 'hover:bg-[#1a1625]',
        borderClass
      )}
    >
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center relative z-10', bgClass, colorClass)}>
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex flex-col items-start text-left relative z-10">
        <div className={cn('text-xs font-semibold', isActive ? 'text-white' : 'text-white/90')}>{label}</div>
        <div className="text-[11px] text-white/60">{sublabel}</div>
      </div>
    </button>
  )
})
