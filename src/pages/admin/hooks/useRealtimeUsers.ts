import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  is_banned: boolean;
  created_at: string;
}

export const useRealtimeUsers = (): User[] => {
  const [users, setUsers] = useState<User[]>([]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, username, email, role, is_banned, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    setUsers(data || []);
  };

  useEffect(() => {
    loadUsers();

    /*
    // CRITICAL: Removed global listener to prevent DB hammering
    const channel = supabase
      .channel('realtime-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, loadUsers)
      .subscribe();
    */

    return () => {
      // supabase.removeChannel(channel);
    };
  }, []);

  return users;
};