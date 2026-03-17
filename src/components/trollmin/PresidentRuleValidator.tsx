import React from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, BookOpen } from 'lucide-react';

interface PresidentRule {
  id: string;
  name: string;
  description: string;
  isViolated: boolean;
  severity: 'minor' | 'major' | 'critical';
}

interface PresidentRuleValidatorProps {
  actionType: string;
  targetUserId?: string;
  targetUsername?: string;
  details?: Record<string, any>;
  onValidate: (isValid: boolean, violations: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

// List of President Rules that Trollmin must follow
const PRESIDENT_RULES: Omit<PresidentRule, 'isViolated'>[] = [
  {
    id: 'no_real_admin',
    name: 'Cannot Affect Real Admins',
    description: 'Trollmin cannot ban, mute, or take any action against platform administrators or moderators.',
    severity: 'critical'
  },
  {
    id: 'president_immunity',
    name: 'President Immunity',
    description: 'Trollmin cannot take any action against the President or Vice President without proper authorization.',
    severity: 'critical'
  },
  {
    id: 'no_db_access',
    name: 'No Database Access',
    description: 'Trollmin cannot access or modify database records directly. All actions must go through approved APIs.',
    severity: 'critical'
  },
  {
    id: 'term_limits',
    name: 'Term Limits',
    description: 'Trollmin term is limited to 30 days. Cannot extend term or bypass term limits.',
    severity: 'major'
  },
  {
    id: 'daily_limits',
    name: 'Daily Action Limits',
    description: 'Trollmin must respect daily limits: 3 bans, 5 mutes, 1 event, 2 court overrides per day.',
    severity: 'minor'
  },
  {
    id: 'law_limits',
    name: 'Law Limits',
    description: 'Maximum 3 active city laws at any time. Laws must auto-expire.',
    severity: 'minor'
  },
  {
    id: 'proportional_punishment',
    name: 'Proportional Punishment',
    description: 'Punishments must be proportional to the offense. No excessive or cruel punishments.',
    severity: 'major'
  },
  {
    id: 'no_retaliation',
    name: 'No Retaliation',
    description: 'Trollmin cannot take revenge actions against users who reported or voted against them.',
    severity: 'major'
  },
  {
    id: 'transparent_actions',
    name: 'Transparent Actions',
    description: 'All Trollmin actions must be logged publicly in the activity feed.',
    severity: 'minor'
  },
  {
    id: 'fair_trial',
    name: 'Fair Trial Required',
    description: 'Users must have opportunity to defend themselves before major punishments (ban > 24h).',
    severity: 'major'
  }
];

export function PresidentRuleValidator({ 
  actionType, 
  targetUserId, 
  targetUsername, 
  details,
  onValidate,
  isOpen,
  onClose 
}: PresidentRuleValidatorProps) {
  const [checking, setChecking] = React.useState(false);
  const [violations, setViolations] = React.useState<string[]>([]);

  const validateAction = async () => {
    setChecking(true);
    const newViolations: string[] = [];

    // Check action-specific rules
    switch (actionType) {
      case 'ban':
        if (!targetUsername) {
          newViolations.push('Must specify a username to ban');
        }
        if (details?.duration_hours > 24) {
          newViolations.push('Cannot ban for more than 24 hours without court approval');
        }
        break;
      case 'mute':
        if (!targetUsername) {
          newViolations.push('Must specify a username to mute');
        }
        break;
      case 'law_create':
        if (!details?.title) {
          newViolations.push('Law must have a title');
        }
        break;
      default:
        break;
    }

    setViolations(newViolations);
    onValidate(newViolations.length === 0, newViolations);
    setChecking(false);
  };

  if (!isOpen) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400';
      case 'major': return 'text-yellow-400';
      case 'minor': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-yellow-400" /> President Rule Validation
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Current Action */}
          <div className="p-4 bg-slate-800 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Validating Action</div>
            <div className="font-bold text-white capitalize">{actionType.replace('_', ' ')}</div>
            {targetUsername && (
              <div className="text-sm text-gray-300">Target: {targetUsername}</div>
            )}
          </div>

          {/* Rules List */}
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <BookOpen className="w-4 h-4" />
              President Rules that apply:
            </div>
            <div className="space-y-2">
              {PRESIDENT_RULES.map((rule) => (
                <div 
                  key={rule.id} 
                  className={`p-3 rounded-lg border ${
                    rule.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                    rule.severity === 'major' ? 'border-yellow-500/30 bg-yellow-500/5' :
                    'border-slate-600 bg-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`w-4 h-4 mt-0.5 ${getSeverityColor(rule.severity)}`} />
                    <div>
                      <div className={`font-bold text-sm ${getSeverityColor(rule.severity)}`}>
                        {rule.name}
                      </div>
                      <div className="text-xs text-gray-400">{rule.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Violations Result */}
          {violations.length > 0 && (
            <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-red-400 font-bold mb-2">
                <XCircle className="w-4 h-4" /> Violations Found
              </div>
              <ul className="text-sm text-red-300 space-y-1">
                {violations.map((v, i) => (
                  <li key={i}>• {v}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={validateAction}
              disabled={checking}
              className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg flex items-center justify-center gap-2"
            >
              {checking ? (
                'Checking...'
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" /> Validate Action
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Utility function to validate Trollmin action on backend
export async function validateTrollminAction(
  actionType: string,
  targetUserId: string | null,
  details: Record<string, any>
): Promise<{ valid: boolean; violations: string[] }> {
  const violations: string[] = [];

  // Check for admin users (would be implemented in actual backend)
  // For now, return basic validation
  if (actionType === 'ban' && details?.duration_hours > 24) {
    violations.push('Cannot ban for more than 24 hours');
  }

  if (actionType === 'law_create' && !details?.title) {
    violations.push('Law must have a title');
  }

  return {
    valid: violations.length === 0,
    violations
  };
}
