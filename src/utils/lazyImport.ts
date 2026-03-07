import { lazy, ComponentType } from 'react';

/**
 * A wrapper around React.lazy that automatically reloads the page
 * if a dynamic import fails (e.g., due to deployment updates/chunk version mismatches).
 * 
 * IMPORTANT: Only reload once to prevent infinite reload loops.
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
        error.name === 'ChunkLoadError';

      if (isChunkError) {
        const env = (import.meta as any).env
        // Only reload in production and only if not already reloaded
        if (typeof window !== 'undefined' && env?.PROD) {
          // Prevent reload storms: only reload once per tab/session for chunk mismatch.
          // Use a timestamp-based key to allow reload after some time has passed
          const storageKey = 'lazy-chunk-reload-ts'
          const lastReload = sessionStorage.getItem(storageKey)
          const now = Date.now()
          
          // Only reload if we haven't reloaded in the last 30 seconds
          if (!lastReload || (now - parseInt(lastReload)) > 30000) {
            sessionStorage.setItem(storageKey, now.toString())
            console.log('Reloading due to chunk load error...')
            window.location.reload()
            // Return a promise that never resolves while reloading to suspend React
            return new Promise(() => {})
          } else {
            console.warn('Chunk load error but recently reloaded, not reloading again to prevent loop')
          }
        }
      }
      
      // If not a chunk error or we already retried recently, re-throw
      throw error;
    }
  });
};
