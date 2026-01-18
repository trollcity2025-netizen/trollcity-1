import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import api, { API_ENDPOINTS } from '../lib/api';
import { toast } from 'sonner';
import { Crown, Gift, Star, Users } from 'lucide-react';

type GiftStatus = 'draft' | 'submitted' | 'approved';

interface UserGift {
  id: string;
  creator_id: string;
  name: string;
  config: any;
  status: GiftStatus;
  vote_count: number;
}

export default function TrollG() {
  const { profile, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [currentGift, setCurrentGift] = useState<UserGift | null>(null);
  const [giftName, setGiftName] = useState('');
  const [giftIcon, setGiftIcon] = useState('🌹');
  const [giftColor, setGiftColor] = useState('#f97316');
  const [submittingGift, setSubmittingGift] = useState(false);
  const [payingFee, setPayingFee] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);
  const [voteGifts, setVoteGifts] = useState<UserGift[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data: app } = await supabase
          .from('trollg_applications')
          .select('id, status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (app) {
          setHasAccess(true);
          setApplicationStatus(app.status);
        }

        const { data: gift } = await supabase
          .from('user_gifts')
          .select('id, creator_id, name, config, status, vote_count')
          .eq('creator_id', user.id)
          .maybeSingle();

        if (gift) {
          setCurrentGift(gift as UserGift);
          setGiftName(gift.name);
          if (gift.config?.icon) setGiftIcon(gift.config.icon);
          if (gift.config?.color) setGiftColor(gift.config.color);
        }

        const { data: gifts } = await supabase
          .from('user_gifts')
          .select('id, creator_id, name, config, status, vote_count')
          .in('status', ['submitted', 'approved'] as GiftStatus[])
          .order('vote_count', { ascending: false });

        if (gifts) {
          setVoteGifts(gifts as UserGift[]);
        }
      } catch (_err) {
        toast.error('Failed to load TrollG data');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user?.id]);

  const handlePayFee = async () => {
    if (!user?.id || !profile) return;
    if (hasAccess) {
      toast.success('TrollG already unlocked');
      return;
    }

    setPayingFee(true);
    try {
      const { success, error, alreadyPaid } = await api.post(
        API_ENDPOINTS.trollg.payFee,
        {}
      );

      if (!success && !alreadyPaid) {
        toast.error(error || 'Failed to pay TrollG fee');
        return;
      }

      setHasAccess(true);
      setApplicationStatus('paid');
      toast.success('TrollG unlocked. Welcome to the Gift Studio.');
    } catch {
      toast.error('Failed to pay TrollG fee');
    } finally {
      setPayingFee(false);
    }
  };

  const handleSubmitGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!hasAccess) {
      toast.error('Unlock TrollG before submitting a gift');
      return;
    }
    if (!giftName.trim()) {
      toast.error('Enter a name for your gift');
      return;
    }
    if (currentGift && currentGift.status === 'approved') {
      toast.error('Your gift is already approved');
      return;
    }

    setSubmittingGift(true);
    try {
      const payload = {
        name: giftName.trim(),
        config: {
          icon: giftIcon,
          color: giftColor,
        },
      };

      const { success, error, giftId } = await api.post(
        API_ENDPOINTS.trollg.submitGift,
        payload
      );

      if (!success) {
        toast.error(error || 'Failed to submit gift');
        return;
      }

      const nextGift: UserGift = {
        id: giftId || currentGift?.id || '',
        creator_id: user.id,
        name: payload.name,
        config: payload.config,
        status: 'submitted',
        vote_count: currentGift?.vote_count ?? 0,
      };
      setCurrentGift(nextGift);
      toast.success('Gift submitted for voting');

      const { data: gifts } = await supabase
        .from('user_gifts')
        .select('id, creator_id, name, config, status, vote_count')
        .in('status', ['submitted', 'approved'] as GiftStatus[])
        .order('vote_count', { ascending: false });

      if (gifts) {
        setVoteGifts(gifts as UserGift[]);
      }
    } catch {
      toast.error('Failed to submit gift');
    } finally {
      setSubmittingGift(false);
    }
  };

  const handleVote = async (giftId: string) => {
    if (!user?.id) return;
    setVoting(giftId);
    try {
      const { success, error, alreadyVoted } = await api.post(
        API_ENDPOINTS.trollg.voteGift,
        { giftId }
      );

      if (!success && !alreadyVoted) {
        toast.error(error || 'Failed to vote');
        return;
      }

      if (alreadyVoted) {
        toast.success('You already voted for this gift');
        return;
      }

      setVoteGifts((prev) =>
        prev.map((g) =>
          g.id === giftId ? { ...g, vote_count: (g.vote_count || 0) + 1 } : g
        )
      );
      toast.success('Vote recorded');
    } catch {
      toast.error('Failed to vote');
    } finally {
      setVoting(null);
    }
  };

  if (!user || !profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <p className="text-gray-300 text-sm">Sign in to access TrollG.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="animate-pulse h-10 w-40 bg-purple-900/40 rounded mb-6" />
        <div className="space-y-4">
          <div className="h-24 bg-purple-900/20 rounded" />
          <div className="h-64 bg-purple-900/20 rounded" />
        </div>
      </div>
    );
  }

  const meetsLevel = (profile.level || 0) >= 200;
  const hasCoins = (profile.troll_coins || 0) >= 10000;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-purple-600/30 flex items-center justify-center">
          <Crown className="w-6 h-6 text-yellow-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">TrollG · Custom Gift Studio</h1>
          <p className="text-sm text-gray-300">
            Unlock TrollG, design one signature gift, get it voted in, and earn royalties.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-[#111827] border border-purple-700/40 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-300" />
              <span className="font-semibold text-white text-sm">Eligibility</span>
            </div>
            <span className="text-xs text-gray-400 uppercase tracking-wide">Requirements</span>
          </div>
          <ul className="text-xs text-gray-300 space-y-1">
            <li>
              Level 200+:{' '}
              <span className={meetsLevel ? 'text-green-400' : 'text-red-400'}>
                {profile.level || 0}
              </span>
            </li>
            <li>
              TrollG fee:{' '}
              <span className={hasCoins ? 'text-green-400' : 'text-red-400'}>
                10,000 troll_coins (you have {profile.troll_coins || 0})
              </span>
            </li>
            <li>One custom gift per creator.</li>
          </ul>
          <button
            disabled={payingFee || hasAccess || !meetsLevel || !hasCoins}
            onClick={handlePayFee}
            className={`mt-3 w-full inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold transition ${
              hasAccess
                ? 'bg-green-600/20 text-green-300 border border-green-500/40 cursor-default'
                : payingFee
                ? 'bg-purple-900 text-purple-200 border border-purple-700 cursor-wait'
                : meetsLevel && hasCoins
                ? 'bg-purple-600 hover:bg-purple-500 text-white border border-purple-400'
                : 'bg-gray-800 text-gray-400 border border-gray-700 cursor-not-allowed'
            }`}
          >
            {hasAccess
              ? 'TrollG Unlocked'
              : payingFee
              ? 'Processing TrollG Fee...'
              : 'Pay 10,000 Troll Coins to Unlock TrollG'}
          </button>
          {applicationStatus && (
            <p className="text-[11px] text-gray-400 mt-1">
              Status: <span className="text-purple-300">{applicationStatus}</span>
            </p>
          )}
        </div>

        <div className="bg-[#111827] border border-purple-700/40 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-pink-300" />
              <span className="font-semibold text-white text-sm">Your TrollG Gift</span>
            </div>
          </div>
          {currentGift ? (
            <div className="space-y-2 text-xs text-gray-300">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {currentGift.config?.icon || giftIcon}
                </span>
                <span className="font-semibold text-white">{currentGift.name}</span>
              </div>
              <p>
                Status:{' '}
                <span
                  className={
                    currentGift.status === 'approved'
                      ? 'text-green-400'
                      : currentGift.status === 'submitted'
                      ? 'text-yellow-300'
                      : 'text-gray-300'
                  }
                >
                  {currentGift.status}
                </span>
              </p>
              <p>Votes: {currentGift.vote_count || 0}</p>
              {currentGift.status === 'approved' && (
                <p className="text-[11px] text-green-300">
                  Your gift is live in the Gift Box. You earn royalties when others send it.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              You have not created a TrollG gift yet. Unlock access and submit your first one.
            </p>
          )}
        </div>
      </div>

      <div className="bg-[#020617] border border-purple-700/40 rounded-2xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Gift className="w-5 h-5 text-pink-300" />
          TrollG Gift Studio
        </h2>

        <form onSubmit={handleSubmitGift} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Gift Name
              </label>
              <input
                value={giftName}
                onChange={(e) => setGiftName(e.target.value)}
                placeholder="Example: Royal Troll Crown"
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-purple-700/60 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={!hasAccess || submittingGift || currentGift?.status === 'approved'}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Icon
              </label>
              <input
                value={giftIcon}
                onChange={(e) => setGiftIcon(e.target.value)}
                maxLength={4}
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-purple-700/60 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={!hasAccess || submittingGift || currentGift?.status === 'approved'}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 items-center">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Accent Color
              </label>
              <input
                type="color"
                value={giftColor}
                onChange={(e) => setGiftColor(e.target.value)}
                className="h-10 w-20 rounded cursor-pointer border border-purple-700/60 bg-black/40"
                disabled={!hasAccess || submittingGift || currentGift?.status === 'approved'}
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-300">
              <span>Preview:</span>
              <span
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10"
                style={{ backgroundColor: `${giftColor}33` }}
              >
                <span className="text-lg">{giftIcon}</span>
                <span className="font-semibold text-white text-xs">
                  {giftName || 'Your TrollG Gift'}
                </span>
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={
              submittingGift ||
              !hasAccess ||
              !giftName.trim() ||
              currentGift?.status === 'approved'
            }
            className={`inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold transition ${
              !hasAccess
                ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                : submittingGift
                ? 'bg-purple-900 text-purple-200 border border-purple-700 cursor-wait'
                : currentGift?.status === 'approved'
                ? 'bg-green-700/20 text-green-300 border border-green-600/40 cursor-default'
                : 'bg-pink-600 hover:bg-pink-500 text-white border border-pink-400'
            }`}
          >
            {currentGift?.status === 'approved'
              ? 'Gift Approved'
              : submittingGift
              ? 'Submitting...'
              : currentGift
              ? 'Update & Resubmit Gift'
              : 'Submit Gift for Voting'}
          </button>
        </form>
      </div>

      <div className="bg-[#020617] border border-purple-700/40 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-300" />
            Community Voting
          </h2>
          <p className="text-[11px] text-gray-400">
            One vote per gift per user. Highest votes get approved.
          </p>
        </div>

        {voteGifts.length === 0 ? (
          <p className="text-xs text-gray-400">No TrollG gifts are open for voting yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {voteGifts.map((gift) => {
              const isCreator = gift.creator_id === user.id;
              const disabled = voting === gift.id || isCreator;
              return (
                <div
                  key={gift.id}
                  className="rounded-xl border border-purple-800/40 bg-gradient-to-br from-purple-950/60 to-slate-950/70 p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {gift.config?.icon || currentGift?.config?.icon || '🎁'}
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-white line-clamp-1">
                          {gift.name}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          Status:{' '}
                          <span
                            className={
                              gift.status === 'approved'
                                ? 'text-green-400'
                                : 'text-yellow-300'
                            }
                          >
                            {gift.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-300">Votes</div>
                      <div className="text-base font-bold text-yellow-300">
                        {gift.vote_count || 0}
                      </div>
                    </div>
                  </div>
                  <button
                    disabled={disabled}
                    onClick={() => handleVote(gift.id)}
                    className={`mt-1 inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      disabled
                        ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {isCreator
                      ? 'Creators cannot vote on their own gift'
                      : voting === gift.id
                      ? 'Voting...'
                      : 'Vote for this Gift'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
