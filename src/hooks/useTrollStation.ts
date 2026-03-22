import { useEffect, useCallback } from 'react';
import { useTrollStationStore } from '@/stores/useTrollStationStore';
import { supabase } from '@/lib/supabase';

export function useTrollStation() {
  const store = useTrollStationStore();

  useEffect(() => {
    store.fetchStation();
    store.fetchQueue();
    store.fetchCurrentSession();
  }, []);

  const initWithUser = useCallback((userId: string) => {
    store.checkPermissions(userId);
  }, []);

  return {
    ...store,
    initWithUser,
  };
}

export function useTrollStationRealtime() {
  const { station, currentSession, fetchStation, fetchCurrentSession } = useTrollStationStore();

  useEffect(() => {
    const stationChannel = supabase
      .channel('troll-station')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'troll_station',
        },
        () => {
          fetchStation();
        }
      )
      .subscribe();

    const sessionChannel = supabase
      .channel('troll-station-session')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'troll_station_sessions',
          filter: 'status=eq.live',
        },
        () => {
          fetchCurrentSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(stationChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, []);

  return { station, currentSession };
}
