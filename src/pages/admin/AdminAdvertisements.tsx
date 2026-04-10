import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

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

export default function AdminAdvertisements() {
  const [ads, setAds] = useState<UserAdvertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'queued' | 'active' | 'all'>('pending');

  const fetchAds = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, []);

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

  if (loading) {
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
