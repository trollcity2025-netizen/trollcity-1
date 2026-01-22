-- Create admin_settings table for global broadcast control
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB DEFAULT '{}',
    description TEXT,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure description column exists if table already existed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_settings' AND column_name = 'description') THEN
        ALTER TABLE public.admin_settings ADD COLUMN description TEXT;
    END IF;
END $$;

-- Ensure unique constraint on setting_key exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'admin_settings_setting_key_key'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'admin_settings' AND indexdef LIKE '%(setting_key)%'
    ) THEN
        ALTER TABLE public.admin_settings ADD CONSTRAINT admin_settings_setting_key_key UNIQUE (setting_key);
    END IF;
END $$;

-- Create initial broadcast_lockdown setting
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.admin_settings WHERE setting_key = 'broadcast_lockdown_enabled') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_settings' AND column_name = 'key') THEN
             INSERT INTO public.admin_settings (setting_key, setting_value, description, key)
             VALUES ('broadcast_lockdown_enabled', '{"enabled": false, "admin_broadcast_room": null}', 'Controls whether only admin can broadcast or everyone can', 'broadcast_lockdown_enabled');
        ELSE
             INSERT INTO public.admin_settings (setting_key, setting_value, description)
             VALUES ('broadcast_lockdown_enabled', '{"enabled": false, "admin_broadcast_room": null}', 'Controls whether only admin can broadcast or everyone can');
        END IF;
    END IF;
END $$;

-- Grant permissions
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Only admin can view and update
CREATE POLICY "admin_can_manage_settings" ON public.admin_settings
  USING (
    auth.jwt() ->> 'email' = 'trollcity2025@gmail.com' OR
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    auth.jwt() ->> 'email' = 'trollcity2025@gmail.com' OR
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- Everyone can read broadcast_lockdown_enabled setting
CREATE POLICY "public_read_broadcast_lockdown" ON public.admin_settings
  FOR SELECT
  USING (setting_key = 'broadcast_lockdown_enabled');

-- Ensure at least one admin can always update
GRANT SELECT, INSERT, UPDATE ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;
