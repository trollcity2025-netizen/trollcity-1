import React, { useState } from 'react';
import { Upload, Music, Disc, Mic, Edit, Trash2, Eye, EyeOff, Play } from 'lucide-react';
import { useMyUploads, useArtistProfile } from '@/lib/hooks/useMedia';
import { trollCityTheme } from '@/styles/trollCityTheme';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';

export default function UploadsPage() {
  const { user } = useAuthStore();
  const { songs, albums, projects, loading, publishSong, deleteSong } = useMyUploads();
  const { profile } = useArtistProfile(user?.id);
  const [activeTab, setActiveTab] = useState<'songs' | 'albums' | 'drafts'>('songs');
  const [showUploadModal, setShowUploadModal] = useState(false);

  if (!profile) {
    return (
      <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl p-8 text-center`}>
        <Mic className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <h3 className="text-xl font-semibold text-white mb-2">Create Artist Profile First</h3>
        <p className="text-gray-400 mb-4">You need an artist profile to upload music</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">My Uploads</h2>
          <p className="text-gray-400">Manage your music and releases</p>
        </div>
        <button 
          onClick={() => setShowUploadModal(true)}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold flex items-center gap-2"
        >
          <Upload className="w-5 h-5" />
          Upload New
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Published Songs', value: songs.filter(s => s.is_published).length, icon: Music },
          { label: 'Albums', value: albums.length, icon: Disc },
          { label: 'Drafts', value: songs.filter(s => !s.is_published).length + projects.length, icon: Mic },
        ].map((stat) => (
          <div key={stat.label} className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-xl p-4`}>
            <stat.icon className="w-5 h-5 text-gray-500 mb-2" />
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {(['songs', 'albums', 'drafts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium capitalize transition-colors relative ${
              activeTab === tab ? 'text-pink-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-400" />}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {activeTab === 'songs' && songs.filter(s => s.is_published).map((song) => (
            <div key={song.id} className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-xl p-4 flex items-center gap-4`}>
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                {song.cover_url ? (
                  <img src={song.cover_url} alt="" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <Music className="w-5 h-5 text-gray-500" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">{song.title}</p>
                <p className="text-sm text-gray-500">{song.plays} plays • {song.tips_total} tips</p>
              </div>
              <div className="flex gap-2">
                <button className="p-2 rounded-lg hover:bg-white/10 text-gray-400">
                  <Play className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-lg hover:bg-white/10 text-gray-400">
                  <Edit className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => deleteSong(song.id)}
                  className="p-2 rounded-lg hover:bg-white/10 text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {activeTab === 'albums' && albums.map((album) => (
            <div key={album.id} className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-xl p-4 flex items-center gap-4`}>
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                <Disc className="w-5 h-5 text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">{album.title}</p>
                <p className="text-sm text-gray-500">{album.total_tracks} tracks</p>
              </div>
            </div>
          ))}

          {activeTab === 'drafts' && (
            <>
              {songs.filter(s => !s.is_published).map((song) => (
                <div key={song.id} className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-xl p-4 flex items-center gap-4`}>
                  <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                    <EyeOff className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{song.title}</p>
                    <p className="text-sm text-yellow-500">Draft - Not published</p>
                  </div>
                  <button 
                    onClick={() => publishSong(song.id)}
                    className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium"
                  >
                    Publish
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl p-6 max-w-lg w-full`}>
            <h3 className="text-xl font-bold mb-4">Upload Song</h3>
            <p className="text-gray-400 mb-4">Feature coming soon - full upload flow with metadata editing</p>
            <button 
              onClick={() => setShowUploadModal(false)}
              className="w-full py-3 rounded-xl bg-white/10 text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
