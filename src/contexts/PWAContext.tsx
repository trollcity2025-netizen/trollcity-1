import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode
} from 'react';
import { isStandalone, isIos, isSafari } from '../pwa/install';
import { useInstallPrompt } from '../pwa/useInstallPrompt';

// ===== TYPES =====

interface ServiceWorkerState {
  isRegistered: boolean;
  isUpdateAvailable: boolean;
  isOfflineReady: boolean;
  version: string | null;
  waitingWorker: ServiceWorker | null;
}

interface NetworkState {
  isOnline: boolean;
  isSlowConnection: boolean;
  effectiveType: string | null;
}

interface CacheState {
  cachedStreams: string[];
  cachedProfiles: string[];
  cachedChats: string[];
}

interface PWAContextType {
  // Install state
  canInstall: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isSafari: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | null>;
  dismissInstallPrompt: () => void;
  showIOSInstallInstructions: boolean;
  dismissIOSInstructions: () => void;
  
  // Service Worker state
  swState: ServiceWorkerState;
  updateApp: () => void;
  checkForUpdates: () => Promise<void>;
  
  // Network state
  networkState: NetworkState;
  
  // Cache state
  cacheState: CacheState;
  
  // Background sync
  syncWhenOnline: (queueName: string, data: unknown) => void;
  pendingSyncItems: Record<string, number>;
  
  // Push notifications
  pushPermission: NotificationPermission;
  requestPushPermission: () => Promise<NotificationPermission>;
  subscribeToPush: () => Promise<void>;
  unsubscribeFromPush: () => Promise<void>;
  
  // Offline/Online events
  wasOffline: boolean;
  offlineTimestamp: number | null;
  
  // Utility
  clearAllCaches: () => Promise<void>;
  cacheStream: (streamId: string, data: unknown) => void;
  cacheProfile: (userId: string, data: unknown) => void;
  cacheChat: (roomId: string, messages: unknown[]) => void;
  
  // Stream prefetching
  prefetchStream: (streamId: string) => void;
  prefetchUpcomingStreams: () => void;
  
  // Realtime connection recovery
  connectionHealth: 'healthy' | 'degraded' | 'disconnected';
  lastRealtimeActivity: number;
  triggerReconnect: () => void;
}

// ===== CONTEXT =====

const PWAContext = createContext<PWAContextType | null>(null);

// ===== PROVIDER =====

