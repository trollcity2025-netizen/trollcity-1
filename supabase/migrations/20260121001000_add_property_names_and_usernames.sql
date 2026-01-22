-- Add property_name to deeds table for displaying home names on deeds
-- This enables users to set custom names for their properties

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deeds' AND column_name = 'property_name'
    ) THEN
        ALTER TABLE public.deeds ADD COLUMN property_name text;
        COMMENT ON COLUMN public.deeds.property_name IS 'User-defined name for the property (optional)';
    END IF;
END $$;

-- Add username column to deeds for displaying owner names
-- Join with user_profiles to get username for current_owner_user_id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deeds' AND column_name = 'owner_username'
    ) THEN
        ALTER TABLE public.deeds ADD COLUMN owner_username text;
        COMMENT ON COLUMN public.deeds.owner_username IS 'Cached username of current owner for display purposes';
    END IF;
END $$;

-- Similarly, ensure deed_transfers shows property names
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deed_transfers' AND column_name = 'property_name'
    ) THEN
        ALTER TABLE public.deed_transfers ADD COLUMN property_name text;
        COMMENT ON COLUMN public.deed_transfers.property_name IS 'Property name at time of transfer';
    END IF;
END $$;

-- Add seller and buyer usernames to deed_transfers for display
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deed_transfers' AND column_name = 'seller_username'
    ) THEN
        ALTER TABLE public.deed_transfers ADD COLUMN seller_username text;
        COMMENT ON COLUMN public.deed_transfers.seller_username IS 'Cached username of seller at time of transfer';
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deed_transfers' AND column_name = 'buyer_username'
    ) THEN
        ALTER TABLE public.deed_transfers ADD COLUMN buyer_username text;
        COMMENT ON COLUMN public.deed_transfers.buyer_username IS 'Cached username of buyer at time of transfer';
    END IF;
END $$;
