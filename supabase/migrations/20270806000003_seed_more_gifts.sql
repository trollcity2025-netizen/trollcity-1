-- Seed a HUGE amount of gifts into purchasable_items and gift_items
-- Categories: Common, Love, Troll, Hype, Luxury, Legendary

DO $$
BEGIN
    -- 1. Seed purchasable_items
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchasable_items') THEN
        INSERT INTO public.purchasable_items (item_key, display_name, category, coin_price, is_active, metadata)
        VALUES
        -- Common
        ('gift_cookie', 'Cookie', 'gift', 1, true, '{"icon": "🍪", "subcategory": "Common"}'),
        ('gift_icecream', 'Ice Cream', 'gift', 5, true, '{"icon": "🍦", "subcategory": "Common"}'),
        ('gift_pizza', 'Pizza', 'gift', 10, true, '{"icon": "🍕", "subcategory": "Common"}'),
        ('gift_beer', 'Beer', 'gift', 10, true, '{"icon": "🍺", "subcategory": "Common"}'),
        ('gift_thumbsup', 'Thumbs Up', 'gift', 10, true, '{"icon": "👍", "subcategory": "Common"}'),
        ('gift_clap', 'Clap', 'gift', 15, true, '{"icon": "👏", "subcategory": "Common"}'),
        ('gift_poo', 'Poo', 'gift', 20, true, '{"icon": "💩", "subcategory": "Common"}'),
        ('gift_clown', 'Clown', 'gift', 25, true, '{"icon": "🤡", "subcategory": "Common"}'),
        ('gift_salt', 'Salt', 'gift', 30, true, '{"icon": "🧂", "subcategory": "Common"}'),
        ('gift_toiletpaper', 'Toilet Paper', 'gift', 35, true, '{"icon": "🧻", "subcategory": "Common"}'),
        ('gift_eggplant', 'Eggplant', 'gift', 40, true, '{"icon": "🍆", "subcategory": "Common"}'),
        ('gift_peach', 'Peach', 'gift', 40, true, '{"icon": "🍑", "subcategory": "Common"}'),
        
        -- Love
        ('gift_kiss', 'Kiss', 'gift', 50, true, '{"icon": "💋", "subcategory": "Love"}'),
        ('gift_loveletter', 'Love Letter', 'gift', 75, true, '{"icon": "💌", "subcategory": "Love"}'),
        ('gift_bouquet', 'Bouquet', 'gift', 100, true, '{"icon": "💐", "subcategory": "Love"}'),
        ('gift_teddybear', 'Teddy Bear', 'gift', 150, true, '{"icon": "🧸", "subcategory": "Love"}'),
        ('gift_chocolate', 'Chocolate', 'gift', 150, true, '{"icon": "🍫", "subcategory": "Love"}'),
        ('gift_ring', 'Ring', 'gift', 500, true, '{"icon": "💍", "subcategory": "Love"}'),

        -- Troll
        ('gift_trollface', 'Troll Face', 'gift', 69, true, '{"icon": "👺", "subcategory": "Troll"}'),
        ('gift_banhammer', 'Ban Hammer', 'gift', 100, true, '{"icon": "🔨", "subcategory": "Troll"}'),
        ('gift_warning', 'Warning', 'gift', 50, true, '{"icon": "⚠️", "subcategory": "Troll"}'),
        ('gift_dumpsterfire', 'Dumpster Fire', 'gift', 150, true, '{"icon": "🗑️🔥", "subcategory": "Troll"}'),
        ('gift_404', '404 Error', 'gift', 404, true, '{"icon": "🚫", "subcategory": "Troll"}'),
        ('gift_lag', 'Lag Switch', 'gift', 300, true, '{"icon": "📶", "subcategory": "Troll"}'),
        ('gift_skull', 'RIP', 'gift', 66, true, '{"icon": "💀", "subcategory": "Troll"}'),

        -- Hype
        ('gift_party', 'Party', 'gift', 100, true, '{"icon": "🎉", "subcategory": "Hype"}'),
        ('gift_confetti', 'Confetti', 'gift', 100, true, '{"icon": "🎊", "subcategory": "Hype"}'),
        ('gift_100', '100', 'gift', 100, true, '{"icon": "💯", "subcategory": "Hype"}'),
        ('gift_crown', 'Crown', 'gift', 250, true, '{"icon": "👑", "subcategory": "Hype"}'),
        ('gift_trophy', 'Trophy', 'gift', 300, true, '{"icon": "🏆", "subcategory": "Hype"}'),
        ('gift_medal', 'Medal', 'gift', 200, true, '{"icon": "🥇", "subcategory": "Hype"}'),
        ('gift_siren', 'Siren', 'gift', 150, true, '{"icon": "🚨", "subcategory": "Hype"}'),
        ('gift_muscle', 'Flex', 'gift', 120, true, '{"icon": "💪", "subcategory": "Hype"}'),

        -- Luxury
        ('gift_cash', 'Cash Stack', 'gift', 1000, true, '{"icon": "💵", "subcategory": "Luxury"}'),
        ('gift_goldbar', 'Gold Bar', 'gift', 2000, true, '{"icon": "🥇", "subcategory": "Luxury"}'),
        ('gift_watch', 'Rolex', 'gift', 2500, true, '{"icon": "⌚", "subcategory": "Luxury"}'),
        ('gift_car', 'Sports Car', 'gift', 3000, true, '{"icon": "🏎️", "subcategory": "Luxury"}'),
        ('gift_yacht', 'Yacht', 'gift', 4000, true, '{"icon": "🛥️", "subcategory": "Luxury"}'),
        ('gift_plane', 'Private Jet', 'gift', 4500, true, '{"icon": "✈️", "subcategory": "Luxury"}'),
        ('gift_mansion', 'Mansion', 'gift', 4800, true, '{"icon": "🏰", "subcategory": "Luxury"}'),

        -- Legendary
        ('gift_planet', 'Planet', 'gift', 5000, true, '{"icon": "🪐", "subcategory": "Legendary"}'),
        ('gift_galaxy', 'Galaxy', 'gift', 7500, true, '{"icon": "🌌", "subcategory": "Legendary"}'),
        ('gift_blackhole', 'Black Hole', 'gift', 9000, true, '{"icon": "⚫", "subcategory": "Legendary"}'),
        ('gift_unicorn', 'Unicorn', 'gift', 5500, true, '{"icon": "🦄", "subcategory": "Legendary"}'),
        ('gift_phoenix', 'Phoenix', 'gift', 6000, true, '{"icon": "🐦‍🔥", "subcategory": "Legendary"}'),
        ('gift_timemachine', 'Time Machine', 'gift', 8888, true, '{"icon": "⏳", "subcategory": "Legendary"}'),
        ('gift_alien', 'Alien Invasion', 'gift', 7000, true, '{"icon": "👽", "subcategory": "Legendary"}')

        ON CONFLICT (item_key) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            coin_price = EXCLUDED.coin_price,
            is_active = EXCLUDED.is_active,
            metadata = EXCLUDED.metadata;
    END IF;

    -- 2. Seed gift_items (Fallback)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gift_items') THEN
        INSERT INTO public.gift_items (name, value, icon, gift_slug, category, currency)
        VALUES
        ('Cookie', 1, '🍪', 'gift_cookie', 'Common', 'troll_coins'),
        ('Ice Cream', 5, '🍦', 'gift_icecream', 'Common', 'troll_coins'),
        ('Pizza', 10, '🍕', 'gift_pizza', 'Common', 'troll_coins'),
        ('Beer', 10, '🍺', 'gift_beer', 'Common', 'troll_coins'),
        ('Thumbs Up', 10, '👍', 'gift_thumbsup', 'Common', 'troll_coins'),
        ('Clap', 15, '👏', 'gift_clap', 'Common', 'troll_coins'),
        ('Poo', 20, '💩', 'gift_poo', 'Common', 'troll_coins'),
        ('Clown', 25, '🤡', 'gift_clown', 'Common', 'troll_coins'),
        ('Salt', 30, '🧂', 'gift_salt', 'Common', 'troll_coins'),
        ('Toilet Paper', 35, '🧻', 'gift_toiletpaper', 'Common', 'troll_coins'),
        ('Eggplant', 40, '🍆', 'gift_eggplant', 'Common', 'troll_coins'),
        ('Peach', 40, '🍑', 'gift_peach', 'Common', 'troll_coins'),
        
        ('Kiss', 50, '💋', 'gift_kiss', 'Love', 'troll_coins'),
        ('Love Letter', 75, '💌', 'gift_loveletter', 'Love', 'troll_coins'),
        ('Bouquet', 100, '💐', 'gift_bouquet', 'Love', 'troll_coins'),
        ('Teddy Bear', 150, '🧸', 'gift_teddybear', 'Love', 'troll_coins'),
        ('Chocolate', 150, '🍫', 'gift_chocolate', 'Love', 'troll_coins'),
        ('Ring', 500, '💍', 'gift_ring', 'Love', 'troll_coins'),

        ('Troll Face', 69, '👺', 'gift_trollface', 'Troll', 'troll_coins'),
        ('Ban Hammer', 100, '🔨', 'gift_banhammer', 'Troll', 'troll_coins'),
        ('Warning', 50, '⚠️', 'gift_warning', 'Troll', 'troll_coins'),
        ('Dumpster Fire', 150, '🗑️🔥', 'gift_dumpsterfire', 'Troll', 'troll_coins'),
        ('404 Error', 404, '🚫', 'gift_404', 'Troll', 'troll_coins'),
        ('Lag Switch', 300, '📶', 'gift_lag', 'Troll', 'troll_coins'),
        ('RIP', 66, '💀', 'gift_skull', 'Troll', 'troll_coins'),

        ('Party', 100, '🎉', 'gift_party', 'Hype', 'troll_coins'),
        ('Confetti', 100, '🎊', 'gift_confetti', 'Hype', 'troll_coins'),
        ('100', 100, '💯', 'gift_100', 'Hype', 'troll_coins'),
        ('Crown', 250, '👑', 'gift_crown', 'Hype', 'troll_coins'),
        ('Trophy', 300, '🏆', 'gift_trophy', 'Hype', 'troll_coins'),
        ('Medal', 200, '🥇', 'gift_medal', 'Hype', 'troll_coins'),
        ('Siren', 150, '🚨', 'gift_siren', 'Hype', 'troll_coins'),
        ('Flex', 120, '💪', 'gift_muscle', 'Hype', 'troll_coins'),

        ('Cash Stack', 1000, '💵', 'gift_cash', 'Luxury', 'troll_coins'),
        ('Gold Bar', 2000, '🥇', 'gift_goldbar', 'Luxury', 'troll_coins'),
        ('Rolex', 2500, '⌚', 'gift_watch', 'Luxury', 'troll_coins'),
        ('Sports Car', 3000, '🏎️', 'gift_car', 'Luxury', 'troll_coins'),
        ('Yacht', 4000, '🛥️', 'gift_yacht', 'Luxury', 'troll_coins'),
        ('Private Jet', 4500, '✈️', 'gift_plane', 'Luxury', 'troll_coins'),
        ('Mansion', 4800, '🏰', 'gift_mansion', 'Luxury', 'troll_coins'),

        ('Planet', 5000, '🪐', 'gift_planet', 'Legendary', 'troll_coins'),
        ('Galaxy', 7500, '🌌', 'gift_galaxy', 'Legendary', 'troll_coins'),
        ('Black Hole', 9000, '⚫', 'gift_blackhole', 'Legendary', 'troll_coins'),
        ('Unicorn', 5500, '🦄', 'gift_unicorn', 'Legendary', 'troll_coins'),
        ('Phoenix', 6000, '🐦‍🔥', 'gift_phoenix', 'Legendary', 'troll_coins'),
        ('Time Machine', 8888, '⏳', 'gift_timemachine', 'Legendary', 'troll_coins'),
        ('Alien Invasion', 7000, '👽', 'gift_alien', 'Legendary', 'troll_coins')

        ON CONFLICT DO NOTHING;
    END IF;
END $$;
