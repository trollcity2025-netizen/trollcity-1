import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';

interface AppSetting {
  setting_key: string;
  setting_value: any;
  description: string;
  updated_at: string;
}

const SystemConfig: React.FC = () => {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_app_settings')
        .select('*')
        .order('setting_key');

      if (error) throw error;
      setSettings(data || []);
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (key: string, newValue: any) => {
    setSaving(key);
    try {
      // Parse if string is passed (from textarea)
      let parsedValue = newValue;
      if (typeof newValue === 'string') {
        try {
          parsedValue = JSON.parse(newValue);
        } catch {
          // Keep as string if not valid JSON, or throw error depending on strictness
          // But for now, we assume admin knows what they are doing or we provide specific UI
          // If the original value was an object, we must parse.
          // Let's rely on specific handlers for specific keys if possible.
        }
      }

      const { error } = await supabase
        .from('admin_app_settings')
        .update({ 
          setting_value: parsedValue,
          updated_at: new Date().toISOString(),
          updated_by: user?.id 
        })
        .eq('setting_key', key);

      if (error) throw error;
      
      // Refresh local state to confirm
      await fetchSettings();
    } catch (err: any) {
      console.error('Error updating setting:', err);
      setError(`Failed to update ${key}: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  const renderSettingInput = (setting: AppSetting) => {
    const { setting_key, setting_value } = setting;

    // Special handling for Global Announcement
    if (setting_key === 'global_announcement') {
      const isActive = setting_value?.active || false;
      const message = setting_value?.message || '';
      const type = setting_value?.type || 'info';

      return (
        <div className="space-y-2">
           <div className="flex items-center gap-2">
            <label className="switch">
              <input 
                type="checkbox" 
                checked={isActive}
                onChange={(e) => handleUpdate(setting_key, { ...setting_value, active: e.target.checked })}
              />
              <span className="slider round"></span>
            </label>
            <span>{isActive ? 'Announcement Active' : 'Announcement Inactive'}</span>
          </div>
          <input
            type="text"
            className="w-full bg-black/40 border border-purple-500/30 rounded px-3 py-2 text-white"
            defaultValue={message}
            onBlur={(e) => handleUpdate(setting_key, { ...setting_value, message: e.target.value })}
            placeholder="Announcement text..."
          />
           <select 
             className="bg-black/40 border border-purple-500/30 rounded px-2 py-1"
             value={type}
             onChange={(e) => handleUpdate(setting_key, { ...setting_value, type: e.target.value })}
           >
             <option value="info">Info (Blue)</option>
             <option value="warning">Warning (Yellow)</option>
             <option value="error">Critical (Red)</option>
             <option value="success">Success (Green)</option>
           </select>
        </div>
      );
    }

    // Default JSON editor for everything else
    return (
      <div className="space-y-2">
        <textarea
          className="w-full h-24 bg-black/40 border border-purple-500/30 rounded p-2 font-mono text-xs text-green-300"
          defaultValue={JSON.stringify(setting_value, null, 2)}
          onBlur={(e) => {
            try {
              const val = JSON.parse(e.target.value);
              handleUpdate(setting_key, val);
            } catch {
              alert('Invalid JSON');
            }
          }}
        />
        <p className="text-xs text-gray-500">Edit JSON directly and click outside to save.</p>
      </div>
    );
  };

  if (loading) return <div className="p-8 text-center">Loading configuration...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <span className="text-purple-400">⚙️</span> System Configuration
        </h1>
        
        {error && (
          <div className="bg-red-900/50 border border-red-500 p-4 rounded mb-6 text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {settings.map(setting => (
            <div key={setting.setting_key} className="bg-black/60 border border-purple-600/30 rounded-xl p-6 hover:border-purple-500/50 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-purple-300">{setting.setting_key.replace(/_/g, ' ').toUpperCase()}</h3>
                  <p className="text-sm text-gray-400">{setting.description}</p>
                </div>
                {saving === setting.setting_key && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded animate-pulse">
                    Saving...
                  </span>
                )}
              </div>
              
              <div className="bg-[#0f0f13] rounded p-4 border border-white/5">
                {renderSettingInput(setting)}
              </div>
              
              <div className="mt-2 text-right">
                <span className="text-xs text-gray-600">Last updated: {new Date(setting.updated_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SystemConfig;