import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';

// Types
export interface Stock {
  id: string;
  stock_symbol: string;
  name: string;
  type: 'creator' | 'family' | 'property';
  entity_id?: string;
  description?: string;
  base_price: number;
  current_price: number;
  previous_price: number;
  price_change_24h: number;
  price_change_pct_24h: number;
  volume: number;
  market_cap: number;
  high_24h: number;
  low_24h: number;
  activity_score: number;
  demand_factor: number;
  volatility: number;
  is_hyped: boolean;
  hype_ends_at?: string;
  last_updated: string;
  is_active: boolean;
  created_at: string;
}

export interface PortfolioItem {
  stock_symbol: string;
  stock_name: string;
  stock_type: string;
  shares: number;
  avg_price: number;
  current_price: number;
  total_value: number;
  profit_loss: number;
  profit_loss_pct: number;
  stock_id?: string;
}

export interface PortfolioSummary {
  total_value: number;
  total_invested: number;
  total_profit_loss: number;
  profit_loss_pct: number;
  stock_count: number;
}

export interface StockTransaction {
  id: string;
  stock_id: string;
  stock_symbol?: string;
  transaction_type: 'buy' | 'sell';
  shares: number;
  price_per_share: number;
  total_amount: number;
  profit_loss?: number;
  created_at: string;
}

export interface MarketStats {
  total_stocks: number;
  total_volume: number;
  avg_price: number;
  top_gainer_stock: string;
  top_gainer_change: number;
  most_traded_stock: string;
  most_traded_volume: number;
}

