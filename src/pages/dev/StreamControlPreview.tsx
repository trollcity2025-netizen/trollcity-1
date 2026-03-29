import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, MessageSquare, MessageSquareOff, Heart, Eye, Power, Share2, Settings2, Plus, Minus, Coins, LayoutGrid, Palette, Package, UserX, ImageIcon, Star, LogOut, Swords, ChevronDown, ChevronUp, GripVertical, X, Zap, MoreHorizontal, Radio, CircleDot, Volume2, Camera, Monitor, Aperture, Layers, Maximize2, Minimize2, RotateCcw, Sliders, Flame, Crown, Shield, Sparkles, Activity, Signal } from 'lucide-react';
import { cn } from '../../lib/utils';

// ═══════════════════════════════════════════════════════════════
// MOCK STREAM STATE
// ═══════════════════════════════════════════════════════════════
function useMockStream() {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [viewers, setViewers] = useState(142);
  const [likes, setLikes] = useState(89);
  const [isStreaming, setIsStreaming] = useState(true);
  const [boxCount, setBoxCount] = useState(1);
  const [rgbOn, setRgbOn] = useState(false);
  const [seatPrice, setSeatPrice] = useState(0);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!isStreaming) return;
    const iv = setInterval(() => {
      setViewers(v => v + Math.floor(Math.random() * 3) - 1);
      setLikes(l => l + (Math.random() > 0.6 ? 1 : 0));
    }, 3000);
    return () => clearInterval(iv);
  }, [isStreaming]);

  return { isMicOn, setIsMicOn, isCamOn, setIsCamOn, chatOpen, setChatOpen, viewers, likes, isStreaming, setIsStreaming, boxCount, setBoxCount, rgbOn, setRgbOn, seatPrice, setSeatPrice, expanded, setExpanded };
}

