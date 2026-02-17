-- Public About/Contact settings for marketing pages
BEGIN;

-- Allow public read for About/Contact settings
DROP POLICY IF EXISTS "Public can read public settings" ON public.admin_app_settings;
CREATE POLICY "Public can read public settings"
    ON public.admin_app_settings
    FOR SELECT
    USING (setting_key IN (
        'maintenance_mode',
        'global_announcement',
        'coin_usd_rate',
        'about_investor_opportunities',
        'public_contact_email'
    ));

-- Seed About/Contact settings
INSERT INTO public.admin_app_settings (setting_key, setting_value, description)
VALUES
    ('about_investor_opportunities', '{"content": ""}', 'About page investor opportunities blurb'),
    ('public_contact_email', '{"email": "trollcity2025@gmail.com"}', 'Public contact email')
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description,
    updated_at = NOW();

COMMIT;
