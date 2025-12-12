// Session storage utilities for route persistence

const ROUTE_KEY = 'current_route';

/**
 * Updates the stored route path in session storage
 * @param pathname - The current route pathname
 */
export const updateRoute = (pathname: string): void => {
  try {
    sessionStorage.setItem(ROUTE_KEY, pathname);
  } catch (error) {
    console.warn('Failed to update route in session storage:', error);
  }
};

/**
 * Gets the stored route path from session storage
 * @returns The stored route path or null if not found
 */
export const getStoredRoute = (): string | null => {
  try {
    return sessionStorage.getItem(ROUTE_KEY);
  } catch (error) {
    console.warn('Failed to get route from session storage:', error);
    return null;
  }
};

/**
 * Clears the stored route from session storage
 */
export const clearStoredRoute = (): void => {
  try {
    sessionStorage.removeItem(ROUTE_KEY);
  } catch (error) {
    console.warn('Failed to clear route from session storage:', error);
  }
};