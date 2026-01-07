import React, { FC, useMemo } from 'react';
import { Sparkles, AlertCircle, Scale, FileText, User } from 'lucide-react';
import type { CourtSessionData } from '../lib/courtSessions';

type CourtPhase = 'waiting' | 'opening' | 'evidence' | 'deliberation' | 'verdict';

interface CourtAIAssistantProps {
  courtSession: CourtSessionData | null;
  activeCase: Record<string, any> | null;
  courtPhase: CourtPhase;
  evidence: any[];
  defendant: any; // ID or object
  judge: any; // ID or object
  verdict: Record<string, any> | null;
}

const CourtAIAssistant: FC<CourtAIAssistantProps> = ({
  courtSession,
  activeCase,
  courtPhase,
  evidence,
  defendant,
  judge,
  verdict
}) => {
  const analysis = useMemo(() => {
    if (!activeCase) {
      return {
        status: 'standby',
        message: 'MAI System Standby. Waiting for case initialization.',
        color: 'text-gray-400',
        borderColor: 'border-gray-700'
      };
    }

    if (verdict) {
      return {
        status: 'verdict',
        message: `Case Closed. Verdict: ${verdict.verdict === 'guilty' ? 'GUILTY' : 'NOT GUILTY'}. Penalty: ${verdict.penalty || 'None'}. Reasoning recorded.`,
        color: verdict.verdict === 'guilty' ? 'text-red-400' : 'text-green-400',
        borderColor: verdict.verdict === 'guilty' ? 'border-red-900/50' : 'border-green-900/50'
      };
    }

    switch (courtPhase) {
      case 'opening':
        return {
          status: 'analyzing',
          message: 'Processing opening statements. Monitoring for procedural irregularities.',
          color: 'text-blue-400',
          borderColor: 'border-blue-900/50'
        };
      case 'evidence':
        return {
          status: 'processing',
          message: `Evidence Phase Active. ${evidence.length} exhibit(s) logged. Scanning for authenticity...`,
          color: 'text-yellow-400',
          borderColor: 'border-yellow-900/50'
        };
      case 'deliberation':
        return {
          status: 'calculating',
          message: 'Deliberation in progress. Cross-referencing Troll City statutes and precedents.',
          color: 'text-orange-400',
          borderColor: 'border-orange-900/50'
        };
      default:
        return {
          status: 'active',
          message: 'Case active. Monitoring courtroom telemetry.',
          color: 'text-purple-400',
          borderColor: 'border-purple-900/50'
        };
    }
  }, [activeCase, courtPhase, evidence, verdict]);

  const severityColor = useMemo(() => {
    switch (activeCase?.severity) {
      case 'Critical': return 'text-red-500';
      case 'High': return 'text-orange-500';
      case 'Medium': return 'text-yellow-500';
      default: return 'text-green-500';
    }
  }, [activeCase?.severity]);

  if (!courtSession) return null;

  return (
    <div className={`bg-black/40 border ${analysis.borderColor} rounded-xl p-4 backdrop-blur-sm`}>
      <div className="flex items-center gap-2 mb-3 border-b border-gray-800 pb-2">
        <Sparkles className="w-5 h-5 text-purple-400" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-purple-200">MAI Court Assistant</h3>
        <span className="ml-auto text-[10px] bg-purple-900/30 text-purple-300 px-2 py-0.5 rounded border border-purple-500/20 animate-pulse">
          LIVE
        </span>
      </div>

      <div className="space-y-4">
        {/* Main Analysis */}
        <div className="flex gap-3">
          <div className="mt-1">
             {analysis.status === 'processing' ? (
                <FileText className={`w-5 h-5 ${analysis.color}`} />
             ) : analysis.status === 'verdict' ? (
                <Scale className={`w-5 h-5 ${analysis.color}`} />
             ) : (
                <AlertCircle className={`w-5 h-5 ${analysis.color}`} />
             )}
          </div>
          <div>
            <p className={`text-sm font-medium ${analysis.color}`}>
              {analysis.message}
            </p>
            {activeCase && (
                <p className="text-xs text-gray-500 mt-1">
                    Case ID: {activeCase.id.slice(0, 8)}... | Severity: <span className={severityColor}>{activeCase.severity}</span>
                </p>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        {activeCase && (
            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-zinc-900/50 rounded p-2 border border-zinc-800">
                    <div className="text-xs text-gray-500 mb-1">Evidence</div>
                    <div className="text-lg font-mono text-white">{evidence.length}</div>
                </div>
                <div className="bg-zinc-900/50 rounded p-2 border border-zinc-800">
                    <div className="text-xs text-gray-500 mb-1">Witnesses</div>
                    <div className="text-lg font-mono text-white">{activeCase.witnesses?.length || 0}</div>
                </div>
                <div className="bg-zinc-900/50 rounded p-2 border border-zinc-800">
                    <div className="text-xs text-gray-500 mb-1">Duration</div>
                    <div className="text-lg font-mono text-white">
                        {activeCase.started_at ? Math.floor((Date.now() - new Date(activeCase.started_at).getTime()) / 60000) + 'm' : '0m'}
                    </div>
                </div>
            </div>
        )}
        
        {/* Footer */}
        <div className="text-[10px] text-gray-600 font-mono text-center pt-2">
            MAI SYSTEM v2.4.1 // TROLL CITY JURISDICTION
        </div>
      </div>
    </div>
  );
};

export default CourtAIAssistant;
