-- Migration: Fix Troll Battle Notification Trigger
-- Updates notify_troll_battle_complete to use host_id/challenger_id instead of player1_id/player2_id

CREATE OR REPLACE FUNCTION notify_troll_battle_complete() RETURNS TRIGGER AS $$
DECLARE
    v_winner_name TEXT;
    v_host_name TEXT;
    v_challenger_name TEXT;
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        SELECT username INTO v_winner_name FROM public.user_profiles WHERE id = NEW.winner_id;
        SELECT username INTO v_host_name FROM public.user_profiles WHERE id = NEW.host_id;
        SELECT username INTO v_challenger_name FROM public.user_profiles WHERE id = NEW.challenger_id;
        
        PERFORM public.notify_admins(
            'battle_result',
            'Troll Battle Completed',
            'Battle between ' || COALESCE(v_host_name, 'Unknown') || ' and ' || COALESCE(v_challenger_name, 'Unknown') || ' has ended. Winner: ' || COALESCE(v_winner_name, 'None'),
            jsonb_build_object('battle_id', NEW.id, 'winner_id', NEW.winner_id),
            'normal'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
