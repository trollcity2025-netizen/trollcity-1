import React, { useState } from 'react';
import { Music, Users, Disc, Verified, Edit, Share2, Heart } from 'lucide-react';
import { useArtistProfile, useSongs, useAlbums, useArtistFollow } from '@/lib/hooks/useMedia';
import { trollCityTheme } from '@/styles/trollCityTheme';
import { useAuthStore } from '@/lib/store';

interface ArtistProfilePageProps {
  userId?: string;
}

export default function ArtistProfilePage({ userId }: ArtistProfilePageProps) {
  const { user } = useAuthStore();
  const { profile, loading: profileLoading, isOwnProfile } = useArtistProfile(userId || user?.id);
  const { songs } = useSongs({ artistId: profile?.id, limit: 10 });
  const { albums } = useAlbums({ artistId: profile?.id, limit: 6 });
  const { isFollowing, followersCount, toggleFollow } = useArtistFollow(profile?.id);
  const [activeTab, setActiveTab] = useState<'songs' | 'albums' | 'about'>('songs');

  if (profileLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile && !isOwnProfile) {
    return (
      <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl p-12 text-center`}>
        <p className="text-gray-400">Artist profile not found</p>
      </div>
    );
  }

  if (!profile && isOwnProfile) {
    return <CreateArtistProfile />;
  }

  return (
    <div className="space-y-6">
      <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl overflow-hidden`}>
        <div className="h-48 bg-gradient-to-r from-purple-900 via-pink-900 to-cyan-900 relative">
          {profile?.profile_banner_url && (
            <img src={profile.profile_banner_url} alt="" className="w-full h-full object-cover" />
          )}
        </div>

        <div className="px-6 pb-6">
          <div className="flex flex-col md:flex-row md:items-end -mt-16 mb-4">
            <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-4xl font-bold border-4 border-slate-900">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.artist_name} className="w-full h-full rounded-xl object-cover" />
              ) : (
                profile?.artist_name.charAt(0)
              )}
            </div>
            <div className="mt-4 md:mt-0 md:ml-4 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-3xl font-bold text-white">{profile?.artist_name}</h2>
                {profile?.verified && <Verified className="w-6 h-6 text-blue-400" />}
              </div>
              <p className="text-gray-400">{profile?.genre || 'Artist'}</p>
            </div>
            <div className="flex gap-3 mt-4 md:mt-0">
              {!isOwnProfile && (
                <button
                  onClick={toggleFollow}
                  className={`px-6 py-2 rounded-xl font-semibold ${
                    isFollowing 
                      ? 'bg-white/10 text-white border border-white/20' 
                      : 'bg-pink-500 text-white'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
              {isOwnProfile && (
                <button className="px-6 py-2 rounded-xl bg-white/10 text-white border border-white/20 flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  Edit Profile
                </button>
              )}
              <button className="p-2 rounded-xl bg-white/10 text-white border border-white/20">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="font-semibold text-white">{followersCount}</span>
              <span className="text-gray-500">followers</span>
            </div>
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-gray-500" />
              <span className="font-semibold text-white">{profile?.total_plays || 0}</span>
              <span className="text-gray-500">plays</span>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-gray-500" />
              <span className="font-semibold text-white">{profile?.total_tips || 0}</span>
              <span className="text-gray-500">tips</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-white/10">
        {(['songs', 'albums', 'about'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium capitalize transition-colors relative ${
              activeTab === tab ? 'text-pink-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-400" />
            )}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'songs' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {songs.map((song) => (
              <div key={song.id} className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-xl p-4 flex items-center gap-4`}>
                <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center">
                  <Music className="w-6 h-6 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{song.title}</p>
                  <p className="text-sm text-gray-500">{song.plays} plays</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'albums' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {albums.map((album) => (
              <div key={album.id} className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-xl p-4`}>
                <div className="aspect-square rounded-lg bg-white/10 mb-3 flex items-center justify-center">
                  <Disc className="w-12 h-12 text-gray-600" />
                </div>
                <p className="font-medium text-white">{album.title}</p>
                <p className="text-sm text-gray-500">{album.total_tracks} tracks</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'about' && (
          <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl p-6`}>
            <h3 className="font-semibold text-white mb-2">About</h3>
            <p className="text-gray-400">{profile?.bio || 'No bio yet.'}</p>
            
            {profile?.location && (
              <div className="mt-4">
                <span className="text-gray-500 text-sm">Location:</span>
                <p className="text-white">{profile.location}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateArtistProfile() {
  const [artistName, setArtistName] = useState('');
  const [bio, setBio] = useState('');
  const [genre, setGenre] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoading(false);
  };

  return (
    <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl p-8 max-w-xl mx-auto`}>
      <h2 className="text-2xl font-bold mb-2">Create Your Artist Profile</h2>
      <p className="text-gray-400 mb-6">Start your music journey in Media City</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Artist Name</label>
          <input
            type="text"
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Genre</label>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
          >
            <option value="">Select genre</option>
            <option value="Hip Hop">Hip Hop</option>
            <option value="R&B">R&B</option>
            <option value="Pop">Pop</option>
            <option value="Rock">Rock</option>
            <option value="Electronic">Electronic</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white h-24 resize-none"
            placeholder="Tell us about yourself..."
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Profile'}
        </button>
      </form>
    </div>
  );
}
