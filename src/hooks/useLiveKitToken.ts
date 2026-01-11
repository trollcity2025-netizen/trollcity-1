import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

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

    const fetchToken = async () => {
      try {
        setIsLoading(true);
        
        const functionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
        if (!functionsUrl) {
            console.warn('Missing VITE_EDGE_FUNCTIONS_URL, using default fallback');
        }
        
        const baseUrl = functionsUrl || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1';

        console.log('[useLiveKitToken] Fetching token...', { roomName, isHost, userId });

        const storeSession = useAuthStore.getState().session as any;
        const expiresAt = storeSession?.expires_at;
        const now = Math.floor(Date.now() / 1000);
        const hasValidStoreSession = !!storeSession?.access_token && (!expiresAt || expiresAt > now + 30);
        const session = hasValidStoreSession
          ? storeSession
          : (await supabase.auth.getSession()).data.session;

        console.log("SESSION TOKEN EXISTS?", !!session?.access_token); 
        console.log("TOKEN START:", session?.access_token?.slice(0, 20));

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
        console.log('[useLiveKitToken] Raw response data:', data);
        
        // Handle different response formats (direct token or nested data)
        const tokenValue = data.token || data.data?.token;
        // Prioritize URL from response, fallback to env
        const urlValue = data.url || data.livekitUrl || data.ws_url || import.meta.env.VITE_LIVEKIT_URL;
        
        if (!urlValue) {
            console.error('[useLiveKitToken] No LiveKit URL found. Env:', import.meta.env.VITE_LIVEKIT_URL, 'Response:', data);
        }

        const identityValue = data.identity || data.data?.identity;
        const roomValue = data.room || data.roomName || data.data?.room;

        if (!tokenValue) {
            throw new Error('Token not found in response');
        }

        if (mounted) {
          setToken(tokenValue);
          setServerUrl(urlValue);
          setIdentity(identityValue);
          setRoom(roomValue);
          console.log('[useLiveKitToken] Token fetched successfully');
        }
      } catch (err: any) {
        if (mounted) {
          console.error('[useLiveKitToken] Error fetching token:', err);
          setError(err.message || 'Failed to fetch token');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
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
