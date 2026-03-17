import React, { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { Mic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function GlobalPodNotification() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Only listen if user has notifications enabled (default true)
    // If profile is not loaded yet, we might miss it, but that's acceptable for now.
    // We default to true if the column is missing or null.
    const notificationsEnabled = (profile as any)?.banner_notifications_enabled ?? true;
    
    if (!notificationsEnabled) return;

    const channel = supabase
      .channel('global_pod_notifications')
      .on(
        'broadcast',
        { event: 'pod_started' },
        (payload) => {
          const { title, host_username, room_id } = payload.payload;
          
          toast.custom((t) => (
            <div 
              className="bg-gray-900 border border-purple-500/50 rounded-xl p-4 shadow-2xl shadow-purple-500/20 cursor-pointer flex items-center gap-4 w-full max-w-md hover:bg-gray-800 transition-colors"
              onClick={() => {
                toast.dismiss(t);
                toast.info('Troll Pods are currently under construction. Please check back soon!');
              }}
            >
              <div className="bg-purple-600/20 p-3 rounded-full animate-pulse">
                <Mic className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">New Pod Live!</h4>
                <p className="text-gray-300 text-xs">{host_username} started &quot;{title}&quot;</p>
              </div>
            </div>
          ), { duration: 8000, position: 'top-center' });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, navigate]);

  return null;
}
