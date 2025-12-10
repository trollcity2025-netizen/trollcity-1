// src/components/tromody/TromodyInstructions.jsx
import React from "react";

export default function TromodyInstructions({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center">
      <div className="bg-gray-900 rounded-2xl border border-purple-600 p-6 max-w-lg w-full shadow-xl shadow-purple-500/40">
        <h1 className="text-3xl font-bold text-purple-400 text-center mb-4">
          Welcome to TROMODY SHOW 🎭
        </h1>

        <p className="text-gray-300 text-sm mb-4 text-center">
          Two broadcasters battle head-to-head. Send gifts to vote for the funniest!
        </p>

        <ul className="text-gray-400 text-sm space-y-2 mb-6">
          <li>• The broadcaster with the MOST gift value wins.</li>
          <li>• Winner receives ALL gifts sent by both sides.</li>
          <li>• Free coins and paid coins BOTH count.</li>
          <li>• Usernames are clickable to open profiles.</li>
          <li>• Troll emoji button is the LIKE button.</li>
          <li>• Enjoy the chaos — this is Troll City!</li>
        </ul>

        <button
          onClick={onClose}
          className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold text-white"
        >
          Enter the Arena
        </button>
      </div>
    </div>
  );
}