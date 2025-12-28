import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Video, Users, Globe, Crown } from 'lucide-react';
import { toast } from 'sonner';

interface StreamConfig {
  title: string;
  category: string;
  audience: 'public' | 'followers' | 'family';
  allowGifts: boolean;
  description: string;
}

const CATEGORIES = ['Just Chatting', 'Tromody Show', 'Troll Court', 'Family Stream', 'Music', 'Other'];

const GoLiveSetup: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();

  const [config, setConfig] = useState<StreamConfig>({
    title: '',
    category: 'Just Chatting',
    audience: 'public',
    allowGifts: true,
    description: ''
  });

  const [loading, setLoading] = useState(false);
  const [broadcasterStatus, setBroadcasterStatus] = useState<{
    isApproved: boolean;
    hasApplication: boolean;
  } | null>(null);

  // Check broadcaster status
  useEffect(() => {
    // Everyone is allowed to go live instantly
    if (!user || !profile) return;
    setBroadcasterStatus({
      isApproved: true,
      hasApplication: true,
    });
  }, [user?.id, profile?.id]);

  const handleSubmit = async () => {
    if (!user || !profile) {
      toast.error('You must be logged in');
      return;
    }

    if (!config.title.trim()) {
      toast.error('Stream title is required');
      return;
    }

    const submissionConfig = config;

    setLoading(true);

    try {
      const streamId = crypto.randomUUID();

      // Create stream record
      const { error: insertError } = await supabase
        .from('streams')
        .insert({
          id: streamId,
          broadcaster_id: profile.id,
          title: submissionConfig.title,
          category: submissionConfig.category,
          audience_type: submissionConfig.audience,
          allow_gifts: submissionConfig.allowGifts,
          description: submissionConfig.description,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-4">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Set Up Your Stream</h1>
          <p className="text-gray-400">Get live in seconds</p>
        </div>

        {/* Main Form - Fast and Simple */}
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

          {/* Basic Options */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              Basic Options
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
                🔴 Go Live
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoLiveSetup;
