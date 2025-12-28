import { FC } from 'react'

interface JoinRequestsPanelProps {
  streamId: string
  isHost: boolean
  onRequestApproved: (userId: string) => void
}

const JoinRequestsPanel: FC<JoinRequestsPanelProps> = () => null

export default JoinRequestsPanel
