import { createContext } from 'react'
import { LiveKitParticipant, LiveKitService, LiveKitServiceConfig } from '../lib/LiveKitService'

export interface LiveKitContextValue {
  service: LiveKitService
  isConnected: boolean
  isConnecting: boolean
  participants: Map<string, LiveKitParticipant>
  localParticipant: LiveKitParticipant | null
  error: string | null
  connect: (
    roomName: string,
    user: any,
    options?: Partial<LiveKitServiceConfig>
  ) => Promise<boolean>
  disconnect: () => void
  toggleCamera: () => Promise<boolean>
  toggleMicrophone: () => Promise<boolean>
  startPublishing: () => Promise<void>
  getRoom: () => any | null
}

// Context holds the LiveKitService plus state helpers
export const LiveKitContext = createContext<LiveKitContextValue | null>(null)

