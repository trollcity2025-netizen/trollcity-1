import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, AlertTriangle, Scale, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { trollCityTheme } from '../../styles/trollCityTheme';

interface BackgroundCheckViewProps {
  userId: string;
}

interface JailRecord {
  id: string;
  arrest_date: string;
  reason: string;
  severity: string;
  bail_amount: number;
  status: string;
}

interface ReportRecord {
  id: string;
  report_type: string;
  reason: string;
  created_at: string;
  status: string;
}

export default function BackgroundCheckView({ userId }: BackgroundCheckViewProps) {
  const [creditScore, setCreditScore] = useState<number>(0);
  const [jailRecords, setJailRecords] = useState<JailRecord[]>([]);
  const [reportRecords, setReportRecords] = useState<ReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBackgroundData();
  }, [userId]);

  const fetchBackgroundData = async () => {
    setIsLoading(true);
    try {
      // Fetch user profile for credit score
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('credit_score')
        .eq('id', userId)
        .maybeSingle();
      
      setCreditScore(profileData?.credit_score || 400);

      // Fetch jail records
      const { data: jailData } = await supabase
        .from('jail')
        .select('id, arrest_date, reason, severity, bail_amount, status')
        .eq('user_id', userId)
        .order('arrest_date', { ascending: false })
        .limit(10);
      
      setJailRecords(jailData || []);

      // Fetch report records (abuse reports, etc.)
      const { data: reportData } = await supabase
        .from('reports')
        .select('id, report_type, reason, created_at, status')
        .eq('target_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      setReportRecords(reportData || []);
    } catch (error) {
      console.error('[BackgroundCheck] Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCreditScoreColor = (score: number) => {
    if (score >= 700) return 'text-green-400';
    if (score >= 650) return 'text-yellow-400';
    if (score >= 500) return 'text-orange-400';
    return 'text-red-400';
  };

  const getCreditScoreLabel = (score: number) => {
    if (score >= 700) return 'Excellent';
    if (score >= 650) return 'Good';
    if (score >= 500) return 'Fair';
    return 'Poor';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'severe': return 'text-red-400 bg-red-400/10';
      case 'serious': return 'text-orange-400 bg-orange-400/10';
      case 'moderate': return 'text-yellow-400 bg-yellow-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-purple-400" />
        <h2 className="text-xl font-bold text-white">Background Check</h2>
      </div>

      {/* Credit Score Card */}
      <div className={`${trollCityTheme?.backgrounds?.card || 'bg-slate-800'} border border-white/10 rounded-xl p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Credit Score
          </h3>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getCreditScoreColor(creditScore)} bg-white/5`}>
            {getCreditScoreLabel(creditScore)}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`text-5xl font-bold ${getCreditScoreColor(creditScore)}`}>
            {creditScore}
          </div>
          <div className="flex-1">
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${
                  creditScore >= 700 ? 'bg-green-500' :
                  creditScore >= 650 ? 'bg-yellow-500' :
                  creditScore >= 500 ? 'bg-orange-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, (creditScore / 850) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>300</span>
              <span>850</span>
            </div>
          </div>
        </div>
      </div>

      {/* Jail Records */}
      <div className={`${trollCityTheme?.backgrounds?.card || 'bg-slate-800'} border border-white/10 rounded-xl p-6`}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h3 className="text-lg font-bold text-white">Jail History</h3>
          <span className="text-sm text-gray-400">({jailRecords.length} records)</span>
        </div>
        
        {jailRecords.length === 0 ? (
          <div className="text-center py-6 text-green-400 bg-green-400/10 rounded-lg">
            <Shield className="w-8 h-8 mx-auto mb-2" />
            <p>No jail records found - Clean record</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jailRecords.map((record) => (
              <div key={record.id} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{record.reason || 'Violation'}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getSeverityColor(record.severity)}`}>
                      {record.severity || 'minor'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(record.arrest_date).toLocaleDateString()} • Bail: {record.bail_amount || 0} TC
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  record.status === 'released' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                }`}>
                  {record.status || 'unknown'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report/Incident Records */}
      <div className={`${trollCityTheme?.backgrounds?.card || 'bg-slate-800'} border border-white/10 rounded-xl p-6`}>
        <div className="flex items-center gap-2 mb-4">
          <Scale className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-bold text-white">Report History</h3>
          <span className="text-sm text-gray-400">({reportRecords.length} records)</span>
        </div>
        
        {reportRecords.length === 0 ? (
          <div className="text-center py-6 text-green-400 bg-green-400/10 rounded-lg">
            <Shield className="w-8 h-8 mx-auto mb-2" />
            <p>No report records found - Good standing</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reportRecords.map((record) => (
              <div key={record.id} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{record.report_type || 'Report'}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      record.status === 'resolved' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'
                    }`}>
                      {record.status || 'pending'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(record.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className={`${trollCityTheme?.backgrounds?.card || 'bg-slate-800'} border border-white/10 rounded-xl p-6`}>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" />
          Summary
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-black/30 rounded-lg">
            <div className={`text-2xl font-bold ${getCreditScoreColor(creditScore)}`}>{creditScore}</div>
            <div className="text-xs text-gray-500">Credit Score</div>
          </div>
          <div className="text-center p-3 bg-black/30 rounded-lg">
            <div className={`text-2xl font-bold ${jailRecords.length === 0 ? 'text-green-400' : 'text-red-400'}`}>
              {jailRecords.length}
            </div>
            <div className="text-xs text-gray-500">Arrests</div>
          </div>
          <div className="text-center p-3 bg-black/30 rounded-lg">
            <div className={`text-2xl font-bold ${reportRecords.length === 0 ? 'text-green-400' : 'text-yellow-400'}`}>
              {reportRecords.length}
            </div>
            <div className="text-xs text-gray-500">Reports</div>
          </div>
        </div>
      </div>
    </div>
  );
}