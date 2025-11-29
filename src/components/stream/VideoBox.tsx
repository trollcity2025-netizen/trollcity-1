import { useEffect, useRef } from 'react'

interface VideoBoxProps {
  participant: any
  size: 'full' | 'medium' | 'small'
  label: string
}

export default function VideoBox({ participant, size, label }: VideoBoxProps) {
  const videoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!participant || !videoRef.current) return

    // Clear existing content
    const container = videoRef.current
    container.innerHTML = ''

    // Find video track from participant
    const videoTrack = (() => {
      // Try videoTrackPublications first
      if ((participant as any).videoTrackPublications) {
        const pubs = Array.from((participant as any).videoTrackPublications.values()) as any[]
        const pub = pubs.find((p: any) => p?.track && p.track.kind === 'video')
        if (pub?.track) return pub.track
      }
      // Fallback to trackPublications
      if ((participant as any).trackPublications) {
        const pubs = Array.from((participant as any).trackPublications.values()) as any[]
        const pub = pubs.find((p: any) => p?.track && p.track.kind === 'video')
        if (pub?.track) return pub.track
      }
      return null
    })() as any

    if (videoTrack) {
      const videoElement = videoTrack.attach()
      if (videoElement instanceof HTMLVideoElement) {
        videoElement.className = 'w-full h-full object-cover'
        videoElement.autoplay = true
        videoElement.playsInline = true
        if (participant.isLocal) {
          videoElement.muted = true
        }
      }
      container.appendChild(videoElement)
    } else {
      // Show placeholder if no video
      container.innerHTML = `
        <div class="w-full h-full flex items-center justify-center bg-gray-800 text-white">
          <span class="text-sm">${participant.identity || 'No Video'}</span>
        </div>
      `
    }

    return () => {
      if (videoTrack) {
        videoTrack.detach()
      }
    }
  }, [participant])

  const sizeClass =
    size === 'full'
      ? 'w-full h-full'
      : size === 'medium'
      ? 'w-full h-full'
      : 'w-[150px] h-[100px]'

  return (
    <div
      className={`relative ${sizeClass} rounded-xl border border-purple-500 shadow-[0_0_20px_rgba(177,48,255,0.4)] bg-black overflow-hidden`}
      ref={videoRef}
    >
      <div className="absolute bottom-2 left-2 text-xs bg-black/50 backdrop-blur-md px-2 py-1 rounded-full text-white font-semibold z-10">
        {label}
      </div>
    </div>
  )
}

