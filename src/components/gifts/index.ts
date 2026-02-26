// Gift System - Main Exports

// Types
export * from '@/types/gifts';

// Store
export { useGiftStore, useGiftById, useGiftsByRarity } from '@/lib/stores/useGiftStore';

// Functions
export { sendGift, fetchGiftCatalog, hasEnoughCoins, getCoinBalance } from '@/lib/gifts/sendGift';

// Components
export { default as GlobalGiftRenderer } from './GlobalGiftRenderer';
export { default as GiftModel } from './GiftModel';
export { default as SendGiftButton } from './SendGiftButton';
