-- Ensure user_inventory references marketplace_items for Supabase schema cache
BEGIN;

ALTER TABLE user_inventory
DROP CONSTRAINT IF EXISTS user_inventory_item_id_fkey;

ALTER TABLE user_inventory
ADD CONSTRAINT user_inventory_marketplace_item_fkey
FOREIGN KEY (item_id) REFERENCES marketplace_items(id) ON DELETE CASCADE;

COMMIT;
