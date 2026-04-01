/**
 * Gift Sound Map - Maps each gift to its specific sound file
 * Uses existing sounds from /public/sounds/
 */

// Per-gift specific sounds (matched by keyword)
const GIFT_SOUND_MAP: Record<string, string> = {
  'rose': '/sounds/rose.mp3',
  'flower': '/sounds/bouquet.mp3',
  'bouquet': '/sounds/bouquet.mp3',
  'heart': '/sounds/heart.mp3',
  'love': '/sounds/heart.mp3',
  'pulse': '/sounds/heart.mp3',
  'crown': '/sounds/crown.mp3',
  'king': '/sounds/crown.mp3',
  'queen': '/sounds/crown.mp3',
  'diamond': '/sounds/diamond.mp3',
  'gem': '/sounds/diamond.mp3',
  'car': '/sounds/car.mp3',
  'drift': '/sounds/supercar.mp3',
  'supercar': '/sounds/supercar.mp3',
  'rocket': '/sounds/rocket.mp3',
  'launch': '/sounds/rocket.mp3',
  'fire': '/sounds/lighter.mp3',
  'flame': '/sounds/lighter.mp3',
  'blaze': '/sounds/lighter.mp3',
  'ice cream': '/sounds/icecream.mp3',
  'icecream': '/sounds/icecream.mp3',
  'confetti': '/sounds/confetti.mp3',
  'party': '/sounds/confetti.mp3',
  'police': '/sounds/entrance/police_siren.mp3',
  'siren': '/sounds/entrance/police_siren.mp3',
  'cop': '/sounds/entrance/police_siren.mp3',
  'coin': '/sounds/entrance/coins.mp3',
  'money': '/sounds/entrance/coins.mp3',
  'cash': '/sounds/entrance/coins.mp3',
  'dollar': '/sounds/entrance/coins.mp3',
  'bomb': '/sounds/entrance/explosion.mp3',
  'explode': '/sounds/entrance/explosion.mp3',
  'dynamite': '/sounds/entrance/explosion.mp3',
  'tnt': '/sounds/entrance/explosion.mp3',
  'blunt': '/sounds/blunt.mp3',
  'cigarette': '/sounds/blunt.mp3',
  'smoke': '/sounds/blunt.mp3',
  'vape': '/sounds/blunt.mp3',
  'star': '/sounds/goldstar.mp3',
  'gold star': '/sounds/goldstar.mp3',
  'trophy': '/sounds/golden-buzzer.mp3',
  'award': '/sounds/golden-buzzer.mp3',
  'champion': '/sounds/golden-buzzer.mp3',
  'laugh': '/sounds/evil_laugh.mp3',
  'funny': '/sounds/evil_laugh.mp3',
  'haha': '/sounds/evil_laugh.mp3',
  'cake': '/sounds/cupcake.mp3',
  'cupcake': '/sounds/cupcake.mp3',
  'birthday': '/sounds/cupcake.mp3',
  'truck': '/sounds/truck.mp3',
  'bear': '/sounds/bear.mp3',
  'teddy': '/sounds/bear.mp3',
  'wand': '/sounds/wand.mp3',
  'magic': '/sounds/wand.mp3',
  'spin': '/sounds/metal_spin.mp3',
  'motorcycle': '/sounds/motorcycle.mp3',
  'bike': '/sounds/motorcycle.mp3',
  'scratch': '/sounds/scratch.mp3',
  'dj': '/sounds/scratch.mp3',
  'troll': '/sounds/troll.mp3',
  'suv': '/sounds/suv.mp3',
  'sushi': '/sounds/sushi.mp3',
  'food': '/sounds/sushi.mp3',
  'vivid': '/sounds/vived.mp3',
  'lightning': '/sounds/entrance/lightning.mp3',
  'zap': '/sounds/entrance/lightning.mp3',
  'spark': '/sounds/entrance/lightning.mp3',
  'thunder': '/sounds/entrance/lightning.mp3',
  'engine': '/sounds/entrance/engine.mp3',
  'flame_entrance': '/sounds/entrance/flame.mp3',
  'royal': '/sounds/entrance/royal_fanfare.mp3',
  'fanfare': '/sounds/entrance/royal_fanfare.mp3',
  'curtain': '/sounds/entrance/curtain-open.mp3',
};

// Tier-based fallback sounds
const TIER_SOUNDS: Record<string, string> = {
  'common': '/sounds/click.mp3',
  'uncommon': '/sounds/confetti.mp3',
  'rare': '/sounds/goldstar.mp3',
  'epic': '/sounds/golden-buzzer.mp3',
  'legendary': '/sounds/entrance/royal_fanfare.mp3',
};

function getTier(cost: number): string {
  if (cost >= 50000) return 'legendary';
  if (cost >= 10000) return 'epic';
  if (cost >= 2500) return 'rare';
  if (cost >= 500) return 'uncommon';
  return 'common';
}

// Cache for preloaded audio
const audioCache = new Map<string, HTMLAudioElement>();

function getAudio(src: string): HTMLAudioElement {
  let audio = audioCache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.preload = 'auto';
    audioCache.set(src, audio);
  }
  return audio;
}

/**
 * Play the sound for a specific gift
 */
export function playGiftSound(name: string, icon: string, cost: number): void {
  const searchText = `${name} ${icon}`.toLowerCase().replace(/[_-]/g, ' ');
  
  // Find matching sound
  let soundSrc: string | null = null;
  for (const [keyword, src] of Object.entries(GIFT_SOUND_MAP)) {
    if (searchText.includes(keyword)) {
      soundSrc = src;
      break;
    }
  }
  
  // Fallback to tier sound
  if (!soundSrc) {
    soundSrc = TIER_SOUNDS[getTier(cost)] || '/sounds/click.mp3';
  }
  
  try {
    const audio = getAudio(soundSrc);
    const clone = audio.cloneNode() as HTMLAudioElement;
    clone.volume = 0.7;
    clone.play().catch(() => {});
  } catch {
    // silent fail
  }
}

/**
 * Preload all gift sounds
 */
export function preloadGiftSounds(): void {
  Object.values(GIFT_SOUND_MAP).forEach(src => {
    try { getAudio(src); } catch {}
  });
  Object.values(TIER_SOUNDS).forEach(src => {
    try { getAudio(src); } catch {}
  });
}
