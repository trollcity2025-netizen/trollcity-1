/**
 * Centralized user utility functions for staff role checking and user management.
 * This ensures consistent staff role logic across the entire application.
 */

import { UserProfile, UserRole } from '@/lib/supabase';

/**
 * Staff roles that have moderation capabilities
 */
export const STAFF_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.SECRETARY,
  UserRole.LEAD_TROLL_OFFICER,
  UserRole.TROLL_OFFICER,
  UserRole.MODERATOR,
  UserRole.OWNER,
  UserRole.HR_ADMIN,
  UserRole.TEMP_CITY_ADMIN,
  UserRole.TEMP_ADMIN,
  UserRole.EXECUTIVE_SECRETARY,
  UserRole.TROLL_CITY_SECRETARY,
  UserRole.TROLL_CITY_TREASURER,
  UserRole.PRESIDENT,
  UserRole.VICE_PRESIDENT,
];

/**
 * Check if a user profile has staff privileges
 * @param profile - The user profile to check
 * @returns true if the user has staff privileges
 */
export function isStaffUser(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;

  // Check explicit role field
  if (profile.role && STAFF_ROLES.includes(profile.role as UserRole)) {
    return true;
  }

  // Check is_admin flag
  if (profile.is_admin === true) {
    return true;
  }

  // Check officer flags
  if (profile.is_troll_officer === true || profile.is_lead_officer === true) {
    return true;
  }

  // Check troll_role unified field
  if (profile.troll_role) {
    const staffTrollRoles = [
      'secretary',
      'lead_officer',
      'owner',
      'admin',
      'moderator',
      'pastor',
      'troll_officer',
    ];
    if (staffTrollRoles.includes(profile.troll_role.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a user can see ghost mode users
 * Only staff users can see users in ghost mode
 */
export function canSeeGhostModeUsers(profile: UserProfile | null | undefined): boolean {
  return isStaffUser(profile);
}

/**
 * Get display name for a user, ensuring we always show real usernames
 * @param userProfile - Optional user profile
 * @param userId - User ID as fallback
 * @returns The display name or a loading indicator suggestion
 */
export function getDisplayUsername(
  userProfile: { username?: string | null } | null | undefined,
  userId: string | undefined
): string {
  if (userProfile?.username) {
    return userProfile.username;
  }
  
  // If we have a userId but no username, return a placeholder that indicates loading
  // The caller should handle showing a loading state
  if (userId) {
    return `User ${userId.slice(0, 6)}`;
  }
  
  return 'Unknown User';
}

/**
 * Check if username is available and valid
 */
export function hasValidUsername(
  userProfile: { username?: string | null } | null | undefined
): boolean {
  return !!(userProfile?.username && userProfile.username.trim().length > 0);
}

/**
 * Cache entry with TTL support
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Generic TTL cache manager for preventing duplicate Supabase queries
 */
export class TTLCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private ttl: number; // milliseconds
  private maxAge: number; // 2x TTL for cleanup threshold

  constructor(ttlSeconds: number = 60) {
    this.ttl = ttlSeconds * 1000;
    this.maxAge = this.ttl * 2;
  }

  /**
   * Get value from cache if not expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      // Entry expired, remove it
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  /**
   * Get value from cache with explicit null check
   */
  getNullable(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set value in cache with current timestamp
   */
  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if key exists and is valid (not expired)
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Clean up expired entries (call periodically to prevent memory leaks)
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get keys that need refresh (expired but still in cache)
   */
  getExpiredKeys(): string[] {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        expired.push(key);
      }
    }

    return expired;
  }
}

/**
 * Debounce utility for limiting rapid function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Create a throttled version of a function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Sort comparator for online users:
 * 1. In broadcast first
 * 2. Staff next
 * 3. Others (by last_seen_at descending)
 */
export function compareOnlineUsers(a: { is_in_broadcast?: boolean; is_staff?: boolean; last_seen_at?: string }, b: { is_in_broadcast?: boolean; is_staff?: boolean; last_seen_at?: string }): number {
  // In broadcast first
  if (a.is_in_broadcast && !b.is_in_broadcast) return -1;
  if (!a.is_in_broadcast && b.is_in_broadcast) return 1;

  // Staff next
  if (a.is_staff && !b.is_staff) return -1;
  if (!a.is_staff && b.is_staff) return 1;

  // Sort by last_seen_at descending (most recently active first)
  const aTime = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
  const bTime = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
  
  return bTime - aTime;
}
