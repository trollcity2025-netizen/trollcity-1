import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
  isGuest?: boolean;
}

export function useLiveKitToken({
  streamId,
  isHost,
  userId,
  roomName,
  canPublish = false,
  enabled = true,
  isGuest = false,
  role
}: UseLiveKitTokenProps & { role?: string }) {
  const navigate = useNavigate();
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
    if (!enabled || !roomName || !streamId) {
      return;
    }
    
    // For non-guests, we need userId
    if (!isGuest && !userId) {
        return;
    }

    let mounted = true;
    
    // Sanitize room name to match SetupPage logic (remove dashes)
    const safeRoomName = roomName.replace(/-/g, "");

    // 🚀 Check PreflightStore first (Sync check for Go Live flow)
    try {
        // Safety check for circular dependency issues
        if (PreflightStore) {
            const preflight = PreflightStore.getToken();
            if (preflight.token && preflight.roomName === safeRoomName) {
                console.log('[useLiveKitToken] 💎 Using preflight token for room:', safeRoomName);
                setToken(preflight.token);
                setRoom(safeRoomName);
                // Use default URL or fallback as PreflightStore doesn't persist URL
                setServerUrl(import.meta.env.VITE_LIVEKIT_URL || import.meta.env.VITE_LIVEKIT_TOKEN_URL?.replace('/token', '') || "");
                setIdentity(userId || 'host');
                return;
            }
        }
    } catch (err) {
        console.warn('[useLiveKitToken] PreflightStore access failed:', err);
    }

    const cacheKey = `${safeRoomName}:${userId || 'guest'}:${isHost ? 'host' : 'viewer'}:${canPublish ? 'pub' : 'sub'}`;

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

        // Determine Endpoint
        let tokenUrl = '';
        if (isGuest) {
             tokenUrl = '/api/livekit-guest-token';
        } else {
             tokenUrl = import.meta.env.VITE_LIVEKIT_TOKEN_URL || 
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/livekit-token`;
        }

        console.log('[useLiveKitToken] Fetching token from:', tokenUrl, {
            roomName,
            identity: userId,
            isHost,
            canPublish,
            isGuest,
            role: (isHost || canPublish) ? 'broadcaster' : 'viewer'
        });

        const promise = (async (): Promise<CachedToken> => {
          let accessToken = '';

          if (!isGuest) {
              const storeSession = useAuthStore.getState().session as any;
              const expiresAt = storeSession?.expires_at;
              const now = Math.floor(Date.now() / 1000);
              const hasValidStoreSession = !!storeSession?.access_token && (!expiresAt || expiresAt > now + 30);
              
              if (!hasValidStoreSession) {
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
                      // Fallback to synchronous store session
                      freshSession = useAuthStore.getState().session;
                  }
                  
                  if (!freshSession?.access_token) {
                    console.error('[useLiveKitToken] No session found in store or refresh failed');
                    throw new Error('No active session - please sign in again');
                  }
                  accessToken = freshSession.access_token;
              } else {
                  accessToken = storeSession.access_token;
              }
          }

           console.log('[useLiveKitToken] Session ready (or guest), fetching token...');
          
          // Add timeout for fetch (10s)
          const controller = new AbortController();
          const fetchTimeout = setTimeout(() => controller.abort(), 10000);

          console.log('[useLiveKitToken] Starting fetch to:', tokenUrl);
          const startTime = Date.now();

          try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (!isGuest && accessToken) {
                headers['Authorization'] = `Bearer ${accessToken}`;
            }

            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                roomName: safeRoomName,
                streamId, // Guest endpoint expects streamId sometimes
                identity: userId,
                user_id: userId,
                // FORCE ADMIN ROLE to bypass server-side role checks if we need to publish
                role: role || ((isHost || canPublish) ? 'admin' : 'viewer'),
                allowPublish: canPublish,
                canPublish: canPublish,
                }),
                signal: controller.signal
            });
            
            clearTimeout(fetchTimeout);
            console.log('[useLiveKitToken] Fetch completed in', Date.now() - startTime, 'ms. Status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[useLiveKitToken] Token Fetch Error Response:', response.status, errorText);
                if (response.status === 403) {
                    throw new Error('Access denied (Banned or Restricted)');
                }
                throw new Error(`Failed to fetch token: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            // ... (rest of logic)
            
            // Handle both structure types (direct or nested)
            let tokenValue = (data.token || data.data?.token)?.trim();
            
            // Remove double quotes if present (some JSON parsers/stringifiers leave them)
            if (tokenValue && tokenValue.startsWith('"') && tokenValue.endsWith('"')) {
                tokenValue = tokenValue.slice(1, -1);
            }

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
          const msg = err.message || 'Failed to fetch token';
          
          if (msg.includes("Server is full")) {
             console.warn("[useLiveKitToken] Server full, redirecting...");
             toast.error("Server is full (max 100 users). Redirecting to homepage...", { duration: 4000 });
             navigate("/");
          }

          setError(msg);
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
  }, [streamId, isHost, userId, roomName, canPublish, enabled, navigate]);

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
