import React from 'react'
import {
  Settings,
  Database,
  Shield,
  BarChart3,
  Users,
  MessageSquare,
  Coins,
  ShoppingCart,
  Calendar,
  Bell,
  Download,
  RefreshCw,
  Ban,
  Flag,
  UserCheck,
  Monitor,
  Camera,
  TrendingUp,
  DollarSign,
  CreditCard,
  Clock,
  Activity,
  Award,
  Zap,
  Gift,
  Home
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { systemManagementRoutes } from '../adminRoutes'

interface AdditionalTasksGridProps {
  onNavigateToEconomy?: () => void
  onNavigateToTaxReviews?: () => void
  onOpenTestDiagnostics?: () => void
  onOpenControlPanel?: () => void
  onOpenGrantCoins?: () => void
  onOpenFinanceDashboard?: () => void
  onOpenCreateSchedule?: () => void
  onOpenOfficerShifts?: () => void
  onOpenResetPanel?: () => void
  onOpenEmpireApplications?: () => void
  onOpenReferralBonuses?: () => void
  onSelectTab?: (tabId: string) => void
  counts?: {
    intake?: number
    cashouts?: number
    alerts?: number
    reports?: number
    user_forms?: number
    tax_reviews?: number
    empire_apps?: number
    referrals?: number
    [key: string]: number | undefined
  }
}

export default function AdditionalTasksGrid({
  onNavigateToEconomy,
  onNavigateToTaxReviews,
  onOpenTestDiagnostics,
  onOpenControlPanel,
  onOpenGrantCoins,
  onOpenFinanceDashboard,
  onOpenCreateSchedule,
  onOpenOfficerShifts,
  onOpenResetPanel,
  onOpenEmpireApplications,
  onOpenReferralBonuses,
  onSelectTab,
  counts = {}
}: AdditionalTasksGridProps) {
  const pickTab = (tabId: string) => () => {
    if (!onSelectTab) return
    onSelectTab(tabId)
  }

  const navigate = useNavigate()

  const systemManagementGroup = {
    title: 'System Management',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30',
    tasks: systemManagementRoutes.map((route) => ({
      icon: route.icon || <Database className="w-5 h-5" />,
      label: route.title,
      description: route.description || 'Open system tool',
      action: () => navigate(route.path),
      color: route.tileColor || 'text-white',
      bgColor: route.tileBgColor || 'bg-white/5',
      borderColor: route.tileBorderColor
    }))
  }

  const executiveOfficeGroup = {
      title: 'Executive Office',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
      borderColor: 'border-amber-500/30',
      tasks: [
        {
          icon: <Shield className="w-5 h-5" />,
          label: 'Exec Secretaries',
          description: 'Manage assignments',
          action: () => navigate('/admin/executive-secretaries'),
          color: 'text-purple-400',
          bgColor: 'bg-purple-500/20'
        },
        {
          icon: <Home className="w-5 h-5" />,
          label: 'Troll Town Deeds',
          description: 'View deed transfers',
          action: () => navigate('/admin/troll-town-deeds'),
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-500/20'
        },
        {
          icon: <Clock className="w-5 h-5" />,
          label: 'Intake Inbox',
          description: 'Executive intake',
          action: () => navigate('/admin/executive-intake'),
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        count: counts.intake
      },
      {
        icon: <DollarSign className="w-5 h-5" />,
        label: 'Cashout Mgr',
        description: 'Requests & Gifts',
        action: () => navigate('/admin/cashout-manager'),
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        count: counts.cashouts
      },
      {
        icon: <Gift className="w-5 h-5" />,
        label: 'Gift Cards',
        description: 'Manage fulfillments',
        action: () => navigate('/admin/gift-cards'),
        color: 'text-pink-400',
        bgColor: 'bg-pink-500/20'
      },
      {
        icon: <Bell className="w-5 h-5" />,
        label: 'Critical Alerts',
        description: 'System alerts',
        action: () => navigate('/admin/critical-alerts'),
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        count: counts.alerts
      },
      {
        icon: <Activity className="w-5 h-5" />,
        label: 'Exec Reports',
        description: 'Review reports',
        action: () => navigate('/admin/executive-reports'),
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20'
      },
      {
        icon: <UserCheck className="w-5 h-5" />,
        label: 'Officer Mgmt',
        description: 'Roles & Status',
        action: () => navigate('/admin/officer-management'),
        color: 'text-indigo-400',
        bgColor: 'bg-indigo-500/20'
      }
    ]
  }

  const taskGroups = [
    executiveOfficeGroup,
    systemManagementGroup,
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
          action: pickTab('user_search'),
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/20'
        },
        {
          icon: <Ban className="w-5 h-5" />,
          label: 'Ban Management',
          description: 'Manage banned users',
          action: pickTab('ban_management'),
          color: 'text-red-400',
          bgColor: 'bg-red-500/20'
        },
        {
          icon: <Flag className="w-5 h-5" />,
          label: 'Reports Queue',
          description: 'Handle user reports',
          action: pickTab('reports_queue'),
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/20',
          count: counts.reports
        },
        {
          icon: <UserCheck className="w-5 h-5" />,
          label: 'Role Management',
          description: 'Assign user roles',
          action: pickTab('role_management'),
          color: 'text-green-400',
          bgColor: 'bg-green-500/20'
        },
        {
          icon: <Activity className="w-5 h-5" />,
          label: 'User Forms',
          description: 'Manage user forms',
          action: () => navigate('/admin/user-forms'),
          color: 'text-purple-400',
          bgColor: 'bg-purple-500/20',
          count: counts.user_forms
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
          action: pickTab('stream_monitor'),
          color: 'text-pink-400',
          bgColor: 'bg-pink-500/20'
        },
        {
          icon: <Camera className="w-5 h-5" />,
          label: 'Media Library',
          description: 'Manage uploaded content',
          action: pickTab('media_library'),
          color: 'text-cyan-400',
          bgColor: 'bg-cyan-500/20'
        },
        {
          icon: <MessageSquare className="w-5 h-5" />,
          label: 'Chat Moderation',
          description: 'Moderate chat messages',
          action: pickTab('chat_moderation'),
          color: 'text-orange-400',
          bgColor: 'bg-orange-500/20'
        },
        {
          icon: <Bell className="w-5 h-5" />,
          label: 'Announcements',
          description: 'Send system announcements',
          action: pickTab('announcements'),
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
          icon: <TrendingUp className="w-5 h-5" />,
          label: 'Finance Dashboard',
          description: 'Open the finance overview',
          action: onOpenFinanceDashboard,
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-500/20'
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
          icon: <ShoppingCart className="w-5 h-5" />,
          label: 'Store Pricing',
          description: 'Adjust effects/perks/insurance price',
          action: pickTab('store_pricing'),
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
          action: pickTab('payment_logs'),
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
          bgColor: 'bg-purple-500/20',
          count: counts.empire_apps
        },
        {
          icon: <Award className="w-5 h-5" />,
          label: 'Referral Bonuses',
          description: 'Manage referral system',
          action: onOpenReferralBonuses,
          color: 'text-pink-400',
          bgColor: 'bg-pink-500/20',
          count: counts.referrals
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
          action: pickTab('export_data'),
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
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${task.bgColor} group-hover:scale-110 transition-transform relative`}>
                      <div className={task.color}>
                        {task.icon}
                      </div>
                      {(task as any).count > 0 && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-white text-sm group-hover:text-cyan-300 transition-colors flex items-center justify-center gap-1">
                        {task.label}
                        {(task as any).count > 0 && (
                           <span className="bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded-full border border-red-500/30">
                             {(task as any).count}
                           </span>
                        )}
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
