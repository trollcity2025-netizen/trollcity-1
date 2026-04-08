import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, MessageSquare, Video, User, Settings, Compass, Store, Trophy, Bell, Search, Menu, X, ChevronLeft, Plus, Heart, Send, Users, Sparkles, Crown, Wallet, Shield, Globe, Play, Grid3X3, List, MapPin, Building2, Warehouse, Package, Coins, TrendingUp, Scale, BookOpen, Lock, LifeBuoy, ShoppingBag, Banknote, Mic, Radio, Waves, Gamepad2, FileText, Calendar, DollarSign, Star, AlertTriangle, Eye, Siren, ClipboardList, BarChart3, MonitorDot, ScrollText, Megaphone, Database, LogOut } from 'lucide-react';
import { useAuthStore } from '@/lib/store';

type LayoutVariant = 1 | 2 | 3 | 4 | 5;

const LAYOUTS: { id: LayoutVariant; name: string; description: string }[] = [
  { id: 1, name: 'Classic Bottom Nav', description: 'Traditional tab bar at bottom with floating menu bubble' },
  { id: 2, name: 'Full Screen Gesture', description: 'Swipe-friendly with minimal chrome, gesture-based navigation' },
  { id: 3, name: 'Drawer + Quick Actions', description: 'Left drawer with floating action buttons' },
  { id: 4, name: 'Tab Bar Hybrid', description: 'Fixed tabs with expandable quick settings' },
  { id: 5, name: 'Premium Floating', description: 'Draggable floating dock, glassmorphism effects' },
];

