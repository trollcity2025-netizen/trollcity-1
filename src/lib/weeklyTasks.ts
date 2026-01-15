import { useState } from 'react';
import { supabase } from './supabase';
import { subscribeEvents, TrollEvent, TrollEventType } from './events';
import { useAuthStore } from './store';

export type TaskTier = 'easy' | 'medium' | 'hard';

export type ProgressType = 'count' | 'boolean' | 'time' | 'score' | 'ai_evaluated';

export type WeeklyTaskDefinition = {
  id: string;
  task_id: string;
  name: string;
  description: string;
  tier: TaskTier;
  category: string;
  progress_type: ProgressType;
  target_value: number;
  reward_schema: any;
  completion_conditions: any;
  dependencies: string[];
  failure_conditions: any;
  is_repeatable: boolean;
  reset_cycle: string;
};

export type WeeklyTaskProgressRow = {
  id: string;
  task_id: string;
  user_id: string;
  weekly_cycle_id: string;
  progress_value: number;
  completion_percentage: number;
  is_completed: boolean;
  is_failed: boolean;
};

export type WeeklyTaskWithProgress = WeeklyTaskDefinition & {
  progress_value: number;
  completion_percentage: number;
  is_completed: boolean;
  is_failed: boolean;
};

type InternalTaskHandler = (event: TrollEvent, task: WeeklyTaskDefinition) => number | null;

const handlers: Record<TrollEventType, InternalTaskHandler[]> = {
  chat_message_sent: [],
  reaction_added: [],
  district_entered: [],
  stream_watch_time: [],
  coin_spent: [],
  court_event: [],
  war_match_end: [],
  ai_decision_event: [],
  economy_loss: [],
  economy_gain: []
};

registerTaskHandler('ai_decision_event', (event, task) => {
  if (task.progress_type !== 'ai_evaluated') return null;
  const decision = event.metadata?.decision;
  if (!decision) return null;
  const score = typeof decision.score === 'number' ? decision.score : 0;
  if (!Number.isFinite(score) || score <= 0) return 0;
  const clampedScore = Math.max(0, Math.min(100, score));
  const target = task.target_value > 0 ? task.target_value : 1;
  return (clampedScore / 100) * target;
});

export function registerTaskHandler(eventType: TrollEventType, handler: InternalTaskHandler) {
  handlers[eventType].push(handler);
}

async function getCurrentWeekId(): Promise<string | null> {
  const { data, error } = await supabase.rpc('troll_wars_current_week');
  if (error) {
    console.error('troll_wars_current_week error', error);
    return null;
  }
  if (!data) return null;
  return String(data);
}

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value * 100) / 100;
}

function computeNewProgress(
  task: WeeklyTaskDefinition,
  current: WeeklyTaskProgressRow | null,
  delta: number
) {
  const base = current ? Number(current.progress_value || 0) : 0;
  let nextValue = base;

  if (task.progress_type === 'boolean') {
    nextValue = delta > 0 ? 1 : 0;
  } else {
    nextValue = base + delta;
  }

  if (nextValue < 0) nextValue = 0;

  const target = task.target_value > 0 ? task.target_value : 1;
  let percentage = (nextValue / target) * 100;
  if (task.progress_type === 'boolean') {
    percentage = nextValue >= 1 ? 100 : 0;
  }

  const completion_percentage = clampPercentage(percentage);
  const is_completed = completion_percentage >= 100;

  return {
    progress_value: nextValue,
    completion_percentage,
    is_completed
  };
}

async function upsertProgressForEvent(event: TrollEvent, task: WeeklyTaskDefinition, delta: number) {
  if (delta === 0) return;

  const weekId = await getCurrentWeekId();
  if (!weekId) return;

  const { data: existing } = await supabase
    .from('troll_wars_task_progress')
    .select('*')
    .eq('task_id', task.id)
    .eq('user_id', event.userId)
    .eq('weekly_cycle_id', weekId)
    .maybeSingle();

  const current = existing as WeeklyTaskProgressRow | null;

  const next = computeNewProgress(task, current, delta);

  const payload = {
    task_id: task.id,
    user_id: event.userId,
    weekly_cycle_id: weekId,
    progress_value: next.progress_value,
    completion_percentage: next.completion_percentage,
    is_completed: next.is_completed,
    last_event_type: event.type,
    last_event_metadata: event.metadata || {}
  };

  if (current) {
    await supabase
      .from('troll_wars_task_progress')
      .update(payload)
      .eq('id', current.id);
  } else {
    await supabase.from('troll_wars_task_progress').insert(payload);
  }
}

async function loadActiveTasks(): Promise<WeeklyTaskDefinition[]> {
  const { data, error } = await supabase
    .from('troll_wars_tasks')
    .select('*')
    .eq('is_active', true);
  if (error) {
    console.error('loadActiveTasks error', error);
    return [];
  }
  return (data || []) as WeeklyTaskDefinition[];
}

export async function getWeeklyTasksForUser(userId: string): Promise<WeeklyTaskWithProgress[]> {
  if (!userId) return [];
  const weekId = await getCurrentWeekId();
  if (!weekId) return [];

  const tasks = await loadActiveTasks();

  if (tasks.length === 0) return [];

  const { data: progressRows, error } = await supabase
    .from('troll_wars_task_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('weekly_cycle_id', weekId);

  if (error) {
    console.error('getWeeklyTasksForUser progress error', error);
  }

  const progressMap = new Map<string, WeeklyTaskProgressRow>();
  (progressRows || []).forEach(row => {
    progressMap.set(row.task_id, row as WeeklyTaskProgressRow);
  });

  return tasks.map(task => {
    const progress = progressMap.get(task.id) || null;
    return {
      ...task,
      progress_value: progress ? Number(progress.progress_value || 0) : 0,
      completion_percentage: progress ? Number(progress.completion_percentage || 0) : 0,
      is_completed: progress ? !!progress.is_completed : false,
      is_failed: progress ? !!progress.is_failed : false
    };
  });
}

export function startWeeklyTaskEngine() {
  const unsub = subscribeEvents(async event => {
    try {
      const tasks = await loadActiveTasks();
      if (tasks.length === 0) return;

      const byCategory = new Map<string, WeeklyTaskDefinition[]>();
      tasks.forEach(task => {
        const list = byCategory.get(task.category) || [];
        list.push(task);
        byCategory.set(task.category, list);
      });

      const matchingHandlers = handlers[event.type] || [];
      if (matchingHandlers.length === 0) return;

      for (const task of tasks) {
        for (const handler of matchingHandlers) {
          const delta = handler(event, task);
          if (delta === null || delta === 0) continue;
          await upsertProgressForEvent(event, task, delta);
        }
      }
    } catch (err) {
      console.error('Weekly task engine error', err);
    }
  });

  return unsub;
}

export function useWeeklyTasks() {
  const user = useAuthStore(s => s.user);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<WeeklyTaskWithProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getWeeklyTasksForUser(user.id);
      setTasks(data);
    } catch (err: any) {
      console.error('useWeeklyTasks refresh error', err);
      setError(err?.message || 'Failed to load weekly tasks');
    } finally {
      setLoading(false);
    }
  };

  return {
    tasks,
    loading,
    error,
    refresh
  };
}
