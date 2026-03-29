import React, { useState } from 'react'
import { cn } from '../../lib/utils'
import { Eye, Heart, Coins, Users, LayoutDashboard, Maximize2, Minimize2 } from 'lucide-react'

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
  const [viewMode, setViewMode] = useState<'dashboard' | 'fullscreen'>('dashboard')

  const startDrag = () => setDragging(true)
  const stopDrag = () => setDragging(false)

  const onDrag = (e: React.MouseEvent) => {
    if (!dragging) return
    const newWidth = window.innerWidth - e.clientX
    if (newWidth > 260 && newWidth < 600) {
      setChatWidth(newWidth)
    }
  }

  // ─── FULLSCREEN MODE (original layout) ───
  if (viewMode === 'fullscreen') {
    return (
      <div
        className="h-dvh w-full bg-black text-white flex flex-col overflow-hidden"
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
            {/* CONTROLS - Floating Overlay */}
            <div className="absolute bottom-4 left-4 right-4 z-40">
              {controls}
            </div>
          </div>

          {/* DESKTOP CHAT */}
          {isChatOpen && (
            <div
              style={{ width: chatWidth }}
              className="hidden md:flex flex-shrink-0 border-l border-white/10 bg-black/40 relative"
            >
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

        {/* MOBILE CHAT PANEL */}
        {isChatOpen && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[55%] bg-black/95 backdrop-blur border-t border-white/10 rounded-t-2xl shadow-2xl">
            <div className="flex flex-col h-full min-h-0">
              <div className="flex items-center justify-between p-3 border-b border-white/10">
                <span className="font-semibold">Live Chat</span>
                <button onClick={onToggleChat} className="text-sm bg-white/10 px-3 py-1 rounded">
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

        {/* View mode toggle */}
        <button
          onClick={() => setViewMode('dashboard')}
          className="absolute top-3 right-3 z-50 w-8 h-8 rounded-lg bg-black/40 backdrop-blur border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
          title="Dashboard View"
        >
          <LayoutDashboard size={14} />
        </button>
      </div>
    )
  }

  // ─── DASHBOARD GRID MODE ───
  return (
      <div
        className="h-dvh w-full bg-[#0c0c10] text-white flex flex-col overflow-hidden"
        onMouseMove={onDrag}
        onMouseUp={stopDrag}
      >
      {/* TOP BAR */}
      <div className="h-11 bg-[#13131a] border-b border-white/5 flex items-center justify-between px-4 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <LayoutDashboard size={13} className="text-violet-400" />
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">Dashboard</span>
          <div className="w-px h-4 bg-white/10" />
          {header}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('fullscreen')}
            className="w-7 h-7 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all"
            title="Fullscreen View"
          >
            <Maximize2 size={12} />
          </button>
        </div>
      </div>

      {/* GRID LAYOUT - uses remaining height after header */}
      <div className="flex-1 min-h-0 grid grid-cols-3 gap-1.5 p-1.5 overflow-hidden">
        {/* LEFT: Video + Controls stacked */}
        <div className="col-span-2 flex flex-col gap-1.5 min-h-0">
          {/* Video area */}
          <div className="flex-1 min-h-0 relative rounded-xl overflow-hidden">
            {video}
            {/* Controls overlay on video */}
            <div className="absolute bottom-3 left-3 right-3 z-40">
              {controls}
            </div>
          </div>
        </div>

        {/* RIGHT: Chat + Stats stacked */}
        <div className="flex flex-col gap-1.5 min-h-0">
          {/* Chat panel - takes most of the height */}
          <div className="flex-[2] bg-zinc-950 rounded-xl border border-white/10 overflow-hidden flex flex-col min-h-0 relative">
            {isChatOpen ? (
              <>
                <div className="flex-1 min-h-0 overflow-hidden">
                  {chat}
                </div>
                <button
                  onClick={onToggleChat}
                  className="absolute top-2 right-2 z-10 w-5 h-5 rounded bg-black/60 flex items-center justify-center text-white/40 hover:text-white transition-all text-[10px]"
                >
                  ✕
                </button>
              </>
            ) : (
              <button
                onClick={onToggleChat}
                className="w-full h-full flex items-center justify-center text-slate-600 hover:text-slate-400 transition-colors"
              >
                <span className="text-xs">Open Chat</span>
              </button>
            )}
          </div>

          {/* Stats panel */}
          <div className="flex-1 bg-zinc-950 rounded-xl border border-white/10 p-3 flex flex-col justify-between min-h-0">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Stream Stats</p>
              <div className="space-y-1.5">
                <StatRow icon={Eye} label="Viewers" value="—" color="blue" />
                <StatRow icon={Heart} label="Likes" value="—" color="pink" />
                <StatRow icon={Coins} label="Earned" value="—" color="amber" />
                <StatRow icon={Users} label="On Stage" value="—" color="emerald" />
              </div>
            </div>
            <button
              onClick={onToggleChat}
              className="w-full mt-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-wider transition-all border border-white/5"
            >
              {isChatOpen ? 'Hide Chat' : 'Show Chat'}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE CHAT PANEL */}
      {isChatOpen && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[55%] bg-black/95 backdrop-blur border-t border-white/10 rounded-t-2xl shadow-2xl">
          <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <span className="font-semibold">Live Chat</span>
              <button onClick={onToggleChat} className="text-sm bg-white/10 px-3 py-1 rounded">
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

function StatRow({ icon: Icon, label, value, color }: any) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Icon size={10} className={`text-${color}-400`} />
        <span className="text-[9px] text-slate-500">{label}</span>
      </div>
      <span className={cn("text-[10px] font-bold font-mono", `text-${color}-400`)}>{value}</span>
    </div>
  )
}
