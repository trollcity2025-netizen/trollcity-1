import React from 'react'

type Props = { text: string; avatarName?: string }

const MaiDialogBubble: React.FC<Props> = ({ text, avatarName }) => {
  return (
    <div className="max-w-md bg-[#1A1A1A] border border-[#2C2C2C] rounded px-3 py-2 shadow-sm">
      <div className="text-xs text-gray-400 mb-1">{avatarName || 'MAI Avatar'}</div>
      <div className="text-sm">{text}</div>
    </div>
  )
}

export default MaiDialogBubble

