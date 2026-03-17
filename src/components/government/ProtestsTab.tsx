import React from 'react';
import { Hand, Plus } from 'lucide-react';

export default function ProtestsTab(props: any) {
  const protests = props.protests || [];
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Hand className="text-orange-400" />
            Protests
          </h2>
          <p className="text-slate-400 mt-1">City demonstrations and protests</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-xl font-bold transition-colors">
          <Plus size={18} /> Start Protest
        </button>
      </div>
      
      {protests.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Hand className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-medium text-slate-300 mb-2">No Active Protests</h3>
          <p>The city is peaceful. No protests are currently active.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {protests.map((protest: any) => (
            <div key={protest.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-lg">{protest.title}</h4>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  protest.status === 'crisis' ? 'bg-red-500/20 text-red-400' :
                  protest.status === 'growing' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-green-500/20 text-green-400'
                }`}>
                  {protest.status.toUpperCase()}
                </span>
              </div>
              <p className="text-slate-400 text-sm mb-3">{protest.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-sm">{protest.participant_count} participants</span>
                <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors">
                  Join
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
