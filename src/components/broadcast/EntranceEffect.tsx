import { useEffect, useState } from "react";

interface EntranceEffectProps {
  username: string;
  role: "admin" | "lead_troll_officer" | "troll_officer";
}

export default function EntranceEffect({ username, role }: EntranceEffectProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  const roleConfig = {
    admin: {
      color: "from-red-600 to-red-800",
      emoji: "🔴",
      title: "ADMIN",
    },
    lead_troll_officer: {
      color: "from-purple-600 to-purple-800",
      emoji: "👑",
      title: "LEAD TROLL OFFICER",
    },
    troll_officer: {
      color: "from-blue-600 to-blue-800",
      emoji: "⚔️",
      title: "TROLL OFFICER",
    },
  };

  const config = roleConfig[role];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-pulse">
      <style jsx>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(50px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes glowPulse {
          0%, 100% {
            filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.5));
          }
          50% {
            filter: drop-shadow(0 0 40px rgba(255, 255, 255, 0.8));
          }
        }

        .entrance-text {
          animation: slideInUp 0.8s ease-out;
        }

        .glow {
          animation: glowPulse 1s ease-in-out infinite;
        }
      `}</style>

      <div className="entrance-text text-center">
        <div className={`text-8xl mb-4 glow`}>{config.emoji}</div>
        <div className={`text-6xl font-black text-transparent bg-gradient-to-r ${config.color} bg-clip-text mb-4`}>
          {username.toUpperCase()}
        </div>
        <div className={`text-3xl font-bold text-white tracking-widest mb-6`}>
          {config.title}
        </div>
        <div className="text-lg text-gray-300">
          has entered the stream
        </div>
      </div>
    </div>
  );
}
