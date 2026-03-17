import React from 'react';
import { TrendingUp, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LeadHQTab(props: any) {
  const navigate = useNavigate();
  const canAccess = ['lead', 'president', 'admin'].includes(props.roleLevel);
  
  if (!canAccess) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <TrendingUp className="text-blue-400" />
            Lead HQ
          </h2>
          <p className="text-slate-400 mt-1">Lead officer command center</p>
        </div>
        
        <div className="text-center py-12 text-slate-500">
          <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-medium text-slate-300 mb-2">Access Restricted</h3>
          <p>Only Lead Officers can access this area.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <TrendingUp className="text-blue-400" />
          Lead HQ
        </h2>
        <p className="text-slate-400 mt-1">Lead officer command center</p>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
        <TrendingUp className="w-16 h-16 mx-auto mb-4 text-blue-400" />
        <h3 className="text-xl font-bold mb-2">Lead Officer HQ</h3>
        <p className="text-slate-400 mb-4">Access the lead officer command center.</p>
        <button 
          onClick={() => navigate('/lead-officer')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors"
        >
          Enter HQ <ExternalLink size={18} />
        </button>
      </div>
    </div>
  );
}