function MockHeader({ variant, showSearch = true }: { variant: LayoutVariant; showSearch?: boolean }) {
  const [searchOpen, setSearchOpen] = useState(false);
  
  if (variant === 2) {
    return (
      <div className="h-14 bg-black/20 backdrop-blur-xl flex items-center justify-between px-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center">
            <Crown size={18} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Troll City</p>
            <p className="text-[10px] text-white/50">Live: 2.4K viewers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <Bell size={18} className="text-white" />
          </button>
          <button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <Wallet size={18} className="text-green-400" />
          </button>
        </div>
      </div>
    );
  }
  
  if (variant === 3) {
    return (
      <div className="h-16 bg-gradient-to-r from-slate-950 via-purple-950/30 to-slate-950 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Menu size={20} className="text-white" />
          </button>
          <div>
            <p className="text-sm font-bold text-white">Troll City</p>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {[1,2,3].map(i => (
              <div key={i} className={`w-7 h-7 rounded-full border-2 border-slate-950 bg-gradient-to-br from-purple-${500 + i*100} to-pink-${500 + i*100}`} />
            ))}
          </div>
          <button className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center">
            <Wallet size={16} className="text-black" />
          </button>
        </div>
      </div>
    );
  }
  
  if (variant === 4) {
    return (
      <div className="h-14 bg-slate-950 flex items-center px-2 border-b border-white/10">
        <button className="p-3 text-white/70">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-lg px-3 mx-2">
          <Search size={16} className="text-white/40" />
          <input placeholder="Search Troll City..." className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30" />
        </div>
        <button className="p-3 text-white/70">
          <Bell size={20} />
        </button>
      </div>
    );
  }
  
  if (variant === 5) {
    return (
      <div className="h-20 bg-black/60 backdrop-blur-2xl flex items-end justify-between px-4 pb-2 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Crown size={24} className="text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-white">Troll City</p>
            <p className="text-[10px] text-purple-400 font-medium">PREMIUM</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Bell size={18} className="text-white" />
          </button>
          <button className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
            <Wallet size={18} className="text-white" />
          </button>
        </div>
      </div>
    );
  }
  
  // Default (variant 1)
  return (
    <div className="h-14 bg-slate-950 flex items-center justify-between px-4 border-b border-white/10">
      {showSearch ? (
        <div className="flex-1 flex items-center gap-3">
          <button className="p-2 text-white/70">
            <Menu size={20} />
          </button>
          <div className="flex-1 flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
            <Search size={16} className="text-white/50" />
            <input placeholder="Search..." className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40" />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-600 flex items-center justify-center">
            <Crown size={18} className="text-white" />
          </div>
          <span className="text-white font-bold">Troll City</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button className="p-2 text-white/70">
          <Bell size={20} />
        </button>
        <button className="p-2 text-white/70">
          <User size={20} />
        </button>
      </div>
    </div>
  );
}

function MockBottomNav({ variant }: { variant: LayoutVariant }) {
  if (variant === 2) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-black/80 backdrop-blur-2xl flex items-center justify-around border-t border-white/10 z-50">
        <button className="flex-1 flex flex-col items-center gap-1 py-3 text-purple-400">
          <Home size={22} />
          <span className="text-[9px] font-medium">Home</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 py-3 text-white/50">
          <Compass size={22} />
          <span className="text-[9px] font-medium">Explore</span>
        </button>
        <button className="w-14 h-14 -mt-8 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/50">
          <Plus size={28} className="text-white" />
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 py-3 text-white/50">
          <Trophy size={22} />
          <span className="text-[9px] font-medium">Scores</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 py-3 text-white/50">
          <User size={22} />
          <span className="text-[9px] font-medium">Profile</span>
        </button>
      </div>
    );
  }
  
  if (variant === 3) {
    return null;
  }
  
  if (variant === 4) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-14 bg-slate-950 flex items-center justify-around border-t border-white/10 z-50">
        <button className="flex-1 flex flex-col items-center gap-0.5 py-3 text-purple-400">
          <Home size={20} />
        </button>
        <button className="flex-1 flex flex-col items-center gap-0.5 py-3 text-white/50">
          <Compass size={20} />
        </button>
        <button className="flex-1 flex flex-col items-center gap-0.5 py-3 text-white/50">
          <Store size={20} />
        </button>
        <button className="flex-1 flex flex-col items-center gap-0.5 py-3 text-white/50">
          <Trophy size={20} />
        </button>
        <button className="flex-1 flex flex-col items-center gap-0.5 py-3 text-white/50">
          <User size={20} />
        </button>
      </div>
    );
  }
  
  if (variant === 5) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 h-16 bg-white/10 backdrop-blur-2xl rounded-full flex items-center justify-around px-4 border border-white/20 shadow-2xl z-50">
        <button className="p-3 text-purple-400">
          <Home size={22} />
        </button>
        <button className="p-3 text-white/50">
          <Compass size={22} />
        </button>
        <button className="w-12 h-12 -mt-8 rounded-full bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-500 flex items-center justify-center shadow-lg shadow-purple-500/50 border-4 border-black">
          <Plus size={24} className="text-white" />
        </button>
        <button className="p-3 text-white/50">
          <Trophy size={22} />
        </button>
        <button className="p-3 text-white/50">
          <User size={22} />
        </button>
      </div>
    );
  }
  
  // Default (variant 1)
  return (
    <>
      <div className="fixed bottom-20 right-4 z-[100]">
        <button className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/50">
          <Menu size={24} className="text-white" />
        </button>
      </div>
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-slate-950 flex items-center justify-around border-t border-white/10 z-50">
        <button className="flex-1 flex flex-col items-center gap-1 py-3 text-purple-400">
          <Home size={20} />
          <span className="text-[8px] font-medium">Home</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 py-3 text-white/50">
          <Compass size={20} />
          <span className="text-[8px] font-medium">Explore</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 py-3 text-white/50">
          <Store size={20} />
          <span className="text-[8px] font-medium">Shop</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 py-3 text-white/50">
          <Wallet size={20} />
          <span className="text-[8px] font-medium">Wallet</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 py-3 text-white/50">
          <User size={20} />
          <span className="text-[8px] font-medium">Profile</span>
        </button>
      </div>
    </>
  );
}

