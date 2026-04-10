import React, { useState, useEffect } from 'react';
import { 
  Megaphone, Image, Video, FileText, Share2, Clock, 
  CheckCircle, XCircle, Download, Edit, Trash2, 
  RefreshCw, Plus, Layout, Link, Hash, Users, 
  BarChart3, Calendar, Send, FolderOpen, AlertTriangle,
  Instagram, Twitter, Sparkles, Brain, Zap, Eye, Check,
  Facebook
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

type ContentSourceType = 
  | 'stream' | 'trollpod' | 'wall_post' | 'event' 
  | 'career' | 'wallet' | 'government' | 'court'
  | 'church' | 'safety' | 'marketplace' | 'profile'
  | 'family' | 'tcnn' | 'battle' | 'broadcast';

interface ContentSource {
  id: string;
  type: ContentSourceType;
  title: string;
  description: string;
  url: string;
  screenshot_url?: string;
  stats?: Record<string, any>;
  cta_text?: string;
}

interface AdJob {
  id: string;
  job_type: string;
  job_status: string;
  template_type?: string;
  created_at: string;
}

interface AdAsset {
  id: string;
  asset_type: string;
  public_url?: string;
  width?: number;
  height?: number;
  created_at: string;
}

interface AdVideo {
  id: string;
  template_type: string;
  public_url?: string;
  duration_seconds?: number;
  width?: number;
  height?: number;
  created_at: string;
}

interface CaptionVariant {
  id: string;
  caption_style: string;
  caption_text: string;
  hashtags?: string;
  cta_text?: string;
  is_selected?: boolean;
  created_at: string;
}

interface SocialAccount {
  id: string;
  platform: 'x' | 'instagram' | 'facebook';
  platform_username?: string;
  platform_display_name?: string;
  account_status: string;
  last_synced_at?: string;
}

interface QueueItem {
  id: string;
  platform: string;
  publish_status: string;
  scheduled_at?: string;
  published_at?: string;
  platform_post_url?: string;
  asset_id?: string;
  video_id?: string;
  caption_id?: string;
}

const contentTypeLabels: Record<ContentSourceType, string> = {
  stream: 'Live Streams',
  trollpod: 'Troll Pods',
  wall_post: 'Troll Feed',
  event: 'Events',
  career: 'Careers',
  wallet: 'Wallet / Cashout',
  government: 'Government',
  court: 'Court Notices',
  church: 'Church',
  safety: 'Safety Pages',
  marketplace: 'Marketplace',
  profile: 'Profiles',
  family: 'Family Pages',
  tcnn: 'TCNN News',
  battle: 'Battle Pages',
  broadcast: 'Broadcast Setup'
};

const ctaOptions: Record<ContentSourceType, string> = {
  stream: 'Go live on Troll City',
  trollpod: 'Join the conversation',
  wall_post: 'Join Troll City',
  event: 'Join the event',
  career: 'Apply now',
  wallet: 'Cash out for real',
  government: 'Explore Troll City',
  court: 'Enter Troll Court',
  church: 'Join the community',
  safety: 'Stay safe in Troll City',
  marketplace: 'Shop now',
  profile: 'Follow on Troll City',
  family: 'Join the family',
  tcnn: 'Read more on TCNN',
  battle: 'Join the battle',
  broadcast: 'Start broadcasting'
};

const captionStyles = [
  { id: 'aggressive', label: 'Aggressive / Bold', icon: Zap },
  { id: 'clean', label: 'Clean Product', icon: Sparkles },
  { id: 'hype', label: 'Hype / Launch', icon: Brain },
  { id: 'founder', label: 'Founder Voice', icon: Users },
  { id: 'short_promo', label: 'Short Promo', icon: FileText }
];

export default function XAdsStudio() {
  const [activeTab, setActiveTab] = useState<'sources' | 'generate' | 'images' | 'videos' | 'captions' | 'queue' | 'scheduled' | 'published' | 'accounts' | 'analytics'>('sources');
  const [contentSources, setContentSources] = useState<ContentSource[]>([]);
  const [jobs, setJobs] = useState<AdJob[]>([]);
  const [assets, setAssets] = useState<AdAsset[]>([]);
  const [videos, setVideos] = useState<AdVideo[]>([]);
  const [captions, setCaptions] = useState<CaptionVariant[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [urlInput, setUrlInput] = useState('');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [showOauthConfig, setShowOauthConfig] = useState(false);
  const [customRedirectUrl, setCustomRedirectUrl] = useState('');
  const [uploadingAsset, setUploadingAsset] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<ContentSource | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sourcesRes, jobsRes, captionsRes, accountsRes, queueRes] = await Promise.all([
        supabase.from('source_content_refs').select('*').order('captured_at', { ascending: false }),
        supabase.from('ad_generation_jobs').select('*').order('created_at', { ascending: false }),
        supabase.from('caption_variants').select('*').order('created_at', { ascending: false }),
        supabase.from('connected_social_accounts').select('*'),
        supabase.from('social_publish_queue').select('*').order('created_at', { ascending: false })
      ]);

      if (sourcesRes.data) {
        console.log('Sources:', sourcesRes.data);
        setContentSources(sourcesRes.data);
      }
      if (jobsRes.data) {
        console.log('Jobs:', jobsRes.data);
        setJobs(jobsRes.data);
      }
      
      // Fetch assets with proper error handling
      const { data: assetsData, error: assetsError } = await supabase
        .from('ad_assets')
        .select('*')
        .order('created_at', { ascending: false });
      
      console.log('Assets response:', assetsData, assetsError);
      if (assetsData) setAssets(assetsData);
      
      // Fetch videos with proper error handling
      const { data: videosData, error: videosError } = await supabase
        .from('ad_videos')
        .select('*')
        .order('created_at', { ascending: false });
      
      console.log('Videos response:', videosData, videosError);
      if (videosData) setVideos(videosData);
      
      if (captionsRes.data) setCaptions(captionsRes.data);
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (queueRes.data) setQueue(queueRes.data);
      
      if (captionsRes.data) setCaptions(captionsRes.data);
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (queueRes.data) setQueue(queueRes.data);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const captureContent = async () => {
    if (!urlInput.trim()) {
      toast.error('Enter a URL to capture');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('capture-content', {
        body: { url: urlInput }
      });

      if (error) throw error;
      
      if (data?.source) {
        setContentSources(prev => [data.source, ...prev]);
        setSelectedSource(data.source);
        toast.success('Content captured successfully');
      }
    } catch (err) {
      console.error('Failed to capture content:', err);
      toast.error('Failed to capture content');
    }
  };

  const [generating, setGenerating] = useState<string | null>(null);

  const generateAds = async (type: 'image_ad' | 'video_promo' | 'caption_only' | 'full_campaign') => {
    if (!selectedSource) {
      toast.error('Select a content source first');
      return;
    }

    setGenerating(type);
    toast.info('Generating with Runway AI...');

    try {
      console.log('Calling generate-ad with:', { source_id: selectedSource.id, generation_type: type, asset_type: 'all' });
      
      const { data, error } = await supabase.functions.invoke('generate-ad', {
        body: {
          source_id: selectedSource.id,
          generation_type: type,
          asset_type: 'all'
        }
      });

      console.log('Generate response:', data, error);

      if (error) {
        console.error('Generation error:', error);
        // Try to get more details from the error
        const errorMessage = error.message || error.data?.error || JSON.stringify(error);
        toast.error(`Error: ${errorMessage}`);
        setGenerating(null);
        return;
      }
      
      if (data?.success) {
        toast.success(`Generated ${data.assets?.length || 0} images, ${data.videos?.length || 0} videos`);
      } else if (data?.error) {
        toast.error(data.error);
      }
      
      if (data?.success) {
        toast.success(`Generated ${data.assets?.length || 0} images, ${data.videos?.length || 0} videos`);
        console.log('Generated assets:', data.assets);
        console.log('Generated videos:', data.videos);
      } else if (data?.error) {
        toast.error(data.error);
        console.error('Generation failed:', data.error);
      }
      
      // Wait a moment then refresh
      setTimeout(() => {
        fetchData();
        setGenerating(null);
      }, 2000);
    } catch (err: any) {
      console.error('Failed to generate:', err);
      toast.error(err?.message || 'Failed to generate');
      setGenerating(null);
    }
  };

  const publishToSocial = async (queueId: string, platform: 'x' | 'instagram' | 'facebook') => {
    try {
      const { data, error } = await supabase.functions.invoke('publish-social', {
        body: { queue_id: queueId, platform }
      });

      if (error) throw error;
      
      toast.success(`Posted to ${platform}`);
      fetchData();
    } catch (err) {
      console.error('Failed to publish:', err);
      toast.error('Failed to publish');
    }
  };

  const generateCodeVerifier = (): string => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const generateCodeChallenge = async (verifier: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const connectAccount = async (platform: 'x' | 'instagram' | 'facebook') => {
    const redirectUrl = customRedirectUrl || 'https://maitrollcity.com/admin/x-ads/oauth-callback';
    
    console.log('Connecting with redirect:', redirectUrl);
    
    const body: Record<string, string> = { platform };
    
    if (platform === 'x') {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      localStorage.setItem('pkce_code_verifier', codeVerifier);
      body.code_challenge = codeChallenge;
      body.code_verifier = codeVerifier;
    }

    const { data, error } = await supabase.functions.invoke('social-oauth-init', {
      body
    });

    if (error) {
      console.error('OAuth error:', error);
      toast.error('OAuth failed: ' + error.message);
      return;
    }
    
    if (data?.error) {
      console.error('OAuth API error:', data);
      toast.error('OAuth error: ' + data.error);
      return;
    }

    if (error) {
      toast.error('Failed to initiate OAuth');
      return;
    }

    window.location.href = data?.auth_url;
  };

  const disconnectAccount = async (accountId: string) => {
    try {
      await supabase.from('connected_social_accounts').delete().eq('id', accountId);
      toast.success('Account disconnected');
      fetchData();
    } catch (err) {
      toast.error('Failed to disconnect');
    }
  };

  const handleImageUpload = async (assetId: string, file: File) => {
    setUploadingAsset(assetId);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      const { data, error } = await supabase.storage
        .from('ad-assets')
        .upload(`${assetId}/${file.name}`, uint8Array, { upsert: true });
      
      if (error) throw error;
      
      const { data: urlData } = supabase.storage.from('ad-assets').getPublicUrl(`${assetId}/${file.name}`);
      
      await supabase.from('ad_assets').update({
        public_url: urlData.publicUrl,
        file_path: `${assetId}/${file.name}`
      }).eq('id', assetId);
      
      toast.success('Image uploaded');
      fetchData();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Upload failed');
    } finally {
      setUploadingAsset(null);
    }
  };

  const deleteAsset = async (assetId: string) => {
    try {
      // Get asset to find storage path
      const asset = assets.find(a => a.id === assetId);
      
      // Delete from storage if has public_url from our bucket
      if (asset?.public_url && asset.public_url.includes('ad-assets')) {
        const urlParts = asset.public_url.split('/ad-assets/');
        if (urlParts[1]) {
          await supabase.storage.from('ad-assets').remove([urlParts[1]]);
        }
      }
      
      await supabase.from('ad_assets').delete().eq('id', assetId);
      setAssets(prev => prev.filter(a => a.id !== assetId));
      toast.success('Asset deleted');
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete');
    }
  };

  const deleteVideo = async (videoId: string) => {
    try {
      // Get video to find storage path
      const video = videos.find(v => v.id === videoId);
      
      // Delete from storage if has public_url from our bucket
      if (video?.public_url && video.public_url.includes('ad-assets')) {
        const urlParts = video.public_url.split('/ad-assets/');
        if (urlParts[1]) {
          await supabase.storage.from('ad-assets').remove([urlParts[1]]);
        }
      }
      
      await supabase.from('ad_videos').delete().eq('id', videoId);
      setVideos(prev => prev.filter(v => v.id !== videoId));
      toast.success('Video deleted');
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete');
    }
  };

  const schedulePost = async (queueId: string, scheduledAt: Date) => {
    try {
      await supabase.from('social_publish_queue').update({
        publish_status: 'scheduled',
        scheduled_at: scheduledAt.toISOString()
      }).eq('id', queueId);
      
      toast.success('Post scheduled');
      fetchData();
    } catch (err) {
      toast.error('Failed to schedule');
    }
  };

  const [addToQueueLoading, setAddToQueueLoading] = useState<string | null>(null);
  const [selectedCaption, setSelectedCaption] = useState<string | null>(null);
  const [showCaptionSelect, setShowCaptionSelect] = useState(false);
  const [schedulingItem, setSchedulingItem] = useState<{id: string; type: 'asset' | 'video'} | null>(null);

  const addToQueue = async (platform: 'x' | 'instagram' | 'facebook', type: 'asset' | 'video') => {
    const itemId = type === 'asset' ? selectedAsset : selectedVideo;
    if (!itemId) {
      toast.error(`Select a ${type} first`);
      return;
    }

    setAddToQueueLoading(type);
    try {
      const queueItem = {
        platform,
        asset_id: type === 'asset' ? itemId : null,
        video_id: type === 'video' ? itemId : null,
        caption_id: selectedCaption,
        publish_status: 'draft'
      };

      const { data, error } = await supabase.from('social_publish_queue').insert(queueItem).select().single();
      
      if (error) throw error;
      
      toast.success(`Added to ${platform} queue`);
      setSelectedAsset(null);
      setSelectedVideo(null);
      setSelectedCaption(null);
      setShowCaptionSelect(false);
      fetchData();
    } catch (err: any) {
      console.error('Failed to add to queue:', err);
      toast.error(err?.message || 'Failed to add to queue');
    } finally {
      setAddToQueueLoading(null);
    }
  };

  const openScheduleModal = (type: 'asset' | 'video') => {
    const itemId = type === 'asset' ? selectedAsset : selectedVideo;
    if (!itemId) {
      toast.error(`Select a ${type} first`);
      return;
    }
    setSchedulingItem({ id: itemId, type });
  };

  const handleSchedule = async (scheduledAt: Date) => {
    if (!schedulingItem) return;
    
    try {
      const queueItem = {
        platform: 'x',
        asset_id: schedulingItem.type === 'asset' ? schedulingItem.id : null,
        video_id: schedulingItem.type === 'video' ? schedulingItem.id : null,
        caption_id: selectedCaption,
        publish_status: 'scheduled',
        scheduled_at: scheduledAt.toISOString()
      };

      const { error } = await supabase.from('social_publish_queue').insert(queueItem);
      
      if (error) throw error;
      
      toast.success('Scheduled successfully');
      setSchedulingItem(null);
      setSelectedAsset(null);
      setSelectedVideo(null);
      setSelectedCaption(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to schedule');
    }
  };

  const tabs = [
    { id: 'sources', label: 'Content Sources', icon: FolderOpen, count: contentSources.length },
    { id: 'generate', label: 'Generate Ad', icon: Sparkles },
    { id: 'images', label: 'Generated Images', icon: Image, count: assets.length },
    { id: 'videos', label: 'Generated Videos', icon: Video, count: videos.length },
    { id: 'captions', label: 'Caption Variants', icon: FileText, count: captions.length },
    { id: 'queue', label: 'Share Queue', icon: Share2, count: queue.filter(q => q.publish_status === 'draft').length },
    { id: 'scheduled', label: 'Scheduled', icon: Calendar, count: queue.filter(q => q.publish_status === 'scheduled').length },
    { id: 'published', label: 'Published', icon: CheckCircle, count: queue.filter(q => q.publish_status === 'published').length },
    { id: 'accounts', label: 'Connected Accounts', icon: Users, count: accounts.filter(a => a.account_status === 'active').length },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 }
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Megaphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">X Ads Studio</h1>
              <p className="text-gray-400 text-sm">Generate and share promotional assets</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {showOauthConfig && (
              <div className="flex gap-2 mr-4 items-center">
                <input
                  type="text"
                  placeholder="X Client ID"
                  value={oauthClientId}
                  onChange={(e) => setOauthClientId(e.target.value)}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm w-48"
                />
                <input
                  type="password"
                  placeholder="Client Secret"
                  value={oauthClientSecret}
                  onChange={(e) => setOauthClientSecret(e.target.value)}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm w-40"
                />
                <input
                  type="text"
                  placeholder="Redirect URL (optional)"
                  value={customRedirectUrl}
                  onChange={(e) => setCustomRedirectUrl(e.target.value)}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm w-64"
                />
              </div>
            )}
            <button
              onClick={() => {
                if (!oauthClientId) {
                  setShowOauthConfig(true);
                  toast.info('Enter your X Developer OAuth credentials');
                } else {
                  connectAccount('x');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-black border border-gray-700 rounded-lg hover:bg-gray-900"
            >
              <Twitter className="w-4 h-4" />
              Connect X
            </button>
            <button
              onClick={() => connectAccount('instagram')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:opacity-90"
            >
              <Instagram className="w-4 h-4" />
              Connect Instagram
            </button>
            <button
              onClick={() => connectAccount('facebook')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 rounded-lg hover:bg-blue-800"
            >
              <Facebook className="w-4 h-4" />
              Connect Facebook
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-6 border-b border-gray-800 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-gray-800 text-xs rounded-full">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'sources' && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Capture Content</h3>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Enter Troll City URL..."
                  className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={captureContent}
                  className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Link className="w-4 h-4" />
                  Capture
                </button>
              </div>
              <p className="text-gray-500 text-sm mt-2">Enter a Troll City page URL to capture its content for ad generation</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contentSources.map(source => (
                <div
                  key={source.id}
                  onClick={() => setSelectedSource(source)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedSource?.id === source.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-1 bg-gray-800 text-xs rounded">
                      {contentTypeLabels[source.type as ContentSourceType] || source.type}
                    </span>
                    {source.screenshot_url && (
                      <Eye className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                  <h4 className="font-semibold mb-1 truncate">{source.title}</h4>
                  <p className="text-gray-400 text-sm line-clamp-2">{source.description}</p>
                  {source.cta_text && (
                    <div className="mt-3 pt-3 border-t border-gray-800">
                      <span className="text-blue-400 text-sm">{source.cta_text}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'generate' && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Select Content Source</h3>
              <select
                value={selectedSource?.id || ''}
                onChange={(e) => setSelectedSource(contentSources.find(s => s.id === e.target.value) || null)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select a captured content source...</option>
                {contentSources.map(source => (
                  <option key={source.id} value={source.id}>
                    {source.title} ({contentTypeLabels[source.type as ContentSourceType]})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
<button
              onClick={() => generateAds('image_ad')}
              disabled={!selectedSource || generating}
              className="p-6 bg-gray-900 rounded-xl border border-gray-800 hover:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  {generating === 'image_ad' ? (
                    <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                  ) : (
                    <Image className="w-5 h-5 text-blue-400" />
                  )}
                </div>
                <h4 className="font-semibold">Image Ads (Runway AI)</h4>
              </div>
              <p className="text-gray-400 text-sm">Generate ad graphics using Runway Gen 4 Image Turbo</p>
              {generating === 'image_ad' && <p className="text-blue-400 text-xs mt-2">Generating with Runway...</p>}
            </button>

                <button
                onClick={() => generateAds('video_promo')}
                disabled={!selectedSource || generating}
                className="p-6 bg-gray-900 rounded-xl border border-gray-800 hover:border-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    {generating === 'video_promo' ? (
                      <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
                    ) : (
                      <Video className="w-5 h-5 text-purple-400" />
                    )}
                  </div>
                  <h4 className="font-semibold">5-Second Video (Runway AI)</h4>
                </div>
                <p className="text-gray-400 text-sm">Create AI-generated promo video using Runway Gen 4.5</p>
                {generating === 'video_promo' && <p className="text-purple-400 text-xs mt-2">Generating with Runway...</p>}
              </button>

              <button
                onClick={() => generateAds('caption_only')}
                disabled={!selectedSource}
                className="p-6 bg-gray-900 rounded-xl border border-gray-800 hover:border-green-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-green-400" />
                  </div>
                  <h4 className="font-semibold">Caption Variants</h4>
                </div>
                <p className="text-gray-400 text-sm">Generate 3-5 caption options in different styles</p>
              </button>

              <button
                onClick={() => generateAds('full_campaign')}
                disabled={!selectedSource || generating}
                className="p-6 bg-gray-900 rounded-xl border border-gray-800 hover:border-orange-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    {generating === 'full_campaign' ? (
                      <RefreshCw className="w-5 h-5 text-orange-400 animate-spin" />
                    ) : (
                      <Layout className="w-5 h-5 text-orange-400" />
                    )}
                  </div>
                  <h4 className="font-semibold">Full Campaign</h4>
                </div>
                <p className="text-gray-400 text-sm">Generate images, video, and captions all at once</p>
                {generating === 'full_campaign' && <p className="text-orange-400 text-xs mt-2">Generating...</p>}
              </button>
            </div>

            {jobs.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Recent Jobs</h3>
                <div className="space-y-2">
                  {jobs.slice(0, 10).map(job => (
                    <div key={job.id} className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-3">
                        {job.job_type === 'image_ad' && <Image className="w-4 h-4 text-blue-400" />}
                        {job.job_type === 'video_promo' && <Video className="w-4 h-4 text-purple-400" />}
                        {job.job_type === 'caption_only' && <FileText className="w-4 h-4 text-green-400" />}
                        {job.job_type === 'full_campaign' && <Layout className="w-4 h-4 text-orange-400" />}
                        <span className="font-medium">{job.job_type.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          job.job_status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          job.job_status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                          job.job_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {job.job_status}
                        </span>
                        <span className="text-gray-500 text-sm">
                          {new Date(job.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'images' && (
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Generated Images</h3>
            <button 
              onClick={fetchData}
              className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        )}
        
        {activeTab === 'images' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {assets.map(asset => (
              <div 
                key={asset.id} 
                className={`bg-gray-900 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                  selectedAsset === asset.id 
                    ? 'border-blue-500 ring-2 ring-blue-500/30' 
                    : 'border-gray-800 hover:border-gray-600'
                }`}
                onClick={() => setSelectedAsset(selectedAsset === asset.id ? null : asset.id)}
              >
                <div className="aspect-square bg-gray-800 relative">
                  {selectedAsset === asset.id && (
                    <div className="absolute top-2 left-2 z-10 bg-blue-500 text-white p-1 rounded">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                  {asset.public_url ? (
                    <img 
                      src={asset.public_url} 
                      alt="" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('Image load error:', asset.public_url);
                        (e.target as HTMLImageElement).classList.add('hidden');
                        const placeholder = document.getElementById(`img-placeholder-${asset.id}`);
                        if (placeholder) placeholder.classList.remove('hidden');
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <Image className="w-8 h-8 text-gray-600 mx-auto mb-1" />
                        <span className="text-xs text-gray-500">No image</span>
                      </div>
                    </div>
                  )}
                  <div id={`img-placeholder-${asset.id}`} className={`absolute inset-0 flex items-center justify-center bg-gray-800 ${asset.public_url ? 'hidden' : ''}`}>
                    <div className="text-center">
                      <Image className="w-8 h-8 text-gray-600 mx-auto mb-1" />
                      <span className="text-xs text-gray-500">No image</span>
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{asset.asset_type}</span>
                    {asset.width && asset.height && (
                      <span className="text-xs text-gray-500">{asset.width}x{asset.height}</span>
                    )}
                  </div>
                  {selectedAsset === asset.id && (
                    <div className="mb-3 pt-3 border-t border-gray-800 space-y-2">
                      <button
                        onClick={() => setShowCaptionSelect(!showCaptionSelect)}
                        className="w-full px-3 py-2 bg-gray-800 rounded text-sm hover:bg-gray-700 flex items-center justify-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        {selectedCaption ? 'Caption Selected' : 'Select Caption'}
                      </button>
                      {showCaptionSelect && captions.length > 0 && (
                        <div className="max-h-32 overflow-y-auto bg-gray-800 rounded p-2 space-y-1">
                          {captions.map(cap => (
                            <button
                              key={cap.id}
                              onClick={() => {
                                setSelectedCaption(cap.id);
                                setShowCaptionSelect(false);
                              }}
                              className={`w-full text-left text-xs p-2 rounded ${
                                selectedCaption === cap.id ? 'bg-blue-500/30 text-blue-400' : 'hover:bg-gray-700'
                              }`}
                            >
                              {cap.caption_text.slice(0, 50)}...
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => addToQueue('x', 'asset')}
                          disabled={addToQueueLoading === 'asset'}
                          className="px-3 py-2 bg-blue-600 rounded text-sm hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Send className="w-4 h-4" />
                          X
                        </button>
                        <button
                          onClick={() => addToQueue('instagram', 'asset')}
                          disabled={addToQueueLoading === 'asset'}
                          className="px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded text-sm hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Instagram className="w-4 h-4" />
                          IG
                        </button>
                        <button
                          onClick={() => addToQueue('facebook', 'asset')}
                          disabled={addToQueueLoading === 'asset'}
                          className="px-3 py-2 bg-blue-700 rounded text-sm hover:bg-blue-800 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Facebook className="w-4 h-4" />
                          FB
                        </button>
                        <button
                          onClick={() => openScheduleModal('asset')}
                          className="col-span-2 px-3 py-2 bg-gray-800 rounded text-sm hover:bg-gray-700 flex items-center justify-center gap-2"
                        >
                          <Calendar className="w-4 h-4" />
                          Schedule
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-1">
                    <label className="p-2 hover:bg-gray-800 rounded cursor-pointer" title="Upload Image">
                      <input 
                        type="file" 
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleImageUpload(asset.id, e.target.files[0]);
                          }
                        }}
                      />
                      {uploadingAsset === asset.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </label>
                    <button 
                      onClick={() => {
                        if (asset.public_url) {
                          const link = document.createElement('a');
                          link.href = asset.public_url;
                          link.download = `${asset.asset_type}_${asset.id}.jpg`;
                          link.target = '_blank';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }
                      }}
                      className="p-2 hover:bg-gray-800 rounded" 
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => deleteAsset(asset.id)}
                      className="p-2 hover:bg-red-900/30 text-red-400 rounded" 
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {assets.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <Image className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No generated images yet</p>
                <p className="text-sm">Select content and generate image ads</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'videos' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map(video => (
              <div 
                key={video.id} 
                className={`bg-gray-900 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                  selectedVideo === video.id 
                    ? 'border-blue-500 ring-2 ring-blue-500/30' 
                    : 'border-gray-800 hover:border-gray-600'
                }`}
                onClick={() => setSelectedVideo(selectedVideo === video.id ? null : video.id)}
              >
                <div className="aspect-[9/16] bg-gray-800 relative">
                  {selectedVideo === video.id && (
                    <div className="absolute top-2 left-2 z-10 bg-blue-500 text-white p-1 rounded">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                  {video.public_url ? (
                    <video 
                      src={video.public_url}
                      controls 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('Video load error:', video.public_url);
                        (e.target as HTMLVideoElement).classList.add('hidden');
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <Video className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                        <span className="text-xs text-gray-500">No video generated</span>
                        <p className="text-xs text-gray-600 mt-1">Video generation coming soon</p>
                      </div>
                    </div>
                  )}
                  {video.public_url && video.duration_seconds && (
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-xs rounded">
                      {video.duration_seconds}s
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{video.template_type}</span>
                    <span className="text-xs text-gray-500">{video.width}x{video.height}</span>
                  </div>
                  {selectedVideo === video.id && (
                    <div className="mb-3 pt-3 border-t border-gray-800 space-y-2">
                      <button
                        onClick={() => setShowCaptionSelect(!showCaptionSelect)}
                        className="w-full px-3 py-2 bg-gray-800 rounded text-sm hover:bg-gray-700 flex items-center justify-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        {selectedCaption ? 'Caption Selected' : 'Select Caption'}
                      </button>
                      {showCaptionSelect && captions.length > 0 && (
                        <div className="max-h-32 overflow-y-auto bg-gray-800 rounded p-2 space-y-1">
                          {captions.map(cap => (
                            <button
                              key={cap.id}
                              onClick={() => {
                                setSelectedCaption(cap.id);
                                setShowCaptionSelect(false);
                              }}
                              className={`w-full text-left text-xs p-2 rounded ${
                                selectedCaption === cap.id ? 'bg-blue-500/30 text-blue-400' : 'hover:bg-gray-700'
                              }`}
                            >
                              {cap.caption_text.slice(0, 50)}...
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => addToQueue('x', 'video')}
                          disabled={addToQueueLoading === 'video'}
                          className="px-3 py-2 bg-blue-600 rounded text-sm hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Send className="w-4 h-4" />
                          X
                        </button>
                        <button
                          onClick={() => addToQueue('instagram', 'video')}
                          disabled={addToQueueLoading === 'video'}
                          className="px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded text-sm hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Instagram className="w-4 h-4" />
                          IG
                        </button>
                        <button
                          onClick={() => addToQueue('facebook', 'video')}
                          disabled={addToQueueLoading === 'video'}
                          className="px-3 py-2 bg-blue-700 rounded text-sm hover:bg-blue-800 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Facebook className="w-4 h-4" />
                          FB
                        </button>
                        <button
                          onClick={() => openScheduleModal('video')}
                          className="col-span-3 px-3 py-2 bg-gray-800 rounded text-sm hover:bg-gray-700 flex items-center justify-center gap-2"
                        >
                          <Calendar className="w-4 h-4" />
                          Schedule
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-1">
                    <button 
                      onClick={() => deleteVideo(video.id)}
                      className="p-2 hover:bg-red-900/30 text-red-400 rounded" 
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {videos.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No generated videos yet</p>
                <p className="text-sm">Select content and generate promo videos</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'captions' && (
          <div className="space-y-4">
            {captions.map(caption => (
              <div key={caption.id} className="p-4 bg-gray-900 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {captionStyles.find(s => s.id === caption.caption_style)?.icon && (
                      React.createElement(captionStyles.find(s => s.id === caption.caption_style)!.icon, {
                        className: "w-4 h-4 text-gray-400"
                      })
                    )}
                    <span className="px-2 py-1 bg-gray-800 rounded text-xs">{caption.caption_style}</span>
                    {caption.is_selected && (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">Selected</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button className="p-2 hover:bg-gray-800 rounded" title="Copy">
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-white mb-2">{caption.caption_text}</p>
                {caption.hashtags && (
                  <p className="text-blue-400 text-sm mb-2">{caption.hashtags}</p>
                )}
                {caption.cta_text && (
                  <p className="text-green-400 text-sm">{caption.cta_text}</p>
                )}
              </div>
            ))}
            {captions.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No captions generated yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="space-y-4">
            {queue.filter(q => q.publish_status === 'draft').map(item => (
              <div key={item.id} className="p-4 bg-gray-900 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {item.platform === 'x' ? (
                      <Twitter className="w-4 h-4" />
                    ) : (
                      <Instagram className="w-4 h-4" />
                    )}
                    <span className="font-medium capitalize">{item.platform}</span>
                  </div>
                  <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">Draft</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => publishToSocial(item.id, item.platform as 'x' | 'instagram')}
                    className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Share Now
                  </button>
                  <button className="px-4 py-2 bg-gray-800 rounded hover:bg-gray-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Schedule
                  </button>
                </div>
              </div>
            ))}
            {queue.filter(q => q.publish_status === 'draft').length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Share2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No items in share queue</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'scheduled' && (
          <div className="space-y-4">
            {queue.filter(q => q.publish_status === 'scheduled').map(item => (
              <div key={item.id} className="p-4 bg-gray-900 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {item.platform === 'x' ? <Twitter className="w-4 h-4" /> : <Instagram className="w-4 h-4" />}
                    <span className="font-medium capitalize">{item.platform}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-400">
                      {item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : 'Not scheduled'}
                    </span>
                  </div>
                </div>
                <button className="px-4 py-2 bg-gray-800 rounded hover:bg-gray-700">
                  Edit Schedule
                </button>
              </div>
            ))}
            {queue.filter(q => q.publish_status === 'scheduled').length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No scheduled posts</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'published' && (
          <div className="space-y-4">
            {queue.filter(q => q.publish_status === 'published').map(item => (
              <div key={item.id} className="p-4 bg-gray-900 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {item.platform === 'x' ? <Twitter className="w-4 h-4" /> : <Instagram className="w-4 h-4" />}
                    <span className="font-medium capitalize">{item.platform}</span>
                  </div>
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Published</span>
                </div>
                {item.published_at && (
                  <p className="text-gray-400 text-sm mb-2">
                    Published {new Date(item.published_at).toLocaleString()}
                  </p>
                )}
                {item.platform_post_url && (
                  <a
                    href={item.platform_post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline text-sm"
                  >
                    View post
                  </a>
                )}
              </div>
            ))}
            {queue.filter(q => q.publish_status === 'published').length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No published posts yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="space-y-4">
            {accounts.map(account => (
              <div key={account.id} className="p-4 bg-gray-900 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {account.platform === 'x' ? (
                      <Twitter className="w-6 h-6" />
                    ) : (
                      <Instagram className="w-6 h-6" />
                    )}
                    <div>
                      <h4 className="font-medium">{account.platform_display_name || account.platform_username}</h4>
                      <p className="text-gray-400 text-sm">@{account.platform_username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      account.account_status === 'active'
                        ? 'bg-green-500/20 text-green-400'
                        : account.account_status === 'expired'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {account.account_status}
                    </span>
                    <button
                      onClick={() => disconnectAccount(account.id)}
                      className="p-2 hover:bg-red-900/30 text-red-400 rounded"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {account.last_synced_at && (
                  <p className="text-gray-500 text-sm mt-2">
                    Last synced: {new Date(account.last_synced_at).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
            {accounts.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No connected accounts</p>
                <p className="text-sm">Connect your X or Instagram account to start sharing</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-6 bg-gray-900 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Megaphone className="w-5 h-5 text-blue-400" />
                <span className="text-gray-400">Total Campaigns</span>
              </div>
              <p className="text-3xl font-bold">{jobs.length}</p>
            </div>
            <div className="p-6 bg-gray-900 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Image className="w-5 h-5 text-purple-400" />
                <span className="text-gray-400">Total Images</span>
              </div>
              <p className="text-3xl font-bold">{assets.length}</p>
            </div>
            <div className="p-6 bg-gray-900 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Video className="w-5 h-5 text-green-400" />
                <span className="text-gray-400">Total Videos</span>
              </div>
              <p className="text-3xl font-bold">{videos.length}</p>
            </div>
            <div className="p-6 bg-gray-900 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Share2 className="w-5 h-5 text-orange-400" />
                <span className="text-gray-400">Published</span>
              </div>
              <p className="text-3xl font-bold">{queue.filter(q => q.publish_status === 'published').length}</p>
            </div>
          </div>
        )}

        {schedulingItem && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Schedule Post</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Select Date & Time</label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg"
                    onChange={(e) => {
                      if (e.target.value) {
                        handleSchedule(new Date(e.target.value));
                      }
                    }}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSchedulingItem(null)}
                    className="flex-1 px-4 py-3 bg-gray-800 rounded-lg hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      tomorrow.setHours(12, 0, 0, 0);
                      handleSchedule(tomorrow);
                    }}
                    className="flex-1 px-4 py-3 bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    Tomorrow 12pm
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}