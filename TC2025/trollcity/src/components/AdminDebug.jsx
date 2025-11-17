import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUserProfile } from '@/api/supabaseHelpers';

export default function AdminDebug() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUserProfile,
  });

  if (isLoading) return <div>Loading user info...</div>;
  if (!user) return <div>No user found</div>;

  const isAdmin = user.role === 'admin' || user.is_admin || user.user_metadata?.role === 'admin';

  return (
    <div className="p-4 bg-gray-900 text-white">
      <h3>User Debug Info</h3>
      <pre>{JSON.stringify({
        id: user.id,
        username: user.username,
        role: user.role,
        is_admin: user.is_admin,
        user_metadata: user.user_metadata,
        isAdmin
      }, null, 2)}</pre>
    </div>
  );
}