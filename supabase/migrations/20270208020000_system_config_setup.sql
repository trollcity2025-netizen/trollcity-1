-- Ensure admin_app_settings table exists and is configured
CREATE TABLE IF NOT EXISTS public.admin_app_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.admin_app_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Admins can manage app settings" ON public.admin_app_settings;
CREATE POLICY "Admins can manage app settings"
    ON public.admin_app_settings
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true)
        )
    );

DROP POLICY IF EXISTS "Public can read public settings" ON public.admin_app_settings;
CREATE POLICY "Public can read public settings"
    ON public.admin_app_settings
    FOR SELECT
    USING (setting_key IN ('maintenance_mode', 'global_announcement', 'coin_usd_rate'));

-- Seed default values
INSERT INTO public.admin_app_settings (setting_key, setting_value, description)
VALUES 
    ('maintenance_mode', '{"enabled": false, "message": "System is under maintenance."}', 'System-wide maintenance mode'),
    ('global_announcement', '{"active": false, "message": "", "type": "info"}', 'Global announcement banner'),
    ('feature_flags', '{"enable_gifting": true, "enable_trading": true}', 'Feature toggles')
ON CONFLICT (setting_key) DO NOTHING;
