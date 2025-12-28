import { FC } from 'react'

interface OfficerInviteModalProps {
  streamId: string
  isOpen: boolean
  onClose: () => void
  onUserInvited: (userId: string) => void
}

const OfficerInviteModal: FC<OfficerInviteModalProps> = () => null

export default OfficerInviteModal
