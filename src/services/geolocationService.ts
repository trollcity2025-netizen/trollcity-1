/**
 * Troll City IP Geolocation Service
 * 
 * This service handles IP-based geolocation lookups for admin use only.
 * Location data is restricted to super admins and used only for emergency response.
 */

import type { 
  UserIpLocation, 
  EmergencyUserInfo, 
  GeolocationApiResponse,
  LocationIntelligenceItem 
} from '@/types/safety';
import { supabase } from '@/lib/supabase';

// ============================================================
// CONFIGURATION
// ============================================================

// Free IP geolocation API endpoint
const IPGEOLOCATION_API_URL = 'https://ipapi.co';

// Cache duration in milliseconds (30 minutes)
const GEOLOCATION_CACHE_DURATION = 30 * 60 * 1000;

// ============================================================
// IN-MEMORY CACHE
// ============================================================

interface CachedGeolocation {
  data: GeolocationApiResponse;
  timestamp: number;
}

const geolocationCache: Map<string, CachedGeolocation> = new Map();

// ============================================================
// GEOLOCATION SERVICE CLASS
// ============================================================

export class GeolocationService {
  private static instance: GeolocationService;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): GeolocationService {
    if (!GeolocationService.instance) {
      GeolocationService.instance = new GeolocationService();
    }
    return GeolocationService.instance;
  }

  initialize(): void {
    if (this.isInitialized) return;
    
    console.log('[Geolocation] Service initialized');
    this.isInitialized = true;
  }

  /**
   * Lookup geolocation for an IP address
   * Uses cache if available and not expired
   */
  async lookupIpGeolocation(ipAddress: string): Promise<GeolocationApiResponse | null> {
    try {
      // Check cache first
      const cached = geolocationCache.get(ipAddress);
      if (cached && Date.now() - cached.timestamp < GEOLOCATION_CACHE_DURATION) {
        console.log(`[Geolocation] Cache hit for ${ipAddress}`);
        return cached.data;
      }

      // Make API request
      const response = await fetch(`${IPGEOLOCATION_API_URL}/${ipAddress}/json/`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: GeolocationApiResponse = await response.json();

      // Cache the result
      geolocationCache.set(ipAddress, {
        data,
        timestamp: Date.now()
      });

      console.log(`[Geolocation] Lookup successful for ${ipAddress}`);
      return data;

    } catch (error) {
      console.error(`[Geolocation] Failed to lookup ${ipAddress}:`, error);
      return null;
    }
  }

  /**
   * Store geolocation data for a user (called during login/signup)
   */
  async storeUserGeolocation(
    userId: string,
    ipAddress: string,
    source: 'login' | 'signup' | 'manual_lookup' = 'login'
  ): Promise<boolean> {
    try {
      // Lookup geolocation
      const geoData = await this.lookupIpGeolocation(ipAddress);
      
      if (!geoData) {
        console.warn(`[Geolocation] No geolocation data available for ${ipAddress}`);
        return false;
      }

      // Store in database using the RPC function
      const { error } = await supabase.rpc('store_user_geolocation', {
        p_user_id: userId,
        p_ip_address: ipAddress,
        p_city: geoData.city || null,
        p_state: geoData.region || null,
        p_region: geoData.region || null,
        p_country: geoData.country_name || null,
        p_country_code: geoData.country_code || null,
        p_latitude: geoData.latitude || null,
        p_longitude: geoData.longitude || null,
        p_isp: geoData.isp || geoData.org || null,
        p_organization: geoData.org || null,
        p_timezone: geoData.timezone || null,
        p_source: source
      });

      if (error) {
        console.error('[Geolocation] Failed to store geolocation:', error);
        return false;
      }

      console.log(`[Geolocation] Stored geolocation for user ${userId}`);
      return true;

    } catch (error) {
      console.error('[Geolocation] Error storing geolocation:', error);
      return false;
    }
  }

  /**
   * Get emergency info for a user (admin only)
   */
  async getEmergencyUserInfo(userId: string): Promise<EmergencyUserInfo | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_emergency_user_info', {
          p_user_id: userId
        });

      if (error) {
        console.error('[Geolocation] Failed to get emergency info:', error);
        return null;
      }

      return data as EmergencyUserInfo;

    } catch (error) {
      console.error('[Geolocation] Error getting emergency info:', error);
      return null;
    }
  }

  /**
   * Lookup user location history (admin only)
   */
  async lookupUserLocation(
    userId: string,
    searchType: 'user_id' | 'username' | 'ip_address' = 'user_id'
  ): Promise<UserIpLocation[]> {
    try {
      const { data, error } = await supabase
        .rpc('lookup_user_location', {
          p_user_id: userId,
          p_search_type: searchType
        });

      if (error) {
        console.error('[Geolocation] Failed to lookup user location:', error);
        return [];
      }

      return data as UserIpLocation[];

    } catch (error) {
      console.error('[Geolocation] Error looking up user location:', error);
      return [];
    }
  }

  /**
   * Get all location intelligence data (admin only)
   */
  async getLocationIntelligence(): Promise<LocationIntelligenceItem[]> {
    try {
      const { data, error } = await supabase
        .from('user_location_intelligence_view')
        .select('*')
        .order('last_seen', { ascending: false })
        .limit(1000);

      if (error) {
        console.error('[Geolocation] Failed to get location intelligence:', error);
        return [];
      }

      return data as LocationIntelligenceItem[];

    } catch (error) {
      console.error('[Geolocation] Error getting location intelligence:', error);
      return [];
    }
  }

  /**
   * Search users by location
   */
  async searchByLocation(
    city?: string,
    state?: string,
    country?: string
  ): Promise<LocationIntelligenceItem[]> {
    try {
      let query = supabase
        .from('user_location_intelligence_view')
        .select('*');

      if (city) {
        query = query.ilike('city', `%${city}%`);
      }
      if (state) {
        query = query.ilike('state', `%${state}%`);
      }
      if (country) {
        query = query.ilike('country', `%${country}%`);
      }

      const { data, error } = await query.order('last_seen', { ascending: false });

      if (error) {
        console.error('[Geolocation] Failed to search by location:', error);
        return [];
      }

      return data as LocationIntelligenceItem[];

    } catch (error) {
      console.error('[Geolocation] Error searching by location:', error);
      return [];
    }
  }

  /**
   * Clear geolocation cache
   */
  clearCache(): void {
    geolocationCache.clear();
    console.log('[Geolocation] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: geolocationCache.size,
      entries: Array.from(geolocationCache.keys())
    };
  }
}

// ============================================================
// EXPORT SINGLETON INSTANCE
// ============================================================

export const geolocationService = GeolocationService.getInstance();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Format location for display
 */
export function formatLocation(city?: string, state?: string, country?: string): string {
  const parts = [city, state, country].filter(Boolean);
  return parts.join(', ') || 'Unknown Location';
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(lat?: number, lng?: number): string {
  if (lat === undefined || lng === undefined) return 'N/A';
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/**
 * Check if coordinates are valid
 */
export function isValidCoordinates(lat?: number, lng?: number): boolean {
  if (lat === undefined || lng === undefined) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Truncate IP address for privacy (show only first 2 octets)
 */
export function truncateIpForDisplay(ip: string): string {
  const parts = ip.split('.');
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.*.*`;
}
