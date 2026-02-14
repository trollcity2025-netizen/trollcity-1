-- Migration: XP Integrity Mode
-- Description: Implements a unified XP Ledger with idempotency and reversal support.

-- 1. Store XP Rates in admin_app_settings
INSERT INTO public.admin_app_settings (setting_key, setting_value, description)
VALUES (
    'xp_rates', 
    '{
        "gifter_base": 1.0,
        "gifter_live_bonus": 1.1,
        "broadcaster_base": 1.0,
        "store_purchase_per_dollar": 5.0,
        "coin_purchase_per_coin": 0.5
    }', 
    'Central source of truth for all XP awarding rates.'
)
ON CONFLICT (setting_key) DO UPDATE 
SET setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- 2. Ensure XP Ledger Table exists and has correct columns
DO $$ 
BEGIN
    -- Create table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'xp_ledger') THEN
        CREATE TABLE public.xp_ledger (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES public.user_profiles(id),
            xp_amount NUMERIC NOT NULL,
            source_type TEXT NOT NULL,
            source_id TEXT NOT NULL,
            reason TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (user_id, source_type, source_id)
        );
    ELSE
        -- Rename 'source' to 'source_type' if it exists
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'xp_ledger' AND column_name = 'source' AND table_schema = 'public') THEN
            ALTER TABLE public.xp_ledger RENAME COLUMN source TO source_type;
        END IF;

        -- Add 'source_type' if it doesn't exist (and 'source' didn't exist to be renamed)
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'xp_ledger' AND column_name = 'source_type' AND table_schema = 'public') THEN
            ALTER TABLE public.xp_ledger ADD COLUMN source_type TEXT NOT NULL DEFAULT 'unknown';
            ALTER TABLE public.xp_ledger ALTER COLUMN source_type DROP DEFAULT;
        END IF;

        -- Add 'reason' if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'xp_ledger' AND column_name = 'reason' AND table_schema = 'public') THEN
            ALTER TABLE public.xp_ledger ADD COLUMN reason TEXT;
        END IF;

        -- Ensure xp_amount is NUMERIC (it might be BIGINT)
        ALTER TABLE public.xp_ledger ALTER COLUMN xp_amount TYPE NUMERIC;

        -- Update Unique Constraint: First drop existing ones that might conflict
        -- We want (user_id, source_type, source_id) to be unique
        BEGIN
            ALTER TABLE public.xp_ledger DROP CONSTRAINT IF EXISTS xp_ledger_source_source_id_key;
            ALTER TABLE public.xp_ledger DROP CONSTRAINT IF EXISTS xp_ledger_user_id_source_type_source_id_key;
            ALTER TABLE public.xp_ledger DROP CONSTRAINT IF EXISTS xp_ledger_user_source_idempotency;
            -- Added: drop legacy source_id index if it exists as a constraint
            ALTER TABLE public.xp_ledger DROP CONSTRAINT IF EXISTS xp_ledger_source_id_key;
        EXCEPTION WHEN OTHERS THEN 
            -- Ignore errors if constraints don't exist
        END;

        -- Add the new unified unique constraint
        ALTER TABLE public.xp_ledger ADD CONSTRAINT xp_ledger_user_source_idempotency UNIQUE (user_id, source_type, source_id);
    END IF;
END $$;

-- 2b. Ensure user_profiles has total_xp column
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'total_xp') THEN
        ALTER TABLE public.user_profiles ADD COLUMN total_xp NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Index for fast lookups by user and source
CREATE INDEX IF NOT EXISTS idx_xp_ledger_user_source ON public.xp_ledger (user_id, source_type, source_id);

