import React from 'react';
import { Gavel, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OfficerLoungeTab(props: any) {
  const navigate = useNavigate();
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Gavel className="text-blue-400" />
          Officer Lounge
        </h2>
        <p className="text-slate-400 mt-1">Officer community and chat</p>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
        <Gavel className="w-16 h-16 mx-auto mb-4 text-blue-400" />
        <h3 className="text-xl font-bold mb-2">Officer Lounge</h3>
        <p className="text-slate-400 mb-4">Join the officer community and chat.</p>
        <button 
          onClick={() => navigate('/officer/lounge')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors"
        >
          Enter Lounge <ExternalLink size={18} />
        </button>
      </div>
    </div>
  );
}
