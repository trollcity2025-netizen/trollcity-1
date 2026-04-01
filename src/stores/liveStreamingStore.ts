import { create } from 'zustand'
import { supabase } from '../lib/supabase'

// Types
interface StreamMission {
  id: string
  stream_id: string
  mission_template_id: string
  mission_type: 'solo' | 'community' | 'competitive' | 'timed'
  title: string
  description: string
  icon: string
  target_value: number
  current_value: number
  reward_xp: number
  reward_coins: number
  reward_badge_id: string | null
  status: 'active' | 'completed' | 'expired' | 'failed'
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary'
  is_chain: boolean
  chain_order: number
  expires_at: string | null
  started_at: string
  completed_at: string | null
}

interface StreamGoal {
  id: string
  stream_id: string
  goal_type: string
  title: string
  target_value: number
  current_value: number
  icon: string
  color: string
  is_completed: boolean
}

interface StreamPoll {
  id: string
  stream_id: string
  question: string
  options: Array<{ label: string; votes: number; color: string }>
  total_votes: number
  status: 'active' | 'completed' | 'cancelled'
  expires_at: string | null
  created_at: string
}

interface StreamMilestone {
  id: string
  stream_id: string
  milestone_type: string
  title: string
  threshold: number
  current_value: number
  icon: string
  is_reached: boolean
  reached_at: string | null
}

interface EnergyMeter {
  current_energy: number
  max_energy: number
  level: 'calm' | 'warming' | 'hot' | 'fire' | 'inferno'
  recent_actions: Array<{ type: string; value: number; timestamp: string }>
}

interface FanTier {
  id: string
  user_id: string
  display_name: string
  avatar_url: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legendary'
  total_coins: number
  total_gifts: number
  total_watch_time: number
  level: number
  diamond_tier: string
}

interface AudioQueueItem {
  id: string
  audio_url: string
  audio_type: 'entrance' | 'voice_over' | 'custom'
  priority: number
  user_id: string
  display_name: string
  level: number
  status: 'queued' | 'playing' | 'completed' | 'skipped'
}

interface LiveStreamingState {
  // Missions
  missions: StreamMission[]
  missionsLoading: boolean
  setMissions: (missions: StreamMission[]) => void
  updateMissionProgress: (missionId: string, value: number) => void
  addMission: (mission: StreamMission) => void
  completeMission: (missionId: string) => void
  fetchMissions: (streamId: string) => Promise<void>

  // Goals
  goals: StreamGoal[]
  goalsLoading: boolean
  setGoals: (goals: StreamGoal[]) => void
  updateGoalProgress: (goalId: string, value: number) => void
  fetchGoals: (streamId: string) => Promise<void>

  // Polls
  polls: StreamPoll[]
  activePoll: StreamPoll | null
  pollsLoading: boolean
  setPolls: (polls: StreamPoll[]) => void
  setActivePoll: (poll: StreamPoll | null) => void
  votePoll: (pollId: string, optionIndex: number) => void
  fetchPolls: (streamId: string) => Promise<void>

  // Milestones
  milestones: StreamMilestone[]
  milestonesLoading: boolean
  setMilestones: (milestones: StreamMilestone[]) => void
  updateMilestone: (milestoneId: string, value: number) => void
  fetchMilestones: (streamId: string) => Promise<void>

  // Energy
  energy: EnergyMeter
  setEnergy: (energy: Partial<EnergyMeter>) => void
  boostEnergy: (value: number, actionType: string) => void
  fetchEnergy: (streamId: string) => Promise<void>

  // Fan Tiers
  fanTiers: FanTier[]
  fanTiersLoading: boolean
  setFanTiers: (tiers: FanTier[]) => void
  fetchFanTiers: (streamId: string) => Promise<void>

  // Audio Queue
  audioQueue: AudioQueueItem[]
  currentAudio: AudioQueueItem | null
  addToQueue: (item: AudioQueueItem) => void
  playNext: () => void
  skipCurrent: () => void
  clearQueue: () => void

  // Stream Stats
  streamStats: {
    viewer_count: number
    peak_viewers: number
    total_coins: number
    total_gifts: number
    chat_messages: number
    stream_duration: number
  }
  updateStreamStats: (stats: Partial<LiveStreamingState['streamStats']>) => void

  // Realtime subscriptions
  subscriptions: Map<string, any>
  subscribe: (streamId: string) => void
  unsubscribe: () => void
}

