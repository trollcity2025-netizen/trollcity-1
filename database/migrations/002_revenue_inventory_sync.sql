-- Revenue & Inventory Sync Migration
-- 1. Create Purchasable Items Table
CREATE TABLE IF NOT EXISTS public.purchasable_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('coin_pack', 'gift', 'seat', 'stream_feature', 'badge', 'vehicle', 'house', 'upgrade', 'admin_feature', 'other')),
  coin_price integer,
  usd_price numeric,
  is_coin_pack boolean DEFAULT false,
  is_active boolean DEFAULT true,
  frontend_source text,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 2. Create Purchase Ledger Table
CREATE TABLE IF NOT EXISTS public.purchase_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id),
  item_id uuid NOT NULL REFERENCES public.purchasable_items(id),
  coin_amount integer,
  usd_amount numeric,
  payment_method text NOT NULL CHECK (payment_method IN ('coins', 'card', 'manual')),
  source_context text,
  is_refundable boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchasable_items_category ON public.purchasable_items(category);
CREATE INDEX IF NOT EXISTS idx_purchase_ledger_user ON public.purchase_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_ledger_item ON public.purchase_ledger(item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_ledger_created ON public.purchase_ledger(created_at);

-- RLS Policies
ALTER TABLE public.purchasable_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access to purchasable items" ON public.purchasable_items
  FOR SELECT TO authenticated USING (true);

ALTER TABLE public.purchase_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own purchases" ON public.purchase_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Admins/Secretaries can view all (implement via app logic or specific policy if needed)
CREATE POLICY "Admins and Secretaries can view all ledger" ON public.purchase_ledger
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND (role IN ('admin', 'secretary') OR is_admin = true)
    )
  );

-- 3. Revenue Stats View
CREATE OR REPLACE VIEW public.view_secretary_revenue_stats AS
SELECT
  date_trunc('day', pl.created_at) as day,
  SUM(CASE WHEN pi.is_coin_pack = true THEN pl.usd_amount ELSE 0 END) as liability_usd,
  SUM(CASE WHEN pi.is_coin_pack = false THEN pl.usd_amount ELSE 0 END) as operational_revenue_usd,
  SUM(CASE WHEN pi.is_coin_pack = false THEN pl.coin_amount ELSE 0 END) as coins_spent,
  COUNT(*) as transaction_count
FROM
  public.purchase_ledger pl
JOIN
  public.purchasable_items pi ON pl.item_id = pi.id
GROUP BY
  1
ORDER BY
  1 DESC;

GRANT SELECT ON public.view_secretary_revenue_stats TO authenticated;

-- 4. Seed Data
-- Coin Packs
INSERT INTO public.purchasable_items (item_key, display_name, category, usd_price, is_coin_pack, frontend_source, metadata) VALUES
('pkg-300', 'Starter Pack (300 Coins)', 'coin_pack', 1.99, true, 'CoinStore', '{"coins": 300}'),
('pkg-500', 'Small Boost (500 Coins)', 'coin_pack', 3.49, true, 'CoinStore', '{"coins": 500}'),
('pkg-1000', 'Casual Pack (1000 Coins)', 'coin_pack', 6.99, true, 'CoinStore', '{"coins": 1000}'),
('pkg-2500', 'Bronze Pack (2500 Coins)', 'coin_pack', 16.99, true, 'CoinStore', '{"coins": 2500}'),
('pkg-5000', 'Silver Pack (5000 Coins)', 'coin_pack', 33.99, true, 'CoinStore', '{"coins": 5000}'),
('pkg-10000', 'Gold Pack (10000 Coins)', 'coin_pack', 64.99, true, 'CoinStore', '{"coins": 10000}'),
('pkg-15000', 'Platinum Pack (15000 Coins)', 'coin_pack', 89.99, true, 'CoinStore', '{"coins": 15000}'),
('pkg-25000', 'Diamond Pack (25000 Coins)', 'coin_pack', 149.99, true, 'CoinStore', '{"coins": 25000}'),
('pkg-50000', 'Legendary Pack (50000 Coins)', 'coin_pack', 279.99, true, 'CoinStore', '{"coins": 50000}'),
('troll_pass_bundle', 'Troll Pass Premium', 'coin_pack', 9.99, true, 'CoinStore', '{"coins": 1500}')
ON CONFLICT (item_key) DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  usd_price = EXCLUDED.usd_price,
  metadata = EXCLUDED.metadata;

