import React from 'react';
import { User, Coins, MicOff, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

// Mock Grid Component (Pure UI, no LiveKit)
const MockBattleGrid = ({ title, hostName, score, isLeft }: { title: string, hostName: string, score: number, isLeft: boolean }) => {
  return (
    <div className="h-full flex flex-col p-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
            <h3 className="text-white font-bold text-lg">{title}</h3>
            <div className="flex items-center gap-2 text-amber-500 bg-amber-900/20 px-3 py-1 rounded-full border border-amber-500/30">
                <Coins size={14} />
                <span className="font-mono font-bold">{score.toLocaleString()}</span>
            </div>
        </div>

        {/* Grid (1 Host + 3 Guests) */}
        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-4">
            {/* Slot 1: Host */}
            <div className="relative bg-zinc-800 rounded-2xl overflow-hidden border-2 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                     <User size={48} className="text-zinc-600" />
                </div>
                <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm">LIVE</div>
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-2 border border-white/10">
                    <span className="text-white text-sm font-bold">{hostName}</span>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                </div>
            </div>

            {/* Slot 2: Guest 1 */}
            <div className="relative bg-zinc-800/50 rounded-2xl overflow-hidden border border-white/5">
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                        <User size={32} className="text-zinc-600 mx-auto mb-2" />
                        <span className="text-zinc-500 text-xs">Guest 1</span>
                    </div>
                </div>
            </div>

             {/* Slot 3: Guest 2 */}
             <div className="relative bg-zinc-800/50 rounded-2xl overflow-hidden border border-white/5">
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                         <div className="w-12 h-12 rounded-full bg-zinc-700/50 flex items-center justify-center mx-auto mb-2 border border-white/5">
                            <Plus size={20} className="text-zinc-500" />
                         </div>
                        <span className="text-zinc-500 text-xs">Empty Seat</span>
                    </div>
                </div>
            </div>

             {/* Slot 4: Guest 3 */}
             <div className="relative bg-zinc-800/50 rounded-2xl overflow-hidden border border-white/5">
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-zinc-700/50 flex items-center justify-center mx-auto mb-2 border border-white/5">
                            <Plus size={20} className="text-zinc-500" />
                         </div>
                        <span className="text-zinc-500 text-xs">Empty Seat</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default function BattlePreview() {
  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden">
        {/* Battle Header */}
        <div className="h-20 bg-zinc-900 border-b border-amber-500/30 flex items-center justify-center relative z-20 shadow-lg shadow-amber-900/20 px-8">
            <div className="flex-1 flex items-center justify-end gap-4">
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-white tracking-tight">TrollKing's Stream</h2>
                    <div className="flex items-center justify-end gap-1 text-amber-500">
                        <Coins size={16} />
                        <span className="font-mono text-xl font-bold">12,500</span>
                    </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 border-2 border-white/20 shadow-lg" />
            </div>

            <div className="mx-12 flex flex-col items-center justify-center">
                 <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-800 italic tracking-widest drop-shadow-[0_0_15px_rgba(220,38,38,0.5)] transform -skew-x-12">
                    VS
                 </span>
                 <div className="text-[10px] uppercase tracking-[0.3em] text-red-500 font-bold mt-1 animate-pulse">
                    Battle Live
                 </div>
            </div>

            <div className="flex-1 flex items-center justify-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-green-500 to-teal-500 border-2 border-white/20 shadow-lg" />
                <div className="text-left">
                    <h2 className="text-2xl font-bold text-white tracking-tight">GoblinQueen</h2>
                    <div className="flex items-center justify-start gap-1 text-amber-500">
                        <Coins size={16} />
                        <span className="font-mono text-xl font-bold">8,200</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Battle Arena (Split View) */}
        <div className="flex-1 flex overflow-hidden relative">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/10 via-black to-black pointer-events-none" />
            
            {/* Challenger Side */}
            <div className="w-1/2 border-r border-amber-500/20 relative backdrop-blur-sm">
                 <MockBattleGrid 
                    title="Challenger" 
                    hostName="TrollKing" 
                    score={12500} 
                    isLeft={true} 
                />
            </div>

            {/* Opponent Side */}
            <div className="w-1/2 relative backdrop-blur-sm">
                 <MockBattleGrid 
                    title="Opponent" 
                    hostName="GoblinQueen" 
                    score={8200} 
                    isLeft={false} 
                />
            </div>

            {/* VS Divider Line Effect */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-red-500/50 to-transparent shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
        </div>
        
        {/* Chat & Controls Overlay (Bottom) */}
        <div className="h-72 border-t border-zinc-800 flex bg-zinc-900/95 backdrop-blur-md z-30">
             <div className="w-[30%] border-r border-zinc-800 flex flex-col">
                 <div className="p-3 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
                    <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Live Chat</h3>
                    <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">25s TTL</span>
                 </div>
                 {/* Mock Chat Messages */}
                 <div className="flex-1 p-4 space-y-3 overflow-y-auto font-mono text-sm">
                    <div className="flex gap-2">
                        <span className="text-purple-400 font-bold">User1:</span>
                        <span className="text-white/80">Lets goooo!!!</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="text-green-400 font-bold">TrollFan:</span>
                        <span className="text-white/80">Gift sent to Team Red! 🌹</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="text-blue-400 font-bold">Mod_X:</span>
                        <span className="text-white/80">Keep it clean folks.</span>
                    </div>
                     <div className="flex gap-2 opacity-50">
                        <span className="text-zinc-500 font-bold">Deleted:</span>
                        <span className="text-zinc-600 italic">Message expired...</span>
                    </div>
                 </div>
                 <div className="p-3 border-t border-zinc-800">
                     <input 
                        type="text" 
                        placeholder="Say something..." 
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                        disabled
                    />
                 </div>
             </div>
             
             <div className="flex-1 p-6 flex flex-col items-center justify-center gap-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>
                
                <div className="text-center space-y-2 z-10">
                    <h3 className="text-2xl font-bold text-white">Battle in Progress</h3>
                    <p className="text-zinc-400 max-w-md mx-auto">
                        Who will win the Troll Crown? Send gifts to boost your favorite streamer's score!
                    </p>
                </div>

                <div className="flex gap-4 z-10">
                     <button className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black px-8 py-3 rounded-xl font-bold shadow-[0_0_20px_rgba(245,158,11,0.3)] transition transform hover:scale-105">
                        SEND GIFT 🎁
                     </button>
                     <button className="bg-zinc-800 hover:bg-zinc-700 text-white px-8 py-3 rounded-xl font-bold border border-white/10 transition">
                        Share Battle
                     </button>
                </div>

                {/* Progress Bar */}
                <div className="w-full max-w-2xl mt-4">
                    <div className="flex justify-between text-xs font-bold mb-2 uppercase tracking-wider">
                        <span className="text-purple-400">TrollKing (60%)</span>
                        <span className="text-teal-400">GoblinQueen (40%)</span>
                    </div>
                    <div className="h-4 bg-zinc-800 rounded-full overflow-hidden relative border border-white/5">
                        <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-purple-600 to-purple-500 w-[60%] shadow-[0_0_15px_rgba(147,51,234,0.5)] z-10" />
                        <div className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-teal-600 to-teal-500 w-[40%] shadow-[0_0_15px_rgba(20,184,166,0.5)]" />
                        {/* Center Clash Line */}
                        <div className="absolute left-[60%] top-0 bottom-0 w-1 bg-white blur-[2px] z-20" />
                    </div>
                </div>
             </div>
        </div>
    </div>
  );
}
