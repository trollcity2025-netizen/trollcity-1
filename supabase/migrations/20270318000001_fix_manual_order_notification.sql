CREATE OR REPLACE FUNCTION public.notify_manual_coin_order_v2() RETURNS TRIGGER AS $$
DECLARE
    v_buyer TEXT;
BEGIN
    IF NEW.status = 'pending' THEN
        SELECT username INTO v_buyer FROM public.user_profiles WHERE id = NEW.user_id;
        
        PERFORM public.notify_admins(
            'manual_order_pending',
            'New Manual Coin Order',
            'New order for ' || NEW.coins || ' coins ($' || TRUNC((NEW.amount_cents / 100.0)::NUMERIC, 2) || ') by ' || COALESCE(v_buyer, 'User'),
            jsonb_build_object(
                'order_id', NEW.id, 
                'user_id', NEW.user_id, 
                'link', '/admin/manual-orders'
            ),
            'high'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_manual_coin_order_v2 ON public.manual_coin_orders;
CREATE TRIGGER on_manual_coin_order_v2
    AFTER INSERT ON public.manual_coin_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_manual_coin_order_v2();
