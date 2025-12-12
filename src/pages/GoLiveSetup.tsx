import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Video, Coins, Users, Globe, Lock, Crown, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface StreamConfig {
  title: string;
  category: string;
  audience: 'public' | 'followers' | 'family';
  pricingType: string;
  pricingValue: number;
  giftMultiplier: 'off' | '10%' | '25%' | '50%';
  likePrice: 1 | 5 | 'troll_storm';
  familyXpBonus: boolean;
  familyCoinBonus: boolean;
  notifyFollowers: boolean;
  notifyFamily: boolean;
  allowOfficerFreeJoin: boolean;
  moderatorMode: boolean;
  allowFreeJoinRoles: string[];
  allowGifts: boolean;
  allowGuests: boolean;
  maxGuestSlots: number;
  description: string;
}

const CATEGORIES = [
  'Just Chatting',
  'Troll Battles',
  'Tromody Show',
  'Troll Court',
  'Family Stream',
  'Music',
  'Other'
];

const PRICING_PACKAGES = [
  { type: 'free', label: 'Free Stream', value: 0, description: 'No entry fee required' },
  { type: 'per_minute_5', label: '5 coins per minute', value: 5, description: 'Pay 5 coins per minute watched' },
  { type: 'per_minute_50', label: '50 coins per minute', value: 50, description: 'Pay 50 coins per minute watched' },
  { type: 'per_minute_100', label: '100 coins per minute', value: 100, description: 'Pay 100 coins per minute watched' },
  { type: 'battle_boost_10', label: 'Battle Earnings Boost (10%)', value: 10, description: '10% boost to battle earnings' },
  { type: 'family_xp_2x', label: 'Family XP 2x Boost', value: 2, description: 'Double XP for family members' },
  { type: 'tromody_ticket', label: 'Tromody Ticket Mode', value: 1, description: 'Ticket-based entry system' }
];

