import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Trash2, Smartphone, Globe, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface MobileLog {
  id: string;
  error_message: string;
  stack_trace?: string;
  device_info: {
    userAgent: string;
    isMobile: boolean;
    isPWA: boolean;
    platform: string;
  };
  page_url?: string;
  created_at: string;
  user_id?: string;
  user?: {
    username: string;
  };
}

export default function MobileIssues() {
  const [logs, setLogs] = useState<MobileLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mobile_error_logs')
        .select(`
          *,
          user:user_id (username)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching mobile logs:', err);
      toast.error('Failed to load mobile issues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('mobile_error_logs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setLogs(logs.filter(l => l.id !== id));
      toast.success('Log deleted');
    } catch {
      toast.error('Failed to delete log');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL mobile logs?')) return;
    
    try {
      const { error } = await supabase
        .from('mobile_error_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;
      setLogs([]);
      toast.success('All logs cleared');
    } catch {
      toast.error('Failed to clear logs');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading issues...</div>;
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Smartphone className="text-purple-400" />
          Mobile Issues ({logs.length})
        </h2>
        <div className="flex gap-2">
            <button 
                onClick={fetchLogs}
                className="p-2 bg-slate-800 rounded-lg text-white hover:bg-slate-700"
            >
                <RefreshCw size={18} />
            </button>
            <button 
                onClick={handleClearAll}
                className="px-3 py-2 bg-red-900/30 text-red-400 text-xs rounded-lg hover:bg-red-900/50 border border-red-500/20"
            >
                Clear All
            </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-10 bg-white/5 rounded-xl border border-white/10">
          <p className="text-gray-400">No mobile issues reported yet.</p>
        </div>
      ) : (
        logs.map((log) => (
          <div key={log.id} className="bg-slate-900 border border-purple-500/20 rounded-xl p-4 shadow-sm relative group">
            <button
              onClick={() => handleDelete(log.id)}
              className="absolute top-4 right-4 text-gray-500 hover:text-red-400 transition-colors"
            >
              <Trash2 size={18} />
            </button>

            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle className="text-amber-500 shrink-0 mt-1" size={20} />
              <div>
                <h3 className="text-red-300 font-mono text-sm break-all">{log.error_message}</h3>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(log.created_at).toLocaleString()} • {log.user?.username || 'Guest/Anon'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 bg-black/30 p-3 rounded-lg mb-3">
               <div className="flex items-center gap-1">
                 <Smartphone size={12} />
                 <span>{log.device_info?.platform || 'Unknown OS'}</span>
               </div>
               <div className="flex items-center gap-1">
                 <Globe size={12} />
                 <span>{log.device_info?.isPWA ? 'PWA' : 'Browser'}</span>
               </div>
               <div className="col-span-2 truncate text-gray-500">
                 {log.page_url}
               </div>
            </div>

            {log.stack_trace && (
              <details className="mt-2">
                <summary className="text-xs text-purple-400 cursor-pointer hover:underline">View Stack Trace</summary>
                <pre className="mt-2 p-2 bg-black rounded text-[10px] text-gray-500 overflow-x-auto">
                  {log.stack_trace}
                </pre>
              </details>
            )}
          </div>
        ))
      )}
    </div>
  );
}
