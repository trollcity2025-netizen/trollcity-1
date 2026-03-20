/**
 * Performance optimization utilities for Troll City
 * Use these utilities to improve runtime performance
 */

import { useRef, useCallback, useMemo, useState, useEffect } from 'react';

/**
 * Creates a stable callback that doesn't change between renders
 * unless its dependencies change. Similar to useCallback but with
 * automatic dependency tracking.
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: unknown[] = []
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(callback, deps);
}

/**
 * Memoize an expensive computation
 */
export function useMemoized<T>(
  factory: () => T,
  deps: unknown[]
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}

/**
 * Debounce a callback - useful for search inputs, resize handlers, etc.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;
  
  return debouncedCallback;
}

/**
 * Throttle a callback - useful for scroll handlers, etc.
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  limit: number
): T {
  const lastRunRef = useRef<number>(0);
  
  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastRunRef.current >= limit) {
        lastRunRef.current = now;
        callback(...args);
      }
    },
    [callback, limit]
  ) as T;
  
  return throttledCallback;
}

/**
 * Performance monitoring hook
 * Tracks render counts and slow renders
 */
export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());
  
  useEffect(() => {
    renderCount.current++;
    const renderTime = performance.now();
    const timeSinceLastRender = renderTime - lastRenderTime.current;
    
    const isDev = (import.meta as unknown as { env: { DEV?: boolean } }).env?.DEV;
    if (isDev && timeSinceLastRender > 16) {
      console.debug(`[Performance] ${componentName} render #${renderCount.current} took ${timeSinceLastRender.toFixed(2)}ms`);
    }
    
    lastRenderTime.current = renderTime;
  });
  
  return { renderCount: renderCount.current };
}

/**
 * Create a shallow equality check for useMemo/useCallback
 */
export function shallowEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;
  
  if (
    typeof obj1 !== 'object' ||
    obj1 === null ||
    typeof obj2 !== 'object' ||
    obj2 === null
  ) {
    return false;
  }
  
  const keys1 = Object.keys(obj1 as object);
  const keys2 = Object.keys(obj2 as object);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if ((obj1 as Record<string, unknown>)[key] !== (obj2 as Record<string, unknown>)[key]) return false;
  }
  
  return true;
}

/**
 * Batch multiple state updates into one render
 * Useful for high-frequency updates (e.g., real-time data)
 */
export function useBatchedState<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const batchRef = useRef<(() => void)[]>([]);
  const scheduledRef = useRef(false);
  
  type SetStateAction<T> = (prev: T) => T;
  
  const batchedSetState = useCallback((updater: SetStateAction<T>) => {
    batchRef.current.push(() => {
      setState(updater);
    });
    
    if (!scheduledRef.current) {
      scheduledRef.current = true;
      queueMicrotask(() => {
        const updates = batchRef.current;
        batchRef.current = [];
        scheduledRef.current = false;
        
        // Apply all updates in sequence
        updates.forEach((update) => update());
      });
    }
  }, []);
  
  return [state, batchedSetState] as const;
}

function queueMicrotask(callback: () => void) {
  if (typeof window !== 'undefined' && 'queueMicrotask' in window) {
    (window as unknown as { queueMicrotask: (cb: () => void) => void }).queueMicrotask(callback);
  } else {
    setTimeout(callback, 0);
  }
}
