// src/components/tromody/TromodyGiftBox.jsx
import React, { useState } from "react";

export default function TromodyGiftBox({ onGift, leftUser, rightUser }) {
  const [selectedSide, setSelectedSide] = useState(null);
  const gifts = [
    { id: 1, name: "Troll Cookie", value: 10 },
    { id: 2, name: "Chaos Bomb", value: 25 },
    { id: 3, name: "Golden Troll", value: 50 },
    { id: 4, name: "Troll Crown", value: 100 },
  ];

  const handleGiftClick = (gift, side) => {
    if (!selectedSide) {
      setSelectedSide(side);
    } else {
      onGift(side, gift.value);
      setSelectedSide(null);
    }
  };

  return (
    <div className="bg-black border border-gray-700 rounded-lg p-3 h-48 overflow-y-auto">
      <h3 className="text-purple-300 font-semibold text-sm mb-2">Send Gift</h3>
      
      {selectedSide && (
        <div className="text-xs text-yellow-300 mb-2 p-1 bg-yellow-900/30 rounded">
          Select a gift for {selectedSide === 'left' ? (leftUser?.username || 'Left Player') : (rightUser?.username || 'Right Player')}
        </div>
      )}

      {/* Side Selection */}
      <div className="grid grid-cols-2 gap-1 mb-2">
        <button
          onClick={() => setSelectedSide(selectedSide === 'left' ? null : 'left')}
          disabled={!leftUser?.id}
          className={`text-xs p-1 rounded ${
            selectedSide === 'left'
              ? 'bg-green-600 text-white'
              : leftUser?.id
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          {leftUser?.username || 'Left'} {leftUser?.id ? '' : '(Empty)'}
        </button>
        <button
          onClick={() => setSelectedSide(selectedSide === 'right' ? null : 'right')}
          disabled={!rightUser?.id}
          className={`text-xs p-1 rounded ${
            selectedSide === 'right'
              ? 'bg-green-600 text-white'
              : rightUser?.id
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          {rightUser?.username || 'Right'} {rightUser?.id ? '' : '(Empty)'}
        </button>
      </div>

      {/* Gift Buttons */}
      <div className="space-y-1">
        {gifts.map((g) => (
          <button
            key={g.id}
            onClick={() => {
              const side = selectedSide || (Math.random() < 0.5 ? "left" : "right");
              handleGiftClick(g, side);
            }}
            disabled={!selectedSide && (!leftUser?.id || !rightUser?.id)}
            className={`w-full text-xs p-2 rounded-md transition-colors ${
              selectedSide
                ? 'bg-purple-700 hover:bg-purple-800 text-white'
                : (leftUser?.id && rightUser?.id)
                  ? 'bg-gray-600 hover:bg-gray-500 text-white'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            {g.name} (+{g.value})
            {selectedSide && (
              <span className="block text-xs text-purple-200">
                → {selectedSide === 'left' ? (leftUser?.username || 'Left') : (rightUser?.username || 'Right')}
              </span>
            )}
          </button>
        ))}
      </div>
      
      {selectedSide && (
        <button
          onClick={() => setSelectedSide(null)}
          className="w-full mt-2 text-xs text-gray-400 hover:text-gray-300"
        >
          Cancel Selection
        </button>
      )}
    </div>
  );
}