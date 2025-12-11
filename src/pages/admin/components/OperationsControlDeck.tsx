import React, { useState } from 'react'
import {
  Monitor,
  Users,
  Shield,
  AlertTriangle,
  Play,
  Pause,
  Settings,
  RefreshCw,
  Zap,
  MessageSquare,
  FileText,
  DollarSign,
  Camera,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react'

interface OperationsControlDeckProps {
  liveStreams: any[]
  streamsLoading: boolean
  onLoadLiveStreams: () => void
  onEndStreamById: (id: string) => void
  onDeleteStreamById: (id: string) => void
  onViewStream: (id: string) => void
  stats: {
    pendingApps: number
    pendingPayouts: number
    aiFlags: number
  }
}

export default function OperationsControlDeck({
  liveStreams,
  streamsLoading,
  onLoadLiveStreams,
  onEndStreamById,
  onDeleteStreamById,
  onViewStream,
  stats
}: OperationsControlDeckProps) {
  const [activeModule, setActiveModule] = useState<string>('streams')

  const modules = [
    {
      id: 'streams',
      label: 'Live Streams',
      icon: <Camera className="w-4 h-4" />,
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/20',
      borderColor: 'border-pink-500/30',
      count: liveStreams.length
    },
    {
      id: 'applications',
      label: 'Applications',
      icon: <FileText className="w-4 h-4" />,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-500/30',
      count: stats.pendingApps
    },
    {
      id: 'payouts',
      label: 'Payouts',
      icon: <DollarSign className="w-4 h-4" />,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30',
      count: stats.pendingPayouts
    },
    {
      id: 'moderation',
      label: 'Moderation',
      icon: <Shield className="w-4 h-4" />,
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/30',
      count: stats.aiFlags
    }
  ]

  const renderStreamsModule = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-white flex items-center gap-2">
          <Camera className="w-4 h-4 text-pink-400" />
          Active Streams ({liveStreams.length})
        </h4>
        <button
          onClick={onLoadLiveStreams}
          disabled={streamsLoading}
          className="flex items-center gap-1 px-3 py-1 text-xs bg-[#2C2C2C] hover:bg-[#3C3C3C] rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${streamsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {streamsLoading ? (
        <div className="text-center py-8 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading streams...
        </div>
      ) : liveStreams.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No active streams
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {liveStreams.map((stream) => (
            <div key={stream.id} className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h5 className="font-medium text-white">{stream.title || 'Untitled Stream'}</h5>
                  <p className="text-xs text-gray-400">{stream.category || 'No category'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-400">LIVE</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-400">
                  Started: {new Date(stream.created_at).toLocaleString()}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onViewStream(stream.id)}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition-colors"
                  >
                    View
                  </button>
                  <button
                    onClick={() => onEndStreamById(stream.id)}
                    className="px-3 py-1 text-xs bg-yellow-600 hover:bg-yellow-500 rounded transition-colors"
                  >
                    End
                  </button>
                  <button
                    onClick={() => onDeleteStreamById(stream.id)}
                    className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderApplicationsModule = () => (
    <div className="space-y-4">
      <h4 className="font-medium text-white flex items-center gap-2">
        <FileText className="w-4 h-4 text-orange-400" />
        Pending Applications ({stats.pendingApps})
      </h4>
      <div className="text-center py-8 text-gray-500">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        Applications module coming soon
      </div>
    </div>
  )

  const renderPayoutsModule = () => (
    <div className="space-y-4">
      <h4 className="font-medium text-white flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-green-400" />
        Pending Payouts ({stats.pendingPayouts})
      </h4>
      <div className="text-center py-8 text-gray-500">
        <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
        Payouts module coming soon
      </div>
    </div>
  )

  const renderModerationModule = () => (
    <div className="space-y-4">
      <h4 className="font-medium text-white flex items-center gap-2">
        <Shield className="w-4 h-4 text-red-400" />
        Moderation Queue ({stats.aiFlags})
      </h4>
      <div className="text-center py-8 text-gray-500">
        <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
        Moderation module coming soon
      </div>
    </div>
  )

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'streams':
        return renderStreamsModule()
      case 'applications':
        return renderApplicationsModule()
      case 'payouts':
        return renderPayoutsModule()
      case 'moderation':
        return renderModerationModule()
      default:
        return renderStreamsModule()
    }
  }

  return (
    <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-cyan-500/20 border border-cyan-500/30 rounded-lg flex items-center justify-center">
          <Monitor className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Operations & Control Deck</h3>
          <p className="text-sm text-gray-400">Real-time monitoring and command center</p>
        </div>
      </div>

      {/* Module Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {modules.map((module) => (
          <button
            key={module.id}
            onClick={() => setActiveModule(module.id)}
            className={`relative p-4 rounded-lg border transition-all duration-200 ${
              activeModule === module.id
                ? `${module.bgColor} ${module.borderColor} border-opacity-100`
                : 'bg-[#0A0814] border-[#2C2C2C] hover:border-[#3C3C3C]'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                activeModule === module.id ? module.bgColor : 'bg-[#2C2C2C]'
              }`}>
                <div className={activeModule === module.id ? module.color : 'text-gray-400'}>
                  {module.icon}
                </div>
              </div>
              <div className="text-left">
                <div className={`text-sm font-medium ${
                  activeModule === module.id ? 'text-white' : 'text-gray-300'
                }`}>
                  {module.label}
                </div>
                <div className="text-xs text-gray-400">{module.count}</div>
              </div>
            </div>
            {activeModule === module.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
            )}
          </button>
        ))}
      </div>

      {/* Active Module Content */}
      <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
        {renderActiveModule()}
      </div>

      {/* Quick Stats Bar */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-green-400">{liveStreams.length}</div>
          <div className="text-xs text-gray-400">Active Streams</div>
        </div>
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-orange-400">{stats.pendingApps}</div>
          <div className="text-xs text-gray-400">Pending Apps</div>
        </div>
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-green-400">{stats.pendingPayouts}</div>
          <div className="text-xs text-gray-400">Pending Payouts</div>
        </div>
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-red-400">{stats.aiFlags}</div>
          <div className="text-xs text-gray-400">AI Flags</div>
        </div>
      </div>
    </div>
  )
}