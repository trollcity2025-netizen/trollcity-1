import React, { useState } from 'react';
import { Video, VideoOff, Mic, MicOff, RefreshCw, Swords, Gamepad2, Monitor, Lock, Eye, EyeOff, Radio, Sparkles, Zap, ChevronRight, Settings2, Globe, Crown, Shield, Flame, LayoutGrid, Columns, Rows, Square, Maximize2, ArrowRight, Layers } from 'lucide-react';
import { cn } from '../../lib/utils';

// ═══════════════════════════════════════════════════════════════
// MOCK STATE
// ═══════════════════════════════════════════════════════════════
function useMockSetup() {
  const [title, setTitle] = useState("TrollFan99's Live");
  const [category, setCategory] = useState('general');
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isProtected, setIsProtected] = useState(false);
  const [battleEnabled, setBattleEnabled] = useState(false);
  return { title, setTitle, category, setCategory, isVideoOn, setIsVideoOn, isMicOn, setIsMicOn, isProtected, setIsProtected, battleEnabled, setBattleEnabled };
}

function MockCameraPreview({ gradient = "from-purple-900/40 via-indigo-900/30 to-blue-900/40", className }: { gradient?: string; className?: string }) {
  return (
    <div className={cn(`bg-gradient-to-br ${gradient} relative flex items-center justify-center overflow-hidden`, className)}>
      <div className="text-center">
        <Video size={32} className="text-white/20 mx-auto mb-2" />
        <p className="text-xs text-white/25 font-medium">Camera Preview</p>
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.4)_100%)]" />
    </div>
  );
}

