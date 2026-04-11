import React from 'react'
import { useParams } from 'react-router-dom'

interface EmbedPageProps {
  embedded?: boolean
}

export default function EmbedPage({ embedded = false }: EmbedPageProps) {
  const { id: streamId } = useParams<{ id: string }>()

  if (!streamId) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <p>Invalid stream</p>
      </div>
    )
  }

  const watchUrl = `/broadcast/${streamId}`

  return (
    <div className="w-full h-full bg-black">
      <iframe
        src={watchUrl}
        className="w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  )
}