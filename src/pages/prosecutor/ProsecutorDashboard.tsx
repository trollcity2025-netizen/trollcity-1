import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Gavel, Users, MessageSquare, FileText, User, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

interface ProsecutedCase {
  id: string;
  case_id: string;
  plaintiff_id: string;
  defendant_id: string;
  reason: string;
  status: string;
  case_details: any;
  plaintiff?: { username: string; avatar_url: string };
  defendant?: { username: string; avatar_url: string };
  created_at: string;
}

export default function ProsecutorDashboard() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [activeCases, setActiveCases] = useState<ProsecutedCase[]>([]);
  const [pendingCases, setPendingCases] = useState<ProsecutedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'active' | 'pending'>('active');
  const [selectedCase, setSelectedCase] = useState<ProsecutedCase | null>(null);
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    if (user) {
      fetchProsecutorData();
    }
  }, [user]);

  const fetchProsecutorData = async () => {
    try {
      setLoading(true);
      
      // Get cases where user is prosecutor
      const { data: activeData, error } = await supabase
        .from('court_cases')
        .select('*')
        .eq('prosecutor_id', user?.id)
        .in('status', ['pending', 'scheduled'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user profiles for plaintiffs and defendants
      const userIds = [...new Set(
        (activeData || []).flatMap(c => [c.plaintiff_id, c.defendant_id]).filter(Boolean)
      )];
      let userMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);
        if (profiles) {
          profiles.forEach(p => { userMap[p.id] = p; });
        }
      }

      const transformedActive = (activeData || []).map((c: any) => ({
        id: c.id,
        case_id: c.id,
        plaintiff_id: c.plaintiff_id,
        defendant_id: c.defendant_id,
        reason: c.reason,
        status: c.status,
        case_details: c.case_details,
        plaintiff: userMap[c.plaintiff_id] || null,
        defendant: userMap[c.defendant_id] || null,
        created_at: c.created_at
      }));

      setActiveCases(transformedActive);

      // Get all pending cases (for prosecution)
      const { data: pendingData } = await supabase
        .from('court_cases')
        .select('*')
        .eq('status', 'pending')
        .is('prosecutor_id', null)
        .order('created_at', { ascending: false })
        .limit(30);

      const pendingUserIds = [...new Set(
        (pendingData || []).flatMap(c => [c.plaintiff_id, c.defendant_id]).filter(Boolean)
      )];
      let pendingUserMap: Record<string, any> = {};
      if (pendingUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', pendingUserIds);
        if (profiles) {
          profiles.forEach(p => { pendingUserMap[p.id] = p; });
        }
      }

      const transformedPending = (pendingData || []).map((c: any) => ({
        id: c.id,
        case_id: c.id,
        plaintiff_id: c.plaintiff_id,
        defendant_id: c.defendant_id,
        reason: c.reason,
        status: c.status,
        plaintiff: pendingUserMap[c.plaintiff_id] || null,
        defendant: pendingUserMap[c.defendant_id] || null,
        created_at: c.created_at
      }));

      setPendingCases(transformedPending);
    } catch (err) {
      console.error('Error fetching prosecutor data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProsecuteCase = async (caseData: ProsecutedCase) => {
    if (!user) return;

    if (!confirm(`Take on this case as prosecutor?`)) return;

    try {
      const { error } = await supabase
        .from('court_cases')
        .update({ prosecutor_id: user.id })
        .eq('id', caseData.id);

      if (error) throw error;

      toast.success('Case taken! You can now prosecute.');
      fetchProsecutorData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to take case');
    }
  };

  const handleSendMessage = async () => {
    if (!user || !selectedCase || !messageText.trim()) return;

    try {
      // Create message for court communication
      const { error } = await supabase
        .from('inmate_messages')
        .insert({
          inmate_id: user.id,
          sender_id: user.id,
          recipient_id: selectedCase.plaintiff_id,
          message: `[PROSECUTOR] ${messageText}`,
          cost: 0,
          is_free_message: true
        });

      if (error) throw error;

      toast.success('Message sent to plaintiff');
      setMessageText('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center border border-red-500/30">
              <Gavel className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Prosecutor Dashboard</h1>
              <p className="text-gray-400 text-sm">Working for Troll City</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-2">
              <p className="text-xs text-gray-400">Active Cases</p>
              <p className="text-xl font-bold text-red-400">{activeCases.length}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gavel className="w-5 h-5 text-red-400" />
              <span className="font-semibold">Active Cases</span>
            </div>
            <p className="text-2xl font-bold">{activeCases.length}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-blue-400" />
              <span className="font-semibold">Available Cases</span>
            </div>
            <p className="text-2xl font-bold">{pendingCases.length}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-5 h-5 text-green-400" />
              <span className="font-semibold">Court Chat</span>
            </div>
            <p className="text-sm text-gray-400">Access to judges & attorneys</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2">
          <button
            onClick={() => setSelectedTab('active')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              selectedTab === 'active' 
                ? 'bg-red-600/20 text-red-400 border border-red-500/30' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Gavel className="w-4 h-4 inline mr-2" />
            Active Cases ({activeCases.length})
          </button>
          <button
            onClick={() => setSelectedTab('pending')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              selectedTab === 'pending' 
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Available Cases ({pendingCases.length})
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-red-500 rounded-full border-t-transparent"></div>
          </div>
        ) : selectedTab === 'active' ? (
          /* Active Cases */
          activeCases.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Gavel className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No active prosecutions</p>
              <button
                onClick={() => setSelectedTab('pending')}
                className="text-red-400 hover:text-red-300 mt-2"
              >
                Browse available cases
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeCases.map((caseItem) => (
                <div 
                  key={caseItem.id} 
                  className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 cursor-pointer hover:border-red-500/50"
                  onClick={() => setSelectedCase(caseItem)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-red-900/30 rounded-lg flex items-center justify-center">
                        <Gavel className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <p className="font-semibold">{caseItem.reason || 'Pending Case'}</p>
                        <p className="text-gray-400 text-sm">
                          Plaintiff: {caseItem.plaintiff?.username || 'Unknown'}
                        </p>
                        <p className="text-gray-400 text-sm">
                          Defendant: {caseItem.defendant?.username || 'Unknown'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            caseItem.status === 'in_session' ? 'bg-purple-900/30 text-purple-400' : 'bg-yellow-900/30 text-yellow-400'
                          }`}>
                            {caseItem.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/court/${caseItem.case_id}`);
                      }}
                      className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-sm"
                    >
                      Enter Court
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Available Cases */
          pendingCases.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No available cases to prosecute</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingCases.map((caseItem) => (
                <div key={caseItem.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold mb-2">{caseItem.reason || 'Pending Case'}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                        <User className="w-4 h-4" />
                        <span>Plaintiff: {caseItem.plaintiff?.username || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                        <User className="w-4 h-4" />
                        <span>Defendant: {caseItem.defendant?.username || 'Unknown'}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Filed: {new Date(caseItem.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleProsecuteCase(caseItem)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold"
                    >
                      Prosecute
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Chat Panel (when case selected) */}
        {selectedCase && (
          <div className="fixed bottom-0 right-0 w-80 bg-gray-900 border-l border-t border-gray-700 rounded-t-xl p-4 z-40">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-green-400" />
                Court Communication
              </h3>
              <button onClick={() => setSelectedCase(null)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Messaging: {selectedCase.plaintiff?.username} (Plaintiff)
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Message..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none"
              />
              <button
                onClick={handleSendMessage}
                className="px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-sm"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
