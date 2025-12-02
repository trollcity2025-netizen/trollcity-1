import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import UserActions from "./UserActions";

const UsersPanel: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: queryError } = await supabase
        .from("user_profiles")
        .select("id, username, avatar_url, is_banned, role, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (queryError) {
        console.error('Error loading users:', queryError);
        setError(`Failed to load users: ${queryError.message}`);
        toast.error(`Failed to load users: ${queryError.message}`);
        setUsers([]);
        return;
      }
      
      console.log('Loaded users:', data?.length || 0);
      setUsers(data || []);
    } catch (err: any) {
      console.error('Exception loading users:', err);
      setError(`Error: ${err?.message || 'Unknown error'}`);
      toast.error(`Failed to load users: ${err?.message || 'Unknown error'}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();

    const channel = supabase
      .channel("admin_users")
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "user_profiles" 
      }, () => {
        console.log('User profiles changed, reloading...');
        loadUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-3">User Management</h2>
        <div className="bg-black/40 rounded-lg p-4">
          <div className="text-center py-8 text-gray-400">Loading users...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-3">User Management</h2>
        <div className="bg-black/40 rounded-lg p-4">
          <div className="text-center py-8">
            <div className="text-red-400 mb-2">{error}</div>
            <button 
              onClick={loadUsers}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-2xl font-semibold">User Management</h2>
        <button 
          onClick={loadUsers}
          className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
        >
          Refresh
        </button>
      </div>
      <div className="bg-black/40 rounded-lg p-4">
        {users.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No users found</div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="flex justify-between border-b border-gray-800 py-2">
              <div>
                <p className="text-white">
                  @{u.username || 'No username'} 
                  {u.is_banned && <span className="text-red-600 ml-2">(Banned)</span>}
                  {u.role === 'admin' && <span className="text-yellow-400 ml-2">(Admin)</span>}
                </p>
                <p className="text-xs text-gray-500">
                  Created: {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Unknown'}
                </p>
              </div>
              <UserActions user={u} refresh={loadUsers} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UsersPanel;