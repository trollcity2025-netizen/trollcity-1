import React from 'react';
import { Users, Plus } from 'lucide-react';

export default function PartiesTab(props: any) {
  const parties = props.politicalParties || [];
  const canCreateParty = ['president', 'admin'].includes(props.roleLevel);
  
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
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors">
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
    </div>
  );
}
