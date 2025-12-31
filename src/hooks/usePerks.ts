import { useState, useEffect } from 'react';
import { isPerkActive, getActivePerks, purchasePerk, canAffordPerk, type PerkKey } from '../lib/perkSystem';
import { useAuthStore } from '../lib/store';

/**
 * Hook to check if a specific perk is active for the current user
 */
export function usePerkStatus(perkKey: PerkKey) {
  const { user } = useAuthStore();
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setIsActive(false);
      setLoading(false);
      return;
    }

    const checkStatus = async () => {
      setLoading(true);
      try {
        const active = await isPerkActive(user.id, perkKey);
        setIsActive(active);
      } catch (err) {
        console.error('Error checking perk status:', err);
        setIsActive(false);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();

    // Check every minute for perk expiration
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, [user?.id, perkKey]);

  return { isActive, loading };
}

/**
 * Hook to get all active perks for the current user
 */
export function useActivePerks() {
  const { user } = useAuthStore();
  const [activePerks, setActivePerks] = useState<Array<{perk_id: PerkKey, expires_at: string}>>([]);
  const [loading, setLoading] = useState(true);

  const refreshPerks = async () => {
    if (!user?.id) {
      setActivePerks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const perks = await getActivePerks(user.id);
      setActivePerks(perks);
    } catch (err) {
      console.error('Error fetching active perks:', err);
      setActivePerks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshPerks();

    // Refresh every minute to check for expirations
    const interval = setInterval(refreshPerks, 60000);
    return () => clearInterval(interval);
  }, [user?.id]);

  return { activePerks, loading, refreshPerks };
}

/**
 * Hook to purchase a perk
 */
export function usePerkPurchase() {
  const { user } = useAuthStore();
  const [purchasing, setPurchasing] = useState(false);

  const purchase = async (perkKey: PerkKey, customOptions?: { glowColor?: string }) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    setPurchasing(true);
    try {
      const result = await purchasePerk(user.id, perkKey, customOptions);
      return result;
    } finally {
      setPurchasing(false);
    }
  };

  return { purchase, purchasing };
}

/**
 * Hook to check if user can afford a perk
 */
export function useCanAffordPerk(perkKey: PerkKey) {
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
        const affordable = await canAffordPerk(user.id, perkKey);
        setCanAfford(affordable);
      } catch (err) {
        console.error('Error checking affordability:', err);
        setCanAfford(false);
      } finally {
        setLoading(false);
      }
    };

    checkAffordability();
  }, [user?.id, perkKey]);

  return { canAfford, loading };
}