import React from 'react'

interface SectionCardProps {
  title: string
  children: React.ReactNode
  className?: string
  headerClassName?: string
}

export function SectionCard({ title, children, className = '', headerClassName = '' }: SectionCardProps) {
  return (
    <div className={`bg-[#1A1A1A] rounded-xl p-4 border border-[#2C2C2C] ${className}`}>
      <h2 className={`text-lg font-bold text-white mb-4 ${headerClassName}`}>{title}</h2>
      {children}
    </div>
  )
}

