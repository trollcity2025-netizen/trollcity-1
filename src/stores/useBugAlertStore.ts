/**
 * Bug Alert Store
 * Zustand store for managing bug alerts state
 */

import { create } from 'zustand';
import { BugAlert, BugAlertCreate, BugAlertStats } from '../types/bugAlert';
import { supabase } from '../lib/supabase';

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

interface BugAlertState {
  // State
  alerts: BugAlert[];
  unreadAlerts: BugAlert[];
  activeAlerts: BugAlert[];
  stats: BugAlertStats | null;
  isLoading: boolean;
  error: string | null;
  realtimeSubscription: any | null;
  
  // Actions
  setAlerts: (alerts: BugAlert[]) => void;
  addAlert: (alert: BugAlert) => void;
  updateAlert: (alert: BugAlert) => void;
  removeAlert: (alertId: string) => void;
  markAsRead: (alertId: string) => void;
  markAllAsRead: () => void;
  acknowledgeAlert: (alertId: string) => void;
  resolveAlert: (alertId: string) => void;
  dismissAlert: (alertId: string) => void;
  fetchAlerts: (filters?: { status?: string; limit?: number }) => Promise<void>;
  fetchStats: () => Promise<void>;
  reportBug: (bug: BugAlertCreate) => Promise<BugAlert | null>;
  subscribeToRealtime: (userId: string, isAdmin: boolean) => void;
  unsubscribeFromRealtime: () => void;
  clearError: () => void;
}

