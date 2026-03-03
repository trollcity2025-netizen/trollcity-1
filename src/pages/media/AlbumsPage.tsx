import React, { useState } from 'react';
import { Disc, Plus, Music, Calendar, Heart } from 'lucide-react';
import { useAlbums } from '@/lib/hooks/useMedia';
import { trollCityTheme } from '@/styles/trollCityTheme';
import { RELEASE_TYPES } from '@/types/media';

export default function AlbumsPage() {
  const [filter, setFilter] = useState<'all' | 'single' | 'ep' | 'album'>('all');
  const { albums, loading } = useAlbums({ limit: 20 });

  const filteredAlbums = filter === 'all' 
    ? albums 
    : albums.filter(a => a.release_type === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Albums</h2>
          <p className="text-gray-400">Browse collections, EPs, and singles</p>
        </div>
        <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold flex items-center gap-2">
          <Plus className="w-5 h-5" />
          New Release
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', ...RELEASE_TYPES.map(t => t.value)].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type as any)}
            className={`
              px-4 py-2 rounded-xl capitalize transition-all
              ${filter === type
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }
            `}
          >
            {type === 'all' ? 'All' : type}
          </button>
        ))}
      </div>

      {/* Albums Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredAlbums.length === 0 ? (
        <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl p-12 text-center`}>
          <Disc className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">No albums found</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAlbums.map((album) => (
            <div 
              key={album.id} 
              className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl overflow-hidden group hover:border-purple-500/50 transition-colors`}
            >
              {/* Cover */}
              <div className="aspect-square bg-gradient-to-br from-purple-900/50 to-pink-900/50 flex items-center justify-center relative">
                {album.cover_url ? (
                  <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover" />
                ) : (
                  <Disc className="w-20 h-20 text-gray-600" />
                )}
                <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/60 text-xs text-white capitalize">
                  {album.release_type}
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-semibold text-white truncate">{album.title}</h3>
                <p className="text-sm text-gray-400">{album.artist?.artist_name}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Music className="w-3 h-3" />
                    {album.total_tracks} tracks
                  </span>
                  {album.release_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(album.release_date).getFullYear()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
