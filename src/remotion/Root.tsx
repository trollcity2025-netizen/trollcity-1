import { Composition } from 'remotion';
import { GiftAnimation } from './GiftAnimation';
import { GIFT_ANIMATIONS, getResolution, getFps } from './config';

export const RemotionRoot: React.FC = () => {
  const fps = getFps();

  return (
    <>
      {GIFT_ANIMATIONS.map((gift) => {
        const resolution = getResolution(gift.quality);
        const durationInFrames = Math.round(gift.duration * fps);

        return (
          <Composition
            key={gift.id}
            id={`gift-${gift.id}`}
            component={GiftAnimation}
            durationInFrames={durationInFrames}
            fps={fps}
            width={resolution.width}
            height={resolution.height}
            defaultProps={{
              giftId: gift.id,
              giftName: gift.name,
              giftEmoji: gift.emoji,
              giftCost: gift.cost,
            }}
          />
        );
      })}
    </>
  );
};
