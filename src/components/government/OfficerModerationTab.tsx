import React from 'react';
import { Scale, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OfficerModerationTab(props: any) {
  const navigate = useNavigate();
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Scale className="text-purple-400" />
          Officer Moderation
        </h2>
        <p className="text-slate-400 mt-1">Content moderation tools</p>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
        <Scale className="w-16 h-16 mx-auto mb-4 text-purple-400" />
        <h3 className="text-xl font-bold mb-2">Officer Moderation</h3>
        <p className="text-slate-400 mb-4">Access content moderation and enforcement tools.</p>
        <button 
          onClick={() => navigate('/officer/moderation')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-colors"
        >
          Go to Moderation <ExternalLink size={18} />
        </button>
      </div>
    </div>
  );
}
