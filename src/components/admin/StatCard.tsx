import React from 'react'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon?: LucideIcon
  color?: string
  loading?: boolean
}

export function StatCard({ title, value, icon: Icon, color = 'bg-purple-500', loading }: StatCardProps) {
  return (
    <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2C2C2C] flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        {Icon && <Icon className="w-5 h-5 text-gray-400" />}
        <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center`}>
          <span className="text-white text-sm font-bold">
            {loading ? '…' : value}
          </span>
        </div>
      </div>
      <h3 className="text-white text-sm font-semibold">{title}</h3>
    </div>
  )
}

