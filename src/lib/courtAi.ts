import { supabase } from '../lib/supabase';
import { emitEvent } from './events';

// Types
export type CourtAgentRole = 'Prosecutor' | 'Defense';
export type CourtMessageType =
  | 'statement'
  | 'objection'
  | 'question'
  | 'contradiction'
  | 'missing_evidence'
  | 'civility_warning'
  | 'chat';

interface CourtAiResponse {
  referenced_evidence_ids: string[];
  referenced_transcript_ids: string[];
  confidence: number;
  suggested_next_action: 'ask_for_evidence' | 'objection' | 'reframe' | 'none';
  safety_note: string;
  message_content: string;
  message_type: CourtMessageType;
}

// Prompts
const SYSTEM_PROMPT_BASE = `
You are an AI Agent in Troll Court, a roleplay courtroom in Troll City.
Your goal is to roleplay your role (Prosecutor or Defense) strictly.
IN-GAME ROLEPLAY ONLY. NOT LEGAL ADVICE.
Always maintain the persona.

OUTPUT FORMAT:
You must respond with a JSON object ONLY:
{
  "referenced_evidence_ids": ["id1", "id2"],
  "referenced_transcript_ids": ["id1"],
  "confidence": 0.9,
  "suggested_next_action": "objection",
  "safety_note": "IN-GAME ROLEPLAY — NOT LEGAL ADVICE",
  "message_content": "Your spoken text here...",
  "message_type": "objection"
}

Valid message_types: 'statement', 'objection', 'question', 'contradiction', 'missing_evidence', 'civility_warning'.
If you have nothing to say, return "suggested_next_action": "none" and empty message_content.
`;

const PROSECUTOR_PROMPT = `
You are the TROLL PROSECUTOR.
Your job is to prove the defendant is GUILTY of the charges.
Be aggressive but fair. Point out contradictions. Demand evidence.
Use "Troll Law" concepts (e.g., "Section 420.69 of the Troll Code").
`;

const DEFENSE_PROMPT = `
You are the TROLL DEFENSE COUNSEL.
Your job is to defend the defendant. Frame actions as misunderstandings, jokes, or "just trolling".
Protect your client. Object to hearsay.
`;

function getOpenAiApiKey() {
  const key = (import.meta as any).env.VITE_OPENAI_API_KEY as string | undefined;
  return key || '';
}

const ALLOWED_MESSAGE_TYPES: CourtMessageType[] = [
  'statement',
  'objection',
  'question',
  'contradiction',
  'missing_evidence',
  'civility_warning',
  'chat',
];

interface RateLimitOptions {
  highActivity?: boolean;
}

async function checkRateLimit(
  caseId: string,
  role: CourtAgentRole,
  options?: RateLimitOptions
): Promise<boolean> {
  const { data: limit } = await supabase
    .from('court_ai_rate_limits')
    .select('*')
    .eq('case_id', caseId)
    .eq('agent_role', role)
    .single();

  if (!limit) return true;

  const now = new Date();
  const windowStart = new Date(limit.window_start);
  const diffMinutes = (now.getTime() - windowStart.getTime()) / 60000;

  const highActivity = options?.highActivity === true;
  const maxInterruptions = highActivity ? 3 : 5;
  const cooldownMs = highActivity ? 60000 : 30000;

  if (diffMinutes > 10) {
    await supabase
      .from('court_ai_rate_limits')
      .update({
        interruptions_count: 0,
        window_start: now.toISOString()
      })
      .eq('id', limit.id);
    return true;
  }

  if (limit.interruptions_count >= maxInterruptions) return false;

  if (limit.last_interruption_at) {
    const last = new Date(limit.last_interruption_at);
    if (now.getTime() - last.getTime() < cooldownMs) return false;
  }

  return true;
}

async function updateRateLimit(caseId: string, role: CourtAgentRole) {
  const { data: limit } = await supabase
    .from('court_ai_rate_limits')
    .select('*')
    .eq('case_id', caseId)
    .eq('agent_role', role)
    .single();

  if (limit) {
    await supabase
      .from('court_ai_rate_limits')
      .update({
        interruptions_count: limit.interruptions_count + 1,
        last_interruption_at: new Date().toISOString()
      })
      .eq('id', limit.id);
  } else {
    await supabase.from('court_ai_rate_limits').insert({
      case_id: caseId,
      agent_role: role,
      interruptions_count: 1,
      window_start: new Date().toISOString(),
      last_interruption_at: new Date().toISOString()
    });
  }
}

