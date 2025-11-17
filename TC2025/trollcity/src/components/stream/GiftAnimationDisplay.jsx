import React, { useState, useEffect } from "react";
import { getGiftById } from "@/lib/gifts";

const GiftAnimation = ({ gift, senderName, duration = 4000 }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  if (!isVisible) return null;

  const giftData = getGiftById(gift.id) || gift;

  return (
    <div
      className="fixed top-20 right-6 z-40 animate-bounce"
      style={{
        animation: `slideInRight 0.5s ease-out, slideOutRight 0.5s ease-out ${duration - 500}ms`,
        animationFillMode: "forwards",
      }}
    >
      <style>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(200px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes slideOutRight {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(200px);
          }
        }
      `}</style>

      <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-6 shadow-2xl border-2 border-yellow-400 max-w-xs">
        {/* Gift Display */}
        <div className="text-center space-y-3">
          <div className="text-8xl animate-bounce" style={{ animationDelay: "0s" }}>
            {giftData.emoji}
          </div>

          <div className="space-y-2">
            <p className="text-white font-bold text-lg">
              {senderName || "A Troller"} sent a gift!
            </p>
            <p className="text-2xl font-bold text-yellow-300">{giftData.name}</p>
            <p className="text-sm text-gray-100">Worth {giftData.value} coins! 🪙</p>
          </div>

          {/* Sparkle Effect */}
          <div className="flex justify-center gap-2 text-2xl">
            <span className="animate-pulse">✨</span>
            <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>
              ✨
            </span>
            <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>
              ✨
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GiftAnimation;
