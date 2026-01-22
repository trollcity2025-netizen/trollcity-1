import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuthStore } from '../store';
import { toast } from 'sonner';

interface BroadcastLockdownSettings {
  enabled: boolean;
  admin_broadcast_room: string | null;
}

export function useBroadcastLockdown() {
  const { profile } = useAuthStore();
  const [settings, setSettings] = useState<BroadcastLockdownSettings>({
    enabled: false,
    admin_broadcast_room: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'broadcast_lockdown_enabled')
          .maybeSingle();

        if (queryError) throw queryError;
        
        if (data?.setting_value) {
          setSettings(data.setting_value);
        }
      } catch (err: any) {
        console.error('Failed to load broadcast lockdown settings:', err);
        setError(err.message);
      }
    };

    loadSettings();

    // Subscribe to changes using realtime
    const subscription = supabase
      .channel('admin_settings_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'admin_settings',
          filter: 'setting_key=eq.broadcast_lockdown_enabled'
        },
        (payload) => {
          if (payload.new?.setting_value) {
            setSettings(payload.new.setting_value);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Update settings (admin only)
  const updateSettings = async (newSettings: BroadcastLockdownSettings) => {
    if (!profile?.is_admin && profile?.role !== 'admin') {
      toast.error('Only admins can change broadcast settings');
      return false;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('admin_settings')
        .update({
          setting_value: newSettings,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'broadcast_lockdown_enabled');

      if (updateError) throw updateError;

      setSettings(newSettings);
      toast.success('Broadcast settings updated');
      return true;
    } catch (err: any) {
      console.error('Failed to update broadcast lockdown settings:', err);
      toast.error('Failed to update settings: ' + err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Check if user can broadcast
  const canBroadcast = (userId: string | undefined): boolean => {
    if (!userId) return false;
    
    const userProfile = useAuthStore.getState().profile;
    const isAdmin = userProfile?.is_admin || userProfile?.role === 'admin';
    
    if (!settings.enabled) {
      // Lockdown disabled, everyone can broadcast
      return true;
    }
    
    // Lockdown enabled, only admin can broadcast
    return isAdmin;
  };

  return {
    settings,
    loading,
    error,
    updateSettings,
    canBroadcast
  };
}
