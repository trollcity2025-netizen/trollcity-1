import React, { useEffect, useRef } from 'react';
import { useAgora } from '../../hooks/useAgora';

interface AgoraStageProps {
  appId: string;
  token: string | null;
  channel: string;
  publish: boolean;
  rtcUid: number | null;
  children: React.ReactNode;
  onPublishFail?: () => void;
}

export default function AgoraStage({
  appId,
  token,
  channel,
  publish: shouldPublish,
  rtcUid,
  children,
  onPublishFail,
}: AgoraStageProps) {
  const { join, leave, publish, unpublish } = useAgora();

  // tracks the session we started (for correct cleanup)
  const startedSessionRef = useRef<number | null>(null);

  useEffect(() => {
    if (!rtcUid) return;

    let cancelled = false;
    startedSessionRef.current = null;

    const run = async () => {
      const role = shouldPublish ? 'host' : 'audience';

      const sessionId = await join(appId, channel, token, rtcUid, role);
      if (cancelled || !sessionId) return;

      startedSessionRef.current = sessionId;

      if (shouldPublish) {
        await publish(sessionId, onPublishFail);
      } else {
        await unpublish(sessionId);
      }
    };

    run().catch((e) => {
      if (!cancelled) console.error('[AgoraStage] run failed', e);
    });

    return () => {
      cancelled = true;
      const sid = startedSessionRef.current;
      if (sid) {
        leave(sid).catch((e) => console.error('[AgoraStage] Leave failed on cleanup', e));
      }
    };
  }, [appId, channel, token, rtcUid, shouldPublish, join, leave, publish, unpublish]);

  return <>{children}</>;
}
