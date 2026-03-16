// Animation Components - import for internal use and re-export
import JoinEffect, { JoinEffectsContainer } from './JoinEffect';
import ReactionFloat, { ReactionsFloatContainer } from './ReactionFloat';
import GiftAnimation, { GiftAnimationsContainer } from './GiftAnimation';
import CoinExplosion, { CoinExplosionsContainer } from './CoinExplosion';
import DiamondRain, { DiamondRainsContainer } from './DiamondRain';
import AnimatedButton from './AnimatedButton';
import AnimatedCard from './AnimatedCard';

// Re-export for external use
export { AnimatedButton, AnimatedCard };
export { JoinEffect, JoinEffectsContainer };
export { ReactionFloat, ReactionsFloatContainer };
export { GiftAnimation, GiftAnimationsContainer };
export { CoinExplosion, CoinExplosionsContainer };
export { DiamondRain, DiamondRainsContainer };

// Animation Manager
export { 
  useAnimationStore, 
  useAnimationSettings,
  ANIMATION_DURATION,
  type GiftType,
  type ReactionType,
  type GiftAnimationData,
  type JoinEffectData,
  type ReactionData,
  type CoinExplosionData,
  type DiamondRainData,
} from '../../lib/animationManager';

// Re-export helper for playing animations
export const playGiftAnimation = (gift: Omit<import('../../lib/animationManager').GiftAnimationData, 'id' | 'timestamp'>) => {
  useAnimationStore.getState().playGiftAnimation(gift);
};

export const playJoinEffect = (effect: Omit<import('../../lib/animationManager').JoinEffectData, 'id' | 'timestamp'>) => {
  useAnimationStore.getState().playJoinEffect(effect);
};

export const playReaction = (reaction: Omit<import('../../lib/animationManager').ReactionData, 'id' | 'timestamp'>) => {
  useAnimationStore.getState().playReaction(reaction);
};

export const playCoinExplosion = (explosion: Omit<import('../../lib/animationManager').CoinExplosionData, 'id' | 'timestamp'>) => {
  useAnimationStore.getState().playCoinExplosion(explosion);
};

export const playDiamondRain = (rain: Omit<import('../../lib/animationManager').DiamondRainData, 'id' | 'timestamp'>) => {
  useAnimationStore.getState().playDiamondRain(rain);
};

// Main container component that renders all active animations
export function AnimationsContainer() {
  return (
    <>
      <JoinEffectsContainer />
      <ReactionsFloatContainer />
      <GiftAnimationsContainer />
      <CoinExplosionsContainer />
      <DiamondRainsContainer />
    </>
  );
}
