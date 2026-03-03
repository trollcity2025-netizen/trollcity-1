import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Music, Mic, Disc, User, TrendingUp, Upload, 
  ChevronRight, Headphones, Sparkles 
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { useArtistProfile } from '@/lib/hooks/useMedia';
import { trollCityTheme } from '@/styles/trollCityTheme';
import DiscoverMusic from './DiscoverMusic';
import MyStudio from './MyStudio';
import RecordLabels from './RecordLabels';
import ArtistProfilePage from './ArtistProfilePage';
import TrendingCharts from './TrendingCharts';
import AlbumsPage from './AlbumsPage';
import UploadsPage from './UploadsPage';

type MediaTab = 'discover' | 'studio' | 'labels' | 'profile' | 'charts' | 'albums' | 'uploads';

const TABS = [
  { id: 'discover' as MediaTab, label: 'Discover Music', icon: Headphones, color: 'text-cyan-400' },
  { id: 'studio' as MediaTab, label: 'My Studio', icon: Mic, color: 'text-purple-400' },
  { id: 'labels' as MediaTab, label: 'Record Labels', icon: Disc, color: 'text-pink-400' },
  { id: 'profile' as MediaTab, label: 'My Profile', icon: User, color: 'text-emerald-400' },
  { id: 'charts' as MediaTab, label: 'Trending Charts', icon: TrendingUp, color: 'text-yellow-400' },
  { id: 'albums' as MediaTab, label: 'Albums', icon: Music, color: 'text-orange-400' },
  { id: 'uploads' as MediaTab, label: 'Uploads', icon: Upload, color: 'text-blue-400' },
];

export default function MediaCityPage() {
  const [activeTab, setActiveTab] = useState<MediaTab>('discover');
  const { user } = useAuthStore();
  const { profile: artistProfile, loading: profileLoading } = useArtistProfile(user?.id);
  const navigate = useNavigate();

  const renderTabContent = () => {
    switch (activeTab) {
      case 'discover':
        return <DiscoverMusic />;
      case 'studio':
        return <MyStudio />;
      case 'labels':
        return <RecordLabels />;
      case 'profile':
        return <ArtistProfilePage userId={user?.id} />;
      case 'charts':
        return <TrendingCharts />;
      case 'albums':
        return <AlbumsPage />;
      case 'uploads':
        return <UploadsPage />;
      default:
        return <DiscoverMusic />;
    }
  };

  return (
    <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white`}>
      {/* Header */}
      <div className={`${trollCityTheme.backgrounds.card} border-b ${trollCityTheme.borders.glass}`}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Music className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400">
                  Media City
                </h1>
                <p className={`text-sm ${trollCityTheme.text.muted}`}>
                  Create, discover, and monetize your music
                </p>
              </div>
            </div>

            {artistProfile && (
              <div className="flex items-center gap-3">
                <div className={`px-4 py-2 rounded-xl ${trollCityTheme.backgrounds.glass} border ${trollCityTheme.borders.glass}`}>
                  <p className={`text-xs ${trollCityTheme.text.muted} uppercase tracking-wider`}>Artist</p>
                  <p className="font-semibold text-white flex items-center gap-2">
                    {artistProfile.verified && <Sparkles className="w-4 h-4 text-yellow-400" />}
                    {artistProfile.artist_name}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mt-6 overflow-x-auto pb-2 scrollbar-hide">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium whitespace-nowrap
                    transition-all duration-200 border
                    ${isActive 
                      ? `${trollCityTheme.backgrounds.glass} ${tab.color} border-current shadow-lg` 
                      : `${trollCityTheme.text.muted} border-transparent hover:bg-white/5 hover:text-white`
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{tab.label}</span>
                  {isActive && <ChevronRight className="w-4 h-4" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {renderTabContent()}
      </div>
    </div>
  );
}
