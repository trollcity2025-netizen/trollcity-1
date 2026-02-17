CREATE TABLE IF NOT EXISTS public.repossession_yard_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_type TEXT NOT NULL CHECK (asset_type IN ('property', 'vehicle')),
    asset_id UUID NOT NULL, -- This will be FK to properties.id or user_vehicles.id
    original_owner_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    repossessed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    repossessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    repossession_reason TEXT,
    current_yard_status TEXT NOT NULL DEFAULT 'in_yard' CHECK (current_yard_status IN ('in_yard', 'awaiting_auction', 'returned_to_owner', 'sold')),
    yard_location TEXT, -- e.g., "Lot A, Spot 1"
    auction_date TIMESTAMP WITH TIME ZONE,
    sale_price BIGINT,
    sold_to_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_repossession_yard_inventory_asset_id ON public.repossession_yard_inventory(asset_id);
CREATE INDEX IF NOT EXISTS idx_repossession_yard_inventory_original_owner_user_id ON public.repossession_yard_inventory(original_owner_user_id);
CREATE INDEX IF NOT EXISTS idx_repossession_yard_inventory_repossessed_by ON public.repossession_yard_inventory(repossessed_by);
CREATE INDEX IF NOT EXISTS idx_repossession_yard_inventory_asset_type_status ON public.repossession_yard_inventory(asset_type, current_yard_status);

-- Add RLS
ALTER TABLE public.repossession_yard_inventory ENABLE ROW LEVEL SECURITY;

-- Policies for admin/officer access and owner view
CREATE POLICY "Admins and Lead Officers can manage repossession yard"
    ON public.repossession_yard_inventory
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'lead_troll_officer')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'lead_troll_officer')
        )
    );

-- Policy to allow original owner to view their repossessed assets (if not sold)
CREATE POLICY "Original owner can view their repossessed assets"
    ON public.repossession_yard_inventory
    FOR SELECT
    USING (
        original_owner_user_id = auth.uid() AND current_yard_status NOT IN ('sold')
    );