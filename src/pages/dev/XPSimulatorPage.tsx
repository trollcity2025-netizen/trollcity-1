import React, { useState } from 'react'
import { xpService } from '../../services/xpService'
import { useXPStore } from '../../stores/useXPStore'
import { useAuthStore } from '../../lib/store'

const XPSimulatorPage = () => {
  const { user } = useAuthStore()
  const { xpTotal, level, xpToNext, progress } = useXPStore()
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])

  const handleSimulateGift = async (amount: number) => {
    if (!user) return
    addLog(`Simulating gift of ${amount} coins...`)
    try {
        const res = await xpService.simulateGift(user.id, amount)
        if (res.success) {
            addLog(`Success! XP Granted.`)
        } else {
            addLog(`Error: ${JSON.stringify(res.error)}`)
        }
    } catch (e: any) {
        addLog(`Exception: ${e.message}`)
    }
  }

  return (
    <div className="p-8 bg-black text-white min-h-screen pl-72">
        <h1 className="text-2xl font-bold mb-4">XP System Simulator</h1>
        
        <div className="grid grid-cols-2 gap-8">
            <div className="p-4 bg-gray-900 rounded border border-gray-700">
                <h2 className="text-xl font-semibold mb-2">Current State</h2>
                <div>XP Total: {xpTotal}</div>
                <div>Level: {level}</div>
                <div>Next Level In: {xpToNext - xpTotal} (Target: {xpToNext})</div>
                <div>Progress: {(progress * 100).toFixed(1)}%</div>
                
                <div className="w-full h-4 bg-gray-700 rounded-full mt-2">
                    <div className="h-full bg-purple-600 rounded-full" style={{ width: `${progress * 100}%` }}></div>
                </div>
            </div>

            <div className="p-4 bg-gray-900 rounded border border-gray-700 space-y-4">
                <h2 className="text-xl font-semibold">Actions</h2>
                <div className="flex gap-2">
                    <button onClick={() => handleSimulateGift(100)} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700">
                        Gift 100 Coins (+100 XP)
                    </button>
                    <button onClick={() => handleSimulateGift(500)} className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700">
                        Gift 500 Coins (+500 XP)
                    </button>
                    <button onClick={() => handleSimulateGift(1000)} className="px-4 py-2 bg-yellow-600 rounded hover:bg-yellow-700">
                        Gift 1000 Coins (+1k XP)
                    </button>
                </div>
            </div>
        </div>

        <div className="mt-8 p-4 bg-gray-900 rounded border border-gray-700 h-64 overflow-y-auto font-mono text-sm">
            {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
    </div>
  )
}

export default XPSimulatorPage
