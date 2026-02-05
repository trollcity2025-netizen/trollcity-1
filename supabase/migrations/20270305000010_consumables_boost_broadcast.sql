-- Trigger to update broadcaster_stats when a broadcast consumable is purchased
-- This treats purchased broadcast features (consumables) as "gifts" to oneself for leveling purposes.

CREATE OR REPLACE FUNCTION public.handle_broadcast_consumable_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only process broadcast_consumable items
    IF NEW.item_type = 'broadcast_consumable' THEN
        -- Upsert stats for the purchaser (broadcaster)
        INSERT INTO public.broadcaster_stats (user_id, total_gifts_all_time, total_gifts_24h, last_updated_at)
        VALUES (NEW.user_id, NEW.purchase_price, NEW.purchase_price, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
            total_gifts_all_time = broadcaster_stats.total_gifts_all_time + NEW.purchase_price,
            total_gifts_24h = broadcaster_stats.total_gifts_24h + NEW.purchase_price,
            last_updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_broadcast_consumable_purchase ON public.user_purchases;
CREATE TRIGGER on_broadcast_consumable_purchase
    AFTER INSERT ON public.user_purchases
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_broadcast_consumable_purchase();
