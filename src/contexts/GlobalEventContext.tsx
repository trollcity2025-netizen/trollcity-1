/**
 * Global Event Provider
 * 
 * Centralized event controller that:
 * - Determines active events based on server time
 * - Exposes active event, config, and feature flags
 * - Auto-updates without component polling
 * - Pauses on background tabs for performance
 * 
 * Must be placed at app root level.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from 'react';
// import { useAuthStore } from '../lib/store';
// import { supabase } from '../lib/supabase';
import { GlobalEvents, getServerTime, isEventActive, getPrimaryActiveEvent, getActiveEvents, calculateFeatureFlags } from '../lib/events/eventRegistry';
import type { GlobalEventConfig, EventFeatureFlags, AdminEventOverride } from '../lib/events/types';

// ============================================================================
// Context Types
// ============================================================================

interface GlobalEventContextType {
  /** Currently active event or null */
  activeEvent: GlobalEventConfig | null;
  /** All currently active events */
  activeEvents: GlobalEventConfig[];
  /** Feature flags based on active events */
  featureFlags: EventFeatureFlags;
  /** Server time */
  serverTime: Date;
  /** Check if a specific event is active */
  isEventActive: (eventId: string) => boolean;
  /** Get event by ID */
  getEvent: (eventId: string) => GlobalEventConfig | undefined;
  /** Admin controls */
  adminOverride: AdminEventOverride | null;
  setAdminOverride: (override: AdminEventOverride | null) => void;
  /** Force refresh event state */
  refreshEvents: () => void;
}

const GlobalEventContext = createContext<GlobalEventContextType | undefined>(undefined);



// ============================================================================
// Provider Component
// ============================================================================

interface GlobalEventProviderProps {
  children: ReactNode;
}

