// src/components/levels/LevelUpModal.jsx
import React from "react";
import LevelBadge from "./LevelBadge";

export default function LevelUpModal({ type, oldLevel, newLevel, onClose }) {
  if (!newLevel || newLevel <= (oldLevel || 0)) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-purple-600 rounded-2xl p-6 max-w-sm w-full text-center shadow-xl shadow-purple-500/40 animate-bounce">
        <h2 className="text-2xl font-bold text-purple-300 mb-2">
          Level Up!
        </h2>
        <p className="text-gray-300 text-sm mb-4">
          Your {type === "buyer" ? "Supporter" : "Broadcast"} level just increased!
        </p>

        <div className="flex flex-col items-center gap-3 mb-4">
          {oldLevel ? (
            <div className="text-xs text-gray-400">Previous: Lv.{oldLevel}</div>
          ) : null}
          <LevelBadge type={type} level={newLevel} />
        </div>

        <button
          className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md text-white text-sm font-semibold"
          onClick={onClose}
        >
          Continue
        </button>
      </div>
    </div>
  );
}