export async function generateCourtAiResponse(
  caseId: string,
  role: CourtAgentRole,
  context: {
    recentMessages: {
      id: string;
      user: string;
      message: string;
      messageType?: CourtMessageType;
    }[];
    caseDetails: any;
    evidence: { id?: string; title?: string; type?: string }[];
    highActivityMode?: boolean;
    userId?: string;
  }
): Promise<CourtAiResponse | null> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) return null;

  const canSpeak = await checkRateLimit(caseId, role, {
    highActivity: context.highActivityMode,
  });
  if (!canSpeak) return null;

  const rolePrompt = role === 'Prosecutor' ? PROSECUTOR_PROMPT : DEFENSE_PROMPT;
  const contextStr = JSON.stringify({
    case_type: context.caseDetails.case_type,
    charges: context.caseDetails.title,
    recent_transcript: context.recentMessages
      .map((m) => `${m.user}: ${m.message}`)
      .join('\n'),
    evidence_available: context.evidence
      .map((e) => `${e.id}: ${e.title} (${e.type})`)
      .join('\n'),
  });

  const body = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_BASE + '\n' + rolePrompt },
      {
        role: 'user',
        content: `Current Court Context:\n${contextStr}\n\nAnalyze and react if necessary.`,
      },
    ],
    temperature: 0.7
  };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    let parsed: CourtAiResponse;
    try {
      parsed = JSON.parse(content);
    } catch {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start >= 0) {
        parsed = JSON.parse(content.slice(start, end + 1));
      } else {
        return null;
      }
    }

    if (!parsed) return null;

    const validEvidenceIds = (context.evidence || [])
      .map((e) => (e.id != null ? String(e.id) : null))
      .filter((id): id is string => Boolean(id));

    const validTranscriptIds = (context.recentMessages || [])
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id));

    if (!Array.isArray(parsed.referenced_evidence_ids)) {
      parsed.referenced_evidence_ids = [];
    }

    if (!Array.isArray(parsed.referenced_transcript_ids)) {
      parsed.referenced_transcript_ids = [];
    }

    parsed.referenced_evidence_ids = parsed.referenced_evidence_ids.filter((id) =>
      validEvidenceIds.includes(String(id))
    );

    parsed.referenced_transcript_ids = parsed.referenced_transcript_ids.filter((id) =>
      validTranscriptIds.includes(String(id))
    );

    if (parsed.confidence == null || Number.isNaN(parsed.confidence)) {
      parsed.confidence = 0.5;
    } else {
      parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));
    }

    if (
      parsed.suggested_next_action !== 'ask_for_evidence' &&
      parsed.suggested_next_action !== 'objection' &&
      parsed.suggested_next_action !== 'reframe' &&
      parsed.suggested_next_action !== 'none'
    ) {
      parsed.suggested_next_action = 'none';
    }

    if (!parsed.safety_note) {
      parsed.safety_note = 'IN-GAME ROLEPLAY — NOT LEGAL ADVICE';
    } else {
      parsed.safety_note = 'IN-GAME ROLEPLAY — NOT LEGAL ADVICE';
    }

    if (!ALLOWED_MESSAGE_TYPES.includes(parsed.message_type)) {
      parsed.message_type = 'statement';
    }

    if (!parsed.message_content) {
      parsed.message_content = '';
    }

    if (parsed.suggested_next_action === 'none') return null;

    await updateRateLimit(caseId, role);
    
    await supabase.from('court_ai_messages').insert({
      case_id: caseId,
      agent_role: role,
      message_type: parsed.message_type,
      content: parsed.message_content,
      json_data: parsed,
      created_at: new Date().toISOString()
    });

    if (context.userId) {
      emitEvent('ai_decision_event', context.userId, {
        caseId,
        role,
        decision: parsed,
        referenced_evidence_ids: parsed.referenced_evidence_ids,
        referenced_transcript_ids: parsed.referenced_transcript_ids
      });
    }

    return parsed;

  } catch (err) {
    console.error('Court AI Error:', err);
    return null;
  }
}

export async function getCourtSessionState(caseId: string) {
  const { data } = await supabase
    .from('court_session_state')
    .select('*')
    .eq('case_id', caseId)
    .single();
  return data;
}

export async function toggleCourtSession(caseId: string, userId: string, isLive: boolean) {
  const { data: existing } = await supabase
    .from('court_session_state')
    .select('*')
    .eq('case_id', caseId)
    .single();

  if (existing) {
    await supabase
      .from('court_session_state')
      .update({
        is_live: isLive,
        started_by: isLive ? userId : existing.started_by,
        started_at: isLive ? new Date().toISOString() : existing.started_at,
        ended_at: isLive ? null : new Date().toISOString()
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('court_session_state').insert({
      case_id: caseId,
      is_live: isLive,
      started_by: userId,
      started_at: new Date().toISOString(),
      ai_enabled: true
    });
  }
}

export async function generateSummaryFeedback(
  caseId: string,
  userId: string,
  role: CourtAgentRole, // Agent role giving feedback
  summaryText: string
) {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) return;

  const prompt = `
You are the ${role} in Troll Court, a roleplay courtroom.
Review the following participant summary and provide constructive, in-character feedback.
Do not provide real-world legal advice. Keep all consequences in-game only.

Summary: "${summaryText}"

Respond with a single JSON object only:
{
  "feedback_text": "your readable feedback",
  "score": 0-100,
  "referenced_evidence_ids": [],
  "referenced_transcript_ids": [],
  "confidence": 0.9,
  "suggested_next_action": "reframe",
  "safety_note": "IN-GAME ROLEPLAY — NOT LEGAL ADVICE"
}
`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
      })
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return;

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start >= 0) {
        parsed = JSON.parse(content.slice(start, end + 1));
      } else {
        return;
      }
    }

    if (!parsed) return;

    if (!parsed.safety_note) {
      parsed.safety_note = 'IN-GAME ROLEPLAY — NOT LEGAL ADVICE';
    } else {
      parsed.safety_note = 'IN-GAME ROLEPLAY — NOT LEGAL ADVICE';
    }

    if (parsed.feedback_text) {
      await supabase.from('court_ai_feedback').insert({
        case_id: caseId,
        agent_role: role,
        target_user_id: userId,
        feedback_text: parsed.feedback_text,
        json_data: parsed
      });
    }
  } catch (err) {
    console.error('Feedback Error:', err);
  }
}
