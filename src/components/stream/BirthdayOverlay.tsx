import React from 'react'
import { PartyPopper, Cake, Sparkles } from 'lucide-react'

interface BirthdayOverlayProps {
  username: string
}

export default function BirthdayOverlay({ username }: BirthdayOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Animated Birthday Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-yellow-500/20 animate-pulse" />
      
      {/* Floating Confetti Effect */}
      <div className="absolute inset-0">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              backgroundColor: ['#FF6B9D', '#C44569', '#F8B500', '#FFC93C', '#FF6B6B'][i % 5],
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>
      
      {/* Birthday Banner Top */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-yellow-500 rounded-full px-6 py-3 shadow-lg animate-pulse flex items-center gap-3">
          <PartyPopper className="w-6 h-6 text-white animate-bounce" />
          <span className="text-white font-bold text-lg">
            🎉 {username}'s Birthday! 🎂
          </span>
          <Cake className="w-6 h-6 text-white animate-bounce" style={{ animationDelay: '0.5s' }} />
        </div>
      </div>
      
      {/* Sparkle Effects */}
      <div className="absolute inset-0">
        {Array.from({ length: 10 }).map((_, i) => (
          <Sparkles
            key={i}
            className="absolute text-yellow-400 animate-ping"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${1 + Math.random()}s`,
            }}
            size={20}
          />
        ))}
      </div>
      
      {/* Corner Decorations */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-pink-500/30 to-transparent rounded-br-full" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-500/30 to-transparent rounded-bl-full" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-yellow-500/30 to-transparent rounded-tr-full" />
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-pink-500/30 to-transparent rounded-tl-full" />
    </div>
  )
}

