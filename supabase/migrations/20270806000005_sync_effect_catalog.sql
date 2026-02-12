-- Sync entrance_effects (UI table) to entrance_effect_catalog (Backend constraint table)
-- This fixes the foreign key violation when activating an effect

INSERT INTO public.entrance_effect_catalog (id, name, description, cost_coins, is_enabled, created_at, metadata)
SELECT 
    id,
    name,
    description,
    coin_cost,
    is_active,
    created_at,
    jsonb_build_object(
        'rarity', rarity,
        'icon', icon,
        'animation_type', animation_type
    )
FROM public.entrance_effects
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    cost_coins = EXCLUDED.cost_coins,
    is_enabled = EXCLUDED.is_enabled,
    metadata = EXCLUDED.metadata;
