import React from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';

interface UserActionsProps {
  user: {
    id: string;
    username: string;
    email: string;
    is_banned: boolean;
    role: string;
  };
  refresh: () => void;
}

const UserActions: React.FC<UserActionsProps> = ({ user, refresh }) => {
  const banUser = async () => {
    try {
      const { error } = await supabase.rpc('ban_user', {
        p_user_id: user.id,
        p_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // ban for 1 year
      });
      if (error) throw error;
      toast.success('User banned');
      refresh();
    } catch {
      toast.error('Failed to ban user');
    }
  };

  const unbanUser = async () => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_banned: false, banned_until: null })
        .eq('id', user.id);
      if (error) throw error;
      toast.success('User unbanned');
      refresh();
    } catch {
      toast.error('Failed to unban user');
    }
  };

  const deleteUser = async () => {
    if (!confirm(`Delete user @${user.username}? This action cannot be undone.`)) return;
    try {
      const { error } = await supabase.rpc('admin_soft_delete_user', {
        p_user_id: user.id,
        p_reason: 'Admin deleted via dashboard'
      });
      
      if (error) throw error;
      
      toast.success(`User @${user.username} deleted`);
      refresh();
    } catch (err) {
      toast.error(`Failed to delete user: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="flex gap-2">
      {user.is_banned ? (
        <button
          onClick={unbanUser}
          className="px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-500"
        >
          Unban
        </button>
      ) : (
        <button
          onClick={banUser}
          className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-500"
        >
          Ban
        </button>
      )}
      <button
        onClick={deleteUser}
        className="px-2 py-1 text-xs rounded bg-red-700 hover:bg-red-600"
      >
        Delete
      </button>
    </div>
  );
};

export default UserActions;