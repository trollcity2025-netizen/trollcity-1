import React from 'react'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#03030a] text-white px-6">
      <div className="max-w-xl text-center space-y-4 rounded-3xl border border-white/20 bg-gradient-to-br from-black/80 to-[#0b0420]/80 p-8 shadow-2xl">
        <h1 className="text-3xl font-bold">You are offline</h1>
        <p className="text-gray-300">
          Troll City is a desktop-first experience. The shell will load, but live data and broadcasts need an internet connection.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold shadow-lg shadow-yellow-400/30"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
