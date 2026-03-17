import React from 'react';
import { Activity, Scale, Gavel, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OfficerDashboardTab(props: any) {
  const navigate = useNavigate();
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Activity className="text-green-400" />
          Officer Dashboard
        </h2>
        <p className="text-slate-400 mt-1">Officer operations and statistics</p>
      </div>
      
      {/* Officer Dashboard */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-8 h-8 text-green-400" />
          <h3 className="text-xl font-bold">Dashboard</h3>
        </div>
        <p className="text-slate-400 mb-4">View the full officer dashboard with stats and operations.</p>
        <button 
          onClick={() => navigate('/officer/dashboard')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition-colors"
        >
          Go to Dashboard <ExternalLink size={18} />
        </button>
      </div>
      
      {/* Officer Moderation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Scale className="w-8 h-8 text-purple-400" />
          <h3 className="text-xl font-bold">Moderation</h3>
        </div>
        <p className="text-slate-400 mb-4">Access content moderation and enforcement tools.</p>
        <button 
          onClick={() => navigate('/officer/moderation')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-colors"
        >
          Go to Moderation <ExternalLink size={18} />
        </button>
      </div>
      
      {/* Officer Lounge */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Gavel className="w-8 h-8 text-blue-400" />
          <h3 className="text-xl font-bold">Lounge</h3>
        </div>
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
