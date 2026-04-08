-- Advertisement Queue System Update
-- Add queue positions, slot tracking, and rotation logic

ALTER TABLE public.user_advertisements 
ADD COLUMN IF NOT EXISTS queue_position INTEGER,
ADD COLUMN IF NOT EXISTS is_active_slot BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS slot_start_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS display_duration_seconds INTEGER DEFAULT 604800; -- 7 days per ad slot

-- Update status options
ALTER TABLE public.user_advertisements 
DROP CONSTRAINT IF EXISTS user_advertisements_status_check;

ALTER TABLE public.user_advertisements
ADD CONSTRAINT user_advertisements_status_check 
CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'queued', 'active'));

-- Function to manage ad queue rotation
CREATE OR REPLACE FUNCTION public.rotate_ad_queue()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_ad UUID;
    v_current_active UUID;
    v_current_slot_start TIMESTAMP WITH TIME ZONE;
    v_rotation_count INT := 0;
BEGIN
    -- Check for expired active ads
    SELECT id, slot_start_time INTO v_current_active, v_current_slot_start
    FROM public.user_advertisements
    WHERE status = 'active'
    ORDER BY slot_start_time ASC
    LIMIT 1;

    -- Rotate if current ad has been active for 7 days
    IF v_current_active IS NOT NULL AND 
       v_current_slot_start < (NOW() - INTERVAL '7 days') THEN
        
        -- Mark current ad as expired/queued
        UPDATE public.user_advertisements
        SET status = 'queued', is_active_slot = false
        WHERE id = v_current_active;

        v_rotation_count := v_rotation_count + 1;

        -- Get next ad in queue
        SELECT id INTO v_next_ad
        FROM public.user_advertisements
        WHERE status = 'queued'
        ORDER BY queue_position ASC, approved_at ASC
        LIMIT 1;

        IF v_next_ad IS NOT NULL THEN
            -- Activate next ad
            UPDATE public.user_advertisements
            SET 
                status = 'active', 
                is_active_slot = true,
                slot_start_time = NOW()
            WHERE id = v_next_ad;

            v_rotation_count := v_rotation_count + 1;
        END IF;
    END IF;

    -- If no active ad at all, activate first in queue
    IF v_current_active IS NULL THEN
        SELECT id INTO v_next_ad
        FROM public.user_advertisements
        WHERE status = 'queued'
        ORDER BY queue_position ASC, approved_at ASC
        LIMIT 1;

        IF v_next_ad IS NOT NULL THEN
            UPDATE public.user_advertisements
            SET 
                status = 'active', 
                is_active_slot = true,
                slot_start_time = NOW()
            WHERE id = v_next_ad;

            v_rotation_count := v_rotation_count + 1;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'rotations_performed', v_rotation_count,
        'current_active_ad', v_current_active,
        'next_active_ad', v_next_ad
    );
END;
$$;

-- Function to add approved ad to queue
CREATE OR REPLACE FUNCTION public.add_ad_to_queue(p_ad_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_max_position INTEGER;
BEGIN
    SELECT COALESCE(MAX(queue_position), 0) + 1 INTO v_max_position
    FROM public.user_advertisements
    WHERE status = 'queued';

    UPDATE public.user_advertisements
    SET 
        status = 'queued',
        queue_position = v_max_position
    WHERE id = p_ad_id;

    RETURN jsonb_build_object('success', true, 'queue_position', v_max_position);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rotate_ad_queue() TO service_role;
GRANT EXECUTE ON FUNCTION public.add_ad_to_queue(UUID) TO authenticated;
