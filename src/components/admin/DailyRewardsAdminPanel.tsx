/**
 * Daily Rewards Admin Panel
 * 
 * Admin interface for managing the Daily Reward System
 */

import { useState, useEffect } from 'react'
import { 
  getDailyRewardAdminDashboard, 
  getRewardLogs,
  setBroadcasterRewardEnabled,
  setBroadcasterRewardAmount,
  setBroadcasterMinDuration,
  setViewerRewardEnabled,
  setViewerRewardAmount,
  setViewerMinStay,
  setViewerMinAccountAge,
  setPoolThreshold,
  setPoolReductionPct,
  setFailSafeMode,
  addToPublicPool,
  isCurrentUserAdmin
} from '@/lib/adminDailyRewards'
import { useAuthStore } from '@/lib/store'

interface DailyRewardSettings {
  broadcasterRewardEnabled: boolean
  broadcasterRewardAmount: number
  broadcasterMinDurationSeconds: number
  viewerRewardEnabled: boolean
  viewerRewardAmount: number
  viewerMinStaySeconds: number
  viewerMinAccountAgeHours: number
  poolThreshold: number
  poolReductionPct: number
  failSafeMode: 'disable' | 'reduce'
}

interface DashboardData {
  settings: DailyRewardSettings
  poolBalance: number
  stats: {
    totalRewards: number
    totalCoins: number
    broadcasterRewards: number
    viewerRewards: number
  }
}

interface RewardLog {
  id: string
  user_id: string
  reward_type: string
  date: string
  broadcast_id: string | null
  amount: number
  created_at: string
}

