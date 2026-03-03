import React, { useState } from 'react';
import { Play, Heart, TrendingUp, Clock, Music, Flame, Sparkles, MapPin } from 'lucide-react';
import { useSongs, useCharts } from '@/lib/hooks/useMedia';
import { trollCityTheme } from '@/styles/trollCityTheme';
import type { DiscoveryFeedType } from '@/types/media';
import AudioPlayer from '@/components/media/AudioPlayer';
import type { Song } from '@/types/media';

const FEEDS: { id: DiscoveryFeedType; label: string; icon: typeof TrendingUp; color: string }[] = [
  { id: 'trending', label: 'Trending', icon: Flame, color: 'text-orange-400' },
  { id: 'new_releases', label: 'New Releases', icon: Sparkles, color: 'text-cyan-400' },
  { id: 'top_tipped', label: 'Top Tipped', icon: TrendingUp, color: 'text-yellow-400' },
  { id: 'local', label: 'Local Artists', icon: MapPin, color: 'text-emerald-400' },
];

const GENRES = ['All', 'Hip Hop', 'R&B', 'Pop', 'Rock', 'Electronic', 'Jazz', 'Afrobeat'];

export default function DiscoverMusic() {
  const [activeFeed, setActiveFeed] = useState<DiscoveryFeedType>('trending');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [playingSong, setPlayingSong] = useState<Song | null>(null);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);

  const { songs, loading: songsLoading } = useSongs({
    genre: selectedGenre === 'All' ? undefined : selectedGenre,
    featured: activeFeed === 'trending',
    sortBy: activeFeed === 'top_tipped' ? 'tipped' : activeFeed === 'trending' ? 'popular' : 'recent',
    limit: 50,
  });

  const { entries: chartEntries, loading: chartsLoading } = useCharts(activeFeed);

  const handlePlaySong = (song: Song) => {
    setPlayingSong(song);
    setIsPlayerMinimized(false);
  };

  const displayedSongs = activeFeed === 'trending' || activeFeed === 'top_tipped' 
    ? songs 
    : chartEntries.map(e => e.song).filter(Boolean) as Song[];

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-900 via-pink-900 to-cyan-900 p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative z-10">
          <h2 className="text-4xl font-bold mb-2">Discover Your Next Favorite Track</h2>
          <p className="text-white/70 text-lg">Explore trending music, support independent artists, and find your sound.</p>
        </div>
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-pink-500/30 rounded-full blur-3xl" />
        <div className="absolute -left-20 -top-20 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl" />
      </div>

      {/* Feed Tabs */}
      <div className="flex flex-wrap gap-2">
        {FEEDS.map((feed) => {
          const Icon = feed.icon;
          const isActive = activeFeed === feed.id;
          return (
            <button
              key={feed.id}
              onClick={() => setActiveFeed(feed.id)}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all
                ${isActive 
                  ? `bg-white/10 ${feed.color} border border-current` 
                  : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10 hover:text-white'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {feed.label}
            </button>
          );
        })}
      </div>

      {/* Genre Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {GENRES.map((genre) => (
          <button
            key={genre}
            onClick={() => setSelectedGenre(genre)}
            className={`
              px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
              ${selectedGenre === genre
                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }
            `}
          >
            {genre}
          </button>
        ))}
      </div>

      {/* Songs Grid */}
      {songsLoading || chartsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-square bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : displayedSongs.length === 0 ? (
        <div className={`text-center py-16 ${trollCityTheme.backgrounds.card} rounded-2xl border ${trollCityTheme.borders.glass}`}>
          <Music className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">No songs found in this category yet.</p>
          <p className="text-sm text-gray-500 mt-2">Be the first to upload!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {displayedSongs.map((song) => (
            <SongCard 
              key={song.id} 
              song={song} 
              onPlay={() => handlePlaySong(song)}
              isPlaying={playingSong?.id === song.id}
            />
          ))}
        </div>
      )}

      {/* Audio Player */}
      {playingSong && (
        <AudioPlayer
          song={playingSong}
          isMinimized={isPlayerMinimized}
          onMinimizeToggle={() => setIsPlayerMinimized(!isPlayerMinimized)}
          onClose={() => setPlayingSong(null)}
          queue={displayedSongs}
          currentIndex={displayedSongs.findIndex(s => s.id === playingSong.id)}
          onChangeSong={(index) => setPlayingSong(displayedSongs[index])}
        />
      )}
    </div>
  );
}

interface SongCardProps {
  song: Song;
  onPlay: () => void;
  isPlaying: boolean;
}

function SongCard({ song, onPlay, isPlaying }: SongCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`
        relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900
        transition-all duration-300 ${isHovered ? 'scale-[1.02] shadow-xl shadow-purple-500/20' : ''}
      `}>
        {/* Cover Image */}
        {song.cover_url ? (
          <img 
            src={song.cover_url} 
            alt={song.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-16 h-16 text-gray-600" />
          </div>
        )}

        {/* Overlay */}
        <div className={`
          absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent
          transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}
        `}>
          {/* Play Button */}
          <button
            onClick={onPlay}
            className={`
              absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              w-14 h-14 rounded-full bg-pink-500 hover:bg-pink-400 flex items-center justify-center
              transition-all duration-300 shadow-lg
              ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}
            `}
          >
            <Play className={`w-6 h-6 text-white ml-1 ${isPlaying ? 'animate-pulse' : ''}`} fill="white" />
          </button>

          {/* Like Button */}
          <button className="absolute top-3 right-3 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors">
            <Heart className="w-5 h-5 text-white" />
          </button>

          {/* Duration */}
          {song.duration && (
            <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/60 text-xs text-white font-medium">
              {formatDuration(song.duration)}
            </div>
          )}
        </div>

        {/* Playing Indicator */}
        {isPlaying && (
          <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-pink-500/90">
            <div className="w-1 h-3 bg-white rounded-full animate-[bounce_1s_infinite]" />
            <div className="w-1 h-4 bg-white rounded-full animate-[bounce_1s_infinite_0.1s]" />
            <div className="w-1 h-2 bg-white rounded-full animate-[bounce_1s_infinite_0.2s]" />
          </div>
        )}
      </div>

      {/* Song Info */}
      <div className="mt-3 px-1">
        <h3 className="font-semibold text-white truncate group-hover:text-pink-400 transition-colors">
          {song.title}
        </h3>
        <p className="text-sm text-gray-400 truncate">
          {song.artist?.artist_name || 'Unknown Artist'}
        </p>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Play className="w-3 h-3" />
            {formatNumber(song.plays)}
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {song.tips_total} coins
          </span>
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}
