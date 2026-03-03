/**
 * useTCNNRoles Hook
 * 
 * Custom hook for checking TCNN role permissions
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface UseTCNNRolesReturn {
  isJournalist: boolean;
  isNewsCaster: boolean;
  isChiefNewsCaster: boolean;
  hasAnyRole: boolean;
  canPublish: boolean;
  canApproveArticles: boolean;
  canApproveTickers: boolean;
  canManageRoles: boolean;
  loading: boolean;
  error: string | null;
}

export function useTCNNRoles(userId: string | undefined): UseTCNNRolesReturn {
  const [roles, setRoles] = useState({
    isJournalist: false,
    isNewsCaster: false,
    isChiefNewsCaster: false,
    isAdmin: false,
    isSuperAdmin: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkRoles = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check user profile for TCNN roles
      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select('is_journalist, is_news_caster, is_chief_news_caster, role, is_admin, is_super_admin')
        .eq('id', userId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching TCNN roles:', fetchError);
        setError(fetchError.message);
        return;
      }

      if (data) {
        setRoles({
          isJournalist: data.is_journalist || false,
          isNewsCaster: data.is_news_caster || false,
          isChiefNewsCaster: data.is_chief_news_caster || false,
          isAdmin: data.role === 'admin' || data.is_admin || false,
          isSuperAdmin: data.is_super_admin || false,
        });
      }
    } catch (err: any) {
      console.error('Error in useTCNNRoles:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    checkRoles();
  }, [checkRoles]);

  const isJournalist = roles.isJournalist || roles.isNewsCaster || roles.isChiefNewsCaster || roles.isAdmin || roles.isSuperAdmin;
  const isNewsCaster = roles.isNewsCaster || roles.isChiefNewsCaster || roles.isAdmin || roles.isSuperAdmin;
  const isChiefNewsCaster = roles.isChiefNewsCaster || roles.isAdmin || roles.isSuperAdmin;
  const hasAnyRole = isJournalist || isNewsCaster || isChiefNewsCaster;

  return {
    isJournalist,
    isNewsCaster,
    isChiefNewsCaster,
    hasAnyRole,
    canPublish: isNewsCaster || isChiefNewsCaster,
    canApproveArticles: isChiefNewsCaster,
    canApproveTickers: isChiefNewsCaster,
    canManageRoles: isChiefNewsCaster,
    loading,
    error,
  };
}

export default useTCNNRoles;
