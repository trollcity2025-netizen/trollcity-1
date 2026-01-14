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
}

export function useLiveKitToken({
  streamId,
  isHost,
  userId,
  roomName,
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
    if (!userId || !roomName || !streamId) {
      return;
    }

    let mounted = true;

    const cacheKey = `${roomName}:${userId}:${isHost ? 'host' : 'viewer'}`;

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

        const functionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
        const baseUrl = functionsUrl || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1';

        const promise = (async (): Promise<CachedToken> => {
          const storeSession = useAuthStore.getState().session as any;
          const expiresAt = storeSession?.expires_at;
          const now = Math.floor(Date.now() / 1000);
          const hasValidStoreSession = !!storeSession?.access_token && (!expiresAt || expiresAt > now + 30);
          const session = hasValidStoreSession
            ? storeSession
            : (await supabase.auth.getSession()).data.session;

          if (!session?.access_token) {
            throw new Error('No active session');
          }

          const response = await fetch(`${baseUrl}/livekit-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              roomName,
              identity: userId,
              user_id: userId,
              role: isHost ? 'broadcaster' : 'viewer',
              allowPublish: isHost,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch token: ${response.status} ${errorText}`);
          }

          const data = await response.json();

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
  }, [streamId, isHost, userId, roomName]);

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
