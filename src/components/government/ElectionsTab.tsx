import React from 'react';
import { PartyPopper, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ElectionsTab(props: any) {
  const navigate = useNavigate();
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <PartyPopper className="text-purple-400" />
          Elections
        </h2>
        <p className="text-slate-400 mt-1">Presidential elections and candidate information</p>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
        <PartyPopper className="w-16 h-16 mx-auto mb-4 text-purple-400" />
        <h3 className="text-xl font-bold mb-2">Presidential Elections</h3>
        <p className="text-slate-400 mb-4">View the full election system and vote for candidates.</p>
        <button 
          onClick={() => navigate('/president')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-colors"
        >
          Go to Elections <ExternalLink size={18} />
        </button>
      </div>
    </div>
  );
}
