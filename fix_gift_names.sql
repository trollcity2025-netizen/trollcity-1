-- Fix gift_items names that have 'gift_' prefix
-- This script removes the 'gift_' prefix from gift_names if present

-- First, let's see what we're working with
SELECT id, name, gift_slug, icon, value 
FROM gift_items 
WHERE name LIKE 'gift_%'
LIMIT 20;

-- Update gift_items to fix names with gift_ prefix
UPDATE gift_items
SET name = REPLACE(name, 'gift_', '')
WHERE name LIKE 'gift_%';

-- Also check if there are any purchasable_items that need fixing
SELECT id, item_key, display_name, category, coin_price 
FROM purchasable_items 
WHERE category = 'gift' 
AND display_name LIKE 'gift_%'
LIMIT 20;

-- Update purchasable_items if needed
UPDATE purchasable_items
SET display_name = REPLACE(display_name, 'gift_', '')
WHERE category = 'gift' 
AND display_name LIKE 'gift_%';
