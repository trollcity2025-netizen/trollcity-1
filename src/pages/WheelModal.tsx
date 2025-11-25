import React from 'react'

export default function WheelModal() {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center text-white z-[200]">
      <div className="bg-gray-900 p-8 rounded-xl text-center animate-spinIn">
        <h2 className="text-3xl mb-4">🎡 Troll Wheel Activated!</h2>
        <p className="text-sm">Spinning...</p>
      </div>
    </div>
  )
}
