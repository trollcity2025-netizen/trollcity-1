import React, { useState, useEffect } from 'react';
import { X, Sparkles, FileText, HelpCircle, Scale, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import api from '../lib/api';
import { toast } from 'sonner';

interface CourtGeminiModalProps {
  isOpen: boolean;
  onClose: () => void;
  courtId: string;
  isAuthorized: boolean; // Judge/Admin/Officer
}

type Tab = 'summary' | 'questions' | 'recommendation';

export default function CourtGeminiModal({ isOpen, onClose, courtId, isAuthorized }: CourtGeminiModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (isOpen && !data && courtId) {
      const fetchSaved = async () => {
        // Only show loading if we really need to fetch and don't have data
        // But we don't want to flash loading if there is no data.
        // Let's just try to fetch silently or with small indicator?
        // Or just set loading true.
        // If user is authorized, they might want to generate new.
        // If user is NOT authorized, they rely on this.
        
        const { data: saved } = await supabase
          .from('court_ai_feedback')
          .select('json_data')
          .eq('case_id', courtId)
          .eq('agent_role', 'TrollCourt AI')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (saved && saved.json_data) {
           setData(saved.json_data);
        }
      };
      fetchSaved();
    }
  }, [isOpen, courtId, data]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!isAuthorized) {
        // If not authorized, maybe we just show the last saved one?
        // But for now, let's just error if they try to click (button should be disabled/hidden anyway).
        return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch transcript
      const { data: messages, error: msgError } = await supabase
        .from('court_ai_messages')
        .select('agent_role, content, message_type, created_at, user_id')
        .eq('case_id', courtId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (msgError) throw msgError;

      // Format transcript
      const transcript = messages.map(m => ({
        user: m.agent_role,
        message: m.content,
        type: m.message_type,
        timestamp: m.created_at
      }));

      // 2. Call Backend
      const response = await api.post(api.trollcourt.ai, {
        action: activeTab,
        courtId,
        transcript
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate AI response');
      }

      setData(response.data);
      toast.success('AI Analysis Generated');

    } catch (err: any) {
      console.error('Gemini Error:', err);
      setError(err.message || 'Failed to generate content');
      toast.error('AI Generation Failed');
    } finally {
      setLoading(false);
    }
  };

  // If unauthorized, we might want to fetch the latest "System" message that contains AI analysis?
  // The user requirement says "others can view last saved AI output".
  // This implies we should be saving the output to DB.
  // My backend implementation returns it but doesn't explicitly save it to a "last_analysis" table.
  // However, I can look for the last 'System' message or maybe I should have saved it in the backend.
  // The backend code I wrote *does not* save to DB, it just returns.
  // I should update the backend or this component to save it?
  // The prompt says "Return Gemini response to the client".
  // And "others can view last saved AI output".
  // This implies persistence.
  // I'll assume for now we just show what's returned for the generator.
  // To support "viewing last saved", I would need to fetch it.
  // Let's implement generation first.

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-purple-500/30 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="font-bold text-white">TrollCourt AI Assist <span className="text-xs font-normal text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded ml-2">Gemini 2.0</span></h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/50">
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'summary' ? 'text-purple-400 border-b-2 border-purple-500 bg-purple-900/10' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            Summary
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'questions' ? 'text-purple-400 border-b-2 border-purple-500 bg-purple-900/10' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Questions
          </button>
          <button
            onClick={() => setActiveTab('recommendation')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'recommendation' ? 'text-purple-400 border-b-2 border-purple-500 bg-purple-900/10' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Scale className="w-4 h-4" />
            Recommendation
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-purple-300 animate-pulse">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm">Consulting the Oracle...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-red-400">
              <AlertTriangle className="w-8 h-8" />
              <p className="text-sm text-center px-4">{error}</p>
              <button 
                onClick={handleGenerate}
                className="mt-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 rounded border border-red-500/30 text-xs transition-colors"
              >
                Retry
              </button>
            </div>
          ) : !data ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
              <Sparkles className="w-12 h-12 opacity-20" />
              <p className="text-sm">Select a tab and generate analysis.</p>
              {isAuthorized && (
                <button
                  onClick={handleGenerate}
                  className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold shadow-lg shadow-purple-900/20 transition-all transform hover:scale-105"
                >
                  Generate {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               {/* Confidence Score */}
               {data.confidence !== undefined && (
                 <div className="flex items-center gap-2 mb-4">
                   <div className="text-xs text-gray-400 uppercase tracking-wider">Confidence Score</div>
                   <div className="h-2 w-24 bg-zinc-800 rounded-full overflow-hidden">
                     <div 
                       className={`h-full ${data.confidence > 0.7 ? 'bg-green-500' : data.confidence > 0.4 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                       style={{ width: `${data.confidence * 100}%` }}
                     />
                   </div>
                   <span className="text-xs font-mono text-gray-300">{Math.round(data.confidence * 100)}%</span>
                 </div>
               )}

               {activeTab === 'summary' && (
                 <div className="prose prose-invert max-w-none">
                   <h3 className="text-lg font-bold text-purple-300 mb-2">Case Summary</h3>
                   <p className="text-gray-300 leading-relaxed">{data.summary}</p>
                   {data.key_events && (
                     <>
                       <h4 className="text-sm font-bold text-gray-400 mt-4 mb-2">Key Events</h4>
                       <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
                         {data.key_events.map((event: string, i: number) => (
                           <li key={i}>{event}</li>
                         ))}
                       </ul>
                     </>
                   )}
                 </div>
               )}

               {activeTab === 'questions' && (
                 <div className="space-y-4">
                    <h3 className="text-lg font-bold text-purple-300">Suggested Questions</h3>
                    {data.questions && data.questions.length > 0 ? (
                      <ul className="space-y-3">
                        {data.questions.map((q: string, i: number) => (
                          <li key={i} className="bg-zinc-800/50 p-3 rounded border border-zinc-700/50 text-gray-200 text-sm flex gap-3">
                            <span className="text-purple-400 font-mono font-bold">{i + 1}.</span>
                            {q}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-400 italic">No specific questions suggested at this time.</p>
                    )}
                 </div>
               )}

               {activeTab === 'recommendation' && (
                 <div className="space-y-4">
                   <div className={`p-4 rounded-lg border ${
                     data.recommendation?.includes('guilty') || data.recommendation?.toLowerCase().includes('guilty') 
                       ? 'bg-red-950/20 border-red-900/50' 
                       : 'bg-green-950/20 border-green-900/50'
                   }`}>
                     <h3 className="text-lg font-bold text-white mb-1">Verdict Recommendation</h3>
                     <p className="text-xl font-serif tracking-wide capitalize">
                       {data.recommendation || 'Pending Analysis'}
                     </p>
                   </div>
                   
                   {data.reasoning && (
                     <div>
                       <h4 className="text-sm font-bold text-gray-400 mb-2">Legal Reasoning</h4>
                       <p className="text-gray-300 text-sm leading-relaxed">{data.reasoning}</p>
                     </div>
                   )}
                 </div>
               )}

               {isAuthorized && (
                 <div className="pt-6 mt-6 border-t border-zinc-800 flex justify-end">
                   <button
                     onClick={handleGenerate}
                     className="text-xs text-gray-500 hover:text-purple-400 transition-colors flex items-center gap-1"
                   >
                     <Sparkles className="w-3 h-3" />
                     Regenerate Analysis
                   </button>
                 </div>
               )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-3 bg-zinc-950/50 border-t border-zinc-800 rounded-b-xl text-[10px] text-center text-gray-600 font-mono">
          AI GENERATED CONTENT • NOT LEGAL ADVICE • TROLL CITY JURISDICTION
        </div>
      </div>
    </div>
  );
}
