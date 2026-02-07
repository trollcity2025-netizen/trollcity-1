import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export interface PurchasableItem {
  id: string;
  item_key: string;
  display_name: string;
  category: string;
  coin_price: number | null;
  usd_price: number | null;
  is_coin_pack: boolean;
  is_active: boolean;
  frontend_source: string;
  metadata: Record<string, any>;
}

export function usePurchasableItems(category?: string) {
  const [items, setItems] = useState<PurchasableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        let query = supabase
          .from('purchasable_items')
          .select('*')
          .eq('is_active', true);

        if (category) {
          query = query.eq('category', category);
        }

        // Order by price (USD or Coins)
        // This is tricky if mixed, but usually we filter by category which has consistent pricing type
        // For coin packs, order by usd_price
        
        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        
        const sortedData = data || [];
        
        if (category === 'coin_pack') {
          sortedData.sort((a, b) => (Number(a.usd_price) || 0) - (Number(b.usd_price) || 0));
        } else if (category === 'gift') {
           sortedData.sort((a, b) => (a.coin_price || 0) - (b.coin_price || 0));
        }

        setItems(sortedData);
      } catch (err: any) {
        console.error('Error fetching purchasable items:', err);
        setError(err);
        toast.error('Failed to load store items');
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [category]);

  return { items, loading, error };
}
