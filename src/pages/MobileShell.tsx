import React, { useEffect, ReactNode, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { hasRole, UserRole } from '../lib/supabase'
import { Shield, Crown, AlertTriangle, X } from 'lucide-react'
import BottomNavigation from '../components/BottomNavigation'
import { useMobileErrorStore, trackMobileError, MobileError } from '../hooks/useMobileErrorTracking'

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class MobileShellErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[MobileShell] Error caught by boundary:', error, errorInfo)
    
    // Track the error using the store directly
    try {
      const userId = useAuthStore.getState()?.user?.id
      
      trackMobileError(error, 'MobileShell', userId)
    } catch (e) {
      console.error('[MobileShell] Failed to track error:', e)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#05010a] flex items-center justify-center p-4">
          <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <h2 className="text-xl font-bold text-white">Mobile Shell Error</h2>
            </div>
            <p className="text-red-300 text-sm mb-4">
              Something went wrong in the mobile interface.
            </p>
            <details className="mb-4">
              <summary className="text-slate-400 text-sm cursor-pointer">
                Error Details
              </summary>
              <pre className="mt-2 text-xs text-red-300 bg-black/30 p-3 rounded overflow-auto max-h-40">
                {this.state.error?.message}
                {'\n'}
                {this.state.error?.stack}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white font-semibold rounded-lg"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default function MobileShell({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { errors } = useMobileErrorStore()
  const [showErrorBanner, setShowErrorBanner] = useState(false)
  const [latestError, setLatestError] = useState<MobileError | null>(null)

  // Debug: Log when MobileShell mounts
  useEffect(() => {
    console.log('[MobileShell] Mounted, user:', !!user, 'profile:', !!profile)
    
    // Track mount for debugging
    try {
      trackMobileError(
        new Error('[MobileShell] Component mounted'),
        'MobileShell-mount',
        user?.id
      )
    } catch {}
  }, [])

  // Check for new errors and show banner - fetch from localStorage directly
  useEffect(() => {
    const checkErrors = () => {
      try {
        const stored = localStorage.getItem('mobile-error-store')
        if (stored) {
          const parsed = JSON.parse(stored)
          const storedErrors = parsed?.state?.errors || parsed?.errors || []
          if (storedErrors.length > 0) {
            setLatestError(storedErrors[0])
            setShowErrorBanner(true)
          }
        }
      } catch {}
    }
    
    // Check on mount
    checkErrors()
    
    // Check periodically for new errors
    const interval = setInterval(checkErrors, 2000)
    return () => clearInterval(interval)
  }, [])

  // Detect immersive pages (broadcast / live room / watch / battle)
  const isImmersive =
    location.pathname.startsWith('/broadcast') ||
    location.pathname.startsWith('/live-room') ||
    location.pathname.startsWith('/watch') ||
    location.pathname.startsWith('/battle') ||
    location.pathname.startsWith('/live')

  useEffect(() => {
    if (!user) navigate('/auth', { replace: true })
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
  const isOfficer = hasRole(
    profile as any,
    [UserRole.TROLL_OFFICER, UserRole.LEAD_TROLL_OFFICER],
    { allowAdminOverride: true }
  )

  return (
    <MobileShellErrorBoundary>
      <div className="relative w-full h-[100dvh] bg-[#05010a] text-white overflow-hidden flex flex-col">
        {/* Error Banner - Shows when there's an error */}
        {showErrorBanner && latestError && (
          <div className="bg-red-900/90 border-b border-red-500/50 px-4 py-3 flex items-start gap-3 z-50">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">
                {latestError.message}
              </p>
              <p className="text-xs text-red-300 mt-1">
                Component: {latestError.component}
              </p>
            </div>
            <button 
              onClick={() => setShowErrorBanner(false)}
              className="text-red-300 hover:text-white shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* HEADER */}
        {!isImmersive && (
          <header className="shrink-0 px-4 pt-safe pb-2 border-b border-white/10 bg-black/40 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.3em] text-white/40">
                  Troll City
                </div>
                <div className="text-lg font-bold text-white">
                  Mobile Control Center
                </div>
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
          </header>
        )}

        {/* CONTENT */}
        <main
          className={`relative flex-1 ${
            isImmersive
              ? 'w-full h-full overflow-hidden'
              : 'overflow-y-auto pb-[80px]'
          }`}
        >
          {children}
        </main>

        {/* BOTTOM NAV */}
        {!isImmersive && (
          <div className="absolute bottom-0 left-0 right-0 z-40 pb-safe">
            <BottomNavigation />
          </div>
        )}
      </div>
    </MobileShellErrorBoundary>
  )
}
