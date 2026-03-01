import React, { useState } from 'react'
import { cn } from '../../lib/utils'

interface Props {
  header: React.ReactNode
  video: React.ReactNode
  controls: React.ReactNode
  chat: React.ReactNode

  isChatOpen: boolean
  onToggleChat: () => void

  overlays?: React.ReactNode
  modals?: React.ReactNode
}

export default function StreamLayout({
  header,
  video,
  controls,
  chat,
  isChatOpen,
  onToggleChat,
  overlays,
  modals
}: Props) {

  const [chatWidth, setChatWidth] = useState(320)
  const [dragging, setDragging] = useState(false)

  const startDrag = () => setDragging(true)
  const stopDrag = () => setDragging(false)

  const onDrag = (e: React.MouseEvent) => {
    if (!dragging) return
    const newWidth = window.innerWidth - e.clientX
    if (newWidth > 260 && newWidth < 600) {
      setChatWidth(newWidth)
    }
  }

  return (
    <div
      className="h-screen w-full bg-black text-white flex flex-col overflow-hidden"
      onMouseMove={onDrag}
      onMouseUp={stopDrag}
    >

      {/* HEADER */}
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
        {header}
      </div>

      {/* MAIN */}
      <div className="flex flex-1 min-h-0">

        {/* VIDEO AREA */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 relative">

          <div className="flex-1 min-h-0 overflow-hidden">
            {video}
          </div>

          {/* CONTROLS */}
          <div className="flex-shrink-0 bg-zinc-900/90 border-t border-white/10 backdrop-blur">
            {controls}
          </div>

        </div>

        {/* DESKTOP CHAT */}
        {isChatOpen && (
          <div
            style={{ width: chatWidth }}
            className="hidden md:flex flex-shrink-0 border-l border-white/10 bg-black/40 relative"
          >

            {/* DRAG HANDLE */}
            <div
              onMouseDown={startDrag}
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-white/10 hover:bg-purple-500"
            />

            <div className="flex flex-col w-full h-full min-h-0 overflow-hidden">
              {chat}
            </div>

          </div>
        )}

      </div>

      {/* MOBILE CHAT PANEL — FIXED */}
      {isChatOpen && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[55%] bg-black/95 backdrop-blur border-t border-white/10 rounded-t-2xl shadow-2xl">

          <div className="flex flex-col h-full min-h-0">

            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <span className="font-semibold">Live Chat</span>

              <button
                onClick={onToggleChat}
                className="text-sm bg-white/10 px-3 py-1 rounded"
              >
                Close
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              {chat}
            </div>

          </div>

        </div>
      )}

      {/* OVERLAYS */}
      {overlays}

      {/* MODALS */}
      {modals}

    </div>
  )
}