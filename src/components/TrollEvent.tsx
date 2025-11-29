import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import api from '../lib/api';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';

interface TrollEvent {
  id: string;
  troll_type: 'red' | 'green';
  reward_amount: number;
  expires_at: string;
  active: boolean;
}

interface TrollEventProps {
  streamId?: string; // Optional - for future per-stream logic
}

const TrollEvent: React.FC<TrollEventProps> = ({ streamId }) => {
  const { profile } = useAuthStore();
  const [globalTroll, setGlobalTroll] = useState<TrollEvent | null>(null);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Subscribe to troll events
  useEffect(() => {
    const channel = supabase
      .channel('troll_broadcast')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'troll_events' },
        (payload) => {
          const event = payload.new as TrollEvent;
          if (new Date() < new Date(event.expires_at) && event.active) {
            setGlobalTroll(event);
            setHasClaimed(false);
            setIsAnimating(true);

            // Auto-hide after animation completes (12 seconds)
            setTimeout(() => {
              setIsAnimating(false);
              setGlobalTroll(null);
            }, 12000);
          }
        }
      )
      .subscribe();

    // Check for active events on mount
    const checkActiveEvents = async () => {
      const { data: activeEvents } = await supabase
        .from('troll_events')
        .select('*')
        .eq('active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (activeEvents && activeEvents.length > 0) {
        const event = activeEvents[0];
        setGlobalTroll(event);
        setIsAnimating(true);

        // Check if user already claimed this event
        if (profile?.id) {
          const { data: claims } = await supabase
            .from('troll_event_claims')
            .select('id')
            .eq('event_id', event.id)
            .eq('user_id', profile.id);

          setHasClaimed(claims && claims.length > 0);
        }

        // Auto-hide after animation completes
        setTimeout(() => {
          setIsAnimating(false);
          setGlobalTroll(null);
        }, 12000);
      }
    };

    checkActiveEvents();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // Handle troll click
  const handleClickTroll = async () => {
    if (!globalTroll || !profile?.id || hasClaimed) return;

    try {
      const result = await api.post('/admin/troll-events/claim', {
        event_id: globalTroll.id,
        user_id: profile.id
      });

      if (result.success) {
        setHasClaimed(true);
        toast.success(`🎉 Claimed ${result.reward_amount} FREE coins!`);

        // Update local profile balance
        const newBalance = (profile.free_coin_balance || 0) + result.reward_amount;
        useAuthStore.getState().setProfile({
          ...profile,
          free_coin_balance: newBalance
        });
      } else {
        toast.error(result.error || 'Failed to claim reward');
      }
    } catch (error) {
      console.error('Troll claim error:', error);
      toast.error('Failed to claim troll reward');
    }
  };

  if (!globalTroll || !isAnimating) return null;

  return (
    <>
      {/* Walking Troll Animation */}
      <div
        className={`fixed bottom-10 left-[-150px] z-[9999] cursor-pointer select-none ${
          hasClaimed ? 'cursor-not-allowed opacity-50' : 'animate-walk hover:scale-110'
        }`}
        onClick={handleClickTroll}
        style={{
          pointerEvents: hasClaimed ? 'none' : 'auto'
        }}
      >
        <div className="relative">
          {/* Troll Character */}
          <div className="text-6xl animate-bounce">
            {globalTroll.troll_type === 'green' ? '💚🧌' : '🔥🧌'}
          </div>

          {/* Reward Bubble */}
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-black px-2 py-1 rounded-full text-sm font-bold shadow-lg animate-pulse">
            +{globalTroll.reward_amount} 🪙
          </div>

          {/* Claimed Indicator */}
          {hasClaimed && (
            <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
              ✅ Claimed!
            </div>
          )}
        </div>
      </div>

      {/* Global Event Notification */}
      <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[9998] pointer-events-none">
        <div className="bg-black/80 text-white px-6 py-3 rounded-xl border-2 border-yellow-400 shadow-2xl animate-fade-in-up">
          <div className="flex items-center gap-3">
            <div className="text-2xl">
              {globalTroll.troll_type === 'green' ? '💚' : '🔥'}
            </div>
            <div>
              <div className="font-bold text-yellow-400">
                Troll Event! {globalTroll.troll_type === 'green' ? 'Friendly' : 'Fiery'} Troll Spotted!
              </div>
              <div className="text-sm text-gray-300">
                Click the walking troll to claim {globalTroll.reward_amount} FREE coins!
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TrollEvent;