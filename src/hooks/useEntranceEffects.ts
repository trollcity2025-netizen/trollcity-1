import { useState, useEffect } from 'react';
import {
  userOwnsEntranceEffect,
  getUserOwnedEffects,
  getUserActiveEffect,
  purchaseEntranceEffect,
  setActiveEntranceEffect,
  canAffordEntranceEffect,
  type EntranceEffectKey
} from '../lib/entranceEffects';
import { useAuthStore } from '../lib/store';

/**
 * Hook to check if user owns a specific entrance effect
 */
export function useEntranceEffectOwnership(effectKey: EntranceEffectKey) {
  const { user } = useAuthStore();
  const [owns, setOwns] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setOwns(false);
      setLoading(false);
      return;
    }

    const checkOwnership = async () => {
      setLoading(true);
      try {
        const ownership = await userOwnsEntranceEffect(user.id, effectKey);
        setOwns(ownership);
      } catch (err) {
        console.error('Error checking effect ownership:', err);
        setOwns(false);
      } finally {
        setLoading(false);
      }
    };

    checkOwnership();
  }, [user?.id, effectKey]);

  return { owns, loading };
}

/**
 * Hook to get all entrance effects owned by the user
 */
export function useOwnedEntranceEffects() {
  const { user } = useAuthStore();
  const [ownedEffects, setOwnedEffects] = useState<EntranceEffectKey[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshOwnedEffects = async () => {
    if (!user?.id) {
      setOwnedEffects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const effects = await getUserOwnedEffects(user.id);
      setOwnedEffects(effects);
    } catch (err) {
      console.error('Error fetching owned effects:', err);
      setOwnedEffects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshOwnedEffects();
  }, [user?.id]);

  return { ownedEffects, loading, refreshOwnedEffects };
}

/**
 * Hook to get user's active entrance effect
 */
export function useActiveEntranceEffect() {
  const { user } = useAuthStore();
  const [activeEffect, setActiveEffect] = useState<EntranceEffectKey | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshActiveEffect = async () => {
    if (!user?.id) {
      setActiveEffect(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const effect = await getUserActiveEffect(user.id);
      setActiveEffect(effect);
    } catch (err) {
      console.error('Error fetching active effect:', err);
      setActiveEffect(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshActiveEffect();
  }, [user?.id]);

  return { activeEffect, loading, refreshActiveEffect };
}

/**
 * Hook to purchase entrance effects
 */
export function useEntranceEffectPurchase() {
  const { user } = useAuthStore();
  const [purchasing, setPurchasing] = useState(false);

  const purchase = async (effectKey: EntranceEffectKey) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    setPurchasing(true);
    try {
      const result = await purchaseEntranceEffect(user.id, effectKey);
      return result;
    } finally {
      setPurchasing(false);
    }
  };

  return { purchase, purchasing };
}

/**
 * Hook to set active entrance effect
 */
export function useSetActiveEntranceEffect() {
  const { user } = useAuthStore();
  const [setting, setSetting] = useState(false);

  const setActive = async (effectKey: EntranceEffectKey | null) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    setSetting(true);
    try {
      const result = await setActiveEntranceEffect(user.id, effectKey);
      return result;
    } finally {
      setSetting(false);
    }
  };

  return { setActive, setting };
}

/**
 * Hook to check if user can afford an entrance effect
 */
export function useCanAffordEntranceEffect(effectKey: EntranceEffectKey) {
  const { user } = useAuthStore();
  const [canAfford, setCanAfford] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setCanAfford(false);
      setLoading(false);
      return;
    }

    const checkAffordability = async () => {
      setLoading(true);
      try {
        const affordable = await canAffordEntranceEffect(user.id, effectKey);
        setCanAfford(affordable);
      } catch (err) {
        console.error('Error checking affordability:', err);
        setCanAfford(false);
      } finally {
        setLoading(false);
      }
    };

    checkAffordability();
  }, [user?.id, effectKey]);

  return { canAfford, loading };
}