interface PWAProviderProps {
  children: ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  // Install state
  const {
    deferredPrompt,
    canPromptInstall,
    promptInstall,
    clearPrompt
  } = useInstallPrompt();
  
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSInstallInstructions, setShowIOSInstallInstructions] = useState(false);
  
  // Service Worker state
  const [swState, setSwState] = useState<ServiceWorkerState>({
    isRegistered: false,
    isUpdateAvailable: false,
    isOfflineReady: false,
    version: null,
    waitingWorker: null
  });
  
  // Network state
  const [networkState, setNetworkState] = useState<NetworkState>({
    isOnline: navigator.onLine,
    isSlowConnection: false,
    effectiveType: null
  });
  
  // Cache state
  const [cacheState, setCacheState] = useState<CacheState>({
    cachedStreams: [],
    cachedProfiles: [],
    cachedChats: []
  });
  
  // Background sync state
  const [pendingSyncItems, setPendingSyncItems] = useState<Record<string, number>>({
    'chat-messages': 0,
    'reactions': 0,
    'gifts': 0,
    'follows': 0,
    'profile-updates': 0
  });
  
  // Push notification state
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  
  // Offline tracking
  const [wasOffline, setWasOffline] = useState(false);
  const [offlineTimestamp, setOfflineTimestamp] = useState<number | null>(null);
  
  // Connection health
  const [connectionHealth, setConnectionHealth] = useState<'healthy' | 'degraded' | 'disconnected'>('healthy');
  const [lastRealtimeActivity, setLastRealtimeActivity] = useState(Date.now());
  
  // Refs
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const reconnectAttempts = useRef(0);
  
  // ===== INSTALL DETECTION =====
  
  useEffect(() => {
    // Check if already installed
    setIsInstalled(isStandalone());
    
    // Check for iOS/Safari
    const isIOSSystem = isIos();
    const isSafariBrowser = isSafari();
    
    // Show iOS instructions if appropriate
    if (isIOSSystem && isSafariBrowser && !isStandalone()) {
      const dismissedUntil = localStorage.getItem('ios_install_dismissed_until');
      if (!dismissedUntil || Date.now() > parseInt(dismissedUntil, 10)) {
        setShowIOSInstallInstructions(true);
      }
    }
    
    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches || isStandalone());
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  
  // ===== SERVICE WORKER REGISTRATION =====
  
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/'
        });
        
        swRegistrationRef.current = registration;
        
        console.log('[PWA] Service Worker registered:', registration.scope);
        
        // Check for waiting worker
        if (registration.waiting) {
          setSwState(prev => ({
            ...prev,
            isUpdateAvailable: true,
            waitingWorker: registration.waiting
          }));
        }
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] Service Worker update found');
              setSwState(prev => ({
                ...prev,
                isUpdateAvailable: true,
                waitingWorker: newWorker
              }));
            }
          });
        });
        
        // Listen for messages from SW
        navigator.serviceWorker.addEventListener('message', (event) => {
          const { type, payload } = event.data || {};
          
          switch (type) {
            case 'SW_UPDATED':
              console.log('[PWA] Service Worker updated:', payload);
              setSwState(prev => ({
                ...prev,
                version: payload?.version || null
              }));
              break;
              
            case 'SW_VERSION':
              setSwState(prev => ({
                ...prev,
                isRegistered: true,
                version: payload?.version || null
              }));
              break;
              
            case 'OFFLINE_READY':
              setSwState(prev => ({
                ...prev,
                isOfflineReady: true
              }));
              break;
              
            case 'SYNC_COMPLETE':
              setPendingSyncItems(prev => ({
                ...prev,
                [payload.queueName]: 0
              }));
              break;
              
            case 'PUSH_RECEIVED':
              // Handle push notification in app context
              window.dispatchEvent(new CustomEvent('pwa-push-received', { detail: payload }));
              break;
              
            case 'NOTIFICATION_ACTION':
              window.dispatchEvent(new CustomEvent('pwa-notification-action', { detail: payload }));
              break;
          }
        });
        
        // Get SW version
        if (registration.active) {
          registration.active.postMessage({ type: 'GET_SW_VERSION' });
        }
        
      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error);
      }
    };
    
    registerSW();
    
    // Check for updates every hour
    const interval = setInterval(() => {
      swRegistrationRef.current?.update();
    }, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // ===== NETWORK STATE MONITORING =====
  
  useEffect(() => {
    const updateNetworkState = () => {
      const isOnline = navigator.onLine;
      
      // Track offline/online transitions
      if (!isOnline && networkState.isOnline) {
        setWasOffline(true);
        setOfflineTimestamp(Date.now());
        setConnectionHealth('disconnected');
      } else if (isOnline && !networkState.isOnline) {
        setConnectionHealth('healthy');
        reconnectAttempts.current = 0;
        
        // Trigger background sync for all pending queues
        if ('sync' in (swRegistrationRef.current || {})) {
          const syncManager = (swRegistrationRef.current as any)?.sync;
          if (syncManager) {
            for (const queueName of ['chat-messages', 'reactions', 'gifts', 'follows', 'profile-updates']) {
              syncManager.register(queueName).catch(() => {});
            }
          }
        }
      }
      
      // Check connection quality
       
      const conn = (navigator as any).connection;
      if (conn) {
        setNetworkState({
          isOnline,
          isSlowConnection: conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g',
          effectiveType: conn.effectiveType || null
        });
      } else {
        setNetworkState(prev => ({
          ...prev,
          isOnline
        }));
      }
    };
    
    window.addEventListener('online', updateNetworkState);
    window.addEventListener('offline', updateNetworkState);
    
    // Listen for connection changes
     
    const conn = (navigator as any).connection;
    if (conn) {
      conn.addEventListener('change', updateNetworkState);
    }
    
    updateNetworkState();
    
    return () => {
      window.removeEventListener('online', updateNetworkState);
      window.removeEventListener('offline', updateNetworkState);
      if (conn) {
        conn.removeEventListener('change', updateNetworkState);
      }
    };
  }, [networkState.isOnline]);
  
  // ===== REALTIME CONNECTION HEALTH =====
  
  useEffect(() => {
    const checkConnectionHealth = () => {
      const now = Date.now();
      const inactiveTime = now - lastRealtimeActivity;
      
      if (inactiveTime > 30000 && networkState.isOnline) {
        setConnectionHealth('degraded');
      }
      
      if (inactiveTime > 60000 && networkState.isOnline) {
        setConnectionHealth('disconnected');
      }
    };
    
    const interval = setInterval(checkConnectionHealth, 5000);
    return () => clearInterval(interval);
  }, [lastRealtimeActivity, networkState.isOnline]);
  
  // Listen for realtime activity
  useEffect(() => {
    const handleRealtimeActivity = () => {
      setLastRealtimeActivity(Date.now());
      if (connectionHealth !== 'healthy') {
        setConnectionHealth('healthy');
      }
    };
    
    window.addEventListener('supabase-realtime-activity', handleRealtimeActivity);
    return () => window.removeEventListener('supabase-realtime-activity', handleRealtimeActivity);
  }, [connectionHealth]);
  
  // ===== ACTIONS =====
  
  const updateApp = useCallback(() => {
    if (swState.waitingWorker) {
      swState.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      
      // Reload after a short delay to allow SW to activate
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }, [swState.waitingWorker]);
  
  const checkForUpdates = useCallback(async () => {
    if (!swRegistrationRef.current) return;
    
    try {
      await swRegistrationRef.current.update();
    } catch (error) {
      console.error('[PWA] Update check failed:', error);
    }
  }, []);
  
  const dismissIOSInstructions = useCallback(() => {
    const dismissUntil = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
    localStorage.setItem('ios_install_dismissed_until', dismissUntil.toString());
    setShowIOSInstallInstructions(false);
  }, []);
  
  const syncWhenOnline = useCallback((queueName: string, data: unknown) => {
    if (!swRegistrationRef.current?.active) return;
    
    swRegistrationRef.current.active.postMessage({
      type: 'SYNC_WHEN_ONLINE',
      payload: { queueName, data }
    });
    
    setPendingSyncItems(prev => ({
      ...prev,
      [queueName]: (prev[queueName] || 0) + 1
    }));
    
    // Register for background sync
    if ('sync' in swRegistrationRef.current) {
       
      (swRegistrationRef.current as any).sync.register(queueName).catch(() => {
        // Sync registration failed, will retry when online
      });
    }
  }, []);
  
  const requestPushPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      return 'denied';
    }
    
    const permission = await Notification.requestPermission();
    setPushPermission(permission);
    return permission;
  }, []);
  
  const subscribeToPush = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[PWA] Push notifications not supported');
      return;
    }
    
    try {
      const permission = await requestPushPermission();
      if (permission !== 'granted') return;
      
      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      
      if (!vapidPublicKey) {
        console.warn('[PWA] VAPID public key not configured');
        return;
      }
      
      // Convert VAPID key
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
      
      // Send subscription to server
      // This would typically be done via your API
      console.log('[PWA] Push subscription:', subscription);
      
    } catch (error) {
      console.error('[PWA] Push subscription failed:', error);
    }
  }, [requestPushPermission]);
  
  const unsubscribeFromPush = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        console.log('[PWA] Push subscription cancelled');
      }
    } catch (error) {
      console.error('[PWA] Push unsubscription failed:', error);
    }
  }, []);
  
  const clearAllCaches = useCallback(async () => {
    if (swRegistrationRef.current?.active) {
      swRegistrationRef.current.active.postMessage({ type: 'CLEAR_CACHES' });
    }
    
    setCacheState({
      cachedStreams: [],
      cachedProfiles: [],
      cachedChats: []
    });
  }, []);
  
  const cacheStream = useCallback((streamId: string, data: unknown) => {
    if (!swRegistrationRef.current?.active) return;
    
    swRegistrationRef.current.active.postMessage({
      type: 'CACHE_STREAM_DATA',
      payload: { streamId, data }
    });
    
    setCacheState(prev => ({
      ...prev,
      cachedStreams: [...prev.cachedStreams, streamId]
    }));
  }, []);
  
  const cacheProfile = useCallback((userId: string, data: unknown) => {
    if (!swRegistrationRef.current?.active) return;
    
    swRegistrationRef.current.active.postMessage({
      type: 'CACHE_USER_PROFILE',
      payload: { userId, data }
    });
    
    setCacheState(prev => ({
      ...prev,
      cachedProfiles: [...prev.cachedProfiles, userId]
    }));
  }, []);
  
  const cacheChat = useCallback((roomId: string, messages: unknown[]) => {
    if (!swRegistrationRef.current?.active) return;
    
    swRegistrationRef.current.active.postMessage({
      type: 'CACHE_CHAT_MESSAGES',
      payload: { roomId, messages }
    });
    
    setCacheState(prev => ({
      ...prev,
      cachedChats: [...prev.cachedChats, roomId]
    }));
  }, []);
  
  const prefetchStream = useCallback((streamId: string) => {
    if (!swRegistrationRef.current?.active) return;
    
    swRegistrationRef.current.active.postMessage({
      type: 'PREFETCH_STREAM',
      payload: { streamId }
    });
  }, []);
  
  const prefetchUpcomingStreams = useCallback(() => {
    // This would be called when user is browsing to preload upcoming stream data
    console.log('[PWA] Prefetching upcoming streams...');
  }, []);
  
  const triggerReconnect = useCallback(() => {
    reconnectAttempts.current += 1;
    
    // Dispatch event for realtime connections to reconnect
    window.dispatchEvent(new CustomEvent('pwa-trigger-reconnect', {
      detail: { attempt: reconnectAttempts.current }
    }));
    
    setConnectionHealth('degraded');
  }, []);
  
  // ===== CONTEXT VALUE =====
  
  const value: PWAContextType = {
    canInstall: canPromptInstall,
    isInstalled,
    isIOS: isIos(),
    isSafari: isSafari(),
    promptInstall,
    dismissInstallPrompt: clearPrompt,
    showIOSInstallInstructions,
    dismissIOSInstructions,
    swState,
    updateApp,
    checkForUpdates,
    networkState,
    cacheState,
    syncWhenOnline,
    pendingSyncItems,
    pushPermission,
    requestPushPermission,
    subscribeToPush,
    unsubscribeFromPush,
    wasOffline,
    offlineTimestamp,
    clearAllCaches,
    cacheStream,
    cacheProfile,
    cacheChat,
    prefetchStream,
    prefetchUpcomingStreams,
    connectionHealth,
    lastRealtimeActivity,
    triggerReconnect
  };
  
  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
}

