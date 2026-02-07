-- View for Item-Level Revenue Stats
-- Aggregates sales data per item from the purchase_ledger

CREATE OR REPLACE VIEW public.view_item_revenue_stats AS
SELECT 
  pi.id,
  pi.item_key,
  pi.display_name,
  pi.category,
  pi.coin_price,
  pi.usd_price,
  pi.is_coin_pack,
  pi.is_active,
  pi.frontend_source,
  COALESCE(COUNT(pl.id), 0) as units_sold,
  COALESCE(SUM(pl.coin_amount), 0) as total_coins_earned,
  COALESCE(SUM(pl.usd_amount), 0) as total_usd_earned,
  MAX(pl.created_at) as last_purchased_at
FROM 
  public.purchasable_items pi
LEFT JOIN 
  public.purchase_ledger pl ON pi.id = pl.item_id
GROUP BY 
  pi.id, pi.item_key, pi.display_name, pi.category, pi.coin_price, pi.usd_price, pi.is_coin_pack, pi.is_active, pi.frontend_source;

GRANT SELECT ON public.view_item_revenue_stats TO authenticated;
