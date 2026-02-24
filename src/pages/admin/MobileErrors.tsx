import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { hasRole, UserRole, supabase } from '../../lib/supabase'
import { 
  Smartphone, 
  AlertTriangle, 
  RefreshCw, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Clock,
  User,
  Monitor
} from 'lucide-react'
import { useMobileErrorStore, MobileError } from '../../hooks/useMobileErrorTracking'

// Interface for database error format
interface DbMobileError {
  id: string
  message: string
  stack: string | null
  component: string | null
  user_id: string | null
  device_info: {
    userAgent: string
    viewportWidth: number
    viewportHeight: number
    platform: string
  } | null
  created_at: string
}

export default function MobileErrors() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { clearErrors } = useMobileErrorStore()
  
  const [expandedError, setExpandedError] = useState<string | null>(null)
  const [localErrors, setLocalErrors] = useState<MobileError[]>([])

  // Check if user is admin
  const isAdmin = hasRole(profile as any, UserRole.ADMIN)

  useEffect(() => {
    if (!isAdmin) {
      navigate('/access-denied')
    }
  }, [isAdmin, navigate])

  // Force refresh by reading from database
  const handleRefresh = async () => {
    setLocalErrors([]) // Clear while loading
    try {
      const { data, error } = await supabase
        .from('mobile_errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (error) {
        console.error('Error fetching mobile errors:', error)
        return
      }
      
      if (data) {
        // Transform database errors to MobileError format
        const transformedErrors: MobileError[] = data.map((err: DbMobileError) => ({
          id: err.id,
          message: err.message,
          stack: err.stack || undefined,
          component: err.component || undefined,
          timestamp: err.created_at,
          userId: err.user_id || undefined,
          deviceInfo: err.device_info || undefined,
        }))
        setLocalErrors(transformedErrors)
      }
    } catch (e) {
      console.error('Error reading mobile errors from database:', e)
    }
  }

  // Load errors on mount
  useEffect(() => {
    handleRefresh()
  }, []) // Only run once on mount

  // Clear all errors from database
  const handleClearErrors = async () => {
    if (confirm('Are you sure you want to clear all mobile errors?')) {
      try {
        const { error } = await supabase
          .from('mobile_errors')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all (always true condition)
        
        if (error) {
          console.error('Error clearing mobile errors:', error)
        }
        
        setLocalErrors([])
      } catch (e) {
        console.error('Error clearing mobile errors:', e)
      }
    }
  }

  // Toggle error expansion
  const toggleExpand = (id: string) => {
    setExpandedError(expandedError === id ? null : id)
  }

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  // Get time ago
  const getTimeAgo = (timestamp: string) => {
    const now = new Date()
    const then = new Date(timestamp)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-600/20 rounded-xl border border-purple-500/30">
              <Smartphone className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Mobile Errors</h1>
              <p className="text-slate-400 text-sm">
                Track and debug errors from Mobile Shell interface
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={handleClearErrors}
              disabled={localErrors.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-red-500/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider">Total Errors</p>
                <p className="text-2xl font-bold">{localErrors.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider">Latest Error</p>
                <p className="text-lg font-bold">
                  {localErrors.length > 0 ? getTimeAgo(localErrors[0].timestamp) : 'N/A'}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Monitor className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider">Unique Components</p>
                <p className="text-2xl font-bold">
                  {new Set(localErrors.map(e => e.component)).size}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error List */}
        {localErrors.length === 0 ? (
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-xl p-12 text-center">
            <Smartphone className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-300 mb-2">No Mobile Errors</h3>
            <p className="text-slate-500">
              Mobile shell errors will appear here when users encounter issues.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {localErrors.map((error) => (
              <div
                key={error.id}
                className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden"
              >
                {/* Error Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                  onClick={() => toggleExpand(error.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white truncate">
                          {error.message}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                          {error.component && (
                            <span className="flex items-center gap-1">
                              <Monitor className="w-3 h-3" />
                              {error.component}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getTimeAgo(error.timestamp)}
                          </span>
                          {error.userId && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {error.userId.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {expandedError === error.id ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Error Details */}
                {expandedError === error.id && (
                  <div className="border-t border-white/5 p-4 bg-black/20">
                    <div className="grid gap-4">
                      {/* Timestamp */}
                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                          Timestamp
                        </p>
                        <p className="text-sm text-slate-300">
                          {formatTimestamp(error.timestamp)}
                        </p>
                      </div>

                      {/* Full Error Message */}
                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                          Error Message
                        </p>
                        <p className="text-sm text-red-300 bg-red-900/20 p-3 rounded-lg">
                          {error.message}
                        </p>
                      </div>

                      {/* Stack Trace */}
                      {error.stack && (
                        <div>
                          <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                            Stack Trace
                          </p>
                          <pre className="text-xs text-slate-400 bg-black/40 p-3 rounded-lg overflow-auto max-h-48">
                            {error.stack}
                          </pre>
                        </div>
                      )}

                      {/* User ID */}
                      {error.userId && (
                        <div>
                          <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                            User ID
                          </p>
                          <p className="text-sm text-slate-300 font-mono">
                            {error.userId}
                          </p>
                        </div>
                      )}

                      {/* Device Info */}
                      {error.deviceInfo && (
                        <div>
                          <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                            Device Info
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-slate-800/50 p-2 rounded">
                              <span className="text-slate-500">Platform:</span>{' '}
                              <span className="text-slate-300">{error.deviceInfo.platform}</span>
                            </div>
                            <div className="bg-slate-800/50 p-2 rounded">
                              <span className="text-slate-500">Viewport:</span>{' '}
                              <span className="text-slate-300">
                                {error.deviceInfo.viewportWidth}x{error.deviceInfo.viewportHeight}
                              </span>
                            </div>
                            <div className="col-span-2 bg-slate-800/50 p-2 rounded">
                              <span className="text-slate-500">User Agent:</span>{' '}
                              <span className="text-slate-300 break-all">
                                {error.deviceInfo.userAgent}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
