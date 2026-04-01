import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Player } from '@remotion/player';
import { GiftAnimation } from '../../remotion/GiftAnimation';
import { findGiftConfig, getResolution, getFps, getDuration, getQuality, type DisplayMode } from '../../remotion/config';
import { playGiftSound } from '../../lib/giftSoundMap';

interface RemotionGiftPlayerProps {
  giftId: string;
  giftName?: string;
  giftEmoji?: string;
  giftCost?: number;
  onComplete: () => void;
  containerStyle?: React.CSSProperties;
  displayMode?: DisplayMode;
}

export function RemotionGiftPlayer({
  giftId,
  giftName,
  giftEmoji,
  giftCost,
  onComplete,
  containerStyle,
  displayMode = 'fullscreen',
}: RemotionGiftPlayerProps) {
  const config = findGiftConfig(giftId);
  const cost = giftCost || config?.cost || 0;
  const quality = getQuality(cost);
  const duration = getDuration(cost);
  const fps = getFps();
  const durationInFrames = Math.round(duration * fps);
  const resolution = getResolution(quality);
  const hasPlayedSound = useRef(false);

  const name = giftName || config?.name || 'Gift';
  const emoji = giftEmoji || config?.emoji || '\uD83C\uDF81';

  useEffect(() => {
    if (!hasPlayedSound.current) {
      hasPlayedSound.current = true;
      playGiftSound(name, emoji, cost);
    }
  }, [name, emoji, cost]);

  const handleEnded = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const inputProps = useMemo(() => ({
    giftId,
    giftName: name,
    giftEmoji: emoji,
    giftCost: cost,
  }), [giftId, name, emoji, cost]);

  const wrapperStyle: React.CSSProperties = displayMode === 'target' ? {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    borderRadius: 8,
    ...containerStyle,
  } : {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    pointerEvents: 'none',
    ...containerStyle,
  };

  return (
    <div style={wrapperStyle}>
      <Player
        component={GiftAnimation}
        inputProps={inputProps}
        durationInFrames={durationInFrames}
        fps={fps}
        compositionWidth={resolution.width}
        compositionHeight={resolution.height}
        style={{
          width: '100%',
          height: '100%',
        }}
        autoPlay
        loop={false}
        showPosterWhenStopped={false}
        showPosterWhenUnloaded={false}
        onEnded={handleEnded}
        acknowledgeRemotionLicense
      />
    </div>
  );
}
