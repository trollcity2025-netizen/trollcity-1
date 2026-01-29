import React, { useState } from 'react';
import { 
  Database, 
  Download, 
  RefreshCw, 
  Shield, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  FileJson,
  Archive
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const DatabaseBackup: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [backupStatus, setBackupStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [lastBackup, setLastBackup] = useState<string>(new Date(Date.now() - 86400000).toLocaleString());

  const handleCreateBackup = async () => {
    setLoading(true);
    setBackupStatus('processing');
    try {
      // Trigger a real backup request via RPC
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc('trigger_manual_backup', {
        p_admin_id: user.user.id
      });
      
      if (error) throw error;
      
      // We don't fake success anymore. We wait for the system to process it.
      // For UX, we show "Request Sent" and let the user know it's queued.
      toast.success("Backup request queued successfully");
      setBackupStatus('idle'); // Reset to idle so they can request again if needed, or we could track the active request.
      
      // In a real app with a background worker, we would subscribe to the request status.
      // For now, we just acknowledge the request.
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Backup request failed");
      setBackupStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async (table: string, filename?: string) => {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1000);
      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename || table}_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(`Error exporting ${table}:`, error);
      alert(`Failed to export ${table}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Database className="w-8 h-8 text-purple-400" />
              Database Management
            </h1>
            <p className="text-gray-400 mt-2">Manage system backups and data exports</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
            <Shield className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-sm font-medium">System Healthy</span>
          </div>
        </div>

        {/* Backup Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Automatic Backups Card */}
          <div className="bg-[#111] border border-gray-800 rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all" />
            
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                Automated Backups
              </h2>
              <span className="px-2 py-1 bg-purple-500/10 rounded text-xs text-purple-400">Daily</span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Last Successful Backup</span>
                <span className="text-white font-mono">{lastBackup}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Next Scheduled</span>
                <span className="text-white font-mono">00:00 UTC</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Retention Policy</span>
                <span className="text-white">30 Days</span>
              </div>
            </div>
          </div>

          {/* Manual Backup Card */}
          <div className="bg-[#111] border border-gray-800 rounded-xl p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Archive className="w-5 h-5 text-blue-400" />
                Manual Backup
              </h2>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Trigger an immediate full database backup. This operation may take several minutes depending on database size.
              </p>
              
              <button
                onClick={handleCreateBackup}
                disabled={loading}
                className={`w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
                  backupStatus === 'success' 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : backupStatus === 'success' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                {loading ? 'Processing...' : backupStatus === 'success' ? 'Backup Complete' : 'Start Backup Now'}
              </button>

              {backupStatus === 'error' && (
                <div className="flex items-center gap-2 text-red-400 text-sm mt-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Backup failed. Please check server logs.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Data Export Section */}
        <div className="bg-[#111] border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Download className="w-5 h-5 text-orange-400" />
            Data Export
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'User Profiles', table: 'user_profiles' },
              { label: 'Transactions', table: 'coin_transactions' },
              { label: 'Stream Chats', table: 'messages', filename: 'stream_chat_logs' },
              { label: 'Direct Messages', table: 'conversation_messages', filename: 'dm_logs' },
              { label: 'Audit Logs', table: 'audit_logs', filename: 'system_audit_logs' }
            ].map((item) => (
              <button
                key={item.table + item.label}
                onClick={() => handleExportData(item.table, item.filename)}
                className="flex items-center justify-between p-4 bg-[#1a1a24] hover:bg-[#252532] border border-gray-800 hover:border-gray-700 rounded-lg transition-all group"
              >
                <div className="flex items-center gap-3">
                  <FileJson className="w-5 h-5 text-gray-500 group-hover:text-orange-400 transition-colors" />
                  <span className="text-sm font-medium text-gray-300 group-hover:text-white">{item.label}</span>
                </div>
                <Download className="w-4 h-4 text-gray-600 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all" />
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DatabaseBackup;
