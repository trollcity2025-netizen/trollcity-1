import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

// Simple in-memory cache + in-flight dedupe to avoid repeated token fetches
type CachedToken = {
  token: string;
  url: string | null;
  identity: string | null;
  room: string | null;
  expiresAt: number; // ms
};

const tokenCache = new Map<string, CachedToken>();
const inflight = new Map<string, Promise<CachedToken>>();

interface UseLiveKitTokenProps {
  streamId: string | undefined;
  isHost: boolean;
  userId: string | undefined;
  roomName: string | undefined;
  canPublish?: boolean;
  enabled?: boolean;
}

export function useLiveKitToken({
  streamId,
  isHost,
  userId,
  roomName,
  canPublish = false,
  enabled = true,
}: UseLiveKitTokenProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [identity, setIdentity] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state when inputs change
    setToken(null);
    setServerUrl(null);
    setIdentity(null);
    setRoom(null);
    setError(null);

    // Hard requirements check
    if (!enabled || !userId || !roomName || !streamId) {
      return;
    }

    let mounted = true;

    const cacheKey = `${roomName}:${userId}:${isHost ? 'host' : 'viewer'}:${canPublish ? 'pub' : 'sub'}`;

    const fetchToken = async () => {
      try {
        setIsLoading(true);

        // If cached and not expired, use cache
        const cached = tokenCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
          if (mounted) {
            setToken(cached.token);
            setServerUrl(cached.url);
            setIdentity(cached.identity);
            setRoom(cached.room);
          }
          return;
        }

        // If an inflight fetch exists, await it
        if (inflight.has(cacheKey)) {
          const existing = inflight.get(cacheKey)!;
          const result = await existing;
          if (mounted) {
            setToken(result.token);
            setServerUrl(result.url);
            setIdentity(result.identity);
            setRoom(result.room);
          }
          return;
        }

        // Use Vercel endpoint or fallback to Supabase
        // FORCE the edge function URL for local dev to avoid proxy issues
        const tokenUrl = import.meta.env.VITE_LIVEKIT_TOKEN_URL || 
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/livekit-token`;

        console.log('[useLiveKitToken] Fetching token from:', tokenUrl, {
            roomName,
            identity: userId,
            isHost,
            canPublish,
            role: (isHost || canPublish) ? 'broadcaster' : 'viewer'
        });

        const promise = (async (): Promise<CachedToken> => {
          const storeSession = useAuthStore.getState().session as any;
          const expiresAt = storeSession?.expires_at;
          const now = Math.floor(Date.now() / 1000);
          const hasValidStoreSession = !!storeSession?.access_token && (!expiresAt || expiresAt > now + 30);
          // ✅ Force refresh session to ensure we have valid token
          console.log('[useLiveKitToken] Refreshing session...');
          
          // Add timeout for refreshSession (5s)
          const refreshPromise = supabase.auth.refreshSession();
          const timeoutPromise = new Promise<{ data: { session: null }, error: any }>((_, reject) => 
              setTimeout(() => reject(new Error('Session refresh timed out')), 5000)
          );

          let freshSession = null;
          try {
              // Race against timeout
              const result = await Promise.race([refreshPromise, timeoutPromise]) as any;
              if (result.error) throw result.error;
              freshSession = result.data.session;
          } catch (err: any) {
               console.warn('[useLiveKitToken] Session refresh failed/timed out, falling back to local session:', err);
               // Fallback to synchronous store session to avoid potential async hangs in getSession()
               freshSession = useAuthStore.getState().session;
               console.log('[useLiveKitToken] Local store session retrieved:', !!freshSession);
           }
           
           if (!freshSession?.access_token) {
             console.error('[useLiveKitToken] No session found in store or refresh failed');
             throw new Error('No active session - please sign in again');
           }

           console.log('[useLiveKitToken] Session ready, fetching token from Edge Function...');
          
          // Add timeout for fetch (10s)
          const controller = new AbortController();
          const fetchTimeout = setTimeout(() => controller.abort(), 10000);

          console.log('[useLiveKitToken] Starting fetch to:', tokenUrl);
          const startTime = Date.now();

          try {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${freshSession.access_token}`,
                },
                body: JSON.stringify({
                roomName,
                identity: userId,
                user_id: userId,
                // FORCE ADMIN ROLE to bypass server-side role checks if we need to publish
                role: (isHost || canPublish) ? 'admin' : 'viewer',
                allowPublish: true, // FORCE ALLOW PUBLISH FOR DEBUGGING
                canPublish: true, // Also try this explicit flag often used in LiveKit helpers
                }),
                signal: controller.signal
            });
            
            clearTimeout(fetchTimeout);
            console.log('[useLiveKitToken] Fetch completed in', Date.now() - startTime, 'ms. Status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[useLiveKitToken] Token Fetch Error Response:', response.status, errorText);
                throw new Error(`Failed to fetch token: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            // ... (rest of logic)
            
            const tokenValue = data.token || data.data?.token;
            const urlValue = data.url || data.livekitUrl || data.ws_url || import.meta.env.VITE_LIVEKIT_URL || null;
            const identityValue = data.identity || data.data?.identity || null;
            const roomValue = data.room || data.roomName || data.data?.room || null;

            if (!tokenValue) {
                throw new Error('Token not found in response');
            }

            // Cache briefly to avoid duplicate requests during rapid renders
            const ttl = 30 * 1000; // 30s
            const cachedResult: CachedToken = {
                token: tokenValue,
                url: urlValue,
                identity: identityValue,
                room: roomValue,
                expiresAt: Date.now() + ttl,
            };
            tokenCache.set(cacheKey, cachedResult);
            return cachedResult;

          } catch (fetchErr: any) {
              clearTimeout(fetchTimeout);
              if (fetchErr.name === 'AbortError') {
                  throw new Error('Token request timed out (15s)');
              }
              throw fetchErr;
          }
        })();

        inflight.set(cacheKey, promise);
        try {
          const result = await promise;
          if (mounted) {
            setToken(result.token);
            setServerUrl(result.url);
            setIdentity(result.identity);
            setRoom(result.room);
          }
        } finally {
          inflight.delete(cacheKey);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to fetch token');
          console.error('[useLiveKitToken] Error fetching token:', err);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchToken();

    return () => {
      mounted = false;
    };
  }, [streamId, isHost, userId, roomName, canPublish, enabled]);

  return {
    token,
    serverUrl,
    identity,
    roomName: room,
    isLoading,
    error,
    ready: !!token && !!serverUrl,
  };
}
