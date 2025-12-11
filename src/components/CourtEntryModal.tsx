import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Scale, Gavel, X } from 'lucide-react'

interface CourtEntryModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CourtEntryModal({ isOpen, onClose }: CourtEntryModalProps) {
  const navigate = useNavigate()

  if (!isOpen) return null

  const handleJoinCourt = () => {
    onClose()
    navigate('/court-room')
  }

  const handleWatchCourt = () => {
    onClose()
    navigate('/troll-court')
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-xl border border-purple-500/20 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <Scale className="w-8 h-8 text-purple-400" />
            <div>
              <h2 className="text-2xl font-bold text-white">Enter Troll Court</h2>
              <p className="text-gray-400">Choose how you want to participate</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Court Rules */}
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Gavel className="w-5 h-5 text-purple-400" />
              Court Rules & Guidelines
            </h3>
            <div className="space-y-2 text-sm text-gray-300">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>All rulings must be issued by authorized Troll Court officials</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>Evidence must be presented before any judgment is made</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>Appeals may be filed within 24 hours of ruling</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>All court sessions are recorded for transparency</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>Only authorized personnel may broadcast audio/video</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={handleJoinCourt}
              className="bg-purple-600 hover:bg-purple-700 text-white py-4 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Scale className="w-5 h-5" />
              Join Court Session
            </button>
            <button
              onClick={handleWatchCourt}
              className="bg-zinc-700 hover:bg-zinc-600 text-white py-4 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Gavel className="w-5 h-5" />
              Watch Court Proceedings
            </button>
          </div>

          {/* Info */}
          <div className="text-center text-sm text-gray-400">
            <p>Join Court: Participate actively in live sessions (authorized personnel only)</p>
            <p>Watch Court: View court status, rules, and case history</p>
          </div>
        </div>
      </div>
    </div>
  )
}