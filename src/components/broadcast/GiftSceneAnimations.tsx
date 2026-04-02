/**
 * Individual Gift Animation Scenes
 * Each gift gets a unique animated scene depicting its actual action
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './gift-scenes.css';

export interface GiftSceneProps {
  giftName: string;
  giftIcon: string;
  giftValue: number;
  duration: number;
  onComplete: () => void;
}

// Detect what scene to show based on gift name/icon
function detectScene(name: string, icon: string): string {
  const s = `${name} ${icon}`.toLowerCase().replace(/[_-]/g, ' ');
  if (s.includes('ice cream') || s.includes('icecream') || s.includes('gelato')) return 'ice-cream';
  if (s.includes('applause') || s.includes('clap') || s.includes('hands')) return 'clap';
  if (s.includes('fire') || s.includes('flame') || s.includes('blaze') || s.includes('torch') || s.includes('🔥')) return 'fire';
  if (s.includes('rose') || s.includes('flower') || s.includes('bouquet') || s.includes('🌹')) return 'roses';
  if (s.includes('heart') || s.includes('love') || s.includes('pulse') || s.includes('❤') || s.includes('💖')) return 'heart';
  if (s.includes('crown') || s.includes('king') || s.includes('queen') || s.includes('👑')) return 'crown';
  if (s.includes('diamond') || s.includes('gem') || s.includes('💎') || s.includes('bling')) return 'diamond';
  if (s.includes('car') || s.includes('auto') || s.includes('drift') || s.includes('🏎')) return 'car';
  if (s.includes('rocket') || s.includes('launch') || s.includes('🚀')) return 'rocket';
  if (s.includes('money') || s.includes('cash') || s.includes('dollar') || s.includes('💵') || s.includes('💸')) return 'money';
  if (s.includes('coin') || s.includes('flip') || s.includes('🪙')) return 'coin';
  if (s.includes('champagne') || s.includes('bubbly') || s.includes('🍾') || s.includes('toast')) return 'champagne';
  if (s.includes('pizza') || s.includes('🍕')) return 'pizza';
  if (s.includes('beer') || s.includes('brew') || s.includes('🍺')) return 'beer';
  if (s.includes('wine') || s.includes('🍷')) return 'wine';
  if (s.includes('coffee') || s.includes('espresso') || s.includes('☕') || s.includes('tea')) return 'coffee';
  if (s.includes('cake') || s.includes('🎂') || s.includes('birthday')) return 'cake';
  if (s.includes('bomb') || s.includes('explode') || s.includes('dynamite') || s.includes('💣') || s.includes('tnt')) return 'bomb';
  if (s.includes('trophy') || s.includes('award') || s.includes('champion') || s.includes('🏆')) return 'trophy';
  if (s.includes('star') || s.includes('⭐') || s.includes('shooting')) return 'star';
  if (s.includes('skull') || s.includes('death') || s.includes('💀') || s.includes('dead')) return 'skull';
  if (s.includes('dragon') || s.includes('🐉')) return 'dragon';
  if (s.includes('rocket') || s.includes('🚀') || s.includes('space')) return 'rocket';
  if (s.includes('helicopter') || s.includes('🚁') || s.includes('chopper')) return 'helicopter';
  if (s.includes('police') || s.includes('siren') || s.includes('🚨') || s.includes('cop')) return 'police';
  if (s.includes('gun') || s.includes('shoot') || s.includes('🔫') || s.includes('bullet')) return 'gun';
  if (s.includes('camera') || s.includes('photo') || s.includes('📸') || s.includes('flash')) return 'camera';
  if (s.includes('music') || s.includes('song') || s.includes('🎵') || s.includes('mic') || s.includes('🎤')) return 'music';
  if (s.includes('rainbow') || s.includes('🌈')) return 'rainbow';
  if (s.includes('snow') || s.includes('❄') || s.includes('ice') || s.includes('frost')) return 'snow';
  if (s.includes('ocean') || s.includes('wave') || s.includes('🌊') || s.includes('tsunami')) return 'wave';
  if (s.includes('tornado') || s.includes('🌪') || s.includes('storm') || s.includes('cyclone')) return 'tornado';
  if (s.includes('volcano') || s.includes('🌋') || s.includes('eruption') || s.includes('lava')) return 'volcano';
  if (s.includes('ghost') || s.includes('👻') || s.includes('haunt')) return 'ghost';
  if (s.includes('alien') || s.includes('ufo') || s.includes('👽') || s.includes('🛸')) return 'ufo';
  if (s.includes('hammer') || s.includes('🔨') || s.includes('smash')) return 'hammer';
  if (s.includes('sword') || s.includes('🗡') || s.includes('⚔') || s.includes('blade')) return 'sword';
  if (s.includes('shield') || s.includes('🛡') || s.includes('armor')) return 'shield';
  if (s.includes('balloon') || s.includes('🎈') || s.includes('party')) return 'balloon';
  if (s.includes('gift') || s.includes('present') || s.includes('🎁') || s.includes('box')) return 'gift-box';
  if (s.includes('ring') || s.includes('💍') || s.includes('wedding')) return 'ring';
  if (s.includes('watch') || s.includes('clock') || s.includes('⏰') || s.includes('time')) return 'clock';
  if (s.includes('candle') || s.includes('🕯')) return 'candle';
  if (s.includes('spark') || s.includes('⚡') || s.includes('electric') || s.includes('zap')) return 'spark';
  if (s.includes('smoke') || s.includes('💨') || s.includes('cigarette') || s.includes('blunt') || s.includes('vape') || s.includes('🚬')) return 'smoke';
  if (s.includes('like') || s.includes('👍') || s.includes('thumb')) return 'like';
  if (s.includes('whistle') || s.includes('😙')) return 'whistle';
  if (s.includes('house') || s.includes('🏠') || s.includes('mansion') || s.includes('castle') || s.includes('🏰')) return 'house';
  if (s.includes('flag') || s.includes('🚩') || s.includes('banner')) return 'flag';
  if (s.includes('dice') || s.includes('🎲') || s.includes('roll')) return 'dice';
  if (s.includes('slot') || s.includes('🎰') || s.includes('jackpot')) return 'slot';
  if (s.includes('wheel') || s.includes('🎡') || s.includes('spin')) return 'wheel';
  if (s.includes('plane') || s.includes('✈') || s.includes('airplane') || s.includes('jet')) return 'plane';
  if (s.includes('boat') || s.includes('ship') || s.includes('⛵') || s.includes('yacht')) return 'boat';
  if (s.includes('train') || s.includes('🚂') || s.includes('locomotive')) return 'train';
  if (s.includes('game') || s.includes('🎮') || s.includes('controller')) return 'game';
  if (s.includes('key') || s.includes('🔑') || s.includes('unlock')) return 'key';
  if (s.includes('lock') || s.includes('🔒') || s.includes('vault') || s.includes('🔓')) return 'lock';
  if (s.includes('hug') || s.includes('🤗') || s.includes('embrace')) return 'hug';
  if (s.includes('kiss') || s.includes('💋') || s.includes('💋')) return 'kiss';
  if (s.includes('cry') || s.includes('😢') || s.includes('tear') || s.includes('sad')) return 'cry';
  if (s.includes('laugh') || s.includes('😂') || s.includes('haha') || s.includes('funny')) return 'laugh';
  if (s.includes('angry') || s.includes('😤') || s.includes('rage') || s.includes('mad')) return 'angry';
  if (s.includes('wow') || s.includes('😮') || s.includes('shock') || s.includes('surprise')) return 'wow';
  if (s.includes('cool') || s.includes('😎') || s.includes('sunglasses')) return 'cool';
  if (s.includes('angel') || s.includes('😇') || s.includes('halo')) return 'angel';
  if (s.includes('devil') || s.includes('😈') || s.includes('demon')) return 'devil';
  if (s.includes('sun') || s.includes('☀') || s.includes('🌞')) return 'sun';
  if (s.includes('moon') || s.includes('🌙') || s.includes('lunar')) return 'moon';
  if (s.includes('earth') || s.includes('🌍') || s.includes('world') || s.includes('globe')) return 'earth';
  return 'default';
}

// ========== ANIMATED SCENE COMPONENTS ==========

function SceneIceCream({ duration }: { duration: number }) {
  return (
    <div className="scene-ice-cream" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="ic-cone" />
      <div className="ic-scoop ic-scoop-1" />
      <div className="ic-scoop ic-scoop-2" />
      <div className="ic-scoop ic-scoop-3" />
      <div className="ic-drip ic-drip-1" />
      <div className="ic-drip ic-drip-2" />
      <div className="ic-drip ic-drip-3" />
      <div className="ic-cherry" />
      <div className="ic-sprinkles">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="ic-sprinkle" style={{
            left: `${30 + Math.random() * 40}%`,
            top: `${10 + Math.random() * 40}%`,
            animationDelay: `${Math.random() * 2}s`,
            background: ['#ff4081', '#00e5ff', '#ffeb3b', '#76ff03', '#e040fb'][i % 5],
          }} />
        ))}
      </div>
      <div className="ic-sticky-floor" />
    </div>
  );
}

function SceneClap({ duration }: { duration: number }) {
  return (
    <div className="scene-clap" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="clap-hand clap-left">🤚</div>
      <div className="clap-hand clap-right">🤚</div>
      <div className="clap-impact">💥</div>
      <div className="clap-sound-waves">
        <div className="clap-wave clap-wave-1" />
        <div className="clap-wave clap-wave-2" />
        <div className="clap-wave clap-wave-3" />
      </div>
      <div className="clap-sparks">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="clap-spark" style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}

function SceneFire({ duration }: { duration: number }) {
  return (
    <div className="scene-fire" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="fire-base" />
      <div className="fire-flame fire-flame-1" />
      <div className="fire-flame fire-flame-2" />
      <div className="fire-flame fire-flame-3" />
      <div className="fire-flame fire-flame-4" />
      <div className="fire-flame fire-flame-5" />
      <div className="fire-ember fire-ember-1" />
      <div className="fire-ember fire-ember-2" />
      <div className="fire-ember fire-ember-3" />
      <div className="fire-glow" />
      <div className="fire-smoke fire-smoke-1" />
      <div className="fire-smoke fire-smoke-2" />
    </div>
  );
}

function SceneRoses({ duration }: { duration: number }) {
  return (
    <div className="scene-roses" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="rose-main">🌹</div>
      <div className="rose-2">🌹</div>
      <div className="rose-3">🌹</div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="rose-petal" style={{
          '--i': i,
          left: `${20 + Math.random() * 60}%`,
          animationDelay: `${i * 0.3}s`,
        } as React.CSSProperties} />
      ))}
      <div className="rose-stem" />
      <div className="rose-thorns" />
    </div>
  );
}

function SceneHeart({ duration }: { duration: number }) {
  return (
    <div className="scene-heart" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="heart-main">❤️</div>
      <div className="heart-beat-ring heart-beat-ring-1" />
      <div className="heart-beat-ring heart-beat-ring-2" />
      <div className="heart-beat-ring heart-beat-ring-3" />
      <div className="heart-small heart-small-1">💕</div>
      <div className="heart-small heart-small-2">💖</div>
      <div className="heart-small heart-small-3">💗</div>
      <div className="heart-arrow" />
    </div>
  );
}

function SceneCrown({ duration }: { duration: number }) {
  return (
    <div className="scene-crown" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="crown-main">👑</div>
      <div className="crown-glow" />
      <div className="crown-sparkle crown-sparkle-1">✨</div>
      <div className="crown-sparkle crown-sparkle-2">✨</div>
      <div className="crown-sparkle crown-sparkle-3">✨</div>
      <div className="crown-spotlight" />
      <div className="crown-rays">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="crown-ray" style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}

function SceneDiamond({ duration }: { duration: number }) {
  return (
    <div className="scene-diamond" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="diamond-main">💎</div>
      <div className="diamond-facet" />
      <div className="diamond-ray diamond-ray-1" />
      <div className="diamond-ray diamond-ray-2" />
      <div className="diamond-ray diamond-ray-3" />
      <div className="diamond-ray diamond-ray-4" />
      <div className="diamond-sparkle diamond-sparkle-1">✦</div>
      <div className="diamond-sparkle diamond-sparkle-2">✦</div>
      <div className="diamond-sparkle diamond-sparkle-3">✦</div>
      <div className="diamond-sparkle diamond-sparkle-4">✦</div>
    </div>
  );
}

function SceneCar({ duration }: { duration: number }) {
  return (
    <div className="scene-car" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="car-body">🏎️</div>
      <div className="car-speed-lines">
        <div className="car-speed-line car-speed-line-1" />
        <div className="car-speed-line car-speed-line-2" />
        <div className="car-speed-line car-speed-line-3" />
      </div>
      <div className="car-exhaust" />
      <div className="car-road" />
      <div className="car-dust car-dust-1" />
      <div className="car-dust car-dust-2" />
    </div>
  );
}

function SceneMoney({ duration }: { duration: number }) {
  return (
    <div className="scene-money" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="money-bill money-bill-1">💵</div>
      <div className="money-bill money-bill-2">💵</div>
      <div className="money-bill money-bill-3">💰</div>
      <div className="money-bill money-bill-4">💵</div>
      <div className="money-bill money-bill-5">💸</div>
      <div className="money-stack" />
      <div className="money-shower">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="money-fall" style={{ left: `${10 + Math.random() * 80}%`, animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  );
}

function SceneCoin({ duration }: { duration: number }) {
  return (
    <div className="scene-coin" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="coin-main">🪙</div>
      <div className="coin-spin-shadow" />
      <div className="coin-sparkle coin-sparkle-1" />
      <div className="coin-sparkle coin-sparkle-2" />
      <div className="coin-sparkle coin-sparkle-3" />
    </div>
  );
}

function SceneChampagne({ duration }: { duration: number }) {
  return (
    <div className="scene-champagne" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="champ-bottle">🍾</div>
      <div className="champ-cork" />
      <div className="champ-spray">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="champ-drop" style={{ '--i': i, animationDelay: `${0.3 + i * 0.05}s` } as React.CSSProperties} />
        ))}
      </div>
      <div className="champ-foam" />
      <div className="champ-bubbles">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="champ-bubble" style={{ left: `${20 + Math.random() * 60}%`, animationDelay: `${0.5 + Math.random()}s` }} />
        ))}
      </div>
    </div>
  );
}

function ScenePizza({ duration }: { duration: number }) {
  return (
    <div className="scene-pizza" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="pizza-slice">🍕</div>
      <div className="pizza-cheese-drip" />
      <div className="pizza-steam pizza-steam-1" />
      <div className="pizza-steam pizza-steam-2" />
      <div className="pizza-steam pizza-steam-3" />
    </div>
  );
}

function SceneCoffee({ duration }: { duration: number }) {
  return (
    <div className="scene-coffee" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="coffee-cup">☕</div>
      <div className="coffee-steam coffee-steam-1" />
      <div className="coffee-steam coffee-steam-2" />
      <div className="coffee-steam coffee-steam-3" />
      <div className="coffee-splash" />
    </div>
  );
}

function SceneTrophy({ duration }: { duration: number }) {
  return (
    <div className="scene-trophy" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="trophy-main">🏆</div>
      <div className="trophy-shine" />
      <div className="trophy-sparkle trophy-sparkle-1">⭐</div>
      <div className="trophy-sparkle trophy-sparkle-2">✨</div>
      <div className="trophy-sparkle trophy-sparkle-3">🌟</div>
      <div className="trophy-confetti">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="trophy-confetti-piece" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            background: ['#ff4081', '#00e5ff', '#ffeb3b', '#76ff03', '#e040fb', '#ff9800'][i % 6],
          }} />
        ))}
      </div>
    </div>
  );
}

function SceneBomb({ duration }: { duration: number }) {
  return (
    <div className="scene-bomb" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="bomb-body">💣</div>
      <div className="bomb-fuse" />
      <div className="bomb-spark" />
      <div className="bomb-explosion">
        <div className="bomb-blast bomb-blast-1" />
        <div className="bomb-blast bomb-blast-2" />
        <div className="bomb-blast bomb-blast-3" />
      </div>
      <div className="bomb-smoke" />
    </div>
  );
}

function SceneStar({ duration }: { duration: number }) {
  return (
    <div className="scene-star" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="star-main">⭐</div>
      <div className="star-shoot">🌠</div>
      <div className="star-trail" />
      <div className="star-twinkle star-twinkle-1">✦</div>
      <div className="star-twinkle star-twinkle-2">✧</div>
      <div className="star-twinkle star-twinkle-3">✦</div>
    </div>
  );
}

function SceneBalloon({ duration }: { duration: number }) {
  return (
    <div className="scene-balloon" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="balloon-main balloon-red">🎈</div>
      <div className="balloon-main balloon-blue" style={{ animationDelay: '0.2s' }}>🎈</div>
      <div className="balloon-main balloon-yellow" style={{ animationDelay: '0.4s' }}>🎈</div>
      <div className="balloon-string" />
      <div className="balloon-confetti">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="balloon-confetti-piece" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random()}s` }} />
        ))}
      </div>
    </div>
  );
}

function SceneGhost({ duration }: { duration: number }) {
  return (
    <div className="scene-ghost" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="ghost-main">👻</div>
      <div className="ghost-fog" />
      <div className="ghost-boo" />
    </div>
  );
}

function SceneRocket({ duration }: { duration: number }) {
  return (
    <div className="scene-rocket" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="rocket-body">🚀</div>
      <div className="rocket-flame" />
      <div className="rocket-smoke">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rocket-smoke-puff" style={{ animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
      <div className="rocket-stars">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rocket-star" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
          }} />
        ))}
      </div>
    </div>
  );
}

function SceneBeer({ duration }: { duration: number }) {
  return (
    <div className="scene-beer" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="beer-mug">🍺</div>
      <div className="beer-foam" />
      <div className="beer-bubbles">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="beer-bubble" style={{ left: `${30 + Math.random() * 40}%`, animationDelay: `${Math.random()}s` }} />
        ))}
      </div>
      <div className="beer-splash" />
    </div>
  );
}

function SceneSkull({ duration }: { duration: number }) {
  return (
    <div className="scene-skull" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="skull-main">💀</div>
      <div className="skull-eyes" />
      <div className="skull-bones">
        <div className="skull-bone skull-bone-l">🦴</div>
        <div className="skull-bone skull-bone-r">🦴</div>
      </div>
      <div className="skull-aura" />
    </div>
  );
}

function SceneDragon({ duration }: { duration: number }) {
  return (
    <div className="scene-dragon" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="dragon-body">🐉</div>
      <div className="dragon-fire">
        <div className="dragon-flame dragon-flame-1" />
        <div className="dragon-flame dragon-flame-2" />
        <div className="dragon-flame dragon-flame-3" />
      </div>
      <div className="dragon-smoke" />
    </div>
  );
}

function SceneCamera({ duration }: { duration: number }) {
  return (
    <div className="scene-camera" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="camera-body">📸</div>
      <div className="camera-flash" />
      <div className="camera-flash-ring" />
      <div className="camera-sparkle" />
    </div>
  );
}

function SceneMusic({ duration }: { duration: number }) {
  return (
    <div className="scene-music" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="music-mic">🎤</div>
      <div className="music-note music-note-1">🎵</div>
      <div className="music-note music-note-2">🎶</div>
      <div className="music-note music-note-3">🎵</div>
      <div className="music-note music-note-4">🎶</div>
      <div className="music-wave" />
    </div>
  );
}

function SceneLike({ duration }: { duration: number }) {
  return (
    <div className="scene-like" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="like-thumb">👍</div>
      <div className="like-glow" />
      <div className="like-neon-border" />
    </div>
  );
}

function SceneRainbow({ duration }: { duration: number }) {
  return (
    <div className="scene-rainbow" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="rainbow-arc" />
      <div className="rainbow-pot">💰</div>
      <div className="rainbow-sparkle rainbow-sparkle-1" />
      <div className="rainbow-sparkle rainbow-sparkle-2" />
    </div>
  );
}

function SceneLaugh({ duration }: { duration: number }) {
  return (
    <div className="scene-laugh" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="laugh-face">😂</div>
      <div className="laugh-tears">
        <div className="laugh-tear laugh-tear-l" />
        <div className="laugh-tear laugh-tear-r" />
      </div>
      <div className="laugh-haha">HA HA HA</div>
    </div>
  );
}

function SceneGun({ duration }: { duration: number }) {
  return (
    <div className="scene-gun" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="gun-body">🔫</div>
      <div className="gun-flash" />
      <div className="gun-bullet" />
      <div className="gun-smoke" />
      <div className="gun-shell" />
    </div>
  );
}

function SceneWine({ duration }: { duration: number }) {
  return (
    <div className="scene-wine" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="wine-glass">🍷</div>
      <div className="wine-swirl" />
      <div className="wine-drip" />
    </div>
  );
}

function SceneDefault({ icon, duration }: { icon: string; duration: number }) {
  return (
    <div className="scene-default" style={{ '--d': `${duration}s` } as React.CSSProperties}>
      <div className="default-icon">{icon}</div>
      <div className="default-glow" />
      <div className="default-ring default-ring-1" />
      <div className="default-ring default-ring-2" />
    </div>
  );
}

// ========== SCENE MAP ==========

const SCENE_COMPONENTS: Record<string, React.FC<{ duration: number }>> = {
  'ice-cream': SceneIceCream,
  'clap': SceneClap,
  'fire': SceneFire,
  'roses': SceneRoses,
  'heart': SceneHeart,
  'crown': SceneCrown,
  'diamond': SceneDiamond,
  'car': SceneCar,
  'money': SceneMoney,
  'coin': SceneCoin,
  'champagne': SceneChampagne,
  'pizza': ScenePizza,
  'coffee': SceneCoffee,
  'trophy': SceneTrophy,
  'bomb': SceneBomb,
  'star': SceneStar,
  'balloon': SceneBalloon,
  'ghost': SceneGhost,
  'rocket': SceneRocket,
  'beer': SceneBeer,
  'skull': SceneSkull,
  'dragon': SceneDragon,
  'camera': SceneCamera,
  'music': SceneMusic,
  'like': SceneLike,
  'rainbow': SceneRainbow,
  'laugh': SceneLaugh,
  'gun': SceneGun,
  'wine': SceneWine,
};

// ========== MAIN OVERLAY ==========

export function GiftSceneOverlay({ giftName, giftIcon, giftValue, duration, onComplete }: GiftSceneProps) {
  const [phase, setPhase] = useState<'enter' | 'active' | 'exit'>('enter');
  const scene = detectScene(giftName, giftIcon);
  const SceneComponent = SCENE_COMPONENTS[scene] || (({ duration: d }: { duration: number }) => <SceneDefault icon={giftIcon} duration={d} />);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('active'), 50);
    const t2 = setTimeout(() => setPhase('exit'), (duration - 0.5) * 1000);
    const t3 = setTimeout(onComplete, duration * 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [duration, onComplete]);

  return createPortal(
    <div className={`gift-scene-overlay gs-${phase}`}>
      <SceneComponent duration={duration} />
      <div className="gs-label">
        <span className="gs-name">{giftName.replace(/_/g, ' ')}</span>
        <span className="gs-info">{scene} • {duration}s</span>
      </div>
    </div>,
    document.body
  );
}
