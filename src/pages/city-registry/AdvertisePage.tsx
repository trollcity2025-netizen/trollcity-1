import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase, UserRole } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';

interface UserAdvertisement {
  id: string;
  user_id: string;
  title: string;
  subtitle: string;
  description: string;
  image_url: string;
  link_url: string;
  status: string;
  cost_paid: number;
  submitted_at: string;
  approved_at: string;
  expires_at: string;
  queue_position: number;
  is_active_slot: boolean;
  slot_start_time: string;
  clicks_count: number;
  impressions_count: number;
  user_profiles: { username: string };
}

export default function AdvertisePage() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    description: '',
    image_url: '',
    link_url: ''
  });

  // Admin state
  const [ads, setAds] = useState<UserAdvertisement[]>([]);
  const [adminLoading, setAdminLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'queued' | 'active' | 'all'>('pending');

  const isAdmin = profile?.role === UserRole.ADMIN || profile?.role === UserRole.SECRETARY || profile?.is_admin;

  const fetchAds = async () => {
    setAdminLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_advertisements')
        .select(`
          *,
          user_profiles!user_advertisements_user_id_fkey (username)
        `)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setAds(data || []);
    } catch (err) {
      console.error('Failed to fetch ads:', err);
      toast.error('Failed to load advertisements');
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAds();
    }
  }, [isAdmin]);

  const approveAd = async (adId: string) => {
    try {
      const { data, error } = await supabase.rpc('approve_advertisement', {
        p_ad_id: adId
      });

      if (error) throw error;
      
      if (data.success) {
        await supabase.rpc('add_ad_to_queue', { p_ad_id: adId });
        toast.success('Ad approved and added to queue');
        fetchAds();
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      console.error('Failed to approve ad:', err);
      toast.error('Failed to approve advertisement');
    }
  };

  const denyAd = async (adId: string) => {
    const reason = prompt('Enter reason for denial:');
    if (!reason) return;

    try {
      const { data, error } = await supabase.rpc('deny_advertisement', {
        p_ad_id: adId,
        p_reason: reason
      });

      if (error) throw error;
      
      if (data.success) {
        toast.success('Ad denied');
        fetchAds();
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      console.error('Failed to deny ad:', err);
      toast.error('Failed to deny advertisement');
    }
  };

  const rotateQueue = async () => {
    try {
      const { data, error } = await supabase.rpc('rotate_ad_queue');
      if (error) throw error;
      toast.success(`Queue rotated: ${data.rotations_performed} changes`);
      fetchAds();
    } catch (err) {
      toast.error('Failed to rotate queue');
    }
  };

  const filteredAds = ads.filter(ad => {
    if (activeTab === 'all') return true;
    return ad.status === activeTab;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.image_url) {
      toast.error('Title and image are required');
      return;
    }

    if (!profile || profile.troll_coins < 1000) {
      toast.error('You need at least 1000 Troll Coins to submit an ad');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('submit_advertisement', {
        p_title: formData.title,
        p_subtitle: formData.subtitle || null,
        p_description: formData.description || null,
        p_image_url: formData.image_url,
        p_link_url: formData.link_url || null
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        setFormData({
          title: '',
          subtitle: '',
          description: '',
          image_url: '',
          link_url: ''
        });
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      console.error('Failed to submit ad:', err);
      toast.error('Failed to submit advertisement');
    } finally {
      setLoading(false);
    }
  };

  // Admin view
  if (isAdmin) {
    if (adminLoading) {
      return <div className="p-6 text-slate-400">Loading advertisements...</div>;
    }

    return (
      <div className="p-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Advertisement Management</h1>
            <p className="text-slate-400 text-sm">Approve, deny, and manage user submitted ads</p>
          </div>
          <button
            onClick={rotateQueue}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm font-medium"
          >
            Rotate Queue Now
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          {(['pending', 'queued', 'active', 'all'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} ({ads.filter(a => a.status === tab).length})
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filteredAds.length === 0 ? (
            <div className="bg-slate-900/50 rounded-xl p-8 text-center border border-slate-800">
              <p className="text-slate-400">No {activeTab} advertisements</p>
            </div>
          ) : (
            filteredAds.map(ad => (
              <div key={ad.id} className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
                <div className="flex gap-4">
                  <img 
                    src={ad.image_url} 
                    alt={ad.title}
                    className="w-32 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-white">{ad.title}</h3>
                        {ad.subtitle && <p className="text-slate-400 text-sm">{ad.subtitle}</p>}
                        <p className="text-slate-500 text-xs mt-1">
                          Submitted by @{ad.user_profiles?.username} • {new Date(ad.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        ad.status === 'pending' ? 'bg-yellow-600/20 text-yellow-400' :
                        ad.status === 'queued' ? 'bg-blue-600/20 text-blue-400' :
                        ad.status === 'active' ? 'bg-green-600/20 text-green-400' :
                        ad.status === 'denied' ? 'bg-red-600/20 text-red-400' :
                        'bg-slate-600/20 text-slate-400'
                      }`}>
                        {ad.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                      <span>👁️ {ad.impressions_count} impressions</span>
                      <span>👆 {ad.clicks_count} clicks</span>
                      {ad.queue_position != null && <span>📋 Queue #{ad.queue_position}</span>}
                    </div>

                    {ad.status === 'pending' && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => approveAd(ad.id)}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-white text-xs font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => denyAd(ad.id)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-white text-xs font-medium"
                        >
                          Deny
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Regular user view
  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Advertise on Troll City</h1>
        <p className="text-slate-400 text-sm">
          Submit your advertisement for 1000 Troll Coins. Ads run for 7 days after approval.
        </p>
      </div>

      <div className="bg-slate-900/80 rounded-2xl p-6 border border-slate-800">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Ad Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white"
              placeholder="Enter ad title"
              maxLength={50}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Subtitle</label>
            <input
              type="text"
              value={formData.subtitle}
              onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white"
              placeholder="Short subtitle (optional)"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white resize-none"
              placeholder="Longer description (optional)"
              rows={3}
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Image URL *</label>
            <input
              type="url"
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white"
              placeholder="https://example.com/your-ad-image.png"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Link URL (optional)</label>
            <input
              type="url"
              value={formData.link_url}
              onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
              className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white"
              placeholder="https://your-website.com"
            />
          </div>

          <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-sm">Cost</span>
              <span className="text-purple-400 font-semibold">1000 Troll Coins</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-slate-300 text-sm">Your Balance</span>
              <span className={profile?.troll_coins >= 1000 ? 'text-green-400' : 'text-red-400'}>
                {profile?.troll_coins || 0} Troll Coins
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-2">Ads run for 7 days total, 24 hours per active slot</p>
          </div>

          <button
            type="submit"
            disabled={loading || !profile || profile.troll_coins < 1000}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting...' : 'Submit Advertisement'}
          </button>
        </form>
      </div>
    </div>
  );
}
