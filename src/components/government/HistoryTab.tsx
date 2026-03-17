import React from 'react';
import { History } from 'lucide-react';

export default function HistoryTab(props: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <History className="text-slate-400" />
          Government History
        </h2>
        <p className="text-slate-400 mt-1">Recent government actions and events</p>
      </div>
      
      <div className="text-center py-12 text-slate-500">
        <History className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <h3 className="text-xl font-medium text-slate-300 mb-2">History Coming Soon</h3>
        <p>Government action history will be displayed here.</p>
      </div>
    </div>
  );
}