// ===== HOOK =====

export function usePWA(): PWAContextType {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
}

// ===== SELECTOR HOOKS FOR PERFORMANCE =====

export function useInstallState() {
  const { canInstall, isInstalled, promptInstall, dismissInstallPrompt } = usePWA();
  return { canInstall, isInstalled, promptInstall, dismissInstallPrompt };
}

export function useNetworkStatus() {
  const { networkState, wasOffline, offlineTimestamp } = usePWA();
  return { ...networkState, wasOffline, offlineTimestamp };
}

export function useSWStatus() {
  const { swState, updateApp, checkForUpdates } = usePWA();
  return { swState, updateApp, checkForUpdates };
}

export function usePushNotifications() {
  const { pushPermission, requestPushPermission, subscribeToPush, unsubscribeFromPush } = usePWA();
  return { pushPermission, requestPushPermission, subscribeToPush, unsubscribeFromPush };
}

export function usePWACache() {
  const { cacheState, cacheStream, cacheProfile, cacheChat, clearAllCaches } = usePWA();
  return { cacheState, cacheStream, cacheProfile, cacheChat, clearAllCaches };
}

export function useConnectionHealth() {
  const { connectionHealth, lastRealtimeActivity, triggerReconnect } = usePWA();
  return { connectionHealth, lastRealtimeActivity, triggerReconnect };
}

export default PWAContext;
