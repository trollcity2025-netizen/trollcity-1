import React from 'react'
import { Trophy, Coins, X } from 'lucide-react'
import { useAuthStore } from '../../lib/store'

interface BattleWinnerModalProps {
  isOpen: boolean
  onClose: () => void
  winnerId: string | null
  broadcaster1Id: string
  broadcaster2Id: string
  broadcaster1Coins: number
  broadcaster2Coins: number
  broadcaster1Name?: string
  broadcaster2Name?: string
}

export default function BattleWinnerModal({
  isOpen,
  onClose,
  winnerId,
  broadcaster1Id,
  broadcaster2Id,
  broadcaster1Coins,
  broadcaster2Coins,
  broadcaster1Name,
  broadcaster2Name,
}: BattleWinnerModalProps) {
  const { user } = useAuthStore()
  const isWinner = winnerId === user?.id
  const isTie = winnerId === null

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="bg-troll-dark-bg border-4 border-troll-gold rounded-lg p-8 w-full max-w-lg relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {isTie ? (
          <div className="text-center">
            <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-2">It's a Tie!</h2>
            <p className="text-gray-400 mb-6">Both broadcasters received the same amount of paid coins.</p>
            <div className="bg-black/50 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">@{broadcaster1Name || 'Broadcaster 1'}</span>
                <span className="text-troll-gold font-bold">{broadcaster1Coins.toLocaleString()} coins</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">@{broadcaster2Name || 'Broadcaster 2'}</span>
                <span className="text-troll-gold font-bold">{broadcaster2Coins.toLocaleString()} coins</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="relative mb-6">
              <Trophy className="w-24 h-24 text-troll-gold mx-auto animate-bounce" />
              {isWinner && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-4xl font-bold text-troll-gold animate-pulse">YOU WON!</div>
                </div>
              )}
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-2">
              {isWinner ? 'Victory!' : 'Battle Complete'}
            </h2>
            
            <p className="text-gray-400 mb-6">
              {isWinner
                ? 'Congratulations! You won the battle and earned rewards!'
                : `@${winnerId === broadcaster1Id ? broadcaster1Name : broadcaster2Name} won the battle!`}
            </p>

            <div className="bg-black/50 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className={`${winnerId === broadcaster1Id ? 'text-troll-gold font-bold' : 'text-gray-400'}`}>
                  @{broadcaster1Name || 'Broadcaster 1'}
                  {winnerId === broadcaster1Id && <Trophy className="w-4 h-4 inline ml-2" />}
                </span>
                <span className="text-troll-gold font-bold">{broadcaster1Coins.toLocaleString()} coins</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`${winnerId === broadcaster2Id ? 'text-troll-gold font-bold' : 'text-gray-400'}`}>
                  @{broadcaster2Name || 'Broadcaster 2'}
                  {winnerId === broadcaster2Id && <Trophy className="w-4 h-4 inline ml-2" />}
                </span>
                <span className="text-troll-gold font-bold">{broadcaster2Coins.toLocaleString()} coins</span>
              </div>
            </div>

            {isWinner && (
              <div className="bg-troll-neon-green/20 border border-troll-neon-green rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-troll-neon-green mb-2">
                  <Coins className="w-5 h-5" />
                  <span className="font-semibold">Rewards Earned:</span>
                </div>
                <ul className="text-left text-sm text-gray-300 space-y-1">
                  <li>🏆 Trophy Badge: Battle Champion</li>
                  <li>💰 Coin Multiplier: 10% bonus for 24 hours</li>
                  <li>📊 Battle added to your profile history</li>
                </ul>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-troll-neon-blue hover:bg-troll-neon-green text-white rounded-lg font-semibold transition-colors"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

