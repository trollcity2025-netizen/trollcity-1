// Purchase and Activation Hooks
// File: src/hooks/usePurchases.ts

import { useState, useCallback, useEffect } from 'react';
import { UserPurchase, UserActiveItem } from '@/types/purchases';
import {
  getUserPurchases,
  getUserActiveItems,
  activateItem,
  deactivateItem,
  createPurchase,
  userOwnsPurchase,
} from '@/lib/purchases';
import { useAuthStore } from '@/lib/store';

export function usePurchases() {
  const { user } = useAuthStore();
  const [purchases, setPurchases] = useState<UserPurchase[]>([]);
  const [activeItems, setActiveItems] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const loadPurchases = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const data = await getUserPurchases(user.id);
      setPurchases(data);

      const active = await getUserActiveItems(user.id);
      setActiveItems(active);
    } catch (err) {
      console.error('Error loading purchases:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  const addPurchase = useCallback(
    async (
      itemType: string,
      itemId: string,
      itemName: string,
      price: number,
      options?: any
    ) => {
      if (!user?.id) return { success: false };

      const result = await createPurchase(
        user.id,
        itemType,
        itemId,
        itemName,
        price,
        options
      );

      if (result.success) {
        await loadPurchases();
      }

      return result;
    },
    [user?.id, loadPurchases]
  );

  const toggleItemActive = useCallback(
    async (itemType: string, itemId: string, isCurrentlyActive: boolean) => {
      if (!user?.id) return { success: false };

      const result = isCurrentlyActive
        ? await deactivateItem(user.id, itemType, itemId)
        : await activateItem(user.id, itemType, itemId);

      if (result.success) {
        await loadPurchases();
      }

      return result;
    },
    [user?.id, loadPurchases]
  );

  const checkOwnership = useCallback(
    async (itemType: string, itemId: string): Promise<boolean> => {
      if (!user?.id) return false;
      return await userOwnsPurchase(user.id, itemType, itemId);
    },
    [user?.id]
  );

  const getPurchasesByType = useCallback(
    (itemType: string): UserPurchase[] => {
      return purchases.filter((p) => p.item_type === itemType);
    },
    [purchases]
  );

  const getActivePurchaseByType = useCallback(
    (itemType: string): UserPurchase | null => {
      return purchases.find((p) => p.item_type === itemType && p.is_active) || null;
    },
    [purchases]
  );

  return {
    purchases,
    activeItems,
    loading,
    loadPurchases,
    addPurchase,
    toggleItemActive,
    checkOwnership,
    getPurchasesByType,
    getActivePurchaseByType,
  };
}

export function useTrollMartInventory() {
  const { user } = useAuthStore();
  const [ownedItems, setOwnedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadInventory = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { getUserTrollMartPurchases } = await import('@/lib/purchases');
      const items = await getUserTrollMartPurchases(user.id);
      setOwnedItems(new Set(items));
    } catch (err) {
      console.error('Error loading Troll Mart inventory:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const isOwned = useCallback(
    (clothingId: string): boolean => {
      return ownedItems.has(clothingId);
    },
    [ownedItems]
  );

  return {
    ownedItems,
    loading,
    loadInventory,
    isOwned,
  };
}
