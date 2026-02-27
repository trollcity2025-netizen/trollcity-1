import { useSyncExternalStore } from 'react';
import { persistentGiftStore } from '../lib/persistentGiftStore';

export function usePersistentGifts() {
  const gifts = useSyncExternalStore(
    persistentGiftStore.subscribe,
    persistentGiftStore.getSnapshot
  );
  return gifts;
}