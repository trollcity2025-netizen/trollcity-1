import React from 'react'
import {
  RefreshCw,
  Shield,
  Zap,
  Bell,
  Download,
  Lock,
  Unlock,
  BarChart3,
  Server,
  Wifi,
  Activity,
  Settings,
  Send
} from 'lucide-react'

interface QuickActionsBarProps {
  onEmergencyStop: () => void
  onBroadcastMessage: () => void
  onSendNotifications: () => void
  onSystemMaintenance: () => void
  onViewAnalytics: () => void
  onExportData: () => void
}

interface QuickAction {
  icon: React.ReactNode
  label: string
  description: string
  action: () => void
  color: string
  bgColor: string
  borderColor: string
  disabled?: boolean
}

export default function QuickActionsBar({
  onEmergencyStop,
  onBroadcastMessage,
  onSendNotifications,
  onSystemMaintenance,
  onViewAnalytics,
  onExportData,
}: QuickActionsBarProps) {
  const quickActions: QuickAction[] = [
    {
      icon: <Send className="w-4 h-4" />,
      label: 'Send Notifications',
      description: 'Bulk notifications',
      action: onSendNotifications,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/30'
    },
    {
      icon: <Bell className="w-4 h-4" />,
      label: 'Broadcast',
      description: 'Send announcement',
      action: onBroadcastMessage,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/30'
    },
    {
      icon: <Shield className="w-4 h-4" />,
      label: 'Emergency Stop',
      description: 'Stop all streams',
      action: onEmergencyStop,
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/30'
    },
    {
      icon: <Settings className="w-4 h-4" />,
      label: 'Maintenance',
      description: 'System maintenance',
      action: onSystemMaintenance,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-500/30'
    },
    {
      icon: <BarChart3 className="w-4 h-4" />,
      label: 'Analytics',
      description: 'View reports',
      action: onViewAnalytics,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30'
    },
    {
      icon: <Download className="w-4 h-4" />,
      label: 'Export Data',
      description: 'Download reports',
      action: onExportData,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/30'
    }
  ]

  return (
    <div className="bg-gradient-to-r from-[#0A0814] via-[#1a0b2e] to-[#0A0814] border-b border-[#2C2C2C] p-4 sticky top-0 z-10 backdrop-blur-sm">
  <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            Quick Actions
          </h4>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-400">
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              disabled={action.disabled}
              className={`group relative flex items-center gap-3 ${action.bgColor} ${action.borderColor} border rounded-lg px-4 py-3 hover:scale-105 transition-all duration-200 min-w-max ${
                action.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${action.bgColor} group-hover:scale-110 transition-transform`}>
                <div className={`${action.color} ${action.disabled ? '' : 'group-hover:animate-pulse'}`}>
                  {action.disabled && action.label === 'Refresh All' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    action.icon
                  )}
                </div>
              </div>
              <div className="text-left">
                <div className="font-medium text-white text-sm group-hover:text-cyan-300 transition-colors">
                  {action.label}
                </div>
                <div className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                  {action.description}
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
            </button>
          ))}
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-gray-400">System: <span className="text-green-400">Healthy</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span className="text-gray-400">CPU: <span className="text-cyan-400">23%</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Server className="w-3 h-3 text-blue-400" />
            <span className="text-gray-400">Memory: <span className="text-blue-400">45%</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-3 h-3 text-green-400" />
            <span className="text-gray-400">Network: <span className="text-green-400">Good</span></span>
          </div>
        </div>
      </div>
    </div>
  )
}
