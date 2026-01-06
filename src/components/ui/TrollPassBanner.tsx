import React from 'react'
import { motion } from 'framer-motion'
import { Crown, Sparkles, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from './button' // Assuming standard shadcn button exists

export default function TrollPassBanner() {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-troll-neon-gold/30 group">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#2a1b00] via-[#422006] to-[#2a1b00] opacity-90 z-0"></div>
      
      {/* Moving Gradient Sheen */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/10 to-transparent z-0"
        animate={{ 
          x: ['-100%', '100%'] 
        }}
        transition={{ 
          repeat: Infinity, 
          duration: 3, 
          ease: "linear" 
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-4 md:px-6 md:py-3 gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Crown className="w-6 h-6 text-white drop-shadow-md" />
            </div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute -top-1 -right-1"
            >
              <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
            </motion.div>
          </div>
          
          <div className="text-center md:text-left">
            <h3 className="text-lg font-black italic tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400 drop-shadow-sm">
              TROLL PASS PREMIUM
            </h3>
            <p className="text-xs text-yellow-100/80 font-medium">
              Unlock exclusive badges, 2x XP, and gold username!
            </p>
          </div>
        </div>

        <Link to="/store">
          <Button 
            className="rounded-full px-6 py-2 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 text-white font-bold border-none shadow-[0_0_15px_rgba(234,179,8,0.4)] hover:shadow-[0_0_25px_rgba(234,179,8,0.6)] hover:scale-105 transition-all duration-300 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 fill-white" />
            Get TrollPass
          </Button>
        </Link>
      </div>
    </div>
  )
}