-- 3. Fix reverse_xp logic to correctly handle idempotency of reversals
CREATE OR REPLACE FUNCTION public.reverse_xp(
    p_source_type TEXT,
    p_source_id TEXT,
    p_reason TEXT DEFAULT 'reversal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_reversed_count INT := 0;
    v_total_reversed_xp NUMERIC := 0;
    v_reversal_id TEXT;
BEGIN
    -- Find all original XP awards for this source
    FOR v_record IN 
        SELECT id, user_id, xp_amount 
        FROM public.xp_ledger 
        WHERE source_type = p_source_type 
        AND source_id = p_source_id
        AND xp_amount > 0 -- Only reverse positive awards
    LOOP
        -- Reversal ID is fixed per record to ensure idempotency
        v_reversal_id := p_source_id || '_rev_' || v_record.id;

        -- Insert negative entry into ledger
        INSERT INTO public.xp_ledger (
            user_id, xp_amount, source_type, source_id, reason, metadata
        ) VALUES (
            v_record.user_id, 
            -v_record.xp_amount, 
            p_source_type || '_reversal', 
            v_reversal_id, 
            p_reason, 
            jsonb_build_object('original_ledger_id', v_record.id)
        )
        ON CONFLICT (user_id, source_type, source_id) DO NOTHING;

        -- If row was inserted, update profile
        IF FOUND THEN
            UPDATE public.user_profiles
            SET total_xp = GREATEST(0, COALESCE(total_xp, 0) - v_record.xp_amount)
            WHERE id = v_record.user_id;

            v_reversed_count := v_reversed_count + 1;
            v_total_reversed_xp := v_total_reversed_xp + v_record.xp_amount;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'reversed_count', v_reversed_count, 
        'total_reversed_xp', v_total_reversed_xp
    );
END;
$$;

