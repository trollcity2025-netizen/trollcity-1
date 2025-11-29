import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function StreamEnded() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
      <h1 className="text-4xl font-bold mb-4">Your stream has ended</h1>
      <p className="text-gray-400 mb-6">Thanks for going live on TrollCity</p>
      <button
        onClick={() => navigate('/')}
        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-full transition-colors flex items-center gap-2"
      >
        <Home className="w-5 h-5" />
        Return to Home
      </button>
    </div>
  )
}