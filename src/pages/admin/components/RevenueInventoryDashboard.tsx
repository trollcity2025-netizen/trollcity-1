import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  DollarSign, 
  Package, 
  Filter, 
  RefreshCw, 
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';

interface PurchasableItem {
  id: string;
  item_key: string;
  display_name: string;
  category: string;
  coin_price: number | null;
  usd_price: number | null;
  is_coin_pack: boolean;
  is_active: boolean;
  frontend_source: string;
  transaction_count?: number; // Joined later if needed
  units_sold?: number;
  total_usd_earned?: number;
  total_coins_earned?: number;
  last_purchased_at?: string;
}

interface RevenueStat {
  day: string;
  liability_usd: number;
  operational_revenue_usd: number;
  coins_spent: number;
  transaction_count: number;
}

export default function RevenueInventoryDashboard() {
  const [items, setItems] = useState<PurchasableItem[]>([]);
  const [stats, setStats] = useState<RevenueStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isInventoryExpanded, setIsInventoryExpanded] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Inventory
      const { data: itemsData, error: itemsError } = await supabase
        .from('purchasable_items')
        .select('*')
        .order('category', { ascending: true })
        .order('display_name', { ascending: true });

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      // Fetch Stats
      const { data: statsData, error: statsError } = await supabase
        .from('view_secretary_revenue_stats')
        .select('*')
        .limit(30); // Last 30 days

      if (statsError) throw statsError;
      setStats(statsData || []);

    } catch (err: any) {
      console.error('Error fetching revenue data:', err);
      toast.error('Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(items.map(i => i.category));
    return ['all', ...Array.from(cats)];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (filterCategory === 'all') return items;
    return items.filter(i => i.category === filterCategory);
  }, [items, filterCategory]);

  const totalLiability = stats.reduce((sum, s) => sum + (Number(s.liability_usd) || 0), 0);
  const totalRevenue = stats.reduce((sum, s) => sum + (Number(s.operational_revenue_usd) || 0), 0);
  const totalCoinsSpent = stats.reduce((sum, s) => sum + (Number(s.coins_spent) || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-green-400" />
          Revenue & Inventory Sync
        </h2>
        <button 
          onClick={fetchData}
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900/50 border border-red-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <h3 className="text-sm font-medium text-red-200">Total Liability (Coin Packs)</h3>
          </div>
          <div className="text-3xl font-bold text-white">
            ${totalLiability.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-zinc-500 mt-1">Held in reserve until spent</p>
        </div>

        <div className="bg-zinc-900/50 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <h3 className="text-sm font-medium text-green-200">Operational Revenue</h3>
          </div>
          <div className="text-3xl font-bold text-white">
            ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-zinc-500 mt-1">Real income from item sales</p>
        </div>

        <div className="bg-zinc-900/50 border border-yellow-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-yellow-400" />
            </div>
            <h3 className="text-sm font-medium text-yellow-200">Coins Spent</h3>
          </div>
          <div className="text-3xl font-bold text-white">
            {totalCoinsSpent.toLocaleString()}
          </div>
          <p className="text-xs text-zinc-500 mt-1">Total volume of coin transactions</p>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div 
          className="p-4 border-b border-zinc-800 flex items-center justify-between cursor-pointer hover:bg-zinc-800/30 transition-colors"
          onClick={() => setIsInventoryExpanded(!isInventoryExpanded)}
        >
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-white">Live Purchasable Inventory</h3>
            {isInventoryExpanded ? (
              <ChevronUp className="w-4 h-4 text-zinc-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            )}
          </div>
          
          <div 
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Filter className="w-4 h-4 text-zinc-400" />
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-1 outline-none focus:border-purple-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {isInventoryExpanded && (
          <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 uppercase bg-zinc-950/50">
              <tr>
                <th className="px-6 py-3">Item Name</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Price</th>
                <th className="px-6 py-3">Units Sold</th>
                <th className="px-6 py-3">Total Rev.</th>
                <th className="px-6 py-3">Last Sold</th>
                <th className="px-6 py-3">Source</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">
                    {item.display_name}
                    <div className="text-xs text-zinc-500 font-mono mt-0.5">{item.item_key}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-zinc-300">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-300">
                    {item.usd_price ? (
                      <span className="text-green-400">${item.usd_price}</span>
                    ) : (
                      <span className="text-yellow-400">{item.coin_price?.toLocaleString()} 🪙</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-white font-mono">
                    {item.units_sold}
                  </td>
                  <td className="px-6 py-4">
                     {item.usd_price ? (
                      <span className="text-green-400 font-mono">${item.total_usd_earned?.toLocaleString()}</span>
                    ) : (
                      <span className="text-yellow-400 font-mono">{item.total_coins_earned?.toLocaleString()}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-400">
                    {item.last_purchased_at ? new Date(item.last_purchased_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-500">
                    {item.frontend_source}
                  </td>
                  <td className="px-6 py-4">
                    {item.is_active ? (
                      <span className="text-green-400 text-xs font-bold uppercase tracking-wider">Active</span>
                    ) : (
                      <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Inactive</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {item.is_coin_pack ? (
                      <span className="text-red-300 text-xs">Liability (Pack)</span>
                    ) : (
                      <span className="text-green-300 text-xs">Revenue Item</span>
                    )}
                  </td>
                </tr>
              ))}
              
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    No items found matching filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
