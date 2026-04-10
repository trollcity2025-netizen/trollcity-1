import React, { useState, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { Eye, Heart, Coins, Users, LayoutDashboard, Maximize2, Minimize2, Clock, ShoppingBag } from 'lucide-react'

interface Props {
  header: React.ReactNode
  video: React.ReactNode
  controls: React.ReactNode
  chat: React.ReactNode

  isChatOpen: boolean
  onToggleChat: () => void
  onLike?: () => void

  overlays?: React.ReactNode
  modals?: React.ReactNode
  hideHeader?: boolean
  battleGiftPanel?: React.ReactNode
  
  stats?: {
    viewers?: number
    likes?: number
    coinsEarned?: number
    onStage?: number
  }

  forceViewMode?: 'dashboard' | 'fullscreen' | 'vertical'
}

export default function StreamLayout({
  header,
  video,
  controls,
  chat,
  isChatOpen,
  onToggleChat,
  onLike,
  overlays,
  modals,
  hideHeader = false,
  battleGiftPanel,
  stats,
  forceViewMode,
}: Props) {

  const [chatWidth, setChatWidth] = useState(320)
  const [dragging, setDragging] = useState(false)
  const [viewMode, setViewMode] = useState<'dashboard' | 'fullscreen' | 'vertical'>(() => {
    // Use forced view mode if provided
    if (forceViewMode) return forceViewMode;
    // Auto-detect mobile on initial load - use vertical TikTok mode
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'vertical' : 'fullscreen';
    }
    return 'fullscreen';
  })
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [streamDuration, setStreamDuration] = useState(0)
  
  // Auto switch to vertical mode when window resizes to mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewMode('vertical');
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [])
  
  // Stream duration timer - starts at 00:00 and counts up
  useEffect(() => {
    const interval = setInterval(() => {
      setStreamDuration(prev => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])
  
  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const startDrag = () => setDragging(true)
  const stopDrag = () => setDragging(false)

  const onDrag = (e: React.MouseEvent) => {
    if (!dragging) return
    const newWidth = window.innerWidth - e.clientX
    if (newWidth > 260 && newWidth < 600) {
      setChatWidth(newWidth)
    }
  }

   // ─── VERTICAL TIKTOK MODE (Mobile optimized) ───
   if (viewMode === 'vertical') {
     return (
       <div
         className="relative h-dvh w-full bg-black text-white flex flex-col overflow-hidden"
         onMouseMove={onDrag}
         onMouseUp={stopDrag}
       >
         {/* HEADER (hidden during battle) */}
         {!hideHeader && (
           <div className="absolute top-0 left-0 right-0 z-50">
             {header}
           </div>
         )}

         {/* MAIN CONTENT - Video at top 70% */}
         <div className="h-[70%] relative">
           {video}
           
           {/* CONTROLS - Floating at bottom of video area */}
           <div className="absolute bottom-4 left-4 right-4 z-40">
             {controls}
           </div>

           {/* Gradient fade at bottom */}
           <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />
         </div>

         {/* CHAT AREA - Bottom 30% */}
         <div className="flex-1 flex flex-col px-3 pt-2 pb-2 overflow-hidden">
           <div className="flex-1 min-h-0 overflow-y-auto bg-transparent">
             {chat}
           </div>
         </div>

         {/* RIGHT SIDE FLOATING ACTIONS */}
         <div className="absolute right-3 bottom-[210px] z-40 flex flex-col items-center gap-2">
           <div className="flex flex-col items-center gap-0.5">
             <button 
               onClick={onLike}
               className="w-7 h-7 rounded-full bg-black/30 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-90"
             >
               <Heart size={14} />
             </button>
             <span className="text-[7px] font-bold text-white/70">{stats?.likes || 0}</span>
           </div>
           <div className="flex flex-col items-center gap-0.5">
             <button 
               onClick={onToggleChat}
               className="w-7 h-7 rounded-full bg-black/30 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all"
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/></svg>
             </button>
             <span className="text-[7px] font-bold text-white/70">Chat</span>
           </div>
           <div className="flex flex-col items-center gap-0.5">
             <button className="w-7 h-7 rounded-full bg-black/30 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all">
               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="12"/></svg>
             </button>
             <span className="text-[7px] font-bold text-white/70">Share</span>
           </div>
         </div>

         {/* OVERLAYS */}
         {overlays}

         {/* MODALS */}
         {modals}

         {/* View mode toggle - cycle all 3 layouts */}
         <button
           onClick={() => {
             setViewMode(current => 
               current === 'vertical' ? 'fullscreen' : 
               current === 'fullscreen' ? 'dashboard' : 
               'vertical'
             )
           }}
           className="absolute top-3 right-3 z-50 w-8 h-8 rounded-lg bg-black/40 backdrop-blur border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
           title="Cycle View Mode"
         >
           <LayoutDashboard size={14} />
         </button>
       </div>
     )
   }

   // ─── FULLSCREEN MODE (original layout) ───
   if (viewMode === 'fullscreen') {
    return (
      <div
        className="relative h-dvh w-full bg-black text-white flex flex-col overflow-hidden"
        onMouseMove={onDrag}
        onMouseUp={stopDrag}
      >
        {/* HEADER (hidden during battle) */}
        {!hideHeader && (
          <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
            {header}
          </div>
        )}

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
        className="relative h-dvh w-full bg-[#0c0c10] text-white flex flex-col overflow-hidden"
        onMouseMove={onDrag}
        onMouseUp={stopDrag}
      >
      {/* TOP BAR - Collapsible (hidden during battle) */}
      {hideHeader ? null : headerCollapsed ? (
        <div className="h-6 bg-[#13131a] border-b border-white/5 flex items-center justify-center shrink-0 z-50 cursor-pointer hover:bg-[#1a1a24] transition-colors"
          onClick={() => setHeaderCollapsed(false)}>
          <Minimize2 size={10} className="text-white/30 rotate-180" />
        </div>
      ) : (
        <div className="h-11 bg-[#13131a] border-b border-white/5 flex items-center justify-between px-4 shrink-0 z-50">
          <div className="flex items-center gap-3">
            <LayoutDashboard size={13} className="text-violet-400" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Dashboard</span>
            <div className="w-px h-4 bg-white/10" />
            {header}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHeaderCollapsed(true)}
              className="w-7 h-7 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all"
              title="Collapse Header"
            >
              <Minimize2 size={12} />
            </button>
            <button
              onClick={() => setViewMode('fullscreen')}
              className="w-7 h-7 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all"
              title="Fullscreen View"
            >
              <Maximize2 size={12} />
            </button>
          </div>
        </div>
      )}

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

          {/* Stats / Battle Gift panel */}
          <div className="flex-1 bg-zinc-950 rounded-xl border border-white/10 flex flex-col min-h-0 overflow-hidden">
            {battleGiftPanel ? (
              battleGiftPanel
            ) : (
              <>
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Stream Stats</p>
                     <div className="space-y-1.5">
                       <StatRow icon={Eye} label="Viewers" value={stats?.viewers?.toString() || "—"} color="blue" />
                       <StatRow icon={Heart} label="Likes" value={stats?.likes?.toString() || "—"} color="pink" />
                       <StatRow icon={Coins} label="Earned" value={stats?.coinsEarned?.toString() || "—"} color="amber" />
                       <StatRow icon={Users} label="On Stage" value={stats?.onStage?.toString() || "—"} color="emerald" />
                       <StatRow icon={Clock} label="Duration" value={formatDuration(streamDuration)} color="cyan" />
                     </div>
                  </div>
                  <button
                    onClick={onToggleChat}
                    className="w-full mt-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-wider transition-all border border-white/5"
                  >
                    {isChatOpen ? 'Hide Chat' : 'Show Chat'}
                  </button>
                </div>
              </>
            )}
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
