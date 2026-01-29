import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Users, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';

interface Officer {
  id: string;
  username: string;
  avatar_url: string | null;
  role: string;
  is_troll_officer: boolean;
  is_lead_officer: boolean;
  officer_level: number;
}

export default function StaffManagement() {
  const [loading, setLoading] = useState(true);
  const [officers, setOfficers] = useState<Officer[]>([]);

  useEffect(() => {
    fetchOfficers();
  }, []);

  const fetchOfficers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, role, is_troll_officer, is_lead_officer, officer_level')
        .or('is_troll_officer.eq.true,role.eq.troll_officer')
        .order('username');

      if (error) throw error;
      setOfficers(data as any || []);
    } catch (err) {
      console.error('Error loading officers:', err);
      toast.error('Failed to load staff list');
    } finally {
      setLoading(false);
    }
  };

  const toggleLeadRole = async (officerId: string, currentStatus: boolean) => {
    try {
      const newRole = currentStatus ? 'troll_officer' : 'lead_troll_officer';
      
      const { error } = await supabase.rpc('set_user_role', {
        target_user: officerId,
        new_role: newRole,
        reason: currentStatus ? 'Demoted from Lead Officer' : 'Promoted to Lead Officer'
      });

      if (error) throw error;
      
      toast.success(`Role updated to ${newRole}`);
      
      // Update local state
      setOfficers(prev => prev.map(o => 
        o.id === officerId ? { 
          ...o, 
          is_lead_officer: !currentStatus,
          role: newRole
        } : o
      ));
    } catch (err: any) {
      console.error('Error updating role:', err);
      toast.error('Failed to update role: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="text-purple-400" />
          Staff Management
        </h2>
        <div className="text-sm text-gray-400">
          Manage officer roles and assignments
        </div>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm text-left text-gray-400">
          <thead className="bg-white/5 text-gray-300 uppercase text-xs">
            <tr>
              <th className="px-6 py-3">Officer</th>
              <th className="px-6 py-3">Level</th>
              <th className="px-6 py-3">Lead Status</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center">Loading staff...</td></tr>
            ) : officers.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center">No officers found</td></tr>
            ) : (
              officers.map((officer) => (
                <tr key={officer.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden">
                      {officer.avatar_url ? (
                        <img src={officer.avatar_url} alt={officer.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">
                          {officer.username.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-white">{officer.username}</div>
                      <div className="text-xs text-gray-500">ID: {officer.id.substring(0, 8)}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded bg-purple-900/50 text-purple-300 text-xs border border-purple-500/30">
                      Level {officer.officer_level || 1}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {officer.is_lead_officer ? (
                      <span className="flex items-center gap-1 text-amber-400 font-medium">
                        <BadgeCheck className="w-4 h-4" /> Lead Officer
                      </span>
                    ) : (
                      <span className="text-gray-500 text-xs">Standard Officer</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleLeadRole(officer.id, officer.is_lead_officer)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${
                        officer.is_lead_officer
                          ? 'bg-red-900/20 border-red-500/30 text-red-400 hover:bg-red-900/40'
                          : 'bg-green-900/20 border-green-500/30 text-green-400 hover:bg-green-900/40'
                      }`}
                    >
                      {officer.is_lead_officer ? 'Remove Lead' : 'Promote to Lead'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
