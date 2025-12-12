import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Scale, Gavel, Users, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import AuthorityPanel from '../components/AuthorityPanel'
import CourtRulingArchive from '../components/CourtRulingArchive'
import CourtDocketView from '../components/CourtDocketView'
import CourtDocketDashboard from '../components/CourtDocketDashboard'
import PublicDocketBoard from '../components/PublicDocketBoard'

export default function TrollCourt() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [courtSession, setCourtSession] = useState<any>(null)

  // Check if user can manage court sessions (admins and lead officers)
  const canManageCourt = profile?.role === 'admin' || profile?.is_admin || profile?.is_lead_officer

  const handleJoinCourtSession = () => {
    navigate('/court-room?mode=participant')
  }

  const handleWatchCourtProceedings = () => {
    navigate('/court-room?mode=spectator')
  }

  const handleStartCourtSession = async () => {
    if (!canManageCourt || !user) return

    try {
      // Create a new court session
      const { data: session, error } = await supabase
        .from('court_sessions')
        .insert({
          started_by: user.id,
          status: 'live',
          started_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      // Redirect to the new court room with session ID
      navigate(`/troll-court/session/${session.id}`)
    } catch (error) {
      console.error('Error starting court session:', error)
      toast.error('Failed to start court session')
    }
  }

  const handleEndCourtSession = async () => {
    if (!canManageCourt) return

    try {
      // Only admins can end court sessions
      const { error } = await supabase
        .from('court_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('status', 'live')

      if (error) throw error

      setCourtSession(null)
    } catch (error) {
      console.error('Error ending court session:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6 pt-16 lg:pt-6">
      <div className="max-w-7xl mx-auto flex gap-6">
        <div className="flex-1 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Scale className="w-12 h-12 text-purple-400" />
            <div>
              <h1 className="text-4xl font-bold">Troll Court</h1>
              <p className="text-gray-400">Justice, drama, and official rulings for Troll City</p>
            </div>
          </div>
        </div>

        {/* Court Status - Now Automatic */}
        <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Gavel className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-bold">Court Status</h2>
            </div>
            <div className="flex items-center gap-2">
              {courtSession?.status === 'live' ? (
                <span className="px-3 py-1 bg-yellow-600 text-white rounded-full text-sm flex items-center gap-1 animate-pulse">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  ⚖ IN SESSION
                </span>
              ) : (
                <span className="px-3 py-1 bg-gray-600 text-white rounded-full text-sm">
                  Court Adjourned
                </span>
              )}
            </div>
          </div>

          {courtSession?.status === 'live' ? (
            <div className="space-y-4">
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-yellow-400" />
                  <span className="font-semibold text-yellow-400">⚖ COURT IS IN SESSION</span>
                </div>
                <p className="text-sm text-gray-300">
                  Authority is presiding. Official rulings and judgments may be issued.
                </p>
                <div className="mt-3 text-xs text-gray-400">
                  Auto-started when authority entered courtroom
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleJoinCourtSession}
                  className="py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Users className="w-4 h-4" />
                  Join Court
                </button>
                <button
                  onClick={handleWatchCourtProceedings}
                  className="py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Clock className="w-4 h-4" />
                  Watch Live
                </button>
              </div>

              {canManageCourt && (
                <button
                  onClick={handleEndCourtSession}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors text-sm"
                >
                  End Court Session (Admin Only)
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-900/50 border border-gray-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <span className="font-semibold text-gray-400">Court is Adjourned</span>
                </div>
                <p className="text-sm text-gray-300">
                  Court sessions start automatically when Troll Officers or Administrators enter the courtroom.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleJoinCourtSession}
                  className="py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Users className="w-4 h-4" />
                  Enter Courtroom
                </button>
                <button
                  onClick={handleWatchCourtProceedings}
                  className="py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Clock className="w-4 h-4" />
                  View Archive
                </button>
              </div>

              {canManageCourt && (
                <button
                  onClick={handleStartCourtSession}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Gavel className="w-4 h-4" />
                  Start Court Session
                </button>
              )}

              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-300 text-center">
                  💡 <strong>Authority Control:</strong> Court sessions can be started manually by authorized officials.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Court Rules */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5 text-purple-400" />
              Court Rules
            </h3>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>All rulings must be issued by authorized Troll Court officials</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>Evidence must be presented before any judgment is made</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>Appeals may be filed within 24 hours of ruling</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>All court sessions are recorded for transparency</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Court Officials
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Chief Justice</span>
                <span className="text-xs px-2 py-1 bg-purple-600 rounded-full">Admin</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Senior Judges</span>
                <span className="text-xs px-2 py-1 bg-blue-600 rounded-full">Lead Officers</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Court Officers</span>
                <span className="text-xs px-2 py-1 bg-green-600 rounded-full">Troll Officers</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Court Clerk</span>
                <span className="text-xs px-2 py-1 bg-gray-600 rounded-full">System</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Cases */}
        <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Gavel className="w-5 h-5 text-purple-400" />
            Recent Court Cases
          </h3>

          <div className="space-y-3">
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">Case #2024-001</span>
                <span className="text-xs px-2 py-1 bg-green-600 rounded-full">Resolved</span>
              </div>
              <p className="text-sm text-gray-300">Stream disruption complaint - Warning issued</p>
              <div className="text-xs text-gray-500 mt-1">Resolved 2 days ago</div>
            </div>

            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">Case #2024-002</span>
                <span className="text-xs px-2 py-1 bg-yellow-600 rounded-full">Under Review</span>
              </div>
              <p className="text-sm text-gray-300">Coin transaction dispute - Evidence gathering</p>
              <div className="text-xs text-gray-500 mt-1">Filed 1 day ago</div>
            </div>

            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">Case #2024-003</span>
                <span className="text-xs px-2 py-1 bg-blue-600 rounded-full">Scheduled</span>
              </div>
              <p className="text-sm text-gray-300">Marketplace seller violation - Court date set</p>
              <div className="text-xs text-gray-500 mt-1">Hearing in 3 days</div>
            </div>
          </div>
        </div>

        {/* User Court Docket */}
        <CourtDocketView />

        {/* Public Docket Board */}
        <PublicDocketBoard />

        {/* Admin Docket Dashboard */}
        {canManageCourt && (
          <CourtDocketDashboard />
        )}

        {/* Court Ruling Archive - The Myth Maker */}
        <CourtRulingArchive />
      </div>

      {/* Authority Panel - Right Side Rail */}
      <div className="hidden lg:block">
        <div className="sticky top-6">
          <AuthorityPanel />
        </div>
      </div>
    </div>
    </div>
  )
}