export const GlobalEventProvider: React.FC<GlobalEventProviderProps> = ({ children }) => {
  const [activeEvent, setActiveEvent] = useState<GlobalEventConfig | null>(null);
  const [activeEvents, setActiveEvents] = useState<GlobalEventConfig[]>([]);
  const [serverTime, setServerTime] = useState<Date>(new Date());
  const [adminOverride, setAdminOverrideState] = useState<AdminEventOverride | null>(null);
  
  const updateTimerRef = useRef<number | null>(null);
  const _lastUpdateRef = useRef<number>(0);

  // Calculate feature flags
  const featureFlags = useMemo(() => 
    calculateFeatureFlags(activeEvent, activeEvents), 
    [activeEvent, activeEvents]
  );

  // Check for admin override expiration
  const checkAdminExpiration = useCallback(() => {
    if (adminOverride?.expiresAt && Date.now() > adminOverride.expiresAt) {
      setAdminOverrideState(null);
    }
  }, [adminOverride]);

  // Main event update function
  const updateEvents = useCallback(() => {
    // Check admin override expiration
    checkAdminExpiration();
    
    // Get server time
    const time = getServerTime();
    setServerTime(time);
    
    // Apply admin overrides if active
    if (adminOverride?.forcedEventId) {
      const forcedEvent = GlobalEvents[adminOverride.forcedEventId as keyof typeof GlobalEvents];
      if (forcedEvent && !adminOverride.forcedDisabledIds.includes(forcedEvent.id)) {
        setActiveEvent(forcedEvent);
        setActiveEvents([forcedEvent]);
        return;
      }
    }
    
    if (adminOverride?.previewMode) {
      setActiveEvent(null);
      setActiveEvents([]);
      return;
    }
    
    // Normal event checking
    const primary = getPrimaryActiveEvent();
    const allActive = getActiveEvents();
    
    // Only trigger re-renders if state actually changed
    setActiveEvent(prev => {
      if (prev?.id === primary?.id) return prev;
      return primary;
    });
    
    setActiveEvents(prev => {
      if (prev.length === allActive.length && prev.every(e => allActive.find(a => a.id === e.id))) {
        return prev;
      }
      return allActive;
    });
  }, [adminOverride, checkAdminExpiration]);

  // Initialize and set up update loop
  useEffect(() => {
    // Initial update
    updateEvents();
    
    // Calculate optimal update interval based on nearest event end time
    const getOptimalInterval = (): number => {
      const allEvents = Object.values(GlobalEvents);
      const now = getServerTime();
      
      // Find nearest event boundary
      let nearestBoundary = Infinity;
      
      for (const event of allEvents) {
        const start = new Date(event.startTimestamp).getTime();
        const end = new Date(event.endTimestamp).getTime();
        
        // Check if start is in future
        if (start > now.getTime()) {
          nearestBoundary = Math.min(nearestBoundary, start - now.getTime());
        }
        
        // Check if end is in future
        if (end > now.getTime()) {
          nearestBoundary = Math.min(nearestBoundary, end - now.getTime());
        }
      }
      
      // If there's an upcoming boundary within 1 minute, use 1-second intervals
      if (nearestBoundary < 60000) {
        return 1000; // 1 second
      }
      
      // Otherwise use 30-second intervals (ample for event timing)
      return 30000;
    };
    
    // Set up update loop
    const scheduleUpdate = () => {
      const interval = getOptimalInterval();
      updateTimerRef.current = window.setTimeout(() => {
        updateEvents();
        scheduleUpdate();
      }, interval);
    };
    
    scheduleUpdate();
    
    // Clean up on unmount
    return () => {
      if (updateTimerRef.current !== null) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, [updateEvents]);

  // Pause updates when tab is backgrounded (performance)
  useEffect(() => {
    // Calculate optimal update interval
    const getOptimalInterval = (): number => {
      const allEvents = Object.values(GlobalEvents);
      const now = getServerTime();
      
      // Find nearest event boundary
      let nearestBoundary = Infinity;
      
      for (const event of allEvents) {
        const start = new Date(event.startTimestamp).getTime();
        const end = new Date(event.endTimestamp).getTime();
        
        // Check if start is in future
        if (start > now.getTime()) {
          nearestBoundary = Math.min(nearestBoundary, start - now.getTime());
        }
        
        // Check if end is in future
        if (end > now.getTime()) {
          nearestBoundary = Math.min(nearestBoundary, end - now.getTime());
        }
      }
      
      // If there's an upcoming boundary within 1 minute, use 1-second intervals
      if (nearestBoundary < 60000) {
        return 1000; // 1 second
      }
      
      // Otherwise use 30-second intervals (ample for event timing)
      return 30000;
    };
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden, clear timer
        if (updateTimerRef.current !== null) {
          clearTimeout(updateTimerRef.current);
          updateTimerRef.current = null;
        }
      } else {
        // Tab is visible, update immediately and restart
        updateEvents();
        
        const scheduleUpdate = () => {
          const interval = getOptimalInterval();
          updateTimerRef.current = window.setTimeout(() => {
            updateEvents();
            scheduleUpdate();
          }, interval);
        };
        
        scheduleUpdate();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (updateTimerRef.current !== null) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, [updateEvents]);

  // Utility functions
  const isEventActiveFn = useCallback((eventId: string): boolean => {
    const event = GlobalEvents[eventId as keyof typeof GlobalEvents];
    if (!event) return false;
    
    // Check admin disabled list
    if (adminOverride?.forcedDisabledIds.includes(eventId)) {
      return false;
    }
    
    // Check forced event
    if (adminOverride?.forcedEventId === eventId) {
      return true;
    }
    
    return isEventActive(event);
  }, [adminOverride]);

  const getEventFn = useCallback((eventId: string): GlobalEventConfig | undefined => {
    return GlobalEvents[eventId as keyof typeof GlobalEvents];
  }, []);

  const setAdminOverrideFn = useCallback((override: AdminEventOverride | null) => {
    setAdminOverrideState(override);
  }, []);

  const refreshEventsFn = useCallback(() => {
    updateEvents();
  }, [updateEvents]);

  // Context value
  const value: GlobalEventContextType = {
    activeEvent,
    activeEvents,
    featureFlags,
    serverTime,
    isEventActive: isEventActiveFn,
    getEvent: getEventFn,
    adminOverride,
    setAdminOverride: setAdminOverrideFn,
    refreshEvents: refreshEventsFn,
  };

  return (
    <GlobalEventContext.Provider value={value}>
      {children}
    </GlobalEventContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access global event state
 * 
 * @example
 * const { activeEvent, featureFlags } = useGlobalEvent();
 * 
 * if (featureFlags.hasEventTheme) {
 *   // Apply event theme classes
 * }
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useGlobalEvent = (): GlobalEventContextType => {
  const context = useContext(GlobalEventContext);
  if (context === undefined) {
    throw new Error('useGlobalEvent must be used within a GlobalEventProvider');
  }
  return context;
};

// ============================================================================
// Admin Hook (optional)
// ============================================================================

/**
 * Hook for admin-only event controls
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useEventAdmin = () => {
  const { adminOverride, setAdminOverride } = useGlobalEvent();
  
  const forceEnableEvent = useCallback((eventId: string, durationMinutes: number = 60) => {
    const expiresAt = Date.now() + (durationMinutes * 60 * 1000);
    setAdminOverride({
      forcedEventId: eventId,
      forcedDisabledIds: [],
      previewMode: false,
      expiresAt,
    });
  }, [setAdminOverride]);
  
  const forceDisableEvent = useCallback((eventId: string) => {
    setAdminOverride({
      forcedEventId: null,
      forcedDisabledIds: [...(adminOverride?.forcedDisabledIds || []), eventId],
      previewMode: false,
      expiresAt: adminOverride?.expiresAt || null,
    });
  }, [setAdminOverride, adminOverride]);
  
  const enablePreviewMode = useCallback(() => {
    setAdminOverride({
      forcedEventId: null,
      forcedDisabledIds: [],
      previewMode: true,
      expiresAt: null,
    });
  }, [setAdminOverride]);
  
  const clearOverrides = useCallback(() => {
    setAdminOverride(null);
  }, [setAdminOverride]);
  
  return {
    adminOverride,
    forceEnableEvent,
    forceDisableEvent,
    enablePreviewMode,
    clearOverrides,
  };
};
