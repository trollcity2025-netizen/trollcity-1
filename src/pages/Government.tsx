import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { useGovernmentSystem, TAB_PERMISSIONS } from '@/hooks/useGovernmentSystem';
import { 
  Building2, 
  Vote, 
  Scale, 
  Shield, 
  History, 
  PartyPopper, 
  AlertTriangle, 
  Users,
  Lock,
  ChevronRight,
  Activity,
  Gavel,
  Scroll,
  TrendingUp,
  DollarSign,
  Hand,
  Siren,
  Menu,
  X
} from 'lucide-react';
import { toast } from 'sonner';

// Tab components
import LawsTab from '@/components/government/LawsTab';
import VotingTab from '@/components/government/VotingTab';
import EnforcementTab from '@/components/government/EnforcementTab';
import RolesTab from '@/components/government/RolesTab';
import HistoryTab from '@/components/government/HistoryTab';
import ElectionsTab from '@/components/government/ElectionsTab';
import PartiesTab from '@/components/government/PartiesTab';
import CorruptionTab from '@/components/government/CorruptionTab';
import ProtestsTab from '@/components/government/ProtestsTab';
import EmergencyTab from '@/components/government/EmergencyTab';
import OfficerDashboardTab from '@/components/government/OfficerDashboardTab';
import OfficerLoungeTab from '@/components/government/OfficerLoungeTab';
import OfficerModerationTab from '@/components/government/OfficerModerationTab';
import LeadHQTab from '@/components/government/LeadHQTab';
import SecretaryTab from '@/components/government/SecretaryTab';

