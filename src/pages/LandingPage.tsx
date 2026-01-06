import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Video, Gift, Users, Zap, Volume2, VolumeX, ArrowRight, Play } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { motion, AnimatePresence } from 'framer-motion';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [showIntro, setShowIntro] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleEnterTrollCity = () => {
    if (user) {
      navigate('/live');
    } else {
      navigate('/auth');
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  const skipIntro = () => {
    setShowIntro(false);
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      <AnimatePresence>
        {showIntro && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black"
          >
            {/* Video Background */}
            <video
              ref={videoRef}
              autoPlay
              muted={isMuted}
              playsInline
              onEnded={skipIntro}
              className="absolute inset-0 w-full h-full object-cover opacity-80"
            >
              <source src="/intro.mp4" type="video/mp4" />
              {/* Fallback for when video is missing - using a nice abstract background or similar */}
            </video>
            
            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50" />

            {/* Content Overlay */}
            <div className="relative z-10 flex flex-col items-center justify-end h-full pb-20 w-full max-w-7xl mx-auto px-4">
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-center space-y-8"
              >
                <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-white drop-shadow-[0_0_25px_rgba(168,85,247,0.5)]">
                  WELCOME TO <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">TROLL CITY</span>
                </h1>
                
                <div className="flex flex-col sm:flex-row items-center gap-6 pt-8">
                  <button
                    onClick={skipIntro}
                    className="group relative px-8 py-4 bg-white text-black rounded-full font-black text-xl hover:scale-105 transition-transform flex items-center gap-3 overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      ENTER CITY <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-500 opacity-0 group-hover:opacity-20 transition-opacity" />
                  </button>

                  <button
                    onClick={toggleMute}
                    className="p-4 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-colors border border-white/20"
                  >
                    {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                  </button>
                </div>
              </motion.div>
            </div>

            {/* Skip Text */}
            <button 
              onClick={skipIntro}
              className="absolute top-8 right-8 text-white/50 hover:text-white text-sm font-medium tracking-widest uppercase transition-colors"
            >
              Skip Intro
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black pointer-events-none" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-block animate-bounce-slow">
            <Crown className="w-20 h-20 text-yellow-400 mx-auto drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 drop-shadow-sm">
            TROLL CITY
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            The ultimate streaming playground where chaos meets reward. 
            Watch streams, earn coins, and unleash mayhem.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <button
              onClick={handleEnterTrollCity}
              className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-bold text-xl transition-all hover:scale-105 shadow-[0_0_20px_rgba(147,51,234,0.5)] flex items-center gap-2 group"
            >
              <Zap className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              Enter City
            </button>
            
            <button
              onClick={() => navigate('/about')}
              className="px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full font-bold text-xl transition-all hover:scale-105 border border-zinc-700"
            >
              Learn More
            </button>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-32">
          {[
            {
              icon: Video,
              title: "Live Streaming",
              desc: "Watch your favorite chaos agents live",
              color: "text-blue-400"
            },
            {
              icon: Gift,
              title: "Earn Rewards",
              desc: "Get paid just for watching and engaging",
              color: "text-green-400"
            },
            {
              icon: Users,
              title: "Community",
              desc: "Join factions and dominate the city",
              color: "text-pink-400"
            }
          ].map((feature, i) => (
            <div 
              key={i}
              className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 p-8 rounded-2xl hover:border-purple-500/50 transition-colors group"
            >
              <feature.icon className={`w-12 h-12 ${feature.color} mb-4 group-hover:scale-110 transition-transform`} />
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Force rebuild trigger
