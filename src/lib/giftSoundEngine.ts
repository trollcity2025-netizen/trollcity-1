// Gift Sound Engine - Handles audio playback for gift events

export type GiftTier = 'common' | 'rare' | 'epic' | 'legendary';

const TIER_THRESHOLDS = {
  common: 0,
  rare: 500,
  epic: 2500,
  legendary: 10000,
};

export function getGiftTier(cost: number): GiftTier {
  if (cost >= TIER_THRESHOLDS.legendary) return 'legendary';
  if (cost >= TIER_THRESHOLDS.epic) return 'epic';
  if (cost >= TIER_THRESHOLDS.rare) return 'rare';
  return 'common';
}

const GIFT_SOUNDS: Record<GiftTier, string> = {
  common: '/sounds/gifts/common.mp3',
  rare: '/sounds/gifts/rare.mp3',
  epic: '/sounds/gifts/epic.mp3',
  legendary: '/sounds/gifts/legendary.mp3',
};

const DEFAULT_VOLUME = 0.7;

// Cache for audio elements to avoid recreating them
const audioCache: Map<string, HTMLAudioElement> = new Map();

function getOrCreateAudio(src: string): HTMLAudioElement {
  const cached = audioCache.get(src);
  if (cached) {
    return cached;
  }
  
  const audio = new Audio(src);
  audio.preload = 'auto';
  audioCache.set(src, audio);
  return audio;
}

export async function playGiftSound(tier: GiftTier): Promise<void> {
  const soundSrc = GIFT_SOUNDS[tier];
  
  if (!soundSrc) {
    console.warn(`[GiftSoundEngine] No sound for tier: ${tier}`);
    return;
  }

  try {
    const audio = getOrCreateAudio(soundSrc);
    
    // Clone the audio to allow overlapping sounds
    const soundClone = audio.cloneNode() as HTMLAudioElement;
    soundClone.volume = DEFAULT_VOLUME;
    
    // Attempt to play - may fail if autoplay is blocked
    // In that case, we just silently fail (no crash)
    try {
      await soundClone.play();
    } catch (playError) {
      // Autoplay blocked - silently ignore
      console.log('[GiftSoundEngine] Autoplay blocked, skipping sound');
    }
  } catch (error) {
    console.warn('[GiftSoundEngine] Error playing sound:', error);
    // Don't crash - just log the error
  }
}

// Preload all gift sounds on app initialization
export function preloadGiftSounds(): void {
  Object.values(GIFT_SOUNDS).forEach((src) => {
    const audio = getOrCreateAudio(src);
    audio.load(); // Start loading
  });
}
