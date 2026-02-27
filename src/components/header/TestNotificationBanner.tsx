
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { Notification } from '../../types/notifications';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, X } from 'lucide-react';

const TestNotificationBanner = () => {
  const { user } = useAuthStore();
  const [latestNotification, setLatestNotification] = useState<Notification | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`test-banner-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          // Only show banner for a short period
          setLatestNotification(newNotif);
          setTimeout(() => {
            setLatestNotification(null);
          }, 5000); // Hide after 5 seconds
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <AnimatePresence>
      {latestNotification && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 w-full max-w-md z-[100]"
        >
          <div className="bg-purple-600 text-white p-4 rounded-lg shadow-lg flex items-start gap-4">
            <Bell className="w-6 h-6 mt-1" />
            <div className="flex-1">
              <h3 className="font-bold">{latestNotification.title}</h3>
              <p className="text-sm">{latestNotification.message}</p>
            </div>
            <button onClick={() => setLatestNotification(null)} className="p-1 rounded-full hover:bg-purple-500">
              <X className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TestNotificationBanner;
