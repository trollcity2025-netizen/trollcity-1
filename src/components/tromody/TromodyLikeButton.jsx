// src/components/tromody/TromodyLikeButton.jsx
import React, { useState } from "react";

export default function TromodyLikeButton() {
  const [likes, setLikes] = useState(0);

  return (
    <button
      onClick={() => setLikes((p) => p + 1)}
      className="bg-green-600 hover:bg-green-700 flex items-center justify-center p-3 rounded-lg text-white font-bold"
    >
      🧌 {likes}
    </button>
  );
}