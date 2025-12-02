import React from 'react'
import { getLevelConfig } from '../lib/officerOWC'

interface OfficerTierBadgeProps {
  level: number
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function OfficerTierBadge({ level, className = '', size = 'sm' }: OfficerTierBadgeProps) {
  const config = getLevelConfig(level)
  
  const colorMap: Record<string, string> = {
    blue: '#3B82F6',
    orange: '#F97316',
    red: '#EF4444',
    purple: '#A855F7',
    gold: '#FBBF24'
  }

  const color = colorMap[config.badgeColor] || colorMap.blue
  const sizeClasses = {
    sm: 'w-4 h-4 text-xs',
    md: 'w-5 h-5 text-sm',
    lg: 'w-6 h-6 text-base'
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: `${color}20`, border: `1px solid ${color}`, color: color }}
      title={`${config.title} - ${config.finalPaidCoinsPerHour.toLocaleString()} paid coins/hr`}
    >
      <span>{config.badgeEmoji}</span>
      <span className="font-semibold">{config.title}</span>
    </span>
  )
}