// Role badge component
const RoleBadge = ({ role }: { role: string }) => {
  const colors: Record<string, string> = {
    admin: 'bg-red-500/20 text-red-400 border-red-500/30',
    president: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    secretary: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    lead: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    officer: 'bg-green-500/20 text-green-400 border-green-500/30',
    citizen: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  };
  
  const labels: Record<string, string> = {
    admin: 'Admin',
    president: 'President',
    secretary: 'Secretary',
    lead: 'Lead Officer',
    officer: 'Officer',
    citizen: 'Citizen'
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${colors[role] || colors.citizen}`}>
      {labels[role] || 'Citizen'}
    </span>
  );
};

export default function GovernmentPage() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const {
    laws,
    activeLaw,
    politicalParties,
    bribes,
    protests,
    reputation,
    cityReputation,
    loading,
    error,
    setActiveLaw,
    createLaw,
    voteOnLaw,
    fetchPoliticalParties,
    createPoliticalParty,
    submitBribe,
    exposeBribe,
    createProtest,
    joinProtest,
    useEmergencyPower,
    getUserRoleLevel,
    getAvailableTabs
  } = useGovernmentSystem();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Get current tab from URL or default to first available
  const currentTab = searchParams.get('tab') || 'laws';
  
  // Get user's role level
  const roleLevel = getUserRoleLevel();
  const availableTabs = getAvailableTabs();
  
  // Redirect to first available tab if current tab is not allowed
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.find(t => t.id === currentTab)) {
      setSearchParams({ tab: availableTabs[0].id });
    }
  }, [currentTab, availableTabs]);
  
  // Tab configuration with icons
  const tabConfig = {
    'laws': { 
      component: LawsTab, 
      icon: Scroll, 
      label: 'Laws',
      description: 'City legislation and statutes'
    },
    'voting': { 
      component: VotingTab, 
      icon: Vote, 
      label: 'Voting',
      description: 'Vote on active legislation'
    },
    'enforcement': { 
      component: EnforcementTab, 
      icon: Shield, 
      label: 'Enforcement',
      description: 'Moderation and law enforcement'
    },
    'roles': { 
      component: RolesTab, 
      icon: Building2, 
      label: 'Roles & Power',
      description: 'Government hierarchy and permissions'
    },
    'history': { 
      component: HistoryTab, 
      icon: History, 
      label: 'History',
      description: 'Government action history'
    },
    'elections': { 
      component: ElectionsTab, 
      icon: PartyPopper, 
      label: 'Elections',
      description: 'Presidential elections and candidates'
    },
    'parties': { 
      component: PartiesTab, 
      icon: Users, 
      label: 'Parties',
      description: 'Political parties and affiliations'
    },
    'corruption': { 
      component: CorruptionTab, 
      icon: DollarSign, 
      label: 'Corruption',
      description: 'Bribery and corruption tracking'
    },
    'protests': { 
      component: ProtestsTab, 
      icon: Hand, 
      label: 'Protests',
      description: 'City protests and demonstrations'
    },
    'emergency': { 
      component: EmergencyTab, 
      icon: Siren, 
      label: 'Emergency',
      description: 'Emergency powers and declarations'
    },
    'officer-dashboard': { 
      component: OfficerDashboardTab, 
      icon: Activity, 
      label: 'Officer Dashboard',
      description: 'Officer operations, moderation and lounge'
    }
  };
  
  // If not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center text-white p-4">
        <div className="max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto border border-slate-800">
            <Lock className="w-10 h-10 text-slate-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">Restricted Access</h1>
            <p className="text-slate-400">
              You must be a citizen of Troll City to access the government.
            </p>
          </div>
          <button 
            onClick={() => navigate('/auth')} 
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors"
          >
            Login to Access
          </button>
        </div>
      </div>
    );
  }
  
  const ActiveComponent = tabConfig[currentTab as keyof typeof tabConfig]?.component;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mobile menu toggle */}
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-800"
              >
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Troll City Government</h1>
                  <p className="text-xs text-slate-400">Unified Political System</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* City Stats */}
              {cityReputation && (
                <div className="hidden md:flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-yellow-400 font-bold">{cityReputation.active_laws ?? 0}</div>
                    <div className="text-slate-500 text-xs">Active Laws</div>
                  </div>
                  <div className="text-center">
                    <div className="text-green-400 font-bold">{cityReputation.average_trust != null ? Math.round(cityReputation.average_trust) + '%' : '--'}</div>
                    <div className="text-slate-500 text-xs">Trust</div>
                  </div>
                  <div className="text-center">
                    <div className="text-red-400 font-bold">{cityReputation.protest_count ?? 0}</div>
                    <div className="text-slate-500 text-xs">Protests</div>
                  </div>
                </div>
              )}
              
              {/* Role Badge */}
              <RoleBadge role={roleLevel} />
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          pt-20 lg:pt-4
        `}>
          <div className="p-4 space-y-2">
            {availableTabs.map((tab) => {
              const config = tabConfig[tab.id as keyof typeof tabConfig];
              const Icon = config?.icon || Scroll;
              const isActive = currentTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSearchParams({ tab: tab.id });
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                    ${isActive 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }
                  `}
                >
                  <Icon size={20} />
                  <span className="font-medium">{tab.name}</span>
                  {isActive && <ChevronRight size={16} className="ml-auto" />}
                </button>
              );
            })}
          </div>
          
          {/* User Stats in Sidebar */}
          {reputation && (
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800 bg-slate-900/50">
              <div className="text-xs text-slate-500 mb-2">Your Reputation</div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Government Trust</span>
                  <span className={(reputation.government_trust ?? 0) > 50 ? 'text-green-400' : 'text-red-400'}>
                    {reputation.government_trust != null ? Math.round(reputation.government_trust) + '%' : '--'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Influence</span>
                  <span className="text-blue-400">{reputation.player_influence != null ? Math.round(reputation.player_influence) : '--'}</span>
                </div>
              </div>
            </div>
          )}
        </aside>
        
        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 pt-20 lg:pt-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
              {error}
            </div>
          ) : ActiveComponent ? (
            <ActiveComponent
              laws={laws}
              activeLaw={activeLaw}
              politicalParties={politicalParties}
              bribes={bribes}
              protests={protests}
              reputation={reputation}
              cityReputation={cityReputation}
              onSetActiveLaw={setActiveLaw}
              onCreateLaw={createLaw}
              onVoteOnLaw={voteOnLaw}
              onFetchPoliticalParties={fetchPoliticalParties}
              onCreatePoliticalParty={createPoliticalParty}
              onSubmitBribe={submitBribe}
              onExposeBribe={exposeBribe}
              onCreateProtest={createProtest}
              onJoinProtest={joinProtest}
              onUseEmergencyPower={useEmergencyPower}
              roleLevel={roleLevel}
            />
          ) : (
            <div className="text-center py-20 text-slate-500">
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <h3 className="text-xl font-medium text-slate-300 mb-2">No Tab Selected</h3>
              <p>Select a tab from the sidebar to view government information.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
