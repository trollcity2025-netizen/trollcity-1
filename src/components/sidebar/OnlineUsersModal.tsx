import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { X, Users, User } from 'lucide-react';

interface OnlineUser {
  id: string;
  username: string;
  avatar_url?: string;
  role?: string;
  online_at: string;
}

interface OnlineUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OnlineUsersModal: React.FC<OnlineUsersModalProps> = ({ isOpen, onClose }) => {
  const { profile } = useAuthStore();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !profile) return;

    const fetchOnlineUsers = async () => {
      setLoading(true);
      
      // Subscribe to global presence channel
      const channel = supabase.channel('global-presence');
      
      const updateUsers = async () => {
        const presenceState = channel.presenceState();
        const userIds = Object.keys(presenceState);
        
        if (userIds.length > 0) {
          // Fetch user profiles for online users
          const { data: profiles, error: profilesError } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url, role')
            .in('id', userIds);
          
          if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
          }
          
          const users: OnlineUser[] = userIds.map(id => {
            const userProfile = profiles?.find(p => p.id === id);
            const presence = presenceState[id]?.[0];
            // Try to get username from presence data if profile not found
            const presenceUsername = presence?.username || presence?.user_name;
            return {
              id,
              username: userProfile?.username || presenceUsername || `User ${id.slice(0, 6)}`,
              avatar_url: userProfile?.avatar_url,
              role: userProfile?.role,
              online_at: presence?.online_at || new Date().toISOString(),
            };
          });
          
          setOnlineUsers(users.sort((a, b) => new Date(b.online_at).getTime() - new Date(a.online_at).getTime()));
        } else {
          setOnlineUsers([]);
        }
        setLoading(false);
      };

      channel.on('presence', { event: 'sync' }, updateUsers);
      channel.on('presence', { event: 'join' }, updateUsers);
      channel.on('presence', { event: 'leave' }, updateUsers);

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
          updateUsers();
        }
      });

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = fetchOnlineUsers();
    return () => {
      cleanup.then(fn => fn?.()).catch(() => {});
    };
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'text-red-400';
      case 'troll_officer':
        return 'text-blue-400';
      case 'lead_troll_officer':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-white/10 shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <Users className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Online Users</h2>
              <p className="text-sm text-gray-400">{onlineUsers.length} users currently online</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-gray-400">Loading online users...</p>
            </div>
          ) : onlineUsers.length === 0 ? (
            <div className="text-center py-8">
              <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No users online</p>
            </div>
          ) : (
            onlineUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 overflow-hidden">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-gray-500 m-2.5" />
                    )}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{user.username}</p>
                  <p className={`text-xs capitalize ${getRoleColor(user.role)}`}>
                    {user.role || 'User'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnlineUsersModal;
