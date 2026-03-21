-- Broadcast Lockdown SQL Migration
-- Run this to set up the broadcast lockdown functionality

-- Step 1: Create the admin_settings table if it doesn't exist (add key column for compatibility)
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT DEFAULT '{}',
    description TEXT,
    key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create the broadcast_lockdown_enabled setting if it doesn't exist
INSERT INTO public.admin_settings (setting_key, setting_value, description, key)
VALUES ('broadcast_lockdown_enabled', '{"enabled": false}', 'Controls whether broadcasting is disabled for all users', 'broadcast_lockdown_enabled')
ON CONFLICT (setting_key) DO NOTHING;

-- Step 3: Fix the existing setting_value - use proper JSON format
UPDATE public.admin_settings 
SET setting_value = '{"enabled": false}'
WHERE setting_key = 'broadcast_lockdown_enabled' 
AND (
    setting_value IS NULL 
    OR setting_value NOT LIKE '%enabled%'
);

-- Step 4: Fix the key column if null
UPDATE public.admin_settings 
SET key = 'broadcast_lockdown_enabled' 
WHERE setting_key = 'broadcast_lockdown_enabled' AND key IS NULL;

-- Step 5: Enable RLS on admin_settings if not already enabled
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Step 6: Create policy to allow anyone to read the broadcast_lockdown_enabled setting
DROP POLICY IF EXISTS "public_read_broadcast_lockdown" ON public.admin_settings;
CREATE POLICY "public_read_broadcast_lockdown" ON public.admin_settings
    FOR SELECT
    USING (setting_key = 'broadcast_lockdown_enabled');

-- Step 7: Create policy to allow authenticated users to read all settings
DROP POLICY IF EXISTS "authenticated_read_all_settings" ON public.admin_settings;
CREATE POLICY "authenticated_read_all_settings" ON public.admin_settings
    FOR SELECT
    TO authenticated
    USING (true);

-- Step 8: Create policy to allow admins to update settings
DROP POLICY IF EXISTS "admin_update_settings" ON public.admin_settings;
CREATE POLICY "admin_update_settings" ON public.admin_settings
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true)
        )
    );

-- Step 9: Create function to check if broadcast is locked (handles text)
CREATE OR REPLACE FUNCTION public.is_broadcast_locked()
RETURNS BOOLEAN AS $$
DECLARE
    is_locked BOOLEAN := false;
    setting_val TEXT;
BEGIN
    SELECT setting_value INTO setting_val
    FROM public.admin_settings
    WHERE setting_key = 'broadcast_lockdown_enabled'
    LIMIT 1;
    
    IF setting_val IS NOT NULL AND setting_val LIKE '%enabled%true%' THEN
        is_locked := true;
    END IF;
    
    RETURN is_locked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_broadcast_locked() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_broadcast_locked() TO anon;

-- Step 10: Create trigger function to block stream creation when locked
CREATE OR REPLACE FUNCTION public.check_broadcast_lockdown_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF public.is_broadcast_locked() THEN
        RAISE EXCEPTION 'Broadcasting is currently disabled by admin. Please try again later.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 11: Create trigger on streams table (only if streams table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'streams' AND table_schema = 'public') THEN
        -- Drop existing trigger if it exists
        DROP TRIGGER IF EXISTS prevent_stream_when_locked ON public.streams;
        
        -- Create trigger
        CREATE TRIGGER prevent_stream_when_locked
            BEFORE INSERT ON public.streams
            FOR EACH ROW
            EXECUTE FUNCTION public.check_broadcast_lockdown_trigger();
            
        RAISE NOTICE 'Broadcast lockdown trigger created on streams table';
    ELSE
        RAISE NOTICE 'Streams table not found, trigger not created';
    END IF;
END
$$;

-- Show current status
SELECT 
    setting_key, 
    setting_value, 
    description, 
    created_at, 
    updated_at
FROM public.admin_settings
WHERE setting_key = 'broadcast_lockdown_enabled';
