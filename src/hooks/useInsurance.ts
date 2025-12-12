import { useState, useEffect } from 'react';
import {
  getInsurancePlans,
  getActiveInsurance,
  purchaseInsurance,
  canAffordInsurance,
  formatInsuranceTimeRemaining,
  type InsurancePlan,
  type ActiveInsurance
} from '../lib/insuranceSystem';
import { useAuthStore } from '../lib/store';

/**
 * Hook to get all available insurance plans
 */
export function useInsurancePlans() {
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlans = async () => {
      setLoading(true);
      try {
        const insurancePlans = await getInsurancePlans();
        setPlans(insurancePlans);
      } catch (err) {
        console.error('Error loading insurance plans:', err);
        setPlans([]);
      } finally {
        setLoading(false);
      }
    };

    loadPlans();
  }, []);

  return { plans, loading };
}

/**
 * Hook to get active insurance for current user
 */
export function useActiveInsurance() {
  const { user } = useAuthStore();
  const [activeInsurance, setActiveInsurance] = useState<ActiveInsurance[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshInsurance = async () => {
    if (!user?.id) {
      setActiveInsurance([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const insurance = await getActiveInsurance(user.id);
      setActiveInsurance(insurance);
    } catch (err) {
      console.error('Error loading active insurance:', err);
      setActiveInsurance([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshInsurance();
  }, [user?.id]);

  return { activeInsurance, loading, refreshInsurance };
}

/**
 * Hook to purchase insurance
 */
export function useInsurancePurchase() {
  const { user } = useAuthStore();
  const [purchasing, setPurchasing] = useState(false);

  const purchase = async (planId: string) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    setPurchasing(true);
    try {
      const result = await purchaseInsurance(user.id, planId);
      return result;
    } finally {
      setPurchasing(false);
    }
  };

  return { purchase, purchasing };
}

/**
 * Hook to check if user can afford insurance plan
 */
export function useCanAffordInsurance(planId: string) {
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
        const affordable = await canAffordInsurance(user.id, planId);
        setCanAfford(affordable);
      } catch (err) {
        console.error('Error checking insurance affordability:', err);
        setCanAfford(false);
      } finally {
        setLoading(false);
      }
    };

    checkAffordability();
  }, [user?.id, planId]);

  return { canAfford, loading };
}

/**
 * Hook to check if specific protection is active
 */
export function useProtectionStatus(protectionType: 'bankrupt' | 'kick' | 'full') {
  const { activeInsurance } = useActiveInsurance();

  const hasProtection = activeInsurance.some(insurance =>
    insurance.protection_type === protectionType ||
    insurance.protection_type === 'full'
  );

  const activeProtection = activeInsurance.find(insurance =>
    insurance.protection_type === protectionType ||
    insurance.protection_type === 'full'
  );

  const timeRemaining = activeProtection ?
    formatInsuranceTimeRemaining(activeProtection.expires_at) : '';

  return { hasProtection, timeRemaining, activeProtection };
}