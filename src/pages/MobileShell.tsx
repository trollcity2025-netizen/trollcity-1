import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { hasRole, UserRole } from '../lib/supabase'
import {
  Shield,
  Crown,
} from 'lucide-react'

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()

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
    allowAdminOverride: true,
  })

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

      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
