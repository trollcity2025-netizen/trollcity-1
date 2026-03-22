-- City Ads / Promo System Migration
-- Creates the city_ads table for internal Troll City promotional ads

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create city_ads table
CREATE TABLE IF NOT EXISTS public.city_ads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    image_url TEXT NOT NULL,
    cta_text TEXT,
    cta_link TEXT,
    placement TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    priority INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    label TEXT DEFAULT 'Troll City Promo',
    campaign_type TEXT,
    background_style TEXT,
    impressions_count INTEGER DEFAULT 0,
    clicks_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_city_ads_placement_active 
ON public.city_ads(placement, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_city_ads_schedule 
ON public.city_ads(start_at, end_at) 
WHERE start_at IS NOT NULL OR end_at IS NOT NULL;

-- Add check constraint for valid placements
ALTER TABLE public.city_ads 
ADD CONSTRAINT valid_placement 
CHECK (placement IN ('left_sidebar_screensaver', 'right_panel_featured'));

-- Add check constraint for date range validation
ALTER TABLE public.city_ads 
ADD CONSTRAINT valid_date_range 
CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_city_ads_updated_at ON public.city_ads;
CREATE TRIGGER update_city_ads_updated_at
    BEFORE UPDATE ON public.city_ads
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.city_ads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Admins and secretaries can do everything
CREATE POLICY "Admins can do everything with city_ads"
    ON public.city_ads FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR role = 'secretary')
        )
        OR
        EXISTS (
            SELECT 1 FROM public.secretary_assignments
            WHERE secretary_id = auth.uid()
        )
    );

-- Create helper function to get active ads for a placement
CREATE OR REPLACE FUNCTION public.get_active_ads_for_placement(
    p_placement TEXT,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    subtitle TEXT,
    description TEXT,
    image_url TEXT,
    cta_text TEXT,
    cta_link TEXT,
    placement TEXT,
    is_active BOOLEAN,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    priority INTEGER,
    display_order INTEGER,
    label TEXT,
    campaign_type TEXT,
    background_style TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id, a.title, a.subtitle, a.description, a.image_url,
        a.cta_text, a.cta_link, a.placement, a.is_active,
        a.start_at, a.end_at, a.priority, a.display_order,
        a.label, a.campaign_type, a.background_style, a.created_at
    FROM public.city_ads a
    WHERE a.placement = p_placement
        AND a.is_active = true
        AND (a.start_at IS NULL OR a.start_at <= now())
        AND (a.end_at IS NULL OR a.end_at >= now())
    ORDER BY a.priority DESC, a.display_order ASC, a.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to increment impressions
CREATE OR REPLACE FUNCTION public.increment_ad_impressions(ad_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.city_ads
    SET impressions_count = impressions_count + 1
    WHERE id = ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to increment clicks
CREATE OR REPLACE FUNCTION public.increment_ad_clicks(ad_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.city_ads
    SET clicks_count = clicks_count + 1
    WHERE id = ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON TABLE public.city_ads IS 'Internal Troll City promotional ads for house promos, special offers, and announcements';
COMMENT ON COLUMN public.city_ads.placement IS 'Placement location: left_sidebar_screensaver or right_panel_featured';
COMMENT ON COLUMN public.city_ads.label IS 'Display label shown on the ad card (e.g., Troll City Promo, Special Offer)';
COMMENT ON COLUMN public.city_ads.campaign_type IS 'Type of campaign: troll_coins, trollmonds, go_live, event, feature, limited_offer, announcement';