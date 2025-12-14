import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../lib/store'
import { LiveKitRoomWrapper } from '../components/LiveKitVideoGrid'
import { useLiveKitSession } from '../hooks/useLiveKitSession'
import { toast } from 'sonner'
import { Shield } from 'lucide-react'

const OfficerLoungeStream = () => {
  const { user, profile } = useAuthStore()
  const {
    joinAndPublish,
    isConnected,
    isConnecting,
    toggleCamera,
    toggleMicrophone,
    localParticipant,
    error,
  } = useLiveKitSession({
    roomName: 'officer-stream',
    user: user ? { ...user, role: 'officer' } : null,
    autoPublish: true,
    maxParticipants: 6,
  })
  const [accessDenied, setAccessDenied] = useState(false)

  // Officer access validation and single join
  useEffect(() => {
    if (!profile || !user) return

    const allowedRoles = ['admin', 'lead_troll_officer', 'troll_officer']
    const userRole = profile.role || profile.troll_role

    if (!allowedRoles.includes(userRole)) {
      setAccessDenied(true)
      toast.error('Access Denied – Officers Only')
      return
    }

    joinAndPublish()
  }, [profile, user, joinAndPublish])

  // Access denied screen
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-900 to-black text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <Shield className="w-20 h-20 mx-auto mb-6 text-red-400" />
          <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
          <p className="text-xl text-red-200 mb-2">Officers Only</p>
          <p className="text-gray-300">
            This area is restricted to Troll Officers and Lead Troll Officers only.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Shield className="w-10 h-10 text-blue-400" />
            OFFICER STREAM
          </h1>
          <p className="text-gray-300">Exclusive officer streaming with unified LiveKit</p>
          {profile && (
            <div className="text-blue-300 text-sm mt-2">
              <p>Officer: {profile.username}</p>
              <p>Role: {profile.role || profile.troll_role}</p>
            </div>
          )}
        </div>

        {/* Video Grid */}
        <LiveKitRoomWrapper
          roomName="officer-stream"
          user={user}
          className="w-full h-[70vh] bg-black rounded-xl overflow-hidden"
          showLocalVideo={true}
          maxParticipants={6}
          autoPublish={false}
          role="officer"
          autoConnect={false}
        />

        {/* Controls */}
        {isConnected && (
          <div className="bg-[#111320] border border-blue-700/50 rounded-xl p-6">
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={toggleCamera}
                className={`p-3 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                  localParticipant?.isCameraEnabled
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                dY"1 {localParticipant?.isCameraEnabled ? 'Camera On' : 'Camera Off'}
              </button>

              <button
                onClick={toggleMicrophone}
                className={`p-3 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                  localParticipant?.isMicrophoneEnabled
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                dYZ {localParticipant?.isMicrophoneEnabled ? 'Mic On' : 'Mic Off'}
              </button>
            </div>

            <div className="text-center mt-4">
              <p className="text-green-400 font-semibold">
                ƒo. Connected to Officer LiveKit room. You are live!
              </p>
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-[#111320] border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Officer Stream Guidelines:
          </h3>
          <ul className="space-y-2 text-gray-300">
            <li>ƒ?› This area is exclusively for authorized officers (Admin, Lead Troll Officers, Troll Officers)</li>
            <li>ƒ?› Camera and microphone connect automatically when you enter</li>
            <li>ƒ?› Use the controls above to toggle camera and microphone</li>
            <li>ƒ?› Your video appears in the grid alongside other officers</li>
            <li>ƒ?› Uses unified LiveKit room: "officer-stream"</li>
            <li>ƒ?› All officers can see and hear each other in real-time</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default OfficerLoungeStream
