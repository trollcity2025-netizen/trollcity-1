/**
 * Court System Utilities
 * 
 * Provides helper functions for court-related operations including
 * array normalization for PostgreSQL array parameters.
 */

/**
 * Normalizes a value to an array.
 * This prevents "malformed array literal" errors when calling
 * PostgreSQL functions that expect array parameters.
 * 
 * @param value - The value to normalize (can be a single item, array, or null/undefined)
 * @returns An array with the value(s), or empty array if value is falsy
 * 
 * @example
 * normalizeArray('single') // returns ['single']
 * normalizeArray(['a', 'b']) // returns ['a', 'b']
 * normalizeArray(null) // returns []
 * normalizeArray(undefined) // returns []
 */
export function normalizeArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Normalizes a string value to a text array for PostgreSQL RPC calls.
 * This is specifically designed for court system RPC functions.
 * 
 * @param value - The string or array of strings to normalize
 * @returns An array of strings suitable for PostgreSQL text[] parameter
 * 
 * @example
 * normalizeTextArray('single value') // returns ['single value']
 * normalizeTextArray(['user1', 'user2']) // returns ['user1', 'user2']
 * normalizeTextArray('') // returns []
 */
export function normalizeTextArray(value: string | string[] | null | undefined): string[] {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Normalizes UUID values for PostgreSQL UUID[] parameters.
 * Used for the future migration to UUID[] in court functions.
 * 
 * @param value - The UUID or array of UUIDs to normalize
 * @returns An array of UUIDs suitable for PostgreSQL uuid[] parameter
 * 
 * @example
 * normalizeUuidArray('550e8400-e29b-41d4-a716-446655440000') 
 * // returns ['550e8400-e29b-41d4-a716-446655440000']
 */
export function normalizeUuidArray(value: string | string[] | null | undefined): string[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Type guard to check if a value is a valid non-empty array
 */
export function isValidArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Type guard to check if a value is a valid UUID
 */
export function isValidUuid(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

export default {
  normalizeArray,
  normalizeTextArray,
  normalizeUuidArray,
  isValidArray,
  isValidUuid,
};
