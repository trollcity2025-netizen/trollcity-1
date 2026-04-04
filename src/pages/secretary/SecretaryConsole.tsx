import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import {
  ClipboardList,
  CreditCard,
  AlertTriangle,
  FileText,
  LogOut,
  Shield,
  Users,
  Crown,
  BookOpen,
  DollarSign,
  MapPin,
  Network
} from 'lucide-react'
import ExecutiveIntakeList from '../admin/components/shared/ExecutiveIntakeList'
import CashoutRequestsList from '../admin/components/shared/CashoutRequestsList'
import CriticalAlertsList from '../admin/components/shared/CriticalAlertsList'
import ExecutiveReportsList from '../admin/components/shared/ExecutiveReportsList'
import ManualCoinOrdersList from '../admin/components/shared/ManualCoinOrdersList'
import ManualTrollPassOrdersList from '../admin/components/shared/ManualTrollPassOrdersList'
import PastorApplicationsList from '../admin/components/shared/PastorApplicationsList'
import StaffManagement from '../admin/components/StaffManagement'
import AutomatedPayouts from '../admin/components/AutomatedPayouts'
import SecretaryDashboard from '../president/SecretaryDashboard'
import ProposalManagementPanel from '../admin/components/shared/ProposalManagementPanel'
import CashoutForecastPanel from './components/CashoutForecastPanel'
import NeighborApprovals from './components/NeighborApprovals'
import CityAdsManager from './components/CityAdsManager'
import EmpirePartnerAdminPanel from './components/EmpirePartnerAdminPanel'

type Tab = 'intake' | 'cashouts' | 'alerts' | 'reports' | 'staff' | 'manual_payments' | 'troll_pass' | 'pastor_apps' | 'automated_payouts' | 'elections' | 'proposals' | 'neighbors' | 'promo_ads' | 'empire_partners'

interface TabInfo {
  id: Tab
  label: string
  icon: React.ReactNode
  color: string
}

