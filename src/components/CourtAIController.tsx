import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  generateCourtAiResponse, 
  CourtAgentRole, 
  getCourtSessionState, 
  toggleCourtSession 
} from '../lib/courtAi';
import { toast } from 'sonner';

interface CourtAIControllerProps {
  caseId: string;
  isJudge: boolean;
  evidence: any[];
  caseDetails: any;
}

export default function CourtAIController({ caseId, isJudge, evidence, caseDetails }: CourtAIControllerProps) {
  const [isLive, setIsLive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionState, setSessionState] = useState<any | null>(null);
  const [highActivity, setHighActivity] = useState(false);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!caseId) return;
    getCourtSessionState(caseId).then(state => {
      if (state) {
        setIsLive(Boolean(state.is_live));
        setSessionState(state);
      } else {
        setIsLive(false);
        setSessionState(null);
      }
    });

    const channel = supabase
      .channel(`court_state_${caseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'court_session_state',
          filter: `case_id=eq.${caseId}`
        },
        (payload) => {
          const newState = payload.new as any;
          if (newState) {
            setIsLive(Boolean(newState.is_live));
            setSessionState(newState);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [caseId]);

  useEffect(() => {
    if (!isJudge || !isLive || !caseId) return;
    if (sessionState && sessionState.ai_enabled === false) return;

    console.log('[CourtAI] Judge Logic Active - Listening for events...');

    const channel = supabase
      .channel(`court_ai_trigger_${caseId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'court_ai_messages',
          filter: `case_id=eq.${caseId}`
        },
        async (payload) => {
          const msg = payload.new as any;
          
          if (msg.agent_role === 'Prosecutor' || msg.agent_role === 'Defense' || msg.agent_role === 'System') return;

          if (processingRef.current) return;
          
          processingRef.current = true;
          setIsProcessing(true);

          try {
            const { data: recent } = await supabase
              .from('court_ai_messages')
              .select('*')
              .eq('case_id', caseId)
              .order('created_at', { ascending: false })
              .limit(10);

            const context = {
              recentMessages: (recent || []).reverse().map(r => ({
                id: r.id,
                user: r.agent_role,
                message: r.content,
                messageType: r.message_type,
              })),
              caseDetails,
              evidence,
              highActivityMode: highActivity,
            };

            const allowProsecutor =
              !sessionState || sessionState.prosecutor_enabled !== false;
            const allowDefense =
              !sessionState ||
              (sessionState.defense_enabled !== false &&
                sessionState.defense_counsel_mode === true);

            let prosecutorRes = null;

            if (allowProsecutor) {
              prosecutorRes = await generateCourtAiResponse(
                caseId,
                'Prosecutor',
                context
              );
            }

            if (!prosecutorRes && allowDefense) {
              await generateCourtAiResponse(caseId, 'Defense', context);
            }

          } catch (err) {
            console.error('AI Trigger Error:', err);
          } finally {
            processingRef.current = false;
            setIsProcessing(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [caseId, isJudge, isLive, evidence, caseDetails, highActivity, sessionState]);

  const handleToggleSession = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) {
        toast.error('Not authenticated');
        return;
      }
      await toggleCourtSession(caseId, userId, !isLive);
      toast.success(isLive ? 'Court Session Paused' : 'Court Session LIVE');
    } catch (err) {
      toast.error('Failed to toggle session');
    }
  };

  if (!isJudge) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-black/80 backdrop-blur border border-purple-500/30 rounded-lg p-3 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="font-bold text-sm text-white">
            AI Session: {isLive ? 'LIVE' : 'PAUSED'}
          </span>
          <button
            onClick={handleToggleSession}
            className={`px-3 py-1 rounded text-xs font-bold ${
              isLive ? 'bg-red-900/50 text-red-200 hover:bg-red-900' : 'bg-green-900/50 text-green-200 hover:bg-green-900'
            }`}
          >
            {isLive ? 'STOP' : 'START'}
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-200">
          <button
            type="button"
            disabled={!isLive}
            onClick={() => {
              if (!sessionState) return;
              supabase
                .from('court_session_state')
                .update({
                  ai_enabled: sessionState.ai_enabled === false,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', sessionState.id);
            }}
            className={`px-2 py-1 rounded border ${
              sessionState && sessionState.ai_enabled === false
                ? 'border-zinc-600 text-zinc-400'
                : 'border-purple-500 text-purple-200'
            }`}
          >
            AI {sessionState && sessionState.ai_enabled === false ? 'OFF' : 'ON'}
          </button>
          <button
            type="button"
            disabled={!isLive}
            onClick={() => {
              if (!sessionState) return;
              supabase
                .from('court_session_state')
                .update({
                  prosecutor_enabled: sessionState.prosecutor_enabled === false,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', sessionState.id);
            }}
            className={`px-2 py-1 rounded border ${
              sessionState && sessionState.prosecutor_enabled === false
                ? 'border-zinc-600 text-zinc-400'
                : 'border-red-500 text-red-200'
            }`}
          >
            Prosecutor {sessionState && sessionState.prosecutor_enabled === false ? 'OFF' : 'ON'}
          </button>
          <button
            type="button"
            disabled={!isLive}
            onClick={() => {
              if (!sessionState) return;
              supabase
                .from('court_session_state')
                .update({
                  defense_enabled: sessionState.defense_enabled === false,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', sessionState.id);
            }}
            className={`px-2 py-1 rounded border ${
              sessionState && sessionState.defense_enabled === false
                ? 'border-zinc-600 text-zinc-400'
                : 'border-blue-500 text-blue-200'
            }`}
          >
            Defense {sessionState && sessionState.defense_enabled === false ? 'OFF' : 'ON'}
          </button>
          <button
            type="button"
            disabled={!isLive}
            onClick={() => setHighActivity((prev) => !prev)}
            className={`px-2 py-1 rounded border ${
              highActivity ? 'border-amber-500 text-amber-200' : 'border-zinc-600 text-zinc-400'
            }`}
          >
            High Activity {highActivity ? 'ON' : 'OFF'}
          </button>
        </div>
        {isProcessing && (
           <div className="text-[10px] text-purple-300 mt-1 text-center animate-pulse">
             AI Processing...
           </div>
        )}
      </div>
    </div>
  );
}