function MockForm({ compact = false }: { compact?: boolean }) {
  const s = useMockSetup();
  if (compact) {
    return (
      <div className="space-y-2">
        <input readOnly value={s.title} onChange={() => {}} placeholder="Stream title" className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white placeholder:text-gray-600" />
        <select value={s.category} onChange={() => {}} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-gray-300">
          <option>💬 General Chat</option>
          <option>🎮 Gaming</option>
          <option>📍 IRL</option>
        </select>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[10px] font-medium text-gray-400 mb-1">Stream Title</label>
        <input readOnly value={s.title} onChange={() => {}} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-600" />
      </div>
      <div>
        <label className="block text-[10px] font-medium text-gray-400 mb-1">Category</label>
        <select value={s.category} onChange={() => {}} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300">
          <option>💬 General Chat</option>
          <option>🎮 Gaming</option>
          <option>📍 IRL / Lifestyle</option>
          <option>⚖️ Debate</option>
          <option>📚 Education</option>
          <option>💪 Fitness</option>
        </select>
      </div>
    </div>
  );
}

function MockMediaControls({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const s = useMockSetup();
  const btnSize = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const iconSize = size === 'sm' ? 14 : 18;
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => s.setIsVideoOn(!s.isVideoOn)} className={cn(btnSize, "rounded-full flex items-center justify-center transition-all", s.isVideoOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500/80 hover:bg-red-600 text-white")}>
        {s.isVideoOn ? <Video size={iconSize} /> : <VideoOff size={iconSize} />}
      </button>
      <button onClick={() => s.setIsMicOn(!s.isMicOn)} className={cn(btnSize, "rounded-full flex items-center justify-center transition-all", s.isMicOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500/80 hover:bg-red-600 text-white")}>
        {s.isMicOn ? <Mic size={iconSize} /> : <MicOff size={iconSize} />}
      </button>
      <button className={cn(btnSize, "rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-all")}>
        <RefreshCw size={iconSize} />
      </button>
    </div>
  );
}

function StartBtn({ label = "Start Broadcast", variant = "default" }: { label?: string; variant?: "default" | "pill" | "wide" }) {
  if (variant === "pill") {
    return (
      <button className="px-6 py-2.5 rounded-full bg-gradient-to-r from-yellow-400 to-amber-600 text-black font-bold text-xs shadow-lg shadow-yellow-500/20 hover:from-yellow-300 hover:to-amber-500 transition-all">
        <Radio size={12} className="inline mr-1.5 -mt-0.5" />
        {label}
      </button>
    );
  }
  if (variant === "wide") {
    return (
      <button className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-600 text-black font-bold text-sm shadow-lg shadow-yellow-500/20 hover:from-yellow-300 hover:to-amber-500 transition-all flex items-center justify-center gap-2">
        <Radio size={16} />
        {label}
      </button>
    );
  }
  return (
    <button className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-600 text-black font-bold text-sm shadow-lg shadow-yellow-500/20 hover:from-yellow-300 hover:to-amber-500 transition-all">
      <Radio size={14} className="inline mr-1.5 -mt-0.5" />
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// DESIGN 1: SPLIT VIEW (Camera Left, Form Right)
// ═══════════════════════════════════════════════════════════════
function Design1_SplitView() {
  return (
    <div className="h-[500px] bg-slate-950 rounded-2xl overflow-hidden border border-white/10 flex flex-col md:flex-row">
      {/* Left: Camera Preview */}
      <div className="flex-1 relative min-h-[200px]">
        <MockCameraPreview className="absolute inset-0 rounded-none" gradient="from-violet-900/40 via-indigo-900/30 to-slate-900/50" />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <MockMediaControls />
        </div>
        <div className="absolute top-3 left-3 bg-black/40 backdrop-blur px-2.5 py-1 rounded-full text-[9px] text-white/60 font-medium border border-white/10 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" /> Preview
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 p-5 bg-slate-900/50 border-l border-white/5 flex flex-col justify-between">
        <div>
          <h2 className="text-lg font-bold text-white mb-1">Go Live</h2>
          <p className="text-[10px] text-gray-400 mb-4">Set up your broadcast details</p>
          <MockForm />
        </div>
        <StartBtn />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DESIGN 2: STACKED CENTER (Camera Top, Form Below)
// ═══════════════════════════════════════════════════════════════
function Design2_StackedCenter() {
  return (
    <div className="h-[500px] bg-[#0a0a12] rounded-2xl overflow-hidden border border-white/10 flex flex-col">
      {/* Top: Camera Preview (larger) */}
      <div className="flex-[1.3] relative">
        <MockCameraPreview className="absolute inset-0 rounded-none" gradient="from-emerald-900/30 via-teal-900/20 to-[#0a0a12]" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Radio size={14} className="text-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-white">Camera Preview</p>
            <p className="text-[8px] text-emerald-400">1080p • 60FPS</p>
          </div>
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md rounded-full px-4 py-2 border border-white/10">
          <MockMediaControls />
        </div>
      </div>

      {/* Bottom: Form (centered, narrow) */}
      <div className="flex-1 p-5 flex flex-col items-center justify-center">
        <div className="w-full max-w-sm space-y-3">
          <h2 className="text-center text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Go Live</h2>
          <MockForm />
          <StartBtn />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DESIGN 3: IMMERSIVE FULLSCREEN (Camera BG, Form Overlay)
// ═══════════════════════════════════════════════════════════════
function Design3_Immersive() {
  return (
    <div className="relative h-[500px] bg-black rounded-2xl overflow-hidden border border-white/10">
      {/* Full camera background */}
      <MockCameraPreview className="absolute inset-0 rounded-none" gradient="from-rose-900/30 via-pink-900/20 to-black" />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

      {/* Top: Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl rounded-full px-3 py-1.5 border border-white/10">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-500 to-orange-500" />
          <span className="text-xs font-bold text-white">Setup</span>
        </div>
        <div className="bg-black/40 backdrop-blur-xl rounded-full px-3 py-1.5 border border-white/10 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
          <span className="text-[9px] text-rose-300 font-medium">PREVIEW</span>
        </div>
      </div>

      {/* Bottom: Floating form card */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4">
        <div className="bg-black/60 backdrop-blur-2xl rounded-2xl border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Go Live</h2>
            <MockMediaControls size="sm" />
          </div>
          <MockForm />
          <StartBtn />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DESIGN 4: WIZARD STEPS (Step-by-step flow)
// ═══════════════════════════════════════════════════════════════
function Design4_Wizard() {
  const [step, setStep] = useState(1);
  return (
    <div className="h-[500px] bg-[#0c0c14] rounded-2xl overflow-hidden border border-white/10 flex flex-col">
      {/* Step indicator */}
      <div className="shrink-0 px-5 py-3 bg-[#111118] border-b border-white/5 flex items-center gap-3">
        {[1, 2, 3].map(s => (
          <button key={s} onClick={() => setStep(s)} className="flex items-center gap-2">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
              step === s ? "bg-amber-500 text-black" : step > s ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/5 text-slate-600 border border-white/10"
            )}>
              {step > s ? '✓' : s}
            </div>
            <span className={cn("text-[10px] font-medium", step === s ? "text-white" : "text-slate-500")}>
              {s === 1 ? 'Camera' : s === 2 ? 'Details' : 'Go Live'}
            </span>
            {s < 3 && <ChevronRight size={12} className="text-slate-700" />}
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 p-5 flex flex-col justify-center">
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">Set up your camera</h3>
            <div className="aspect-video rounded-xl overflow-hidden relative">
              <MockCameraPreview className="absolute inset-0" gradient="from-amber-900/30 via-orange-900/20 to-[#0c0c14]" />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <MockMediaControls />
              </div>
            </div>
            <button onClick={() => setStep(2)} className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all border border-white/10">
              Next <ArrowRight size={12} />
            </button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">Stream details</h3>
            <MockForm />
            <button onClick={() => setStep(3)} className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all border border-white/10">
              Next <ArrowRight size={12} />
            </button>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center mx-auto">
              <Radio size={28} className="text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Ready to go live!</h3>
            <p className="text-[10px] text-gray-400 max-w-xs mx-auto">Your camera is set up and your stream details are configured. Hit the button below to start broadcasting.</p>
            <StartBtn />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DESIGN 5: DASHBOARD CARDS (Modular card layout)
// ═══════════════════════════════════════════════════════════════
function Design5_DashboardCards() {
  const s = useMockSetup();
  return (
    <div className="h-[500px] bg-[#08080f] rounded-2xl overflow-hidden border border-white/10 p-3 flex flex-col gap-3">
      {/* Top row: Camera + Quick Stats */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Camera card */}
        <div className="flex-[2] relative rounded-xl overflow-hidden border border-white/10">
          <MockCameraPreview className="absolute inset-0" gradient="from-indigo-900/30 via-violet-900/20 to-[#08080f]" />
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded-full text-[9px] text-white font-bold border border-white/10 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" /> PREVIEW
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <MockMediaControls size="sm" />
          </div>
        </div>

        {/* Quick settings cards */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex-1 bg-zinc-900/80 rounded-xl border border-white/10 p-3 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-2">
              <Swords size={11} className="text-orange-400" />
              <span className="text-[9px] font-bold text-slate-400 uppercase">Battle</span>
            </div>
            <button onClick={() => s.setBattleEnabled(!s.battleEnabled)} className={cn(
              "w-full py-1.5 rounded-lg text-[9px] font-bold transition-all border",
              s.battleEnabled ? "bg-orange-500/15 border-orange-500/30 text-orange-400" : "bg-white/5 border-white/10 text-slate-500"
            )}>
              {s.battleEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="flex-1 bg-zinc-900/80 rounded-xl border border-white/10 p-3 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-2">
              <Lock size={11} className="text-purple-400" />
              <span className="text-[9px] font-bold text-slate-400 uppercase">Lock</span>
            </div>
            <button onClick={() => s.setIsProtected(!s.isProtected)} className={cn(
              "w-full py-1.5 rounded-lg text-[9px] font-bold transition-all border",
              s.isProtected ? "bg-purple-500/15 border-purple-500/30 text-purple-400" : "bg-white/5 border-white/10 text-slate-500"
            )}>
              {s.isProtected ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row: Form + Go Live */}
      <div className="flex gap-3">
        <div className="flex-1">
          <MockForm compact />
        </div>
        <div className="flex items-end">
          <StartBtn label="Go Live" variant="pill" />
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
const DESIGNS = [
  { id: 'split-view', name: 'Split View', desc: 'Camera preview left, form right. Classic two-column. Familiar and clean.', component: Design1_SplitView },
  { id: 'stacked-center', name: 'Stacked Center', desc: 'Large camera preview on top, centered form below. Focused and simple.', component: Design2_StackedCenter },
  { id: 'immersive', name: 'Immersive Overlay', desc: 'Camera fills entire screen. Form floats as glass card on top. Modern and bold.', component: Design3_Immersive },
  { id: 'wizard', name: 'Wizard Steps', desc: 'Step-by-step flow: Camera → Details → Go Live. Guided experience for new users.', component: Design4_Wizard },
  { id: 'dashboard-cards', name: 'Dashboard Cards', desc: 'Modular card grid — camera, quick toggles, form, go live. Compact and scannable.', component: Design5_DashboardCards },
];

export default function SetupPreview() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#06060a] text-white p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 bg-clip-text text-transparent">
            Setup Page — 5 Design Options
          </h1>
          <p className="text-slate-400 mt-2">
            These are the broadcast setup page layouts — camera preview, stream title, category, battle/lock toggles, and the Start Broadcast button. Pick your favorite.
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
                    ? "ring-2 ring-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.15)]"
                    : "hover:ring-1 hover:ring-white/10"
                )}
                onClick={() => setSelected(d.id)}
              >
                <div className="mb-3 px-1 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      {isSelected && <span className="text-amber-400 text-xl">✓</span>}
                      {d.name}
                    </h2>
                    <p className="text-xs text-slate-500 max-w-md">{d.desc}</p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-all",
                    isSelected
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
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
          <div className="mt-10 p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center">
            <p className="text-amber-300 font-bold text-lg">
              Selected: {DESIGNS.find(d => d.id === selected)?.name}
            </p>
            <p className="text-amber-400/60 text-sm mt-1">Click another design to compare</p>
          </div>
        )}
      </div>
    </div>
  );
}
