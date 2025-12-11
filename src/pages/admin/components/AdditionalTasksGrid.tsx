import React from 'react'
import {
  Settings,
  Database,
  Shield,
  BarChart3,
  Users,
  FileText,
  MessageSquare,
  Gift,
  Coins,
  Calendar,
  Bell,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Zap,
  Target,
  Award,
  Star,
  Crown,
  Gamepad2,
  Music,
  Camera,
  Monitor,
  Server,
  Wifi,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Activity,
  UserCheck,
  UserX,
  Ban,
  Flag
} from 'lucide-react'

interface AdditionalTasksGridProps {
  onNavigateToEconomy?: () => void
  onNavigateToTaxReviews?: () => void
  onOpenTestDiagnostics?: () => void
  onOpenControlPanel?: () => void
  onOpenGrantCoins?: () => void
  onOpenCreateSchedule?: () => void
  onOpenOfficerShifts?: () => void
  onOpenResetPanel?: () => void
  onOpenEmpireApplications?: () => void
  onOpenReferralBonuses?: () => void
}

export default function AdditionalTasksGrid({
  onNavigateToEconomy,
  onNavigateToTaxReviews,
  onOpenTestDiagnostics,
  onOpenControlPanel,
  onOpenGrantCoins,
  onOpenCreateSchedule,
  onOpenOfficerShifts,
  onOpenResetPanel,
  onOpenEmpireApplications,
  onOpenReferralBonuses
}: AdditionalTasksGridProps) {
  const taskGroups = [
    {
      title: 'System Management',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
      borderColor: 'border-cyan-500/30',
      tasks: [
        {
          icon: <Database className="w-5 h-5" />,
          label: 'Database Backup',
          description: 'Create system backup',
          action: () => console.log('Database backup'),
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/20'
        },
        {
          icon: <Server className="w-5 h-5" />,
          label: 'System Health',
          description: 'Check server status',
          action: () => console.log('System health'),
          color: 'text-green-400',
          bgColor: 'bg-green-500/20'
        },
        {
          icon: <RefreshCw className="w-5 h-5" />,
          label: 'Cache Clear',
          description: 'Clear all caches',
          action: () => console.log('Cache clear'),
          color: 'text-orange-400',
          bgColor: 'bg-orange-500/20'
        },
        {
          icon: <Settings className="w-5 h-5" />,
          label: 'System Config',
          description: 'Edit configuration',
          action: () => console.log('System config'),
          color: 'text-purple-400',
          bgColor: 'bg-purple-500/20'
        }
      ]
    },
    {
      title: 'User Management',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/30',
      tasks: [
        {
          icon: <Users className="w-5 h-5" />,
          label: 'User Search',
          description: 'Find and manage users',
          action: () => console.log('User search'),
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/20'
        },
        {
          icon: <Ban className="w-5 h-5" />,
          label: 'Ban Management',
          description: 'Manage banned users',
          action: () => console.log('Ban management'),
          color: 'text-red-400',
          bgColor: 'bg-red-500/20'
        },
        {
          icon: <Flag className="w-5 h-5" />,
          label: 'Reports Queue',
          description: 'Handle user reports',
          action: () => console.log('Reports queue'),
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/20'
        },
        {
          icon: <UserCheck className="w-5 h-5" />,
          label: 'Role Management',
          description: 'Assign user roles',
          action: () => console.log('Role management'),
          color: 'text-green-400',
          bgColor: 'bg-green-500/20'
        }
      ]
    },
    {
      title: 'Content & Media',
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/20',
      borderColor: 'border-pink-500/30',
      tasks: [
        {
          icon: <Monitor className="w-5 h-5" />,
          label: 'Stream Monitor',
          description: 'Monitor live streams',
          action: () => console.log('Stream monitor'),
          color: 'text-pink-400',
          bgColor: 'bg-pink-500/20'
        },
        {
          icon: <Camera className="w-5 h-5" />,
          label: 'Media Library',
          description: 'Manage uploaded content',
          action: () => console.log('Media library'),
          color: 'text-cyan-400',
          bgColor: 'bg-cyan-500/20'
        },
        {
          icon: <MessageSquare className="w-5 h-5" />,
          label: 'Chat Moderation',
          description: 'Moderate chat messages',
          action: () => console.log('Chat moderation'),
          color: 'text-orange-400',
          bgColor: 'bg-orange-500/20'
        },
        {
          icon: <Bell className="w-5 h-5" />,
          label: 'Announcements',
          description: 'Send system announcements',
          action: () => console.log('Announcements'),
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/20'
        }
      ]
    },
    {
      title: 'Economy & Finance',
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30',
      tasks: [
        {
          icon: <BarChart3 className="w-5 h-5" />,
          label: 'Economy Dashboard',
          description: 'View economy metrics',
          action: onNavigateToEconomy,
          color: 'text-green-400',
          bgColor: 'bg-green-500/20'
        },
        {
          icon: <Coins className="w-5 h-5" />,
          label: 'Grant Coins',
          description: 'Manually grant coins',
          action: onOpenGrantCoins,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/20'
        },
        {
          icon: <DollarSign className="w-5 h-5" />,
          label: 'Tax Reviews',
          description: 'Review tax calculations',
          action: onNavigateToTaxReviews,
          color: 'text-red-400',
          bgColor: 'bg-red-500/20'
        },
        {
          icon: <CreditCard className="w-5 h-5" />,
          label: 'Payment Logs',
          description: 'View payment history',
          action: () => console.log('Payment logs'),
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/20'
        }
      ]
    },
    {
      title: 'Operations & Scheduling',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-500/30',
      tasks: [
        {
          icon: <Calendar className="w-5 h-5" />,
          label: 'Create Schedule',
          description: 'Schedule officer shifts',
          action: onOpenCreateSchedule,
          color: 'text-orange-400',
          bgColor: 'bg-orange-500/20'
        },
        {
          icon: <Clock className="w-5 h-5" />,
          label: 'Officer Shifts',
          description: 'Manage shift schedules',
          action: onOpenOfficerShifts,
          color: 'text-cyan-400',
          bgColor: 'bg-cyan-500/20'
        },
        {
          icon: <Shield className="w-5 h-5" />,
          label: 'Empire Applications',
          description: 'Review empire partnerships',
          action: onOpenEmpireApplications,
          color: 'text-purple-400',
          bgColor: 'bg-purple-500/20'
        },
        {
          icon: <Award className="w-5 h-5" />,
          label: 'Referral Bonuses',
          description: 'Manage referral system',
          action: onOpenReferralBonuses,
          color: 'text-pink-400',
          bgColor: 'bg-pink-500/20'
        }
      ]
    },
    {
      title: 'Maintenance & Testing',
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/30',
      tasks: [
        {
          icon: <Settings className="w-5 h-5" />,
          label: 'Control Panel',
          description: 'Advanced system controls',
          action: onOpenControlPanel,
          color: 'text-red-400',
          bgColor: 'bg-red-500/20'
        },
        {
          icon: <Activity className="w-5 h-5" />,
          label: 'Test Diagnostics',
          description: 'Run system diagnostics',
          action: onOpenTestDiagnostics,
          color: 'text-cyan-400',
          bgColor: 'bg-cyan-500/20'
        },
        {
          icon: <RefreshCw className="w-5 h-5" />,
          label: 'Reset & Maintenance',
          description: 'System reset tools',
          action: onOpenResetPanel,
          color: 'text-orange-400',
          bgColor: 'bg-orange-500/20'
        },
        {
          icon: <Download className="w-5 h-5" />,
          label: 'Export Data',
          description: 'Export system data',
          action: () => console.log('Export data'),
          color: 'text-green-400',
          bgColor: 'bg-green-500/20'
        }
      ]
    }
  ]

  return (
    <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-indigo-500/20 border border-indigo-500/30 rounded-lg flex items-center justify-center">
          <Zap className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Additional Tasks</h3>
          <p className="text-sm text-gray-400">Quick access to specialized tools</p>
        </div>
      </div>

      <div className="space-y-6">
        {taskGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 ${group.color.replace('text-', 'bg-')} rounded-full`}></div>
              <h4 className={`font-medium ${group.color}`}>{group.title}</h4>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {group.tasks.map((task, taskIndex) => (
                <button
                  key={taskIndex}
                  onClick={task.action}
                  className={`group relative ${task.bgColor} border border-[#2C2C2C] hover:border-[#3C3C3C] rounded-lg p-4 transition-all duration-200 hover:scale-105 hover:shadow-lg`}
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${task.bgColor} group-hover:scale-110 transition-transform`}>
                      <div className={task.color}>
                        {task.icon}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-white text-sm group-hover:text-cyan-300 transition-colors">
                        {task.label}
                      </div>
                      <div className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                        {task.description}
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}