export const useLiveStreamingStore = create<LiveStreamingState>((set, get) => ({
  // Missions
  missions: [],
  missionsLoading: false,
  setMissions: (missions) => set({ missions }),
  updateMissionProgress: (missionId, value) => set((state) => ({
    missions: state.missions.map(m =>
      m.id === missionId
        ? { ...m, current_value: Math.min(value, m.target_value), status: value >= m.target_value ? 'completed' : m.status, completed_at: value >= m.target_value ? new Date().toISOString() : null }
        : m
    )
  })),
  addMission: (mission) => set((state) => ({ missions: [...state.missions, mission] })),
  completeMission: (missionId) => set((state) => ({
    missions: state.missions.map(m =>
      m.id === missionId ? { ...m, status: 'completed', completed_at: new Date().toISOString() } : m
    )
  })),
  fetchMissions: async (streamId) => {
    set({ missionsLoading: true })
    try {
      const { data } = await supabase.from('stream_missions').select('*').eq('stream_id', streamId).in('status', ['active', 'completed']).order('started_at', { ascending: true })
      if (data) set({ missions: data })
    } finally {
      set({ missionsLoading: false })
    }
  },

  // Goals
  goals: [],
  goalsLoading: false,
  setGoals: (goals) => set({ goals }),
  updateGoalProgress: (goalId, value) => set((state) => ({
    goals: state.goals.map(g =>
      g.id === goalId ? { ...g, current_value: value, is_completed: value >= g.target_value } : g
    )
  })),
  fetchGoals: async (streamId) => {
    set({ goalsLoading: true })
    try {
      const { data } = await supabase.from('stream_goals').select('*').eq('stream_id', streamId).order('created_at', { ascending: true })
      if (data) set({ goals: data })
    } finally {
      set({ goalsLoading: false })
    }
  },

  // Polls
  polls: [],
  activePoll: null,
  pollsLoading: false,
  setPolls: (polls) => set({ polls }),
  setActivePoll: (poll) => set({ activePoll: poll }),
  votePoll: (pollId, optionIndex) => set((state) => ({
    polls: state.polls.map(p => {
      if (p.id !== pollId) return p
      const options = [...p.options]
      options[optionIndex] = { ...options[optionIndex], votes: options[optionIndex].votes + 1 }
      return { ...p, options, total_votes: p.total_votes + 1 }
    }),
    activePoll: state.activePoll?.id === pollId
      ? { ...state.activePoll, options: state.activePoll.options.map((o, i) => i === optionIndex ? { ...o, votes: o.votes + 1 } : o), total_votes: state.activePoll.total_votes + 1 }
      : state.activePoll
  })),
  fetchPolls: async (streamId) => {
    set({ pollsLoading: true })
    try {
      const { data } = await supabase.from('stream_polls').select('*').eq('stream_id', streamId).order('created_at', { ascending: false })
      if (data) {
        set({ polls: data })
        const active = data.find(p => p.status === 'active')
        if (active) set({ activePoll: active })
      }
    } finally {
      set({ pollsLoading: false })
    }
  },

  // Milestones
  milestones: [],
  milestonesLoading: false,
  setMilestones: (milestones) => set({ milestones }),
  updateMilestone: (milestoneId, value) => set((state) => ({
    milestones: state.milestones.map(m =>
      m.id === milestoneId ? { ...m, current_value: value, is_reached: value >= m.threshold, reached_at: value >= m.threshold ? new Date().toISOString() : m.reached_at } : m
    )
  })),
  fetchMilestones: async (streamId) => {
    set({ milestonesLoading: true })
    try {
      const { data } = await supabase.from('stream_milestones').select('*').eq('stream_id', streamId).order('threshold', { ascending: true })
      if (data) set({ milestones: data })
    } finally {
      set({ milestonesLoading: false })
    }
  },

  // Energy
  energy: { current_energy: 0, max_energy: 1000, level: 'calm', recent_actions: [] },
  setEnergy: (energy) => set((state) => ({ energy: { ...state.energy, ...energy } })),
  boostEnergy: (value, actionType) => set((state) => {
    const newEnergy = Math.min(state.energy.current_energy + value, state.energy.max_energy)
    let level: EnergyMeter['level'] = 'calm'
    if (newEnergy >= 800) level = 'inferno'
    else if (newEnergy >= 600) level = 'fire'
    else if (newEnergy >= 400) level = 'hot'
    else if (newEnergy >= 200) level = 'warming'
    return {
      energy: {
        ...state.energy,
        current_energy: newEnergy,
        level,
        recent_actions: [{ type: actionType, value, timestamp: new Date().toISOString() }, ...state.energy.recent_actions.slice(0, 19)]
      }
    }
  }),
  fetchEnergy: async (streamId) => {
    try {
      const { data } = await supabase.from('stream_energy_meter').select('*').eq('stream_id', streamId).single()
      if (data) set({ energy: { ...get().energy, ...data } })
    } catch { /* first stream may not have energy yet */ }
  },

  // Fan Tiers
  fanTiers: [],
  fanTiersLoading: false,
  setFanTiers: (tiers) => set({ fanTiers: tiers }),
  fetchFanTiers: async (streamId) => {
    set({ fanTiersLoading: true })
    try {
      const { data } = await supabase.from('stream_fan_tiers').select('*').eq('stream_id', streamId).order('total_coins', { ascending: false }).limit(20)
      if (data) set({ fanTiers: data })
    } finally {
      set({ fanTiersLoading: false })
    }
  },

  // Audio Queue
  audioQueue: [],
  currentAudio: null,
  addToQueue: (item) => set((state) => {
    const queue = [...state.audioQueue, item].sort((a, b) => b.priority - a.priority)
    return { audioQueue: queue, currentAudio: state.currentAudio || queue[0] }
  }),
  playNext: () => set((state) => {
    const queue = state.audioQueue.filter(a => a.id !== state.currentAudio?.id)
    const next = queue[0] || null
    if (next) {
      next.status = 'playing'
    }
    return { audioQueue: queue, currentAudio: next }
  }),
  skipCurrent: () => set((state) => {
    if (state.currentAudio) state.currentAudio.status = 'skipped'
    const queue = state.audioQueue.filter(a => a.id !== state.currentAudio?.id)
    return { audioQueue: queue, currentAudio: queue[0] || null }
  }),
  clearQueue: () => set({ audioQueue: [], currentAudio: null }),

  // Stream Stats
  streamStats: { viewer_count: 0, peak_viewers: 0, total_coins: 0, total_gifts: 0, chat_messages: 0, stream_duration: 0 },
  updateStreamStats: (stats) => set((state) => ({ streamStats: { ...state.streamStats, ...stats } })),

  // Realtime
  subscriptions: new Map(),
  subscribe: (streamId) => {
    const subs = get().subscriptions
    if (subs.has(streamId)) return

    const missionSub = supabase.channel(`missions:${streamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_missions', filter: `stream_id=eq.${streamId}` }, (payload) => {
        if (payload.eventType === 'INSERT') get().addMission(payload.new as StreamMission)
        else if (payload.eventType === 'UPDATE') {
          const m = payload.new as StreamMission
          if (m.status === 'completed') get().completeMission(m.id)
          else get().updateMissionProgress(m.id, m.current_value)
        }
      })
      .subscribe()

    const goalSub = supabase.channel(`goals:${streamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_goals', filter: `stream_id=eq.${streamId}` }, (payload) => {
        if (payload.eventType === 'UPDATE') get().updateGoalProgress(payload.new.id, payload.new.current_value)
      })
      .subscribe()

    const pollSub = supabase.channel(`polls:${streamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_polls', filter: `stream_id=eq.${streamId}` }, (payload) => {
        if (payload.eventType === 'INSERT') set((s) => ({ polls: [payload.new as StreamPoll, ...s.polls], activePoll: payload.new as StreamPoll }))
        else if (payload.eventType === 'UPDATE') {
          const p = payload.new as StreamPoll
          set((s) => ({
            polls: s.polls.map(x => x.id === p.id ? p : x),
            activePoll: s.activePoll?.id === p.id ? p : s.activePoll
          }))
        }
      })
      .subscribe()

    const milestoneSub = supabase.channel(`milestones:${streamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_milestones', filter: `stream_id=eq.${streamId}` }, (payload) => {
        if (payload.eventType === 'UPDATE') get().updateMilestone(payload.new.id, payload.new.current_value)
      })
      .subscribe()

    const energySub = supabase.channel(`energy:${streamId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stream_energy_meter', filter: `stream_id=eq.${streamId}` }, (payload) => {
        get().setEnergy(payload.new as Partial<EnergyMeter>)
      })
      .subscribe()

    subs.set(streamId, { missionSub, goalSub, pollSub, milestoneSub, energySub })
  },
  unsubscribe: () => {
    const subs = get().subscriptions
    subs.forEach((channels) => {
      Object.values(channels).forEach((ch: any) => supabase.removeChannel(ch))
    })
    subs.clear()
  }
}))

export type { StreamMission, StreamGoal, StreamPoll, StreamMilestone, EnergyMeter, FanTier, AudioQueueItem }
