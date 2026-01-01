import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface StreamDiagnosticsProps {
  streamId?: string
  isHost?: boolean
}

export default function StreamDiagnostics({ streamId, isHost }: StreamDiagnosticsProps) {
  const [diagnostics, setDiagnostics] = useState<any>({})
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!streamId) return

    const runDiagnostics = async () => {
      const results: any = {
        timestamp: new Date().toISOString(),
        streamId,
        isHost,
        checks: {}
      }

      try {
        // Check 1: Stream existence and status
        const { data: streamData, error: streamError } = await supabase
          .from('streams')
          .select('*')
          .eq('id', streamId)
          .single()

        results.checks.streamExists = !!streamData
        results.checks.streamIsLive = streamData?.is_live || false
        results.checks.streamError = streamError?.message || null

        // Check 2: LiveKit connection
        const tokenResponse = await fetch('/api/livekit-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: streamId,
            identity: 'diagnostic-user',
            allowPublish: isHost
          })
        })

        results.checks.livekitTokenResponse = tokenResponse.status
        results.checks.livekitTokenOk = tokenResponse.ok

        // Check 3: Real-time subscriptions
        const messagesChannel = supabase
          .channel(`diagnostic_messages_${streamId}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'stream_messages',
            filter: `stream_id=eq.${streamId}`
          }, () => {
            console.log('✅ Messages subscription working')
          })
          .subscribe((status) => {
            results.checks.messagesSubscriptionStatus = status
          })

        const giftsChannel = supabase
          .channel(`diagnostic_gifts_${streamId}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'stream_gifts',
            filter: `stream_id=eq.${streamId}`
          }, () => {
            console.log('✅ Gifts subscription working')
          })
          .subscribe((status) => {
            results.checks.giftsSubscriptionStatus = status
          })

        // Clean up after check
        setTimeout(() => {
          supabase.removeChannel(messagesChannel)
          supabase.removeChannel(giftsChannel)
        }, 2000)

        // Check 4: Media permissions
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          })
          results.checks.mediaPermissionsGranted = true
          results.checks.videoTracks = mediaStream.getVideoTracks().length
          results.checks.audioTracks = mediaStream.getAudioTracks().length
          mediaStream.getTracks().forEach(track => track.stop())
        } catch (error: any) {
          results.checks.mediaPermissionsGranted = false
          results.checks.mediaError = error.message
        }

        // Check 5: Network connectivity
        try {
          const startTime = Date.now()
          await fetch('/api/livekit-token', { method: 'HEAD' })
          results.checks.apiResponseTime = Date.now() - startTime
        } catch (error) {
          results.checks.apiConnectivity = false
        }

        setDiagnostics(results)

      } catch (error: any) {
        results.error = error.message
        setDiagnostics(results)
      }
    }

    runDiagnostics()
  }, [streamId, isHost])

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 left-4 bg-red-600 text-white px-3 py-2 rounded text-xs z-50"
      >
        🔧 Stream Diagnostics
      </button>
    )
  }

  return (
    <div className="fixed top-4 left-4 bg-black/90 border border-red-500 rounded-lg p-4 text-white text-xs max-w-md z-50 max-h-96 overflow-y-auto">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-red-400">🔧 Stream Diagnostics</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2">
        <div>
          <strong>Stream Status:</strong>
          <div className={`ml-2 ${diagnostics.checks?.streamIsLive ? 'text-green-400' : 'text-red-400'}`}>
            {diagnostics.checks?.streamIsLive ? '✅ Live' : '❌ Not Live'}
          </div>
        </div>

        <div>
          <strong>LiveKit Token:</strong>
          <div className={`ml-2 ${diagnostics.checks?.livekitTokenOk ? 'text-green-400' : 'text-red-400'}`}>
            {diagnostics.checks?.livekitTokenOk ? '✅ OK' : '❌ Failed'} ({diagnostics.checks?.livekitTokenResponse})
          </div>
        </div>

        <div>
          <strong>Media Permissions:</strong>
          <div className={`ml-2 ${diagnostics.checks?.mediaPermissionsGranted ? 'text-green-400' : 'text-red-400'}`}>
            {diagnostics.checks?.mediaPermissionsGranted 
              ? `✅ Granted (${diagnostics.checks?.videoTracks || 0}v/${diagnostics.checks?.audioTracks || 0}a)` 
              : `❌ Denied: ${diagnostics.checks?.mediaError || 'Unknown error'}`
            }
          </div>
        </div>

        <div>
          <strong>Real-time Subscriptions:</strong>
          <div className="ml-2 space-y-1">
            <div className={diagnostics.checks?.messagesSubscriptionStatus === 'SUBSCRIBED' ? 'text-green-400' : 'text-red-400'}>
              Messages: {diagnostics.checks?.messagesSubscriptionStatus || 'Not tested'}
            </div>
            <div className={diagnostics.checks?.giftsSubscriptionStatus === 'SUBSCRIBED' ? 'text-green-400' : 'text-red-400'}>
              Gifts: {diagnostics.checks?.giftsSubscriptionStatus || 'Not tested'}
            </div>
          </div>
        </div>

        <div>
          <strong>API Response Time:</strong>
          <div className={`ml-2 ${(diagnostics.checks?.apiResponseTime || 0) < 1000 ? 'text-green-400' : 'text-yellow-400'}`}>
            {diagnostics.checks?.apiResponseTime ? `${diagnostics.checks.apiResponseTime}ms` : 'Failed'}
          </div>
        </div>

        {diagnostics.error && (
          <div>
            <strong>Error:</strong>
            <div className="ml-2 text-red-400">{diagnostics.error}</div>
          </div>
        )}

        <button
          onClick={() => {
            const dataStr = JSON.stringify(diagnostics, null, 2)
            const dataBlob = new Blob([dataStr], { type: 'application/json' })
            const url = URL.createObjectURL(dataBlob)
            const link = document.createElement('a')
            link.href = url
            link.download = `stream-diagnostics-${streamId}.json`
            link.click()
          }}
          className="w-full mt-2 bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs"
        >
          📥 Download Report
        </button>
      </div>
    </div>
  )
}