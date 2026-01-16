import { Database, Shield, RefreshCw, Settings, Video, FileText, AlertTriangle, Phone } from 'lucide-react'
import { UserRole } from '../../lib/supabase'
import DatabaseBackup from './DatabaseBackup'
import CityControlCenter from './CityControlCenter'
import CacheClear from './CacheClear'
import SystemConfig from './SystemConfig'
import LiveKitUsageTab from './components/LiveKitUsageTab'
import UserFormsTab from './components/UserFormsTab'
import AdminErrors from './AdminErrors'
import AdminCallsTab from './components/AdminCallsTab'
import OfficerOperations from './OfficerOperations'
import AdminSupportTicketsPage from './AdminSupportTicketsPage'

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
    id: 'livekit-usage',
    title: 'LiveKit Usage',
    path: '/admin/system/livekit',
    component: LiveKitUsageTab,
    roles: [UserRole.ADMIN],
    description: 'Monitor broadcast minutes & quotas',
    icon: <Video className="w-5 h-5 text-pink-200" />,
    tileColor: 'text-pink-200',
    tileBgColor: 'bg-pink-500/10',
    tileBorderColor: 'border-pink-500/30',
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
  }
]
