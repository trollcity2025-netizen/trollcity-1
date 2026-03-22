/**
 * Homepage Background Showcase
 * 
 * This page showcases different neon background designs for the homepage.
 * Access: /dev/homepage-bg-showcase
 */

import React, { useState } from 'react'
import { Check, X, Eye, Sparkles, Zap, Flame, Wave, Gradient } from 'lucide-react'

interface BackgroundOption {
  id: string
  name: string
  description: string
  gradient: string
  glowEffect?: string
}

const backgroundOptions: BackgroundOption[] = [
  {
    id: 'neon-purple-pink',
    name: 'Neon Purple Pink',
    description: 'Classic cyberpunk vibe with purple to pink gradient',
    gradient: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    glowEffect: '0 0 40px rgba(168, 85, 247, 0.3)'
  },
  {
    id: 'cyber-blue',
    name: 'Cyber Blue',
    description: 'Cool blue neon with cyan highlights',
    gradient: 'linear-gradient(135deg, #0f0c29 0%, #1a1a4a 50%, #1e3a5f 100%)',
    glowEffect: '0 0 40px rgba(59, 130, 246, 0.3)'
  },
  {
    id: 'sunset-neon',
    name: 'Sunset Neon',
    description: 'Warm orange to purple sunset gradient',
    gradient: 'linear-gradient(135deg, #1a0a1a 0%, #3d1a4a 50%, #4a2040 100%)',
    glowEffect: '0 0 40px rgba(249, 115, 22, 0.3)'
  },
  {
    id: 'matrix-green',
    name: 'Matrix Green',
    description: 'Classic matrix green with dark background',
    gradient: 'linear-gradient(135deg, #0a1a0a 0%, #1a3d1a 50%, #0d260d 100%)',
    glowEffect: '0 0 40px rgba(34, 197, 94, 0.3)'
  },
  {
    id: 'fire-ice',
    name: 'Fire & Ice',
    description: 'Red/orange to blue/cyan contrast',
    gradient: 'linear-gradient(135deg, #1a0a0a 0%, #3d1a2a 50%, #1a2a3d 100%)',
    glowEffect: '0 0 40px rgba(239, 68, 68, 0.2), 0 0 40px rgba(59, 130, 246, 0.2)'
  },
  {
    id: 'galaxy-purple',
    name: 'Galaxy Purple',
    description: 'Deep space purple with star-like highlights',
    gradient: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3d 50%, #2d1b4e 100%)',
    glowEffect: '0 0 60px rgba(139, 92, 246, 0.4)'
  },
  {
    id: 'ocean-teal',
    name: 'Ocean Teal',
    description: 'Deep ocean teal with cyan accents',
    gradient: 'linear-gradient(135deg, #0a1a1a 0%, #1a3d3d 50%, #1a2d3d 100%)',
    glowEffect: '0 0 40px rgba(20, 184, 166, 0.3)'
  },
  {
    id: 'rainbow-neon',
    name: 'Rainbow Neon',
    description: 'Vibrant rainbow gradient with subtle neon glow',
    gradient: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #1a2a4e 100%)',
    glowEffect: '0 0 40px rgba(236, 72, 153, 0.2), 0 0 40px rgba(59, 130, 246, 0.2), 0 0 40px rgba(16, 185, 129, 0.2)'
  },
]

export default function HomepageBackgroundShowcase() {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
            <Sparkles className="w-8 h-8 text-yellow-400" />
            Homepage Background Showcase
          </h1>
          <p className="text-gray-400 text-lg">
            Preview different neon background options for the homepage
          </p>
        </div>

        {/* Grid of Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {backgroundOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelected(option.id)}
              className={`relative group rounded-2xl overflow-hidden transition-all duration-300 ${
                selected === option.id 
                  ? 'ring-4 ring-purple-500 scale-105' 
                  : 'hover:scale-102 hover:ring-2 hover:ring-white/30'
              }`}
              style={{
                background: option.gradient,
                boxShadow: option.glowEffect,
                minHeight: '200px'
              }}
            >
              {/* Preview Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                <div className="text-center">
                  <h3 className="text-lg font-bold mb-1 text-white">{option.name}</h3>
                  <p className="text-sm text-gray-300">{option.description}</p>
                </div>
              </div>

              {/* Selected Indicator */}
              {selected === option.id && (
                <div className="absolute top-3 right-3 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-white" />
                </div>
              )}

              {/* Hover Effect */}
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
            </button>
          ))}
        </div>

        {/* Preview Section */}
        {selected && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Eye className="w-6 h-6" />
              Full Preview
            </h2>
            
            {/* Full Homepage Preview */}
            <div 
              className="rounded-3xl overflow-hidden relative"
              style={{
                background: backgroundOptions.find(o => o.id === selected)?.gradient,
                boxShadow: backgroundOptions.find(o => o.id === selected)?.glowEffect,
                minHeight: '500px'
              }}
            >
              {/* Mock Homepage Content */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
              
              <div className="relative p-8">
                {/* Mock Header */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-xl" />
                    <span className="text-xl font-bold">TrollCity</span>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-white/10 rounded-full" />
                    <div className="w-8 h-8 bg-white/10 rounded-full" />
                  </div>
                </div>

                {/* Mock Feed */}
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="bg-black/30 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full" />
                      <div>
                        <p className="font-bold">Broadcaster123</p>
                        <p className="text-xs text-gray-400">Live now</p>
                      </div>
                    </div>
                    <div className="h-40 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl" />
                  </div>

                  <div className="bg-black/30 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" />
                      <div>
                        <p className="font-bold">StreamerPro</p>
                        <p className="text-xs text-gray-400">2 hours ago</p>
                      </div>
                    </div>
                    <p className="text-gray-300">Just finished an amazing stream! Thanks everyone for watching 🎉</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Info */}
            <div className="mt-6 p-4 bg-gray-900 rounded-xl">
              <p className="text-lg">
                <span className="font-bold text-purple-400">Selected:</span>{' '}
                {backgroundOptions.find(o => o.id === selected)?.name}
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-12 p-6 bg-gray-900/50 rounded-2xl">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Quick Legend
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gradient-to-r from-pink-500 to-purple-500" />
              <span>Purple Pink</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400" />
              <span>Cyber Blue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gradient-to-r from-orange-500 to-pink-500" />
              <span>Sunset</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gradient-to-r from-green-400 to-emerald-400" />
              <span>Matrix</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
