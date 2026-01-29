import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Clock, CheckCircle, XCircle, AlertTriangle, Gavel, FileText, Trash2 } from 'lucide-react';
import ClickableUsername from './ClickableUsername';

interface DocketEntry {
  id: string;
  user_id: string;
  username: string;
  case_type: string;
  scheduled_at: string;
  status: string;
  assigned_officer: string | null;
  officer_username: string | null;
  notes: string | null;
  court_session_id: string | null;
}

const CourtDocketDashboard: React.FC = (): JSX.Element => {
  const { profile } = useAuthStore();
  const [docketEntries, setDocketEntries] = useState<DocketEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'in_session' | 'completed' | 'missed'>('all');

  useEffect(() => {
    loadAllDocketEntries();
  }, []);

  const loadAllDocketEntries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_all_docket_entries');

      if (error) throw error;
      setDocketEntries(data || []);

      // Fetch profiles for RGB
      const userIds = (data || []).map((e: any) => e.user_id).filter(Boolean);
      const officerIds = (data || []).map((e: any) => e.assigned_officer).filter((id: any) => id && typeof id === 'string' && id.length > 10); // Simple check for UUID-like
      const allIds = Array.from(new Set([...userIds, ...officerIds]));

      if (allIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username, role, is_admin, is_troll_officer, is_troller, is_verified, rgb_username_expires_at')
          .in('id', allIds);
        
        const profileMap: Record<string, any> = {};
        profileData?.forEach(p => profileMap[p.id] = p);
        setProfiles(profileMap);
      }
    } catch (error) {
      console.error('Error loading docket entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDocketStatus = async (docketId: string, newStatus: string, notes?: string) => {
    try {
      const updateData: any = { status: newStatus, updated_at: new Date().toISOString() };
      if (notes) updateData.notes = notes;

      const { error } = await supabase
        .from('court_docket')
        .update(updateData)
        .eq('id', docketId);
  // Soft delete function
  const softDeleteDocket = async (docketId: string) => {
    if (!confirm('Are you sure you want to delete this docket entry?')) return;
    await updateDocketStatus(docketId, 'deleted', 'Entry deleted');
  };

      if (error) throw error;

      // Reload data
      await loadAllDocketEntries();
    } catch (error) {
      console.error('Error updating docket:', error);
    }
  };

  const dismissCase = async (docketId: string) => {
    if (!confirm('Are you sure you want to dismiss this case?')) return;
    await updateDocketStatus(docketId, 'dismissed', 'Case dismissed by authority');
  };

  const markMissed = async (docketId: string) => {
    await updateDocketStatus(docketId, 'missed');
  };

  const completeCase = async (docketId: string) => {
    const verdict = prompt('Enter verdict/resolution:');
    if (verdict) {
      await updateDocketStatus(docketId, 'completed', verdict);
    }
  };

  // Filter out deleted entries
  const filteredEntries = docketEntries.filter(entry => {
    if (entry.status === 'deleted') return false;
    if (filter === 'all') return true;
    return entry.status === filter;
  });

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

  const canManageCases = profile?.role === 'admin' || profile?.is_lead_officer || profile?.is_admin;

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Gavel className="w-6 h-6 text-purple-400" />
          <div>
            <h3 className="text-xl font-bold">Court Docket Management</h3>
            <p className="text-sm text-gray-400">Manage all scheduled court cases</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Filter:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm"
          >
            <option value="all">All Cases</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_session">In Session</option>
            <option value="completed">Completed</option>
            <option value="missed">Missed</option>
          </select>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-5 gap-4 text-sm font-semibold text-gray-400 border-b border-gray-700 pb-2">
        <div>User</div>
        <div>Case Type</div>
        <div>Scheduled</div>
        <div>Status</div>
        <div>Actions</div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No docket entries found</p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const { date, time } = formatDateTime(entry.scheduled_at);

            return (
              <div
                key={entry.id}
                className={`border rounded-lg p-4 ${getStatusColor(entry.status)}`}
              >
                <div className="grid grid-cols-5 gap-4 items-center">
                  <div>
                    <div className="font-semibold text-sm">{entry.username}</div>
                    <div className="text-xs text-gray-400">ID: {entry.user_id.slice(0, 8)}</div>
                  </div>

                  <div>
                    <span className="capitalize text-sm">
                      {entry.case_type.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="text-sm">
                    <div>{date}</div>
                    <div className="text-gray-400">{time}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusIcon(entry.status)}
                    <span className="capitalize text-sm">
                      {entry.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex gap-1">
                    {canManageCases && (entry.status === 'scheduled' || entry.status === 'in_session') && (
                      <>
                        {entry.status === 'scheduled' && (
                          <>
                            <button
                              onClick={() => completeCase(entry.id)}
                              className="p-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                              title="Mark Completed"
                            >
                              <CheckCircle className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => markMissed(entry.id)}
                              className="p-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                              title="Mark Missed"
                            >
                              <XCircle className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => dismissCase(entry.id)}
                              className="p-1 bg-gray-600 hover:bg-gray-700 rounded text-xs"
                              title="Dismiss Case"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => softDeleteDocket(entry.id)}
                          className="p-1 bg-black hover:bg-red-800 rounded text-xs ml-1"
                          title="Delete (Soft)"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </>
                    )}

                    {entry.status === 'in_session' && (
                      <button
                        onClick={() => completeCase(entry.id)}
                        className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-semibold"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>

                {entry.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <p className="text-sm text-gray-400 italic">"{entry.notes}"</p>
                  </div>
                )}

                {entry.assigned_officer && (
                  <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    Assigned: 
                    {profiles[entry.assigned_officer] ? (
                      <ClickableUsername 
                        username={profiles[entry.assigned_officer].username} 
                        userId={entry.assigned_officer}
                        profile={profiles[entry.assigned_officer]}
                      />
                    ) : (
                      entry.officer_username || entry.assigned_officer
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-6 grid grid-cols-5 gap-4 text-sm">
        <div className="text-center">
          <div className="text-lg font-bold text-blue-400">
            {docketEntries.filter(e => e.status === 'scheduled').length}
          </div>
          <div className="text-gray-400">Scheduled</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-yellow-400">
            {docketEntries.filter(e => e.status === 'in_session').length}
          </div>
          <div className="text-gray-400">In Session</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-green-400">
            {docketEntries.filter(e => e.status === 'completed').length}
          </div>
          <div className="text-gray-400">Completed</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-red-400">
            {docketEntries.filter(e => e.status === 'missed').length}
          </div>
          <div className="text-gray-400">Missed</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-400">
            {docketEntries.filter(e => e.status === 'dismissed').length}
          </div>
          <div className="text-gray-400">Dismissed</div>
        </div>
      </div>
    </div>
  );
};

export default CourtDocketDashboard;
