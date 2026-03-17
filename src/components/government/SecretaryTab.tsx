import React from 'react';
import { Lock, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SecretaryTab(props: any) {
  const navigate = useNavigate();
  const canAccess = ['secretary', 'president', 'admin'].includes(props.roleLevel);
  
  if (!canAccess) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Lock className="text-purple-400" />
            Secretary Console
          </h2>
          <p className="text-slate-400 mt-1">Administrative functions</p>
        </div>
        
        <div className="text-center py-12 text-slate-500">
          <Lock className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-medium text-slate-300 mb-2">Access Restricted</h3>
          <p>Only Secretaries can access this area.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Lock className="text-purple-400" />
          Secretary Console
        </h2>
        <p className="text-slate-400 mt-1">Administrative functions</p>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
        <Lock className="w-16 h-16 mx-auto mb-4 text-purple-400" />
        <h3 className="text-xl font-bold mb-2">Secretary Console</h3>
        <p className="text-slate-400 mb-4">Access administrative functions and tools.</p>
        <button 
          onClick={() => navigate('/secretary')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-colors"
        >
          Enter Console <ExternalLink size={18} />
        </button>
      </div>
    </div>
  );
}
