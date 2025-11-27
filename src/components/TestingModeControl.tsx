import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { TestTube, Users, RotateCcw, Power, PowerOff, Info } from 'lucide-react'

interface TestingModeData {
  enabled: boolean
  signup_limit: number
  current_signups: number
}

interface Benefits {
  free_coins: number
  bypass_family_fee: boolean
  bypass_admin_message_fee: boolean
}

export function TestingModeControl() {
  const [testingMode, setTestingMode] = useState<TestingModeData>({
    enabled: false,
    signup_limit: 15,
    current_signups: 0
  })
  const [benefits, setBenefits] = useState<Benefits>({
    free_coins: 5000,
    bypass_family_fee: true,
    bypass_admin_message_fee: true
  })
  const [actualTestUsers, setActualTestUsers] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/admin/testing-mode/status`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) throw new Error('Failed to fetch testing mode status')

      const data = await response.json()
      if (data.success) {
        setTestingMode(data.testingMode)
        setBenefits(data.benefits)
        setActualTestUsers(data.actualTestUsers)
      }
    } catch (error) {
      console.error('Error fetching testing mode status:', error)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const toggleTestingMode = async (enabled: boolean, resetCounter: boolean = false) => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Not authenticated')
        return
      }

      const response = await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/admin/testing-mode/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ enabled, resetCounter })
      })

      if (!response.ok) throw new Error('Failed to toggle testing mode')

      const data = await response.json()
      if (data.success) {
        setTestingMode(data.testingMode)
        toast.success(`Testing mode ${enabled ? 'enabled' : 'disabled'}${resetCounter ? ' and counter reset' : ''}`)
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to toggle testing mode')
    } finally {
      setLoading(false)
    }
  }

  const resetCounter = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Not authenticated')
        return
      }

      const response = await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/admin/testing-mode/reset-counter`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) throw new Error('Failed to reset counter')

      const data = await response.json()
      if (data.success) {
        setTestingMode(data.testingMode)
        toast.success('Signup counter reset to 0')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset counter')
    } finally {
      setLoading(false)
    }
  }

  const signupsRemaining = testingMode.signup_limit - testingMode.current_signups
  const progressPercent = (testingMode.current_signups / testingMode.signup_limit) * 100

  return (
    <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 rounded-xl p-6 border border-purple-500/30">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <TestTube className="w-6 h-6 text-purple-400" />
          <h2 className="text-xl font-bold text-white">Testing Mode Control</h2>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          testingMode.enabled 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
            : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
        }`}>
          {testingMode.enabled ? 'ACTIVE' : 'INACTIVE'}
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <p className="text-sm text-gray-400">Signups</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {testingMode.current_signups} / {testingMode.signup_limit}
          </p>
          <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/30">
          <div className="flex items-center gap-2 mb-2">
            <TestTube className="w-4 h-4 text-purple-400" />
            <p className="text-sm text-gray-400">Test Users</p>
          </div>
          <p className="text-2xl font-bold text-white">{actualTestUsers}</p>
          <p className="text-xs text-gray-400 mt-1">Actual count in database</p>
        </div>

        <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-green-400" />
            <p className="text-sm text-gray-400">Remaining</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {testingMode.enabled ? Math.max(0, signupsRemaining) : '∞'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {testingMode.enabled ? 'slots available' : 'unlimited signups'}
          </p>
        </div>
      </div>

      {/* Benefits Info */}
      <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/30 mb-6">
        <h3 className="text-sm font-semibold text-yellow-400 mb-2">Test User Benefits:</h3>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• {benefits.free_coins.toLocaleString()} free coins on signup</li>
          <li>• {benefits.bypass_family_fee ? 'No fee' : 'Fee required'} for Troll Family applications</li>
          <li>• {benefits.bypass_admin_message_fee ? 'Free' : 'Paid'} admin messaging</li>
          <li>• Admin searchable by @admin username</li>
        </ul>
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap gap-3">
        {!testingMode.enabled ? (
          <button
            onClick={() => toggleTestingMode(true, true)}
            disabled={loading}
            className="flex-1 min-w-[200px] px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Power className="w-4 h-4" />
            Enable Testing Mode
          </button>
        ) : (
          <button
            onClick={() => toggleTestingMode(false, false)}
            disabled={loading}
            className="flex-1 min-w-[200px] px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <PowerOff className="w-4 h-4" />
            Disable Testing Mode
          </button>
        )}

        <button
          onClick={resetCounter}
          disabled={loading || !testingMode.enabled}
          className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset Counter
        </button>
      </div>

      {testingMode.enabled && signupsRemaining === 0 && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm font-medium">
            ⚠️ Signup limit reached! New signups are currently blocked.
          </p>
        </div>
      )}
    </div>
  )
}
