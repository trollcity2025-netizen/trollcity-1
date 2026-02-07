import { lazy, ComponentType } from 'react';

/**
 * A wrapper around React.lazy that automatically reloads the page
 * if a dynamic import fails (e.g., due to deployment updates/chunk version mismatches).
 */
export const lazyWithRetry = <T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) => {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error: any) {
      console.error('Lazy load error:', error);
      
      const isChunkError = 
        error.message?.includes('Failed to fetch dynamically imported module') ||
        error.message?.includes('Importing a module script failed') ||
        error.message?.includes('missing') ||
        error.name === 'ChunkLoadError';

      if (isChunkError) {
        // Prevent infinite reload loops by checking session storage
        // We scope it to the current time window to allow retries on subsequent visits
        const storageKey = `retry-lazy-${window.location.pathname}`;
        const lastRetry = sessionStorage.getItem(storageKey);
        const now = Date.now();
        
        // If we haven't retried in the last 10 seconds, try reloading
        if (!lastRetry || (now - parseInt(lastRetry)) > 10000) {
            sessionStorage.setItem(storageKey, now.toString());
            console.log('Reloading due to chunk load error...');
            window.location.reload();
            // Return a promise that never resolves while reloading to suspend React
            return new Promise(() => {}); 
        }
      }
      
      // If not a chunk error or we already retried, re-throw
      throw error;
    }
  });
};
