import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SectionCard } from './SectionCard';
import { Activity, MessageSquare, Zap, Play, Square, Trash2, BarChart3 } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';

interface MockMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  type: 'chat' | 'gift' | 'system';
  user_profiles?: {
    username: string;
    avatar_url: string | null;
    role: string;
    troll_role?: string;
    created_at: string;
  };
}

export default function LoadLab() {
  const [isRunning, setIsRunning] = useState(false);
  const [msgPerSec, setMsgPerSec] = useState(100);
  const [batchInterval, setBatchInterval] = useState(100);
  const [simulatedMessages, setSimulatedMessages] = useState<MockMessage[]>([]);
  const [stats, setStats] = useState({
    totalMessages: 0,
    fps: 60,
    heapSize: 0,
    startingHeap: 0,
    avgPayloadSize: 0,
    maxCommitTime: 0,
    lastCommitTime: 0,
    droppedFrames: 0,
    renderCount: 0,
  });

  const renderCountRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const payloadSizesRef = useRef<number[]>([]);
  const startHeapRef = useRef(0);

  // Stats update loop
  useEffect(() => {
    // Set starting heap once
    // @ts-expect-error performance.memory is non-standard
    if (window.performance?.memory?.usedJSHeapSize && startHeapRef.current === 0) {
      // @ts-expect-error performance.memory is non-standard
      startHeapRef.current = Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024));
    }

    const interval = setInterval(() => {
      const now = performance.now();
      const delta = now - lastFrameTime.current;
      const fps = Math.round((frameCount.current * 1000) / delta);
      
      // @ts-expect-error performance.memory is non-standard
      const heap = window.performance?.memory?.usedJSHeapSize || 0;
      const currentHeapMB = Math.round(heap / (1024 * 1024));

      const avgPayload = payloadSizesRef.current.length > 0 
        ? Math.round(payloadSizesRef.current.reduce((a, b) => a + b, 0) / payloadSizesRef.current.length)
        : 0;

      setStats(prev => ({
        ...prev,
        fps,
        heapSize: currentHeapMB,
        startingHeap: startHeapRef.current,
        avgPayloadSize: avgPayload,
        renderCount: renderCountRef.current,
      }));

      frameCount.current = 0;
      lastFrameTime.current = now;
    }, 1000);

    const frameLoop = () => {
      frameCount.current++;
      requestAnimationFrame(frameLoop);
    };
    const frameId = requestAnimationFrame(frameLoop);

    return () => {
      clearInterval(interval);
      cancelAnimationFrame(frameId);
    };
  }, []);

  const generateMessage = useCallback((): MockMessage => {
    const id = Math.random().toString(36).substring(7);
    const msg: MockMessage = {
      id,
      user_id: 'mock-user-' + (Math.floor(Math.random() * 1000)),
      content: `Simulated message ${id} at ${new Date().toLocaleTimeString()} with some extra padding to match real world payloads.`,
      created_at: new Date().toISOString(),
      type: Math.random() > 0.9 ? 'gift' : 'chat',
      user_profiles: {
        username: `Troll_${id}`,
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + id,
        role: 'user',
        created_at: new Date().toISOString(),
      }
    };

    // Calculate approximate byte size (UTF-16 characters * 2)
    const size = JSON.stringify(msg).length * 2;
    payloadSizesRef.current.push(size);
    if (payloadSizesRef.current.length > 1000) payloadSizesRef.current.shift();

    return msg;
  }, []);

  const startSimulation = () => {
    setIsRunning(true);
    startTimeRef.current = Date.now();
    renderCountRef.current = 0;
    
    // Message generation loop
    timerRef.current = setInterval(() => {
      const burstSize = Math.max(1, Math.floor(msgPerSec / 10)); // 10 ticks per sec
      for (let i = 0; i < burstSize; i++) {
        messageBuffer.current.push(generateMessage());
      }
    }, 100);

    // Batch flush loop
    if (batchInterval > 0) {
      flushTimerRef.current = setInterval(() => {
        if (messageBuffer.current.length > 0) {
          const t0 = performance.now();
          const newMsgs = [...messageBuffer.current];
          messageBuffer.current = [];
          
          setSimulatedMessages(prev => {
            const combined = [...prev, ...newMsgs];
            return combined.slice(-2000);
          });
          
          const t1 = performance.now();
          const commitTime = t1 - t0;
          
          setStats(prev => ({ 
            ...prev, 
            totalMessages: prev.totalMessages + newMsgs.length,
            lastCommitTime: commitTime,
            maxCommitTime: Math.max(prev.maxCommitTime, commitTime)
          }));
        }
      }, batchInterval);
    } else {
      // Immediate mode (unbatched)
      timerRef.current = setInterval(() => {
        const msg = generateMessage();
        const t0 = performance.now();
        setSimulatedMessages(prev => [...prev, msg].slice(-2000));
        const t1 = performance.now();
        
        setStats(prev => ({ 
          ...prev, 
          totalMessages: prev.totalMessages + 1,
          lastCommitTime: t1 - t0,
          maxCommitTime: Math.max(prev.maxCommitTime, t1 - t0)
        }));
      }, 1000 / msgPerSec);
    }
  };

  const stopSimulation = () => {
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (flushTimerRef.current) clearInterval(flushTimerRef.current);
  };

  const clearMessages = () => {
    setSimulatedMessages([]);
    setStats(prev => ({ ...prev, totalMessages: 0 }));
  };

  return (
    <SectionCard title="100k Load Lab" icon={<Zap className="text-yellow-500" />}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="space-y-6">
          <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5">
            <h3 className="text-sm font-bold text-zinc-400 mb-4 flex items-center gap-2">
              <Activity size={16} /> SIMULATION CONFIG
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">MESSAGES PER SECOND ({msgPerSec})</label>
                <input 
                  type="range" min="1" max="2000" step="10"
                  value={msgPerSec}
                  onChange={(e) => setMsgPerSec(parseInt(e.target.value))}
                  className="w-full accent-yellow-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500 block mb-1">BATCH FLUSH INTERVAL ({batchInterval}ms)</label>
                <input 
                  type="range" min="0" max="1000" step="50"
                  value={batchInterval}
                  onChange={(e) => setBatchInterval(parseInt(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <p className="text-[10px] text-zinc-600 mt-1">0ms = Instant re-render (Heavy)</p>
              </div>

              <div className="flex gap-2 pt-2">
                {!isRunning ? (
                  <button 
                    onClick={startSimulation}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2"
                  >
                    <Play size={16} /> START
                  </button>
                ) : (
                  <button 
                    onClick={stopSimulation}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2"
                  >
                    <Square size={16} /> STOP
                  </button>
                )}
                <button 
                  onClick={clearMessages}
                  className="p-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-white"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5">
            <h3 className="text-sm font-bold text-zinc-400 mb-4 flex items-center gap-2">
              <BarChart3 size={16} /> LIVE TELEMETRY
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                <p className="text-[10px] text-zinc-500 uppercase">FPS</p>
                <p className={`text-xl font-mono font-bold ${stats.fps < 30 ? 'text-red-500' : 'text-green-500'}`}>
                  {stats.fps}
                </p>
              </div>
              <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                <p className="text-[10px] text-zinc-500 uppercase">Heap Usage (Start/Now)</p>
                <p className="text-xl font-mono font-bold text-blue-400">{stats.startingHeap}MB / {stats.heapSize}MB</p>
              </div>
              <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                <p className="text-[10px] text-zinc-500 uppercase">Avg Payload Size</p>
                <p className={`text-xl font-mono font-bold ${stats.avgPayloadSize > 2048 ? 'text-red-500' : 'text-green-500'}`}>
                  {stats.avgPayloadSize} B
                </p>
              </div>
              <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                <p className="text-[10px] text-zinc-500 uppercase">Max Commit Time</p>
                <p className="text-xl font-mono font-bold text-purple-400">{stats.maxCommitTime.toFixed(2)}ms</p>
              </div>
              <div className="bg-black/20 p-3 rounded-lg border border-white/5 col-span-2">
                <p className="text-[10px] text-zinc-500 uppercase">Total Events Processed</p>
                <p className="text-xl font-mono font-bold text-yellow-500">{stats.totalMessages.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview (The stress test target) */}
        <div className="lg:col-span-2 flex flex-col h-[500px] bg-black/40 rounded-xl border border-white/5 overflow-hidden">
          <div className="p-3 border-b border-white/5 bg-zinc-900/50 flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400">STRESS TEST: VIRTUALIZED CHAT RENDERER</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-[10px] uppercase text-zinc-500">{isRunning ? 'Active' : 'Idle'}</span>
            </div>
          </div>
          
          <div className="flex-1 min-h-0 relative">
            {simulatedMessages.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 gap-2 z-10">
                <MessageSquare size={48} strokeWidth={1} />
                <p className="text-sm italic">Ready for stress test...</p>
              </div>
            )}
            <Virtuoso
              data={simulatedMessages}
              followOutput="smooth"
              initialTopMostItemIndex={simulatedMessages.length - 1}
              className="scrollbar-thin scrollbar-thumb-zinc-800"
              itemContent={(index, msg) => (
                <div key={msg.id} className="flex items-start gap-2 p-2 hover:bg-white/5 transition-colors">
                  <div className="w-6 h-6 rounded-full bg-zinc-800 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-yellow-500 mr-2">{msg.user_profiles?.username}:</span>
                    <span className="text-xs text-zinc-300">{msg.content}</span>
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
