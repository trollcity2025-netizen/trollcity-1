/**
 * Gift Video Map
 * Maps each gift name/slug to its MP4 video file and sound file
 * Videos go in /public/gift-videos/{id}.mp4
 * Sounds already exist in /public/sounds/
 */

export interface GiftVideoEntry {
  id: string;
  keywords: string[];
  video: string;       // path to MP4 in /public/gift-videos/
  sound: string;       // path to MP3 in /public/sounds/
  fallbackSound: string;
}

// Each entry: gift ID, keywords to match, video path, sound path
export const GIFT_VIDEO_MAP: GiftVideoEntry[] = [
  { id: 'rose', keywords: ['rose', 'roses', '🌹'], video: '/gift-videos/rose.mp4', sound: '/sounds/rose.mp3', fallbackSound: '/sounds/bouquet.mp3' },
  { id: 'flower', keywords: ['flower', 'bouquet', '🌸', '🌺', '🌻', '🌷'], video: '/gift-videos/flower.mp4', sound: '/sounds/bouquet.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'heart', keywords: ['heart', 'love', 'pulse', '❤', '💖', '💕'], video: '/gift-videos/heart.mp4', sound: '/sounds/heart.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'crown', keywords: ['crown', 'king', 'queen', '👑', 'royal'], video: '/gift-videos/crown.mp4', sound: '/sounds/crown.mp3', fallbackSound: '/sounds/golden-buzzer.mp3' },
  { id: 'diamond', keywords: ['diamond', '💎', 'bling'], video: '/gift-videos/diamond.mp4', sound: '/sounds/diamond.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'gem', keywords: ['gem', '💍', 'jewel', 'ruby', 'emerald'], video: '/gift-videos/gem.mp4', sound: '/sounds/diamond.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'fire', keywords: ['fire', 'flame', 'blaze', '🔥', 'torch'], video: '/gift-videos/fire.mp4', sound: '/sounds/lighter.mp3', fallbackSound: '/sounds/entrance/flame.mp3' },
  { id: 'car', keywords: ['car', 'auto', 'drift', '🏎', 'supercar'], video: '/gift-videos/car.mp4', sound: '/sounds/car.mp3', fallbackSound: '/sounds/supercar.mp3' },
  { id: 'rocket', keywords: ['rocket', 'launch', '🚀', 'space'], video: '/gift-videos/rocket.mp4', sound: '/sounds/rocket.mp3', fallbackSound: '/sounds/entrance/explosion.mp3' },
  { id: 'money', keywords: ['money', 'cash', 'dollar', '💵', '💸', 'rich'], video: '/gift-videos/money.mp4', sound: '/sounds/entrance/coins.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'coin', keywords: ['coin', 'flip', '🪙'], video: '/gift-videos/coin.mp4', sound: '/sounds/metal_spin.mp3', fallbackSound: '/sounds/entrance/coins.mp3' },
  { id: 'champagne', keywords: ['champagne', 'bubbly', '🍾', 'toast'], video: '/gift-videos/champagne.mp4', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'pizza', keywords: ['pizza', '🍕'], video: '/gift-videos/pizza.mp4', sound: '/sounds/sushi.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'coffee', keywords: ['coffee', '☕', 'espresso', 'tea'], video: '/gift-videos/coffee.mp4', sound: '/sounds/cupcake.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'beer', keywords: ['beer', '🍺', 'brew', 'pint'], video: '/gift-videos/beer.mp4', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'wine', keywords: ['wine', '🍷', 'red wine'], video: '/gift-videos/wine.mp4', sound: '/sounds/bouquet.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'ice-cream', keywords: ['ice cream', 'icecream', '🍦', 'gelato'], video: '/gift-videos/ice-cream.mp4', sound: '/sounds/icecream.mp3', fallbackSound: '/sounds/cupcake.mp3' },
  { id: 'cake', keywords: ['cake', '🎂', 'cupcake', 'birthday'], video: '/gift-videos/cake.mp4', sound: '/sounds/cupcake.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'bomb', keywords: ['bomb', 'explode', '💣', 'tnt', 'dynamite'], video: '/gift-videos/bomb.mp4', sound: '/sounds/entrance/explosion.mp3', fallbackSound: '/sounds/lighter.mp3' },
  { id: 'trophy', keywords: ['trophy', 'award', '🏆', 'champion'], video: '/gift-videos/trophy.mp4', sound: '/sounds/golden-buzzer.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'star', keywords: ['star', '⭐', 'shooting star', '🌟'], video: '/gift-videos/star.mp4', sound: '/sounds/goldstar.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'skull', keywords: ['skull', '💀', 'death', 'dead'], video: '/gift-videos/skull.mp4', sound: '/sounds/evil_laugh.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'dragon', keywords: ['dragon', '🐉'], video: '/gift-videos/dragon.mp4', sound: '/sounds/troll.mp3', fallbackSound: '/sounds/entrance/explosion.mp3' },
  { id: 'police', keywords: ['police', 'siren', '🚨', 'cop'], video: '/gift-videos/police.mp4', sound: '/sounds/entrance/police_siren.mp3', fallbackSound: '/sounds/entrance/police.mp3' },
  { id: 'music', keywords: ['music', '🎵', 'mic', '🎤', '🎶', 'song'], video: '/gift-videos/music.mp4', sound: '/sounds/scratch.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'camera', keywords: ['camera', '📸', 'flash', 'photo'], video: '/gift-videos/camera.mp4', sound: '/sounds/click.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'rainbow', keywords: ['rainbow', '🌈'], video: '/gift-videos/rainbow.mp4', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'snow', keywords: ['snow', '❄', 'ice', 'frost', 'winter'], video: '/gift-videos/snow.mp4', sound: '/sounds/wand.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'ocean', keywords: ['ocean', 'wave', '🌊', 'tsunami', 'sea'], video: '/gift-videos/ocean.mp4', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'tornado', keywords: ['tornado', '🌪', 'storm', 'cyclone'], video: '/gift-videos/tornado.mp4', sound: '/sounds/entrance/engine.mp3', fallbackSound: '/sounds/truck.mp3' },
  { id: 'volcano', keywords: ['volcano', '🌋', 'lava', 'eruption'], video: '/gift-videos/volcano.mp4', sound: '/sounds/entrance/explosion.mp3', fallbackSound: '/sounds/lighter.mp3' },
  { id: 'ghost', keywords: ['ghost', '👻', 'haunt', 'spook'], video: '/gift-videos/ghost.mp4', sound: '/sounds/entrance/curtain-open.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'balloon', keywords: ['balloon', '🎈', 'party'], video: '/gift-videos/balloon.mp4', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'gift-box', keywords: ['gift', 'present', '🎁', 'box', 'mystery'], video: '/gift-videos/gift-box.mp4', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'ring', keywords: ['ring', '💍', 'wedding', 'engagement'], video: '/gift-videos/ring.mp4', sound: '/sounds/diamond.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'like', keywords: ['like', '👍', 'thumb', 'neon like'], video: '/gift-videos/like.mp4', sound: '/sounds/click.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'clap', keywords: ['clap', 'applause', '👏', 'hands'], video: '/gift-videos/clap.mp4', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'hammer', keywords: ['hammer', '🔨', 'smash'], video: '/gift-videos/hammer.mp4', sound: '/sounds/tool.mp3', fallbackSound: '/sounds/entrance/explosion.mp3' },
  { id: 'sword', keywords: ['sword', '🗡', '⚔', 'blade', 'katana'], video: '/gift-videos/sword.mp4', sound: '/sounds/scratch.mp3', fallbackSound: '/sounds/tool.mp3' },
  { id: 'house', keywords: ['house', '🏠', 'mansion', 'villa'], video: '/gift-videos/house.mp4', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'castle', keywords: ['castle', '🏰', 'palace', 'fortress'], video: '/gift-videos/castle.mp4', sound: '/sounds/entrance/royal_fanfare.mp3', fallbackSound: '/sounds/crown.mp3' },
  { id: 'helicopter', keywords: ['helicopter', '🚁', 'chopper'], video: '/gift-videos/helicopter.mp4', sound: '/sounds/entrance/engine.mp3', fallbackSound: '/sounds/truck.mp3' },
  { id: 'plane', keywords: ['plane', '✈', 'airplane', 'jet'], video: '/gift-videos/plane.mp4', sound: '/sounds/entrance/engine.mp3', fallbackSound: '/sounds/truck.mp3' },
  { id: 'motorcycle', keywords: ['motorcycle', 'bike', '🏍'], video: '/gift-videos/motorcycle.mp4', sound: '/sounds/motorcycle.mp3', fallbackSound: '/sounds/supercar.mp3' },
  { id: 'truck', keywords: ['truck', '🚛', 'lorry'], video: '/gift-videos/truck.mp4', sound: '/sounds/truck.mp3', fallbackSound: '/sounds/suv.mp3' },
  { id: 'boat', keywords: ['boat', 'ship', '⛵', 'yacht'], video: '/gift-videos/boat.mp4', sound: '/sounds/entrance/engine.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'train', keywords: ['train', '🚂', 'locomotive'], video: '/gift-videos/train.mp4', sound: '/sounds/entrance/engine.mp3', fallbackSound: '/sounds/truck.mp3' },
  { id: 'bear', keywords: ['bear', '🧸', 'teddy'], video: '/gift-videos/bear.mp4', sound: '/sounds/bear.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'blunt', keywords: ['blunt', 'cigarette', 'smoke', 'vape', '🚬', 'weed'], video: '/gift-videos/blunt.mp4', sound: '/sounds/blunt.mp3', fallbackSound: '/sounds/lighter.mp3' },
  { id: 'sushi', keywords: ['sushi', 'food', '🍣', 'meal'], video: '/gift-videos/sushi.mp4', sound: '/sounds/sushi.mp3', fallbackSound: '/sounds/cupcake.mp3' },
  { id: 'laugh', keywords: ['laugh', '😂', 'haha', 'funny', 'lol'], video: '/gift-videos/laugh.mp4', sound: '/sounds/evil_laugh.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'cry', keywords: ['cry', '😢', 'tear', 'sad', '😭'], video: '/gift-videos/cry.mp4', sound: '/sounds/click.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'angry', keywords: ['angry', '😤', 'rage', 'mad', '😡'], video: '/gift-videos/angry.mp4', sound: '/sounds/troll.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'cool', keywords: ['cool', '😎', 'sunglasses', 'swag'], video: '/gift-videos/cool.mp4', sound: '/sounds/click.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'spark', keywords: ['spark', '⚡', 'electric', 'zap', 'lightning'], video: '/gift-videos/spark.mp4', sound: '/sounds/entrance/lightning.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'slot', keywords: ['slot', '🎰', 'jackpot', 'casino'], video: '/gift-videos/slot.mp4', sound: '/sounds/metal_spin.mp3', fallbackSound: '/sounds/golden-buzzer.mp3' },
  { id: 'game', keywords: ['game', '🎮', 'controller', 'gaming'], video: '/gift-videos/game.mp4', sound: '/sounds/click.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'wand', keywords: ['wand', '🪄', 'magic', 'spell'], video: '/gift-videos/wand.mp4', sound: '/sounds/wand.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'supercar', keywords: ['supercar', 'sports car', '🏎️'], video: '/gift-videos/supercar.mp4', sound: '/sounds/supercar.mp3', fallbackSound: '/sounds/car.mp3' },
  { id: 'troll', keywords: ['troll', '🧌'], video: '/gift-videos/troll.mp4', sound: '/sounds/troll.mp3', fallbackSound: '/sounds/evil_laugh.mp3' },
  { id: 'shield', keywords: ['shield', '🛡', 'armor', 'defense'], video: '/gift-videos/shield.mp4', sound: '/sounds/tool.mp3', fallbackSound: '/sounds/click.mp3' },
];

/**
 * Find the video/sound entry for a gift by name and icon
 */
export function findGiftVideo(name: string, icon: string): GiftVideoEntry | null {
  const search = `${name} ${icon}`.toLowerCase().replace(/[_-]/g, ' ');
  for (const entry of GIFT_VIDEO_MAP) {
    for (const kw of entry.keywords) {
      if (search.includes(kw)) return entry;
    }
  }
  return null;
}

/**
 * Play a sound file
 */
export function playSound(src: string): HTMLAudioElement | null {
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
 * Preload all sounds
 */
export function preloadAllSounds(): void {
  const allSounds = new Set<string>();
  GIFT_VIDEO_MAP.forEach(e => { allSounds.add(e.sound); allSounds.add(e.fallbackSound); });
  allSounds.forEach(src => {
    try {
      const a = new Audio(src);
      a.preload = 'auto';
      a.load();
    } catch {}
  });
}
