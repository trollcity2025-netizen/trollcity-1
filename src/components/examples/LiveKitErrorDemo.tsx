import React from 'react'
import { useLiveKit } from '../../hooks/useLiveKit'
import { useSafeLiveKit, useLiveKitAvailable } from '../../hooks/useSafeLiveKit'
import { LiveKitGuard } from '../LiveKitGuard'

/**
 * Demo component showing the difference between unsafe and safe LiveKit usage
 */

export function UnsafeLiveKitExample() {
  // This will throw an error if LiveKit context is not available
  const liveKit = useLiveKit()
  
  return (
    <div className="p-4 bg-red-100 border border-red-300 rounded">
      <h3 className="font-bold text-red-800">Unsafe Example</h3>
      <p className="text-red-600">This component uses useLiveKit() directly and will crash if context is missing.</p>
      <p>Connected: {liveKit.isConnected ? 'Yes' : 'No'}</p>
    </div>
  )
}

export function SafeLiveKitExample() {
  // This safely checks for LiveKit availability
  const liveKit = useSafeLiveKit()
  const isAvailable = useLiveKitAvailable()
  
  if (!isAvailable) {
    return (
      <div className="p-4 bg-yellow-100 border border-yellow-300 rounded">
        <h3 className="font-bold text-yellow-800">Safe Example</h3>
        <p className="text-yellow-600">LiveKit context is not available yet. Please wait...</p>
      </div>
    )
  }
  
  return (
    <div className="p-4 bg-green-100 border border-green-300 rounded">
      <h3 className="font-bold text-green-800">Safe Example</h3>
      <p className="text-green-600">This component gracefully handles missing LiveKit context.</p>
      <p>Connected: {liveKit.isConnected ? 'Yes' : 'No'}</p>
    </div>
  )
}

export function GuardedLiveKitExample() {
  return (
    <LiveKitGuard fallback={
      <div className="p-4 bg-blue-100 border border-blue-300 rounded">
        <h3 className="font-bold text-blue-800">Guarded Example</h3>
        <p className="text-blue-600">Loading LiveKit context...</p>
      </div>
    }>
      <div className="p-4 bg-purple-100 border border-purple-300 rounded">
        <h3 className="font-bold text-purple-800">Guarded Example</h3>
        <p className="text-purple-600">This component is only rendered when LiveKit is available.</p>
        <p>Using LiveKitGuard component for protection.</p>
      </div>
    </LiveKitGuard>
  )
}

export function LiveKitErrorDemo() {
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-2xl font-bold">LiveKit Error Handling Demo</h2>
      
      <div className="space-y-4">
        <UnsafeLiveKitExample />
        <SafeLiveKitExample />
        <GuardedLiveKitExample />
      </div>
      
      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h3 className="font-bold mb-2">How to Fix the "no room provided" Error:</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>Use <code>useSafeLiveKit()</code> instead of <code>useLiveKit()</code> for conditional logic</li>
          <li>Wrap components with <code>LiveKitGuard</code> for automatic protection</li>
          <li>Use <code>useLiveKitAvailable()</code> to check context before usage</li>
          <li>Provide fallback UI when LiveKit is not available</li>
        </ol>
      </div>
    </div>
  )
}