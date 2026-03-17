import React from 'react';
import { Shield, AlertTriangle, UserX, Ban } from 'lucide-react';

export default function EnforcementTab(props: any) {
  const canEnforce = ['officer', 'lead', 'secretary', 'president', 'admin'].includes(props.roleLevel);
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Shield className="text-red-400" />
          Enforcement Center
        </h2>
        <p className="text-slate-400 mt-1">Moderation and law enforcement tools</p>
      </div>
      
      {!canEnforce ? (
        <div className="text-center py-12 text-slate-500">
          <Shield className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-medium text-slate-300 mb-2">Access Restricted</h3>
          <p>Only officers and above can access enforcement tools.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="text-yellow-400" size={24} />
              </div>
              <div>
                <h3 className="font-bold">Warnings</h3>
                <p className="text-sm text-slate-400">Issue warnings to users</p>
              </div>
            </div>
            <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors">
              Issue Warning
            </button>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <UserX className="text-orange-400" size={24} />
              </div>
              <div>
                <h3 className="font-bold">Jail</h3>
                <p className="text-sm text-slate-400">Temporary jail sentences</p>
              </div>
            </div>
            <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors">
              Issue Jail
            </button>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <Ban className="text-red-400" size={24} />
              </div>
              <div>
                <h3 className="font-bold">Bans</h3>
                <p className="text-sm text-slate-400">Permanent account bans</p>
              </div>
            </div>
            <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors">
              Issue Ban
            </button>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <UserX className="text-purple-400" size={24} />
              </div>
              <div>
                <h3 className="font-bold">Mute</h3>
                <p className="text-sm text-slate-400">Temporary chat mute</p>
              </div>
            </div>
            <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors">
              Issue Mute
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
