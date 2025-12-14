import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../lib/supabase';
import { Crown, Shield, Users, ChevronDown, ChevronUp, Activity, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface OfficerProfile extends UserProfile {
  status?: 'watching' | 'in_court' | 'reviewing' | 'patrol';
  assignment?: string;
}

interface AuthorityActivity {
  id: string;
  type: 'case_opened' | 'fine_issued' | 'user_muted' | 'user_warned' | 'court_started';
  message: string;
  timestamp: Date;
}

const AuthorityPanel: React.FC = () => {
  const location = useLocation();
  const [admins, setAdmins] = useState<OfficerProfile[]>([]);
  const [leadOfficers, setLeadOfficers] = useState<OfficerProfile[]>([]);
  const [officers, setOfficers] = useState<OfficerProfile[]>([]);
  const [activities, setActivities] = useState<AuthorityActivity[]>([]);
  const [officersCollapsed, setOfficersCollapsed] = useState(true);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [courtSession, setCourtSession] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<'courtroom' | 'stream' | 'lobby'>('lobby');

  useEffect(() => {
    // Determine current location based on route
    const path = location.pathname;
    if (path.includes('/troll-court') || path.includes('/court-room')) {
      setCurrentLocation('courtroom');
    } else if (path.includes('/stream') || path.includes('/live')) {
      setCurrentLocation('stream');
    } else {
      setCurrentLocation('lobby');
    }

    loadAuthorityData();
    loadCourtSession();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadAuthorityData();
      loadCourtSession();
    }, 30000);

    return () => clearInterval(interval);
  }, [location.pathname]);

  // Monitor court session changes
  useEffect(() => {
    const channel = supabase
      .channel('court-sessions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'court_sessions'
      }, (_payload) => {
        loadCourtSession();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Court auto-start logic
  useEffect(() => {
    if (!courtSession || courtSession.status !== 'waiting') return;
    if (currentLocation !== 'courtroom') return;

    // Check if any authority is present
    const hasAuthority = [...admins, ...leadOfficers, ...officers].length > 0;

    if (hasAuthority) {
      // Try to auto-start court
      autoStartCourt();
    }
  }, [courtSession, currentLocation, admins, leadOfficers, officers]);

  const loadCourtSession = async () => {
    try {
      const { data, error } = await supabase.rpc('get_current_court_session');
      if (error) throw error;
      setCourtSession(data?.[0] || null);
    } catch (error) {
      console.error('Error loading court session:', error);
    }
  };

  const autoStartCourt = async () => {
    try {
      // Get the first available authority user
      const authorityUser = [...admins, ...leadOfficers, ...officers][0];
      if (!authorityUser) return;

      // Try the new docket-aware auto-start first
      const { data: docketStarted, error: docketError } = await supabase.rpc('auto_start_court_with_docket', {
        p_authority_user_id: authorityUser.id
      });

      if (docketError) {
        console.warn('Docket auto-start failed, trying legacy method:', docketError);
        // Fall back to legacy auto-start
        const { data, error } = await supabase.rpc('auto_start_court_session', {
          authority_user_id: authorityUser.id
        });

        if (error) throw error;

        if (data) {
          await loadCourtSession();
          setActivities(prev => [{
            id: Date.now().toString(),
            type: 'court_started',
            message: 'Court Session Started',
            timestamp: new Date()
          }, ...prev.slice(0, 2)]);
        }
      } else if (docketStarted) {
        // Court was started with docket
        await loadCourtSession();
        setActivities(prev => [{
          id: Date.now().toString(),
          type: 'court_started',
          message: 'Court Session Started (Docket Cases)',
          timestamp: new Date()
        }, ...prev.slice(0, 2)]);
      }
    } catch (error) {
      console.error('Error auto-starting court:', error);
    }
  };

  const loadAuthorityData = async () => {
    try {
      setLoading(true);

      // Fetch admins
      const { data: adminData, error: adminError } = await supabase
        .from('user_profiles')
        .select('*')
        .or('role.eq.admin,is_admin.eq.true')
        .eq('is_officer_active', true);

      if (adminError) throw adminError;

      // Fetch lead officers
      const { data: leadOfficerData, error: leadOfficerError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('is_lead_officer', true)
        .eq('is_officer_active', true);

      if (leadOfficerError) throw leadOfficerError;

      // Fetch regular officers
      const { data: officerData, error: officerError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('is_troll_officer', true)
        .eq('is_officer_active', true)
        .eq('is_lead_officer', false);

      if (officerError) throw officerError;

      // Mock status and assignments for demo (in real app, this would come from presence/activity data)
      const mockStatuses: ('watching' | 'in_court' | 'reviewing' | 'patrol')[] = ['watching', 'in_court', 'reviewing', 'patrol'];
      const mockAssignments = ['Stream Patrol', 'Court Duty', 'Report Review', 'General Patrol'];

      const adminsWithStatus = (adminData || []).map(admin => ({
        ...admin,
        status: 'watching' as const,
        assignment: 'Monitoring All Sessions'
      }));

      const leadOfficersWithStatus = (leadOfficerData || []).map(officer => ({
        ...officer,
        status: mockStatuses[Math.floor(Math.random() * mockStatuses.length)],
        assignment: mockAssignments[Math.floor(Math.random() * mockAssignments.length)]
      }));

      const officersWithStatus = (officerData || []).map(officer => ({
        ...officer,
        status: mockStatuses[Math.floor(Math.random() * mockStatuses.length)],
        assignment: mockAssignments[Math.floor(Math.random() * mockAssignments.length)]
      }));

      setAdmins(adminsWithStatus);
      setLeadOfficers(leadOfficersWithStatus);
      setOfficers(officersWithStatus);

      // Mock recent activities
      const mockActivities: AuthorityActivity[] = [
        { id: '1', type: 'case_opened', message: 'Case Opened', timestamp: new Date(Date.now() - 30000) },
        { id: '2', type: 'fine_issued', message: 'Fine Issued', timestamp: new Date(Date.now() - 120000) },
        { id: '3', type: 'user_muted', message: 'User Muted', timestamp: new Date(Date.now() - 180000) },
      ];
      setActivities(mockActivities);

    } catch (error) {
      console.error('Error loading authority data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'watching': return 'text-green-400';
      case 'in_court': return 'text-red-400';
      case 'reviewing': return 'text-yellow-400';
      case 'patrol': return 'text-blue-400';
      case 'presiding': return 'text-yellow-400 font-bold';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'watching': return '🟢';
      case 'in_court': return '🔴';
      case 'reviewing': return '🟡';
      case 'patrol': return '🔵';
      default: return '⚪';
    }
  };

  // Mobile collapsed bar
  const MobileBar = () => (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700">
      <button
        onClick={() => setMobileExpanded(!mobileExpanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-purple-400" />
          <span className="text-white font-bold">AUTHORITY ONLINE</span>
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        </div>
        <div className="flex items-center gap-3">
          {admins.length > 0 && <Crown className="w-4 h-4 text-yellow-400" />}
          <span className="text-gray-300 text-sm">
            {leadOfficers.length + officers.length} Officers
          </span>
          {mobileExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>
    </div>
  );

  // Mobile expanded panel
  const MobilePanel = () => (
    <div className="lg:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm">
      <div className="absolute top-16 left-4 right-4 bottom-4 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-gray-900 to-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-bold text-white">AUTHORITY ONLINE</h2>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>
            <button
              onClick={() => setMobileExpanded(false)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Admin Presence */}
          {admins.map((admin) => (
            <div key={admin.id} className="p-4 border-b border-gray-700 bg-gradient-to-r from-yellow-900/20 to-orange-900/20">
              <div className="flex items-center gap-3">
                <Crown className="w-6 h-6 text-yellow-400 animate-pulse" />
                <div className="flex-1">
                  <div className="text-yellow-300 font-bold text-sm">{admin.username}</div>
                  <div className="text-yellow-400/70 text-xs">ADMIN</div>
                  <div className="text-yellow-400/50 text-xs">{admin.assignment}</div>
                </div>
              </div>
            </div>
          ))}

          {/* Lead Officers */}
          {leadOfficers.map((officer) => (
            <div key={officer.id} className="p-3 border-b border-gray-700 bg-gradient-to-r from-purple-900/20 to-blue-900/20">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-purple-400" />
                <div className="flex-1">
                  <div className="text-purple-300 font-semibold text-sm">{officer.username}</div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${getStatusColor(
                      courtSession?.status === 'live' && currentLocation === 'courtroom' ? 'presiding' : officer.status
                    )}`}>
                      {courtSession?.status === 'live' && currentLocation === 'courtroom'
                        ? '⚖ Presiding'
                        : `${getStatusIcon(officer.status)} Lead Officer • ${officer.status}`
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Regular Officers - Collapsible */}
          <div className="border-b border-gray-700">
            <button
              onClick={() => setOfficersCollapsed(!officersCollapsed)}
              className="w-full p-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-red-400" />
                <span className="text-red-300 font-semibold text-sm">
                  Troll Officers Online ({officers.length})
                </span>
              </div>
              {officersCollapsed ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {!officersCollapsed && (
              <div className="bg-red-900/10 border-t border-red-900/30">
                {officers.map((officer) => (
                  <div key={officer.id} className="p-3 border-b border-red-900/20 last:border-b-0">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                      <div className="flex-1">
                        <div className="text-red-300 font-medium text-sm">{officer.username}</div>
                        <div className="text-red-400/70 text-xs">{officer.assignment}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 text-xs font-semibold">LIVE ACTION</span>
            </div>
            <div className="space-y-1">
              {activities.slice(0, 3).map((activity) => (
                <div
                  key={activity.id}
                  className="text-gray-500 text-xs opacity-80 animate-fade-in"
                >
                  {activity.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <>
        {/* Mobile loading bar */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 p-3">
          <div className="animate-pulse flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-700 rounded w-32"></div>
          </div>
        </div>

        {/* Desktop loading panel */}
        <div className="hidden lg:block w-80 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-700 rounded mb-4"></div>
            <div className="space-y-3">
              <div className="h-16 bg-gray-700 rounded"></div>
              <div className="h-12 bg-gray-700 rounded"></div>
              <div className="h-12 bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile Version */}
      <MobileBar />
      {mobileExpanded && <MobilePanel />}

      {/* Desktop Version */}
      <div className="hidden lg:block w-80 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl">
        {/* Header */}
        <div className={`p-4 border-b border-gray-700 rounded-t-lg ${
          courtSession?.status === 'live'
            ? 'bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-yellow-500/50 animate-pulse'
            : 'bg-gradient-to-r from-gray-900 to-gray-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-bold text-white">
                {courtSession?.status === 'live' ? 'AUTHORITY ONLINE ⚖ COURT IN SESSION' : 'AUTHORITY ONLINE'}
              </h2>
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                courtSession?.status === 'live' ? 'bg-yellow-400' : 'bg-green-400'
              }`}></div>
            </div>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {/* Admin Presence */}
          {admins.map((admin) => (
            <div key={admin.id} className="p-4 border-b border-gray-700 bg-gradient-to-r from-yellow-900/20 to-orange-900/20">
              <div className="flex items-center gap-3">
                <Crown className="w-6 h-6 text-yellow-400 animate-pulse" />
                <div className="flex-1">
                  <div className="text-yellow-300 font-bold text-sm">{admin.username}</div>
                  <div className="text-yellow-400/70 text-xs">ADMIN</div>
                  <div className="text-yellow-400/50 text-xs">{admin.assignment}</div>
                </div>
              </div>
            </div>
          ))}

          {/* Lead Officers */}
          {leadOfficers.map((officer) => (
            <div key={officer.id} className="p-3 border-b border-gray-700 bg-gradient-to-r from-purple-900/20 to-blue-900/20">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-purple-400" />
                <div className="flex-1">
                  <div className="text-purple-300 font-semibold text-sm">{officer.username}</div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${getStatusColor(officer.status)}`}>
                      {getStatusIcon(officer.status)} Lead Officer • {officer.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Regular Officers - Collapsible */}
          <div className="border-b border-gray-700">
            <button
              onClick={() => setOfficersCollapsed(!officersCollapsed)}
              className="w-full p-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-red-400" />
                <span className="text-red-300 font-semibold text-sm">
                  Troll Officers Online ({officers.length})
                </span>
              </div>
              {officersCollapsed ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {!officersCollapsed && (
              <div className="bg-red-900/10 border-t border-red-900/30">
                {officers.map((officer) => (
                  <div key={officer.id} className="p-3 border-b border-red-900/20 last:border-b-0">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                      <div className="flex-1">
                        <div className="text-red-300 font-medium text-sm">{officer.username}</div>
                        <div className="text-red-400/70 text-xs">{officer.assignment}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 text-xs font-semibold">LIVE ACTION</span>
            </div>
            <div className="space-y-1">
              {activities.slice(0, 3).map((activity) => (
                <div
                  key={activity.id}
                  className="text-gray-500 text-xs opacity-80 animate-fade-in"
                >
                  {activity.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AuthorityPanel;