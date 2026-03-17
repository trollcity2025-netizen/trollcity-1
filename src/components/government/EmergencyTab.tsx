import React from 'react';
import { Siren, AlertTriangle } from 'lucide-react';

export default function EmergencyTab(props: any) {
  const canUse = ['president', 'admin'].includes(props.roleLevel);
  
  if (!canUse) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Siren className="text-red-400" />
            Emergency Powers
          </h2>
          <p className="text-slate-400 mt-1">Presidential emergency actions</p>
        </div>
        
        <div className="text-center py-12 text-slate-500">
          <Siren className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-medium text-slate-300 mb-2">Access Restricted</h3>
          <p>Only the President can use emergency powers.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Siren className="text-red-400" />
          Emergency Powers
        </h2>
        <p className="text-slate-400 mt-1">Presidential emergency actions (use with caution)</p>
      </div>
      
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3 text-red-400">
          <AlertTriangle size={20} />
          <span className="font-bold">Warning: Emergency powers have consequences!</span>
        </div>
        <p className="text-slate-400 text-sm mt-2">Using emergency powers will increase backlash and may trigger protests.</p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-4">
        <button className="bg-slate-900 border border-slate-800 hover:border-red-500/50 rounded-xl p-6 text-left transition-colors">
          <h3 className="font-bold text-lg mb-2">Override Vote</h3>
          <p className="text-slate-400 text-sm">Force pass or reject any law</p>
        </button>
        
        <button className="bg-slate-900 border border-slate-800 hover:border-red-500/50 rounded-xl p-6 text-left transition-colors">
          <h3 className="font-bold text-lg mb-2">Force Law</h3>
          <p className="text-slate-400 text-sm">Instantly activate any law</p>
        </button>
        
        <button className="bg-slate-900 border border-slate-800 hover:border-red-500/50 rounded-xl p-6 text-left transition-colors">
          <h3 className="font-bold text-lg mb-2">End Protest</h3>
          <p className="text-slate-400 text-sm">Disperses all active protests</p>
        </button>
        
        <button className="bg-slate-900 border border-slate-800 hover:border-red-500/50 rounded-xl p-6 text-left transition-colors">
          <h3 className="font-bold text-lg mb-2">Emergency Declaration</h3>
          <p className="text-slate-400 text-sm">Declare city-wide emergency</p>
        </button>
      </div>
    </div>
  );
}
