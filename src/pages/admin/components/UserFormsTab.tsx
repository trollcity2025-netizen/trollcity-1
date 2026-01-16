import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { FileText, AlertCircle, Bell, Check, Search, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface UserFormStatus {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  tax_info: any | null; // Adjust based on actual schema
  w9_status: string | null; // e.g., 'pending', 'submitted', 'verified'
  onboarding_completed: boolean;
  avatar_url: string | null;
}

export default function UserFormsTab() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserFormStatus[]>([]);
  const [filter, setFilter] = useState<'all' | 'incomplete'>('incomplete');
  const [search, setSearch] = useState('');
  const [viewingUser, setViewingUser] = useState<{ id: string; username: string } | null>(null);
  const { profile: adminProfile } = useAuthStore();

  const canViewDetails = adminProfile?.role === 'admin' || adminProfile?.is_admin === true || adminProfile?.role === 'secretary';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch profiles first
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select(`
          id,
          username,
          full_name,
          onboarding_completed,
          avatar_url
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (profileError) throw profileError;

      if (!profiles || profiles.length === 0) {
        setUsers([]);
        return;
      }

      // 2. Fetch tax info for these users
      const userIds = profiles.map(p => p.id);
      const { data: taxInfos, error: taxError } = await supabase
        .from('user_tax_info')
        .select('id, user_id, w9_status, legal_full_name')
        .in('user_id', userIds);

      if (taxError && !taxError.message.includes('relation')) {
        // Log error but continue if it's just missing table/relation issue
        console.warn('Error fetching tax info:', taxError);
      }

      // 3. Map them together
      const mappedUsers = profiles.map(u => {
        const taxInfo = taxInfos?.find(t => t.user_id === u.id);
        const hasTaxInfo = !!taxInfo;
        const _isTaxCompleted = taxInfo?.w9_status === 'verified' || taxInfo?.w9_status === 'submitted';
        
        // Determine w9 status
        let w9Status = 'pending';
        if (taxInfo?.w9_status) w9Status = taxInfo.w9_status;
        else if (hasTaxInfo) w9Status = 'submitted';

        return {
          ...u,
          email: 'Hidden (Privacy)', 
          tax_info: taxInfo,
          w9_status: w9Status
        };
      });

      setUsers(mappedUsers as any);
    } catch (err) {
      console.error('Error fetching user forms:', err);
      toast.error('Failed to load user forms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const channel = supabase
      .channel('user-forms-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles' },
        () => fetchUsers()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_tax_info' },
        () => fetchUsers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUsers]);

  const handlePromptUser = async (userId: string, missingForms: string[]) => {
    try {
      // Logic to send a notification
      // This could insert into a 'notifications' table
    const { error } = await supabase.rpc('notify_user_rpc', {
      p_target_user_id: userId,
      p_type: 'system_alert',
      p_title: 'Action Required: Complete Your Profile',
      p_message: `Please complete the following forms: ${missingForms.join(', ')}. Go to your profile settings to update.`,
    });

    if (error) throw error;
      toast.success('Notification sent to user');
    } catch (err) {
      console.error('Error sending prompt:', err);
      toast.error('Failed to send prompt');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(search.toLowerCase());
    if (filter === 'all') return matchesSearch;
    // Incomplete if missing full_name or onboarding
    return matchesSearch && (!u.full_name || !u.onboarding_completed);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="text-blue-400" />
          User Forms & Compliance
        </h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-zinc-900 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <select 
            value={filter} 
            onChange={e => setFilter(e.target.value as any)}
            className="bg-zinc-900 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Users</option>
            <option value="incomplete">Incomplete Forms</option>
          </select>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm text-left text-gray-400">
          <thead className="bg-white/5 text-gray-300 uppercase text-xs">
            <tr>
              <th className="px-6 py-3">User</th>
              <th className="px-6 py-3">Profile Status</th>
              <th className="px-6 py-3">Tax Forms (W9)</th>
              <th className="px-6 py-3">Onboarding</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center">Loading users...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center">No users found matching criteria</td></tr>
            ) : (
              filteredUsers.map((user) => {
                const missing = [];
                if (!user.full_name) missing.push('Profile Info');
                if (user.w9_status !== 'submitted' && user.w9_status !== 'verified') missing.push('Tax Info');
                if (!user.onboarding_completed) missing.push('Onboarding');

                return (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">
                            {user.username.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      {canViewDetails ? (
                        <button
                          onClick={() => setViewingUser({ id: user.id, username: user.username })}
                          className="font-medium text-white hover:text-purple-400 underline transition-colors"
                        >
                          {user.username}
                        </button>
                      ) : (
                        <span className="font-medium text-white">{user.username}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.full_name ? (
                        <span className="flex items-center gap-1 text-green-400">
                          <Check className="w-3 h-3" /> Complete
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400">
                          <AlertCircle className="w-3 h-3" /> Missing Name
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.w9_status === 'submitted' || user.w9_status === 'verified' ? (
                        <span className="flex items-center gap-1 text-green-400">
                          <Check className="w-3 h-3" /> Submitted
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-yellow-400">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.onboarding_completed ? (
                        <span className="flex items-center gap-1 text-green-400">
                          <Check className="w-3 h-3" /> Done
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400">
                          <AlertCircle className="w-3 h-3" /> Incomplete
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {missing.length > 0 && (
                        <button 
                          onClick={() => handlePromptUser(user.id, missing)}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors"
                        >
                          <Bell className="w-3 h-3" /> Prompt
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* User Details Modal */}
      {viewingUser && (
        <UserDetailsModal
          userId={viewingUser.id}
          username={viewingUser.username}
          onClose={() => setViewingUser(null)}
        />
      )}
    </div>
  );
}
