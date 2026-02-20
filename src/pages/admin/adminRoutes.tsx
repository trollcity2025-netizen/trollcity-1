import { lazy } from 'react'
import { Database, Shield, RefreshCw, Settings, Video, FileText, AlertTriangle, Phone, Gavel, Trophy, DollarSign, Lock, Zap, MapPin } from 'lucide-react'
import { UserRole } from '../../lib/supabase'

const DatabaseBackup = lazy(() => import('./DatabaseBackup'))
const CityControlCenter = lazy(() => import('./CityControlCenter'))
const CacheClear = lazy(() => import('./CacheClear'))
const SystemConfig = lazy(() => import('./SystemConfig'))

const UserFormsTab = lazy(() => import('./components/UserFormsTab'))
const AdminErrors = lazy(() => import('./AdminErrors'))
const AdminCallsTab = lazy(() => import('./components/AdminCallsTab'))
const OfficerOperations = lazy(() => import('./OfficerOperations'))
const OfficerPayrollReports = lazy(() => import('./OfficerPayrollReports'))
const ZipGovernanceDashboard = lazy(() => import('./ZipGovernanceDashboard'))
const AdminSupportTicketsPage = lazy(() => import('./AdminSupportTicketsPage'))
const CourtDocketsManager = lazy(() => import('./CourtDocketsManager'))
const StorePriceEditor = lazy(() => import('./components/StorePriceEditor'))
const TournamentManager = lazy(() => import('./components/TournamentManager'))
const AdminManualOrders = lazy(() => import('./AdminManualOrders'))
const WeeklyReportsView = lazy(() => import('./WeeklyReportsView'))
const AdminJailManagement = lazy(() => import('./AdminJailManagement'))
const SeasonalGoals = lazy(() => import('./SeasonalGoals'))
const PayoutBatches = lazy(() => import('./PayoutBatches'))
const LoadLab = lazy(() => import('../../components/admin/LoadLab'))

export interface AdminRoute {
  id: string
  title: string
  path: string
  component: React.ComponentType<any>
  roles?: UserRole[]
  apiEndpoint?: string
  category?: string
  description?: string
  icon?: React.ReactNode
  tileColor?: string
  tileBgColor?: string
  tileBorderColor?: string
}

