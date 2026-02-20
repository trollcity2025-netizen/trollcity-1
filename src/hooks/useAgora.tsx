import { toast } from 'sonner';
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import AgoraRTC, {
  IAgoraRTCClient,
  ILocalVideoTrack,
  ILocalAudioTrack,
  IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng';
import VirtualBackgroundExtension from 'agora-extension-virtual-background';
import { IVirtualBackgroundProcessor } from 'agora-extension-virtual-background/dist/VirtualBackgroundExtension';

type AgoraRole = 'host' | 'audience';

type AgoraContextValue = {
  rtcClient: IAgoraRTCClient | null;
  localVideoTrack: ILocalVideoTrack | null;
  localAudioTrack: ILocalAudioTrack | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  isJoined: boolean;

  // ✅ returns sessionId if join actually started and succeeded; null if rejected/failed
  join: (
    appid: string,
    channel: string,
    token: string | null,
    uid: number | null,
    role?: AgoraRole
  ) => Promise<number | null>;

  // ✅ only leaves if sessionId matches latest (or if omitted, leaves latest)
  leave: (sessionId?: number) => Promise<void>;

  publish: (sessionId?: number, onFail?: () => void) => Promise<void>;
  unpublish: (sessionId?: number) => Promise<void>;

  muted: boolean;
  setMuted: (v: boolean) => void;
};

const AgoraContext = createContext<AgoraContextValue | null>(null);

const normalizeToken = (t: any) => {
  if (t === null || t === undefined) return null;
  if (t === '' || t === 'null' || t === 'undefined') return null;
  return t;
};

// Initialize Virtual Background Extension outside component to avoid re-initialization
const virtualBackgroundExtension = new VirtualBackgroundExtension();
let virtualBackgroundProcessor: IVirtualBackgroundProcessor | null = null;
let vbExtensionInitialized = false;

// Check compatibility and register extension once
if (typeof window !== 'undefined' && !vbExtensionInitialized) {
  if (!virtualBackgroundExtension.checkCompatibility()) {
    console.error("[Agora] Virtual Background extension not supported in this browser.");
  } else {
    AgoraRTC.setLogLevel(4);
    AgoraRTC.registerExtensions([virtualBackgroundExtension]);
    vbExtensionInitialized = true;
  }
}

export function AgoraProvider({ children }: { children: React.ReactNode }) {
  const [rtcClient, setRtcClient] = useState<IAgoraRTCClient | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ILocalVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<ILocalAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [muted, setMuted] = useState(false);

  // ✅ global session guard (survives component remounts because provider stays mounted)
  const sessionIdRef = useRef(0);
  const activeSessionRef = useRef<number>(0);

  const isJoiningRef = useRef(false);
  const currentChannelRef = useRef<string | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);

  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
    }
    const client = clientRef.current;
    setRtcClient(client);

    const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: 'video' | 'audio') => {
      await client.subscribe(user, mediaType);
      setRemoteUsers((prev) => {
        const exists = prev.some((u) => u.uid === user.uid);
        return exists ? prev : [...prev, user];
      });
    };

    const handleUserUnpublished = (user: IAgoraRTCRemoteUser) => {
      setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
    };

    const handleUserJoined = (user: IAgoraRTCRemoteUser) => {
      setRemoteUsers((prev) => {
        const exists = prev.some((u) => u.uid === user.uid);
        return exists ? prev : [...prev, user];
      });
    };

    const handleUserLeft = (user: IAgoraRTCRemoteUser) => {
      setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
    };

    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
    client.on('user-joined', handleUserJoined);
    client.on('user-left', handleUserLeft);

    return () => {
      client.off('user-published', handleUserPublished);
      client.off('user-unpublished', handleUserUnpublished);
      client.off('user-joined', handleUserJoined);
      client.off('user-left', handleUserLeft);
    };
  }, []);

  const join = useCallback(
    async (appid: string, channel: string, token: string | null, uid: number | null, role: AgoraRole = 'audience') => {
      if (!rtcClient) return null;

      // ✅ If already joining, reject (do NOT trigger leave here)
      if (isJoiningRef.current) {
        console.warn(`[Agora] Join rejected: already joining. targetChannel=${channel}`);
        return null;
      }

      // ✅ If already in the same channel AND not disconnected, treat as already joined
      if (currentChannelRef.current === channel && rtcClient.connectionState !== 'DISCONNECTED') {
        console.warn(`[Agora] Join skipped: already in channel ${channel} (state=${rtcClient.connectionState})`);
        return activeSessionRef.current || null;
      }

      isJoiningRef.current = true;

      // ✅ create a new session token
      const sessionId = ++sessionIdRef.current;
      activeSessionRef.current = sessionId;

      const safeToken = normalizeToken(token);

      console.log('[Agora join] appId:', appid);
      console.log('[Agora join] channel:', channel);
      console.log('[Agora join] token:', safeToken, 'type:', typeof safeToken, 'len:', safeToken?.length);
      console.log('[Agora join] uid:', uid, 'type:', typeof uid);

      if (isJoiningRef.current) {
        console.warn('[Agora] leave ignored: currently joining');
        return;
      }

      try {
        // If previous connection is weird, force a clean leave (only if we're not disconnected)
        if (rtcClient.connectionState !== 'DISCONNECTED') {
          try {
            await rtcClient.leave();
          } catch {
            // ignore
          }
        }

        // If session changed while we were cleaning, cancel
        if (activeSessionRef.current !== sessionId) return null;

        await rtcClient.setClientRole(role);
        await rtcClient.join(appid.trim(), channel, safeToken, uid ?? null);

        // If stale, immediately leave this join (but do NOT disturb current session)
        if (activeSessionRef.current !== sessionId) {
          try {
            await rtcClient.leave();
          } catch {
            // ignore
          }
          return null;
        }

        // If stale, immediately leave this join (but do NOT disturb current session)
        if (activeSessionRef.current !== sessionId) {
          try {
            await rtcClient.leave();
          } catch {
            // ignore
          }
          return null;
        }

        currentChannelRef.current = channel;
        setIsJoined(true);
        return sessionId;
      } catch (e) {
        console.error('[Agora] Join failed', e);
        if (activeSessionRef.current === sessionId) {
          currentChannelRef.current = null;
          setIsJoined(false);
        }
        return null;
      } finally {
        // only the active session unlocks joining
        if (activeSessionRef.current === sessionId) isJoiningRef.current = false;
      }
    },
    [rtcClient]
  );

  const leave = useCallback(
    async (sessionId?: number) => {
      if (!rtcClient) return;

      const targetSession = sessionId ?? activeSessionRef.current;

      // ✅ stale leave is ignored
      if (targetSession !== activeSessionRef.current) {
        console.warn(`[Agora] leave ignored (stale). target=${targetSession} active=${activeSessionRef.current}`);
        return;
      }

      // ✅ Do not leave while joining is in progress; just ignore (prevents WS_ABORT: LEAVE)
      if (isJoiningRef.current) {
        console.warn('[Agora] leave ignored: currently joining');
        return;
      }

      try {
        // unpublish/close local tracks first
        try {
          if (localVideoTrack) await rtcClient.unpublish(localVideoTrack);
        } catch {}
        try {
          if (localAudioTrack) await rtcClient.unpublish(localAudioTrack);
        } catch {}

        localVideoTrack?.close();
        localAudioTrack?.close();

        setLocalVideoTrack(null);
        setLocalAudioTrack(null);

        setRemoteUsers([]);
        setIsJoined(false);
        currentChannelRef.current = null;

        if (rtcClient.connectionState !== 'DISCONNECTED') {
          await rtcClient.leave();
        }

        // Disable and unpipe virtual background processor if it was used
        if (virtualBackgroundProcessor) {
          await virtualBackgroundProcessor.disable();
          localVideoTrack?.unpipe(virtualBackgroundProcessor);
        }

        console.log('[Agora] Left channel.');
      } catch (e) {
        console.error('[Agora] Leave failed', e);
      }
    },
    [rtcClient, localVideoTrack, localAudioTrack]
  );

  const publish = useCallback(
    async (sessionId?: number, onFail?: () => void) => {
      if (!rtcClient) return;

      const targetSession = sessionId ?? activeSessionRef.current;
      if (targetSession !== activeSessionRef.current) {
        console.warn(`[Agora] publish ignored (stale). target=${targetSession} active=${activeSessionRef.current}`);
        return;
      }

      if (rtcClient.connectionState !== 'CONNECTED') {
        console.error(`[Agora] Cannot publish: client not connected. State: ${rtcClient.connectionState}`);
        return;
      }

      // already published
      if (localVideoTrack || localAudioTrack) {
        console.warn('[Agora] Already published.');
        return;
      }

      try {
        console.log('[Agora] Attempting camera+mic publish...');
        const [mic, cam] = await AgoraRTC.createMicrophoneAndCameraTracks();

        let processedCam = cam;

        // Attempt to apply virtual background if extension is initialized
        if (vbExtensionInitialized && virtualBackgroundExtension) {
          try {
            if (!virtualBackgroundProcessor) {
              virtualBackgroundProcessor = virtualBackgroundExtension.createProcessor();
              // Note: The path to WASM assets might need adjustment depending on your deployment.
              // Common paths include '/assets/agora-extension-virtual-background/' or from a CDN.
              // For now, assuming it's served from public/assets.
              await virtualBackgroundProcessor.init('/assets/agora-extension-virtual-background/');
            }

            const imageElement = new Image();
            imageElement.src = '/images/church-pastor-view-background.jpg'; // Path to the church background image
            await new Promise((resolve, reject) => {
              imageElement.onload = resolve;
              imageElement.onerror = reject;
            });

            await virtualBackgroundProcessor.setOptions({
              type: 'img',
              source: imageElement,
            });

            await virtualBackgroundProcessor.enable();
            processedCam = cam.pipe(virtualBackgroundProcessor).pipe(cam.processorDestination);
            console.log('[Agora] Virtual background applied successfully.');
          } catch (vbError) {
            console.error('[Agora] Failed to apply virtual background, publishing raw camera track.', vbError);
            // Fallback: continue with original camera track if VB fails
            processedCam = cam;
          }
        }

        setLocalAudioTrack(mic);
        setLocalVideoTrack(processedCam);
        await rtcClient.publish([mic, processedCam]);
        console.log('[Agora] Published camera+mic successfully.');
      } catch (e) {
        console.warn('[Agora] Camera+mic failed; falling back to mic-only.', e);
        try {
          const mic = await AgoraRTC.createMicrophoneAudioTrack();
          setLocalAudioTrack(mic);
          await rtcClient.publish([mic]);
          console.log('[Agora] Published mic-only successfully.');
        } catch (e2) {
          console.error('[Agora] Publish failed (mic-only also failed).', e2);
          toast.error('Could not find a camera or microphone. Please check your device permissions.');
          onFail?.();
        }
      }
    },
    [rtcClient, localVideoTrack, localAudioTrack]
  );

  const unpublish = useCallback(
    async (sessionId?: number) => {
      if (!rtcClient) return;

      const targetSession = sessionId ?? activeSessionRef.current;
      if (targetSession !== activeSessionRef.current) {
        console.warn(`[Agora] unpublish ignored (stale). target=${targetSession} active=${activeSessionRef.current}`);
        return;
      }

      try {
        if (localVideoTrack) await rtcClient.unpublish(localVideoTrack);
      } catch {}
      try {
        if (localAudioTrack) await rtcClient.unpublish(localAudioTrack);
      } catch {}

      localVideoTrack?.close();
      localAudioTrack?.close();

      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
    },
    [rtcClient, localVideoTrack, localAudioTrack]
  );

  const value = useMemo(
    () => ({
      rtcClient,
      localVideoTrack,
      localAudioTrack,
      remoteUsers,
      isJoined,
      join,
      leave,
      publish,
      unpublish,
      muted,
      setMuted,
    }),
    [rtcClient, localVideoTrack, localAudioTrack, remoteUsers, isJoined, join, leave, publish, unpublish, muted]
  );

  return <AgoraContext.Provider value={value}>{children}</AgoraContext.Provider>;
}

export function useAgora() {
  const ctx = useContext(AgoraContext);
  if (!ctx) throw new Error('useAgora must be used within AgoraProvider');
  return ctx;
}