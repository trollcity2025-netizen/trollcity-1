import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { canDo } from '../lib/permissions.js'
import { Scale, Gavel, Users, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

export default function TrollCourt() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [courtSession, setCourtSession] = useState<any>(null)
  const [isStartingSession, setIsStartingSession] = useState(false)

  // Check if user can start court sessions
  const canStartCourt = canDo(profile?.role, "startCourtSession")

  const handleStartCourtSession = async () => {
    if (!canStartCourt) return

    setIsStartingSession(true)
    try {
      // Simulate starting a court session
      // In real implementation, this would create a database record
      setCourtSession({
        id: 'court-' + Date.now(),
        startedBy: user?.id,
        startedAt: new Date().toISOString(),
        status: 'active',
        participants: []
      })

      // Navigate to the court room
      navigate('/court-room')
    } catch (error) {
      console.error('Error starting court session:', error)
    } finally {
      setIsStartingSession(false)
    }
  }

  const handleEndCourtSession = () => {
    setCourtSession(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
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

        {/* Court Status */}
        <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Gavel className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-bold">Court Status</h2>
            </div>
            <div className="flex items-center gap-2">
              {courtSession ? (
                <span className="px-3 py-1 bg-green-600 text-white rounded-full text-sm flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  In Session
                </span>
              ) : (
                <span className="px-3 py-1 bg-gray-600 text-white rounded-full text-sm">
                  Court Adjourned
                </span>
              )}
            </div>
          </div>

          {courtSession ? (
            <div className="space-y-4">
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="font-semibold text-green-400">Court is in Session</span>
                </div>
                <p className="text-sm text-gray-300">
                  Session started by authorized personnel. Official rulings and judgments may be issued.
                </p>
                <div className="mt-3 text-xs text-gray-400">
                  Started: {new Date(courtSession.startedAt).toLocaleString()}
                </div>
              </div>

              {canStartCourt && (
                <button
                  onClick={handleEndCourtSession}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors"
                >
                  End Court Session
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
                  No active court session. Troll Court is available for viewing official rulings and case history.
                </p>
              </div>

              {canStartCourt ? (
                <button
                  onClick={handleStartCourtSession}
                  disabled={isStartingSession}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {isStartingSession ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-b-transparent"></div>
                      Starting Session...
                    </>
                  ) : (
                    <>
                      <Gavel className="w-4 h-4" />
                      Start Court Session
                    </>
                  )}
                </button>
              ) : (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    <span className="font-semibold text-red-400">Access Restricted</span>
                  </div>
                  <p className="text-sm text-gray-300">
                    You are not authorized to start a court session. Only Troll Officers and administrators may initiate official court proceedings.
                  </p>
                </div>
              )}
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
      </div>
    </div>
  )
}