const GoLiveSetup: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();

  const [config, setConfig] = useState<StreamConfig>({
    title: '',
    category: 'Just Chatting',
    audience: 'public',
    pricingType: 'free',
    pricingValue: 0,
    giftMultiplier: 'off',
    likePrice: 1,
    familyXpBonus: false,
    familyCoinBonus: false,
    notifyFollowers: false,
    notifyFamily: false,
    allowOfficerFreeJoin: true,
    moderatorMode: false,
    allowFreeJoinRoles: ['admin', 'lead_troll_officer', 'troll_officer'],
    allowGifts: true,
    allowGuests: false,
    maxGuestSlots: 1,
    description: ''
  });

  const [loading, setLoading] = useState(false);
  const [broadcasterStatus, setBroadcasterStatus] = useState<{
    isApproved: boolean;
    hasApplication: boolean;
  } | null>(null);

  // Check broadcaster status
  useEffect(() => {
    const checkStatus = async () => {
      if (!user || !profile) return;

      // If already marked broadcaster
      if (profile.is_broadcaster) {
        setBroadcasterStatus({
          isApproved: true,
          hasApplication: true,
        });
        return;
      }

      // Check broadcaster_applications table
      const { data } = await supabase
        .from('broadcaster_applications')
        .select('application_status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setBroadcasterStatus({
        isApproved: data?.application_status === 'approved',
        hasApplication: !!data,
      });
    };

    checkStatus();
  }, [user, profile]);

  const handleSubmit = async () => {
    if (!user || !profile) {
      toast.error('You must be logged in');
      return;
    }

    if (!broadcasterStatus?.isApproved) {
      toast.error('You must be an approved broadcaster to go live');
      return;
    }

    if (!config.title.trim()) {
      toast.error('Stream title is required');
      return;
    }

    // Pricing validation based on type
    if (config.pricingType !== 'free' && !config.pricingValue) {
      toast.error('Pricing value is required');
      return;
    }

    setLoading(true);

    try {
      const streamId = crypto.randomUUID();

      // Create stream record
      const { error: insertError } = await supabase
        .from('streams')
        .insert({
          id: streamId,
          broadcaster_id: profile.id,
          title: config.title,
          category: config.category,
          audience_type: config.audience,
          pricing_type: config.pricingType,
          pricing_value: config.pricingValue,
          gift_multiplier: config.giftMultiplier,
          like_price: config.likePrice,
          family_xp_bonus: config.familyXpBonus,
          family_coin_bonus: config.familyCoinBonus,
          notify_followers: config.notifyFollowers,
          notify_family: config.notifyFamily,
          allow_officer_free_join: config.allowOfficerFreeJoin,
          moderator_mode: config.moderatorMode,
          allow_gifts: config.allowGifts,
          max_guest_slots: config.allowGuests ? config.maxGuestSlots : 0,
          description: config.description,
          status: 'scheduled',
          room_name: streamId,
          is_live: false,
          viewer_count: 0,
          current_viewers: 0,
          total_gifts_coins: 0,
          popularity: 0,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error creating stream:', insertError);
        toast.error('Failed to create stream');
        return;
      }

      // Navigate to live broadcast screen
      navigate(`/live/${streamId}`);

    } catch (error) {
      console.error('Error in handleSubmit:', error);
      toast.error('Failed to set up stream');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (field: keyof StreamConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  if (!broadcasterStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <Video className="w-12 h-12 text-purple-400 mx-auto mb-4 animate-pulse" />
          <p>Loading broadcaster status...</p>
        </div>
      </div>
    );
  }

  if (!broadcasterStatus.isApproved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-2xl mx-auto text-center">
          <Video className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-4">Broadcaster Access Required</h1>
          <p className="text-gray-300 mb-6">
            You must be an approved broadcaster to set up live streams.
            {!broadcasterStatus.hasApplication && ' Apply for broadcaster status first.'}
          </p>
          <button
            onClick={() => navigate('/apply')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
          >
            Apply to be a Broadcaster
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-4">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Set Up Your Stream</h1>
          <p className="text-gray-400">Configure your live broadcast settings</p>
        </div>

        {/* Main Form */}
        <div className="bg-zinc-900/50 border border-purple-500/20 rounded-xl p-6 space-y-6">

          {/* Stream Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Stream Title *
            </label>
            <input
              type="text"
              value={config.title}
              onChange={(e) => updateConfig('title', e.target.value)}
              placeholder="Enter your stream title..."
              className="w-full bg-zinc-800 border border-purple-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Category
            </label>
            <select
              value={config.category}
              onChange={(e) => updateConfig('category', e.target.value)}
              className="w-full bg-zinc-800 border border-purple-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Audience */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              Audience
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-800">
                <input
                  type="radio"
                  name="audience"
                  value="public"
                  checked={config.audience === 'public'}
                  onChange={(e) => updateConfig('audience', e.target.value)}
                  className="text-purple-500"
                />
                <Globe className="w-5 h-5 text-green-400" />
                <div>
                  <div className="font-semibold">Public</div>
                  <div className="text-sm text-gray-400">Anyone can join</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-800">
                <input
                  type="radio"
                  name="audience"
                  value="followers"
                  checked={config.audience === 'followers'}
                  onChange={(e) => updateConfig('audience', e.target.value)}
                  className="text-purple-500"
                />
                <Users className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="font-semibold">Followers Only</div>
                  <div className="text-sm text-gray-400">Only your followers can join</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-800">
                <input
                  type="radio"
                  name="audience"
                  value="family"
                  checked={config.audience === 'family'}
                  onChange={(e) => updateConfig('audience', e.target.value)}
                  className="text-purple-500"
                />
                <Crown className="w-5 h-5 text-yellow-400" />
                <div>
                  <div className="font-semibold">Troll Family Only</div>
                  <div className="text-sm text-gray-400">Only family members can join</div>
                </div>
              </label>
            </div>
          </div>

          {/* Pricing Packages */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              Stream Pricing Packages
            </label>
            <div className="space-y-2">
              {PRICING_PACKAGES.map(pkg => (
                <label key={pkg.type} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-800">
                  <input
                    type="radio"
                    name="pricing"
                    value={pkg.type}
                    checked={config.pricingType === pkg.type}
                    onChange={(e) => {
                      updateConfig('pricingType', e.target.value);
                      updateConfig('pricingValue', pkg.value);
                    }}
                    className="text-purple-500"
                  />
                  <div>
                    <div className="font-semibold">{pkg.label}</div>
                    <div className="text-sm text-gray-400">{pkg.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Optional Stream Enhancements */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              Optional Stream Enhancements
            </label>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Gift Multiplier</label>
                <select
                  value={config.giftMultiplier}
                  onChange={(e) => updateConfig('giftMultiplier', e.target.value as 'off' | '10%' | '25%' | '50%')}
                  className="w-full bg-zinc-800 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="off">Off</option>
                  <option value="10%">+10%</option>
                  <option value="25%">+25%</option>
                  <option value="50%">+50%</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Troll Like Pricing</label>
                <select
                  value={config.likePrice}
                  onChange={(e) => updateConfig('likePrice', e.target.value === 'troll_storm' ? 'troll_storm' : parseInt(e.target.value))}
                  className="w-full bg-zinc-800 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value={1}>1 coin</option>
                  <option value={5}>5 coins</option>
                  <option value="troll_storm">Troll Storm (100 likes)</option>
                </select>
              </div>

              <label className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div>
                  <div className="font-semibold">Enable Family XP & Family Coin bonus</div>
                  <div className="text-sm text-gray-400">Bonus XP and coins for family members</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.familyXpBonus && config.familyCoinBonus}
                  onChange={(e) => {
                    updateConfig('familyXpBonus', e.target.checked);
                    updateConfig('familyCoinBonus', e.target.checked);
                  }}
                  className="w-5 h-5 text-purple-500 bg-zinc-800 border-purple-500 rounded focus:ring-purple-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div>
                  <div className="font-semibold">Notify Followers</div>
                  <div className="text-sm text-gray-400">Send notifications to followers when stream starts</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.notifyFollowers}
                  onChange={(e) => updateConfig('notifyFollowers', e.target.checked)}
                  className="w-5 h-5 text-purple-500 bg-zinc-800 border-purple-500 rounded focus:ring-purple-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div>
                  <div className="font-semibold">Notify Troll Family</div>
                  <div className="text-sm text-gray-400">Send notifications to family members when stream starts</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.notifyFamily}
                  onChange={(e) => updateConfig('notifyFamily', e.target.checked)}
                  className="w-5 h-5 text-purple-500 bg-zinc-800 border-purple-500 rounded focus:ring-purple-500"
                />
              </label>
            </div>
          </div>

          {/* Role Overrides */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              Role Overrides
            </label>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div>
                  <div className="font-semibold">Allow Admin/Officers to join free</div>
                  <div className="text-sm text-gray-400">Admins and officers can join without paying</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.allowOfficerFreeJoin}
                  onChange={(e) => updateConfig('allowOfficerFreeJoin', e.target.checked)}
                  className="w-5 h-5 text-purple-500 bg-zinc-800 border-purple-500 rounded focus:ring-purple-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div>
                  <div className="font-semibold">Enable Moderator Mode</div>
                  <div className="text-sm text-gray-400">Enhanced moderation controls</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.moderatorMode}
                  onChange={(e) => updateConfig('moderatorMode', e.target.checked)}
                  className="w-5 h-5 text-purple-500 bg-zinc-800 border-purple-500 rounded focus:ring-purple-500"
                />
              </label>
            </div>
          </div>

          {/* Preset System */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              Stream Presets
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!user) return;
                  const preset = { ...config };
                  delete preset.title; // Don't save title in preset
                  delete preset.description; // Don't save description
                  await supabase
                    .from('stream_presets')
                    .upsert({
                      user_id: user.id,
                      preset_data: preset,
                      updated_at: new Date().toISOString()
                    });
                  toast.success('Stream preset saved!');
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold text-white transition-colors"
              >
                Save Stream Preset
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!user) return;
                  const { data } = await supabase
                    .from('stream_presets')
                    .select('preset_data')
                    .eq('user_id', user.id)
                    .single();
                  if (data) {
                    setConfig(prev => ({ ...prev, ...data.preset_data }));
                    toast.success('Last preset loaded!');
                  } else {
                    toast.error('No preset found');
                  }
                }}
                className="px-4 py-2 bg-zinc-600 hover:bg-zinc-700 rounded-lg font-semibold text-white transition-colors"
              >
                Load Last Preset
              </button>
            </div>
          </div>

          {/* Stream Features */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              Stream Features
            </label>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div>
                  <div className="font-semibold">Allow Gifts</div>
                  <div className="text-sm text-gray-400">Let viewers send you gifts</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.allowGifts}
                  onChange={(e) => updateConfig('allowGifts', e.target.checked)}
                  className="w-5 h-5 text-purple-500 bg-zinc-800 border-purple-500 rounded focus:ring-purple-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div>
                  <div className="font-semibold">Guest Slots</div>
                  <div className="text-sm text-gray-400">Allow other users to join as guests</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.allowGuests}
                  onChange={(e) => updateConfig('allowGuests', e.target.checked)}
                  className="w-5 h-5 text-purple-500 bg-zinc-800 border-purple-500 rounded focus:ring-purple-500"
                />
              </label>

              {config.allowGuests && (
                <div className="ml-6">
                  <label className="block text-sm text-gray-400 mb-2">
                    Number of Guest Slots
                  </label>
                  <select
                    value={config.maxGuestSlots}
                    onChange={(e) => updateConfig('maxGuestSlots', parseInt(e.target.value))}
                    className="w-full bg-zinc-800 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {[1, 2, 3, 4, 5, 6].map(num => (
                      <option key={num} value={num}>{num} slot{num > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={config.description}
              onChange={(e) => updateConfig('description', e.target.value)}
              placeholder="Describe your stream..."
              rows={3}
              className="w-full bg-zinc-800 border border-purple-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={loading || !config.title.trim()}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 rounded-lg font-bold text-white transition-all duration-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white rounded-full border-t-transparent animate-spin" />
                Setting Up Stream...
              </>
            ) : (
              <>
                <Video className="w-5 h-5" />
                Go Live
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoLiveSetup;