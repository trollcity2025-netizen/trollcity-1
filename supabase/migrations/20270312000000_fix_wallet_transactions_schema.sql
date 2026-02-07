-- Fix wallet_transactions schema mismatch
-- This migration ensures the table exists and has the required 'type' column

DO $$
BEGIN
    -- 1. Create table if it doesn't exist (based on 20261001002000_live_sessions_wallet_transactions.sql definition)
    CREATE TABLE IF NOT EXISTS public.wallet_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'troll_coins',
        amount INTEGER NOT NULL,
        reason TEXT,
        source TEXT,
        reference_id UUID,
        idempotency_key TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 2. If table exists but 'type' column is missing, add it
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_transactions' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'type') THEN
            ALTER TABLE public.wallet_transactions ADD COLUMN type TEXT;
            
            -- Update existing rows to have a default type if any exist
            UPDATE public.wallet_transactions SET type = 'unknown' WHERE type IS NULL;
            
            -- Set NOT NULL constraint
            ALTER TABLE public.wallet_transactions ALTER COLUMN type SET NOT NULL;
        END IF;
    END IF;

    -- 3. Ensure other columns exist (just in case)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_transactions' AND table_schema = 'public') THEN
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'currency') THEN
            ALTER TABLE public.wallet_transactions ADD COLUMN currency TEXT DEFAULT 'troll_coins' NOT NULL;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'amount') THEN
            ALTER TABLE public.wallet_transactions ADD COLUMN amount INTEGER DEFAULT 0 NOT NULL;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'reason') THEN
            ALTER TABLE public.wallet_transactions ADD COLUMN reason TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'source') THEN
            ALTER TABLE public.wallet_transactions ADD COLUMN source TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'reference_id') THEN
            ALTER TABLE public.wallet_transactions ADD COLUMN reference_id UUID;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'idempotency_key') THEN
            ALTER TABLE public.wallet_transactions ADD COLUMN idempotency_key TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'metadata') THEN
            ALTER TABLE public.wallet_transactions ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb NOT NULL;
        END IF;
    END IF;

    -- 4. Re-apply RLS policies just to be safe
    ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "wallet_transactions_select_own" ON public.wallet_transactions;
    CREATE POLICY "wallet_transactions_select_own" ON public.wallet_transactions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

END $$;
