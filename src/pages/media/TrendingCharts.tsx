import React, { useState } from 'react';
import { TrendingUp, Flame, Sparkles, Music, ChevronUp, ChevronDown, Minus } from 'lucide-react';
import { useCharts } from '@/lib/hooks/useMedia';
import { trollCityTheme } from '@/styles/trollCityTheme';
import type { ChartEntry } from '@/types/media';

const CHART_TYPES = [
  { id: 'trending', label: 'Trending', icon: Flame, color: 'text-orange-400', desc: 'Most played this week' },
  { id: 'top_tipped', label: 'Top Tipped', icon: TrendingUp, color: 'text-yellow-400', desc: 'Highest earning tracks' },
  { id: 'new_releases', label: 'New Releases', icon: Sparkles, color: 'text-cyan-400', desc: 'Fresh drops this week' },
] as const;

export default function TrendingCharts() {
  const [activeChart, setActiveChart] = useState<typeof CHART_TYPES[number]['id']>('trending');
  const { entries, loading } = useCharts(activeChart);

  const currentChart = CHART_TYPES.find(c => c.id === activeChart);
  const Icon = currentChart?.icon || Flame;

  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-yellow-400 to-cyan-400 mb-2">
          Media City Charts
        </h2>
        <p className="text-gray-400">Discover what&apos;s hot in the city</p>
      </div>

      <div className="flex justify-center gap-4">
        {CHART_TYPES.map((chart) => {
          const ChartIcon = chart.icon;
          const isActive = activeChart === chart.id;
          return (
            <button
              key={chart.id}
              onClick={() => setActiveChart(chart.id)}
              className={`
                flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all min-w-[140px]
                ${isActive 
                  ? `${chart.color} border-current bg-white/5` 
                  : 'text-gray-400 border-transparent hover:border-white/10 hover:bg-white/5'
                }
              `}
            >
              <ChartIcon className="w-6 h-6" />
              <span className="font-semibold">{chart.label}</span>
              <span className="text-xs opacity-70">{chart.desc}</span>
            </button>
          );
        })}
      </div>

      <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl overflow-hidden`}>
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <Icon className={`w-6 h-6 ${currentChart?.color}`} />
          <h3 className="text-xl font-bold">{currentChart?.label} Chart</h3>
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <Music className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400">No chart data yet. Check back soon!</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {entries.map((entry, index) => (
              <ChartRow key={entry.id} entry={entry} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChartRow({ entry, index }: { entry: ChartEntry; index: number }) {
  const positionChange = entry.previous_position 
    ? entry.previous_position - entry.position 
    : 0;

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors group">
      <div className="w-12 text-center">
        <span className={`
          text-2xl font-bold
          ${index === 0 ? 'text-yellow-400' : 
            index === 1 ? 'text-gray-300' : 
            index === 2 ? 'text-orange-400' : 'text-gray-500'}
        `}>
          {entry.position}
        </span>
        {positionChange > 0 && (
          <div className="flex items-center justify-center text-emerald-400 text-xs">
            <ChevronUp className="w-3 h-3" />
            {positionChange}
          </div>
        )}
        {positionChange < 0 && (
          <div className="flex items-center justify-center text-red-400 text-xs">
            <ChevronDown className="w-3 h-3" />
            {Math.abs(positionChange)}
          </div>
        )}
        {positionChange === 0 && entry.previous_position && (
          <div className="flex items-center justify-center text-gray-500 text-xs">
            <Minus className="w-3 h-3" />
          </div>
        )}
      </div>

      <div className="w-14 h-14 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
        {entry.song?.cover_url ? (
          <img src={entry.song.cover_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <Music className="w-6 h-6 text-gray-600" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white truncate group-hover:text-pink-400 transition-colors">
          {entry.song?.title}
        </p>
        <p className="text-sm text-gray-400 truncate">
          {entry.artist?.artist_name}
        </p>
      </div>

      <div className="hidden md:flex items-center gap-6 text-sm text-gray-500">
        <div className="flex items-center gap-1">
          <TrendingUp className="w-4 h-4" />
          {entry.plays_count.toLocaleString()}
        </div>
        <div className="flex items-center gap-1">
          <Sparkles className="w-4 h-4 text-yellow-500" />
          {entry.tips_count.toLocaleString()}
        </div>
      </div>

      <button className="w-10 h-10 rounded-full bg-pink-500 hover:bg-pink-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Music className="w-5 h-5 text-white" />
      </button>
    </div>
  );
}
