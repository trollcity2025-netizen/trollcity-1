import React, { useEffect } from 'react';
import { Coins } from 'lucide-react';

interface SeatCostPopupProps {
  cost: number;
  onClose: () => void;
  duration?: number;
}

export default function SeatCostPopup({ 
  cost, 
  onClose, 
  duration = 10000 
}: SeatCostPopupProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [cost, onClose, duration]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-yellow-600 to-yellow-800 p-8 rounded-2xl border-2 border-yellow-400 shadow-2xl transform transition-all animate-pulse">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Coins className="w-12 h-12 text-yellow-300" />
            <h2 className="text-3xl font-bold text-white">Seat Cost</h2>
          </div>
          <div className="bg-black/20 rounded-xl p-4 mb-6">
            <span className="text-4xl font-bold text-yellow-200">
              {cost.toLocaleString()} <span className="text-2xl text-yellow-300">coins</span>
            </span>
          </div>
          <p className="text-yellow-100 mb-6">
            This seat costs {cost} coins to join.
          </p>
          <div className="text-sm text-yellow-200/80">
            This popup will close automatically in {duration/1000} seconds...
          </div>
        </div>
      </div>
    </div>
  );
}