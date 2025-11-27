import React from 'react'
import { useNavigate } from 'react-router-dom'

interface ClickableUsernameProps {
  username: string
  className?: string
  prefix?: string // like '@'
  onClick?: () => void
}

const ClickableUsername: React.FC<ClickableUsernameProps> = ({ 
  username, 
  className = '', 
  prefix = '@',
  onClick 
}) => {
  const navigate = useNavigate()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onClick) {
      onClick()
    }
    navigate(`/profile/${username}`)
  }

  return (
    <span
      onClick={handleClick}
      className={`cursor-pointer hover:text-troll-gold transition-colors ${className}`}
      title={`View ${username}'s profile`}
    >
      {prefix}{username}
    </span>
  )
}

export default ClickableUsername
