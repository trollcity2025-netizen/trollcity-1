import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { Shield, CheckCircle, XCircle, Award } from 'lucide-react'

interface TrainingSession {
  id: string
  scenario_id: string
  action_taken: string
  is_correct: boolean
  response_time_seconds: number
  points_earned: number
  created_at: string
  training_scenarios: {
    scenario_type: string
    description: string
  }
}

export default function OfficerTrainingProgress() {
  const { user } = useAuthStore()
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, correct: 0, points: 0, accuracy: 0 })

  useEffect(() => {
    if (user) loadSessions()
  }, [user])

  const loadSessions = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('officer_training_sessions')
        .select(`
          *,
          training_scenarios(scenario_type, description)
        `)
        .eq('officer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      setSessions((data as any) || [])

      // Calculate stats
      const total = data?.length || 0
      const correct = data?.filter(s => s.is_correct).length || 0
      const points = data?.reduce((sum, s) => sum + (s.points_earned || 0), 0) || 0
      const accuracy = total > 0 ? (correct / total) * 100 : 0

      setStats({ total, correct, points, accuracy })
    } catch (error: any) {
      console.error('Error loading sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-white text-center">Loading...</div>
  }

  return (
    <div className="p-6 max-w-5xl mx-auto text-white min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-purple-400" />
        <h1 className="text-3xl font-bold">Training Progress</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="bg-black/60 border border-purple-600 rounded-lg p-4">
          <div className="text-sm opacity-70 mb-1">Total Scenarios</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-black/60 border border-green-600 rounded-lg p-4">
          <div className="text-sm opacity-70 mb-1">Correct</div>
          <div className="text-2xl font-bold text-green-400">{stats.correct}</div>
        </div>
        <div className="bg-black/60 border border-blue-600 rounded-lg p-4">
          <div className="text-sm opacity-70 mb-1">Accuracy</div>
          <div className="text-2xl font-bold text-blue-400">{stats.accuracy.toFixed(1)}%</div>
        </div>
        <div className="bg-black/60 border border-yellow-600 rounded-lg p-4">
          <div className="text-sm opacity-70 mb-1">Total Points</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.points}</div>
        </div>
      </div>

      {/* Qualification Status */}
      {stats.accuracy >= 80 && stats.points >= 150 && (
        <div className="bg-green-900/30 border border-green-500 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <Award className="w-6 h-6 text-green-400" />
            <div>
              <p className="font-semibold">🎉 Qualification Achieved!</p>
              <p className="text-sm opacity-80">You've met the requirements to become a Troll Officer!</p>
            </div>
          </div>
        </div>
      )}

      {/* Sessions Table */}
      <div className="bg-black/60 border border-purple-600 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="p-3 text-left text-gray-400">Scenario</th>
              <th className="p-3 text-left text-gray-400">Action Taken</th>
              <th className="p-3 text-left text-gray-400">Result</th>
              <th className="p-3 text-left text-gray-400">Points</th>
              <th className="p-3 text-left text-gray-400">Time</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  No training sessions yet
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                  <td className="p-3">
                    <div className="font-semibold">{session.training_scenarios?.scenario_type || 'Unknown'}</div>
                    <div className="text-xs opacity-70">{session.training_scenarios?.description}</div>
                  </td>
                  <td className="p-3">{session.action_taken}</td>
                  <td className="p-3">
                    {session.is_correct ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </td>
                  <td className="p-3">{session.points_earned}</td>
                  <td className="p-3">{session.response_time_seconds}s</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

