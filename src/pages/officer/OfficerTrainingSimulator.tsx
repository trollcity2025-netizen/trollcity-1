import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { Shield, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

interface TrainingScenario {
  id: string
  scenario_type: string
  description: string
  chat_messages: Array<{ username: string; message: string; timestamp: string }>
  correct_action: string
  points_awarded: number
  difficulty_level: number
}

const ACTIONS = [
  { id: 'ban', label: '🚨 Ban', color: 'bg-red-600' },
  { id: 'warn', label: '⚠️ Warn', color: 'bg-yellow-600' },
  { id: 'mute', label: '🔕 Mute', color: 'bg-orange-600' },
  { id: 'report', label: '⛔ Report', color: 'bg-purple-600' },
  { id: 'ignore', label: '👁 Ignore', color: 'bg-gray-600' },
  { id: 'escalate', label: '📞 Escalate', color: 'bg-blue-600' }
]

export default function OfficerTrainingSimulator() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [scenario, setScenario] = useState<TrainingScenario | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedAction, setSelectedAction] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ isCorrect: boolean; pointsEarned: number; correctAction: string } | null>(null)
  const [startTime, setStartTime] = useState<number | null>(null)

  useEffect(() => {
    loadScenario()
  }, [])

  const loadScenario = async () => {
    setLoading(true)
    setResult(null)
    setSelectedAction(null)
    setStartTime(Date.now())

    try {
      const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
        'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'

      const response = await fetch(`${edgeFunctionsUrl}/get-training-scenario`)
      if (!response.ok) throw new Error('Failed to load scenario')

      const data = await response.json()
      setScenario(data)
    } catch (error: any) {
      console.error('Error loading scenario:', error)
      toast.error('Failed to load training scenario')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedAction || !scenario || !user) return

    setSubmitting(true)
    const responseTime = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0

    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token

      if (!token) {
        toast.error('Not authenticated')
        return
      }

      const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
        'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'

      const response = await fetch(`${edgeFunctionsUrl}/submit-training-response`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scenarioId: scenario.id,
          actionTaken: selectedAction,
          responseTime
        })
      })

      if (!response.ok) throw new Error('Failed to submit response')

      const data = await response.json()
      setResult(data)

      if (data.isCorrect) {
        toast.success(`Correct! +${data.pointsEarned} points`)
      } else {
        toast.error(`Incorrect. Correct action: ${data.correctAction}`)
      }
    } catch (error: any) {
      console.error('Error submitting response:', error)
      toast.error('Failed to submit response')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p>Loading training scenario...</p>
        </div>
      </div>
    )
  }

  if (!scenario) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">No scenarios available</p>
          <button
            onClick={() => navigate('/officer/dashboard')}
            className="px-4 py-2 bg-purple-600 rounded-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold">Officer Training Simulator</h1>
          </div>
          <button
            onClick={() => navigate('/officer/dashboard')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
          >
            Exit Training
          </button>
        </div>

        {/* Scenario Info */}
        <div className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl font-semibold">{scenario.description}</h2>
          </div>
          <p className="text-sm text-gray-400 mb-2">
            Type: {scenario.scenario_type} | Difficulty: {scenario.difficulty_level}/5 | Points: {scenario.points_awarded}
          </p>
        </div>

        {/* Fake Stream Chat */}
        <div className="bg-black/60 border border-purple-600 rounded-xl p-4 mb-6 h-64 overflow-y-auto">
          <div className="space-y-2">
            {scenario.chat_messages.map((msg, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="font-semibold text-purple-300">{msg.username}:</span>
                <span>{msg.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Result Display */}
        {result && (
          <div className={`mb-6 p-4 rounded-lg ${result.isCorrect ? 'bg-green-900/30 border border-green-500' : 'bg-red-900/30 border border-red-500'}`}>
            <div className="flex items-center gap-3">
              {result.isCorrect ? (
                <CheckCircle className="w-6 h-6 text-green-400" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
              <div>
                <p className="font-semibold">
                  {result.isCorrect ? 'Correct!' : 'Incorrect'}
                </p>
                <p className="text-sm opacity-80">
                  {result.isCorrect 
                    ? `You earned ${result.pointsEarned} points!`
                    : `Correct action was: ${result.correctAction}`
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => !result && setSelectedAction(action.id)}
              disabled={!!result || submitting}
              className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                selectedAction === action.id
                  ? `${action.color} ring-2 ring-white`
                  : 'bg-gray-800 hover:bg-gray-700'
              } ${result || submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Submit Button */}
        {!result && (
          <button
            onClick={handleSubmit}
            disabled={!selectedAction || submitting}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit Action'}
          </button>
        )}

        {/* Next Scenario Button */}
        {result && (
          <button
            onClick={loadScenario}
            className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
          >
            Next Scenario
          </button>
        )}
      </div>
    </div>
  )
}