// ═══════════════════════════════════════════════════════════════
// MOCK VIDEO GRID
// ═══════════════════════════════════════════════════════════════
function MockGrid({ boxCount, rgbOn }: { boxCount: number; rgbOn: boolean }) {
  return (
    <div className={cn(
      "grid gap-2 p-2 h-full",
      boxCount === 1 && "grid-cols-1",
      boxCount === 2 && "grid-cols-2",
      boxCount === 3 && "grid-cols-2",
      boxCount === 4 && "grid-cols-2 grid-rows-2",
      boxCount >= 5 && "grid-cols-3 grid-rows-2",
    )}>
      {Array.from({ length: boxCount }).map((_, i) => (
        <div key={i} className={cn(
          "relative rounded-xl overflow-hidden border",
          i === 0 ? "bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-500/30" : "bg-zinc-900/50 border-white/10",
          rgbOn && i === 0 && "animate-pulse"
        )}>
          <div className="absolute inset-0 flex items-center justify-center">
            {i === 0 ? (
              <div className="text-center">
                <Camera size={32} className="text-purple-400/40 mx-auto mb-2" />
                <p className="text-xs text-purple-300/50">Host Camera</p>
              </div>
            ) : (
              <div className="text-center">
                <Plus size={24} className="text-zinc-600 mx-auto mb-1" />
                <p className="text-[10px] text-zinc-600">Empty Seat</p>
              </div>
            )}
          </div>
          {i === 0 && (
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded-full text-[10px] text-white font-bold border border-white/10">
              HOST
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DESIGN 1: GLASS PILL BAR (Bottom floating pill)
// ═══════════════════════════════════════════════════════════════
function Design1_GlassPillBar() {
  const s = useMockStream();
  return (
    <div className="flex flex-col h-[500px] bg-black rounded-2xl overflow-hidden border border-white/10 relative">
      {/* Mock header */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
          <div>
            <p className="text-xs font-bold text-white">username</p>
            <p className="text-[10px] text-slate-400">General Chat</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full border border-white/10">
            <Eye size={12} className="text-blue-400" />
            <span className="text-xs font-bold text-white">{s.viewers}</span>
          </div>
          <div className="flex items-center gap-1 bg-pink-500/10 px-2 py-1 rounded-full border border-pink-500/20">
            <Heart size={12} className="text-pink-500" />
            <span className="text-xs font-bold text-pink-400">{s.likes}</span>
          </div>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 relative">
        <MockGrid boxCount={s.boxCount} rgbOn={s.rgbOn} />
      </div>

      {/* ─── CONTROLS: Glass Pill Bar ─── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center gap-1 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full px-2 py-1.5 shadow-2xl">
          <PillBtn active={s.isMicOn} onClick={() => s.setIsMicOn(!s.isMicOn)} icon={s.isMicOn ? Mic : MicOff} />
          <PillBtn active={s.isCamOn} onClick={() => s.setIsCamOn(!s.isCamOn)} icon={s.isCamOn ? Video : VideoOff} />
          <PillBtn active={s.chatOpen} onClick={() => s.setChatOpen(!s.chatOpen)} icon={s.chatOpen ? MessageSquare : MessageSquareOff} />
          <PillBtn active={false} onClick={() => {}} icon={Share2} />
          <PillBtn active={s.rgbOn} onClick={() => s.setRgbOn(!s.rgbOn)} icon={Sparkles} />
          <div className="w-px h-6 bg-white/20 mx-1" />
          <PillBtn active={false} onClick={() => s.setBoxCount(Math.max(1, s.boxCount - 1))} icon={Minus} />
          <span className="text-xs font-bold text-white w-5 text-center">{s.boxCount}</span>
          <PillBtn active={false} onClick={() => s.setBoxCount(Math.min(6, s.boxCount + 1))} icon={Plus} />
          <div className="w-px h-6 bg-white/20 mx-1" />
          <button
            onClick={() => s.setIsStreaming(!s.isStreaming)}
            className="px-4 py-1.5 rounded-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <Power size={12} />
            End
          </button>
        </div>
      </div>
    </div>
  );
}

function PillBtn({ active, onClick, icon: Icon }: any) {
  return (
    <button onClick={onClick} className={cn(
      "w-9 h-9 rounded-full flex items-center justify-center transition-all",
      active ? "bg-white/15 text-white" : "text-white/50 hover:text-white hover:bg-white/10"
    )}>
      <Icon size={16} />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// DESIGN 2: VERTICAL SIDEBAR (Right side)
// ═══════════════════════════════════════════════════════════════
function Design2_VerticalSidebar() {
  const s = useMockStream();
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="flex flex-col h-[500px] bg-black rounded-2xl overflow-hidden border border-white/10 relative">
      {/* Mock header */}
      <div className="absolute top-0 left-0 right-14 z-30 p-3 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500" />
          <p className="text-xs font-bold text-white">username</p>
          <span className="bg-red-500/80 text-[9px] font-bold px-1.5 py-0.5 rounded text-white">LIVE</span>
        </div>
        <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full border border-white/10">
          <Eye size={12} className="text-blue-400" />
          <span className="text-xs font-bold text-white">{s.viewers}</span>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 relative">
        <MockGrid boxCount={s.boxCount} rgbOn={s.rgbOn} />
      </div>

      {/* ─── CONTROLS: Vertical Sidebar ─── */}
      <div className="absolute top-0 right-0 bottom-0 w-12 z-40 flex flex-col items-center py-3 gap-1.5 bg-gradient-to-l from-black/80 to-transparent">
        <SideBtn active={s.isMicOn} onClick={() => s.setIsMicOn(!s.isMicOn)} icon={s.isMicOn ? Mic : MicOff} alert={!s.isMicOn} />
        <SideBtn active={s.isCamOn} onClick={() => s.setIsCamOn(!s.isCamOn)} icon={s.isCamOn ? Video : VideoOff} alert={!s.isCamOn} />
        <SideBtn active={s.chatOpen} onClick={() => s.setChatOpen(!s.chatOpen)} icon={s.chatOpen ? MessageSquare : MessageSquareOff} />
        <SideBtn active={false} onClick={() => {}} icon={Share2} />
        <SideBtn active={s.rgbOn} onClick={() => s.setRgbOn(!s.rgbOn)} icon={Palette} />
        <SideBtn active={false} onClick={() => {}} icon={Swords} />

        <div className="flex-1" />

        {/* Box count */}
        <div className="flex flex-col items-center gap-0.5 mb-1">
          <button onClick={() => s.setBoxCount(Math.min(6, s.boxCount + 1))} className="w-8 h-6 rounded bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors">
            <Plus size={12} />
          </button>
          <span className="text-[10px] font-bold text-white">{s.boxCount}</span>
          <button onClick={() => s.setBoxCount(Math.max(1, s.boxCount - 1))} className="w-8 h-6 rounded bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors">
            <Minus size={12} />
          </button>
        </div>

        <SideBtn active={false} onClick={() => setShowMore(!showMore)} icon={MoreHorizontal} />

        {/* End stream */}
        <button
          onClick={() => s.setIsStreaming(!s.isStreaming)}
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-500 flex items-center justify-center text-white hover:from-red-500 hover:to-red-400 transition-all shadow-lg shadow-red-500/20"
        >
          <Power size={14} />
        </button>
      </div>

      {/* More panel */}
      {showMore && (
        <div className="absolute right-14 top-1/2 -translate-y-1/2 z-50 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl space-y-2 w-40">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stream Settings</p>
          <button onClick={() => s.setRgbOn(!s.rgbOn)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs text-white">
            <Palette size={14} className="text-purple-400" /> RGB Effect {s.rgbOn ? 'ON' : 'OFF'}
          </button>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs text-white">
            <Coins size={14} className="text-amber-400" /> Seat Price
          </button>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs text-white">
            <Package size={14} className="text-blue-400" /> Pin Product
          </button>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs text-white">
            <UserX size={14} className="text-red-400" /> Banned Users
          </button>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs text-white">
            <ImageIcon size={14} className="text-green-400" /> Themes
          </button>
        </div>
      )}
    </div>
  );
}

function SideBtn({ active, onClick, icon: Icon, alert }: any) {
  return (
    <button onClick={onClick} className={cn(
      "w-9 h-9 rounded-xl flex items-center justify-center transition-all relative",
      active ? "bg-white/15 text-white" : "text-white/50 hover:text-white hover:bg-white/10"
    )}>
      <Icon size={16} />
      {alert && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-black" />}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// DESIGN 3: EXPANDABLE COMMAND STRIP
// ═══════════════════════════════════════════════════════════════
function Design3_CommandStrip() {
  const s = useMockStream();
  const [section, setSection] = useState<'main' | 'boxes' | 'settings' | null>('main');

  return (
    <div className="flex flex-col h-[500px] bg-black rounded-2xl overflow-hidden border border-white/10 relative">
      {/* Mock header */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500" />
          <p className="text-xs font-bold text-white">username</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">● LIVE</span>
          <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full border border-white/10">
            <Eye size={12} className="text-blue-400" />
            <span className="text-xs font-bold text-white">{s.viewers}</span>
          </div>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 relative">
        <MockGrid boxCount={s.boxCount} rgbOn={s.rgbOn} />
      </div>

      {/* ─── CONTROLS: Command Strip ─── */}
      <div className="absolute bottom-4 left-4 right-4 z-40 space-y-2">
        {/* Expandable section */}
        {section === 'boxes' && (
          <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Box Layout</span>
              <button onClick={() => setSection('main')} className="text-slate-500 hover:text-white"><X size={14} /></button>
            </div>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => s.setBoxCount(Math.max(1, s.boxCount - 1))} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-red-500/20 flex items-center justify-center text-white transition-all">
                <Minus size={18} />
              </button>
              <div className="flex gap-1.5">
                {[1,2,3,4,5,6].map(n => (
                  <button key={n} onClick={() => s.setBoxCount(n)} className={cn(
                    "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                    s.boxCount === n ? "bg-amber-500/20 border border-amber-500/40 text-amber-400" : "bg-white/5 border border-white/10 text-slate-500 hover:text-white"
                  )}>{n}</button>
                ))}
              </div>
              <button onClick={() => s.setBoxCount(Math.min(6, s.boxCount + 1))} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-emerald-500/20 flex items-center justify-center text-white transition-all">
                <Plus size={18} />
              </button>
            </div>
          </div>
        )}

        {section === 'settings' && (
          <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Stream Settings</span>
              <button onClick={() => setSection('main')} className="text-slate-500 hover:text-white"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <SettingToggle label="RGB Effect" active={s.rgbOn} onClick={() => s.setRgbOn(!s.rgbOn)} icon={Palette} color="purple" />
              <SettingToggle label="Seat Price" active={s.seatPrice > 0} onClick={() => s.setSeatPrice(s.seatPrice > 0 ? 0 : 100)} icon={Coins} color="amber" />
              <SettingToggle label="Pin Product" active={false} onClick={() => {}} icon={Package} color="blue" />
            </div>
          </div>
        )}

        {/* Main strip */}
        <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-2 shadow-2xl">
          <div className="flex items-center justify-between">
            {/* Left: Media controls */}
            <div className="flex items-center gap-1">
              <StripBtn active={s.isMicOn} onClick={() => s.setIsMicOn(!s.isMicOn)} icon={s.isMicOn ? Mic : MicOff} color={s.isMicOn ? "white" : "red"} />
              <StripBtn active={s.isCamOn} onClick={() => s.setIsCamOn(!s.isCamOn)} icon={s.isCamOn ? Video : VideoOff} color={s.isCamOn ? "white" : "red"} />
              <StripBtn active={s.chatOpen} onClick={() => s.setChatOpen(!s.chatOpen)} icon={s.chatOpen ? MessageSquare : MessageSquareOff} color="white" />
            </div>

            {/* Center: Expandable sections */}
            <div className="flex items-center gap-1">
              <button onClick={() => setSection(section === 'boxes' ? null : 'boxes')} className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
                section === 'boxes' ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-slate-400 hover:text-white hover:bg-white/10"
              )}>
                <LayoutGrid size={12} /> Boxes
              </button>
              <button onClick={() => setSection(section === 'settings' ? null : 'settings')} className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
                section === 'settings' ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "text-slate-400 hover:text-white hover:bg-white/10"
              )}>
                <Sliders size={12} /> Settings
              </button>
            </div>

            {/* Right: End stream */}
            <button
              onClick={() => s.setIsStreaming(!s.isStreaming)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-red-500/20"
            >
              <Power size={12} />
              End
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StripBtn({ active, onClick, icon: Icon, color }: any) {
  return (
    <button onClick={onClick} className={cn(
      "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
      !active && color === "red" ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white hover:bg-white/20"
    )}>
      <Icon size={16} />
    </button>
  );
}

function SettingToggle({ label, active, onClick, icon: Icon, color }: any) {
  return (
    <button onClick={onClick} className={cn(
      "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all",
      active ? `bg-${color}-500/10 border-${color}-500/30 text-${color}-400` : "bg-white/5 border-white/10 text-slate-500 hover:text-white"
    )}>
      <Icon size={20} />
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// DESIGN 4: MINIMAL FLOATING ORBS
// ═══════════════════════════════════════════════════════════════
function Design4_FloatingOrbs() {
  const s = useMockStream();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex flex-col h-[500px] bg-black rounded-2xl overflow-hidden border border-white/10 relative">
      {/* Mock header */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-500" />
          <div>
            <p className="text-xs font-bold text-white">username</p>
            <p className="text-[10px] text-pink-400">LIVE</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full border border-white/10">
            <Eye size={12} className="text-blue-400" />
            <span className="text-xs font-bold text-white">{s.viewers}</span>
          </div>
          <div className="flex items-center gap-1 bg-pink-500/10 px-2 py-1 rounded-full border border-pink-500/20">
            <Heart size={12} className="text-pink-500 fill-pink-500" />
            <span className="text-xs font-bold text-pink-400">{s.likes}</span>
          </div>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 relative">
        <MockGrid boxCount={s.boxCount} rgbOn={s.rgbOn} />
      </div>

      {/* ─── CONTROLS: Floating Orbs ─── */}
      {/* Main action orbs - bottom center */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3">
        <OrbBtn active={s.isMicOn} onClick={() => s.setIsMicOn(!s.isMicOn)} icon={s.isMicOn ? Mic : MicOff} label="Mic" glow={!s.isMicOn ? "red" : undefined} size="sm" />
        <OrbBtn active={s.isCamOn} onClick={() => s.setIsCamOn(!s.isCamOn)} icon={s.isCamOn ? Video : VideoOff} label="Cam" glow={!s.isCamOn ? "red" : undefined} size="sm" />

        {/* Center: End stream - largest orb */}
        <OrbBtn active={false} onClick={() => s.setIsStreaming(!s.isStreaming)} icon={Power} label="End" glow="red" size="lg" />

        <OrbBtn active={s.chatOpen} onClick={() => s.setChatOpen(!s.chatOpen)} icon={s.chatOpen ? MessageSquare : MessageSquareOff} label="Chat" size="sm" />
        <OrbBtn active={menuOpen} onClick={() => setMenuOpen(!menuOpen)} icon={Sliders} label="More" size="sm" />
      </div>

      {/* Side orbs - quick actions */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
        <SideOrb onClick={() => s.setBoxCount(Math.min(6, s.boxCount + 1))} icon={Plus} color="emerald" />
        <SideOrb onClick={() => s.setBoxCount(Math.max(1, s.boxCount - 1))} icon={Minus} color="red" />
        <SideOrb onClick={() => s.setRgbOn(!s.rgbOn)} icon={Palette} color="purple" active={s.rgbOn} />
      </div>

      {/* Expandable menu */}
      {menuOpen && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl">
          <div className="grid grid-cols-4 gap-2 w-64">
            <MenuOrb icon={Share2} label="Share" onClick={() => {}} />
            <MenuOrb icon={Swords} label="Battle" onClick={() => {}} />
            <MenuOrb icon={Package} label="Product" onClick={() => {}} />
            <MenuOrb icon={ImageIcon} label="Theme" onClick={() => {}} />
            <MenuOrb icon={UserX} label="Banned" onClick={() => {}} />
            <MenuOrb icon={Star} label="Feature" onClick={() => {}} />
            <MenuOrb icon={Coins} label="Price" onClick={() => {}} />
            <MenuOrb icon={Shield} label="Protect" onClick={() => {}} />
          </div>
        </div>
      )}
    </div>
  );
}

function OrbBtn({ active, onClick, icon: Icon, label, glow, size }: any) {
  const isLg = size === 'lg';
  return (
    <div className="flex flex-col items-center gap-1">
      <button onClick={onClick} className={cn(
        "rounded-full flex items-center justify-center transition-all backdrop-blur-xl border",
        isLg ? "w-14 h-14" : "w-11 h-11",
        glow === "red"
          ? "bg-red-500/20 border-red-500/40 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
          : active
            ? "bg-white/15 border-white/25 text-white shadow-lg"
            : "bg-black/40 border-white/10 text-white/50 hover:text-white hover:bg-white/10"
      )}>
        <Icon size={isLg ? 20 : 16} />
      </button>
      <span className="text-[8px] text-slate-500 font-medium">{label}</span>
    </div>
  );
}

function SideOrb({ onClick, icon: Icon, color, active }: any) {
  return (
    <button onClick={onClick} className={cn(
      "w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all",
      active ? `bg-${color}-500/20 border-${color}-500/40 text-${color}-400` : "bg-black/40 border-white/10 text-white/50 hover:text-white"
    )}>
      <Icon size={14} />
    </button>
  );
}

function MenuOrb({ icon: Icon, label, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/10 transition-all">
      <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/70">
        <Icon size={16} />
      </div>
      <span className="text-[8px] text-slate-400">{label}</span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// DESIGN 5: NEON STATUS BAR
// ═══════════════════════════════════════════════════════════════
function Design5_NeonStatusBar() {
  const s = useMockStream();
  return (
    <div className="flex flex-col h-[500px] bg-[#080810] rounded-2xl overflow-hidden border border-violet-500/15 relative">
      {/* Scan lines */}
      <div className="absolute inset-0 pointer-events-none z-10 opacity-10"
        style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(139,92,246,0.05) 3px, rgba(139,92,246,0.05) 4px)' }} />

      {/* Mock header */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Crown size={14} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">username</p>
            <p className="text-[10px] text-violet-400 font-mono">STREAM-001</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-lg">
            <CircleDot size={10} className="text-red-400 animate-pulse" />
            <span className="text-[10px] font-bold text-red-400">LIVE</span>
          </div>
          <div className="flex items-center gap-1 bg-black/40 border border-violet-500/15 px-2.5 py-1 rounded-lg">
            <Eye size={12} className="text-violet-400" />
            <span className="text-xs font-bold text-white font-mono">{s.viewers}</span>
          </div>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 relative">
        <MockGrid boxCount={s.boxCount} rgbOn={s.rgbOn} />
      </div>

      {/* ─── CONTROLS: Neon Status Bar ─── */}
      <div className="absolute bottom-0 left-0 right-0 z-40">
        {/* Status strip */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-violet-500/5 border-t border-violet-500/10">
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono text-violet-400/60 flex items-center gap-1"><Activity size={9} /> 60FPS</span>
            <span className="text-[9px] font-mono text-violet-400/60 flex items-center gap-1"><Signal size={9} /> 4500kbps</span>
            <span className="text-[9px] font-mono text-violet-400/60">1080p</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono text-pink-400/60 flex items-center gap-1"><Heart size={9} /> {s.likes}</span>
            <span className="text-[9px] font-mono text-violet-400/60">BOX-{s.boxCount}</span>
          </div>
        </div>

        {/* Main controls */}
        <div className="px-3 py-2.5 bg-gradient-to-t from-[#0a0815] via-[#0a0815]/95 to-transparent">
          <div className="flex items-center justify-between">
            {/* Left: Primary controls */}
            <div className="flex items-center gap-1.5">
              <NeonBtn active={s.isMicOn} onClick={() => s.setIsMicOn(!s.isMicOn)} icon={s.isMicOn ? Mic : MicOff} />
              <NeonBtn active={s.isCamOn} onClick={() => s.setIsCamOn(!s.isCamOn)} icon={s.isCamOn ? Video : VideoOff} />
              <NeonBtn active={false} onClick={() => {}} icon={Monitor} />
              <NeonBtn active={s.rgbOn} onClick={() => s.setRgbOn(!s.rgbOn)} icon={Sparkles} />
            </div>

            {/* Center: Box controls */}
            <div className="flex items-center gap-1 bg-black/40 border border-violet-500/15 rounded-xl px-1.5 py-1">
              <button onClick={() => s.setBoxCount(Math.max(1, s.boxCount - 1))} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all">
                <Minus size={12} />
              </button>
              <div className="w-8 text-center">
                <span className="text-sm font-black text-violet-400">{s.boxCount}</span>
              </div>
              <button onClick={() => s.setBoxCount(Math.min(6, s.boxCount + 1))} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all">
                <Plus size={12} />
              </button>
            </div>

            {/* Right: Chat + End */}
            <div className="flex items-center gap-1.5">
              <NeonBtn active={s.chatOpen} onClick={() => s.setChatOpen(!s.chatOpen)} icon={s.chatOpen ? MessageSquare : MessageSquareOff} />
              <NeonBtn active={false} onClick={() => {}} icon={Share2} />
              <button
                onClick={() => s.setIsStreaming(!s.isStreaming)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(239,68,68,0.3)]"
              >
                <Power size={12} />
                End
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NeonBtn({ active, onClick, icon: Icon }: any) {
  return (
    <button onClick={onClick} className={cn(
      "w-10 h-10 rounded-xl flex items-center justify-center transition-all border",
      active
        ? "bg-violet-500/10 border-violet-500/25 text-violet-300 hover:bg-violet-500/20"
        : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10"
    )}>
      <Icon size={16} />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
const DESIGNS = [
  { id: 'glass-pill', name: 'Glass Pill Bar', desc: 'Floating translucent pill at bottom center. Compact, modern, TikTok-inspired.', component: Design1_GlassPillBar },
  { id: 'vertical-sidebar', name: 'Vertical Sidebar', desc: 'Right-side vertical icon strip. Always visible, expandable more menu.', component: Design2_VerticalSidebar },
  { id: 'command-strip', name: 'Command Strip', desc: 'Expandable bottom bar with collapsible sub-panels for boxes & settings.', component: Design3_CommandStrip },
  { id: 'floating-orbs', name: 'Floating Orbs', desc: 'Circular floating buttons with glow effects. Side quick-actions.', component: Design4_FloatingOrbs },
  { id: 'neon-status-bar', name: 'Neon Status Bar', desc: 'Full-width bar with data strip + controls. Cyberpunk aesthetic.', component: Design5_NeonStatusBar },
];

export default function StreamControlPreview() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#06060a] text-white p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
            Broadcast Controls — 5 Design Options
          </h1>
          <p className="text-slate-400 mt-2">
            These are the in-broadcast stream controls (mic, cam, boxes, settings, end stream). Pick your favorite to use as the real BroadcastControls.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {DESIGNS.map(d => {
            const Comp = d.component;
            const isSelected = selected === d.id;
            return (
              <div
                key={d.id}
                className={cn(
                  "rounded-3xl transition-all cursor-pointer group",
                  isSelected
                    ? "ring-2 ring-violet-500 shadow-[0_0_40px_rgba(139,92,246,0.15)]"
                    : "hover:ring-1 hover:ring-white/10"
                )}
                onClick={() => setSelected(d.id)}
              >
                <div className="mb-3 px-1 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      {isSelected && <span className="text-violet-400 text-xl">✓</span>}
                      {d.name}
                    </h2>
                    <p className="text-xs text-slate-500 max-w-md">{d.desc}</p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-all",
                    isSelected
                      ? "bg-violet-500/15 border-violet-500/30 text-violet-400"
                      : "bg-white/5 border-white/10 text-slate-600"
                  )}>
                    {isSelected ? 'SELECTED' : `#${d.id}`}
                  </span>
                </div>
                <Comp />
              </div>
            );
          })}
        </div>

        {selected && (
          <div className="mt-10 p-5 bg-violet-500/10 border border-violet-500/20 rounded-2xl text-center">
            <p className="text-violet-300 font-bold text-lg">
              Selected: {DESIGNS.find(d => d.id === selected)?.name}
            </p>
            <p className="text-violet-400/60 text-sm mt-1">Click another design to compare</p>
          </div>
        )}
      </div>
    </div>
  );
}
