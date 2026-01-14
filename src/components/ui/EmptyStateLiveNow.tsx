import React from 'react'
import { Radio, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from './button'

export default function EmptyStateLiveNow() {
  return (
    <div className="w-full bg-[#13131F] border border-[#2C2C2C] rounded-2xl p-8 text-center relative overflow-hidden group hover:border-troll-neon-pink/30 transition-all duration-500">
      {/* Subtle Glow Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1/2 bg-troll-neon-pink/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-troll-dark-card border border-[#333] flex items-center justify-center shadow-lg">
          <Radio className="w-8 h-8 text-gray-500 group-hover:text-troll-neon-pink transition-colors duration-300" />
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-xl font-bold text-white">
            No one is live right now—start the vibe!
          </h3>
          <p className="text-gray-400 text-sm">
            The stage is empty. Be the first to go live or explore our amazing community of creators.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
          <Link to="/following">
            <Button
              variant="outline"
              disabled={false}
              onClick={() => {}}
              className="rounded-full px-6 py-2 border-troll-neon-blue/30 text-troll-neon-blue hover:bg-troll-neon-blue/10 hover:text-white hover:border-troll-neon-blue/60 font-bold transition-all duration-300 flex items-center gap-2"
            >
              <Compass className="w-4 h-4" />
              Explore Creators
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
