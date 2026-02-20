import React, { useState } from 'react'
import {
  Activity,
  Database,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  Monitor,
  CreditCard,
  Camera,
  Play,
  Zap
} from 'lucide-react'

interface CityControlsHealthProps {
  paypalStatus: { ok: boolean; error?: string } | null
  supabaseStatus: { ok: boolean; error?: string } | null
  liveStreams: any[]
  onTestPayPal: () => void
  onTestSupabase: () => void
  onLoadLiveStreams: () => void
  onCreateTrollDrop: () => void
  trollDropAmount: number
  setTrollDropAmount: (amount: number) => void
  trollDropDuration: number
  setTrollDropDuration: (duration: number) => void
  paypalTesting: boolean
}

export default function CityControlsHealth({
  paypalStatus,
  supabaseStatus,
  liveStreams,
  onTestPayPal,
  onTestSupabase,
  onLoadLiveStreams,
  onCreateTrollDrop,
  trollDropAmount,
  setTrollDropAmount,
  trollDropDuration,
  setTrollDropDuration,
  paypalTesting
}: CityControlsHealthProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('system-health')

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId)
  }

  const systemHealthItems = [
    {
      name: 'PayPal API',
      status: paypalTesting ? 'testing' : paypalStatus?.ok ? 'healthy' : 'error',
      icon: <CreditCard className="w-4 h-4" />,
      details: paypalStatus?.error || 'Connected'
    },
    {
      name: 'Supabase DB',
      status: supabaseStatus?.ok ? 'healthy' : 'error',
      icon: <Database className="w-4 h-4" />,
      details: supabaseStatus?.error || 'Connected'
    },
    {
      name: 'Active Streams',
      status: liveStreams.length > 0 ? 'healthy' : 'warning',
      icon: <Play className="w-4 h-4" />,
      details: `${liveStreams.length} streams active`
    }
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* System Health & Status */}
      <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl overflow-hidden">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
          onClick={() => toggleSection('system-health')}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cyan-500/20 border border-cyan-500/30 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">System Health & Status</h3>
              <p className="text-xs text-gray-400">Real-time service monitoring</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {systemHealthItems.map((item, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    item.status === 'healthy' ? 'bg-green-400' :
                    item.status === 'warning' ? 'bg-yellow-400' :
                    item.status === 'error' ? 'bg-red-400' : 'bg-gray-400'
                  }`}
                ></div>
              ))}
            </div>
            <RefreshCw className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === 'system-health' ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {expandedSection === 'system-health' && (
          <div className="px-4 pb-4 space-y-3">
            {systemHealthItems.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-[#0A0814] rounded-lg border border-[#2C2C2C]">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    item.status === 'healthy' ? 'bg-green-500/20 border border-green-500/30' :
                    item.status === 'warning' ? 'bg-yellow-500/20 border border-yellow-500/30' :
                    item.status === 'error' ? 'bg-red-500/20 border border-red-500/30' :
                    'bg-gray-500/20 border border-gray-500/30'
                  }`}>
                    {item.status === 'healthy' ? <CheckCircle className="w-4 h-4 text-green-400" /> :
                     item.status === 'error' ? <XCircle className="w-4 h-4 text-red-400" /> :
                     <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                  </div>
                  <div>
                    <div className="font-medium text-white text-sm">{item.name}</div>
                    <div className="text-xs text-gray-400">{item.details}</div>
                  </div>
                </div>
                <button
                  onClick={
                    item.name === 'PayPal API' ? onTestPayPal :
                    item.name === 'Supabase DB' ? onTestSupabase :
                    item.name === 'Active Streams' ? onLoadLiveStreams : undefined
                  }
                  disabled={item.name === 'PayPal API' && paypalTesting}
                  className="px-3 py-1 text-xs bg-[#2C2C2C] hover:bg-[#3C3C3C] rounded-lg transition-colors disabled:opacity-50"
                >
                  {item.name === 'PayPal API' && paypalTesting ? 'Testing...' : 'Test'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* City Controls & Actions */}
      <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl overflow-hidden">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
          onClick={() => toggleSection('city-controls')}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-500/20 border border-purple-500/30 rounded-lg flex items-center justify-center">
              <Settings className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">City Controls & Actions</h3>
              <p className="text-xs text-gray-400">Administrative commands</p>
            </div>
          </div>
          <RefreshCw className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === 'city-controls' ? 'rotate-180' : ''}`} />
        </div>

        {expandedSection === 'city-controls' && (
          <div className="px-4 pb-4 space-y-4">
            {/* Troll Drop */}
            <div className="bg-[#0A0814] rounded-lg border border-[#2C2C2C] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="font-medium text-white">Troll Drop Event</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Coins Amount</label>
                  <input
                    type="number"
                    value={trollDropAmount}
                    onChange={(e) => setTrollDropAmount(Number(e.target.value))}
                    min="1"
                    max="100000"
                    className="w-full bg-[#111] border border-gray-600 rounded px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    value={trollDropDuration}
                    onChange={(e) => setTrollDropDuration(Number(e.target.value))}
                    min="5"
                    max="3600"
                    className="w-full bg-[#111] border border-gray-600 rounded px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <button
                onClick={onCreateTrollDrop}
                className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white py-2 px-4 rounded-lg font-medium transition-all duration-200"
              >
                Launch Troll Drop
              </button>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button className="flex items-center gap-2 p-3 bg-[#0A0814] border border-[#2C2C2C] rounded-lg hover:bg-[#1a1a1a] transition-colors group">
                <Monitor className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-white">Stream Monitor</span>
              </button>
              <button className="flex items-center gap-2 p-3 bg-[#0A0814] border border-[#2C2C2C] rounded-lg hover:bg-[#1a1a1a] transition-colors group">
                <Shield className="w-4 h-4 text-green-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-white">Security Scan</span>
              </button>
              <button className="flex items-center gap-2 p-3 bg-[#0A0814] border border-[#2C2C2C] rounded-lg hover:bg-[#1a1a1a] transition-colors group">
                <Database className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-white">Backup DB</span>
              </button>
              <button className="flex items-center gap-2 p-3 bg-[#0A0814] border border-[#2C2C2C] rounded-lg hover:bg-[#1a1a1a] transition-colors group">
                <RefreshCw className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-white">System Refresh</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
