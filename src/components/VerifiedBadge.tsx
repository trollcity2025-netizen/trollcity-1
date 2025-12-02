import React from 'react'

interface VerifiedBadgeProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  title?: string
}

export default function VerifiedBadge({ className = '', size = 'sm', title = 'Verified User' }: VerifiedBadgeProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  return (
    <svg
      className={`inline-block ${sizeClasses[size]} ml-1 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      title={title}
    >
      <circle cx="12" cy="12" r="10" fill="#3B82F6" opacity="0.2" />
      <circle cx="12" cy="12" r="9" stroke="#3B82F6" strokeWidth="2" />
      <path
        d="M9 12l2 2 4-4"
        stroke="#3B82F6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="10" fill="url(#glow)" opacity="0.3" />
      <defs>
        <radialGradient id="glow" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  )
}