-- Vehicles (Sample)
INSERT INTO public.purchasable_items (item_key, display_name, category, coin_price, is_coin_pack, frontend_source) VALUES
('vehicle-1', 'Troll Compact S1', 'vehicle', 5000, false, 'Dealership'),
('vehicle-2', 'Midline XR', 'vehicle', 12000, false, 'Dealership'),
('vehicle-3', 'Urban Drift R', 'vehicle', 18000, false, 'Dealership'),
('vehicle-4', 'Ironclad GT', 'vehicle', 45000, false, 'Dealership'),
('vehicle-5', 'Vanta LX', 'vehicle', 60000, false, 'Dealership'),
('vehicle-6', 'Phantom X', 'vehicle', 150000, false, 'Dealership'),
('vehicle-7', 'Obsidian One Apex', 'vehicle', 180000, false, 'Dealership'),
('vehicle-8', 'Titan Enforcer', 'vehicle', 500000, false, 'Dealership'),
('vehicle-9', 'Neon Hatch S', 'vehicle', 8000, false, 'Dealership'),
('vehicle-10', 'Courier Spark Bike', 'vehicle', 7000, false, 'Dealership'),
('vehicle-11', 'Apex Trail SUV', 'vehicle', 22000, false, 'Dealership'),
('vehicle-12', 'Quantum Veil', 'vehicle', 220000, false, 'Dealership'),
('vehicle-13', 'Driftline Pulse Bike', 'vehicle', 16000, false, 'Dealership'),
('vehicle-14', 'Regal Meridian', 'vehicle', 85000, false, 'Dealership')
ON CONFLICT (item_key) DO NOTHING;

-- Call Minutes (Audio)
INSERT INTO public.purchasable_items (item_key, display_name, category, coin_price, is_coin_pack, frontend_source, metadata) VALUES
('call-audio-5', 'Audio Call (5 mins)', 'stream_feature', 300, false, 'CoinStore', '{"minutes": 5, "type": "audio"}'),
('call-audio-15', 'Audio Call (15 mins)', 'stream_feature', 800, false, 'CoinStore', '{"minutes": 15, "type": "audio"}'),
('call-audio-30', 'Audio Call (30 mins)', 'stream_feature', 1500, false, 'CoinStore', '{"minutes": 30, "type": "audio"}'),
('call-audio-60', 'Audio Call (60 mins)', 'stream_feature', 2800, false, 'CoinStore', '{"minutes": 60, "type": "audio"}')
ON CONFLICT (item_key) DO NOTHING;

-- Call Minutes (Video)
INSERT INTO public.purchasable_items (item_key, display_name, category, coin_price, is_coin_pack, frontend_source, metadata) VALUES
('call-video-5', 'Video Call (5 mins)', 'stream_feature', 1000, false, 'CoinStore', '{"minutes": 5, "type": "video"}'),
('call-video-15', 'Video Call (15 mins)', 'stream_feature', 2800, false, 'CoinStore', '{"minutes": 15, "type": "video"}'),
('call-video-30', 'Video Call (30 mins)', 'stream_feature', 5000, false, 'CoinStore', '{"minutes": 30, "type": "video"}'),
('call-video-60', 'Video Call (60 mins)', 'stream_feature', 9000, false, 'CoinStore', '{"minutes": 60, "type": "video"}')
ON CONFLICT (item_key) DO NOTHING;

-- Gifts (Sample from Catalog)
INSERT INTO public.purchasable_items (item_key, display_name, category, coin_price, is_coin_pack, frontend_source) VALUES
('love-common-velvet-ember-1', 'Common Velvet Ember', 'gift', 125, false, 'GiftTray'),
('love-common-aurora-bloom-2', 'Common Aurora Bloom', 'gift', 150, false, 'GiftTray'),
('love-rare-aurora-bloom-1', 'Rare Aurora Bloom', 'gift', 285, false, 'GiftTray'),
('love-rare-gilded-rose-2', 'Rare Gilded Rose', 'gift', 310, false, 'GiftTray'),
('love-epic-gilded-rose-1', 'Epic Gilded Rose', 'gift', 525, false, 'GiftTray'),
('love-epic-eternal-wink-2', 'Epic Eternal Wink', 'gift', 550, false, 'GiftTray'),
('love-legendary-eternal-wink-1', 'Legendary Eternal Wink', 'gift', 1105, false, 'GiftTray'),
('love-legendary-velvet-ember-2', 'Legendary Velvet Ember', 'gift', 1130, false, 'GiftTray'),
('love-mythic-velvet-ember-1', 'Mythic Velvet Ember', 'gift', 2205, false, 'GiftTray'),
('love-mythic-aurora-bloom-2', 'Mythic Aurora Bloom', 'gift', 2230, false, 'GiftTray'),
('funny-common-jester-spark-1', 'Common Jester Spark', 'gift', 116, false, 'GiftTray'),
('funny-common-trickster-pulse-2', 'Common Trickster Pulse', 'gift', 141, false, 'GiftTray'),
('funny-rare-trickster-pulse-1', 'Rare Trickster Pulse', 'gift', 276, false, 'GiftTray'),
('funny-rare-banana-slip-2', 'Rare Banana Slip', 'gift', 301, false, 'GiftTray'),
('funny-epic-banana-slip-1', 'Epic Banana Slip', 'gift', 516, false, 'GiftTray'),
('funny-epic-giggle-bomb-2', 'Epic Giggle Bomb', 'gift', 541, false, 'GiftTray')
ON CONFLICT (item_key) DO NOTHING;
