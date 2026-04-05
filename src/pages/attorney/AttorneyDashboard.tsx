import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Briefcase, Users, MessageSquare, DollarSign, FileText, User, CheckCircle, XCircle, Clock } from 'lucide-react';

interface AttorneyCase {
  id: string;
  case_id: string;
  victim_id: string;
  victim_username?: string;
  victim_avatar?: string;
  status: string;
  fee_paid: number;
  is_pro_bono: boolean;
  case_details: any;
  court_case?: {
    reason: string;
    status: string;
    defendant_id: string;
    defendant?: {
      username: string;
      avatar_url: string;
    };
  };
}

interface AvailableCase {
  id: string;
  reason: string;
  status: string;
  plaintiff_id: string;
  defendant_id: string;
  plaintiff?: { username: string; avatar_url: string };
  defendant?: { username: string; avatar_url: string };
  created_at: string;
}

export default function AttorneyDashboard() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [activeCases, setActiveCases] = useState<AttorneyCase[]>([]);
  const [availableCases, setAvailableCases] = useState<AvailableCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'cases' | 'available'>('cases');
  const [attorneyInfo, setAttorneyInfo] = useState<any>(null);

  const isProBono = profile?.is_pro_bono;
  const attorneyFee = profile?.attorney_fee || 0;
  const earnings = activeCases.filter(c => c.is_pro_bono).length * 200;

  useEffect(() => {
    if (user) {
      fetchAttorneyData();
    }
  }, [user]);

  const fetchAttorneyData = async () => {
    try {
      setLoading(true);
      
      // Get attorney info from profile
      setAttorneyInfo({
        isProBono: profile?.is_pro_bono,
        fee: profile?.attorney_fee,
        casesCount: profile?.attorney_cases_count || 0
      });

      // Get active cases
      const { data: casesData, error: casesError } = await supabase
        .from('attorney_cases')
        .select('*')
        .eq('attorney_id', user?.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (casesError) throw casesError;

      // Get user info for victims in a separate query
      const victimIds = [...new Set((casesData || []).map(c => c.victim_id).filter(Boolean))];
      let victimMap: Record<string, any> = {};
      if (victimIds.length > 0) {
        const { data: victims } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', victimIds);
        if (victims) {
          victims.forEach(v => { victimMap[v.id] = v; });
        }
      }

      const transformedCases = (casesData || []).map((c: any) => ({
        id: c.id,
        case_id: c.case_id,
        victim_id: c.victim_id,
        victim_username: victimMap[c.victim_id]?.username || 'Unknown',
        victim_avatar: victimMap[c.victim_id]?.avatar_url,
        status: c.status,
        fee_paid: c.fee_paid,
        is_pro_bono: c.is_pro_bono,
        case_details: c.case_details,
        court_case: null
      }));

      setActiveCases(transformedCases);

      // Get available cases (cases without attorneys)
      const { data: availableData } = await supabase
        .from('court_cases')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);

      setAvailableCases(availableData || []);
    } catch (err) {
      console.error('Error fetching attorney data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTakeCase = async (caseData: AvailableCase) => {
    if (!user) return;

    const confirmMsg = isProBono 
      ? 'Take this case as Pro Bono? You will receive 200 Troll Coins from the public pool.'
      : `Take this case for ${attorneyFee} Troll Coins?`;

    if (!confirm(confirmMsg)) return;

    try {
      // Create attorney case record
      const { error } = await supabase
        .from('attorney_cases')
        .insert({
          attorney_id: user.id,
          case_id: caseData.id,
          victim_id: caseData.plaintiff_id,
          status: 'active',
          fee_paid: isProBono ? 0 : attorneyFee,
          is_pro_bono: isProBono,
          case_details: {
            reason: caseData.reason,
            plaintiff: caseData.plaintiff?.username,
            defendant: caseData.defendant?.username,
            accepted_at: new Date().toISOString()
          }
        });

      if (error) throw error;

      // If pro bono, add 200 TC from public pool
      if (isProBono) {
        const { data: poolData } = await supabase
          .from('system_wallets')
          .select('balance')
          .eq('id', 'public_pool')
          .maybeSingle();

        if (poolData && poolData.balance >= 200) {
          await supabase
            .from('user_profiles')
            .update({ troll_coins: (profile?.troll_coins || 0) + 200 })
            .eq('id', user.id);

          await supabase
            .from('system_wallets')
            .update({ balance: poolData.balance - 200 })
            .eq('id', 'public_pool');
        }
      }

      toast.success('Case accepted!');
      fetchAttorneyData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to take case');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-600/20 rounded-xl flex items-center justify-center border border-amber-500/30">
              <Briefcase className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Attorney Dashboard</h1>
              <p className="text-gray-400 text-sm">
                {isProBono ? 'Pro Bono Attorney' : `Private Attorney - ${attorneyFee} TC/case`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg px-4 py-2">
              <p className="text-xs text-gray-400">Active Cases</p>
              <p className="text-xl font-bold text-amber-400">{activeCases.length}</p>
            </div>
            {isProBono && (
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-2">
                <p className="text-xs text-gray-400">Total Earnings</p>
                <p className="text-xl font-bold text-green-400">{earnings} TC</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="w-5 h-5 text-amber-400" />
              <span className="font-semibold">Total Cases</span>
            </div>
            <p className="text-2xl font-bold">{attorneyInfo?.casesCount || activeCases.length}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="font-semibold">Pending Cases</span>
            </div>
            <p className="text-2xl font-bold">{availableCases.length}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              <span className="font-semibold">Fee per Case</span>
            </div>
            <p className="text-2xl font-bold">{isProBono ? '200 TC (Pro Bono)' : `${attorneyFee} TC`}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2">
          <button
            onClick={() => setSelectedTab('cases')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              selectedTab === 'cases' 
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Briefcase className="w-4 h-4 inline mr-2" />
            My Cases ({activeCases.length})
          </button>
          <button
            onClick={() => setSelectedTab('available')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              selectedTab === 'available' 
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Available Cases ({availableCases.length})
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-amber-500 rounded-full border-t-transparent"></div>
          </div>
        ) : selectedTab === 'cases' ? (
          /* My Cases */
          activeCases.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Briefcase className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No active cases</p>
              <button
                onClick={() => setSelectedTab('available')}
                className="text-amber-400 hover:text-amber-300 mt-2"
              >
                Browse available cases
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {activeCases.map((caseItem) => (
                <div key={caseItem.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                        {caseItem.victim_avatar ? (
                          <img src={caseItem.victim_avatar} alt={caseItem.victim_username} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-lg">{caseItem.victim_username}</p>
                        <p className="text-gray-400 text-sm">
                          Case: {caseItem.court_case?.reason || 'Pending'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            caseItem.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-gray-600'
                          }`}>
                            {caseItem.status.toUpperCase()}
                          </span>
                          {caseItem.is_pro_bono && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400">
                              Pro Bono
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/admin/court-dockets?case=${caseItem.case_id}`)}
                      className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 rounded-lg text-sm"
                    >
                      View Case
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Available Cases */
          availableCases.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No available cases</p>
            </div>
          ) : (
            <div className="space-y-4">
              {availableCases.map((caseItem) => (
                <div key={caseItem.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold">Plaintiff: {caseItem.plaintiff?.username || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold">Defendant: {caseItem.defendant?.username || 'Unknown'}</span>
                      </div>
                      <p className="text-gray-400 text-sm mb-2">Reason: {caseItem.reason}</p>
                      <p className="text-xs text-gray-500">
                        Filed: {new Date(caseItem.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleTakeCase(caseItem)}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold"
                    >
                      {isProBono ? 'Take (Pro Bono +200TC)' : `Take (${attorneyFee} TC)`}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