export const systemManagementRoutes: AdminRoute[] = [
  {
    id: 'database-backup',
    title: 'Database Backup',
    path: '/admin/system/backup',
    component: DatabaseBackup,
    roles: [UserRole.ADMIN],
    description: 'Create a fresh database backup',
    icon: <Database className="w-5 h-5 text-cyan-200" />,
    tileColor: 'text-cyan-200',
    tileBgColor: 'bg-cyan-500/10',
    tileBorderColor: 'border-cyan-500/30',
    category: 'system'
  },
  {
    id: 'system-errors',
    title: 'System Errors',
    path: '/admin/errors',
    component: AdminErrors,
    roles: [UserRole.ADMIN],
    description: 'View and respond to errors',
    icon: <AlertTriangle className="w-5 h-5 text-yellow-200" />,
    tileColor: 'text-yellow-200',
    tileBgColor: 'bg-yellow-500/10',
    tileBorderColor: 'border-yellow-500/30',
    category: 'system'
  },
  {
    id: 'system-health',
    title: 'System Health',
    path: '/admin/system/health',
    component: CityControlCenter,
    roles: [UserRole.ADMIN],
    description: 'Check core service statuses',
    icon: <Shield className="w-5 h-5 text-green-200" />,
    tileColor: 'text-green-200',
    tileBgColor: 'bg-emerald-500/10',
    tileBorderColor: 'border-emerald-500/30',
    category: 'system'
  },
  {
    id: 'creator-safety-dashboard',
    title: 'Creator Safety',
    path: '/admin/creator-safety',
    component: lazy(() => import('./CreatorSafetyDashboard')),
    roles: [UserRole.ADMIN],
    description: 'Monitor and manage creator safety features',
    icon: <Shield className="w-5 h-5 text-green-200" />,
    tileColor: 'text-green-200',
    tileBgColor: 'bg-emerald-500/10',
    tileBorderColor: 'border-emerald-500/30',
    category: 'system'
  },
  {
    id: 'officer-operations',
    title: 'Officer Operations',
    path: '/admin/officer-operations',
    component: OfficerOperations,
    roles: [UserRole.ADMIN],
    description: 'Manage officer shifts, patrols, and panic alerts',
    icon: <Shield className="w-5 h-5 text-indigo-200" />,
    tileColor: 'text-indigo-200',
    tileBgColor: 'bg-indigo-500/10',
    tileBorderColor: 'border-indigo-500/30',
    category: 'system'
  },
  {
    id: 'officer-payroll-reports',
    title: 'Officer Payroll',
    path: '/admin/officer-payroll',
    component: OfficerPayrollReports,
    roles: [UserRole.ADMIN, UserRole.SECRETARY],
    description: 'Review weekly payroll payouts and frozen officers',
    icon: <DollarSign className="w-5 h-5 text-emerald-200" />,
    tileColor: 'text-emerald-200',
    tileBgColor: 'bg-emerald-500/10',
    tileBorderColor: 'border-emerald-500/30',
    category: 'economy'
  },
  {
    id: 'zip-governance',
    title: 'Zip Governance',
    path: '/admin/zip-governance',
    component: ZipGovernanceDashboard,
    roles: [UserRole.ADMIN],
    description: 'Manage zip jurisdictions and officer hierarchy',
    icon: <MapPin className="w-5 h-5 text-amber-200" />,
    tileColor: 'text-amber-200',
    tileBgColor: 'bg-amber-500/10',
    tileBorderColor: 'border-amber-500/30',
    category: 'system'
  },
  {
    id: 'cache-clear',
    title: 'Cache Clear',
    path: '/admin/system/cache',
    component: CacheClear,
    roles: [UserRole.ADMIN],
    description: 'Flush caches and temporary storage',
    icon: <RefreshCw className="w-5 h-5 text-amber-200" />,
    tileColor: 'text-amber-200',
    tileBgColor: 'bg-amber-500/10',
    tileBorderColor: 'border-amber-500/30',
    category: 'system'
  },
  {
    id: 'load-lab',
    title: '100k Load Lab',
    path: '/admin/load-lab',
    component: LoadLab,
    roles: [UserRole.ADMIN],
    description: 'Stress test the UI with simulated 100k traffic',
    icon: <Zap className="w-5 h-5 text-yellow-400" />,
    tileColor: 'text-yellow-400',
    tileBgColor: 'bg-yellow-500/10',
    tileBorderColor: 'border-yellow-500/30',
    category: 'system'
  },
  {
    id: 'system-config',
    title: 'System Config',
    path: '/admin/system/config',
    component: SystemConfig,
    roles: [UserRole.ADMIN],
    description: 'Edit global platform settings',
    icon: <Settings className="w-5 h-5 text-purple-200" />,
    tileColor: 'text-purple-200',
    tileBgColor: 'bg-purple-500/10',
    tileBorderColor: 'border-purple-500/30',
    category: 'system'
  },

  {
    id: 'user-forms',
    title: 'User Forms',
    path: '/admin/users/forms',
    component: UserFormsTab,
    roles: [UserRole.ADMIN],
    description: 'Track and prompt user forms',
    icon: <FileText className="w-5 h-5 text-blue-200" />,
    tileColor: 'text-blue-200',
    tileBgColor: 'bg-blue-500/10',
    tileBorderColor: 'border-blue-500/30',
    category: 'users'
  },
  {
    id: 'calls',
    title: 'Calls',
    path: '/admin/calls',
    component: AdminCallsTab,
    roles: [UserRole.ADMIN],
    description: 'View and audit user calls',
    icon: <Phone className="w-5 h-5 text-yellow-200" />,
    tileColor: 'text-yellow-200',
    tileBgColor: 'bg-yellow-500/10',
    tileBorderColor: 'border-yellow-500/30',
    category: 'system'
  },
  {
    id: 'support-tickets',
    title: 'Support Tickets',
    path: '/admin/support-tickets',
    component: AdminSupportTicketsPage,
    roles: [UserRole.ADMIN],
    description: 'Manage user support requests',
    icon: <FileText className="w-5 h-5 text-purple-200" />,
    tileColor: 'text-purple-200',
    tileBgColor: 'bg-purple-500/10',
    tileBorderColor: 'border-purple-500/30',
    category: 'support'
  },
  {
    id: 'court-dockets',
    title: 'Court Dockets',
    path: '/admin/court-dockets',
    component: CourtDocketsManager,
    roles: [UserRole.ADMIN, UserRole.TROLL_OFFICER, UserRole.LEAD_TROLL_OFFICER],
    description: 'Manage court dockets and cases',
    icon: <Gavel className="w-5 h-5 text-red-200" />,
    tileColor: 'text-red-200',
    tileBgColor: 'bg-red-500/10',
    tileBorderColor: 'border-red-500/30',
    category: 'moderation'
  },
  {
    id: 'seasonal-goals',
    title: 'Seasonal Goals',
    path: '/admin/seasonal-goals',
    component: SeasonalGoals,
    roles: [UserRole.ADMIN],
    description: 'Manage creator seasons and tasks',
    icon: <Trophy className="w-5 h-5 text-yellow-400" />,
    tileColor: 'text-yellow-400',
    tileBgColor: 'bg-yellow-500/10',
    tileBorderColor: 'border-yellow-500/30',
    category: 'events'
  },
  {
    id: 'payout-batches',
    title: 'Payout Batches',
    path: '/admin/payout-batches',
    component: PayoutBatches,
    roles: [UserRole.ADMIN, UserRole.SECRETARY],
    description: 'Manage Friday payout batches',
    icon: <DollarSign className="w-5 h-5 text-green-400" />,
    tileColor: 'text-green-400',
    tileBgColor: 'bg-green-500/10',
    tileBorderColor: 'border-green-500/30',
    category: 'economy'
  },
  {
    id: 'jail-management',
    title: 'Jail Management',
    path: '/admin/jail-management',
    component: AdminJailManagement,
    roles: [UserRole.ADMIN, UserRole.TROLL_OFFICER, UserRole.LEAD_TROLL_OFFICER],
    description: 'Monitor and manage current city inmates',
    icon: <Lock className="w-5 h-5 text-red-400" />,
    tileColor: 'text-red-400',
    tileBgColor: 'bg-red-500/10',
    tileBorderColor: 'border-red-500/30',
    category: 'moderation'
  },
  {
    id: 'store-pricing',
    title: 'Store Pricing',
    path: '/admin/store/pricing',
    component: StorePriceEditor,
    roles: [UserRole.ADMIN],
    description: 'Edit store item prices and details',
    icon: <DollarSign className="w-5 h-5 text-green-200" />,
    tileColor: 'text-green-200',
    tileBgColor: 'bg-green-500/10',
    tileBorderColor: 'border-green-500/30',
    category: 'economy'
  },
  {
    id: 'tournaments',
    title: 'Tournaments',
    path: '/admin/tournaments',
    component: TournamentManager,
    roles: [UserRole.ADMIN],
    description: 'Manage universe events and tournaments',
    icon: <Trophy className="w-5 h-5 text-yellow-200" />,
    tileColor: 'text-yellow-200',
    tileBgColor: 'bg-yellow-500/10',
    tileBorderColor: 'border-yellow-500/30',
    category: 'events'
  },
  {
    id: 'manual-orders',
    title: 'Manual Orders',
    path: '/admin/manual-orders',
    component: AdminManualOrders,
    roles: [UserRole.ADMIN, UserRole.SECRETARY],
    description: 'Review manual coin orders',
    icon: <DollarSign className="w-5 h-5 text-green-200" />,
    tileColor: 'text-green-200',
    tileBgColor: 'bg-green-500/10',
    tileBorderColor: 'border-green-500/30',
    category: 'economy'
  },
  {
    id: 'weekly-reports',
    title: 'Weekly Reports',
    path: '/admin/reports/weekly',
    component: WeeklyReportsView,
    roles: [UserRole.ADMIN, UserRole.SECRETARY, UserRole.LEAD_TROLL_OFFICER],
    description: 'View weekly reports from officers',
    icon: <FileText className="w-5 h-5 text-blue-200" />,
    tileColor: 'text-blue-200',
    tileBgColor: 'bg-blue-500/10',
    tileBorderColor: 'border-blue-500/30',
    category: 'moderation'
  },
  /*
  {
    id: 'jail-test-simulator',
    title: 'Jail Test Simulator',
    path: '/admin/jail-test',
    component: JailTestSimulator,
    roles: [UserRole.ADMIN],
    description: 'Test jail system functionality',
    icon: <Lock className="w-5 h-5 text-red-200" />,
    tileColor: 'text-red-200',
    tileBgColor: 'bg-red-500/10',
    tileBorderColor: 'border-red-500/30',
    category: 'moderation'
  }
  */
]