function MockDrawer({ variant, open, onClose }: { variant: LayoutVariant; open?: boolean; onClose?: () => void }) {
  if (variant !== 3) return null;
  
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      )}
      <div className={`fixed top-0 left-0 bottom-0 w-72 bg-slate-950 border-r border-white/10 z-50 transform transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center">
              <Crown size={20} className="text-white" />
            </div>
            <span className="text-white font-bold">Troll City</span>
          </div>
          <button onClick={onClose} className="p-2 text-white/50">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto h-[calc(100vh-4rem)]">
          <div className="space-y-1">
            {[
              { icon: Home, label: 'Home', color: 'text-purple-400' },
              { icon: Compass, label: 'Explore', color: 'text-blue-400' },
              { icon: Video, label: 'Live Streams', color: 'text-pink-400' },
              { icon: Store, label: 'Marketplace', color: 'text-green-400' },
              { icon: Trophy, label: 'Leaderboard', color: 'text-amber-400' },
              { icon: Building2, label: 'Troll Town', color: 'text-cyan-400' },
              { icon: Scale, label: 'Troll Court', color: 'text-red-400' },
              { icon: BookOpen, label: 'Troll Church', color: 'text-violet-400' },
              { icon: Lock, label: 'Jail', color: 'text-slate-400' },
              { icon: LifeBuoy, label: 'Support', color: 'text-teal-400' },
            ].map((item, i) => (
              <button key={i} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors">
                <item.icon size={20} className={item.color} />
                <span className="text-white font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function MockFABs({ variant }: { variant: LayoutVariant }) {
  if (variant !== 3) return null;
  
  return (
    <div className="fixed right-4 bottom-24 flex flex-col gap-3 z-40">
      <button className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center shadow-lg">
        <Bell size={20} className="text-white" />
      </button>
      <button className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center shadow-lg">
        <Wallet size={20} className="text-white" />
      </button>
      <button className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/50">
        <Plus size={28} className="text-white" />
      </button>
    </div>
  );
}

function MockContent({ variant }: { variant: LayoutVariant }) {
  const streamGradient = variant === 5 
    ? 'from-purple-900/30 via-pink-900/20 to-amber-900/30'
    : variant === 4
    ? 'from-slate-900 via-purple-900/20 to-slate-900'
    : 'from-slate-950 via-purple-950 to-slate-950';

  return (
    <div className={`flex-1 overflow-y-auto bg-gradient-to-br ${streamGradient}`}>
      <div className="p-4 space-y-4">
        {/* Live Now Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 p-4 border border-purple-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-purple-400">LIVE NOW</span>
            <span className="text-[10px] text-white/50">2.4K watching</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Video size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Epic Troll Battle!</p>
              <p className="text-[10px] text-white/50">by StreamerTroll</p>
            </div>
            <button className="px-4 py-2 rounded-full bg-purple-600 text-white text-xs font-bold">
              Watch
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Store, label: 'Shop', color: 'bg-green-600' },
            { icon: Trophy, label: 'Ranks', color: 'bg-amber-600' },
            { icon: MessageSquare, label: 'TCPS', color: 'bg-blue-600' },
            { icon: Mic, label: 'Pods', color: 'bg-pink-600' },
          ].map((action, i) => (
            <button key={i} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center`}>
                <action.icon size={18} className="text-white" />
              </div>
              <span className="text-[10px] text-white/70 font-medium">{action.label}</span>
            </button>
          ))}
        </div>

        {/* Featured Streams */}
        <div>
          <h3 className="text-sm font-bold text-white mb-3">Featured Streams</h3>
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="aspect-video rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                <div className="w-full h-2/3 bg-gradient-to-br from-purple-900/50 to-pink-900/50 flex items-center justify-center">
                  <Video size={20} className="text-white/30" />
                </div>
                <div className="p-2">
                  <p className="text-xs font-bold text-white truncate">Stream {i}</p>
                  <p className="text-[9px] text-white/50">by User{i}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trending */}
        <div>
          <h3 className="text-sm font-bold text-white mb-3">Trending</h3>
          <div className="space-y-2">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                <span className="text-lg font-bold text-purple-400">#{i}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Trending Topic {i}</p>
                  <p className="text-[10px] text-white/50">1.2K posts</p>
                </div>
                <ChevronLeft className="rotate-90 text-white/30" size={16} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MobileLayoutPreview() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [layout, setLayout] = useState<LayoutVariant>(1);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const currentLayout = LAYOUTS.find(l => l.id === layout)!;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-950 border-b border-white/10">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-lg font-bold">Mobile Layout Preview</h1>
            <p className="text-xs text-white/50">Dev Preview for Decision</p>
          </div>
          <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg bg-white/10 text-sm">
            Exit
          </button>
        </div>
        
        {/* Layout Selector */}
        <div className="flex gap-2 p-4 pt-0 overflow-x-auto">
          {LAYOUTS.map(l => (
            <button
              key={l.id}
              onClick={() => setLayout(l.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                layout === l.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* Phone Frame */}
      <div className="p-4 flex justify-center">
        <div className="w-[375px] h-[667px] rounded-[3rem] border-8 border-slate-800 overflow-hidden bg-slate-950 relative shadow-2xl">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-slate-800 rounded-b-2xl z-20" />
          
          {/* Layout Content */}
          <div className="relative h-full flex flex-col overflow-hidden">
            <MockHeader variant={layout} />
            <MockContent variant={layout} />
            <MockDrawer variant={layout} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
            <MockFABs variant={layout} />
            <MockBottomNav variant={layout} />
          </div>
        </div>
      </div>

      {/* Layout Info */}
      <div className="p-4 bg-slate-900">
        <div className="rounded-xl bg-slate-800 p-4">
          <h3 className="text-base font-bold text-white mb-2">
            Layout {layout}: {currentLayout.name}
          </h3>
          <p className="text-sm text-white/60">{currentLayout.description}</p>
          
          <div className="mt-4 pt-4 border-t border-white/10">
            <h4 className="text-xs font-bold text-white/50 mb-2">CHARACTERISTICS</h4>
            <div className="flex flex-wrap gap-2">
              {layout === 1 && (
                <>
                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px]">Floating Bubble Menu</span>
                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px]">Draggable</span>
                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px]">Classic Tabs</span>
                </>
              )}
              {layout === 2 && (
                <>
                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px]">Gesture First</span>
                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px]">Minimal Chrome</span>
                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px]">Center CTA</span>
                </>
              )}
              {layout === 3 && (
                <>
                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px]">Drawer Navigation</span>
                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px]">FABs</span>
                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px]">Quick Actions</span>
                </>
              )}
              {layout === 4 && (
                <>
                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px]">Fixed Tab Bar</span>
                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px]">Search Header</span>
                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px]">Dense Layout</span>
                </>
              )}
              {layout === 5 && (
                <>
                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px]">Glassmorphism</span>
                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px]">Floating Dock</span>
                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px]">Premium Feel</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Selection Buttons */}
      <div className="p-4 flex gap-2">
        <button 
          onClick={() => setLayout(l => Math.max(1, l - 1) as LayoutVariant)}
          disabled={layout === 1}
          className="flex-1 py-3 rounded-xl bg-white/10 text-sm font-bold disabled:opacity-30"
        >
          Previous
        </button>
        <button className="flex-1 py-3 rounded-xl bg-green-600 text-sm font-bold">
          Select This Layout
        </button>
        <button 
          onClick={() => setLayout(l => Math.min(5, l + 1) as LayoutVariant)}
          disabled={layout === 5}
          className="flex-1 py-3 rounded-xl bg-white/10 text-sm font-bold disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </div>
  );
}