export const useBugAlertStore = create<BugAlertState>((set, get) => ({
  // Initial state
  alerts: [],
  unreadAlerts: [],
  activeAlerts: [],
  stats: null,
  isLoading: false,
  error: null,
  realtimeSubscription: null,
  
  // Actions
  setAlerts: (alerts) => {
    const activeAlerts = alerts.filter(a => a.status === 'active');
    const unreadAlerts = alerts.filter(a => a.status === 'active');
    set({ alerts, activeAlerts, unreadAlerts });
  },
  
  addAlert: (alert) => {
    const { alerts, activeAlerts, unreadAlerts } = get();
    const newAlerts = [alert, ...alerts];
    const newActiveAlerts = alert.status === 'active' 
      ? [alert, ...activeAlerts] 
      : activeAlerts;
    const newUnreadAlerts = alert.status === 'active' 
      ? [alert, ...unreadAlerts] 
      : unreadAlerts;
    
    set({ 
      alerts: newAlerts,
      activeAlerts: newActiveAlerts,
      unreadAlerts: newUnreadAlerts,
    });
  },
  
  updateAlert: (alert) => {
    const { alerts, activeAlerts, unreadAlerts } = get();
    const updatedAlerts = alerts.map(a => a.id === alert.id ? alert : a);
    const updatedActiveAlerts = alert.status === 'active'
      ? activeAlerts.map(a => a.id === alert.id ? alert : a)
      : activeAlerts.filter(a => a.id !== alert.id);
    const updatedUnreadAlerts = alert.status === 'active'
      ? unreadAlerts.map(a => a.id === alert.id ? alert : a)
      : unreadAlerts.filter(a => a.id !== alert.id);
    
    set({ 
      alerts: updatedAlerts,
      activeAlerts: updatedActiveAlerts,
      unreadAlerts: updatedUnreadAlerts,
    });
  },
  
  removeAlert: (alertId) => {
    const { alerts, activeAlerts, unreadAlerts } = get();
    set({
      alerts: alerts.filter(a => a.id !== alertId),
      activeAlerts: activeAlerts.filter(a => a.id !== alertId),
      unreadAlerts: unreadAlerts.filter(a => a.id !== alertId),
    });
  },
  
  markAsRead: (alertId) => {
    const { unreadAlerts } = get();
    set({
      unreadAlerts: unreadAlerts.filter(a => a.id !== alertId),
    });
  },
  
  markAllAsRead: () => {
    set({ unreadAlerts: [] });
  },
  
  acknowledgeAlert: async (alertId) => {
    const { updateAlert } = get();
    try {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from('bug_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_by: userId,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId)
        .select()
        .single();
      
      if (error) throw error;
      if (data) updateAlert(data);
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  },
  
  resolveAlert: async (alertId) => {
    const { updateAlert } = get();
    try {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from('bug_alerts')
        .update({
          status: 'resolved',
          resolved_by: userId,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alertId)
        .select()
        .single();
      
      if (error) throw error;
      if (data) updateAlert(data);
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  },
  
  dismissAlert: async (alertId) => {
    const { updateAlert } = get();
    try {
      const { data, error } = await supabase
        .from('bug_alerts')
        .update({ status: 'dismissed' })
        .eq('id', alertId)
        .select()
        .single();
      
      if (error) throw error;
      if (data) updateAlert(data);
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    }
  },
  
  fetchAlerts: async (filters = {}) => {
    set({ isLoading: true, error: null });
    try {
      let query = supabase
        .from('bug_alerts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      if (data) {
        get().setAlerts(data as BugAlert[]);
      }
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchStats: async () => {
    try {
      const { data, error } = await supabase
        .from('bug_alerts')
        .select('status, severity');
      
      if (error) throw error;
      
      if (data) {
        const stats: BugAlertStats = {
          total: data.length,
          critical: data.filter(a => a.severity === 'critical' && a.status === 'active').length,
          high: data.filter(a => a.severity === 'high' && a.status === 'active').length,
          medium: data.filter(a => a.severity === 'medium' && a.status === 'active').length,
          low: data.filter(a => a.severity === 'low' && a.status === 'active').length,
          active: data.filter(a => a.status === 'active').length,
          acknowledged: data.filter(a => a.status === 'acknowledged').length,
          resolved: data.filter(a => a.status === 'resolved').length,
        };
        set({ stats });
      }
    } catch (error) {
      console.error('Failed to fetch bug alert stats:', error);
    }
  },
  
  reportBug: async (bug: BugAlertCreate) => {
    set({ isLoading: true, error: null });
    try {
      // Try to use the Edge Function first
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Check if Edge Function is available
      if (supabaseUrl && supabaseAnonKey) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/report-bug`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: JSON.stringify({
              title: bug.title,
              description: bug.description,
              severity: bug.severity,
              category: bug.category,
              error_message: bug.error_message,
              stack_trace: bug.stack_trace,
              affected_components: bug.affected_components,
              metadata: bug.metadata,
              user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
              page_url: typeof window !== 'undefined' ? window.location.href : undefined,
            }),
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('[BugAlert] Bug reported via Edge Function:', result.bug_alert_id);
            set({ isLoading: false });
            return { id: result.bug_alert_id } as BugAlert;
          }
        } catch (edgeError) {
          console.warn('[BugAlert] Edge Function unavailable, falling back to direct insert:', edgeError);
        }
      }
      
      // Fallback to direct table insert
      const { data, error } = await supabase
        .from('bug_alerts')
        .insert({
          title: bug.title,
          description: bug.description,
          severity: bug.severity,
          category: bug.category,
          error_message: bug.error_message,
          stack_trace: bug.stack_trace,
          affected_components: bug.affected_components || [],
          metadata: bug.metadata || {},
          status: 'active',
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          page_url: typeof window !== 'undefined' ? window.location.href : undefined,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      if (data) {
        get().addAlert(data as BugAlert);
      }
      
      set({ isLoading: false });
      return data as BugAlert | null;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      console.error('Failed to report bug:', error);
      return null;
    }
  },
  
  subscribeToRealtime: (userId: string, isAdmin: boolean) => {
    if (!isAdmin) return;
    
    const { addAlert, updateAlert } = get();
    
    // Only subscribe to active bug alerts for admins
    const subscription = supabase
      .channel('bug-alerts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bug_alerts',
          filter: `status=eq.active`,
        },
        (payload) => {
          console.log('[BugAlert] New bug alert received:', payload);
          addAlert(payload.new as BugAlert);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bug_alerts',
        },
        (payload) => {
          console.log('[BugAlert] Bug alert updated:', payload);
          updateAlert(payload.new as BugAlert);
        }
      )
      .subscribe();
    
    set({ realtimeSubscription: subscription });
  },
  
  unsubscribeFromRealtime: () => {
    const { realtimeSubscription } = get();
    if (realtimeSubscription) {
      supabase.removeChannel(realtimeSubscription);
      set({ realtimeSubscription: null });
    }
  },
  
  clearError: () => set({ error: null }),
}));
