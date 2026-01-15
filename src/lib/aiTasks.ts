import { supabase } from './supabase';

type AiTaskContext = {
  userId: string;
  taskId: string;
  prompt: string;
  metadata?: Record<string, any>;
};

type AiTaskResult = {
  success: boolean;
  score: number;
  outcome: any;
};

function getOpenAiApiKey() {
  const key = (import.meta as any).env.VITE_OPENAI_API_KEY as string | undefined;
  return key || '';
}

function buildSeed(userId: string, taskId: string) {
  const base = `${userId}:${taskId}:${new Date().toISOString().slice(0, 10)}`;
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    const chr = base.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

export async function runAiTaskSimulation(context: AiTaskContext): Promise<AiTaskResult> {
  const apiKey = getOpenAiApiKey();
  const model = 'gpt-4.1-mini';
  const seed = buildSeed(context.userId, context.taskId);

  const body = {
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are the Troll City game judge. Return a JSON object with fields { "success": boolean, "score": number, "details": object }. Score must be between 0 and 100.'
      },
      {
        role: 'user',
        content: context.prompt
      }
    ],
    temperature: 0.2,
    seed
  };

  let responseJson: any = null;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: apiKey ? `Bearer ${apiKey}` : '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const raw = await res.json();
    responseJson = raw;

    const content = raw?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error('Invalid AI response content');
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start >= 0 && end > start) {
        parsed = JSON.parse(content.slice(start, end + 1));
      } else {
        throw new Error('AI content is not valid JSON');
      }
    }

    const success = !!parsed.success;
    const score = typeof parsed.score === 'number' ? parsed.score : 0;

    await supabase.from('troll_wars_ai_battle_logs').insert({
      user_id: context.userId,
      task_id: context.taskId,
      battle_type: 'ai_task',
      input_payload: {
        prompt: context.prompt,
        metadata: context.metadata || {}
      },
      ai_model: model,
      ai_temperature: 0.2,
      random_seed: seed,
      outcome: parsed,
      score
    });

    return {
      success,
      score,
      outcome: parsed
    };
  } catch (err) {
    await supabase.from('troll_wars_ai_battle_logs').insert({
      user_id: context.userId,
      task_id: context.taskId,
      battle_type: 'ai_task_error',
      input_payload: {
        prompt: context.prompt,
        metadata: context.metadata || {}
      },
      ai_model: 'error',
      ai_temperature: null,
      random_seed: buildSeed(context.userId, context.taskId),
      outcome: {
        error: (err as any)?.message || 'AI task failure',
        raw: responseJson
      },
      score: 0
    });

    return {
      success: false,
      score: 0,
      outcome: {
        error: (err as any)?.message || 'AI task failure'
      }
    };
  }
}

