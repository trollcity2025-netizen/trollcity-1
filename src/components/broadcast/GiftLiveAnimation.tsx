/**
 * Gift Animation System
 * Shows the actual gift emoji with alive, realistic CSS animations and sound
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { playGiftSound } from '../../lib/giftSoundMap';
import '../../pages/dev/gift-live.css';

export interface GiftAnimProps {
  giftName: string;
  giftIcon: string;
  giftValue: number;
  duration: number;
  onComplete: () => void;
}

// Detect animation type from gift name/icon
function detectAnim(name: string, icon: string): string {
  const s = `${name} ${icon}`.toLowerCase().replace(/[_-]/g, ' ');
  if (s.includes('rose') || s.includes('🌹')) return 'rose';
  if (s.includes('flower') || s.includes('bouquet') || s.includes('🌸') || s.includes('🌺')) return 'flower';
  if (s.includes('heart') || s.includes('love') || s.includes('pulse') || s.includes('❤') || s.includes('💖')) return 'heart';
  if (s.includes('crown') || s.includes('king') || s.includes('queen') || s.includes('👑')) return 'crown';
  if (s.includes('diamond') || s.includes('💎')) return 'diamond';
  if (s.includes('gem') || s.includes('💍')) return 'gem';
  if (s.includes('fire') || s.includes('flame') || s.includes('blaze') || s.includes('🔥')) return 'fire';
  if (s.includes('car') || s.includes('auto') || s.includes('drift') || s.includes('🏎')) return 'car';
  if (s.includes('rocket') || s.includes('🚀') || s.includes('launch')) return 'rocket';
  if (s.includes('money') || s.includes('cash') || s.includes('dollar') || s.includes('💵') || s.includes('💸')) return 'money';
  if (s.includes('coin') || s.includes('flip') || s.includes('🪙')) return 'coin';
  if (s.includes('champagne') || s.includes('🍾') || s.includes('toast')) return 'champagne';
  if (s.includes('pizza') || s.includes('🍕')) return 'pizza';
  if (s.includes('coffee') || s.includes('☕') || s.includes('tea')) return 'coffee';
  if (s.includes('beer') || s.includes('🍺') || s.includes('brew')) return 'beer';
  if (s.includes('wine') || s.includes('🍷')) return 'wine';
  if (s.includes('ice cream') || s.includes('icecream') || s.includes('🍦')) return 'ice-cream';
  if (s.includes('cake') || s.includes('🎂') || s.includes('cupcake')) return 'cake';
  if (s.includes('bomb') || s.includes('explode') || s.includes('💣') || s.includes('tnt')) return 'bomb';
  if (s.includes('trophy') || s.includes('award') || s.includes('🏆')) return 'trophy';
  if (s.includes('star') || s.includes('⭐') || s.includes('shooting')) return 'star';
  if (s.includes('skull') || s.includes('💀') || s.includes('death')) return 'skull';
  if (s.includes('dragon') || s.includes('🐉')) return 'dragon';
  if (s.includes('police') || s.includes('siren') || s.includes('🚨') || s.includes('cop')) return 'police';
  if (s.includes('music') || s.includes('🎵') || s.includes('mic') || s.includes('🎤') || s.includes('🎶')) return 'music';
  if (s.includes('camera') || s.includes('📸') || s.includes('flash') || s.includes('photo')) return 'camera';
  if (s.includes('rainbow') || s.includes('🌈')) return 'rainbow';
  if (s.includes('snow') || s.includes('❄') || s.includes('ice') || s.includes('frost')) return 'snow';
  if (s.includes('ocean') || s.includes('wave') || s.includes('🌊') || s.includes('tsunami')) return 'wave';
  if (s.includes('tornado') || s.includes('🌪') || s.includes('storm')) return 'tornado';
  if (s.includes('volcano') || s.includes('🌋') || s.includes('lava')) return 'volcano';
  if (s.includes('ghost') || s.includes('👻') || s.includes('haunt')) return 'ghost';
  if (s.includes('alien') || s.includes('ufo') || s.includes('👽') || s.includes('🛸')) return 'ufo';
  if (s.includes('balloon') || s.includes('🎈') || s.includes('party')) return 'balloon';
  if (s.includes('gift') || s.includes('present') || s.includes('🎁') || s.includes('box')) return 'gift-box';
  if (s.includes('ring') || s.includes('💍') || s.includes('wedding')) return 'ring';
  if (s.includes('like') || s.includes('👍') || s.includes('thumb')) return 'like';
  if (s.includes('clap') || s.includes('applause') || s.includes('👏') || s.includes('hands')) return 'clap';
  if (s.includes('hammer') || s.includes('🔨') || s.includes('smash')) return 'hammer';
  if (s.includes('sword') || s.includes('🗡') || s.includes('⚔') || s.includes('blade')) return 'sword';
  if (s.includes('shield') || s.includes('🛡')) return 'shield';
  if (s.includes('house') || s.includes('🏠') || s.includes('mansion')) return 'house';
  if (s.includes('castle') || s.includes('🏰')) return 'castle';
  if (s.includes('helicopter') || s.includes('🚁')) return 'helicopter';
  if (s.includes('plane') || s.includes('✈') || s.includes('airplane') || s.includes('jet')) return 'plane';
  if (s.includes('boat') || s.includes('ship') || s.includes('⛵') || s.includes('yacht')) return 'boat';
  if (s.includes('train') || s.includes('🚂')) return 'train';
  if (s.includes('game') || s.includes('🎮') || s.includes('controller')) return 'game';
  if (s.includes('hug') || s.includes('🤗')) return 'hug';
  if (s.includes('kiss') || s.includes('💋')) return 'kiss';
  if (s.includes('laugh') || s.includes('😂') || s.includes('haha') || s.includes('funny')) return 'laugh';
  if (s.includes('cry') || s.includes('😢') || s.includes('tear') || s.includes('sad')) return 'cry';
  if (s.includes('angry') || s.includes('😤') || s.includes('rage') || s.includes('mad')) return 'angry';
  if (s.includes('cool') || s.includes('😎') || s.includes('sunglasses')) return 'cool';
  if (s.includes('angel') || s.includes('😇') || s.includes('halo')) return 'angel';
  if (s.includes('devil') || s.includes('😈') || s.includes('demon')) return 'devil';
  if (s.includes('candle') || s.includes('🕯')) return 'candle';
  if (s.includes('smoke') || s.includes('💨') || s.includes('blunt') || s.includes('vape') || s.includes('🚬')) return 'smoke';
  if (s.includes('spark') || s.includes('⚡') || s.includes('electric') || s.includes('zap')) return 'spark';
  if (s.includes('sun') || s.includes('☀') || s.includes('🌞')) return 'sun';
  if (s.includes('moon') || s.includes('🌙')) return 'moon';
  if (s.includes('earth') || s.includes('🌍') || s.includes('globe')) return 'earth';
  if (s.includes('flag') || s.includes('🚩')) return 'flag';
  if (s.includes('dice') || s.includes('🎲')) return 'dice';
  if (s.includes('slot') || s.includes('🎰') || s.includes('jackpot')) return 'slot';
  if (s.includes('wheel') || s.includes('🎡')) return 'wheel';
  if (s.includes('key') || s.includes('🔑')) return 'key';
  if (s.includes('lock') || s.includes('🔒') || s.includes('vault')) return 'lock';
  if (s.includes('clock') || s.includes('⏰') || s.includes('watch') || s.includes('time')) return 'clock';
  if (s.includes('phone') || s.includes('📱')) return 'phone';
  if (s.includes('computer') || s.includes('💻') || s.includes('laptop')) return 'computer';
  if (s.includes('bear') || s.includes('🧸')) return 'bear';
  if (s.includes('wand') || s.includes('🪄') || s.includes('magic')) return 'wand';
  if (s.includes('wow') || s.includes('😮') || s.includes('shock') || s.includes('surprise')) return 'wow';
  if (s.includes('motorcycle') || s.includes('bike') || s.includes('🏍')) return 'motorcycle';
  if (s.includes('truck') || s.includes('🚛')) return 'truck';
  return 'default';
}

// ========== ANIMATED SCENE ==========

// Particle definition
interface Particle {
  id: number;
  emoji: string;
  x: number;
  y: number;
  delay: number;
  dur: number;
  size: number;
  dx: number;
  dy: number;
  rotate: number;
}

function makeParticles(emojis: string[], count: number, duration: number): Particle[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    emoji: emojis[i % emojis.length],
    x: 10 + Math.random() * 80,
    y: 10 + Math.random() * 80,
    delay: Math.random() * duration * 0.3,
    dur: duration * (0.5 + Math.random() * 0.5),
    size: 20 + Math.random() * 30,
    dx: (Math.random() - 0.5) * 200,
    dy: -50 - Math.random() * 200,
    rotate: (Math.random() - 0.5) * 360,
  }));
}

function getAnimConfig(anim: string, duration: number, icon: string) {
  const dur = duration;
  const speed = dur <= 3 ? 'fast' : dur <= 6 ? 'medium' : 'slow';
  
  const configs: Record<string, { bg: string; particles: Particle[]; iconAnim: string; glow: string }> = {
    'rose': {
      bg: 'radial-gradient(ellipse at center bottom, #e91e6340 0%, transparent 70%)',
      particles: makeParticles(['🌹', '🌸', '💮', '🥀', '✨'], 12, dur),
      iconAnim: 'anim-sway',
      glow: '#e91e63',
    },
    'flower': {
      bg: 'radial-gradient(ellipse at center bottom, #e91e6330 0%, transparent 70%)',
      particles: makeParticles(['🌸', '🌺', '🌻', '🌷', '🌼'], 12, dur),
      iconAnim: 'anim-sway',
      glow: '#e91e63',
    },
    'heart': {
      bg: 'radial-gradient(circle, #ff174430 0%, transparent 60%)',
      particles: makeParticles(['❤️', '💖', '💕', '💗', '💓'], 10, dur),
      iconAnim: 'anim-heartbeat',
      glow: '#ff1744',
    },
    'crown': {
      bg: 'radial-gradient(ellipse at top, #ffd70040 0%, transparent 60%)',
      particles: makeParticles(['✨', '⭐', '💫', '👑', '🌟'], 14, dur),
      iconAnim: 'anim-float-up',
      glow: '#ffd700',
    },
    'diamond': {
      bg: 'radial-gradient(circle, #00e5ff20 0%, transparent 60%)',
      particles: makeParticles(['✨', '💎', '✦', '💠', '⭐'], 16, dur),
      iconAnim: 'anim-sparkle-rotate',
      glow: '#00e5ff',
    },
    'gem': {
      bg: 'radial-gradient(circle, #e040fb20 0%, transparent 60%)',
      particles: makeParticles(['💎', '✨', '🔮', '💠', '⭐'], 14, dur),
      iconAnim: 'anim-sparkle-rotate',
      glow: '#e040fb',
    },
    'fire': {
      bg: 'radial-gradient(ellipse at center bottom, #ff450040 0%, transparent 60%)',
      particles: makeParticles(['🔥', '💥', '✨', '🌋', '💨'], 14, dur),
      iconAnim: 'anim-flicker',
      glow: '#ff4500',
    },
    'car': {
      bg: 'linear-gradient(0deg, #1a1a1a60 0%, transparent 30%)',
      particles: makeParticles(['💨', '🔥', '✨', '💥', '🏎️'], 8, dur),
      iconAnim: 'anim-drive',
      glow: '#f44336',
    },
    'rocket': {
      bg: 'radial-gradient(ellipse at center bottom, #ff572230 0%, transparent 60%)',
      particles: makeParticles(['🔥', '💨', '✨', '⭐', '💫'], 12, dur),
      iconAnim: 'anim-launch',
      glow: '#ff5722',
    },
    'money': {
      bg: 'radial-gradient(circle, #ffd70020 0%, transparent 60%)',
      particles: makeParticles(['💵', '💰', '💸', '🪙', '✨'], 14, dur),
      iconAnim: 'anim-shine',
      glow: '#ffd700',
    },
    'coin': {
      bg: 'radial-gradient(circle, #ffd70030 0%, transparent 60%)',
      particles: makeParticles(['🪙', '✨', '💰', '⭐', '💫'], 10, dur),
      iconAnim: 'anim-spin-coin',
      glow: '#ffd700',
    },
    'champagne': {
      bg: 'radial-gradient(ellipse at center bottom, #f5e64220 0%, transparent 60%)',
      particles: makeParticles(['🫧', '✨', '💫', '🥂', '🍾'], 12, dur),
      iconAnim: 'anim-shake-spray',
      glow: '#f5e642',
    },
    'pizza': {
      bg: 'radial-gradient(circle, #ff634720 0%, transparent 60%)',
      particles: makeParticles(['🧀', '🍅', '✨', '🍕', '💫'], 8, dur),
      iconAnim: 'anim-spin-in',
      glow: '#ff6347',
    },
    'coffee': {
      bg: 'radial-gradient(ellipse at center bottom, #6f4e3720 0%, transparent 60%)',
      particles: makeParticles(['☕', '💨', '✨', '🫧', '💫'], 8, dur),
      iconAnim: 'anim-steam',
      glow: '#6f4e37',
    },
    'beer': {
      bg: 'radial-gradient(circle, #f28e1c20 0%, transparent 60%)',
      particles: makeParticles(['🍺', '🫧', '🍻', '✨', '💫'], 10, dur),
      iconAnim: 'anim-cheers',
      glow: '#f28e1c',
    },
    'wine': {
      bg: 'radial-gradient(circle, #722f3730 0%, transparent 60%)',
      particles: makeParticles(['🍷', '🍇', '✨', '🫧', '💫'], 8, dur),
      iconAnim: 'anim-sway',
      glow: '#722f37',
    },
    'ice-cream': {
      bg: 'radial-gradient(circle, #e3f2fd20 0%, transparent 60%)',
      particles: makeParticles(['🍦', '💧', '✨', '🫧', '❄️'], 10, dur),
      iconAnim: 'anim-melt',
      glow: '#e3f2fd',
    },
    'cake': {
      bg: 'radial-gradient(circle, #ff80ab20 0%, transparent 60%)',
      particles: makeParticles(['🎂', '🕯️', '✨', '🎉', '💫'], 10, dur),
      iconAnim: 'anim-bounce',
      glow: '#ff80ab',
    },
    'bomb': {
      bg: 'radial-gradient(circle, #ff572240 0%, transparent 60%)',
      particles: makeParticles(['💥', '🔥', '💨', '✨', '💣'], 12, dur),
      iconAnim: 'anim-shake-explode',
      glow: '#ff5722',
    },
    'trophy': {
      bg: 'radial-gradient(ellipse at top, #ffd70040 0%, transparent 60%)',
      particles: makeParticles(['🏆', '✨', '⭐', '🌟', '💫'], 16, dur),
      iconAnim: 'anim-float-up',
      glow: '#ffd700',
    },
    'star': {
      bg: 'radial-gradient(circle, #ffc10730 0%, transparent 60%)',
      particles: makeParticles(['⭐', '🌟', '✨', '💫', '🌠'], 14, dur),
      iconAnim: 'anim-twinkle',
      glow: '#ffc107',
    },
    'skull': {
      bg: 'radial-gradient(circle, #42424260 0%, transparent 60%)',
      particles: makeParticles(['💀', '☠️', '⚰️', '🖤', '👻'], 10, dur),
      iconAnim: 'anim-rise-spooky',
      glow: '#9e9e9e',
    },
    'dragon': {
      bg: 'radial-gradient(ellipse at center bottom, #ff000030 0%, transparent 60%)',
      particles: makeParticles(['🔥', '🐉', '💥', '✨', '👹'], 12, dur),
      iconAnim: 'anim-swoop',
      glow: '#ff0000',
    },
    'police': {
      bg: 'none',
      particles: makeParticles(['🚨', '🚔', '✨', '💫', '🔊'], 8, dur),
      iconAnim: 'anim-siren',
      glow: '#1565c0',
    },
    'music': {
      bg: 'radial-gradient(circle, #e91e6320 0%, transparent 60%)',
      particles: makeParticles(['🎵', '🎶', '🎼', '🎤', '✨'], 12, dur),
      iconAnim: 'anim-bounce',
      glow: '#e91e63',
    },
    'camera': {
      bg: 'none',
      particles: makeParticles(['📸', '✨', '💫', '🔦', '📷'], 8, dur),
      iconAnim: 'anim-flash',
      glow: '#ffffff',
    },
    'rainbow': {
      bg: 'conic-gradient(from 0deg, #ff000020, #ff880020, #ffff0020, #00ff0020, #0088ff20, #8800ff20, #ff000020)',
      particles: makeParticles(['🌈', '✨', '💫', '⭐', '🌟'], 10, dur),
      iconAnim: 'anim-arc',
      glow: '#e91e63',
    },
    'snow': {
      bg: 'radial-gradient(circle, #e3f2fd30 0%, transparent 60%)',
      particles: makeParticles(['❄️', '⛄', '✨', '💎', '🌨️'], 16, dur),
      iconAnim: 'anim-fall-gentle',
      glow: '#e3f2fd',
    },
    'wave': {
      bg: 'linear-gradient(0deg, #00bcd430 0%, transparent 40%)',
      particles: makeParticles(['🌊', '💧', '🐚', '✨', '🫧'], 12, dur),
      iconAnim: 'anim-wave',
      glow: '#00bcd4',
    },
    'tornado': {
      bg: 'radial-gradient(circle, #78909c30 0%, transparent 60%)',
      particles: makeParticles(['🌪️', '💨', '⚡', '✨', '💫'], 12, dur),
      iconAnim: 'anim-spin-fast',
      glow: '#78909c',
    },
    'volcano': {
      bg: 'radial-gradient(ellipse at center bottom, #ff572240 0%, transparent 60%)',
      particles: makeParticles(['🌋', '🔥', '💥', '🪨', '✨'], 14, dur),
      iconAnim: 'anim-erupt',
      glow: '#ff5722',
    },
    'ghost': {
      bg: 'radial-gradient(circle, #b0bec520 0%, transparent 60%)',
      particles: makeParticles(['👻', '💀', '🌫️', '✨', '💫'], 10, dur),
      iconAnim: 'anim-ghost-float',
      glow: '#b0bec5',
    },
    'balloon': {
      bg: 'radial-gradient(circle, #e91e6315 0%, transparent 60%)',
      particles: makeParticles(['🎈', '🎉', '🎊', '✨', '💫'], 10, dur),
      iconAnim: 'anim-float-up',
      glow: '#e91e63',
    },
    'gift-box': {
      bg: 'radial-gradient(circle, #ff408120 0%, transparent 60%)',
      particles: makeParticles(['🎁', '🎀', '✨', '💫', '🎉'], 10, dur),
      iconAnim: 'anim-unbox',
      glow: '#ff4081',
    },
    'ring': {
      bg: 'radial-gradient(circle, #e0e0e020 0%, transparent 60%)',
      particles: makeParticles(['💍', '✨', '💎', '💫', '⭐'], 12, dur),
      iconAnim: 'anim-glow-pulse',
      glow: '#e0e0e0',
    },
    'like': {
      bg: 'radial-gradient(circle, #2196f320 0%, transparent 60%)',
      particles: makeParticles(['👍', '💙', '✨', '💫', '⭐'], 8, dur),
      iconAnim: 'anim-thumbs-up',
      glow: '#2196f3',
    },
    'clap': {
      bg: 'radial-gradient(circle, #ffc10720 0%, transparent 60%)',
      particles: makeParticles(['👏', '✨', '💥', '💫', '⭐'], 10, dur),
      iconAnim: 'anim-clap',
      glow: '#ffc107',
    },
    'hammer': {
      bg: 'radial-gradient(circle, #ff980020 0%, transparent 60%)',
      particles: makeParticles(['🔨', '💥', '✨', '💫', '🪨'], 10, dur),
      iconAnim: 'anim-smash',
      glow: '#ff9800',
    },
    'sword': {
      bg: 'radial-gradient(circle, #9e9e9e20 0%, transparent 60%)',
      particles: makeParticles(['⚔️', '🗡️', '💥', '✨', '💫'], 10, dur),
      iconAnim: 'anim-slash',
      glow: '#9e9e9e',
    },
    'house': {
      bg: 'radial-gradient(circle, #8bc34a20 0%, transparent 60%)',
      particles: makeParticles(['🏠', '🏡', '✨', '💫', '⭐'], 8, dur),
      iconAnim: 'anim-build',
      glow: '#8bc34a',
    },
    'castle': {
      bg: 'radial-gradient(circle, #8bc34a20 0%, transparent 60%)',
      particles: makeParticles(['🏰', '👑', '✨', '💫', '⭐'], 10, dur),
      iconAnim: 'anim-build',
      glow: '#8bc34a',
    },
    'helicopter': {
      bg: 'linear-gradient(0deg, #4caf5015 0%, transparent 30%)',
      particles: makeParticles(['🚁', '💨', '✨', '💫', '☁️'], 8, dur),
      iconAnim: 'anim-fly-across',
      glow: '#4caf50',
    },
    'plane': {
      bg: 'linear-gradient(0deg, #2196f315 0%, transparent 30%)',
      particles: makeParticles(['✈️', '💨', '☁️', '✨', '💫'], 8, dur),
      iconAnim: 'anim-fly-across',
      glow: '#2196f3',
    },
    'boat': {
      bg: 'linear-gradient(0deg, #0288d120 0%, transparent 30%)',
      particles: makeParticles(['⛵', '🌊', '💨', '✨', '💫'], 8, dur),
      iconAnim: 'anim-sail',
      glow: '#0288d1',
    },
    'train': {
      bg: 'linear-gradient(0deg, #79554820 0%, transparent 30%)',
      particles: makeParticles(['🚂', '💨', '✨', '🔥', '💫'], 8, dur),
      iconAnim: 'anim-drive',
      glow: '#795548',
    },
    'laugh': {
      bg: 'radial-gradient(circle, #ffeb3b20 0%, transparent 60%)',
      particles: makeParticles(['😂', '🤣', '😆', '✨', '💫'], 10, dur),
      iconAnim: 'anim-shake-laugh',
      glow: '#ffeb3b',
    },
    'cry': {
      bg: 'radial-gradient(circle, #42a5f520 0%, transparent 60%)',
      particles: makeParticles(['💧', '💦', '😢', '✨', '💧'], 10, dur),
      iconAnim: 'anim-cry',
      glow: '#42a5f5',
    },
    'angry': {
      bg: 'radial-gradient(circle, #f4433630 0%, transparent 60%)',
      particles: makeParticles(['😤', '💢', '🔥', '💥', '😡'], 10, dur),
      iconAnim: 'anim-shake-angry',
      glow: '#f44336',
    },
    'cool': {
      bg: 'radial-gradient(circle, #00e5ff20 0%, transparent 60%)',
      particles: makeParticles(['😎', '✨', '💫', '⭐', '🕶️'], 8, dur),
      iconAnim: 'anim-cool',
      glow: '#00e5ff',
    },
    'smoke': {
      bg: 'radial-gradient(circle, #9e9e9e20 0%, transparent 60%)',
      particles: makeParticles(['💨', '🌫️', '☁️', '✨', '🚬'], 10, dur),
      iconAnim: 'anim-smoke-puff',
      glow: '#9e9e9e',
    },
    'spark': {
      bg: 'radial-gradient(circle, #ffeb3b30 0%, transparent 60%)',
      particles: makeParticles(['⚡', '✨', '💥', '💫', '🌟'], 12, dur),
      iconAnim: 'anim-zap',
      glow: '#ffeb3b',
    },
    'slot': {
      bg: 'radial-gradient(circle, #4caf5020 0%, transparent 60%)',
      particles: makeParticles(['🎰', '💰', '✨', '💫', '🍀'], 10, dur),
      iconAnim: 'anim-spin-coin',
      glow: '#4caf50',
    },
    'sun': {
      bg: 'radial-gradient(circle, #ffeb3b20 0%, transparent 60%)',
      particles: makeParticles(['☀️', '🌞', '✨', '💫', '⭐'], 10, dur),
      iconAnim: 'anim-glow-pulse',
      glow: '#ffeb3b',
    },
    'moon': {
      bg: 'radial-gradient(circle, #9fa8da20 0%, transparent 60%)',
      particles: makeParticles(['🌙', '⭐', '✨', '💫', '🌟'], 10, dur),
      iconAnim: 'anim-float-up',
      glow: '#9fa8da',
    },
    'bear': {
      bg: 'radial-gradient(circle, #8d6e6320 0%, transparent 60%)',
      particles: makeParticles(['🧸', '✨', '💕', '💫', '❤️'], 8, dur),
      iconAnim: 'anim-bounce',
      glow: '#8d6e63',
    },
    'wand': {
      bg: 'radial-gradient(circle, #ce93d820 0%, transparent 60%)',
      particles: makeParticles(['✨', '💫', '⭐', '🌟', '🪄'], 14, dur),
      iconAnim: 'anim-sparkle-rotate',
      glow: '#ce93d8',
    },
    'wow': {
      bg: 'radial-gradient(circle, #ff980020 0%, transparent 60%)',
      particles: makeParticles(['😮', '😲', '🤯', '✨', '💫'], 10, dur),
      iconAnim: 'anim-pop',
      glow: '#ff9800',
    },
    'hug': {
      bg: 'radial-gradient(circle, #ffb34720 0%, transparent 60%)',
      particles: makeParticles(['🤗', '💕', '💖', '💗', '💛'], 8, dur),
      iconAnim: 'anim-bounce',
      glow: '#ffb347',
    },
    'kiss': {
      bg: 'radial-gradient(circle, #e91e6320 0%, transparent 60%)',
      particles: makeParticles(['💋', '😘', '❤️', '💖', '💕'], 10, dur),
      iconAnim: 'anim-pop',
      glow: '#e91e63',
    },
    'shield': {
      bg: 'radial-gradient(circle, #2196f320 0%, transparent 60%)',
      particles: makeParticles(['🛡️', '✨', '💫', '⭐', '💪'], 8, dur),
      iconAnim: 'anim-glow-pulse',
      glow: '#2196f3',
    },
    'clock': {
      bg: 'radial-gradient(circle, #607d8b20 0%, transparent 60%)',
      particles: makeParticles(['⏰', '✨', '💫', '🕐', '⚙️'], 8, dur),
      iconAnim: 'anim-spin-coin',
      glow: '#607d8b',
    },
    'game': {
      bg: 'radial-gradient(circle, #9c27b020 0%, transparent 60%)',
      particles: makeParticles(['🎮', '👾', '✨', '💥', '🕹️'], 10, dur),
      iconAnim: 'anim-bounce',
      glow: '#9c27b0',
    },
    'motorcycle': {
      bg: 'linear-gradient(0deg, #f4433615 0%, transparent 30%)',
      particles: makeParticles(['🏍️', '💨', '🔥', '✨', '💫'], 8, dur),
      iconAnim: 'anim-drive',
      glow: '#f44336',
    },
    'truck': {
      bg: 'linear-gradient(0deg, #607d8b15 0%, transparent 30%)',
      particles: makeParticles(['🚛', '💨', '✨', '💫', '🔥'], 8, dur),
      iconAnim: 'anim-drive',
      glow: '#607d8b',
    },
  };

  return configs[anim] || {
    bg: 'radial-gradient(circle, #a855f720 0%, transparent 60%)',
    particles: makeParticles(['✨', '💫', '⭐', '🌟', '🎉'], 10, dur),
    iconAnim: 'anim-pop',
    glow: '#a855f7',
  };
}

// ========== MAIN COMPONENT ==========

export function GiftLiveAnimation({ giftName, giftIcon, giftValue, duration, onComplete }: GiftAnimProps) {
  const [phase, setPhase] = useState<'enter' | 'active' | 'exit'>('enter');
  const animType = detectAnim(giftName, giftIcon);
  const config = getAnimConfig(animType, duration, giftIcon);
  const soundPlayed = useRef(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('active'), 50);
    const t2 = setTimeout(() => setPhase('exit'), (duration - 0.5) * 1000);
    const t3 = setTimeout(onComplete, duration * 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [duration, onComplete]);

  useEffect(() => {
    if (!soundPlayed.current) {
      soundPlayed.current = true;
      playGiftSound(giftName, giftIcon, giftValue);
    }
  }, [giftName, giftIcon, giftValue]);

  const tierColor = giftValue >= 50000 ? '#ffd700' : giftValue >= 10000 ? '#ff3b5c' : giftValue >= 2500 ? '#f59e0b' : giftValue >= 500 ? '#a855f7' : '#00e5ff';

  return createPortal(
    <div className={`gift-live-overlay gl-${phase}`} style={{ '--glow': config.glow, '--dur': `${duration}s` } as React.CSSProperties}>
      {/* Background */}
      <div className="gl-bg" style={{ background: config.bg }} />

      {/* Siren overlay for police */}
      {animType === 'police' && <div className="gl-siren-overlay" />}

      {/* Particles */}
      <div className="gl-particles">
        {config.particles.map(p => (
          <div
            key={p.id}
            className="gl-particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              fontSize: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': `${p.rotate}deg`,
            } as React.CSSProperties}
          >
            {p.emoji}
          </div>
        ))}
      </div>

      {/* Center gift icon */}
      <div className={`gl-center ${config.iconAnim}`}>
        <div className="gl-icon" style={{ filter: `drop-shadow(0 0 40px ${config.glow}) drop-shadow(0 0 80px ${config.glow}50)` }}>
          {giftIcon}
        </div>
      </div>

      {/* Gift info */}
      <div className="gl-info">
        <div className="gl-name" style={{ textShadow: `0 0 20px ${config.glow}` }}>
          {giftName.replace(/_/g, ' ')}
        </div>
        <div className="gl-cost" style={{ color: tierColor }}>
          {giftValue.toLocaleString()} coins • {duration}s • {animType}
        </div>
      </div>

      {/* Progress bar */}
      <div className="gl-progress">
        <div className="gl-progress-bar" style={{ background: config.glow, animationDuration: `${duration}s` }} />
      </div>
    </div>,
    document.body
  );
}