export function useStockMarket() {
  const { user } = useAuthStore();
  
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('trending');

  // Debug logging for sort/filter changes
  useEffect(() => {
    console.log('[StockMarket] Sort changed:', sortBy, 'Filter:', filter, 'Stocks count:', stocks.length);
  }, [sortBy, filter, stocks.length]);

  // Fetch all stocks
  const fetchStocks = useCallback(async () => {
    try {
      const query = supabase
        .from('stocks')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      
      if (error) throw error;
      setStocks(data || []);
    } catch (err) {
      console.error('Error fetching stocks:', err);
    }
  }, []);

  // Fetch user's portfolio
  const fetchPortfolio = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Get portfolio items via RPC function
      const { data, error } = await supabase.rpc('get_portfolio_value', {
        p_user_id: user.id
      });
      
      if (error) throw error;
      setPortfolio(data || []);
      
      // Get portfolio summary
      const { data: summaryData, error: summaryError } = await supabase.rpc('get_portfolio_summary', {
        p_user_id: user.id
      });
      
      if (summaryError) throw summaryError;
      if (summaryData && summaryData.length > 0) {
        setPortfolioSummary(summaryData[0]);
      }
    } catch (err) {
      console.error('Error fetching portfolio:', err);
    }
  }, [user?.id]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('stock_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      // Join with stocks to get stock_symbol
      if (data && data.length > 0) {
        const stockIds = [...new Set(data.map(d => d.stock_id))];
        const { data: stocks } = await supabase
          .from('stocks')
          .select('id, stock_symbol')
          .in('id', stockIds);
        
        const stockMap = new Map((stocks || []).map(s => [s.id, s.stock_symbol]));
        setTransactions(data.map(tx => ({
          ...tx,
          stock_symbol: stockMap.get(tx.stock_id) || 'UNKNOWN'
        })));
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  }, [user?.id]);

  // Fetch market stats
  const fetchMarketStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_market_stats');
      
      if (error) throw error;
      if (data && data.length > 0) {
        setMarketStats(data[0]);
      }
    } catch (err) {
      console.error('Error fetching market stats:', err);
    }
  }, []);

  // Buy stock
  const buyStock = useCallback(async (stockId: string, stockSymbol: string, coins: number, userCoins?: number, onSuccess?: () => void) => {
    if (!user?.id) {
      return { success: false, message: 'Please log in to trade' };
    }
    
    if (coins < 10) {
      return { success: false, message: 'Minimum trade is 10 coins' };
    }

    // Frontend validation: check if user has enough coins (including 2% fee)
    const totalWithFee = coins * 1.02;
    if (userCoins !== undefined && userCoins < totalWithFee) {
      return { success: false, message: `Insufficient troll coins. Need ${Math.ceil(totalWithFee).toLocaleString()} (including 2% fee), have ${userCoins.toLocaleString()}` };
    }

    try {
      // Check cooldown first
      const { data: cooldownData } = await supabase.rpc('check_trade_cooldown', {
        p_user_id: user.id,
        p_stock_id: stockId
      });
      
      if (cooldownData && cooldownData.length > 0 && !cooldownData[0].can_trade) {
        return { 
          success: false, 
          message: cooldownData[0].message || 'Please wait before trading this stock again' 
        };
      }

      // Execute buy order
      const { data, error } = await supabase.rpc('execute_buy_order', {
        p_user_id: user.id,
        p_stock_id: stockId,
        p_coins: coins,
        p_stock_symbol: stockSymbol
      });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const result = data[0];
        
        if (result.success) {
          // Update cooldown
          await supabase.rpc('update_trade_cooldown', {
            p_user_id: user.id,
            p_stock_id: stockId
          });
          
          // Refresh data
          await Promise.all([fetchPortfolio(), fetchStocks(), fetchMarketStats()]);
          
          // Call success callback to refresh coins if provided
          if (onSuccess) {
            onSuccess();
          }
          
          return { 
            success: true, 
            message: `Purchased ${result.shares_purchased?.toFixed(4)} shares for ${result.total_spent?.toFixed(2)} coins!`,
            shares: result.shares_purchased,
            price: result.price_per_share,
            total: result.total_spent
          };
        } else {
          return { success: false, message: result.message };
        }
      }
      
      return { success: false, message: 'Unknown error occurred' };
    } catch (err: any) {
      console.error('Buy stock error:', err);
      return { success: false, message: err.message || 'Failed to execute buy order' };
    }
  }, [user?.id, fetchPortfolio, fetchStocks, fetchMarketStats]);

  // Sell stock
  const sellStock = useCallback(async (stockIdOrSymbol: string, shares: number, onSuccess?: () => void) => {
    if (!user?.id) {
      return { success: false, message: 'Please log in to trade' };
    }
    
    if (shares <= 0) {
      return { success: false, message: 'Invalid share amount' };
    }

    try {
      // First, find the stock_id if we have a symbol
      let stockId = stockIdOrSymbol;
      
      // Check if it's a UUID or a symbol
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stockIdOrSymbol);
      
      if (!isUUID) {
        // It's a stock symbol, need to find the ID
        const { data: stockData } = await supabase
          .from('stocks')
          .select('id')
          .eq('stock_symbol', stockIdOrSymbol)
          .single();
        
        if (!stockData) {
          return { success: false, message: 'Stock not found' };
        }
        stockId = stockData.id;
      }

      // Check cooldown
      const { data: cooldownData } = await supabase.rpc('check_trade_cooldown', {
        p_user_id: user.id,
        p_stock_id: stockId
      });
      
      if (cooldownData && cooldownData.length > 0 && !cooldownData[0].can_trade) {
        return { 
          success: false, 
          message: cooldownData[0].message || 'Please wait before trading this stock again' 
        };
      }

      // Execute sell order
      const { data, error } = await supabase.rpc('execute_sell_order', {
        p_user_id: user.id,
        p_stock_id: stockId,
        p_shares: shares
      });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const result = data[0];
        
        if (result.success) {
          // Update cooldown
          await supabase.rpc('update_trade_cooldown', {
            p_user_id: user.id,
            p_stock_id: stockId
          });
          
          // Refresh data
          await Promise.all([fetchPortfolio(), fetchStocks(), fetchMarketStats()]);
          
          // Call success callback to refresh coins if provided
          if (onSuccess) {
            onSuccess();
          }
          
          return { 
            success: true, 
            message: `Sold ${result.shares_sold?.toFixed(4)} shares for ${result.total_received?.toFixed(2)} coins!`,
            shares: result.shares_sold,
            price: result.price_per_share,
            total: result.total_received,
            profit_loss: result.profit_loss
          };
        } else {
          return { success: false, message: result.message };
        }
      }
      
      return { success: false, message: 'Unknown error occurred' };
    } catch (err: any) {
      console.error('Sell stock error:', err);
      return { success: false, message: err.message || 'Failed to execute sell order' };
    }
  }, [user?.id, fetchPortfolio, fetchStocks, fetchMarketStats]);

  // Get filtered and sorted stocks
  const getSortedStocks = useCallback(() => {
    console.log('[getSortedStocks] Sorting with:', sortBy, 'filter:', filter, 'stocks count:', stocks.length);
    if (!stocks || stocks.length === 0) return [];
    
    let filtered = [...stocks];
    
    // Apply filter
    if (filter !== 'all') {
      filtered = filtered.filter(s => s.type === filter);
    }
    
    // Apply sort
    switch (sortBy) {
      case 'trending':
        filtered.sort((a, b) => {
          // First prioritize hyped stocks
          if (a.is_hyped !== b.is_hyped) {
            return a.is_hyped ? -1 : 1;
          }
          // Then by absolute price change (most volatile first)
          return Math.abs(b.price_change_pct_24h || 0) - Math.abs(a.price_change_pct_24h || 0);
        });
        break;
      case 'growth':
        filtered.sort((a, b) => (b.price_change_pct_24h || 0) - (a.price_change_pct_24h || 0));
        break;
      case 'traded':
        filtered.sort((a, b) => (b.volume || 0) - (a.volume || 0));
        break;
      case 'price_desc':
        filtered.sort((a, b) => (b.current_price || 0) - (a.current_price || 0));
        break;
      case 'price_asc':
        filtered.sort((a, b) => (a.current_price || 0) - (b.current_price || 0));
        break;
      default:
        // Default to trending sort
        filtered.sort((a, b) => {
          if (a.is_hyped !== b.is_hyped) {
            return a.is_hyped ? -1 : 1;
          }
          return Math.abs(b.price_change_pct_24h || 0) - Math.abs(a.price_change_pct_24h || 0);
        });
    }
    
    return filtered;
  }, [stocks, filter, sortBy]);

  // Get trending stocks (top gainers + hyped)
  const trendingStocks = useMemo(() => {
    return [...stocks]
      .filter(s => s.is_hyped || s.price_change_pct_24h > 0)
      .sort((a, b) => {
        // Prioritize hyped stocks
        if (a.is_hyped && !b.is_hyped) return -1;
        if (!a.is_hyped && b.is_hyped) return 1;
        // Then by 24h change
        return b.price_change_pct_24h - a.price_change_pct_24h;
      })
      .slice(0, 10);
  }, [stocks]);

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchStocks(),
        fetchPortfolio(),
        fetchTransactions(),
        fetchMarketStats()
      ]);
      setLoading(false);
    };
    
    if (user?.id) {
      loadData();
    }
  }, [user?.id, fetchStocks, fetchPortfolio, fetchTransactions, fetchMarketStats]);

  // Set up real-time subscription for stocks
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('stock-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stocks'
      }, () => {
        // Refresh stocks on any change
        fetchStocks();
        fetchMarketStats();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'stock_transactions',
        filter: `user_id=eq.${user.id}`
      }, () => {
        // Refresh portfolio and transactions on new transaction
        fetchPortfolio();
        fetchTransactions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchStocks, fetchPortfolio, fetchTransactions, fetchMarketStats]);

  // Refresh data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStocks();
      fetchMarketStats();
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [fetchStocks, fetchMarketStats]);

  return {
    stocks,
    trendingStocks,
    portfolio,
    portfolioSummary,
    transactions,
    marketStats,
    loading,
    filter,
    setFilter,
    sortBy,
    setSortBy,
    getSortedStocks,
    buyStock,
    sellStock,
    refresh: () => Promise.all([
      fetchStocks(),
      fetchPortfolio(),
      fetchTransactions(),
      fetchMarketStats()
    ])
  };
}
