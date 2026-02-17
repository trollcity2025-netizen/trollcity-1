import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { X, Megaphone } from 'lucide-react';

interface PrivateAnnouncementData {
  id: string;
  user_id: string;
  data: {
    title: string;
    message: string;
  };
  is_read: boolean;
  created_at: string;
}

export default function PrivateAnnouncement() {
  const { user } = useAuthStore();
  const [announcement, setAnnouncement] = useState<PrivateAnnouncementData | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const fetchAnnouncement = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .in('data->>title', ['📢 Admin Announcement', '📢 Officer Announcement'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching private announcement:', error);
        return;
      }

      if (data && data.length > 0) {
        setAnnouncement(data[0]);
        setIsVisible(true);
      } else {
        setAnnouncement(null);
        setIsVisible(false);
      }
    } catch (err) {
      console.error('Error fetching private announcement:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchAnnouncement();
  }, [user, fetchAnnouncement]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`private-announcements-for-${user.id}`);
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as PrivateAnnouncementData;
          if (
            newNotification.data &&
            (newNotification.data.title === '📢 Admin Announcement' ||
             newNotification.data.title === '📢 Officer Announcement') &&
            !newNotification.is_read
          ) {
            if (!announcement) {
              fetchAnnouncement();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, announcement, fetchAnnouncement]);

  const handleDismiss = async () => {
    if (!announcement) return;

    const dismissedId = announcement.id;
    setIsVisible(false);
    setAnnouncement(null);


    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', dismissedId);

      if (error) {
        console.error('Error dismissing announcement:', error);
        fetchAnnouncement();
      } else {
        setTimeout(fetchAnnouncement, 300);
      }
    } catch (err) {
      console.error('Error dismissing announcement:', err);
      fetchAnnouncement();
    }
  };

  if (!isVisible || !announcement) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-[100] w-full max-w-md animate-slide-in-from-bottom">
      <div className="bg-gradient-to-r from-blue-900/90 to-cyan-900/90 backdrop-blur-md border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.4)] rounded-xl p-4 flex items-start gap-4">
        <div className="bg-blue-500/20 p-2 rounded-full shrink-0">
          <Megaphone className="text-blue-300 w-6 h-6" />
        </div>
        <div className="flex-1">
          <h4 className="text-blue-200 font-bold text-sm uppercase tracking-wider mb-1">
            {announcement.data.title}
          </h4>
          <p className="text-white text-base font-medium leading-relaxed">
            {announcement.data.message}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-blue-300 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
