import React from 'react';
import {
  Eye,
  Heart,
  Users,
  Coins,
  Home,
  Video,
  Shield,
  MessageSquare,
  User as UserIcon
} from 'lucide-react';

const avatars = [
  { name: 'Mai', color: 'from-purple-500 to-purple-900' },
  { name: 'Zapp', color: 'from-yellow-500 to-amber-700' },
  { name: 'Jello', color: 'from-pink-500 to-fuchsia-700' },
  { name: 'Troll', color: 'from-blue-500 to-cyan-700' },
  { name: 'Crow', color: 'from-emerald-500 to-lime-700' },
  { name: 'Nova', color: 'from-slate-500 to-gray-700' }
];

const chatMessages = [
  { coins: 14, text: 'ZAPP: No problem 100', icon: '🌀' },
  { coins: 30, text: 'Jello: I see', icon: '👑' },
  { coins: 17, text: 'Maitrollcity.com CEO Admin joined', icon: '⭐' },
  { coins: 30, text: 'I was gonna ask you that', icon: '👑' },
  { coins: 30, text: 'Let’s drink one', icon: '🌀' }
];

const navItems = [
  { label: 'Home', icon: Home },
  { label: 'Live', icon: Video },
  { label: 'Shield', icon: Shield },
  { label: 'Inbox', icon: MessageSquare },
  { label: 'Profile', icon: UserIcon }
];

interface SeatCellProps {
  number?: number;
  label?: string;
  highlight?: boolean;
}

function SeatCell({ number, label, highlight = false }: SeatCellProps) {
  return (
    <div
      className={`relative rounded-2xl border border-white/10 bg-white/5 text-center p-3 min-h-[90px] flex flex-col justify-center items-center text-[12px] text-white/60 ${
        highlight ? 'bg-gradient-to-br from-purple-900 via-[#1d083a] to-[#05010f] text-white shadow-2xl border-yellow-500/40' : ''
      }`}
    >
      {number && (
        <span className="absolute -top-2 -left-2 rounded-full bg-white/90 text-black text-[11px] font-semibold px-2 py-0.5">
          {number}
        </span>
      )}
      <div className="w-12 h-12 rounded-full bg-white/10 grid place-items-center text-lg mb-2">
        {label ? label.charAt(0) : <Users size={16} className="text-white/60" />}
      </div>
      <div>{label ? label : 'Tap to Join'}</div>
    </div>
  );
}

function SeatGrid() {
  return (
    <div className="grid grid-cols-3 gap-3">
      <SeatCell number={1} label="MaiCorp" highlight />
      {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
        <SeatCell key={n} number={n} />
      ))}
    </div>
  );
}

function BroadcastLayoutPreview() {
  return (
    <div className="bg-[#04030b] rounded-3xl border border-white/10 shadow-2xl p-5 space-y-4">
      <div className="flex items-center gap-3 overflow-x-auto py-1">
        {avatars.map((avatar) => (
          <div key={avatar.name} className="relative">
            <div
              className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatar.color} border-2 border-white/20 flex items-center justify-center text-xs font-semibold tracking-wider`}
            >
              {avatar.name}
            </div>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/60">
              Troll
            </span>
          </div>
        ))}
        <button className="ml-auto flex items-center gap-1 px-3 py-1 rounded-full border border-white/20 bg-white/10 text-white text-xs font-semibold uppercase tracking-[0.3em]">
          <Heart size={14} className="text-pink-400" /> Like
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0c061d] to-[#16122d] px-4 py-3 flex items-center gap-4 justify-between">
        <div className="flex items-center gap-3 text-xs text-white/80">
          <Eye size={16} className="text-white" /> 123
          <Coins size={16} className="text-yellow-400 ml-4" /> 0
          <Users size={16} className="text-green-400 ml-4" /> 0
        </div>
        <span className="px-3 py-1 rounded-full bg-red-600/80 text-[10px] font-bold tracking-[0.3em] uppercase">
          LIVE
        </span>
      </div>

      <SeatGrid />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {['Chat', 'Gifts', 'Settings'].map((tab) => (
            <button
              key={tab}
              className={`flex-1 py-2 rounded-full text-[12px] font-semibold uppercase tracking-[0.3em] ${
                tab === 'Chat'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/40'
                  : 'bg-white/5 text-white/60'
              }`}
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#10031d] to-[#1f1237] p-3 space-y-2 text-[12px]">
          {chatMessages.map((msg) => (
            <div key={msg.text} className="flex items-center gap-2 text-white/80">
              <span className="text-xs text-yellow-400">{msg.coins}</span>
              <span className="text-white/90 font-semibold">{msg.icon}</span>
              <span className="flex-1 truncate">{msg.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-white/60 uppercase tracking-[0.3em]">
        {navItems.map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-1">
            <item.icon size={18} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ViewerLayoutPreview() {
  return (
    <div className="bg-[#050015] rounded-3xl border border-white/10 shadow-2xl p-5 space-y-4">
      <div className="flex items-center gap-3 overflow-x-auto py-1">
        {avatars.slice(0, 4).map((avatar) => (
          <div key={avatar.name} className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0c0540] to-[#2c1960] flex items-center justify-center text-[10px] font-semibold tracking-[0.3em] border border-white/5">
            {avatar.name}
          </div>
        ))}
        <div className="flex-1 border border-white/10 rounded-full px-3 py-1 text-[11px] text-white/60 uppercase tracking-[0.3em] text-center">
          Watch Mode
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between text-[12px] text-white/70">
        <div className="flex items-center gap-4">
          <Eye size={16} /> 98
          <Users size={16} /> 12
        </div>
        <span className="px-3 py-1 rounded-full bg-white/10 text-[10px] uppercase font-semibold tracking-[0.3em]">Live</span>
      </div>

      <SeatGrid />

      <div className="rounded-2xl border border-white/10 bg-[#0d051b] p-3 space-y-2 text-[12px]">
        <div className="text-xs text-white/70 font-semibold">Live Chat</div>
        {chatMessages.slice(0, 3).map((msg) => (
          <div key={msg.text} className="flex items-center gap-2 text-white/80">
            <span className="text-xs text-cyan-300">{msg.icon}</span>
            <span className="flex-1 truncate">{msg.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { BroadcastLayoutPreview, ViewerLayoutPreview };
export default BroadcastLayoutPreview;
