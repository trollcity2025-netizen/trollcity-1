import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, MessageSquare, Heart, Eye, Send, Users, Coins, Crown, Gem, Settings, ChevronRight, Maximize2, Minimize2, ArrowLeftRight, PanelRightOpen, PanelRightClose, LayoutDashboard, Columns2, Square, Monitor, Layers, Sparkles, Shield, Swords, Gift, Share2, Power, GripVertical } from 'lucide-react';
import { cn } from '../../lib/utils';

// ═══════════════════════════════════════════════════════════════
// SHARED MOCK DATA
// ═══════════════════════════════════════════════════════════════
const MOCK_MESSAGES = [
  { user: 'TrollFan99', text: 'This stream is fire! 🔥', color: 'text-pink-400' },
  { user: 'CityBoy', text: 'Yo what up troll fam', color: 'text-blue-400' },
  { user: 'GhostUser', text: 'first time here, this is cool', color: 'text-green-400' },
  { user: 'HypeMan', text: 'LETS GOOOOO', color: 'text-yellow-400' },
  { user: 'ChillDude', text: 'vibes are immaculate tonight', color: 'text-purple-400' },
  { user: 'NewViewer', text: 'how do I join the stage?', color: 'text-cyan-400' },
];

const MOCK_VIEWERS = 247;

function MockVideo({ className, label = "HOST", gradient = "from-purple-900/40 to-blue-900/40" }: { className?: string; label?: string; gradient?: string }) {
  return (
    <div className={cn(`bg-gradient-to-br ${gradient} relative flex items-center justify-center rounded-xl overflow-hidden border border-white/10`, className)}>
      <div className="text-center">
        <Video size={28} className="text-white/20 mx-auto mb-1.5" />
        <p className="text-[10px] text-white/30 font-medium">{label}</p>
      </div>
      <div className="absolute top-2 left-2 bg-black/50 backdrop-blur px-2 py-0.5 rounded-full text-[9px] text-white font-bold border border-white/10">
        {label}
      </div>
    </div>
  );
}

function MockChat({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {!compact && (
        <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold text-white">Live Chat</span>
          <span className="text-[10px] text-slate-500">{MOCK_VIEWERS} online</span>
        </div>
      )}
      <div className="flex-1 overflow-hidden p-2 space-y-1.5">
        {MOCK_MESSAGES.map((m, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className={cn("text-[10px] font-bold shrink-0", m.color)}>{m.user}</span>
            <span className="text-[10px] text-slate-300 break-all">{m.text}</span>
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-white/10">
        <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1.5">
          <input readOnly placeholder="Say something..." className="flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-slate-600" />
          <Send size={12} className="text-violet-400" />
        </div>
      </div>
    </div>
  );
}

function MockControls({ compact = false }: { compact?: boolean }) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <button onClick={() => setMicOn(!micOn)} className={cn("w-7 h-7 rounded-full flex items-center justify-center", micOn ? "bg-white/10 text-white" : "bg-red-500/20 text-red-400")}>
          {micOn ? <Mic size={12} /> : <MicOff size={12} />}
        </button>
        <button onClick={() => setCamOn(!camOn)} className={cn("w-7 h-7 rounded-full flex items-center justify-center", camOn ? "bg-white/10 text-white" : "bg-red-500/20 text-red-400")}>
          {camOn ? <Video size={12} /> : <VideoOff size={12} />}
        </button>
        <button className="w-7 h-7 rounded-full bg-white/10 text-white flex items-center justify-center">
          <Settings size={12} />
        </button>
        <button className="px-2 py-1 rounded-full bg-red-600 text-white text-[8px] font-bold flex items-center gap-1">
          <Power size={8} /> END
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setMicOn(!micOn)} className={cn("w-9 h-9 rounded-xl flex items-center justify-center border transition-all", micOn ? "bg-white/10 border-white/10 text-white" : "bg-red-500/20 border-red-500/30 text-red-400")}>
        {micOn ? <Mic size={16} /> : <MicOff size={16} />}
      </button>
      <button onClick={() => setCamOn(!camOn)} className={cn("w-9 h-9 rounded-xl flex items-center justify-center border transition-all", camOn ? "bg-white/10 border-white/10 text-white" : "bg-red-500/20 border-red-500/30 text-red-400")}>
        {camOn ? <Video size={16} /> : <VideoOff size={16} />}
      </button>
      <button className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 text-white flex items-center justify-center">
        <MessageSquare size={16} />
      </button>
      <button className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 text-white flex items-center justify-center">
        <Share2 size={16} />
      </button>
      <div className="flex-1" />
      <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-bold flex items-center gap-1.5">
        <Power size={12} /> End Stream
      </button>
    </div>
  );
}

