import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';

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
