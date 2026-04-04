import React, { useState } from 'react';
import { Users, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

export default function PartiesTab(props: any) {
  const parties = props.politicalParties || [];
  const canCreateParty = ['president', 'admin', 'secretary', 'lead', 'officer', 'citizen'].includes(props.roleLevel);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [partyName, setPartyName] = useState('');
  const [partyDescription, setPartyDescription] = useState('');
  const [partyIdeology, setPartyIdeology] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreateParty = async () => {
    if (!partyName.trim()) {
      toast.error('Party name is required');
      return;
    }
    setSubmitting(true);
    try {
      await props.onCreatePoliticalParty({
        name: partyName.trim(),
        description: partyDescription.trim(),
        party_ideology: partyIdeology.trim(),
      });
      toast.success('Political party created!');
      setShowCreateModal(false);
      setPartyName('');
      setPartyDescription('');
      setPartyIdeology('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create party');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Users className="text-blue-400" />
            Political Parties
          </h2>
          <p className="text-slate-400 mt-1">Political organizations and affiliations</p>
        </div>
        {canCreateParty && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors"
          >
            <Plus size={18} /> Create Party
          </button>
        )}
      </div>
      
      {parties.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-medium text-slate-300 mb-2">No Political Parties</h3>
          <p>No political parties have been formed yet.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {parties.map((party: any) => (
            <div key={party.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="font-bold text-lg">{party.name}</h3>
              <p className="text-slate-400 text-sm">{party.description}</p>
              <div className="mt-3 flex gap-4 text-sm">
                <span className="text-slate-500">{party.party_membership_count} members</span>
                <span className="text-slate-500">{party.election_wins} wins</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Party Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Create Political Party</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-slate-700 rounded">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Party Name *</label>
                <input
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="Enter party name"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <textarea
                  value={partyDescription}
                  onChange={(e) => setPartyDescription(e.target.value)}
                  placeholder="Describe your party's mission"
                  rows={3}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-400 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Ideology</label>
                <input
                  type="text"
                  value={partyIdeology}
                  onChange={(e) => setPartyIdeology(e.target.value)}
                  placeholder="e.g. Progressive, Conservative, Libertarian"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-400"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateParty}
                disabled={submitting || !partyName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Party'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
