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

    // 2. Force fetch fresh vehicles from database
    const { data: userCars, error: carError } = await supabase
      .from('user_cars')
      .select('*')
      .eq('user_id', userId)
      .order('purchased_at', { ascending: false });

    // Fallback: some environments use user_vehicles instead of user_cars
    let sourceRows: any[] = Array.isArray(userCars) ? userCars : [];
    if ((carError || !sourceRows.length)) {
      const { data: userVehicles } = await supabase
        .from('user_vehicles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (Array.isArray(userVehicles) && userVehicles.length) {
        sourceRows = userVehicles.map((row: any) => ({
          id: row.id,
          car_id: row.vehicle_id,
          is_active: !!row.is_equipped,
          purchased_at: row.created_at,
          customization_json: row.customization_json || null
        }));
      }
    }

    if (carError) {
      console.error('Failed to fetch user cars after purchase:', carError);
      throw carError;
    }

    // 3. Update profile with latest owned vehicle data
    const resolveModelId = (row: any) => {
      const direct = Number(row?.car_id);
      if (Number.isFinite(direct)) return direct;
      const fromCustomize = row?.customization_json?.car_model_id;
      const asNum = Number(fromCustomize);
      return Number.isFinite(asNum) ? asNum : null;
    };
    const ownedIds = (sourceRows || [])
      .map((row: any) => resolveModelId(row))
      .filter((id: any) => Number.isFinite(id)) as number[];
    const activeRow = (sourceRows || []).find((row: any) => row.is_active) || (sourceRows || [])[0];
    const activeVehicleUuid = activeRow ? activeRow.id : null;
    const activeVehicleModelId = activeRow ? resolveModelId(activeRow) : null;

    // 4. Update user_profiles to keep owned_vehicle_ids in sync
    if (ownedIds.length > 0) {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          owned_vehicle_ids: ownedIds,
          // Store UUID of the active user_cars row to match DB type
          active_vehicle: activeVehicleUuid
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to update profile with vehicle data:', updateError);
        // Don't throw - this is not critical
      }
    }

    // 5. Refresh the auth store profile to ensure state is current
    const authStore = useAuthStore.getState();
    await authStore.refreshProfile();

    // 6. Broadcast to other tabs/windows using BroadcastChannel API
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('trollcity_purchases');
        channel.postMessage({
          type: 'car_purchased',
          userId,
          timestamp: Date.now(),
          ownedIds,
          activeVehicleId: activeVehicleModelId
        });
        channel.close();
      } catch (e) {
        // BroadcastChannel not supported in all contexts (e.g., private browsing)
        console.debug('BroadcastChannel not available:', e);
      }
    }

    return { success: true, ownedIds, activeVehicleId: activeVehicleModelId };
  } catch (error) {
    console.error('Purchase sync failed:', error);
    throw error;
  }
}

/**
 * After a property purchase, syncs data across all platforms
 */
export async function syncPropertyPurchase(userId: string) {
  try {
    // 1. Clear old LocalStorage caches
    localStorage.removeItem(`trollcity_owned_properties_${userId}`);
    localStorage.removeItem(`trollcity_active_property_${userId}`);
    localStorage.removeItem(`trollcity_property_insurance_${userId}`);

    // 2. Force fetch fresh properties from database
    const { data: properties, error: propError } = await supabase
      .from('properties')
      .select('*')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false });

    if (propError) {
      console.error('Failed to fetch properties after purchase:', propError);
      throw propError;
    }

    // 3. Get active property
    const activeProperty = (properties || []).find((p: any) => p.is_active_home) || (properties || [])[0];
    const activePropertyId = activeProperty?.id || null;

    // 4. Update user_profiles to keep owned properties in sync
    if ((properties || []).length > 0) {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          owned_property_ids: (properties || []).map((p: any) => p.id),
          active_home: activePropertyId
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to update profile with property data:', updateError);
      }
    }

    // 5. Refresh auth store profile
    const authStore = useAuthStore.getState();
    await authStore.refreshProfile();

    // 6. Broadcast to other tabs/windows
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('trollcity_purchases');
        channel.postMessage({
          type: 'property_purchased',
          userId,
          timestamp: Date.now(),
          activePropertyId
        });
        channel.close();
      } catch (e) {
        console.debug('BroadcastChannel not available:', e);
      }
    }

    return { success: true, activePropertyId };
  } catch (error) {
    console.error('Property purchase sync failed:', error);
    throw error;
  }
}

/**
 * Listen for purchase events from other tabs/windows
 * Use in useEffect to keep the current tab synced with purchases in other tabs
 */
export function listenForPurchaseBroadcasts(onPurchase: (data: any) => void) {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return () => {}; // No-op if not available
  }

  try {
    const channel = new BroadcastChannel('trollcity_purchases');
    const handleMessage = (event: MessageEvent) => {
      onPurchase(event.data);
    };
    channel.addEventListener('message', handleMessage);

    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  } catch (e) {
    console.debug('BroadcastChannel setup failed:', e);
    return () => {};
  }
}

/**
 * Set up real-time subscription to user_cars table
 * Use in components that display owned vehicles
 */
export function subscribeToUserCars(userId: string, onUpdate: (cars: any[]) => void) {
  const channel = supabase
    .channel(`user_cars:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_cars',
        filter: `user_id=eq.${userId}`
      },
      (payload: any) => {
        console.log('user_cars change detected:', payload);
        // Re-fetch all user cars after any change
        supabase
          .from('user_cars')
          .select('*')
          .eq('user_id', userId)
          .order('purchased_at', { ascending: false })
          .then(({ data }) => {
            if (data) {
              onUpdate(data);
            }
          });
      }
    )
    .subscribe();

  return channel;
}

/**
 * Set up real-time subscription to properties table
 */
export function subscribeToProperties(userId: string, onUpdate: (properties: any[]) => void) {
  const channel = supabase
    .channel(`properties:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'properties',
        filter: `owner_user_id=eq.${userId}`
      },
      (payload: any) => {
        console.log('properties change detected:', payload);
        // Re-fetch all properties after any change
        supabase
          .from('properties')
          .select('*')
          .eq('owner_user_id', userId)
          .order('created_at', { ascending: false })
          .then(({ data }) => {
            if (data) {
              onUpdate(data);
            }
          });
      }
    )
    .subscribe();

  return channel;
}
