import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Calendar, Clock, CheckCircle, XCircle, AlertTriangle, Gavel } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import UserNameWithAge from './UserNameWithAge';

interface DocketEntry {
  id: string;
  case_type: string;
  scheduled_at: string;
  status: string;
  assigned_officer: string | null;
  notes: string | null;
  court_session_id: string | null;
}

const CourtDocketView: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [docketEntries, setDocketEntries] = useState<DocketEntry[]>([]);
  const [officerProfiles, setOfficerProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserDocket();
    }
  }, [user]);

  const loadUserDocket = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_user_docket');

      if (error) throw error;
      setDocketEntries(data || []);

      // Fetch officer profiles for RGB
      const officerIds = (data || []).map((e: any) => e.assigned_officer).filter((id: any) => id && typeof id === 'string' && id.length > 10);
      if (officerIds.length > 0) {
         const { data: profileData } = await supabase
           .from('profiles')
           .select('id, username, role, is_admin, is_troll_officer, is_troller, is_verified, rgb_username_expires_at, created_at')
           .in('id', officerIds);
         
         const profileMap: Record<string, any> = {};
         profileData?.forEach(p => profileMap[p.id] = p);
         setOfficerProfiles(profileMap);
      }
    } catch (error) {
      console.error('Error loading docket:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnterCourtroom = () => {
    // Navigate to court room - the session ID will be determined by the active court session
    navigate('/troll-court/session/active'); // We'll handle session lookup in the component
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Clock className="w-4 h-4 text-blue-400" />;
      case 'in_session':
        return <Gavel className="w-4 h-4 text-yellow-400 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'missed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'dismissed':
        return <AlertTriangle className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'border-blue-500/20 bg-blue-900/10';
      case 'in_session':
        return 'border-yellow-500/20 bg-yellow-900/10';
      case 'completed':
        return 'border-green-500/20 bg-green-900/10';
      case 'missed':
        return 'border-red-500/20 bg-red-900/10';
      case 'dismissed':
        return 'border-gray-500/20 bg-gray-900/10';
      default:
        return 'border-gray-500/20 bg-gray-900/10';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-700 rounded"></div>
            <div className="h-16 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-6 h-6 text-purple-400" />
        <div>
          <h3 className="text-xl font-bold">Your Court Docket</h3>
          <p className="text-sm text-gray-400">Scheduled court appearances and case status</p>
        </div>
      </div>

      {docketEntries.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No court cases scheduled</p>
          <p className="text-sm text-gray-500 mt-1">Your docket is clear</p>
        </div>
      ) : (
        <div className="space-y-4">
          {docketEntries.map((entry) => {
            const { date, time } = formatDateTime(entry.scheduled_at);
            const isUpcoming = new Date(entry.scheduled_at) > new Date();
            const canEnter = entry.status === 'scheduled' || entry.status === 'in_session';

            return (
              <div
                key={entry.id}
                className={`border rounded-lg p-4 ${getStatusColor(entry.status)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(entry.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold capitalize">
                          {entry.case_type.replace('_', ' ')} Case
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                          entry.status === 'scheduled' ? 'bg-blue-600 text-white' :
                          entry.status === 'in_session' ? 'bg-yellow-600 text-white' :
                          entry.status === 'completed' ? 'bg-green-600 text-white' :
                          entry.status === 'missed' ? 'bg-red-600 text-white' :
                          'bg-gray-600 text-white'
                        }`}>
                          {entry.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="text-sm text-gray-300 mb-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {date} at {time}
                        </div>
                        {entry.assigned_officer && (
                          <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            Assigned Officer: 
                            {officerProfiles[entry.assigned_officer] ? (
                              <UserNameWithAge
                                user={officerProfiles[entry.assigned_officer]}
                              />
                            ) : (
                              entry.assigned_officer
                            )}
                          </div>
                        )}
                      </div>

                      {entry.notes && (
                        <p className="text-sm text-gray-400 italic">
                          &quot;{entry.notes}&quot;
                        </p>
                      )}
                    </div>
                  </div>

                  {canEnter && isUpcoming && (
                    <button
                      onClick={() => handleEnterCourtroom()}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Enter Courtroom
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-blue-300 mb-1">Court Attendance Required</p>
            <p className="text-blue-200">
              Missing a scheduled court appearance will result in reputation penalties and may lead to additional consequences.
              Arrive on time and be prepared to present your case.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourtDocketView;
