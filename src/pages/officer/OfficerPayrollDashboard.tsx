import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { DollarSign, Clock, TrendingUp, Calendar, Award, Target } from 'lucide-react'
import { calculateOfficerBaseCoins, calculateTotalOfficerEarnings, OFFICER_BASE_HOURLY_COINS } from '../../lib/officerPay'
import OfficerPoolPanel from './components/OfficerPoolPanel'

interface WorkSession {
  id: string
  clock_in: string
  clock_out: string | null
  hours_worked: number
  coins_earned: number
  auto_clocked_out: boolean
  streams?: { title: string | null }
}

interface EarningsBreakdown {
  basePay: number
  liveEarnings: number
  courtBonuses: number
  otherBonuses: number
  total: number
}

export default function OfficerPayrollDashboard() {
  const { user, profile } = useAuthStore()
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([])
  const [earningsBreakdown, setEarningsBreakdown] = useState<EarningsBreakdown>({
    basePay: 0,
    liveEarnings: 0,
    courtBonuses: 0,
    otherBonuses: 0,
    total: 0
  })
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('week')

  const loadPayrollData = React.useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      // Calculate date range based on selected period
      const now = new Date()
      let startDate: Date

      switch (selectedPeriod) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'all':
          startDate = new Date(2024, 0, 1) // Start of 2024
          break
      }

      // Load work sessions
      const { data: sessions } = await supabase
        .from('officer_work_sessions')
        .select('*')
        .eq('officer_id', user.id)
        .gte('clock_in', startDate.toISOString())
        .order('clock_in', { ascending: false })

      const sessionsData = (sessions as any) || []

      // Recalculate hours_worked from timestamps to ensure accuracy and fix any DB inconsistencies
      sessionsData.forEach((s: any) => {
        if (s.clock_in && s.clock_out) {
          const start = new Date(s.clock_in).getTime()
          const end = new Date(s.clock_out).getTime()
          const hours = (end - start) / (1000 * 60 * 60)
          s.hours_worked = Math.max(0, hours)
        } else {
          s.hours_worked = 0
        }
      })

      // Hydrate stream titles manually to avoid FK relationship issues
      const streamIds = Array.from(new Set(sessionsData.map((s: any) => s.stream_id).filter(Boolean)))
      
      if (streamIds.length > 0) {
        const { data: streams } = await supabase
          .from('streams')
          .select('id, title')
          .in('id', streamIds)
          
        const streamMap = new Map(streams?.map(s => [s.id, s.title]) || [])
        
        sessionsData.forEach((s: any) => {
          if (s.stream_id && streamMap.has(s.stream_id)) {
            s.streams = { title: streamMap.get(s.stream_id) }
          }
        })
      }

      setWorkSessions(sessionsData)

      // Calculate earnings breakdown
      const totalHours = sessionsData.reduce((sum: number, session: { hours_worked?: number }) => sum + (session.hours_worked || 0), 0)
      const basePay = calculateOfficerBaseCoins(totalHours)

      // Calculate live streaming earnings from officer streams
      const { data: officerStreams } = await supabase
        .from('streams')
        .select('total_gifts_coins')
        .eq('broadcaster_id', user.id)
        .gte('start_time', startDate.toISOString())
        .eq('is_live', false) // Only completed streams

      const liveEarnings = officerStreams?.reduce((sum, stream) => sum + (stream.total_gifts_coins || 0), 0) || 0

      // Calculate court bonuses from officer court activities
      const { data: courtActions } = await supabase
        .from('officer_actions')
        .select('action_type, coins_awarded')
        .eq('officer_id', user.id)
        .gte('created_at', startDate.toISOString())
        .not('coins_awarded', 'is', null)

      const courtBonuses = courtActions?.reduce((sum, action) => sum + (action.coins_awarded || 0), 0) || 0

      // Calculate other bonuses from moderation events and special activities
      const { data: moderationEvents } = await supabase
        .from('moderation_events')
        .select('bonus_coins')
        .eq('officer_id', user.id)
        .gte('created_at', startDate.toISOString())
        .not('bonus_coins', 'is', null)

      const otherBonuses = moderationEvents?.reduce((sum, event) => sum + (event.bonus_coins || 0), 0) || 0

      const total = calculateTotalOfficerEarnings(totalHours, liveEarnings, courtBonuses, otherBonuses)

      setEarningsBreakdown({
        basePay,
        liveEarnings,
        courtBonuses,
        otherBonuses,
        total
      })

    } catch (error: any) {
      console.error('Error loading payroll data:', error)
      toast.error('Failed to load payroll data')
    } finally {
      setLoading(false)
    }
  }, [user, selectedPeriod])

  useEffect(() => {
    if (user) {
      loadPayrollData()
    }
  }, [user, selectedPeriod, loadPayrollData])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <Clock className="animate-spin w-8 h-8 mx-auto mb-4 text-purple-400" />
          <p>Loading payroll data...</p>
        </div>
      </div>
    )
  }

  const totalHours = workSessions.reduce((sum, session) => sum + (session.hours_worked || 0), 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <DollarSign className="w-10 h-10 text-green-400" />
            OFFICER PAYROLL DASHBOARD
          </h1>
          <p className="text-gray-300">Track your earnings and work hours</p>
          {profile && (
            <p className="text-green-300 text-sm mt-2">
              Officer: {profile.username}
            </p>
          )}
        </div>

        {/* Officer Pool Panel */}
        <OfficerPoolPanel />

        {/* Period Selector */}
        <div className="flex justify-center">
          <div className="bg-zinc-900 rounded-lg p-1 flex gap-1">
            {[
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: 'all', label: 'All Time' }
            ].map((period) => (
              <button
                key={period.key}
                onClick={() => setSelectedPeriod(period.key as any)}
                className={`px-4 py-2 rounded-md font-semibold transition-colors ${
                  selectedPeriod === period.key
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900 rounded-xl p-4 border border-blue-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-gray-400">Total Hours</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">
              {totalHours.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500 mt-1">hours worked</p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 border border-purple-500/30">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-gray-400">Live Earnings</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">
              {earningsBreakdown.liveEarnings.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">from streaming</p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-gray-400">Total Earnings</span>
            </div>
            <p className="text-2xl font-bold text-yellow-400">
              {earningsBreakdown.total.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">total coins</p>
          </div>
        </div>

        {/* Earnings Breakdown */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-green-400" />
            Earnings Breakdown
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
              <span className="text-gray-300">Live Streaming Earnings</span>
              <span className="text-purple-400 font-semibold">{earningsBreakdown.liveEarnings.toLocaleString()} coins</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
              <span className="text-gray-300">Court Bonuses</span>
              <span className="text-blue-400 font-semibold">{earningsBreakdown.courtBonuses.toLocaleString()} coins</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
              <span className="text-gray-300">Other Bonuses</span>
              <span className="text-yellow-400 font-semibold">{earningsBreakdown.otherBonuses.toLocaleString()} coins</span>
            </div>
            <div className="flex justify-between items-center py-3 border-t-2 border-zinc-600 pt-3">
              <span className="text-white font-bold text-lg">TOTAL EARNINGS</span>
              <span className="text-yellow-400 font-bold text-lg">{earningsBreakdown.total.toLocaleString()} coins</span>
            </div>
          </div>
        </div>

        {/* Work Sessions */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Work Sessions ({workSessions.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-400">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Stream</th>
                  <th className="text-right py-2">Hours</th>
                  <th className="text-center py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {workSessions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-zinc-400">
                      No work sessions found for this period
                    </td>
                  </tr>
                ) : (
                  workSessions.map((session) => (
                    <tr key={session.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                      <td className="py-2 text-zinc-300">
                        {new Date(session.clock_in).toLocaleDateString()}
                      </td>
                      <td className="py-2 text-zinc-300">
                        {session.streams?.title || 'N/A'}
                      </td>
                      <td className="text-right py-2 text-blue-400">
                        {session.hours_worked?.toFixed(2) || '0.00'}
                      </td>
                      <td className="text-center py-2">
                        {session.auto_clocked_out ? (
                          <span className="text-xs text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded">
                            Auto-clockout
                          </span>
                        ) : session.clock_out ? (
                          <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">
                            Completed
                          </span>
                        ) : (
                          <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-1 rounded">
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">
          <h3 className="text-lg font-semibold mb-3 text-yellow-400">💰 Officer Compensation Structure</h3>
          <div className="space-y-2 text-zinc-300 text-sm">
            <p>• <strong>Live Earnings:</strong> Additional coins from live streaming activities</p>
            <p>• <strong>Court Bonuses:</strong> Rewards for court moderation and rulings</p>
            <p>• <strong>Other Bonuses:</strong> Special rewards for outstanding service</p>
          </div>
        </div>
      </div>
    </div>
  )
}
