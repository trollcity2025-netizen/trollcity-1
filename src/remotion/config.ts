export interface GiftAnimConfig {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  duration: number;
  quality: '4k' | '1080p';
  displayMode: 'fullscreen' | 'target';
}

export function getQuality(cost: number): '4k' | '1080p' {
  return cost >= 2000 ? '4k' : '1080p';
}

export function getDuration(cost: number): number {
  if (cost >= 25000) return 8;
  if (cost >= 10000) return 7;
  if (cost >= 5000) return 6;
  if (cost >= 2000) return 5;
  if (cost >= 1000) return 5;
  if (cost >= 500) return 4;
  if (cost >= 200) return 4;
  return 3;
}

export function getResolution(quality: '4k' | '1080p') {
  return quality === '4k' ? { width: 3840, height: 2160 } : { width: 1920, height: 1080 };
}

export function getFps(): number {
  return 60;
}

export type DisplayMode = 'fullscreen' | 'target';

export function getDisplayMode(hasTargetBox: boolean): DisplayMode {
  return hasTargetBox ? 'target' : 'fullscreen';
}

export const GIFT_ANIMATIONS: GiftAnimConfig[] = [
  { id: 'cookie', name: 'Cookie', emoji: '\uD83C\uDF6A', cost: 100, duration: 3, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'rose', name: 'Rose', emoji: '\uD83C\uDF39', cost: 200, duration: 4, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'ice-cream', name: 'Ice Cream', emoji: '\uD83C\uDF66', cost: 150, duration: 3, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'thumbs-up', name: 'Thumbs Up', emoji: '\uD83D\uDC4D', cost: 100, duration: 3, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'coffee', name: 'Coffee', emoji: '\u2615', cost: 150, duration: 3, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'beer', name: 'Beer', emoji: '\uD83C\uDF7A', cost: 200, duration: 4, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'pizza', name: 'Pizza', emoji: '\uD83C\uDF55', cost: 300, duration: 4, quality: '1080p', displayMode: 'target' },
  { id: 'clap', name: 'Clap', emoji: '\uD83D\uDC4F', cost: 100, duration: 3, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'troll-face', name: 'Troll Face', emoji: '\uD83E\uDDCC', cost: 500, duration: 5, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'poo', name: 'Poo', emoji: '\uD83D\uDCA9', cost: 300, duration: 4, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'clown', name: 'Clown', emoji: '\uD83E\uDD21', cost: 500, duration: 5, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'salt', name: 'Salt', emoji: '\uD83E\uDDC2', cost: 200, duration: 3, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'toilet-paper', name: 'Toilet Paper', emoji: '\uD83E\uDDFB', cost: 200, duration: 3, quality: '1080p', displayMode: 'target' },
  { id: 'peach', name: 'Peach', emoji: '\uD83C\uDF51', cost: 1000, duration: 5, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'eggplant', name: 'Eggplant', emoji: '\uD83C\uDF46', cost: 1000, duration: 5, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'kiss', name: 'Kiss', emoji: '\uD83D\uDC8B', cost: 200, duration: 3, quality: '1080p', displayMode: 'target' },
  { id: 'heart', name: 'Heart', emoji: '\u2764\uFE0F', cost: 100, duration: 3, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'warning', name: 'Warning', emoji: '\u26A0\uFE0F', cost: 500, duration: 4, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'rip', name: 'RIP', emoji: '\uD83D\uDC80', cost: 1000, duration: 5, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'love-letter', name: 'Love Letter', emoji: '\uD83D\uDC8C', cost: 300, duration: 4, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'confetti', name: 'Confetti', emoji: '\uD83C\uDF8A', cost: 500, duration: 5, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'fire', name: 'Fire', emoji: '\uD83D\uDD25', cost: 1000, duration: 5, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'bouquet', name: 'Bouquet', emoji: '\uD83D\uDC90', cost: 200, duration: 3, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'ban-hammer', name: 'Ban Hammer', emoji: '\uD83D\uDD28', cost: 500, duration: 4, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'party', name: 'Party', emoji: '\uD83C\uDF89', cost: 300, duration: 4, quality: '1080p', displayMode: 'fullscreen' },
  { id: '100', name: '100', emoji: '\uD83D\uDCAF', cost: 500, duration: 5, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'flex', name: 'Flex', emoji: '\uD83D\uDCAA', cost: 300, duration: 4, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'teddy-bear', name: 'Teddy Bear', emoji: '\uD83E\uDDF8', cost: 100, duration: 3, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'dumpster-fire', name: 'Dumpster Fire', emoji: '\uD83D\uDDD1\uFE0F\uD83D\uDD25', cost: 500, duration: 4, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'siren', name: 'Siren', emoji: '\uD83D\uDEA8', cost: 500, duration: 5, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'chocolate', name: 'Chocolate', emoji: '\uD83C\uDF6B', cost: 300, duration: 4, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'medal', name: 'Medal', emoji: '\uD83E\uDD47', cost: 500, duration: 4, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'crown', name: 'Crown', emoji: '\uD83D\uDC51', cost: 1000, duration: 5, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'lag-switch', name: 'Lag Switch', emoji: '\uD83D\uDCF6', cost: 300, duration: 3, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'trophy', name: 'Trophy', emoji: '\uD83C\uDFC6', cost: 500, duration: 4, quality: '1080p', displayMode: 'fullscreen' },
  { id: '404-error', name: '404 Error', emoji: '\uD83D\uDEAB', cost: 200, duration: 3, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'ring', name: 'Ring', emoji: '\uD83D\uDC8D', cost: 1000, duration: 5, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'diamond', name: 'Diamond', emoji: '\uD83D\uDC8E', cost: 2500, duration: 5, quality: '4k', displayMode: 'fullscreen' },
  { id: 'cash-stack', name: 'Cash Stack', emoji: '\uD83D\uDCB5', cost: 500, duration: 4, quality: '1080p', displayMode: 'fullscreen' },
  { id: 'rocket', name: 'Rocket', emoji: '\uD83D\uDE80', cost: 2500, duration: 5, quality: '4k', displayMode: 'fullscreen' },
  { id: 'gold-bar', name: 'Gold Bar', emoji: '\uD83E\uDD48', cost: 2500, duration: 5, quality: '4k', displayMode: 'fullscreen' },
  { id: 'rolex', name: 'Rolex', emoji: '\u231A', cost: 5000, duration: 6, quality: '4k', displayMode: 'fullscreen' },
  { id: 'sports-car', name: 'Sports Car', emoji: '\uD83C\uDFCE\uFE0F', cost: 5000, duration: 6, quality: '4k', displayMode: 'fullscreen' },
  { id: 'yacht', name: 'Yacht', emoji: '\uD83D\uDEA2', cost: 5000, duration: 6, quality: '4k', displayMode: 'fullscreen' },
  { id: 'private-jet', name: 'Private Jet', emoji: '\u2708\uFE0F', cost: 10000, duration: 7, quality: '4k', displayMode: 'fullscreen' },
  { id: 'mansion', name: 'Mansion', emoji: '\uD83C\uDFF0', cost: 10000, duration: 7, quality: '4k', displayMode: 'fullscreen' },
  { id: 'dragon', name: 'Dragon', emoji: '\uD83D\uDC09', cost: 10000, duration: 7, quality: '4k', displayMode: 'fullscreen' },
  { id: 'planet', name: 'Planet', emoji: '\uD83E\uDE90', cost: 10000, duration: 7, quality: '4k', displayMode: 'fullscreen' },
  { id: 'unicorn', name: 'Unicorn', emoji: '\uD83E\uDD84', cost: 10000, duration: 7, quality: '4k', displayMode: 'fullscreen' },
  { id: 'phoenix', name: 'Phoenix', emoji: '\uD83D\uDC26\u200D\uD83D\uDD25', cost: 10000, duration: 6, quality: '4k', displayMode: 'fullscreen' },
  { id: 'alien-invasion', name: 'Alien Invasion', emoji: '\uD83D\uDC7D', cost: 25000, duration: 7, quality: '4k', displayMode: 'fullscreen' },
  { id: 'galaxy', name: 'Galaxy', emoji: '\uD83C\uDF0C', cost: 25000, duration: 7, quality: '4k', displayMode: 'fullscreen' },
  { id: 'time-machine', name: 'Time Machine', emoji: '\u23F3', cost: 25000, duration: 7, quality: '4k', displayMode: 'fullscreen' },
  { id: 'black-hole', name: 'Black Hole', emoji: '\u26AB', cost: 50000, duration: 8, quality: '4k', displayMode: 'fullscreen' },
];

export function findGiftConfig(id: string): GiftAnimConfig | undefined {
  return GIFT_ANIMATIONS.find(g => g.id === id);
}

export function findGiftConfigByName(name: string): GiftAnimConfig | undefined {
  const lower = name.toLowerCase().replace(/[_\s-]+/g, '-');
  return GIFT_ANIMATIONS.find(g =>
    g.id === lower || g.name.toLowerCase().replace(/\s+/g, '-') === lower
  );
}
