import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { Video, Users, Globe, Crown, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useGoLiveFlow, type StreamConfig } from '../hooks/useGoLiveFlow'

const CATEGORIES = ['Just Chatting', 'Family Stream', 'Music', 'Other'];
const TROMODY_CATEGORY = 'Tromody Show';

const GoLiveSetup: React.FC = () => {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const {
    permissionState,
    requestPermissions,
    createStreamRecord,
    getToken,
    connectToRoom,
    publishTracks,
  } = useGoLiveFlow()

  const [config, setConfig] = useState<StreamConfig>({
    title: '',
    category: 'Just Chatting' as const,
    audience: 'public',
    allowGifts: true,
    description: '',
  })

  const [broadcasterStatus, setBroadcasterStatus] = useState<{
    isApproved: boolean
    hasApplication: boolean
  } | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    if (!user || !profile) return
    setBroadcasterStatus({
      isApproved: true,
      hasApplication: true,
    })
  }, [user?.id, profile?.id])

  const handleStartGoLive = async () => {
    if (isStarting) return

    if (!user || !profile) {
      toast.error('You must be logged in')
      return
    }

    if (!config.title.trim()) {
      toast.error('Stream title is required')
      return
    }

    const configSnapshot = { ...config } as StreamConfig
    console.log(`[GoLiveSetup] Go Live clicked for "${configSnapshot.title}"`)

    setIsStarting(true)
    let rollbackStreamId: string | null = null
    const markStreamFailed = async () => {
      if (!rollbackStreamId) return
      const failedStreamId = rollbackStreamId
      rollbackStreamId = null
      try {
        console.log(`[GoLiveSetup] Marking stream ${failedStreamId} as failed`)
        await supabase
          .from('streams')
          .update({ status: 'failed' })
          .eq('id', failedStreamId)
      } catch (err) {
        console.error('[GoLiveSetup] Failed to mark stream as failed:', err)
      }
    }
    try {
      console.log('[GoLiveSetup] Requesting camera and microphone permissions...')
      const grantedStream = await requestPermissions()
      if (!grantedStream) {
        console.log('[GoLiveSetup] Permission request failed or was denied')
        return
      }

      console.log('[GoLiveSetup] Permissions granted')
      console.log('[GoLiveSetup] Creating stream record...')
      const newStream = await createStreamRecord(configSnapshot)
      if (!newStream) {
        toast.error('Failed to create your stream')
        return
      }
      rollbackStreamId = newStream.id

      console.log(`[GoLiveSetup] Stream record created: ${newStream.id}`)
      console.log('[GoLiveSetup] Requesting publish token...')
      const tokenData = await getToken(newStream.id, true)
      if (!tokenData) {
        await markStreamFailed()
        toast.error('Failed to retrieve LiveKit permissions')
        return
      }

      console.log(`[GoLiveSetup] Token obtained for stream ${newStream.id} (allowPublish=${tokenData.allowPublish})`)
      console.log('[GoLiveSetup] Connecting to LiveKit with publish permissions...')
      const connectedRoom = await connectToRoom(newStream.id, true, tokenData)
      if (!connectedRoom) {
        await markStreamFailed()
        toast.error('Failed to connect to LiveKit')
        return
      }

      console.log('[GoLiveSetup] Connected to LiveKit')
      const published =
        grantedStream && grantedStream.active
          ? await publishTracks(grantedStream)
          : await publishTracks()
      if (!published) {
        await markStreamFailed()
        toast.error('Failed to publish your camera and microphone')
        return
      }

      console.log('[GoLiveSetup] Published local tracks')
      console.log('[GoLiveSetup] Marking stream as live in Supabase...')
      const { error: updateError } = await supabase
        .from('streams')
        .update({
          is_live: true,
          status: 'live',
          start_time: new Date().toISOString(),
        })
        .eq('id', newStream.id)

      if (updateError) {
        console.error('[GoLiveSetup] Stream update failed:', updateError)
        await markStreamFailed()
        toast.error('Failed to update stream status')
        return
      }

      rollbackStreamId = null
      console.log(`[GoLiveSetup] Stream ${newStream.id} is now live`)
      toast.success('You are live!')
      navigate(`/live/${newStream.id}`)
    } catch (err: any) {
      await markStreamFailed()
      console.error('[GoLiveSetup] Go live flow failed:', err)
      toast.error('Something went wrong while starting your stream')
    } finally {
      setIsStarting(false)
    }
  }

  const updateConfig = (field: keyof StreamConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const isBroadcaster =
    Boolean(
      profile?.is_broadcaster ||
        profile?.is_admin ||
        profile?.role === 'admin'
    );

  const categoryOptions = useMemo(() => {
    const options = [...CATEGORIES];
    if (isBroadcaster && !options.includes(TROMODY_CATEGORY)) {
      options.push(TROMODY_CATEGORY);
    }
    return options;
  }, [isBroadcaster]);

  useEffect(() => {
    if (!categoryOptions.length) return;
    if (!categoryOptions.includes(config.category)) {
      setConfig((prev) => ({ ...prev, category: categoryOptions[0] }));
    }
  }, [categoryOptions, config.category]);

  const isTromodyCategory = config.category === TROMODY_CATEGORY;
  const isSpecialCategory = isTromodyCategory;

  const handleTromodyStart = () => {
    if (!isBroadcaster) {
      toast.error('Only live broadcasters can trigger the Tromody Show.');
      return;
    }
    navigate('/tromody');
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
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {isTromodyCategory && (
              <div className="mt-4 rounded-2xl border border-pink-500/40 bg-[#120721]/80 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-pink-200">
                  <Sparkles className="w-4 h-4 text-pink-300" />
                  Tromody Show is a timed head-to-head battle between live broadcasters.
                </div>
                <ul className="text-[11px] text-gray-300 space-y-1 list-disc pl-5">
                  <li>Only live broadcasters can trigger it; opponents must accept the popup within 10 seconds.</li>
                  <li>Each team can have 1 host + 3 guests (4 total), and guests count toward the score.</li>
                <li>Points are derived solely from gifts/coins; the timer runs for 180 seconds with VS energy effects.</li>
                <li>Support feeds highlight gift events, viewers send coins via preset tiers, and the winner screen shows top supporters.</li>
              </ul>
              <p className="text-xs text-gray-400">
                Tromody Show is started from the Tromody Arena, not here.
              </p>
              <button
                type="button"
                onClick={handleTromodyStart}
                  disabled={!isBroadcaster}
                  className="w-full px-4 py-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold shadow-lg shadow-yellow-400/40 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Start Tromody Show
                </button>
              </div>
            )}
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

          {permissionState === 'denied' && (
            <div className="mb-4 flex flex-col gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Camera/Microphone blocked. Please enable permissions and try again.
              </span>
              <button
                onClick={handleStartGoLive}
                disabled={isStarting}
                className="rounded-lg bg-red-500/80 px-3 py-1 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                Retry
              </button>
            </div>
          )}

          <button
            onClick={handleStartGoLive}
            disabled={!config.title.trim() || isSpecialCategory || isStarting}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 rounded-lg font-bold text-white transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Video className="w-5 h-5" />
            {isSpecialCategory
              ? 'Select another category to go live'
              : isStarting
                ? 'Going Live...'
                : 'Go Live'}
          </button>

        </div>

      </div>
    </div>
  );
};

export default GoLiveSetup;
