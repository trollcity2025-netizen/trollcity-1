import React, { useState, useEffect } from 'react';
import { Users, AlertTriangle, Info, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface FamilyMinorSettingsProps {
  profile: {
    has_children?: boolean;
    minor_allowed_on_stream?: boolean;
    minor_violation_count?: number;
    minor_last_violation?: string;
  };
  onUpdate: (updates: Partial<FamilyMinorSettingsProps['profile']>) => void;
}

/**
 * Family & Minor Settings Section for Profile Settings
 */
export const FamilyMinorSettings: React.FC<FamilyMinorSettingsProps> = ({
  profile,
  onUpdate,
}) => {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [localState, setLocalState] = useState({
    has_children: profile?.has_children || false,
    minor_allowed_on_stream: profile?.minor_allowed_on_stream || false,
  });

  // Update local state when profile changes
  useEffect(() => {
    setLocalState({
      has_children: profile?.has_children || false,
      minor_allowed_on_stream: profile?.minor_allowed_on_stream || false,
    });
  }, [profile]);

  const handleToggle = async (field: 'has_children' | 'minor_allowed_on_stream') => {
    if (!user) return;
    
    setIsLoading(true);
    const newValue = !localState[field];
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ [field]: newValue })
        .eq('id', user.id);
      
      if (error) throw error;
      
      setLocalState(prev => ({ ...prev, [field]: newValue }));
      onUpdate({ [field]: newValue });
      
      toast.success(
        field === 'minor_allowed_on_stream'
          ? newValue
            ? 'Minor supervision indicator enabled'
            : 'Minor supervision indicator disabled'
          : 'Family settings updated'
      );
    } catch (err) {
      toast.error('Failed to update settings');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const violationCount = profile?.minor_violation_count || 0;
  const hasViolations = violationCount > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-zinc-800">
        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
          <Users className="text-purple-400" size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Family & Minor Settings</h3>
          <p className="text-sm text-zinc-500">Manage minor supervision preferences</p>
        </div>
      </div>

      {/* Violation Warning (if any) */}
      {hasViolations && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-red-400 font-bold text-sm">Minor Supervision Violations</p>
              <p className="text-zinc-400 text-xs mt-1">
                You have {violationCount} violation{violationCount !== 1 ? 's' : ''} on record.
                {profile?.minor_last_violation && (
                  <> Last violation: {new Date(profile.minor_last_violation).toLocaleDateString()}</>
                )}
              </p>
              {violationCount >= 2 && (
                <p className="text-red-400/80 text-xs mt-2">
                  Further violations may result in broadcast restrictions or Troll Jail.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="space-y-4">
        {/* Minor Allowed on Stream Toggle */}
        <div className={cn(
          'bg-zinc-900 rounded-xl p-5 border transition-colors',
          localState.minor_allowed_on_stream
            ? 'border-yellow-400/50 bg-yellow-400/5'
            : 'border-zinc-800'
        )}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Shield className={cn(
                  'size-5',
                  localState.minor_allowed_on_stream ? 'text-yellow-400' : 'text-zinc-500'
                )} />
                <h4 className="font-bold text-white">
                  I may have minors (children) appear on my livestream
                </h4>
              </div>
              
              {localState.minor_allowed_on_stream && (
                <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    <span className="text-yellow-400 font-bold">Important:</span> Minors may only appear 
                    while the adult account holder is present and supervising.
                  </p>
                  <p className="text-xs text-red-400/80 mt-2 leading-relaxed">
                    Leaving a minor alone on stream may result in:
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-red-400/60">
                    <li>• Broadcast termination</li>
                    <li>• Court summons</li>
                    <li>• Troll Jail penalties</li>
                    <li>• Account suspension</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Toggle Switch */}
            <button
              onClick={() => handleToggle('minor_allowed_on_stream')}
              disabled={isLoading}
              className={cn(
                'relative w-14 h-8 rounded-full transition-colors duration-300',
                localState.minor_allowed_on_stream
                  ? 'bg-yellow-400'
                  : 'bg-zinc-700',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-6 h-6 rounded-full bg-white transition-transform duration-300',
                  localState.minor_allowed_on_stream
                    ? 'translate-x-7'
                    : 'translate-x-1'
                )}
              />
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="flex items-start gap-3 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
          <Info className="text-zinc-500 shrink-0 mt-0.5" size={16} />
          <p className="text-xs text-zinc-500 leading-relaxed">
            When enabled, a <span className="text-yellow-400">👨‍👩‍👧 Kids Present</span> badge will be 
            displayed during your broadcasts to inform viewers that minors may be present. 
            This helps maintain a safe environment and ensures compliance with platform policies.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FamilyMinorSettings;