import { Eye, Coins, ShoppingCart } from "lucide-react";

interface StatsPanelProps {
  viewers: number;
  trollCount: number;
  coins: number;
  onStoreClick?: () => void;
  onTrollClick?: () => void;
}

export default function StatsPanel({
  viewers,
  trollCount,
  coins,
  onStoreClick,
  onTrollClick,
}: StatsPanelProps) {
  return (
    <div className="bg-gradient-to-b from-gray-900 to-black rounded-lg p-4 red-neon">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">STATS</h3>
        <button
          onClick={onStoreClick}
          className="flex items-center gap-1 bg-yellow-600 hover:bg-yellow-700 px-2 py-1 rounded text-xs font-bold transition-colors"
        >
          <ShoppingCart size={14} />
          Store
        </button>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-2 bg-gray-800/50 rounded">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-blue-400" />
            <span className="text-xs text-gray-400">Viewers</span>
          </div>
          <span className="font-bold text-sm">{viewers.toLocaleString()}</span>
        </div>
        <button
          onClick={onTrollClick}
          className="w-full flex items-center justify-between p-2 bg-gray-800/50 rounded hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">👑</span>
            <span className="text-xs text-gray-400">Trolls</span>
          </div>
          <span className="font-bold text-sm text-red-400">
            {trollCount.toLocaleString()}
          </span>
        </button>
        <div className="flex items-center justify-between p-2 bg-gray-800/50 rounded">
          <div className="flex items-center gap-2">
            <Coins size={16} className="text-yellow-400" />
            <span className="text-xs text-gray-400">Coins</span>
          </div>
          <span className="font-bold text-sm">{coins.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
