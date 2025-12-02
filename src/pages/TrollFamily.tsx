// src/pages/TrollFamily.tsx
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import {
  Users,
  Shield,
  Crown,
  Gift,
  Star,
  MapPin,
  Flame,
  Calendar,
  Trophy,
  Sparkles,
  Lock
} from 'lucide-react'

interface FamilyTask {
  id: string
  title: string
  description: string
  reward: string
  progress: number
  target: number
  completed: boolean
}

interface FamilyEvent {
  id: string
  title: string
  dateLabel: string
  description: string
  type: 'party' | 'competition' | 'raid'
}

export default function TrollFamily() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<FamilyTask[]>([])
  const [events, setEvents] = useState<FamilyEvent[]>([])

  // Load real data from database
  useEffect(() => {
    const loadFamilyData = async () => {
      if (!profile?.id) {
        setLoading(false)
        return
      }

      try {
        // Load tasks from database (if table exists)
        // For now, set empty arrays - data will come from database
        setTasks([])
        setEvents([])
      } catch (error) {
        console.error('Error loading family data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadFamilyData()
  }, [profile])

  const handleClaimReward = (taskId: string) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId ? { ...t, completed: true } : t
      )
    )

    const task = tasks.find(t => t.id === taskId)
    if (task) {
      toast.success(`Reward claimed: ${task.reward}`)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050015] text-white px-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-3xl font-bold tracking-wide">
            Troll Family Lounge
          </h1>
          <p className="text-gray-300">
            You need to be logged in to enter the Troll Family City.
          </p>
        </div>
      </div>
    )
  }

  // Check if user is in a troll family - refresh profile data
  useEffect(() => {
    const refreshProfile = async () => {
      if (!user?.id) return
      const { data } = await supabase
        .from('user_profiles')
        .select('troll_family_name, troll_family_role, is_troll_family_member')
        .eq('id', user.id)
        .single()
      if (data) {
        useAuthStore.getState().setProfile({ ...profile, ...data } as any)
      }
    }
    refreshProfile()
  }, [user?.id])

  const isInFamily =
    profile?.troll_family_name ||
    (profile as any)?.is_troll_family_member

  const familyName =
    profile?.troll_family_name || 'No Family Selected'

  const familyRole =
    (profile as any)?.troll_family_role || (isInFamily ? 'Member' : 'Visitor')

  return (
    <div
      className="min-h-screen text-white px-4 py-6"
      style={{
        background:
          'radial-gradient(circle at top, #3b0764 0, #020014 40%, #000000 100%)'
      }}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm uppercase tracking-[0.25em] text-purple-300">
              <Sparkles className="w-4 h-4" />
              Troll Family City
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold mt-1">
              Troll Family Lounge
            </h1>
            <p className="text-gray-300 mt-2 max-w-xl">
              Exclusive zone for Troll Families. Perks, events, and private
              chaos for the elite trolls of Troll City.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 text-sm">
              <Shield className="w-4 h-4 text-emerald-300" />
              <span className="text-emerald-300 font-semibold">
                {isInFamily ? 'Family Access Granted' : 'Visitor Mode'}
              </span>
            </div>
            <div className="text-right text-sm">
              <div className="font-semibold flex items-center justify-end gap-1">
                <Crown className="w-4 h-4 text-yellow-300" />
                {familyName}
              </div>
              <div className="text-gray-300 text-xs">
                Role: <span className="text-purple-300">{familyRole}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Map-style family city */}
        <section className="grid md:grid-cols-3 gap-4">
          <div className="col-span-2 bg-black/40 border border-purple-700/50 rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none opacity-40">
              <div className="absolute -left-10 top-8 w-64 h-64 rounded-full bg-purple-500/30 blur-3xl" />
              <div className="absolute right-0 bottom-0 w-64 h-64 rounded-full bg-emerald-500/20 blur-3xl" />
            </div>

            <div className="relative flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-purple-300" />
                <h2 className="font-semibold text-lg">Family City Map</h2>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-purple-900/70 border border-purple-500/60 text-purple-100">
                Glowing Zones Online
              </span>
            </div>

            <div className="relative grid grid-cols-3 gap-3 text-sm">
              <div className="bg-purple-900/40 border border-purple-500/60 rounded-xl p-3 hover:border-purple-300 transition">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Royal District</span>
                  <Crown className="w-4 h-4 text-yellow-300" />
                </div>
                <p className="text-xs text-gray-200 mt-1">
                  Home of the OG Trolls, leaders, and VIPs.
                </p>
                <div className="mt-2 text-[10px] text-purple-200">
                  ● Troll Mansions
                  <br />● Family Council Room
                </div>
              </div>

              <div className="bg-emerald-900/30 border border-emerald-500/60 rounded-xl p-3 hover:border-emerald-300 transition">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Grind Zone</span>
                  <Flame className="w-4 h-4 text-emerald-300" />
                </div>
                <p className="text-xs text-gray-200 mt-1">
                  Where Family coin grinders live & stream.
                </p>
                <div className="mt-2 text-[10px] text-emerald-200">
                  ● Coin Farms
                  <br />● Task Boards
                </div>
              </div>

              <div className="bg-pink-900/30 border border-pink-500/60 rounded-xl p-3 hover:border-pink-300 transition">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Secret Lounge</span>
                  <Lock className="w-4 h-4 text-pink-300" />
                </div>
                <p className="text-xs text-gray-200 mt-1">
                  Invite-only events, drops, and Family drama… in HD.
                </p>
                <div className="mt-2 text-[10px] text-pink-200">
                  ● Private Lives
                  <br />● Limited Troll Drops
                </div>
              </div>
            </div>
          </div>

          {/* Perks card */}
          <div className="bg-black/45 border border-purple-700/60 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-300" />
              <h2 className="font-semibold text-lg">Family Perks</h2>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Gift className="w-4 h-4 text-emerald-300 mt-0.5" />
                <div>
                  <div className="font-semibold">Family Coin Boosts</div>
                  <div className="text-gray-300 text-xs">
                    Bonus free coin drops and rewards from Family-only tasks.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-cyan-300 mt-0.5" />
                <div>
                  <div className="font-semibold">Protected Rooms</div>
                  <div className="text-gray-300 text-xs">
                    Troll Officers and Family Leaders can respond to drama fast.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Crown className="w-4 h-4 text-yellow-300 mt-0.5" />
                <div>
                  <div className="font-semibold">Family Badge & Entrance</div>
                  <div className="text-gray-300 text-xs">
                    Unique badge and entrance effect flexing your Troll Family.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Star className="w-4 h-4 text-pink-300 mt-0.5" />
                <div>
                  <div className="font-semibold">Priority Promo</div>
                  <div className="text-gray-300 text-xs">
                    Family members can get featured in events and banners.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* My Family + Tasks */}
        <section className="grid md:grid-cols-3 gap-4">
          {/* My Family card */}
          <div className="bg-black/45 border border-purple-700/60 rounded-2xl p-4 md:col-span-1 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-300" />
                <h2 className="font-semibold text-lg">My Family</h2>
              </div>
              {isInFamily ? (
                <span className="text-xs px-2 py-1 bg-emerald-800/60 border border-emerald-500/60 rounded-full text-emerald-100">
                  Active Member
                </span>
              ) : (
                <span className="text-xs px-2 py-1 bg-red-900/60 border border-red-500/60 rounded-full text-red-100">
                  No Family
                </span>
              )}
            </div>

            {isInFamily ? (
              <>
                <div className="text-sm">
                  <div className="text-gray-300">Family:</div>
                  <div className="font-semibold text-purple-200">
                    {familyName}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    Role:{' '}
                    <span className="text-emerald-300">{familyRole}</span>
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-300">
                  This panel only reads your profile fields. If you later add
                  real Family tables (like <code>troll_families</code>), you
                  can connect them here using Supabase.
                </div>

                <button
                  type="button"
                  className="mt-3 w-full text-xs font-semibold px-3 py-2 rounded-xl bg-purple-700/80 hover:bg-purple-600 border border-purple-400/70 transition"
                  onClick={() =>
                    toast.info('Family settings coming soon in Admin / Profile.')
                  }
                >
                  Manage Family Settings
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-300">
                  You’re not in a Troll Family yet. Join a Family or start your
                  own and unlock extra perks.
                </p>
                <button
                  type="button"
                  className="mt-2 w-full text-xs font-semibold px-3 py-2 rounded-xl bg-purple-700/80 hover:bg-purple-600 border border-purple-400/70 transition"
                  onClick={() => navigate('/family/city')}
                >
                  Browse Troll Families
                </button>
              </>
            )}
          </div>

          {/* Tasks */}
          <div className="bg-black/45 border border-purple-700/60 rounded-2xl p-4 md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-300" />
                <h2 className="font-semibold text-lg">Family Tasks</h2>
              </div>
              <span className="text-xs text-gray-300">
                Complete tasks to boost your Family perks.
              </span>
            </div>

            {loading ? (
              <div className="text-sm text-gray-300">Loading tasks…</div>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => {
                  const percent =
                    task.target === 0
                      ? 0
                      : Math.min(100, (task.progress / task.target) * 100)

                  return (
                    <div
                      key={task.id}
                      className="border border-purple-700/50 rounded-xl p-3 bg-black/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-sm">
                            {task.title}
                          </div>
                          <div className="text-xs text-gray-300 mt-0.5">
                            {task.description}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!task.completed && percent < 100}
                          onClick={() =>
                            !task.completed &&
                            percent >= 100 &&
                            handleClaimReward(task.id)
                          }
                          className={`text-[11px] px-3 py-1 rounded-full border transition ${
                            task.completed
                              ? 'bg-emerald-800/70 border-emerald-500/60 text-emerald-50'
                              : percent >= 100
                              ? 'bg-purple-700/80 border-purple-400/80 text-white hover:bg-purple-600'
                              : 'bg-transparent border-purple-700/60 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {task.completed
                            ? 'Reward Claimed'
                            : percent >= 100
                            ? 'Claim Reward'
                            : `${task.progress}/${task.target}`}
                        </button>
                      </div>

                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                          <span>Progress</span>
                          <span>{task.reward}</span>
                        </div>
                        <div className="w-full h-2 bg-purple-950/80 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-400 via-emerald-400 to-yellow-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* Events + Chat placeholder */}
        <section className="grid md:grid-cols-2 gap-4 pb-6">
          {/* Events */}
          <div className="bg-black/45 border border-purple-700/60 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-purple-300" />
              <h2 className="font-semibold text-lg">Upcoming Family Events</h2>
            </div>

            <div className="space-y-3 text-sm">
              {events.map(event => (
                <div
                  key={event.id}
                  className="border border-purple-700/50 rounded-xl p-3 bg-black/40"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{event.title}</div>
                    <span className="text-[11px] text-purple-200">
                      {event.dateLabel}
                    </span>
                  </div>
                  <div className="text-xs text-gray-300 mt-1">
                    {event.description}
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-wide flex items-center gap-1">
                    {event.type === 'party' && (
                      <span className="px-2 py-0.5 rounded-full bg-pink-900/60 border border-pink-500/70 text-pink-100">
                        Party
                      </span>
                    )}
                    {event.type === 'competition' && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-900/60 border border-amber-500/70 text-amber-100">
                        Competition
                      </span>
                    )}
                    {event.type === 'raid' && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-900/60 border border-emerald-500/70 text-emerald-100">
                        Raid
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat / Lounge hook */}
          <div className="bg-black/45 border border-purple-700/60 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-purple-300" />
                <h2 className="font-semibold text-lg">Family Lounge</h2>
              </div>
              <p className="text-sm text-gray-300 mb-3">
                This is where you can drop your future Family-only chat or
                live-room list. For now, it’s just a portal description so the
                UI is ready.
              </p>
              <ul className="text-xs text-gray-200 space-y-1">
                <li>• Show live rooms from your Troll Family</li>
                <li>• Family-only group chat, polls, and announcements</li>
                <li>• Quick join buttons into members’ streams</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => navigate('/family/chat')}
              className="mt-4 w-full text-xs font-semibold px-3 py-2 rounded-xl bg-purple-700/80 hover:bg-purple-600 border border-purple-400/80 transition"
            >
              Open Troll Family Lounge
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
