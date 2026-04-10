import React, { useState } from 'react';
import { Monitor, Smartphone, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

// ═══════════════════════════════════════════════════════════════
// IMPORT EXISTING LAYOUT COMPONENTS
// ═══════════════════════════════════════════════════════════════
const MOCK_MESSAGES = [
  { user: 'TrollFan99', text: 'This stream is fire! 🔥', color: 'text-pink-400' },
  { user: 'CityBoy', text: 'Yo what up troll fam', color: 'text-blue-400' },
  { user: 'GhostUser', text: 'first time here, this is cool', color: 'text-green-400' },
  { user: 'HypeMan', text: 'LETS GOOOOO', color: 'text-yellow-400' },
  { user: 'ChillDude', text: 'vibes are immaculate tonight', color: 'text-purple-400' },
];

const MOCK_VIEWERS = 247;

const SEAT_USERS = [
  { id: 1, name: "HostUser", role: "host", hasInsurance: false },
  { id: 2, name: "CoHost123", role: "broad-officer", hasInsurance: false },
  { id: 3, name: "TrollKing", role: "guest", hasInsurance: true },
  { id: 4, name: "ViewerMike", role: "guest", hasInsurance: false },
  { id: 5, name: "StreamQueen", role: "guest", hasInsurance: false },
  { id: 6, name: "Chatter99", role: "guest", hasInsurance: true },
];

function MockVideo({ className, label = "", gradient = "from-purple-900/40 to-blue-900/40", showSeats = false, isBroadcaster = false, onSeatClick }: { 
  className?: string; 
  label?: string; 
  gradient?: string; 
  showSeats?: boolean;
  isBroadcaster?: boolean;
  onSeatClick?: (user: any) => void;
}) {
  return (
    <div className={cn(`bg-gradient-to-br ${gradient} relative flex items-center justify-center rounded-xl overflow-hidden border border-white/10`, className)}>
      {showSeats ? (
        <div className="grid grid-cols-3 grid-rows-2 gap-1 p-2 w-full h-full">
          {SEAT_USERS.map((user, i) => (
            <div 
              key={i} 
              className="bg-white/5 rounded-lg flex flex-col border border-white/10 relative overflow-hidden cursor-pointer hover:bg-white/10 transition-colors"
              onClick={() => onSeatClick && onSeatClick(user)}
            >
              {/* Username at top of seat */}
              <div className="px-1.5 py-0.5 bg-black/60 backdrop-blur text-[7px] text-white font-medium truncate">
                {user.name}
                {user.hasInsurance && <span className="ml-1 text-amber-400">🛡️</span>}
                {user.role === 'broad-officer' && <span className="ml-1 text-purple-400">⚔️</span>}
              </div>
              
              {/* Seat video area */}
              <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 opacity-40" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/20 mx-auto mb-1.5"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
          <p className="text-[10px] text-white/30 font-medium">{label}</p>
        </div>
      )}
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
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400"><path d="m22 2-7 20-4-9-9-4Z"/></svg>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PC BROADCAST LAYOUTS
// ═══════════════════════════════════════════════════════════════
function Layout1_Cinematic() {
  return (
    <div className="relative h-[380px] bg-black rounded-2xl overflow-hidden border border-white/10">
      <MockVideo className="absolute inset-0" label="FULLSCREEN VIDEO" gradient="from-indigo-900/30 via-purple-900/20 to-slate-900/30" showSeats={true} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 z-30 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl rounded-full px-3 py-1.5 border border-white/10">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-pink-500" />
          <span className="text-xs font-bold text-white">username</span>
          <span className="bg-red-500 text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white">LIVE</span>
        </div>
      </div>
      <div className="absolute left-3 top-14 bottom-16 w-52 z-20">
        <div className="h-full bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden">
          <MockChat compact />
        </div>
      </div>
    </div>
  );
}

function Layout2_SplitPanel() {
  return (
    <div className="h-[380px] bg-zinc-950 rounded-2xl overflow-hidden border border-white/10 flex flex-col">
      <div className="h-10 bg-zinc-900 border-b border-white/10 flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500" />
          <span className="text-xs font-bold text-white">username</span>
          <span className="bg-red-500/80 text-[8px] font-bold px-1.5 py-0.5 rounded text-white">LIVE</span>
        </div>
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 p-2 min-h-0">
            <MockVideo className="w-full h-full" label="VIDEO FEED" gradient="from-emerald-900/20 to-teal-900/20" showSeats={true} />
          </div>
        </div>
        <div className="w-60 border-l border-white/10 bg-zinc-950 shrink-0 hidden md:flex flex-col">
          <MockChat />
        </div>
      </div>
    </div>
  );
}

function Layout3_Dashboard() {
  return (
    <div className="h-[380px] bg-[#0c0c10] rounded-2xl overflow-hidden border border-white/10 flex flex-col">
      <div className="h-9 bg-[#13131a] border-b border-white/5 flex items-center justify-between px-3 shrink-0">
        <span className="text-[10px] font-bold text-white uppercase tracking-wider">Dashboard View</span>
      </div>
      <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-1.5 p-1.5 min-h-0">
        <div className="col-span-2 row-span-2">
          <MockVideo className="w-full h-full" label="MAIN CAMERA" gradient="from-violet-900/20 to-indigo-900/20" showSeats={true} />
        </div>
        <div className="bg-zinc-950 rounded-xl border border-white/10 overflow-hidden">
          <MockChat compact />
        </div>
        <div className="bg-zinc-950 rounded-xl border border-white/10 p-2">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Stream Stats</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MOBILE BROADCAST LAYOUTS
// ═══════════════════════════════════════════════════════════════
function MobileLayout1_Classic({ isBroadcaster = false }: { isBroadcaster?: boolean }) {
  const [showBroadcastMenu, setShowBroadcastMenu] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [broadOfficers, setBroadOfficers] = useState([1, 2]);
  
  const handleSeatClick = (user: any) => {
    if (isBroadcaster) {
      setSelectedUser(user);
      setShowUserMenu(true);
    }
  };

  return (
    <div className="relative w-full h-[520px] bg-black rounded-[2rem] overflow-hidden border-2 border-slate-800">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-slate-800 rounded-b-2xl z-20" />
      
      {/* Top viewer profile bar - 10 user avatars */}
      <div className="absolute top-8 left-0 right-0 z-30 px-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex -space-x-1.5">
              {[1,2,3,4,5,6,7,8,9,10].map(i => (
                <div key={i} className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border border-black/50" style={{opacity: 1 - (i * 0.07)}} />
              ))}
            </div>
            <span className="ml-2 text-[10px] text-white/70">+{MOCK_VIEWERS}</span>
          </div>
          
          {/* Broadcaster LIVE button that opens menu */}
          {isBroadcaster ? (
            <button 
              onClick={() => setShowBroadcastMenu(true)}
              className="bg-red-500 text-[8px] font-bold px-3 py-1 rounded-full text-white flex items-center gap-1 animate-pulse hover:bg-red-600 transition-colors"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white" /> LIVE
            </button>
          ) : (
            <div className="bg-red-500/80 text-[8px] font-bold px-2 py-0.5 rounded-full text-white flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
            </div>
          )}
        </div>
      </div>
      
      {/* Video area with 6 seats - adjusted to not be covered by chat */}
      <div className="absolute inset-x-0 top-[50px] bottom-[150px]">
        <MockVideo className="w-full h-full rounded-none" label="" gradient="from-amber-900/20 via-orange-900/10 to-black" showSeats={true} isBroadcaster={isBroadcaster} onSeatClick={handleSeatClick} />
      </div>
      
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/30 via-transparent to-black/70" />
      
      {/* Right side actions - positioned outside video area completely */}
      <div className="absolute right-2 bottom-[210px] z-30 flex flex-col items-center gap-2">
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-7 h-7 rounded-full bg-black/30 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/80">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          </div>
          <span className="text-[7px] font-bold text-white/70">89</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-7 h-7 rounded-full bg-black/30 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/80">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="12"/></svg>
          </div>
          <span className="text-[7px] font-bold text-white/70">Share</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-7 h-7 rounded-full bg-black/30 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/80">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/></svg>
          </div>
          <span className="text-[7px] font-bold text-white/70">45</span>
        </div>
      </div>

      {/* Chat area with input box at absolute bottom */}
      <div className="absolute bottom-2 left-0 right-0 z-30 px-3">
        <div className="space-y-1 mb-2 pb-1">
          {MOCK_MESSAGES.slice(0, 2).map((m, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className={cn("text-[9px] font-bold", m.color)}>{m.user}</span>
              <span className="text-[9px] text-white/70">{m.text}</span>
            </div>
          ))}
        </div>
        
        {/* Chat input box fixed at very bottom */}
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur rounded-full px-3 py-2">
          <input placeholder="Send message..." className="flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-white/30" />
          <button className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m22 2-7 20-4-9-9-4Z"/></svg>
          </button>
        </div>
      </div>

      {/* Broadcaster Control Popup Modal */}
      {showBroadcastMenu && (
        <div className="absolute inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setShowBroadcastMenu(false)}>
          <div className="w-full bg-zinc-900 rounded-t-3xl p-4 max-h-[80%] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />
            
            <h3 className="text-base font-bold text-white mb-4">Broadcast Controls</h3>
            
            <div className="space-y-3">
              <button className="w-full p-3 bg-red-600 hover:bg-red-700 rounded-xl text-white text-sm font-medium flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 2h20v20H2z"/></svg>
                End Live Broadcast
              </button>
              
              <button className="w-full p-3 bg-green-600 hover:bg-green-700 rounded-xl text-white text-sm font-medium flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                Add Guest Box
              </button>
              
              <button className="w-full p-3 bg-orange-600 hover:bg-orange-700 rounded-xl text-white text-sm font-medium flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
                Remove Guest Box
              </button>

              <div className="pt-2 border-t border-white/10">
                <h4 className="text-xs font-bold text-white/50 mb-3">BROAD OFFICERS ({broadOfficers.length}/5)</h4>
                {broadOfficers.map(id => {
                  const officer = SEAT_USERS.find(u => u.id === id);
                  return (
                    <div key={id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg mb-2">
                      <span className="text-sm text-white">{officer?.name}</span>
                      <button className="text-xs text-red-400">Remove</button>
                    </div>
                  );
                })}
                <button className="w-full p-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-xs font-medium">
                  Assign Broad Officer
                </button>
              </div>

              <div className="pt-2 border-t border-white/10">
                <h4 className="text-xs font-bold text-white/50 mb-3">MANAGEMENT</h4>
                <button className="w-full p-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-white text-sm font-medium flex items-center justify-between mb-2">
                  <span>Muted Users</span>
                  <span className="text-white/50">12</span>
                </button>
                <button className="w-full p-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-white text-sm font-medium flex items-center justify-between mb-2">
                  <span>Kicked Users</span>
                  <span className="text-white/50">3</span>
                </button>
                <button className="w-full p-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-white text-sm font-medium flex items-center justify-between">
                  <span>Banned Users</span>
                  <span className="text-white/50">7</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Context Menu */}
      {showUserMenu && selectedUser && (
        <div className="absolute inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setShowUserMenu(false)}>
          <div className="w-full bg-zinc-900 rounded-t-3xl p-4" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
              <div>
                <h3 className="text-base font-bold text-white">{selectedUser.name}</h3>
                {selectedUser.hasInsurance && (
                  <p className="text-xs text-amber-400">🛡️ User has insurance protection</p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <button className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white text-sm font-medium">
                Follow User
              </button>
              
              <button className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white text-sm font-medium">
                Report User
              </button>
              
              {selectedUser.role !== 'broad-officer' && broadOfficers.length < 5 && (
                <button className="w-full p-3 bg-purple-600 hover:bg-purple-700 rounded-xl text-white text-sm font-medium">
                  Assign Broad Officer
                </button>
              )}
              
              {selectedUser.hasInsurance ? (
                <button disabled className="w-full p-3 bg-amber-500/20 rounded-xl text-amber-400 text-sm font-medium opacity-70 cursor-not-allowed">
                  🛡️ User has insurance - cannot kick
                </button>
              ) : (
                <button className="w-full p-3 bg-orange-600 hover:bg-orange-700 rounded-xl text-white text-sm font-medium">
                  Kick from broadcast
                </button>
              )}
              
              {selectedUser.hasInsurance ? (
                <button disabled className="w-full p-3 bg-amber-500/20 rounded-xl text-amber-400 text-sm font-medium opacity-70 cursor-not-allowed">
                  🛡️ User has insurance - cannot ban
                </button>
              ) : (
                <button className="w-full p-3 bg-red-600 hover:bg-red-700 rounded-xl text-white text-sm font-medium">
                  Ban permanently
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileLayout2_Overlay() {
  return (
    <div className="relative w-full h-[520px] bg-black rounded-[2rem] overflow-hidden border-2 border-slate-800">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-slate-800 rounded-b-2xl z-20" />
      <MockVideo className="absolute inset-0" label="MOBILE VIDEO" gradient="from-rose-900/20 via-pink-900/10 to-black" showSeats={true} />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-black/60" />
      
      <div className="absolute left-3 bottom-20 w-56 h-48 z-20 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
        <MockChat compact />
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-30 p-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
          </button>
          <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
          </button>
        </div>
        <button className="px-5 py-2.5 rounded-full bg-red-500/80 backdrop-blur text-white text-xs font-bold flex items-center gap-1.5 border border-red-400/30">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 2h20v20H2z"/></svg> End
        </button>
      </div>
    </div>
  );
}

function MobileLayout3_Fullscreen() {
  return (
    <div className="relative w-full h-[520px] bg-black rounded-[2rem] overflow-hidden border-2 border-slate-800">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-slate-800 rounded-b-2xl z-20" />
      <MockVideo className="absolute inset-0" label="FULLSCREEN" gradient="from-cyan-900/20 via-blue-900/10 to-black" />
      
      <div className="absolute top-14 left-3 right-3 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl rounded-full px-3 py-1.5 border border-white/10">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500" />
            <span className="text-xs font-bold text-white">username</span>
            <span className="bg-red-500 text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white">LIVE</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-30 p-4">
        <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 text-white flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
              </button>
              <button className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 text-white flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
              </button>
            </div>
            <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-bold flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 2h20v20H2z"/></svg> End Stream
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LAYOUT DATA
// ═══════════════════════════════════════════════════════════════
const PC_LAYOUTS = [
  { id: 'cinematic', name: 'Cinematic Widescreen', desc: 'Fullscreen video with overlay chat. Immersive experience.', component: Layout1_Cinematic },
  { id: 'split-panel', name: 'Split Panel', desc: 'Video left, persistent chat right. Clean and functional.', component: Layout2_SplitPanel },
  { id: 'dashboard', name: 'Dashboard Grid', desc: 'Multi-panel layout with stats. Great for stream management.', component: Layout3_Dashboard },
];

const MOBILE_LAYOUTS = [
  { id: 'tiktok-style', name: 'TikTok Vertical', desc: 'Side action buttons, bottom chat preview. Familiar UX.', component: MobileLayout1_Classic },
  { id: 'floating-chat', name: 'Floating Chat', desc: 'Floating chat panel, minimal controls. Focus on video.', component: MobileLayout2_Overlay },
  { id: 'max-video', name: 'Max Video', desc: 'Bottom control bar, minimal chrome. Maximum viewing area.', component: MobileLayout3_Fullscreen },
];

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function BroadcastLayoutSelector() {
  const [selectedPC, setSelectedPC] = useState<string | null>(null);
  const [selectedMobile, setSelectedMobile] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'both' | 'pc' | 'mobile'>('both');

  return (
    <div className="min-h-screen bg-[#06060a] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#06060a]/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <h1 className="text-3xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
            Broadcast Layout Selector
          </h1>
          <p className="text-slate-400 mt-2">
            Choose which broadcast layouts to use for PC and Mobile platforms
          </p>
        </div>

        {/* View Tabs */}
        <div className="max-w-7xl mx-auto px-6 pb-4 flex gap-2">
          <button
            onClick={() => setActiveTab('both')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2",
              activeTab === 'both'
                ? 'bg-purple-600 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            )}
          >
            Both Platforms
          </button>
          <button
            onClick={() => setActiveTab('pc')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2",
              activeTab === 'pc'
                ? 'bg-blue-600 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            )}
          >
            <Monitor size={16} /> PC Only
          </button>
          <button
            onClick={() => setActiveTab('mobile')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2",
              activeTab === 'mobile'
                ? 'bg-emerald-600 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            )}
          >
            <Smartphone size={16} /> Mobile Only
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className={cn(
          "grid gap-10",
          activeTab === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
        )}>
          {/* PC Layouts */}
          {(activeTab === 'both' || activeTab === 'pc') && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Monitor size={20} className="text-blue-400" />
                  PC Broadcast Layouts
                </h2>
                <p className="text-sm text-slate-500 mt-1">Desktop and tablet viewing experience</p>
              </div>

              <div className="space-y-8">
                {PC_LAYOUTS.map(layout => {
                  const Comp = layout.component;
                  const isSelected = selectedPC === layout.id;
                  return (
                    <div
                      key={layout.id}
                      className={cn(
                        "rounded-3xl transition-all cursor-pointer group",
                        isSelected
                          ? "ring-2 ring-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.15)]"
                          : "hover:ring-1 hover:ring-white/10"
                      )}
                      onClick={() => setSelectedPC(layout.id)}
                    >
                      <div className="mb-3 px-1 flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {isSelected && <Check size={20} className="text-blue-400" />}
                            {layout.name}
                          </h3>
                          <p className="text-xs text-slate-500">{layout.desc}</p>
                        </div>
                        <span className={cn(
                          "text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-all shrink-0",
                          isSelected
                            ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                            : "bg-white/5 border-white/10 text-slate-600"
                        )}>
                          {isSelected ? 'SELECTED' : layout.id}
                        </span>
                      </div>
                      <Comp />
                    </div>
                  );
                })}
              </div>

              {selectedPC && (
                <div className="mt-8 p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                  <p className="text-blue-300 font-bold">
                    ✓ PC Layout Selected: {PC_LAYOUTS.find(l => l.id === selectedPC)?.name}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Mobile Layouts */}
          {(activeTab === 'both' || activeTab === 'mobile') && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Smartphone size={20} className="text-emerald-400" />
                  Mobile Broadcast Layouts
                </h2>
                <p className="text-sm text-slate-500 mt-1">Phone viewing experience</p>
              </div>

              <div className="space-y-8">
                {MOBILE_LAYOUTS.map(layout => {
                  const Comp = layout.component;
                  const isSelected = selectedMobile === layout.id;
                  return (
                    <div
                      key={layout.id}
                      className={cn(
                        "rounded-3xl transition-all cursor-pointer group",
                        isSelected
                          ? "ring-2 ring-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.15)]"
                          : "hover:ring-1 hover:ring-white/10"
                      )}
                      onClick={() => setSelectedMobile(layout.id)}
                    >
                      <div className="mb-3 px-1 flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {isSelected && <Check size={20} className="text-emerald-400" />}
                            {layout.name}
                          </h3>
                          <p className="text-xs text-slate-500">{layout.desc}</p>
                        </div>
                        <span className={cn(
                          "text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-all shrink-0",
                          isSelected
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                            : "bg-white/5 border-white/10 text-slate-600"
                        )}>
                          {isSelected ? 'SELECTED' : layout.id}
                        </span>
                      </div>
                      <div className="flex justify-center">
                        <div className="w-[280px]">
                          <Comp />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedMobile && (
                <div className="mt-8 p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                  <p className="text-emerald-300 font-bold">
                    ✓ Mobile Layout Selected: {MOBILE_LAYOUTS.find(l => l.id === selectedMobile)?.name}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selection Summary */}
        {selectedPC && selectedMobile && (
          <div className="mt-12 p-6 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-amber-500/10 border border-purple-500/20 rounded-3xl">
            <h3 className="text-xl font-bold text-white mb-4">🎉 Final Selection</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-black/30 rounded-2xl">
                <p className="text-sm text-blue-400 font-bold mb-1">PC Layout</p>
                <p className="text-white font-medium">{PC_LAYOUTS.find(l => l.id === selectedPC)?.name}</p>
              </div>
              <div className="p-4 bg-black/30 rounded-2xl">
                <p className="text-sm text-emerald-400 font-bold mb-1">Mobile Layout</p>
                <p className="text-white font-medium">{MOBILE_LAYOUTS.find(l => l.id === selectedMobile)?.name}</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold">
                Confirm Selection
              </button>
              <button 
                onClick={() => { setSelectedPC(null); setSelectedMobile(null); }}
                className="px-6 py-3 rounded-xl bg-white/10 text-white font-bold"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-12 flex justify-between items-center py-4 border-t border-white/10">
          <button className="px-4 py-2 rounded-lg bg-white/10 text-sm flex items-center gap-2 opacity-50 cursor-not-allowed">
            <ChevronLeft size={16} /> Previous
          </button>
          <span className="text-xs text-slate-500">Page 1 of 1</span>
          <button className="px-4 py-2 rounded-lg bg-white/10 text-sm flex items-center gap-2 opacity-50 cursor-not-allowed">
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}