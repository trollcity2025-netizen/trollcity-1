import React, { useState } from 'react'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Coins,
  CreditCard,
  PiggyBank,
  BarChart3,
  RefreshCw,
  Eye,
  EyeOff,
  Target,
  Wallet,
  Banknote,
  Calculator
} from 'lucide-react'

interface FinanceEconomyCenterProps {
  stats: {
    coinSalesRevenue: number
    totalPayouts: number
    feesCollected: number
    platformProfit: number
    totalCoinsInCirculation: number
    purchasedCoins: number
    earnedCoins: number
    freeCoins: number
    giftCoins: number
    total_liability_coins: number
    total_platform_profit_usd: number
  }
  economySummary: any
  economyLoading: boolean
  onLoadEconomySummary: () => void
}

export default function FinanceEconomyCenter({
  stats,
  economySummary,
  economyLoading,
  onLoadEconomySummary
}: FinanceEconomyCenterProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('financial-overview')
  const [showSensitiveData, setShowSensitiveData] = useState(false)

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId)
  }

  const financialMetrics = [
    {
      label: 'Coin Sales Revenue',
      value: stats.coinSalesRevenue,
      format: 'currency',
      icon: <DollarSign className="w-4 h-4" />,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      trend: '+12.5%'
    },
    {
      label: 'Total Payouts',
      value: stats.totalPayouts,
      format: 'currency',
      icon: <CreditCard className="w-4 h-4" />,
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      trend: '+8.2%'
    },
    {
      label: 'Platform Profit',
      value: stats.platformProfit,
      format: 'currency',
      icon: <TrendingUp className="w-4 h-4" />,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
      trend: '+15.3%'
    },
    {
      label: 'Processing Fees',
      value: stats.feesCollected,
      format: 'currency',
      icon: <Calculator className="w-4 h-4" />,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      trend: '+5.1%'
    }
  ]

  const coinMetrics = [
    {
      label: 'Coins in Circulation',
      value: stats.totalCoinsInCirculation,
      format: 'number',
      icon: <Coins className="w-4 h-4" />,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20'
    },
    {
      label: 'Purchased Coins',
      value: stats.purchasedCoins,
      format: 'number',
      icon: <Wallet className="w-4 h-4" />,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20'
    },
    {
      label: 'Earned Coins',
      value: stats.earnedCoins,
      format: 'number',
      icon: <Target className="w-4 h-4" />,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20'
    },
    {
      label: 'Free Coins',
      value: stats.freeCoins,
      format: 'number',
      icon: <PiggyBank className="w-4 h-4" />,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20'
    }
  ]

  const formatValue = (value: number, format: string) => {
    if (format === 'currency') {
      return `$${value.toLocaleString()}`
    }
    return value.toLocaleString()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Financial Overview */}
      <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl overflow-hidden">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
          onClick={() => toggleSection('financial-overview')}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500/20 border border-green-500/30 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Financial Overview</h3>
              <p className="text-xs text-gray-400">Revenue, payouts & profitability</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowSensitiveData(!showSensitiveData)
              }}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              {showSensitiveData ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <RefreshCw className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === 'financial-overview' ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {expandedSection === 'financial-overview' && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              {financialMetrics.map((metric, index) => (
                <div key={index} className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`${metric.bgColor} p-1 rounded`}>
                      <div className={metric.color}>{metric.icon}</div>
                    </div>
                    <span className="text-xs font-medium text-gray-300">{metric.label}</span>
                  </div>
                  <div className="text-lg font-bold text-white mb-1">
                    {showSensitiveData ? formatValue(metric.value, metric.format) : '••••••'}
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-green-400" />
                    <span className="text-xs text-green-400">{metric.trend}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Coin Economy Dashboard */}
      <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl overflow-hidden">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
          onClick={() => toggleSection('coin-economy')}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-500/20 border border-yellow-500/30 rounded-lg flex items-center justify-center">
              <Coins className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Coin Economy Dashboard</h3>
              <p className="text-xs text-gray-400">Coin circulation & distribution</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onLoadEconomySummary()
              }}
              disabled={economyLoading}
              className="p-1 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${economyLoading ? 'animate-spin' : ''}`} />
            </button>
            <RefreshCw className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === 'coin-economy' ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {expandedSection === 'coin-economy' && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {coinMetrics.map((metric, index) => (
                <div key={index} className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`${metric.bgColor} p-1 rounded`}>
                      <div className={metric.color}>{metric.icon}</div>
                    </div>
                    <span className="text-xs font-medium text-gray-300">{metric.label}</span>
                  </div>
                  <div className="text-lg font-bold text-white">
                    {formatValue(metric.value, metric.format)}
                  </div>
                </div>
              ))}
            </div>

            {/* Economy Summary */}
            {economySummary && (
              <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
                <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-cyan-400" />
                  Economy Summary
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Paid Coins Purchased:</span>
                    <span className="text-white font-medium">
                      {economySummary.paidCoins?.totalPurchased?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Outstanding Liability:</span>
                    <span className="text-white font-medium">
                      ${economySummary.paidCoins?.outstandingLiability?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Broadcaster Payouts:</span>
                    <span className="text-white font-medium">
                      ${economySummary.broadcasters?.totalUsdOwed?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Wheel Activity:</span>
                    <span className="text-white font-medium">
                      {economySummary.wheel?.totalSpins?.toLocaleString() || 0} spins
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}