-- 4. Unified grant_xp function with Idempotency
CREATE OR REPLACE FUNCTION public.grant_xp(
    p_user_id UUID,
    p_amount NUMERIC,
    p_source_type TEXT,
    p_source_id TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_xp_total NUMERIC;
    v_level_info RECORD;
BEGIN
    -- 1. Idempotency Check (Handled by UNIQUE constraint + ON CONFLICT DO NOTHING)
    INSERT INTO public.xp_ledger (
        user_id, xp_amount, source_type, source_id, reason, metadata
    ) VALUES (
        p_user_id, p_amount, p_source_type, p_source_id, COALESCE(p_reason, p_source_type), p_metadata
    )
    ON CONFLICT (user_id, source_type, source_id) DO NOTHING;

    -- If no row was inserted, it means it's a duplicate request
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', true, 'message', 'XP already awarded for this transaction.', 'status', 'idempotent_skip');
    END IF;

    -- 2. Update user_profiles total XP (New Source of Truth)
    UPDATE public.user_profiles
    SET total_xp = COALESCE(total_xp, 0) + p_amount
    WHERE id = p_user_id
    RETURNING total_xp INTO v_new_xp_total;

    -- 3. Maintain backward compatibility with user_stats if it exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_stats') THEN
        -- Recalculate level using existing logic if available
        BEGIN
            SELECT lvl, xp_for_next_level, progress 
            INTO v_level_info
            FROM public.calculate_level_details(v_new_xp_total::BIGINT);

            INSERT INTO public.user_stats (user_id, xp_total, level, xp_to_next_level, xp_progress, updated_at)
            VALUES (p_user_id, v_new_xp_total, v_level_info.lvl, v_level_info.xp_for_next_level, v_level_info.progress, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                xp_total = v_new_xp_total,
                level = v_level_info.lvl,
                xp_to_next_level = v_level_info.xp_for_next_level,
                xp_progress = v_level_info.progress,
                updated_at = NOW();
        EXCEPTION WHEN OTHERS THEN
            -- Fallback if calculate_level_details or user_stats has issues
            UPDATE public.user_stats SET xp_total = v_new_xp_total, updated_at = NOW() WHERE user_id = p_user_id;
        END;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'xp_awarded', p_amount, 
        'new_total_xp', v_new_xp_total
    );
END;
$$;

-- 5. Server-Validated process_gift_xp
CREATE OR REPLACE FUNCTION public.process_gift_xp(
    p_gift_tx_id UUID,
    p_stream_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_gift_record RECORD;
    v_stream_record RECORD;
    v_xp_rates JSONB;
    v_is_live BOOLEAN := false;
    v_gifter_rate NUMERIC;
    v_gifter_xp NUMERIC;
    v_broadcaster_xp NUMERIC;
    v_sender_ip TEXT;
    v_sender_fingerprint TEXT;
BEGIN
    -- 1. Fetch Gift Transaction (Must exist and be processed)
    -- Checking gift_ledger which is the source of truth for processed gifts
    SELECT * INTO v_gift_record
    FROM public.gift_ledger
    WHERE id = p_gift_tx_id;

    IF NOT FOUND THEN
        -- Fallback to gifts table if gift_ledger doesn't have it (older schema support)
        SELECT id, sender_id, receiver_id, coins_spent as amount, stream_id, metadata INTO v_gift_record
        FROM public.gifts
        WHERE id = p_gift_tx_id;
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'message', 'Gift transaction not found.');
        END IF;
    END IF;

    -- 2. Anti-Farming: Self-Gifting Check
    IF v_gift_record.sender_id = v_gift_record.receiver_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Self-gifting does not award XP.');
    END IF;

    -- 2b. Fraud Detection: Fingerprint/IP Sharing
    -- If sender and receiver share the same fingerprint or IP, we log it and potentially flag the account.
    -- For now, we will allow the XP but mark it as 'suspicious' in the ledger metadata.
    IF (v_gift_record.metadata->>'fingerprint' IS NOT NULL AND 
        v_gift_record.metadata->>'fingerprint' = v_gift_record.metadata->>'receiver_fingerprint') OR
       (v_gift_record.metadata->>'ip_address' IS NOT NULL AND 
        v_gift_record.metadata->>'ip_address' = v_gift_record.metadata->>'receiver_ip') THEN
        
        -- Add suspicious flag to metadata for both awards
        -- This can be used later by admins to audit or automatically ban.
        v_gift_record.metadata := v_gift_record.metadata || '{"suspicious": true, "reason": "shared_identity"}'::jsonb;
    END IF;

    -- 3. Fetch XP Rates from Single Source of Truth
    SELECT setting_value INTO v_xp_rates
    FROM public.admin_app_settings
    WHERE setting_key = 'xp_rates';

    -- 4. Server-Side Live Validation
    IF p_stream_id IS NOT NULL THEN
        SELECT * INTO v_stream_record
        FROM public.streams
        WHERE id = p_stream_id AND (status = 'active' OR is_live = true);
        
        IF FOUND THEN
            v_is_live := true;
        END IF;
    END IF;

    -- 5. Calculate XP
    v_gifter_rate := CASE WHEN v_is_live THEN (v_xp_rates->>'gifter_live_bonus')::numeric ELSE (v_xp_rates->>'gifter_base')::numeric END;
    v_gifter_xp := FLOOR(v_gift_record.amount * v_gifter_rate);
    v_broadcaster_xp := FLOOR(v_gift_record.amount * (v_xp_rates->>'broadcaster_base')::numeric);

    -- 6. Award XP (Idempotent calls)
    PERFORM public.grant_xp(
        v_gift_record.sender_id, 
        v_gifter_xp, 
        'gift_sent', 
        p_gift_tx_id::text, 
        jsonb_build_object('receiver_id', v_gift_record.receiver_id, 'is_live', v_is_live)
    );

    PERFORM public.grant_xp(
        v_gift_record.receiver_id, 
        v_broadcaster_xp, 
        'gift_received', 
        p_gift_tx_id::text, 
        jsonb_build_object('sender_id', v_gift_record.sender_id, 'is_live', v_is_live)
    );

    RETURN jsonb_build_object(
        'success', true, 
        'is_live', v_is_live, 
        'gifter_xp', v_gifter_xp, 
        'broadcaster_xp', v_broadcaster_xp
    );
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.grant_xp(UUID, NUMERIC, TEXT, TEXT, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_xp(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_gift_xp(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_gift_xp(UUID, UUID) TO service_role;
