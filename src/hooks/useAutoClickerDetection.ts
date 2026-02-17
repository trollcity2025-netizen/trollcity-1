
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const CLICK_THRESHOLD = 20; // clicks
const TIME_WINDOW = 1000; // ms

export const useAutoClickerDetection = (userId: string | undefined) => {
  const clickTimestamps = useRef<number[]>([]);

  useEffect(() => {
    const handleClickListener = () => {
      if (!userId) return;

      const now = Date.now();
      clickTimestamps.current.push(now);

      // Remove clicks that are older than the time window
      clickTimestamps.current = clickTimestamps.current.filter(
        (timestamp) => now - timestamp < TIME_WINDOW
      );

      // If the number of clicks exceeds the threshold, report it
      if (clickTimestamps.current.length > CLICK_THRESHOLD) {
        console.warn('Potential auto-clicker detected for user:', userId);
        supabase.functions.invoke('report-auto-clicker', {
          body: { user_id: userId, click_count: clickTimestamps.current.length },
        });
        // Clear the timestamps to avoid repeated reports for the same burst
        clickTimestamps.current = [];
      }
    };

    window.addEventListener('click', handleClickListener);

    return () => {
      window.removeEventListener('click', handleClickListener);
    };
  }, [userId]);
};
