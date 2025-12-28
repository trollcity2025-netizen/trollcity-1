import { FC } from 'react'
import type { CourtSessionData } from '../lib/courtSessions'

type CourtPhase = 'waiting' | 'opening' | 'evidence' | 'deliberation' | 'verdict'

interface CourtAIAssistantProps {
  courtSession: CourtSessionData | null
  activeCase: Record<string, any> | null
  courtPhase: CourtPhase
  evidence: any[]
  defendant: Record<string, any> | null
  judge: Record<string, any> | null
  verdict: Record<string, any> | null
}

const CourtAIAssistant: FC<CourtAIAssistantProps> = () => null

export default CourtAIAssistant
