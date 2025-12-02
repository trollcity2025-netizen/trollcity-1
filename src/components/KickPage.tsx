import React from 'react'
import { X, UserX, AlertTriangle } from 'lucide-react'

interface KickPageProps {
  onClose: () => void
  kickCount?: number
}

export default function KickPage({ onClose, kickCount = 1 }: KickPageProps) {
  const isLastWarning = kickCount >= 2

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center p-6 z-50">
      <div className={`border-2 rounded-xl p-8 w-full max-w-2xl shadow-[0_0_60px_rgba(255,165,0,0.8)] relative ${
        isLastWarning ? 'bg-[#2A1A00] border-orange-600' : 'bg-[#1A1A00] border-yellow-600'
      }`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <UserX className={`w-24 h-24 ${isLastWarning ? 'text-orange-500' : 'text-yellow-500'} animate-pulse`} />
              <div className={`absolute inset-0 ${isLastWarning ? 'bg-orange-500/20' : 'bg-yellow-500/20'} rounded-full animate-ping`} />
            </div>
          </div>
          <h1 className={`text-4xl font-bold mb-4 ${isLastWarning ? 'text-orange-400' : 'text-yellow-400'}`}>
            You've Been Kicked
          </h1>
          <div className={`border rounded-lg p-4 mb-6 ${
            isLastWarning 
              ? 'bg-orange-900/30 border-orange-500/50' 
              : 'bg-yellow-900/30 border-yellow-500/50'
          }`}>
            <AlertTriangle className={`w-8 h-8 mx-auto mb-2 ${isLastWarning ? 'text-orange-400' : 'text-yellow-400'}`} />
            <p className={`text-lg font-semibold mb-2 ${isLastWarning ? 'text-orange-300' : 'text-yellow-300'}`}>
              {isLastWarning ? '⚠️ Final Warning!' : 'You have been removed from the stream'}
            </p>
            <p className="text-gray-300 text-sm">
              {isLastWarning 
                ? 'This is your final warning. One more kick will result in a permanent ban.'
                : 'You can pay to re-enter, but be careful - after 3 kicks, you\'ll be permanently banned.'}
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className={`border rounded-lg p-4 ${
            isLastWarning 
              ? 'bg-[#0A0000] border-orange-500/30' 
              : 'bg-[#0A0A00] border-yellow-500/30'
          }`}>
            <h3 className={`font-semibold mb-2 ${isLastWarning ? 'text-orange-400' : 'text-yellow-400'}`}>
              Kick Details
            </h3>
            <div className="text-sm text-gray-300 space-y-1">
              <p><strong>Kick Count:</strong> {kickCount}/3</p>
              <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
              <p><strong>Reason:</strong> Violation of community guidelines</p>
            </div>
          </div>

          {isLastWarning && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
              <h3 className="text-red-400 font-semibold mb-2">⚠️ Critical Warning</h3>
              <p className="text-sm text-gray-300">
                You have been kicked <strong className="text-red-400">{kickCount} times</strong>. 
                One more kick will result in a <strong className="text-red-400">permanent ban</strong>.
              </p>
            </div>
          )}

          <div className={`border rounded-lg p-4 ${
            isLastWarning 
              ? 'bg-[#0A0000] border-orange-500/30' 
              : 'bg-[#0A0A00] border-yellow-500/30'
          }`}>
            <h3 className={`font-semibold mb-2 ${isLastWarning ? 'text-orange-400' : 'text-yellow-400'}`}>
              Re-enter Troll City
            </h3>
            <p className="text-sm text-gray-300 mb-3">
              Pay <strong className="text-yellow-400">250 paid coins</strong> to re-enter the app.
            </p>
            <button className={`w-full py-3 rounded-lg font-semibold transition-colors ${
              isLastWarning 
                ? 'bg-orange-600 hover:bg-orange-500' 
                : 'bg-yellow-600 hover:bg-yellow-500'
            }`}>
              Pay 250 Coins to Re-enter
            </button>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

