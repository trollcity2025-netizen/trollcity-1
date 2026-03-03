/**
 * JournalistLeaderboard Component
 * 
 * Displays top journalists by views and contributions
 */
import { JournalistStats } from '@/types/tcnn';
import { Trophy, Eye, FileText, User } from 'lucide-react';
import { trollCityTheme } from '@/styles/trollCityTheme';

interface JournalistLeaderboardProps {
  journalists: JournalistStats[];
}

export default function JournalistLeaderboard({ journalists }: JournalistLeaderboardProps) {
  if (journalists.length === 0) {
    return (
      <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-6`}>
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h3 className="font-bold text-white">Top Journalists</h3>
        </div>
        <p className="text-sm text-white/50 text-center py-4">No journalists yet</p>
      </div>
    );
  }

  return (
    <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-6`}>
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-yellow-400" />
        <h3 className="font-bold text-white">Top Journalists</h3>
      </div>

      <div className="space-y-3">
        {journalists.slice(0, 5).map((journalist, index) => (
          <div 
            key={journalist.userId}
            className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            {/* Rank */}
            <div className={`
              w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${index === 0 ? 'bg-yellow-500/20 text-yellow-400' : 
                index === 1 ? 'bg-gray-400/20 text-gray-300' :
                index === 2 ? 'bg-orange-600/20 text-orange-400' :
                'bg-white/10 text-white/50'}
            `}>
              {index + 1}
            </div>

            {/* Avatar */}
            {journalist.avatarUrl ? (
              <img 
                src={journalist.avatarUrl} 
                alt={journalist.username}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <User className="w-4 h-4 text-white/50" />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {journalist.username}
              </p>
              <div className="flex items-center gap-3 text-xs text-white/50">
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {journalist.articlesCount}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {(journalist.totalViews / 1000).toFixed(1)}k
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}