const tabs: TabInfo[] = [
  // Row 1 - Main tasks
  { id: 'intake', label: 'Intake', icon: <ClipboardList className="w-4 h-4" />, color: 'blue' },
  { id: 'neighbors', label: 'Neighbors', icon: <MapPin className="w-4 h-4" />, color: 'green' },
  { id: 'elections', label: 'Elections', icon: <Crown className="w-4 h-4" />, color: 'amber' },
  { id: 'proposals', label: 'Proposals', icon: <FileText className="w-4 h-4" />, color: 'purple' },
  { id: 'cashouts', label: 'Cashouts', icon: <CreditCard className="w-4 h-4" />, color: 'emerald' },
  { id: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" />, color: 'yellow' },
  // Row 2 - Secondary tasks
  { id: 'automated_payouts', label: 'Payouts', icon: <DollarSign className="w-4 h-4" />, color: 'purple' },
  { id: 'manual_payments', label: 'Manual', icon: <CreditCard className="w-4 h-4" />, color: 'emerald' },
  { id: 'troll_pass', label: 'Troll Pass', icon: <Crown className="w-4 h-4" />, color: 'pink' },
  { id: 'pastor_apps', label: 'Pastors', icon: <BookOpen className="w-4 h-4" />, color: 'indigo' },
  { id: 'alerts', label: 'Alerts', icon: <AlertTriangle className="w-4 h-4" />, color: 'red' },
  { id: 'staff', label: 'Staff', icon: <Users className="w-4 h-4" />, color: 'purple' },
  { id: 'promo_ads', label: 'Promo Ads', icon: <FileText className="w-4 h-4" />, color: 'orange' },
  { id: 'empire_partners', label: 'Empire Partners', icon: <Network className="w-4 h-4" />, color: 'pink' },
]

const getColorClasses = (color: string, active: boolean) => {
  const colors: Record<string, string> = {
    blue: active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5',
    green: active ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5',
    amber: active ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5',
    purple: active ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5',
    emerald: active ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5',
    pink: active ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5',
    indigo: active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5',
    red: active ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5',
    yellow: active ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5',
  }
  return colors[color] || colors.blue
}

export default function SecretaryConsole() {
  const { user, profile, logout } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('intake')

  const handleLogout = async () => {
    await logout()
    navigate('/auth')
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'intake':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Intake Inbox</h2>
              <p className="text-slate-400">Manage and process incoming executive requests.</p>
            </div>
            <ExecutiveIntakeList viewMode="secretary" />
          </div>
        )
      case 'neighbors':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Neighbors Management</h2>
              <p className="text-slate-400">Approve businesses, events, and job postings from neighbors.</p>
            </div>
            <NeighborApprovals />
          </div>
        )
      case 'elections':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SecretaryDashboard />
          </div>
        )
      case 'proposals':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Presidential Proposals</h2>
              <p className="text-slate-400">Review and manage proposals submitted by the President.</p>
            </div>
            <ProposalManagementPanel viewMode="secretary" />
          </div>
        )
      case 'cashouts':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Cashout Management</h2>
              <p className="text-slate-400">Review and process user cashout requests.</p>
            </div>
            <div className="mb-8">
              <CashoutForecastPanel />
            </div>
            <CashoutRequestsList viewMode="secretary" />
          </div>
        )
      case 'automated_payouts':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Automated Payout Runs</h2>
              <p className="text-slate-400">Monitor automatic batch payouts (Mon/Fri).</p>
            </div>
            <AutomatedPayouts />
          </div>
        )
      case 'manual_payments':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Manual Payments</h2>
              <p className="text-slate-400">Review and approve manual Cash App coin orders.</p>
            </div>
            <ManualCoinOrdersList />
          </div>
        )
      case 'troll_pass':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Troll Pass Activations</h2>
              <p className="text-slate-400">Review and process Troll Pass subscriptions.</p>
            </div>
            <ManualTrollPassOrdersList />
          </div>
        )
      case 'pastor_apps':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Pastor Applications</h2>
              <p className="text-slate-400">Review applications for church/pastor roles.</p>
            </div>
            <PastorApplicationsList />
          </div>
        )
      case 'alerts':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Critical Alerts</h2>
              <p className="text-slate-400">Review urgent issues and safety alerts.</p>
            </div>
            <CriticalAlertsList viewMode="secretary" />
          </div>
        )
      case 'reports':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Executive Reports</h2>
              <p className="text-slate-400">Generate and review system reports.</p>
            </div>
            <ExecutiveReportsList viewMode="secretary" />
          </div>
        )
      case 'staff':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StaffManagement />
          </div>
        )
      case 'promo_ads':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Promo Ads Manager</h2>
              <p className="text-slate-400">Create and manage Troll City promotional ads.</p>
            </div>
            <CityAdsManager />
          </div>
        )
      case 'empire_partners':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <EmpirePartnerAdminPanel />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white flex flex-col">
      {/* Header with tabs */}
      <header className="bg-[#110C1D] border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600/20 p-2 rounded-lg">
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Secretary Console
              </h1>
              <p className="text-xs text-slate-400">
                Welcome, {profile?.username || user?.email}
              </p>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>

        {/* Header Tabs - 2 Rows */}
        <div className="px-2 pb-2 flex flex-wrap gap-1">
          {/* Row 1 - Main Tasks */}
          <div className="flex gap-1 flex-wrap w-full justify-start">
            {tabs.slice(0, 6).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium 
                  transition-all
                  ${getColorClasses(tab.color, activeTab === tab.id)}
                  ${activeTab === tab.id ? 'shadow-lg' : ''}
                `}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          {/* Row 2 - Secondary Tasks */}
          <div className="flex gap-1 flex-wrap w-full justify-start">
            {tabs.slice(6).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium 
                  transition-all
                  ${getColorClasses(tab.color, activeTab === tab.id)}
                  ${activeTab === tab.id ? 'shadow-lg' : ''}
                `}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#05010a]">
        <div className="max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  )
}
