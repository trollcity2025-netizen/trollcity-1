import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Home } from 'lucide-react';
import { trollCityTheme } from '../styles/trollCityTheme';

export default function ExitPage() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Separate effect for navigation when countdown reaches 0
  useEffect(() => {
    if (countdown <= 0) {
      navigate('/');
    }
  }, [countdown, navigate]);

  return (
    <div className={`min-h-screen w-screen ${trollCityTheme.backgrounds.app} flex items-center justify-center overflow-hidden relative`}>
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(147,51,234,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(236,72,153,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.08),transparent)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 animate-fade-in">
        {/* Logout Icon */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-purple-600/30 blur-2xl animate-pulse-slow" />
            <div className="relative w-24 h-24 bg-gradient-to-br from-purple-600 via-pink-600 to-cyan-500 rounded-full flex items-center justify-center shadow-[0_20px_60px_rgba(147,51,234,0.4)]">
              <LogOut className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-4xl md:text-6xl font-black mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
          Come Back Soon!
        </h1>
        <p className={`text-xl md:text-2xl ${trollCityTheme.text.muted} mb-6`}>
          You&apos;ve successfully logged out
        </p>
        <p className={`text-lg ${trollCityTheme.text.muted} mb-8`}>
          Thanks for visiting Troll City
        </p>

        {/* Countdown */}
        <div className="mb-8">
          <div className={`inline-flex items-center gap-3 px-6 py-3 ${trollCityTheme.backgrounds.glass} backdrop-blur-sm rounded-full ${trollCityTheme.borders.glass}`}>
            <span className={`${trollCityTheme.text.muted}`}>Redirecting in</span>
            <span className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              {countdown}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate('/')}
            className={`group px-8 py-4 ${trollCityTheme.components.buttonPrimary} rounded-2xl font-semibold text-lg text-white shadow-[0_10px_40px_rgba(147,51,234,0.35)] hover:shadow-[0_15px_50px_rgba(236,72,153,0.4)] transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2`}
          >
            <Home className="w-5 h-5" />
            Back to Landing
          </button>
          <button
            onClick={() => navigate('/auth')}
            className={`px-8 py-4 ${trollCityTheme.backgrounds.glass} backdrop-blur-xl ${trollCityTheme.borders.glass} rounded-2xl font-semibold text-lg text-slate-50 hover:border-cyan-400/40 hover:bg-slate-800/70 transition-all duration-300 hover:-translate-y-0.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]`}
          >
            Sign In Again
          </button>
        </div>
      </div>

      {/* Animated Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400/40 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float-particle ${5 + Math.random() * 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      <style>
        {`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes pulse-slow {
            0%, 100% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.05); }
          }
          
          @keyframes float-particle {
            0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0; }
            10% { opacity: 0.6; }
            90% { opacity: 0.6; }
            50% { transform: translateY(-100px) translateX(50px); }
          }
          
          .animate-fade-in {
            animation: fade-in 0.8s ease-out forwards;
          }
          
          .animate-pulse-slow {
            animation: pulse-slow 3s ease-in-out infinite;
          }
        `}
      </style>
    </div>
  );
}
