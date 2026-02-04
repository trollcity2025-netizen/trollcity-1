/**
 * Cross-Platform Purchase Sync
 * 
 * Ensures that car and property purchases are properly synced across:
 * - Web
 * - Mobile PWA
 * - Multiple browser tabs/windows
 * 
 * Handles:
 * - LocalStorage cache invalidation
 * - Profile data updates
 * - Real-time Supabase subscriptions
 * - State management consistency
 */

import { supabase } from './supabase';
import { useAuthStore } from './store';

/**
 * After a car purchase, syncs data across all platforms
 */
export async function syncCarPurchase(userId: string) {
  try {
    // 1. Clear old LocalStorage caches immediately
    localStorage.removeItem(`trollcity_car_${userId}`);
    localStorage.removeItem(`trollcity_owned_vehicles_${userId}`);
    localStorage.removeItem(`trollcity_car_insurance_${userId}`);

    // 2. Fetch fresh vehicles from new TMV system
    const { data: userVehicles, error } = await supabase
      .from('user_vehicles')
      .select('id, catalog_id, purchased_at')
      .eq('user_id', userId)
      .order('purchased_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch user vehicles after purchase:', error);
      throw error;
    }

    // 3. Update profile with latest vehicle data
    // We set the most recently purchased vehicle as active
    const latestVehicle = userVehicles?.[0];

    const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          // Set active vehicle to the latest purchase (UUID)
          active_vehicle: latestVehicle?.id
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to update profile with vehicle data:', updateError);
      }

    // 4. Refresh the auth store profile to ensure state is current
    const authStore = useAuthStore.getState();
    await authStore.refreshProfile();

    // 5. Broadcast to other tabs/windows using BroadcastChannel API
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('trollcity_purchases');
        channel.postMessage({
          type: 'CAR_PURCHASED',
          userId,
          timestamp: Date.now()
        });
        // Give it a moment to send before closing, though postMessage is sync-ish in event loop
        setTimeout(() => channel.close(), 100);
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }
  } catch (err) {
    console.error('Sync failed:', err);
  }
}


/**
 * After a property purchase, syncs data across all platforms
 */
export async function syncPropertyPurchase(userId: string) {
  try {
    // 1. Broadcast to other tabs/windows
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('trollcity_purchases');
        channel.postMessage({
          type: 'property_purchased',
          userId,
          timestamp: Date.now()
        });
        setTimeout(() => channel.close(), 100);
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }
  } catch (err) {
    console.error('Property sync failed:', err);
  }
}

/**
 * Subscribes to changes in the properties table for a user
 */
export function subscribeToProperties(userId: string, callback: (rows: any[]) => void) {
  const channel = supabase
    .channel(`properties_sync:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'properties',
        filter: `owner_user_id=eq.${userId}`
      },
      async () => {
        // Fetch fresh data when changes occur
        const { data } = await supabase
          .from('properties')
          .select('*')
          .eq('owner_user_id', userId)
          .order('created_at', { ascending: true });
        
        if (data) {
          callback(data);
        }
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    }
  };
}

/**
 * Listens for purchase broadcasts from other tabs
 */
export function listenForPurchaseBroadcasts(callback: (data: any) => void) {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return () => {};
  }

  const channel = new BroadcastChannel('trollcity_purchases');
  
  const handler = (event: MessageEvent) => {
    callback(event.data);
  };

  channel.addEventListener('message', handler);

  return () => {
    channel.removeEventListener('message', handler);
    channel.close();
  };
}