export default function DailyRewardsAdminPanel() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [logs, setLogs] = useState<RewardLog[]>([])
  const [activeTab, setActiveTab] = useState<'settings' | 'stats' | 'logs'>('settings')
  const [poolAddAmount, setPoolAddAmount] = useState('')
  const { profile } = useAuthStore()

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  const checkAdminAndLoad = async () => {
    try {
      const admin = await isCurrentUserAdmin()
      setIsAdmin(admin)
      if (admin) {
        await loadDashboard()
        await loadLogs()
      }
    } catch (error) {
      console.error('Error checking admin:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadDashboard = async () => {
    try {
      const data = await getDailyRewardAdminDashboard()
      setDashboardData(data)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    }
  }

  const loadLogs = async () => {
    try {
      const data = await getRewardLogs(50)
      setLogs(data.logs)
    } catch (error) {
      console.error('Error loading logs:', error)
    }
  }

  const handleToggle = async (
    setter: (enabled: boolean) => Promise<{ success: boolean; error?: string }>,
    currentValue: boolean
  ) => {
    setSaving(true)
    try {
      const result = await setter(!currentValue)
      if (result.success) {
        await loadDashboard()
      } else {
        alert(result.error || 'Failed to update setting')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleNumberChange = async (
    setter: (value: number) => Promise<{ success: boolean; error?: string }>,
    value: string,
    currentValue: number
  ) => {
    const numValue = parseInt(value, 10)
    if (isNaN(numValue) || numValue === currentValue) return
    
    setSaving(true)
    try {
      const result = await setter(numValue)
      if (result.success) {
        await loadDashboard()
      } else {
        alert(result.error || 'Failed to update setting')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleAddToPool = async () => {
    const amount = parseInt(poolAddAmount, 10)
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount')
      return
    }

    setSaving(true)
    try {
      const result = await addToPublicPool(amount)
      if (result.success) {
        await loadDashboard()
        setPoolAddAmount('')
      } else {
        alert(result.error || 'Failed to add to pool')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="p-4 text-center text-red-500">
        <p>Access denied. Admin only.</p>
      </div>
    )
  }

  const settings = dashboardData?.settings
  const stats = dashboardData?.stats
  const poolBalance = dashboardData?.poolBalance || 0

  return (
    <div className="bg-slate-900 rounded-lg shadow-lg p-4 max-w-4xl mx-auto border border-white/10">
      <h2 className="text-2xl font-bold mb-4 text-white">🎁 Daily Rewards Admin</h2>
      
      {/* Pool Balance Card */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg p-4 mb-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm opacity-90">Public Pool Balance</p>
            <p className="text-3xl font-bold">{poolBalance.toLocaleString()} coins</p>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Amount to add"
              value={poolAddAmount}
              onChange={(e) => setPoolAddAmount(e.target.value)}
              className="px-3 py-2 rounded text-gray-800 w-32"
            />
            <button
              onClick={handleAddToPool}
              disabled={saving || !poolAddAmount}
              className="bg-green-600 text-white px-4 py-2 rounded font-semibold hover:bg-green-500 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-sm text-gray-600">Total Rewards</p>
          <p className="text-2xl font-bold text-blue-600">{stats?.totalRewards || 0}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-sm text-gray-600">Total Coins</p>
          <p className="text-2xl font-bold text-green-600">{stats?.totalCoins?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-3 text-center">
          <p className="text-sm text-gray-600">Broadcaster</p>
          <p className="text-2xl font-bold text-purple-600">{stats?.broadcasterRewards || 0}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 text-center">
          <p className="text-sm text-gray-600">Viewer</p>
          <p className="text-2xl font-bold text-orange-600">{stats?.viewerRewards || 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-4">
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 ${activeTab === 'settings' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
        >
          Settings
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 ${activeTab === 'stats' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
        >
          Statistics
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 ${activeTab === 'logs' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
        >
          Logs
        </button>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && settings && (
        <div className="space-y-6">
          {/* Broadcaster Settings */}
          <div className="border rounded-lg p-4">
            <h3 className="font-bold text-lg mb-3">🎙️ Broadcaster Rewards</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label>Enable Broadcaster Rewards</label>
                <button
                  onClick={() => handleToggle(setBroadcasterRewardEnabled, settings.broadcasterRewardEnabled)}
                  disabled={saving}
                  className={`px-3 py-1 rounded ${settings.broadcasterRewardEnabled ? 'bg-green-500 text-white' : 'bg-gray-300'}`}
                >
                  {settings.broadcasterRewardEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="flex justify-between items-center">
                <label>Reward Amount (coins)</label>
                <input
                  type="number"
                  defaultValue={settings.broadcasterRewardAmount}
                  onBlur={(e) => handleNumberChange(setBroadcasterRewardAmount, e.target.value, settings.broadcasterRewardAmount)}
                  disabled={saving}
                  className="border rounded px-2 py-1 w-24"
                />
              </div>
              <div className="flex justify-between items-center">
                <label>Min Duration (seconds)</label>
                <input
                  type="number"
                  defaultValue={settings.broadcasterMinDurationSeconds}
                  onBlur={(e) => handleNumberChange(setBroadcasterMinDuration, e.target.value, settings.broadcasterMinDurationSeconds)}
                  disabled={saving}
                  className="border rounded px-2 py-1 w-24"
                />
              </div>
            </div>
          </div>

          {/* Viewer Settings */}
          <div className="border rounded-lg p-4">
            <h3 className="font-bold text-lg mb-3">👀 Viewer Rewards</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label>Enable Viewer Rewards</label>
                <button
                  onClick={() => handleToggle(setViewerRewardEnabled, settings.viewerRewardEnabled)}
                  disabled={saving}
                  className={`px-3 py-1 rounded ${settings.viewerRewardEnabled ? 'bg-green-500 text-white' : 'bg-gray-300'}`}
                >
                  {settings.viewerRewardEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="flex justify-between items-center">
                <label>Reward Amount (coins)</label>
                <input
                  type="number"
                  defaultValue={settings.viewerRewardAmount}
                  onBlur={(e) => handleNumberChange(setViewerRewardAmount, e.target.value, settings.viewerRewardAmount)}
                  disabled={saving}
                  className="border rounded px-2 py-1 w-24"
                />
              </div>
              <div className="flex justify-between items-center">
                <label>Min Stay Duration (seconds)</label>
                <input
                  type="number"
                  defaultValue={settings.viewerMinStaySeconds}
                  onBlur={(e) => handleNumberChange(setViewerMinStay, e.target.value, settings.viewerMinStaySeconds)}
                  disabled={saving}
                  className="border rounded px-2 py-1 w-24"
                />
              </div>
              <div className="flex justify-between items-center">
                <label>Min Account Age (hours)</label>
                <input
                  type="number"
                  defaultValue={settings.viewerMinAccountAgeHours}
                  onBlur={(e) => handleNumberChange(setViewerMinAccountAge, e.target.value, settings.viewerMinAccountAgeHours)}
                  disabled={saving}
                  className="border rounded px-2 py-1 w-24"
                />
              </div>
            </div>
          </div>

          {/* Fail-safe Settings */}
          <div className="border rounded-lg p-4">
            <h3 className="font-bold text-lg mb-3">⚠️ Fail-safe Settings</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label>Pool Threshold</label>
                <input
                  type="number"
                  defaultValue={settings.poolThreshold}
                  onBlur={(e) => handleNumberChange(setPoolThreshold, e.target.value, settings.poolThreshold)}
                  disabled={saving}
                  className="border rounded px-2 py-1 w-32"
                />
              </div>
              <div className="flex justify-between items-center">
                <label>Reduction % (when pool low)</label>
                <input
                  type="number"
                  defaultValue={settings.poolReductionPct}
                  onBlur={(e) => handleNumberChange(setPoolReductionPct, e.target.value, settings.poolReductionPct)}
                  disabled={saving}
                  className="border rounded px-2 py-1 w-24"
                />
              </div>
              <div className="flex justify-between items-center">
                <label>Fail-safe Mode</label>
                <select
                  defaultValue={settings.failSafeMode}
                  onChange={async (e) => {
                    setSaving(true)
                    await setFailSafeMode(e.target.value as 'disable' | 'reduce')
                    await loadDashboard()
                    setSaving(false)
                  }}
                  disabled={saving}
                  className="border rounded px-2 py-1"
                >
                  <option value="reduce">Reduce Amount</option>
                  <option value="disable">Disable Rewards</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 text-left">Date</th>
                <th className="px-2 py-1 text-left">User ID</th>
                <th className="px-2 py-1 text-left">Type</th>
                <th className="px-2 py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b">
                  <td className="px-2 py-1">{new Date(log.created_at).toLocaleDateString()}</td>
                  <td className="px-2 py-1 font-mono text-xs">{log.user_id.slice(0, 8)}...</td>
                  <td className="px-2 py-1">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      log.reward_type === 'broadcaster_daily' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {log.reward_type === 'broadcaster_daily' ? 'Broadcaster' : 'Viewer'}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-right font-bold">{log.amount}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-center text-gray-500">
                    No reward logs yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
