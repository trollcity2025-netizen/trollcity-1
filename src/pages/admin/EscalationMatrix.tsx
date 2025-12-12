import React, { useState, useEffect } from 'react';
import { AlertTriangle, Edit, Plus, Trash2, Save, X, Shield, Gavel } from 'lucide-react';
import { supabase, UserRole } from '../../lib/supabase';
import RequireRole from '../../components/RequireRole';

interface EscalationRule {
  id: string;
  violation_type: string;
  severity_level: number;
  violation_count_threshold: number;
  time_window_days: number;
  consequence_type: string;
  consequence_duration_minutes: number | null;
  court_required: boolean;
  auto_escalate: boolean;
  points_deducted: number;
  is_active: boolean;
}

interface CourtRuling {
  id: string;
  case_type: string;
  severity_level: number;
  ruling: string;
  consequence_applied: string;
  duration_applied: string;
  reasoning_summary: string;
  precedent_citation: string;
  is_public: boolean;
  created_at: string;
}

export default function EscalationMatrix() {
  const [activeTab, setActiveTab] = useState('matrix');
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [rulings, setRulings] = useState<CourtRuling[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<EscalationRule | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);

      if (activeTab === 'matrix') {
        const { data } = await supabase
          .from('escalation_matrix')
          .select('*')
          .order('violation_type', { ascending: true });

        setRules(data || []);
      } else if (activeTab === 'rulings') {
        const { data } = await supabase
          .from('court_rulings_archive')
          .select('*')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(100);

        setRulings(data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveRule = async (rule: EscalationRule) => {
    try {
      if (editingRule) {
        const { error } = await supabase
          .from('escalation_matrix')
          .update({
            violation_type: rule.violation_type,
            severity_level: rule.severity_level,
            violation_count_threshold: rule.violation_count_threshold,
            time_window_days: rule.time_window_days,
            consequence_type: rule.consequence_type,
            consequence_duration_minutes: rule.consequence_duration_minutes,
            court_required: rule.court_required,
            auto_escalate: rule.auto_escalate,
            points_deducted: rule.points_deducted,
            is_active: rule.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', rule.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('escalation_matrix')
          .insert([{
            violation_type: rule.violation_type,
            severity_level: rule.severity_level,
            violation_count_threshold: rule.violation_count_threshold,
            time_window_days: rule.time_window_days,
            consequence_type: rule.consequence_type,
            consequence_duration_minutes: rule.consequence_duration_minutes,
            court_required: rule.court_required,
            auto_escalate: rule.auto_escalate,
            points_deducted: rule.points_deducted,
            is_active: rule.is_active
          }]);

        if (error) throw error;
      }

      await loadData();
      setEditingRule(null);
      setShowAddModal(false);
    } catch (error) {
      console.error('Error saving rule:', error);
      alert('Error saving rule. Please try again.');
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this escalation rule?')) return;

    try {
      const { error } = await supabase
        .from('escalation_matrix')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Error deleting rule. Please try again.');
    }
  };

  const getConsequenceColor = (consequence: string) => {
    switch (consequence) {
      case 'warning': return 'text-yellow-400 bg-yellow-900/20';
      case 'timeout': return 'text-orange-400 bg-orange-900/20';
      case 'ban': return 'text-red-400 bg-red-900/20';
      case 'court_session': return 'text-purple-400 bg-purple-900/20';
      case 'permanent_ban': return 'text-red-600 bg-red-900/40';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  const getRulingColor = (ruling: string) => {
    switch (ruling) {
      case 'guilty': return 'text-red-400 bg-red-900/20';
      case 'not_guilty': return 'text-green-400 bg-green-900/20';
      case 'dismissed': return 'text-blue-400 bg-blue-900/20';
      case 'appeal_granted': return 'text-purple-400 bg-purple-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'Permanent';
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="animate-pulse">Loading escalation matrix...</div>
      </div>
    );
  }

  return (
    <RequireRole roles={UserRole.ADMIN}>
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6 pt-16 lg:pt-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Law & Order System</h1>
              <p className="text-gray-400">Escalation matrix and court rulings management</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-zinc-800 p-1 rounded-lg">
            {[
              { id: 'matrix', name: 'Escalation Matrix', icon: AlertTriangle },
              { id: 'rulings', name: 'Court Rulings Archive', icon: Gavel }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-red-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-zinc-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.name}
              </button>
            ))}
          </div>

          {/* Content */}
          {activeTab === 'matrix' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Escalation Matrix</h2>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Rule
                </button>
              </div>

              <div className="bg-zinc-900/50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="px-4 py-3 text-left">Violation Type</th>
                      <th className="px-4 py-3 text-left">Severity</th>
                      <th className="px-4 py-3 text-left">Threshold</th>
                      <th className="px-4 py-3 text-left">Time Window</th>
                      <th className="px-4 py-3 text-left">Consequence</th>
                      <th className="px-4 py-3 text-left">Duration</th>
                      <th className="px-4 py-3 text-left">Court Required</th>
                      <th className="px-4 py-3 text-left">Auto Apply</th>
                      <th className="px-4 py-3 text-left">Points</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => (
                      <tr key={rule.id} className="border-t border-zinc-700">
                        <td className="px-4 py-3 capitalize">{rule.violation_type.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            rule.severity_level >= 4 ? 'bg-red-600' :
                            rule.severity_level >= 2 ? 'bg-orange-600' : 'bg-yellow-600'
                          }`}>
                            Level {rule.severity_level}
                          </span>
                        </td>
                        <td className="px-4 py-3">{rule.violation_count_threshold}</td>
                        <td className="px-4 py-3">
                          {rule.time_window_days === 0 ? 'All time' : `${rule.time_window_days} days`}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs capitalize ${getConsequenceColor(rule.consequence_type)}`}>
                            {rule.consequence_type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">{formatDuration(rule.consequence_duration_minutes)}</td>
                        <td className="px-4 py-3">
                          {rule.court_required ? (
                            <span className="text-purple-400">Yes</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {rule.auto_escalate ? (
                            <span className="text-green-400">Yes</span>
                          ) : (
                            <span className="text-yellow-400">Review</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-red-400">-{rule.points_deducted}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingRule(rule)}
                              className="p-1 bg-blue-600 hover:bg-blue-700 rounded"
                              title="Edit"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => deleteRule(rule.id)}
                              className="p-1 bg-red-600 hover:bg-red-700 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'rulings' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Public Court Rulings Archive</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rulings.map((ruling) => (
                  <div key={ruling.id} className="bg-zinc-900/50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2 py-1 rounded text-xs capitalize ${getRulingColor(ruling.ruling)}`}>
                        {ruling.ruling.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(ruling.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-400">Case:</span>
                        <span className="ml-2 capitalize">{ruling.case_type.replace(/_/g, ' ')}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Severity:</span>
                        <span className="ml-2">Level {ruling.severity_level}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Consequence:</span>
                        <span className="ml-2">{ruling.consequence_applied}</span>
                      </div>
                      {ruling.duration_applied && (
                        <div>
                          <span className="text-gray-400">Duration:</span>
                          <span className="ml-2">{ruling.duration_applied}</span>
                        </div>
                      )}
                    </div>

                    {ruling.reasoning_summary && (
                      <div className="mt-3 pt-3 border-t border-zinc-700">
                        <p className="text-xs text-gray-300 line-clamp-3">{ruling.reasoning_summary}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Edit/Add Rule Modal */}
          {(editingRule || showAddModal) && (
            <RuleModal
              rule={editingRule}
              onSave={saveRule}
              onClose={() => {
                setEditingRule(null);
                setShowAddModal(false);
              }}
            />
          )}
        </div>
      </div>
    </RequireRole>
  );
}

// Rule Modal Component
function RuleModal({ rule, onSave, onClose }: {
  rule: EscalationRule | null;
  onSave: (rule: EscalationRule) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<EscalationRule>(
    rule || {
      id: '',
      violation_type: 'spam',
      severity_level: 1,
      violation_count_threshold: 1,
      time_window_days: 1,
      consequence_type: 'warning',
      consequence_duration_minutes: null,
      court_required: false,
      auto_escalate: true,
      points_deducted: 5,
      is_active: true
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">{rule ? 'Edit Escalation Rule' : 'Add New Rule'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Violation Type</label>
              <select
                value={formData.violation_type}
                onChange={(e) => setFormData({ ...formData, violation_type: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              >
                <option value="spam">Spam</option>
                <option value="harassment">Harassment</option>
                <option value="inappropriate_content">Inappropriate Content</option>
                <option value="copyright">Copyright</option>
                <option value="fraud">Fraud</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Severity Level</label>
              <select
                value={formData.severity_level}
                onChange={(e) => setFormData({ ...formData, severity_level: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              >
                <option value={1}>Level 1</option>
                <option value={2}>Level 2</option>
                <option value={3}>Level 3</option>
                <option value={4}>Level 4</option>
                <option value={5}>Level 5</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Violation Threshold</label>
              <input
                type="number"
                min="1"
                value={formData.violation_count_threshold}
                onChange={(e) => setFormData({ ...formData, violation_count_threshold: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Time Window (days)</label>
              <input
                type="number"
                min="0"
                value={formData.time_window_days}
                onChange={(e) => setFormData({ ...formData, time_window_days: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Consequence Type</label>
              <select
                value={formData.consequence_type}
                onChange={(e) => setFormData({ ...formData, consequence_type: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              >
                <option value="warning">Warning</option>
                <option value="timeout">Timeout</option>
                <option value="ban">Ban</option>
                <option value="court_session">Court Session</option>
                <option value="permanent_ban">Permanent Ban</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Duration (minutes)</label>
              <input
                type="number"
                min="0"
                value={formData.consequence_duration_minutes || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  consequence_duration_minutes: e.target.value ? parseInt(e.target.value) : null
                })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Leave empty for permanent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Points Deducted</label>
              <input
                type="number"
                min="0"
                value={formData.points_deducted}
                onChange={(e) => setFormData({ ...formData, points_deducted: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Court Required</label>
              <select
                value={formData.court_required.toString()}
                onChange={(e) => setFormData({ ...formData, court_required: e.target.value === 'true' })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.auto_escalate}
                onChange={(e) => setFormData({ ...formData, auto_escalate: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Auto-escalate</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg"
            >
              {rule ? 'Update' : 'Create'} Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}