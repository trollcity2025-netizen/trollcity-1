/**
 * Gift Animation Registry - Unified per-gift mapping
 * 
 * Maps each gift ID/slug to its specific:
 * - animation component (3D scene type)
 * - sound file
 * - duration override (optional)
 * - fallback behavior
 * 
 * This is the single source of truth for both preview and live gift animations.
 * All animations render with transparent backgrounds.
 */

export interface GiftAnimEntry {
  id: string;
  slug?: string;
  keywords: string[];
  sceneType: string;          // Maps to 3D scene in Gift3DAnimations.tsx
  sound: string;              // Primary sound file
  fallbackSound: string;      // Fallback if primary fails
  durationOverride?: number;  // Override auto-calculated duration (seconds)
  premium?: boolean;          // Uses custom premium 3D scene vs procedural
}

// All 72+ registered gifts with unique animation + sound mappings
export const GIFT_ANIMATION_REGISTRY: GiftAnimEntry[] = [
  // ===== TIER I - Low cost gifts (<500 coins) =====
  { id: 'rose', keywords: ['rose', 'roses', '🌹'], sceneType: 'rose', sound: '/sounds/rose.mp3', fallbackSound: '/sounds/bouquet.mp3', premium: true },
  { id: 'flower', keywords: ['flower', 'bouquet', '🌸', '🌺', '🌻', '🌷', 'bloom'], sceneType: 'flower', sound: '/sounds/bouquet.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'heart', keywords: ['heart', 'love', 'pulse', '❤', '💖', '💕', '💗', 'heartbeat'], sceneType: 'heart', sound: '/sounds/heart.mp3', fallbackSound: '/sounds/goldstar.mp3', premium: true },
  { id: 'fire', keywords: ['fire', 'flame', 'blaze', '🔥', 'torch', 'burn'], sceneType: 'fire', sound: '/sounds/lighter.mp3', fallbackSound: '/sounds/entrance/flame.mp3', premium: true },
  { id: 'like', keywords: ['like', '👍', 'thumb', 'neon like', 'thumbs up'], sceneType: 'like', sound: '/sounds/click.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'clap', keywords: ['clap', 'applause', '👏', 'hands', 'hand clap'], sceneType: 'clap', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'star', keywords: ['star', '⭐', 'shooting star', '🌟', 'gold star'], sceneType: 'star', sound: '/sounds/goldstar.mp3', fallbackSound: '/sounds/click.mp3', premium: true },
  { id: 'camera', keywords: ['camera', '📸', 'flash', 'photo', 'camera flash', 'selfie'], sceneType: 'camera', sound: '/sounds/click.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'whistle', keywords: ['whistle', '😙', 'whistle blow'], sceneType: 'whistle', sound: '/sounds/click.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'smoke', keywords: ['smoke', '💨', 'blunt', 'cigarette', 'vape', '🚬', 'weed', 'joint'], sceneType: 'smoke', sound: '/sounds/blunt.mp3', fallbackSound: '/sounds/lighter.mp3' },
  { id: 'lighter', keywords: ['lighter', '🔥 lighter'], sceneType: 'lighter', sound: '/sounds/lighter.mp3', fallbackSound: '/sounds/click.mp3' },

  // ===== TIER II - Mid cost gifts (500-2499 coins) =====
  { id: 'crown', keywords: ['crown', 'king', 'queen', '👑', 'royal', 'crown spin'], sceneType: 'crown', sound: '/sounds/crown.mp3', fallbackSound: '/sounds/golden-buzzer.mp3', premium: true },
  { id: 'diamond', keywords: ['diamond', '💎', 'bling', 'diamond case'], sceneType: 'diamond', sound: '/sounds/diamond.mp3', fallbackSound: '/sounds/goldstar.mp3', premium: true },
  { id: 'gem', keywords: ['gem', '💍', 'jewel', 'ruby', 'emerald', 'sapphire'], sceneType: 'gem', sound: '/sounds/diamond.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'trophy', keywords: ['trophy', 'award', '🏆', 'champion', 'gold trophy'], sceneType: 'trophy', sound: '/sounds/golden-buzzer.mp3', fallbackSound: '/sounds/goldstar.mp3', premium: true },
  { id: 'champagne', keywords: ['champagne', 'bubbly', '🍾', 'toast', 'champagne pop'], sceneType: 'champagne', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'coin', keywords: ['coin', 'flip', '🪙', 'coin flip', 'gold coin'], sceneType: 'coin', sound: '/sounds/metal_spin.mp3', fallbackSound: '/sounds/entrance/coins.mp3', premium: true },
  { id: 'money', keywords: ['money', 'cash', 'dollar', '💵', '💸', 'rich', 'money stack', 'cash toss'], sceneType: 'money', sound: '/sounds/entrance/coins.mp3', fallbackSound: '/sounds/goldstar.mp3', premium: true },
  { id: 'police', keywords: ['police', 'siren', '🚨', 'cop', 'police light'], sceneType: 'police', sound: '/sounds/entrance/police_siren.mp3', fallbackSound: '/sounds/entrance/police.mp3', premium: true },
  { id: 'pizza', keywords: ['pizza', '🍕', 'slice'], sceneType: 'pizza', sound: '/sounds/sushi.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'beer', keywords: ['beer', '🍺', 'brew', 'pint'], sceneType: 'beer', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'wine', keywords: ['wine', '🍷', 'red wine', 'wine bottle'], sceneType: 'wine', sound: '/sounds/bouquet.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'coffee', keywords: ['coffee', '☕', 'espresso', 'tea', 'latte'], sceneType: 'coffee', sound: '/sounds/cupcake.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'ice-cream', keywords: ['ice cream', 'icecream', '🍦', 'gelato'], sceneType: 'ice-cream', sound: '/sounds/icecream.mp3', fallbackSound: '/sounds/cupcake.mp3', premium: true },
  { id: 'cake', keywords: ['cake', '🎂', 'cupcake', 'birthday'], sceneType: 'cake', sound: '/sounds/cupcake.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'bear', keywords: ['bear', '🧸', 'teddy', 'teddy bear'], sceneType: 'bear', sound: '/sounds/bear.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'wand', keywords: ['wand', '🪄', 'magic', 'spell', 'magic wand'], sceneType: 'wand', sound: '/sounds/wand.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'balloon', keywords: ['balloon', '🎈', 'party balloon'], sceneType: 'balloon', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'sushi', keywords: ['sushi', '🍣', 'food', 'meal'], sceneType: 'sushi', sound: '/sounds/sushi.mp3', fallbackSound: '/sounds/cupcake.mp3' },
  { id: 'fireworks', keywords: ['fireworks', '🎆', 'fireworks shot', 'bottle rocket'], sceneType: 'fireworks', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/entrance/explosion.mp3' },
  { id: 'vip', keywords: ['vip', '🎫', 'vip pass', 'pass'], sceneType: 'vip', sound: '/sounds/golden-buzzer.mp3', fallbackSound: '/sounds/goldstar.mp3' },

  // ===== TIER III - High cost gifts (2500-9999 coins) =====
  { id: 'car', keywords: ['car', 'auto', 'drift', '🏎', 'sports car'], sceneType: 'car', sound: '/sounds/car.mp3', fallbackSound: '/sounds/supercar.mp3', premium: true },
  { id: 'supercar', keywords: ['supercar', '🏎️', 'sports car rev'], sceneType: 'supercar', sound: '/sounds/supercar.mp3', fallbackSound: '/sounds/car.mp3' },
  { id: 'rocket', keywords: ['rocket', 'launch', '🚀', 'space', 'rocket launch'], sceneType: 'rocket', sound: '/sounds/rocket.mp3', fallbackSound: '/sounds/entrance/explosion.mp3', premium: true },
  { id: 'helicopter', keywords: ['helicopter', '🚁', 'chopper', 'heli'], sceneType: 'helicopter', sound: '/sounds/entrance/engine.mp3', fallbackSound: '/sounds/truck.mp3' },
  { id: 'gold-bar', keywords: ['gold bar', 'gold', 'gold bar drop', '🧈'], sceneType: 'gold-bar', sound: '/sounds/entrance/coins.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'motorcycle', keywords: ['motorcycle', 'bike', '🏍'], sceneType: 'motorcycle', sound: '/sounds/motorcycle.mp3', fallbackSound: '/sounds/supercar.mp3' },
  { id: 'truck', keywords: ['truck', '🚛', 'lorry'], sceneType: 'truck', sound: '/sounds/truck.mp3', fallbackSound: '/sounds/suv.mp3' },
  { id: 'suv', keywords: ['suv', '🚙'], sceneType: 'suv', sound: '/sounds/suv.mp3', fallbackSound: '/sounds/car.mp3' },
  { id: 'desk', keywords: ['desk', '💼', 'executive', 'executive desk'], sceneType: 'desk', sound: '/sounds/tool.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'house', keywords: ['house', '🏠', 'mansion', 'villa'], sceneType: 'house', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'castle', keywords: ['castle', '🏰', 'palace', 'fortress'], sceneType: 'castle', sound: '/sounds/entrance/royal_fanfare.mp3', fallbackSound: '/sounds/crown.mp3' },
  { id: 'plane', keywords: ['plane', '✈', 'airplane', 'jet', 'private jet'], sceneType: 'plane', sound: '/sounds/entrance/engine.mp3', fallbackSound: '/sounds/truck.mp3' },
  { id: 'boat', keywords: ['boat', 'ship', '⛵', 'yacht', 'cruise'], sceneType: 'boat', sound: '/sounds/entrance/engine.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'train', keywords: ['train', '🚂', 'locomotive'], sceneType: 'train', sound: '/sounds/entrance/engine.mp3', fallbackSound: '/sounds/truck.mp3' },
  { id: 'game', keywords: ['game', '🎮', 'controller', 'gaming', 'video game'], sceneType: 'game', sound: '/sounds/click.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'dice', keywords: ['dice', '🎲', 'roll', 'craps'], sceneType: 'dice', sound: '/sounds/click.mp3', fallbackSound: '/sounds/metal_spin.mp3' },
  { id: 'slot', keywords: ['slot', '🎰', 'jackpot', 'casino', 'slot machine'], sceneType: 'slot', sound: '/sounds/metal_spin.mp3', fallbackSound: '/sounds/golden-buzzer.mp3' },

  // ===== TIER IV - Epic gifts (10000-49999 coins) =====
  { id: 'bomb', keywords: ['bomb', 'explode', '💣', 'tnt', 'dynamite'], sceneType: 'bomb', sound: '/sounds/entrance/explosion.mp3', fallbackSound: '/sounds/lighter.mp3', premium: true },
  { id: 'dragon', keywords: ['dragon', '🐉', 'fire dragon'], sceneType: 'dragon', sound: '/sounds/troll.mp3', fallbackSound: '/sounds/entrance/explosion.mp3' },
  { id: 'skull', keywords: ['skull', '💀', 'death', 'dead', 'skeleton'], sceneType: 'skull', sound: '/sounds/evil_laugh.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'ghost', keywords: ['ghost', '👻', 'haunt', 'spook', 'phantom'], sceneType: 'ghost', sound: '/sounds/entrance/curtain-open.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'alien', keywords: ['alien', 'ufo', '👽', '🛸'], sceneType: 'alien', sound: '/sounds/wand.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'tornado', keywords: ['tornado', '🌪', 'storm', 'cyclone', 'hurricane'], sceneType: 'tornado', sound: '/sounds/entrance/engine.mp3', fallbackSound: '/sounds/truck.mp3' },
  { id: 'volcano', keywords: ['volcano', '🌋', 'lava', 'eruption'], sceneType: 'volcano', sound: '/sounds/entrance/explosion.mp3', fallbackSound: '/sounds/lighter.mp3' },
  { id: 'rainbow', keywords: ['rainbow', '🌈'], sceneType: 'rainbow', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'snow', keywords: ['snow', '❄', 'ice', 'frost', 'winter', 'blizzard'], sceneType: 'snow', sound: '/sounds/wand.mp3', fallbackSound: '/sounds/click.mp3', premium: true },
  { id: 'ocean', keywords: ['ocean', 'wave', '🌊', 'tsunami', 'sea'], sceneType: 'ocean', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'music', keywords: ['music', '🎵', '🎶', 'song', 'rap'], sceneType: 'music', sound: '/sounds/scratch.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'mic', keywords: ['mic', '🎤', 'microphone', 'vocal'], sceneType: 'mic', sound: '/sounds/scratch.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'spark', keywords: ['spark', '⚡', 'electric', 'zap', 'lightning'], sceneType: 'spark', sound: '/sounds/entrance/lightning.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'hammer', keywords: ['hammer', '🔨', 'smash', 'sledge'], sceneType: 'hammer', sound: '/sounds/tool.mp3', fallbackSound: '/sounds/entrance/explosion.mp3' },
  { id: 'sword', keywords: ['sword', '🗡', '⚔', 'blade', 'katana'], sceneType: 'sword', sound: '/sounds/scratch.mp3', fallbackSound: '/sounds/tool.mp3' },
  { id: 'shield', keywords: ['shield', '🛡', 'armor', 'defense'], sceneType: 'shield', sound: '/sounds/tool.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'gun', keywords: ['gun', 'shoot', '🔫', 'bullet', 'pistol'], sceneType: 'gun', sound: '/sounds/entrance/explosion.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'ring', keywords: ['ring', '💍', 'wedding ring', 'engagement'], sceneType: 'ring', sound: '/sounds/diamond.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'clock', keywords: ['clock', '⏰', 'watch', 'time'], sceneType: 'clock', sound: '/sounds/click.mp3', fallbackSound: '/sounds/metal_spin.mp3' },
  { id: 'phone', keywords: ['phone', '📱', 'mobile', 'call'], sceneType: 'phone', sound: '/sounds/click.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'gift-box', keywords: ['gift', 'present', '🎁', 'box', 'mystery box', 'gift box'], sceneType: 'gift-box', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'flag', keywords: ['flag', '🚩', 'banner'], sceneType: 'flag', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'wrench', keywords: ['wrench', '🔧', 'fix', 'repair', 'tool'], sceneType: 'wrench', sound: '/sounds/tool.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'lock', keywords: ['lock', '🔒', 'vault', 'safe'], sceneType: 'lock', sound: '/sounds/tool.mp3', fallbackSound: '/sounds/metal_spin.mp3' },
  { id: 'key', keywords: ['key', '🔑', 'unlock'], sceneType: 'key', sound: '/sounds/click.mp3', fallbackSound: '/sounds/metal_spin.mp3' },
  { id: 'computer', keywords: ['computer', '💻', 'pc', 'laptop'], sceneType: 'computer', sound: '/sounds/click.mp3', fallbackSound: '/sounds/click.mp3' },

  // ===== Emotion gifts =====
  { id: 'laugh', keywords: ['laugh', '😂', 'haha', 'funny', 'lol', '🤣'], sceneType: 'laugh', sound: '/sounds/evil_laugh.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'cry', keywords: ['cry', '😢', 'tear', 'sad', '😭', 'weep'], sceneType: 'cry', sound: '/sounds/click.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'angry', keywords: ['angry', '😤', 'rage', 'mad', '😡', 'furious'], sceneType: 'angry', sound: '/sounds/troll.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'cool', keywords: ['cool', '😎', 'sunglasses', 'swag', 'drip'], sceneType: 'cool', sound: '/sounds/click.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'wow', keywords: ['wow', '😮', 'shock', 'surprise', 'amazed', 'omg'], sceneType: 'wow', sound: '/sounds/click.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'hug', keywords: ['hug', '🤗', 'embrace', 'cuddle'], sceneType: 'hug', sound: '/sounds/heart.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'kiss', keywords: ['kiss', '💋', 'smooch'], sceneType: 'kiss', sound: '/sounds/heart.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'angel', keywords: ['angel', '😇', 'halo', 'divine'], sceneType: 'angel', sound: '/sounds/wand.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'devil', keywords: ['devil', '😈', 'demon', 'evil'], sceneType: 'devil', sound: '/sounds/evil_laugh.mp3', fallbackSound: '/sounds/troll.mp3' },
  { id: 'candle', keywords: ['candle', '🕯', 'birthday candle'], sceneType: 'candle', sound: '/sounds/lighter.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'sun', keywords: ['sun', '☀', '🌞', 'sunshine'], sceneType: 'sun', sound: '/sounds/goldstar.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'moon', keywords: ['moon', '🌙', 'lunar', 'crescent'], sceneType: 'moon', sound: '/sounds/wand.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'earth', keywords: ['earth', '🌍', 'world', 'globe'], sceneType: 'earth', sound: '/sounds/wand.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'troll', keywords: ['troll', '🧌'], sceneType: 'troll', sound: '/sounds/troll.mp3', fallbackSound: '/sounds/evil_laugh.mp3' },

  // ===== TIER V - Legendary gifts (50000+ coins) =====
  { id: 'throne', keywords: ['throne', '🪑', 'throne rise', 'seat of power'], sceneType: 'throne', sound: '/sounds/entrance/royal_fanfare.mp3', fallbackSound: '/sounds/crown.mp3' },
  { id: 'red-carpet', keywords: ['red carpet', '🧣', 'carpet rollout'], sceneType: 'red-carpet', sound: '/sounds/entrance/royal_fanfare.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'court', keywords: ['court', '⚖', 'verdict', 'judge', 'court verdict'], sceneType: 'court', sound: '/sounds/entrance/explosion.mp3', fallbackSound: '/sounds/tool.mp3' },
  { id: 'convoy', keywords: ['convoy', '🚙', 'luxury convoy'], sceneType: 'convoy', sound: '/sounds/supercar.mp3', fallbackSound: '/sounds/car.mp3' },
  { id: 'troll-crown', keywords: ['troll crown', '👸'], sceneType: 'crown', sound: '/sounds/troll.mp3', fallbackSound: '/sounds/crown.mp3' },
  { id: 'city', keywords: ['city', '🏙', 'city takeover', 'takeover'], sceneType: 'city', sound: '/sounds/entrance/royal_fanfare.mp3', fallbackSound: '/sounds/entrance/explosion.mp3' },
  { id: 'godfather', keywords: ['godfather', '🤵', 'godfather arrival', 'mafia'], sceneType: 'godfather', sound: '/sounds/entrance/royal_fanfare.mp3', fallbackSound: '/sounds/evil_laugh.mp3' },
];

/**
 * Find animation entry for a gift by name and icon
 */
export function findGiftAnimation(name: string, icon: string): GiftAnimEntry | null {
  const search = `${name} ${icon}`.toLowerCase().replace(/[_-]/g, ' ');
  for (const entry of GIFT_ANIMATION_REGISTRY) {
    for (const kw of entry.keywords) {
      if (search.includes(kw.toLowerCase())) return entry;
    }
  }
  return null;
}

/**
 * Get duration based on gift coin value (with optional override)
 */
export function getGiftDuration(value: number, entry?: GiftAnimEntry | null): number {
  if (entry?.durationOverride) return entry.durationOverride;
  if (value >= 1500) return 8;
  if (value >= 500) return 6;
  return 3;
}

/**
 * Play a sound file and return the audio element
 */
export function playGiftAudio(src: string): HTMLAudioElement | null {
  try {
    const audio = new Audio(src);
    audio.volume = 0.7;
    audio.play().catch(() => {});
    return audio;
  } catch {
    return null;
  }
}

/**
 * Preload all sounds in the registry
 */
export function preloadRegistrySounds(): void {
  const sounds = new Set<string>();
  GIFT_ANIMATION_REGISTRY.forEach(e => { sounds.add(e.sound); sounds.add(e.fallbackSound); });
  sounds.forEach(src => {
    try { const a = new Audio(src); a.preload = 'auto'; a.load(); } catch {}
  });
}
