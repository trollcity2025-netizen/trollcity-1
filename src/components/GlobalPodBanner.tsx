import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Mic, X } from 'lucide-react';
import { toast } from 'sonner';

interface PodNotification {
  id: string;
  room_id: string;
  title: string;
  host_username: string;
  host_avatar_url: string;
}

export default function GlobalPodBanner() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [notification, setNotification] = useState<PodNotification | null>(null);

  useEffect(() => {
    // Check if user has enabled banner notifications
    if (profile?.banner_notifications_enabled === false) {
      setNotification(null);
      return;
    }

    const channel = supabase
      .channel('global_pod_notifications')
      .on(
        'broadcast',
        { event: 'pod_started' },
        (payload) => {
          const data = payload.payload;
          
          // Avoid notifying the host themselves
          if (profile?.id === data.host_id) return;

          setNotification({
            id: data.id,
            room_id: data.room_id,
            title: data.title,
            host_username: data.host_username,
            host_avatar_url: data.host_avatar_url
          });
          
          // Auto dismiss after 8 seconds
          setTimeout(() => setNotification(null), 8000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.banner_notifications_enabled, profile?.id]);

  if (!notification) return null;

  return (
    <div className="fixed top-20 right-4 z-[100] animate-in slide-in-from-right fade-in duration-300 pointer-events-auto">
      <div className="bg-gradient-to-r from-purple-900/90 to-indigo-900/90 backdrop-blur-md border border-purple-500/30 rounded-lg shadow-2xl p-4 w-80 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 animate-pulse" />
        
        <button 
          onClick={(e) => { e.stopPropagation(); setNotification(null); }}
          className="absolute top-2 right-2 text-white/50 hover:text-white transition-colors z-10"
        >
          <X size={16} />
        </button>

        <div 
          className="relative z-10 flex items-center gap-3 cursor-pointer"
          onClick={() => {
            toast.info('Troll Pods are currently under construction. Please check back soon!');
            setNotification(null);
          }}
        >
          <div className="relative">
             <div className="w-12 h-12 rounded-full border-2 border-purple-500 p-0.5">
               <img 
                 src={notification.host_avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${notification.host_username}`}
                 alt={notification.host_username}
                 className="w-full h-full rounded-full object-cover bg-black"
               />
             </div>
             <div className="absolute -bottom-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-black flex items-center gap-1">
               <Mic size={8} /> LIVE
             </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-bold truncate">{notification.title}</h4>
            <p className="text-purple-200 text-xs truncate">
              {notification.host_username} started a pod!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
