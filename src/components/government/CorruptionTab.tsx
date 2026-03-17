import React from 'react';
import { DollarSign, Eye, EyeOff } from 'lucide-react';

export default function CorruptionTab(props: any) {
  const bribes = props.bribes || [];
  const canView = ['officer', 'lead', 'secretary', 'president', 'admin'].includes(props.roleLevel);
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <DollarSign className="text-red-400" />
          Corruption Tracking
        </h2>
        <p className="text-slate-400 mt-1">Bribery and corruption incidents</p>
      </div>
      
      {!canView ? (
        <div className="text-center py-12 text-slate-500">
          <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-medium text-slate-300 mb-2">Access Restricted</h3>
          <p>Only officers and above can view corruption data.</p>
        </div>
      ) : bribes.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-medium text-slate-300 mb-2">No Corruption Cases</h3>
          <p>No corruption incidents have been recorded.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bribes.map((bribe: any) => (
            <div key={bribe.id} className={`bg-slate-900 border rounded-xl p-5 ${bribe.is_exposed ? 'border-red-500/50' : 'border-slate-800'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold">{bribe.briber_profile?.username || 'Unknown'}</h4>
                  <p className="text-slate-400 text-sm">{bribe.amount} coins - {bribe.purpose}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${bribe.is_exposed ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                  {bribe.is_exposed ? 'EXPOSED' : 'SECRET'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
