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
  ) => Promise<LiveKitService | null>
  disconnect: () => void
  toggleCamera: () => Promise<boolean>
  toggleMicrophone: () => Promise<boolean>
  enableCamera: () => Promise<boolean>
  enableMicrophone: () => Promise<boolean>
  disableGuestMedia: (participantId: string, disableVideo: boolean, disableAudio: boolean) => Promise<boolean>
  disableGuestMediaByClick: (participantId: string) => Promise<boolean>
  startPublishing: () => Promise<void>
  getRoom: () => any | null
  markClientDisconnectIntent: () => void
}

// Context holds the LiveKitService plus state helpers
export const LiveKitContext = createContext<LiveKitContextValue | null>(null)

