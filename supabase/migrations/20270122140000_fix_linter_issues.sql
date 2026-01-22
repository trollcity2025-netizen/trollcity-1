-- Fix linter issues from pleasefix file

-- 1. Enable RLS on tables and add basic policies

-- Helper macro-like approach using DO blocks

-- Table: daily_logins
ALTER TABLE IF EXISTS public.daily_logins ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can read own daily logins" ON public.daily_logins FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: perk_catalog (Public Read)
ALTER TABLE IF EXISTS public.perk_catalog ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public read perk_catalog" ON public.perk_catalog FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: entrance_effect_catalog (Public Read)
ALTER TABLE IF EXISTS public.entrance_effect_catalog ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public read entrance_effect_catalog" ON public.entrance_effect_catalog FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: user_active_entrance_effect
ALTER TABLE IF EXISTS public.user_active_entrance_effect ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own active effect" ON public.user_active_entrance_effect FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: trollmond_transactions
ALTER TABLE IF EXISTS public.trollmond_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own transactions" ON public.trollmond_transactions FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: trollmond_store_items (Public Read)
ALTER TABLE IF EXISTS public.trollmond_store_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public read trollmond_store_items" ON public.trollmond_store_items FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: trollmond_gifts
ALTER TABLE IF EXISTS public.trollmond_gifts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public read trollmond_gifts" ON public.trollmond_gifts FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: coin_audit_log (Admin Only)
ALTER TABLE IF EXISTS public.coin_audit_log ENABLE ROW LEVEL SECURITY;
-- No public policies (deny all by default for non-superusers/service role)

-- Table: properties
ALTER TABLE IF EXISTS public.properties ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public read properties" ON public.properties FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Owners update properties" ON public.properties FOR UPDATE USING (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: property_upgrades
ALTER TABLE IF EXISTS public.property_upgrades ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Owners read upgrades" ON public.property_upgrades FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.properties WHERE id = property_upgrades.property_id AND owner_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: admin_pool (Admin Only)
ALTER TABLE IF EXISTS public.admin_pool ENABLE ROW LEVEL SECURITY;

-- Table: wallets
ALTER TABLE IF EXISTS public.wallets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: coin_orders
ALTER TABLE IF EXISTS public.coin_orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own orders" ON public.coin_orders FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: stripe_customers
ALTER TABLE IF EXISTS public.stripe_customers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own stripe customer" ON public.stripe_customers FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: admin_allocation_buckets (Admin Only)
ALTER TABLE IF EXISTS public.admin_allocation_buckets ENABLE ROW LEVEL SECURITY;

-- Table: live_sessions
ALTER TABLE IF EXISTS public.live_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own live sessions" ON public.live_sessions FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: platform_profit (Admin Only)
ALTER TABLE IF EXISTS public.platform_profit ENABLE ROW LEVEL SECURITY;

-- Table: officer_payroll_logs (Admin/Officer Only)
ALTER TABLE IF EXISTS public.officer_payroll_logs ENABLE ROW LEVEL SECURITY;
-- Policy for officer_payroll_logs (if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'officer_payroll_logs') THEN
    BEGIN
      CREATE POLICY "Officers read own logs" ON public.officer_payroll_logs 
      FOR SELECT USING (auth.uid() = officer_id);
    EXCEPTION WHEN duplicate_object THEN 
      NULL; 
    END;
  END IF;
END $$;

-- Table: admin_coin_pool (Admin Only)
ALTER TABLE IF EXISTS public.admin_coin_pool ENABLE ROW LEVEL SECURITY;

-- Table: admin_pool_buckets (Admin Only)
ALTER TABLE IF EXISTS public.admin_pool_buckets ENABLE ROW LEVEL SECURITY;

-- Table: admin_app_settings (Public Read)
ALTER TABLE IF EXISTS public.admin_app_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public read admin settings" ON public.admin_app_settings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: stream_viewers
ALTER TABLE IF EXISTS public.stream_viewers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public read stream viewers" ON public.stream_viewers FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users insert self as viewer" ON public.stream_viewers FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: platform_revenue (Admin Only)
ALTER TABLE IF EXISTS public.platform_revenue ENABLE ROW LEVEL SECURITY;

-- Table: houses
ALTER TABLE IF EXISTS public.houses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public read houses" ON public.houses FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: car_models (Public Read)
ALTER TABLE IF EXISTS public.car_models ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public read car_models" ON public.car_models FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: matchmaking_queue
ALTER TABLE IF EXISTS public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own queue entry" ON public.matchmaking_queue FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 2. Fix SECURITY DEFINER Views
-- We attempt to set security_invoker = true for all identified views.
-- This requires Postgres 15+. If it fails, the user needs to update Postgres or we need another strategy.
-- We use DO blocks to avoid errors if views don't exist.

DO $$
BEGIN
    -- active_troll_officers
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'active_troll_officers') THEN
        ALTER VIEW public.active_troll_officers SET (security_invoker = true);
    END IF;

    -- v_broadcast_themes_for_user
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_broadcast_themes_for_user') THEN
        ALTER VIEW public.v_broadcast_themes_for_user SET (security_invoker = true);
    END IF;

    -- troll_wall_gifts_summary
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'troll_wall_gifts_summary') THEN
        ALTER VIEW public.troll_wall_gifts_summary SET (security_invoker = true);
    END IF;

    -- district_navigation
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'district_navigation') THEN
        ALTER VIEW public.district_navigation SET (security_invoker = true);
    END IF;

    -- seller_appeals_queue
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'seller_appeals_queue') THEN
        ALTER VIEW public.seller_appeals_queue SET (security_invoker = true);
    END IF;

    -- visa_redemptions_user_view
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'visa_redemptions_user_view') THEN
        ALTER VIEW public.visa_redemptions_user_view SET (security_invoker = true);
    END IF;

    -- v_active_car_insurance
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_active_car_insurance') THEN
        ALTER VIEW public.v_active_car_insurance SET (security_invoker = true);
    END IF;

    -- v_active_property_insurance
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_active_property_insurance') THEN
        ALTER VIEW public.v_active_property_insurance SET (security_invoker = true);
    END IF;

    -- public_user_credit
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'public_user_credit') THEN
        ALTER VIEW public.public_user_credit SET (security_invoker = true);
    END IF;

    -- royal_family_leaderboard
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'royal_family_leaderboard') THEN
        ALTER VIEW public.royal_family_leaderboard SET (security_invoker = true);
    END IF;

    -- live_streams
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'live_streams') THEN
        ALTER VIEW public.live_streams SET (security_invoker = true);
    END IF;

    -- troll_wall_reactions_summary
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'troll_wall_reactions_summary') THEN
        ALTER VIEW public.troll_wall_reactions_summary SET (security_invoker = true);
    END IF;
END $$;
