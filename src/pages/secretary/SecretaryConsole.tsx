import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { 
  ClipboardList, 
  CreditCard, 
  Gift, 
  AlertTriangle, 
  FileText, 
  LogOut,
  Shield,
  Users,
  Crown,
  BookOpen,
  DollarSign
} from 'lucide-react'
import ExecutiveIntakeList from '../admin/components/shared/ExecutiveIntakeList'
import CashoutRequestsList from '../admin/components/shared/CashoutRequestsList'
import GiftCardFulfillmentList from '../admin/components/shared/GiftCardFulfillmentList'
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

type Tab = 'intake' | 'cashouts' | 'giftcards' | 'alerts' | 'reports' | 'staff' | 'manual_payments' | 'troll_pass' | 'pastor_apps' | 'automated_payouts' | 'elections' | 'proposals'

export default function SecretaryConsole() {
  const { user, profile, logout } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('intake')

  const handleLogout = async () => {
    await logout()
    navigate('/auth')
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white flex flex-col">
      {/* Header */}
      <header className="bg-[#110C1D] border-b border-white/10 p-4 flex items-center justify-between sticky top-0 z-50">
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
          Sign Out
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar / Navigation */}
        <aside className="w-64 bg-[#0F0A18] border-r border-white/5 flex flex-col hidden md:flex">
          <nav className="p-4 space-y-2">
            <button
              onClick={() => setActiveTab('intake')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'intake' 
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <ClipboardList className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Intake Inbox</div>
                <div className="text-[10px] opacity-70">New requests</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('elections')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'elections' 
                  ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Crown className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Elections</div>
                <div className="text-[10px] opacity-70">Presidential System</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('proposals')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'proposals' 
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <FileText className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Proposals</div>
                <div className="text-[10px] opacity-70">Review & Approve</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('cashouts')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'cashouts' 
                  ? 'bg-green-600/20 text-green-400 border border-green-500/30' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Cashouts</div>
                <div className="text-[10px] opacity-70">Process payments</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('automated_payouts')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'automated_payouts' 
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <DollarSign className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Automated Payouts</div>
                <div className="text-[10px] opacity-70">Mon/Fri Batches</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('manual_payments')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'manual_payments' 
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Manual Payments</div>
                <div className="text-[10px] opacity-70">Review coin orders</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('troll_pass')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'troll_pass' 
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Crown className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Troll Pass</div>
                <div className="text-[10px] opacity-70">Activations</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('pastor_apps')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'pastor_apps' 
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <BookOpen className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Pastor Apps</div>
                <div className="text-[10px] opacity-70">Review applications</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('giftcards')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'giftcards' 
                  ? 'bg-pink-600/20 text-pink-400 border border-pink-500/30' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Gift className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Gift Cards</div>
                <div className="text-[10px] opacity-70">Fulfill orders</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('alerts')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'alerts' 
                  ? 'bg-red-600/20 text-red-400 border border-red-500/30' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Critical Alerts</div>
                <div className="text-[10px] opacity-70">Urgent issues</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'reports' 
                  ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/30' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <FileText className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Reports</div>
                <div className="text-[10px] opacity-70">Executive summaries</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('staff')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'staff' 
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Users className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Staff</div>
                <div className="text-[10px] opacity-70">Manage roles</div>
              </div>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#05010a]">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'intake' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Intake Inbox</h2>
                  <p className="text-slate-400">Manage and process incoming executive requests.</p>
                </div>
                <div className="mb-8 bg-[#13111C] border border-white/5 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-lg font-bold text-white">Quick Manual Payments</h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('manual_payments')}
                      className="text-xs text-emerald-300 hover:text-emerald-200 transition-colors"
                    >
                      Open full queue
                    </button>
                  </div>
                  <ManualCoinOrdersList limit={5} showHeader={false} />
                </div>
                <ExecutiveIntakeList viewMode="secretary" />
              </div>
            )}

            {activeTab === 'elections' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <SecretaryDashboard />
              </div>
            )}

            {activeTab === 'proposals' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Presidential Proposals</h2>
                  <p className="text-slate-400">Review and manage proposals submitted by the President.</p>
                </div>
                <ProposalManagementPanel viewMode="secretary" />
              </div>
            )}

            {activeTab === 'cashouts' && (
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
            )}

            {activeTab === 'automated_payouts' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Automated Payout Runs</h2>
                  <p className="text-slate-400">Monitor automatic batch payouts (Mon/Fri).</p>
                </div>
                <AutomatedPayouts />
              </div>
            )}

            {activeTab === 'manual_payments' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Manual Payments</h2>
                  <p className="text-slate-400">Review and approve manual Cash App coin orders.</p>
                </div>
                <ManualCoinOrdersList />
              </div>
            )}

            {activeTab === 'troll_pass' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Troll Pass Activations</h2>
                  <p className="text-slate-400">Review and approve manual Troll Pass purchases.</p>
                </div>
                <ManualTrollPassOrdersList />
              </div>
            )}

            {activeTab === 'pastor_apps' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Pastor Applications</h2>
                  <p className="text-slate-400">Review and process pastor role applications.</p>
                </div>
                <PastorApplicationsList />
              </div>
            )}

            {activeTab === 'giftcards' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Gift Card Fulfillment</h2>
                  <p className="text-slate-400">Track and fulfill gift card orders.</p>
                </div>
                <GiftCardFulfillmentList viewMode="secretary" />
              </div>
            )}

            {activeTab === 'alerts' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Critical Alerts</h2>
                  <p className="text-slate-400">Monitor and respond to system alerts.</p>
                </div>
                <CriticalAlertsList viewMode="secretary" />
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Executive Reports</h2>
                  <p className="text-slate-400">Generate and review system reports.</p>
                </div>
                <ExecutiveReportsList viewMode="secretary" />
              </div>
            )}

            {activeTab === 'staff' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <StaffManagement />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden bg-[#0F0A18] border-t border-white/10 flex justify-around p-2 sticky bottom-0 z-50">
         <button onClick={() => setActiveTab('intake')} className={`p-2 rounded-lg ${activeTab === 'intake' ? 'text-blue-400' : 'text-slate-400'}`}>
           <ClipboardList className="w-6 h-6" />
         </button>
         <button onClick={() => setActiveTab('cashouts')} className={`p-2 rounded-lg ${activeTab === 'cashouts' ? 'text-green-400' : 'text-slate-400'}`}>
           <CreditCard className="w-6 h-6" />
         </button>
         <button onClick={() => setActiveTab('manual_payments')} className={`p-2 rounded-lg ${activeTab === 'manual_payments' ? 'text-emerald-400' : 'text-slate-400'}`}>
           <CreditCard className="w-6 h-6" />
         </button>
         <button onClick={() => setActiveTab('troll_pass')} className={`p-2 rounded-lg ${activeTab === 'troll_pass' ? 'text-purple-400' : 'text-slate-400'}`}>
           <Crown className="w-6 h-6" />
         </button>
         <button onClick={() => setActiveTab('pastor_apps')} className={`p-2 rounded-lg ${activeTab === 'pastor_apps' ? 'text-indigo-400' : 'text-slate-400'}`}>
           <BookOpen className="w-6 h-6" />
         </button>
         <button onClick={() => setActiveTab('giftcards')} className={`p-2 rounded-lg ${activeTab === 'giftcards' ? 'text-pink-400' : 'text-slate-400'}`}>
           <Gift className="w-6 h-6" />
         </button>
         <button onClick={() => setActiveTab('alerts')} className={`p-2 rounded-lg ${activeTab === 'alerts' ? 'text-red-400' : 'text-slate-400'}`}>
           <AlertTriangle className="w-6 h-6" />
         </button>
         <button onClick={() => setActiveTab('reports')} className={`p-2 rounded-lg ${activeTab === 'reports' ? 'text-yellow-400' : 'text-slate-400'}`}>
           <FileText className="w-6 h-6" />
         </button>
         <button onClick={() => setActiveTab('staff')} className={`p-2 rounded-lg ${activeTab === 'staff' ? 'text-purple-400' : 'text-slate-400'}`}>
           <Users className="w-6 h-6" />
         </button>
      </div>
    </div>
  )
}