function HeaderBadge({ icon: Icon, value, color }: any) {
  return (
    <div className={cn("flex items-center gap-1 bg-black/40 backdrop-blur px-2 py-1 rounded-full border", `border-${color}-500/20`)}>
      <Icon size={11} className={`text-${color}-400`} />
      <span className="text-[10px] font-bold text-white">{value}</span>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// DESIGN 1: CINEMATIC WIDESCREEN
// Video fills the entire viewport, all UI overlays on top
// ═══════════════════════════════════════════════════════════════
function Layout1_Cinematic() {
  return (
    <div className="relative h-[520px] bg-black rounded-2xl overflow-hidden border border-white/10">
      {/* Full-screen video */}
      <MockVideo className="absolute inset-0" label="FULLSCREEN VIDEO" gradient="from-indigo-900/30 via-purple-900/20 to-slate-900/30" />

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50 pointer-events-none" />

      {/* Top: Floating header */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl rounded-full px-3 py-1.5 border border-white/10">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-pink-500" />
          <span className="text-xs font-bold text-white">username</span>
          <span className="bg-red-500 text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white">LIVE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <HeaderBadge icon={Eye} value={MOCK_VIEWERS} color="blue" />
          <HeaderBadge icon={Heart} value="89" color="pink" />
        </div>
      </div>

      {/* Left: Chat overlay (semi-transparent) */}
      <div className="absolute left-3 top-14 bottom-20 w-52 z-20">
        <div className="h-full bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden">
          <MockChat compact />
        </div>
      </div>

      {/* Bottom: Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-30 p-3">
        <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-3">
          <MockControls />
        </div>
      </div>

      {/* Right side: Quick stats */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2">
        <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-white/10 flex items-center justify-center text-white/70 hover:text-white cursor-pointer transition-all">
          <Swords size={16} />
        </div>
        <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-white/10 flex items-center justify-center text-white/70 hover:text-white cursor-pointer transition-all">
          <Gift size={16} />
        </div>
        <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-white/10 flex items-center justify-center text-white/70 hover:text-white cursor-pointer transition-all">
          <Sparkles size={16} />
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// DESIGN 2: SPLIT PANEL
// Video on left, chat always visible on right
// ═══════════════════════════════════════════════════════════════
function Layout2_SplitPanel() {
  return (
    <div className="h-[520px] bg-zinc-950 rounded-2xl overflow-hidden border border-white/10 flex flex-col">
      {/* Top header bar */}
      <div className="h-10 bg-zinc-900 border-b border-white/10 flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500" />
          <span className="text-xs font-bold text-white">username</span>
          <span className="bg-red-500/80 text-[8px] font-bold px-1.5 py-0.5 rounded text-white">LIVE</span>
        </div>
        <div className="flex items-center gap-2">
          <HeaderBadge icon={Eye} value={MOCK_VIEWERS} color="blue" />
          <HeaderBadge icon={Heart} value="89" color="pink" />
          <button className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-white/50">
            <Maximize2 size={10} />
          </button>
        </div>
      </div>

      {/* Main content: Video + Chat side by side */}
      <div className="flex-1 flex min-h-0">
        {/* Video area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 p-2 min-h-0">
            <MockVideo className="w-full h-full" label="VIDEO FEED" gradient="from-emerald-900/20 to-teal-900/20" />
          </div>
          {/* Controls below video */}
          <div className="px-3 py-2 border-t border-white/10 bg-zinc-900/50">
            <MockControls compact />
          </div>
        </div>

        {/* Chat sidebar - always visible */}
        <div className="w-60 border-l border-white/10 bg-zinc-950 shrink-0 hidden md:flex flex-col">
          <MockChat />
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// DESIGN 3: DASHBOARD GRID
// Multiple panels arranged in a dashboard layout
// ═══════════════════════════════════════════════════════════════
function Layout3_Dashboard() {
  return (
    <div className="h-[520px] bg-[#0c0c10] rounded-2xl overflow-hidden border border-white/10 flex flex-col">
      {/* Top bar */}
      <div className="h-9 bg-[#13131a] border-b border-white/5 flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={12} className="text-violet-400" />
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">Dashboard View</span>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-slate-500 font-mono">
          <span>60FPS</span>
          <span>•</span>
          <span>1080p</span>
          <span>•</span>
          <span>4500kbps</span>
        </div>
      </div>

      {/* Grid layout */}
      <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-1.5 p-1.5 min-h-0">
        {/* Main video - larger */}
        <div className="col-span-2 row-span-2">
          <MockVideo className="w-full h-full" label="MAIN CAMERA" gradient="from-violet-900/20 to-indigo-900/20" />
        </div>

        {/* Chat panel */}
        <div className="bg-zinc-950 rounded-xl border border-white/10 overflow-hidden">
          <MockChat compact />
        </div>

        {/* Stats panel */}
        <div className="bg-zinc-950 rounded-xl border border-white/10 p-2.5 flex flex-col justify-between">
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Stream Stats</p>
            <div className="space-y-1.5">
              <StatRow icon={Eye} label="Viewers" value={MOCK_VIEWERS.toString()} color="blue" />
              <StatRow icon={Heart} label="Likes" value="89" color="pink" />
              <StatRow icon={Coins} label="Earned" value="1,250" color="amber" />
              <StatRow icon={Users} label="On Stage" value="1/6" color="emerald" />
            </div>
          </div>
          <div className="mt-2">
            <MockControls compact />
          </div>
        </div>
      </div>
    </div>
  );
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
  );
}


// ═══════════════════════════════════════════════════════════════
// DESIGN 4: IMMERSIVE OVERLAY
// Video fills everything, all elements float on top
// ═══════════════════════════════════════════════════════════════
function Layout4_Immersive() {
  const [chatVisible, setChatVisible] = useState(true);

  return (
    <div className="relative h-[520px] bg-black rounded-2xl overflow-hidden border border-white/10">
      {/* Full bleed video */}
      <MockVideo className="absolute inset-0" label="IMMERSIVE VIDEO" gradient="from-rose-900/20 via-pink-900/10 to-black" />

      {/* Subtle gradient */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-black/60" />

      {/* Top: Transparent header */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 flex items-start justify-between">
        {/* User info - left */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 ring-2 ring-rose-500/30" />
            <div>
              <p className="text-sm font-bold text-white drop-shadow-lg">username</p>
              <p className="text-[10px] text-rose-300/80">General Chat</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="bg-red-500/80 backdrop-blur text-[9px] font-bold px-2 py-0.5 rounded-full text-white">LIVE</span>
            <div className="flex items-center gap-1 bg-black/30 backdrop-blur px-2 py-0.5 rounded-full">
              <Eye size={10} className="text-blue-300" />
              <span className="text-[10px] font-bold text-white">{MOCK_VIEWERS}</span>
            </div>
            <div className="flex items-center gap-1 bg-black/30 backdrop-blur px-2 py-0.5 rounded-full">
              <Heart size={10} className="text-pink-400" />
              <span className="text-[10px] font-bold text-white">89</span>
            </div>
          </div>
        </div>

        {/* Coin balances - right */}
        <div className="bg-black/30 backdrop-blur-xl rounded-2xl border border-white/10 px-3 py-2 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Crown size={10} className="text-amber-400" />
            <span className="text-[10px] font-bold text-white">12</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center gap-1">
            <Gem size={10} className="text-purple-400" />
            <span className="text-[10px] font-bold text-white">340</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center gap-1">
            <Coins size={10} className="text-yellow-400" />
            <span className="text-[10px] font-bold text-white">5,200</span>
          </div>
        </div>
      </div>

      {/* Chat: Floating bottom-left panel */}
      {chatVisible && (
        <div className="absolute left-3 bottom-20 w-56 h-60 z-20 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
          <MockChat compact />
        </div>
      )}

      {/* Right: Vertical action buttons */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2">
        <FloatingAction icon={Heart} label="89" color="pink" />
        <FloatingAction icon={Gift} label="Gift" color="amber" />
        <FloatingAction icon={Share2} label="Share" color="blue" />
        <FloatingAction icon={Swords} label="Battle" color="red" />
        <FloatingAction icon={MessageSquare} label={chatVisible ? "Hide" : "Chat"} color="purple" onClick={() => setChatVisible(!chatVisible)} />
      </div>

      {/* Bottom: Minimal controls */}
      <div className="absolute bottom-0 left-0 right-0 z-30 p-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white">
            <Mic size={16} />
          </button>
          <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white">
            <Video size={16} />
          </button>
        </div>
        <button className="px-5 py-2.5 rounded-full bg-red-500/80 backdrop-blur text-white text-xs font-bold flex items-center gap-1.5 border border-red-400/30">
          <Power size={12} /> End
        </button>
      </div>
    </div>
  );
}

function FloatingAction({ icon: Icon, label, color, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5">
      <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all">
        <Icon size={16} />
      </div>
      <span className="text-[8px] text-white/50">{label}</span>
    </button>
  );
}


// ═══════════════════════════════════════════════════════════════
// DESIGN 5: VERTICAL MOBILE-FIRST
// TikTok-style vertical layout
// ═══════════════════════════════════════════════════════════════
function Layout5_VerticalMobile() {
  return (
    <div className="flex justify-center bg-[#080808] rounded-2xl overflow-hidden border border-white/10 p-4">
      <div className="relative w-[280px] h-[500px] bg-black rounded-[2rem] overflow-hidden border-2 border-white/10 shadow-2xl">
        {/* Fullscreen video */}
        <MockVideo className="absolute inset-0" label="VERTICAL VIDEO" gradient="from-amber-900/20 via-orange-900/10 to-black" rounded={false} />

        {/* Gradient overlays */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/30 via-transparent to-black/70" />

        {/* Top: Status bar */}
        <div className="absolute top-0 left-0 right-0 z-30 pt-8 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-500" />
            <div>
              <p className="text-[11px] font-bold text-white">username</p>
              <p className="text-[9px] text-amber-300/80">LIVE</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="bg-red-500/80 text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
            </span>
          </div>
        </div>

        {/* Right side: Vertical action list (TikTok style) */}
        <div className="absolute right-3 bottom-32 z-30 flex flex-col items-center gap-4">
          <VertAction icon={Heart} value="89" color="pink" />
          <VertAction icon={MessageSquare} value="45" color="blue" />
          <VertAction icon={Gift} value="12" color="amber" />
          <VertAction icon={Share2} value="" color="white" />
        </div>

        {/* Bottom: Chat preview + controls */}
        <div className="absolute bottom-0 left-0 right-0 z-30">
          {/* Chat preview */}
          <div className="px-4 pb-2">
            <div className="space-y-1">
              {MOCK_MESSAGES.slice(0, 3).map((m, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className={cn("text-[9px] font-bold", m.color)}>{m.user}</span>
                  <span className="text-[9px] text-white/70">{m.text}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5 mt-2 bg-black/30 backdrop-blur rounded-full px-3 py-1.5 border border-white/10">
              <input readOnly placeholder="Say something..." className="flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-white/30" />
              <Send size={12} className="text-amber-400" />
            </div>
          </div>

          {/* Controls */}
          <div className="px-4 pb-6 pt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-white/10 flex items-center justify-center text-white">
                <Mic size={16} />
              </button>
              <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-white/10 flex items-center justify-center text-white">
                <Video size={16} />
              </button>
            </div>
            <button className="px-5 py-2.5 rounded-full bg-red-500/80 backdrop-blur text-white text-xs font-bold flex items-center gap-1.5">
              <Power size={12} /> End
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VertAction({ icon: Icon, value, color }: any) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/80">
        <Icon size={18} />
      </div>
      {value && <span className="text-[9px] font-bold text-white/70">{value}</span>}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
const LAYOUTS = [
  { id: 'cinematic', name: 'Cinematic Widescreen', desc: 'Video fills the entire screen. All UI floats as overlays — chat, header, controls, action buttons.', component: Layout1_Cinematic },
  { id: 'split-panel', name: 'Split Panel', desc: 'Video on the left, persistent chat sidebar on the right. Header bar on top. Clean and functional.', component: Layout2_SplitPanel },
  { id: 'dashboard', name: 'Dashboard Grid', desc: 'Multi-panel layout — large video + chat panel + stats panel. Great for hosts managing streams.', component: Layout3_Dashboard },
  { id: 'immersive', name: 'Immersive Overlay', desc: 'Full-bleed video with floating action buttons, translucent chat, and coin balance HUD.', component: Layout4_Immersive },
  { id: 'vertical-mobile', name: 'Vertical Mobile-First', desc: 'TikTok-style vertical video with side actions, bottom chat, and compact controls.', component: Layout5_VerticalMobile },
];

export default function BroadcastLayoutPreview() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#06060a] text-white p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Broadcast Layout — 5 Design Options
          </h1>
          <p className="text-slate-400 mt-2">
            These are the overall broadcast page layouts — how video, chat, header, and controls are arranged. Pick your favorite to use as the real StreamLayout.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {LAYOUTS.map(l => {
            const Comp = l.component;
            const isSelected = selected === l.id;
            return (
              <div
                key={l.id}
                className={cn(
                  "rounded-3xl transition-all cursor-pointer group",
                  isSelected
                    ? "ring-2 ring-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.15)]"
                    : "hover:ring-1 hover:ring-white/10"
                )}
                onClick={() => setSelected(l.id)}
              >
                <div className="mb-3 px-1 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      {isSelected && <span className="text-emerald-400 text-xl">✓</span>}
                      {l.name}
                    </h2>
                    <p className="text-xs text-slate-500 max-w-lg">{l.desc}</p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-all shrink-0",
                    isSelected
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : "bg-white/5 border-white/10 text-slate-600"
                  )}>
                    {isSelected ? 'SELECTED' : `#${l.id}`}
                  </span>
                </div>
                <Comp />
              </div>
            );
          })}
        </div>

        {selected && (
          <div className="mt-10 p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
            <p className="text-emerald-300 font-bold text-lg">
              Selected: {LAYOUTS.find(l => l.id === selected)?.name}
            </p>
            <p className="text-emerald-400/60 text-sm mt-1">Click another layout to compare</p>
          </div>
        )}
      </div>
    </div>
  );
}
