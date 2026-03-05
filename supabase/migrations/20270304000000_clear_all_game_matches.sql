-- Migration: Clear all existing game matches and create admin function for clearing matches
-- Created: 2026-03-04

-- Function to clear all game matches (for admin use)
CREATE OR REPLACE FUNCTION public.clear_all_game_matches()
RETURNS JSONB AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete all records from troll_battles table
    DELETE FROM public.troll_battles
    WHERE status IN ('pending', 'active', 'ready', 'finished', 'cancelled');
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'deleted_count', v_deleted_count,
        'message', format('Deleted %s game match(es)', v_deleted_count)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.clear_all_game_matches() TO authenticated, service_role;

-- Also clear matches immediately on migration run
DELETE FROM public.troll_battles WHERE true;

-- Add comment for documentation
COMMENT ON FUNCTION public.clear_all_game_matches() IS 'Clears all game matches from troll_battles table. Use with caution.';
