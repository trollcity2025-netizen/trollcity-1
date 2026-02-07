import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { X, Megaphone } from 'lucide-react';

interface Broadcast {
  id: string;
  message: string;
  admin_id: string;
  created_at: string;
}

export default function BroadcastAnnouncement() {
  const { user } = useAuthStore();
  const [broadcastQueue, setBroadcastQueue] = useState<Broadcast[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const fetchBroadcasts = async () => {
      try {
        // Only fetch broadcasts from the last 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const { data, error } = await supabase
          .from('admin_broadcasts')
          .select('*')
          .gte('created_at', yesterday.toISOString())
          .order('created_at', { ascending: false });

        if (error) {
          if (error.code !== '42501') {
            console.error('Error fetching broadcasts:', error);
          }
          return;
        }

        if (!data) return;

        // Filter out dismissed broadcasts
        const dismissedBroadcasts = JSON.parse(localStorage.getItem('dismissedBroadcasts') || '[]');
        let activeBroadcasts = data.filter(b => !dismissedBroadcasts.includes(b.id));

        // Deduplicate messages
        const seenMessages = new Set();
        activeBroadcasts = activeBroadcasts.filter(b => {
          if (seenMessages.has(b.message)) return false;
          seenMessages.add(b.message);
          return true;
        });

        if (activeBroadcasts.length > 0) {
            setBroadcastQueue(activeBroadcasts);
            setIsVisible(true);
        }
      } catch (err) {
        console.error('Error fetching broadcasts:', err);
      }
    };

    fetchBroadcasts();

    // Poll for new broadcasts (every 2 minutes)
    const interval = setInterval(() => {
        if (user) fetchBroadcasts();
    }, 120000);

    return () => {
      clearInterval(interval);
    };
  }, [user]);

  const handleClose = () => {
    setIsVisible(false);
    
    // Wait for animation to finish before removing from queue
    setTimeout(() => {
        if (broadcastQueue.length > 0) {
            const dismissedId = broadcastQueue[0].id;
            
            // Save to local storage
            const dismissed = JSON.parse(localStorage.getItem('dismissedBroadcasts') || '[]');
            if (!dismissed.includes(dismissedId)) {
                dismissed.push(dismissedId);
                localStorage.setItem('dismissedBroadcasts', JSON.stringify(dismissed));
            }

            setBroadcastQueue(prev => prev.slice(1));
            
            // If there are more broadcasts, show the next one after a delay
            if (broadcastQueue.length > 1) {
                setTimeout(() => setIsVisible(true), 500);
            }
        }
    }, 300);
  };

  if (broadcastQueue.length === 0) {
    return null;
  }

  const currentBroadcast = broadcastQueue[0];

  return (
    <div 
        className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4 transition-all duration-500 transform ${
            isVisible ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0 pointer-events-none'
        }`}
    >
        <div className="bg-gradient-to-r from-purple-900/90 to-indigo-900/90 backdrop-blur-md border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.4)] rounded-xl p-4 flex items-start gap-4">
            <div className="bg-purple-500/20 p-2 rounded-full shrink-0">
                <Megaphone className="text-purple-300 w-6 h-6 animate-pulse" />
            </div>
            
            <div className="flex-1">
                <h4 className="text-purple-200 font-bold text-sm uppercase tracking-wider mb-1">
                    System Announcement
                </h4>
                <p className="text-white text-base font-medium leading-relaxed">
                    {currentBroadcast.message}
                </p>
            </div>

            <button 
                onClick={handleClose}
                className="text-purple-300 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
            >
                <X size={20} />
            </button>
        </div>
    </div>
  );
}
