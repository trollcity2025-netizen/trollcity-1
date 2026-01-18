import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import api, { API_ENDPOINTS } from '../lib/api';
import { toast } from 'sonner';
import { Crown, Users, Clock, ArrowUpRight } from 'lucide-react';

interface OfficerVoteCycle {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
}

interface BroadcasterProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  is_broadcaster: boolean;
  is_banned: boolean;
}

interface OfficerVoteRow {
  broadcaster_id: string;
}

export default function OfficerVote() {
  const { user } = useAuthStore();
  const [cycle, setCycle] = useState<OfficerVoteCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [broadcasters, setBroadcasters] = useState<BroadcasterProfile[]>([]);
  const [votes, setVotes] = useState<OfficerVoteRow[]>([]);
  const [votingFor, setVotingFor] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const nowIso = new Date().toISOString();

        const { data: activeCycle } = await supabase
          .from('officer_vote_cycles')
          .select('id, starts_at, ends_at, status')
          .eq('status', 'active')
          .lte('starts_at', nowIso)
          .gte('ends_at', nowIso)
          .maybeSingle();

        if (!activeCycle) {
          setCycle(null);
          setBroadcasters([]);
          setVotes([]);
          return;
        }

        setCycle(activeCycle as OfficerVoteCycle);

        const [{ data: broadcasterRows }, { data: voteRows }] = await Promise.all([
          supabase
            .from('user_profiles')
            .select('id, username, avatar_url, is_broadcaster, is_banned')
            .eq('is_broadcaster', true)
            .eq('is_banned', false)
            .order('username', { ascending: true })
            .limit(100),
          supabase
            .from('officer_votes')
            .select('broadcaster_id')
            .eq('cycle_id', activeCycle.id),
        ]);

        setBroadcasters((broadcasterRows || []) as BroadcasterProfile[]);
        setVotes((voteRows || []) as OfficerVoteRow[]);
      } catch {
        toast.error('Failed to load officer voting');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user?.id]);

  const leaderboard = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of votes) {
      const id = v.broadcaster_id;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return [...broadcasters]
      .map((b) => ({
        ...b,
        votes: counts.get(b.id) || 0,
      }))
      .sort((a, b) => b.votes - a.votes || a.username.localeCompare(b.username));
  }, [broadcasters, votes]);

  const timeLeft = useMemo(() => {
    if (!cycle) return '';
    const end = new Date(cycle.ends_at).getTime();
    const now = Date.now();
    const diff = end - now;
    if (diff <= 0) return 'Ending soon';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }, [cycle]);

  const handleVote = async (broadcasterId: string) => {
    if (!cycle || !user?.id) return;
    setVotingFor(broadcasterId);
    try {
      const { success, error, alreadyVoted } = await api.post(
        API_ENDPOINTS.officerVoting.vote,
        { broadcasterId }
      );

      if (!success && !alreadyVoted) {
        toast.error(error || 'Failed to submit vote');
        return;
      }

      if (alreadyVoted) {
        toast.success('You already voted for this broadcaster in this cycle');
        return;
      }

      setVotes((prev) => [...prev, { broadcaster_id: broadcasterId }]);
      toast.success('Vote recorded');
    } catch {
      toast.error('Failed to submit vote');
    } finally {
      setVotingFor(null);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020617] via-[#020617] to-[#020617] text-white px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Crown className="w-7 h-7 text-yellow-300" />
              Vote: Troll Officer of the Week
            </h1>
            <p className="text-sm text-gray-300 mt-1">
              Choose the broadcaster who represented Troll City best this week.
            </p>
          </div>
          {cycle && (
            <div className="bg-black/40 border border-yellow-500/40 rounded-xl px-4 py-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-300" />
              <div className="text-xs">
                <div className="font-semibold text-yellow-300">Voting Ends In</div>
                <div>{timeLeft}</div>
              </div>
            </div>
          )}
        </header>

        {loading ? (
          <div className="bg-black/40 border border-purple-800/40 rounded-2xl p-8 text-center text-sm text-gray-300">
            Loading voting data…
          </div>
        ) : !cycle ? (
          <div className="bg-black/40 border border-purple-800/40 rounded-2xl p-8 text-center text-sm text-gray-300">
            No active Troll Officer of the Week voting cycle is running right now. Check
            back soon.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-[2fr,1fr] items-start">
            <section className="bg-black/40 border border-purple-800/40 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-300" />
                  Active Broadcasters
                </h2>
                <span className="text-xs text-gray-400">
                  One vote per broadcaster per week
                </span>
              </div>

              {broadcasters.length === 0 ? (
                <p className="text-xs text-gray-400">
                  No eligible broadcasters found for this cycle yet.
                </p>
              ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {leaderboard.map((b) => {
                    const count = (b as any).votes as number;
                    const isSelf = b.id === user.id;
                    const disabled = votingFor === b.id || isSelf;
                    return (
                      <div
                        key={b.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-purple-800/40 bg-gradient-to-r from-slate-950/80 via-slate-950/60 to-slate-950/80 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center text-lg">
                            {b.avatar_url ? (
                              <img
                                src={b.avatar_url}
                                alt={b.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{b.username.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-semibold">{b.username}</div>
                            <div className="text-[11px] text-gray-400">
                              {isSelf
                                ? 'You cannot vote for yourself'
                                : 'Community broadcaster'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-[11px] text-gray-400">Votes</div>
                            <div className="text-base font-bold text-yellow-300">
                              {count}
                            </div>
                          </div>
                          <button
                            disabled={disabled}
                            onClick={() => handleVote(b.id)}
                            className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                              disabled
                                ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500 text-white'
                            }`}
                          >
                            {votingFor === b.id ? 'Voting…' : 'Vote'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <div className="bg-black/40 border border-purple-800/40 rounded-2xl p-4 text-sm text-gray-200 space-y-2">
                <h3 className="text-base font-semibold mb-1 flex items-center gap-2 text-purple-200">
                  <ArrowUpRight className="w-4 h-4 text-purple-300" />
                  How voting works
                </h3>
                <ul className="list-disc list-inside space-y-1 text-xs text-gray-300">
                  <li>Voting runs in weekly cycles.</li>
                  <li>Each user can vote once per broadcaster per cycle.</li>
                  <li>The broadcaster with the most votes becomes Troll Officer.</li>
                  <li>The Troll Officer role lasts 7 days after selection.</li>
                </ul>
              </div>
              <div className="bg-black/40 border border-yellow-500/40 rounded-2xl p-4 text-xs text-yellow-100 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Crown className="w-4 h-4 text-yellow-300" />
                  Troll Officer Perks
                </h3>
                <p>
                  Troll Officers are highlighted across Troll City and recognized for their
                  leadership and community impact.
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

