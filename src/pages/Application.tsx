import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function Application() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-6">Applications</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
            <h2 className="text-xl font-semibold mb-2">Troll Officer</h2>
            <p className="text-[#E2E2E2]/70 mb-4">Apply to moderate and keep order in Troll City.</p>
            <button onClick={() => navigate('/apply/officer')} className="px-4 py-2 bg-gradient-to-r from-[#FFC93C] to-[#FFD700] text-black rounded-lg font-semibold">Apply</button>
          </div>
          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
            <h2 className="text-xl font-semibold mb-2">Troller</h2>
            <p className="text-[#E2E2E2]/70 mb-4">Apply to become an official Troller.</p>
            <button onClick={() => navigate('/apply/troller')} className="px-4 py-2 bg-gradient-to-r from-[#FFC93C] to-[#FFD700] text-black rounded-lg font-semibold">Apply</button>
          </div>
          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
            <h2 className="text-xl font-semibold mb-2">Troll Family</h2>
            <p className="text-[#E2E2E2]/70 mb-4">Join the premium Troll Family program.</p>
            <button onClick={() => navigate('/apply/family')} className="px-4 py-2 bg-gradient-to-r from-[#FFC93C] to-[#FFD700] text-black rounded-lg font-semibold">Apply</button>
          </div>
        </div>
      </div>
    </div>
  )
}