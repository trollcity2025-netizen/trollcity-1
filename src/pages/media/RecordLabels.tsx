import React, { useState } from 'react';
import { Disc, Plus, Users, TrendingUp, Verified, Search } from 'lucide-react';
import { useRecordLabels, useRecordLabel } from '@/lib/hooks/useMedia';
import { trollCityTheme } from '@/styles/trollCityTheme';
import { useAuthStore } from '@/lib/store';
import { LABEL_CREATION_COST } from '@/types/media';
import { toast } from 'sonner';

export default function RecordLabels() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { labels, loading } = useRecordLabels({ featured: false });
  const { user } = useAuthStore();

  const filteredLabels = labels.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Record Labels</h2>
          <p className="text-gray-400">Discover labels and artists, or start your own</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
          Create Label
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search record labels..."
          className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500"
        />
      </div>

      {/* Featured Labels */}
      {!searchQuery && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Featured Labels</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="h-48 bg-white/5 rounded-2xl animate-pulse" />
              ))
            ) : labels.filter(l => l.featured).map((label) => (
              <LabelCard key={label.id} label={label} />
            ))}
          </div>
        </div>
      )}

      {/* All Labels */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">
          {searchQuery ? 'Search Results' : 'All Labels'}
        </h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLabels.map((label) => (
            <LabelCard key={label.id} label={label} />
          ))}
        </div>
      </div>

      {/* Create Label Modal */}
      {showCreateModal && (
        <CreateLabelModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

function LabelCard({ label }: { label: any }) {
  return (
    <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl p-6 hover:border-purple-500/50 transition-colors group`}>
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl font-bold">
          {label.name.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-white">{label.name}</h4>
            {label.verified && <Verified className="w-4 h-4 text-blue-400" />}
          </div>
          <p className="text-sm text-gray-400 line-clamp-2">{label.description}</p>
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {label.artist_count} artists
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              {label.total_tips} tips
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateLabelModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { createLabel } = useRecordLabel();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await createLabel({ name, description });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl p-6 max-w-md w-full`}>
        <h3 className="text-xl font-bold mb-4">Create Record Label</h3>
        <p className="text-gray-400 text-sm mb-4">
          Cost: {LABEL_CREATION_COST.toLocaleString()} coins
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Label name"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
            required
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white h-24 resize-none"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-white/20 text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Label'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
