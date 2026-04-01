import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { findGiftConfig } from './config';

import { CookieAnimation, RoseAnimation, IceCreamAnimation, ThumbsUpAnimation, CoffeeAnimation, BeerAnimation, PizzaAnimation, ClapAnimation, TrollFaceAnimation, PooAnimation, ClownAnimation, SaltAnimation, ToiletPaperAnimation, PeachAnimation, EggplantAnimation, KissAnimation, HeartAnimation, WarningAnimation, RIPAnimation, LoveLetterAnimation } from './animations/gifts-batch1';
import { ConfettiAnimation, FireAnimation, BouquetAnimation, BanHammerAnimation, PartyAnimation, HundredAnimation, FlexAnimation, TeddyBearAnimation, DumpsterFireAnimation, SirenAnimation, ChocolateAnimation, MedalAnimation, CrownAnimation, LagSwitchAnimation, TrophyAnimation, Error404Animation, RingAnimation } from './animations/gifts-batch2';
import { DiamondAnimation, CashStackAnimation, RocketAnimation, GoldBarAnimation, RolexAnimation, SportsCarAnimation, YachtAnimation, PrivateJetAnimation, MansionAnimation, DragonAnimation, PlanetAnimation } from './animations/gifts-batch3';
import { UnicornAnimation, PhoenixAnimation, AlienInvasionAnimation, GalaxyAnimation, TimeMachineAnimation, BlackHoleAnimation } from './animations/gifts-batch4';

export interface GiftAnimationProps {
  giftId: string;
  giftName?: string;
  giftEmoji?: string;
  giftCost?: number;
}

const ANIMATION_MAP: Record<string, React.FC<{ name: string; emoji: string; cost: number }>> = {
  'cookie': CookieAnimation,
  'rose': RoseAnimation,
  'ice-cream': IceCreamAnimation,
  'thumbs-up': ThumbsUpAnimation,
  'coffee': CoffeeAnimation,
  'beer': BeerAnimation,
  'pizza': PizzaAnimation,
  'clap': ClapAnimation,
  'troll-face': TrollFaceAnimation,
  'poo': PooAnimation,
  'clown': ClownAnimation,
  'salt': SaltAnimation,
  'toilet-paper': ToiletPaperAnimation,
  'peach': PeachAnimation,
  'eggplant': EggplantAnimation,
  'kiss': KissAnimation,
  'heart': HeartAnimation,
  'warning': WarningAnimation,
  'rip': RIPAnimation,
  'love-letter': LoveLetterAnimation,
  'confetti': ConfettiAnimation,
  'fire': FireAnimation,
  'bouquet': BouquetAnimation,
  'ban-hammer': BanHammerAnimation,
  'party': PartyAnimation,
  '100': HundredAnimation,
  'flex': FlexAnimation,
  'teddy-bear': TeddyBearAnimation,
  'dumpster-fire': DumpsterFireAnimation,
  'siren': SirenAnimation,
  'chocolate': ChocolateAnimation,
  'medal': MedalAnimation,
  'crown': CrownAnimation,
  'lag-switch': LagSwitchAnimation,
  'trophy': TrophyAnimation,
  '404-error': Error404Animation,
  'ring': RingAnimation,
  'diamond': DiamondAnimation,
  'cash-stack': CashStackAnimation,
  'rocket': RocketAnimation,
  'gold-bar': GoldBarAnimation,
  'rolex': RolexAnimation,
  'sports-car': SportsCarAnimation,
  'yacht': YachtAnimation,
  'private-jet': PrivateJetAnimation,
  'mansion': MansionAnimation,
  'dragon': DragonAnimation,
  'planet': PlanetAnimation,
  'unicorn': UnicornAnimation,
  'phoenix': PhoenixAnimation,
  'alien-invasion': AlienInvasionAnimation,
  'galaxy': GalaxyAnimation,
  'time-machine': TimeMachineAnimation,
  'black-hole': BlackHoleAnimation,
};

function DefaultAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = 1 + Math.sin(frame * 0.1) * 0.1;
  const opacity = Math.min(
    frame / 15,
    (durationInFrames - frame) / 15,
    1
  );

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle, rgba(168,85,247,0.15), transparent 70%)',
      }} />
      <div style={{
        fontSize: 180, transform: `scale(${scale})`,
        filter: 'drop-shadow(0 0 40px rgba(168,85,247,0.5))',
      }}>
        {emoji}
      </div>
      <div style={{
        position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center', opacity: Math.min(frame / 20, 1),
      }}>
        <div style={{
          fontSize: 48, fontWeight: 'bold', color: '#fff',
          textShadow: '0 0 20px rgba(0,0,0,0.8)',
          fontFamily: 'system-ui, sans-serif',
        }}>
          {name}
        </div>
        <div style={{
          fontSize: 28, color: '#a855f7',
          textShadow: '0 0 15px rgba(0,0,0,0.8)',
          fontFamily: 'system-ui, sans-serif',
          marginTop: 4,
        }}>
          {cost.toLocaleString()} coins
        </div>
      </div>
    </div>
  );
}

export function GiftAnimation({ giftId, giftName, giftEmoji, giftCost }: GiftAnimationProps) {
  const config = findGiftConfig(giftId);
  const name = giftName || config?.name || 'Gift';
  const emoji = giftEmoji || config?.emoji || '\uD83C\uDF81';
  const cost = giftCost || config?.cost || 0;

  const AnimationComponent = ANIMATION_MAP[giftId] || DefaultAnimation;

  return <AnimationComponent name={name} emoji={emoji} cost={cost} />;
}
